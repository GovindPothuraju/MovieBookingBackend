const mongoose = require("mongoose");
const crypto = require("crypto");

const Booking = require("../models/bookingSchema");
const { verifySeatLocks, releaseSeatLocks } = require("../utils/redis/seatLock");
const { validateBookingDetails, validateBookedSeats } = require("../utils/users/bookingValidation");
const { generateQRCode } = require("../utils/qrGenerator");

const sendEmail = require("../utils/emailTemplates/sendEmail");
const bookingTemplate = require("../utils/emailTemplates/bookingTemplate");

const User = require("../models/users/userModel");
const Movie = require("../models/admin/movieModel");
const Theater = require("../models/admin/theaterModel");
const Screen = require("../models/admin/screenModel");

const createBooking = async ({ payment }) => {
  if (!payment) {
    throw new Error("Payment information is required");
  }

  const {
    userId,
    showId,
    razorpayPaymentId,
    paymentMethod,
  } = payment;

  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!showId) {
    throw new Error("Show ID is required");
  }

  if (!razorpayPaymentId) {
    throw new Error("Payment ID is required");
  }

  // 1. Check whether booking already exists
  const existingBooking = await Booking.findOne({
    paymentId: razorpayPaymentId,
  });

  if (existingBooking) {
    return existingBooking;
  }

  // 2. Verify Redis seat locks
  const lockValidation = await verifySeatLocks({
    showId: showId.toString(),
    userId: userId.toString(),
  });

  if (!lockValidation.success) {
    throw new Error(
      lockValidation.message || "Seat lock expired"
    );
  }

  const seatLabels = [
    ...new Set(lockValidation.seatLabels || []),
  ];

  if (seatLabels.length === 0) {
    throw new Error("No seats found in Redis lock");
  }

  // 3. Validate booking details
  const bookingValidation = await validateBookingDetails(
    showId,
    seatLabels
  );

  if (!bookingValidation.isValid) {
    throw new Error(bookingValidation.message);
  }

  const {
    show,
    seatDocuments,
    totalAmount,
  } = bookingValidation;

  if (!show) {
    throw new Error("Show not found");
  }

  // 4. Check whether seats are already booked
  const bookedValidation = await validateBookedSeats(
    show._id,
    seatDocuments
  );

  if (!bookedValidation.isValid) {
    throw new Error(bookedValidation.message);
  }

  const session = await mongoose.startSession();
  let booking;

  try {
    // 5. Start MongoDB transaction
    session.startTransaction();

    // 6. Check duplicate payment inside transaction
    const duplicateBooking = await Booking.findOne({
      paymentId: razorpayPaymentId,
    }).session(session);

    if (duplicateBooking) {
      await session.commitTransaction();
      return duplicateBooking;
    }

    // 7. Generate booking ID
    const bookingId = `BK-${crypto
      .randomUUID()
      .split("-")[0]
      .toUpperCase()}`;

    // 8. Create booking
    const createdBookings = await Booking.create(
      [
        {
          bookingId,
          userId,
          showId: show._id,
          movieId: show.movieId,
          theaterId: show.theaterId,
          screenId: show.screenId,
          seats: seatLabels,
          totalAmount,
          paymentStatus: "SUCCESS",
          bookingStatus: "CONFIRMED",
          paymentId: razorpayPaymentId,
          paymentMethod: paymentMethod || "UNKNOWN",
        },
      ],
      { session }
    );

    booking = createdBookings[0];

    // 9. Calculate booked seats by category
    const categoryCount = {};

    for (const seat of seatDocuments) {
      if (!seat.category) {
        throw new Error(
          `Category not found for seat ${seat.seatLabel}`
        );
      }

      categoryCount[seat.category] =
        (categoryCount[seat.category] || 0) + 1;
    }

    // 10. Validate category availability
    for (const category in categoryCount) {
      const priceInfo = show.priceMap.get(category);

      if (!priceInfo) {
        throw new Error(
          `Pricing not found for category ${category}`
        );
      }

      if (
        priceInfo.availableSeats <
        categoryCount[category]
      ) {
        throw new Error(
          `Not enough ${category} seats available`
        );
      }
    }

    // 11. Update booked seats
    show.bookedSeats.push(...seatLabels);

    // 12. Update available seats
    for (const category in categoryCount) {
      const priceInfo = show.priceMap.get(category);

      priceInfo.availableSeats -=
        categoryCount[category];
    }

    // 13. Save show changes
    await show.save({ session });

    // 14. Commit transaction
    await session.commitTransaction();
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    throw err;
  } finally {
    await session.endSession();
  }

  // 15. Release Redis locks immediately after successful booking
  try {
    await releaseSeatLocks({
      showId: showId.toString(),
      seatLabels,
      userId: userId.toString(),
    });
  } catch (err) {
    console.error(
      "Redis lock release failed:",
      err.message
    );
  }

  // 16. Generate QR code
  let qrCode = null;

  try {
    qrCode = await generateQRCode({
      bookingId: booking.bookingId,
      userId: userId.toString(),
      showId: show._id.toString(),
      movieId: show.movieId.toString(),
      theaterId: show.theaterId.toString(),
      screenId: show.screenId.toString(),
      seats: seatLabels,
    });

    if (qrCode) {
      await Booking.updateOne(
        { _id: booking._id },
        { $set: { qrCode } }
      );

      booking.qrCode = qrCode;
    }
  } catch (err) {
    console.error(
      "QR generation failed:",
      err.message
    );
  }

  // 17. Fetch email information
  try {
    const [user, movie, theater, screen] =
      await Promise.all([
        User.findById(userId)
          .select("firstName email")
          .lean(),

        Movie.findById(show.movieId)
          .select("title")
          .lean(),

        Theater.findById(show.theaterId)
          .select("name")
          .lean(),

        Screen.findById(show.screenId)
          .select("name")
          .lean(),
      ]);

    // 18. Validate email information
    if (!user?.email) {
      console.error("User email not found");
      return booking;
    }

    if (!movie) {
      console.error("Movie not found");
      return booking;
    }

    if (!theater) {
      console.error("Theater not found");
      return booking;
    }

    if (!screen) {
      console.error("Screen not found");
      return booking;
    }

    // 19. Create booking email
    const emailData = bookingTemplate({
      userName: user.firstName || "Customer",
      bookingId: booking.bookingId,
      movieName: movie.title,
      theaterName: theater.name,
      screenName: screen.name,
      showTime: show.showTime,
      seats: seatLabels,
      amount: totalAmount,
      qrCode,
    });

    // 20. Send booking email
    try {
      await sendEmail({
        to: user.email,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });
    } catch (err) {
      console.error(
        "Booking email failed:",
        err.message
      );
    }
  } catch (err) {
    console.error(
      "Booking email preparation failed:",
      err.message
    );
  }

  // 21. Return successful booking
  return booking;
};

module.exports = {
  createBooking,
};