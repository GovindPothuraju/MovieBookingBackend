const mongoose = require("mongoose");
const crypto = require("crypto");

const Booking = require("../models/bookingSchema");
const redisClient = require("../config/redis");

const { verifySeatLocks} = require("../utils/redis/seatLock");

const { validateBookingDetails,validateBookedSeats} = require("../utils/users/bookingValidation");

const {generateQRCode} = require("../utils/qrGenerator");

// for email related
const sendEmail = require("../utils/emailTemplates/sendEmail");

const bookingTemplate = require(
  "../utils/emailTemplates/bookingTemplate"
);

const User = require("../models/users/userModel");
const Movie = require("../models/admin/movieModel");
const Theater = require("../models/admin/theaterModel");
const Screen = require("../models/admin/screenModel");

const createBooking = async ({ payment }) => {
  const session = await mongoose.startSession();

  try {
    const userId = payment.userId;
    const showId = payment.showId;
    // 1. Verify Redis Locks
    const lockValidation = await verifySeatLocks({
      showId,
      userId,
    });

    if (!lockValidation.success) {
      throw new Error(lockValidation.message);
    }

    const { seatLabels } = lockValidation;

    // 2. Validate Booking Details

    const bookingValidation =
      await validateBookingDetails(
        showId,
        seatLabels
      );

    if (!bookingValidation.isValid) {
      throw new Error(
        bookingValidation.message
      );
    }

    const {
      show,
      seatDocuments,
      totalAmount,
    } = bookingValidation;

    // 3. Check Already Booked

    const bookedValidation =
      await validateBookedSeats(
        show._id,
        seatDocuments
      );

    if (!bookedValidation.isValid) {
      throw new Error(
        bookedValidation.message
      );
    }

    // 4. Start Transaction

    session.startTransaction();

    

    const bookingId =`BK-${crypto.randomUUID().split("-")[0].toUpperCase()}`;
    const booking = await Booking.create(
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

          paymentId: payment.razorpayPaymentId,

          paymentMethod:
            payment.paymentMethod,
        },
      ],
      { session }
    );

    // 5. Update Show

    show.bookedSeats.push(...seatLabels);

    const categoryCount = {};

    for (const seat of seatDocuments) {
      categoryCount[seat.category] =
        (categoryCount[seat.category] || 0) + 1;
    }

    for (const category in categoryCount) {
      const priceInfo =
        show.priceMap.get(category);

      if (!priceInfo) {
        throw new Error(
          `Pricing not found for category ${category}`
        );
      }

      priceInfo.availableSeats -=
        categoryCount[category];
    }

    await show.save({ session });

    // 6. Commit Transaction
    await session.commitTransaction();
    // 7. generate a qr
   try {
      const qrCode = await generateQRCode({
        bookingId: booking[0].bookingId,
        userId: userId.toString(),
        showId: show._id.toString(),
        movieId: show.movieId.toString(),
        theaterId: show.theaterId.toString(),
        screenId: show.screenId.toString(),
        seats: seatLabels,
      });

      booking[0].qrCode = qrCode;
      await booking[0].save();
    } catch (err) {
      console.error("QR Generation Failed:", err.message);
    }

  
    // 8. email sending after booking
    
  const [user, movie, theater, screen] =
    await Promise.all([
      User.findById(userId),
      Movie.findById(show.movieId),
      Theater.findById(show.theaterId),
      Screen.findById(show.screenId),
    ]);
    const emailTemplate = bookingTemplate({
      userName: user.name,
      bookingId: booking[0].bookingId,
      movieName: movie.title,
      theaterName: theater.name,
      screenName: screen.name,
      showTime: show.showTime,
      seats: seatLabels,
      amount: totalAmount,
      qrCode: booking[0].qrCode,
    });

    try {
      await sendEmail({
        to: user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
    } catch (err) {
      console.error("Email Failed:", err.message);
    }
    // 9. Release Redis Locks

    for (const seatLabel of seatLabels) {
      const seatKey = `seat_lock:${showId}:${seatLabel}`;

      await redisClient.del(seatKey);
    }

    const bookingKey = `booking_lock:${userId}:${showId}`;

    await redisClient.del(bookingKey);

    return booking[0];
  } catch (err) {
    if (session.inTransaction()) {
        await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = {
  createBooking,
};