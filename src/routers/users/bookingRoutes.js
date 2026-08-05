const express = require("express");
const bookingRouter = express.Router();
const { userAuth} = require('../../middleware/userAuth');
const { default: mongoose } = require("mongoose");



const {validateLockSeatsRequest,validateShowAndSeats,validateBookedSeat,validateCreateBookingRequest,validateBookingDetails,} = require("../../utils/users/bookingValidation");
const { lockSeats ,verifySeatLocks} = require("../../utils/redis/seatLock");
/**
 * POST /bookings/lock
 * User: temporarily lock selected seats before payment (Redis)
 */
bookingRouter.post("/bookings/lock",  userAuth, async (req, res) => {
  try {
    // 1. Read request
    const {showId , seats} = req.body;
    const error = validateLockSeatsRequest({ showId, seats });
    if(error){
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // 3. show and seat validation
    const seatIds = seats.map((seat) => seat._id);

    const validation = await validateShowAndSeats(showId, seatIds);

    if (!validation.isValid) {
      return res.status(validation.status).json({
        success: false,
        message: validation.message,
      });
    }

    const { show, seats: seatDocuments } = validation;

    // 4. check seats are already booked or not
    const bookedValidation = await validateBookedSeats( show._id , seatDocuments);
    if (!bookedValidation.isValid) {
      return res.status(bookedValidation.status).json({
        success: false,
        message: bookedValidation.message,
      });
    }
    // 5. Lock seats in Redis (concurrency)
    const seatLabels = seatDocuments.map((seat)=>seat.seatLabel);
    const redisLock = await lockSeats({
      showId : show._id,
      seatLabels,
      userId : req.user._id
    })
    if (!redisLock.success) {
      return res.status(409).json({
          success: false,
          message: `Seat ${redisLock.seat} was just selected by another user.`,
      });
    }
    // 6. Return success
    return res.status(200).json({
        success: true,
        message: "Seats locked successfully.",
        expiresIn: 300
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * POST /bookings
 * User: confirm payment and create a booking for locked seats
 */
bookingRouter.post("/bookings", userAuth, async (req, res) => {
  try {
    // 1. Read request
    const { showId, paymentId } = req.body;

    // 2. Validate request
    const error = validateCreateBookingRequest({ showId,paymentId});
    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // 3. Verify Redis locks
    const lockValidation = await verifySeatLocks({
      showId,userId: req.user._id,
    });

    if (!lockValidation.success) {
      return res.status(lockValidation.status).json({
        success: false,
        message: lockValidation.message,
      });
    }
    const { seatLabels } = lockValidation;
    // 4. Verify booked seats
    const bookingValidation = await validateBookingDetails(
      showId,
      seatLabels
    );

    if (!bookingValidation.isValid) {
      return res.status(bookingValidation.status).json({
        success: false,
        message: bookingValidation.message,
      });
    }

    const {show,seatDocuments,totalAmount,} = bookingValidation;
    const bookedValidation = await validateBookedSeats(
      show._id,
      seatDocuments
    );

    if (!bookedValidation.isValid) {
      return res.status(bookedValidation.status).json({
        success: false,
        message: bookedValidation.message,
      });
    }
    // transaction 
   const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Generate Booking ID
      const bookingId = `BK-${Date.now()}`;

      // Create Booking
      const booking = await Booking.create(
        [
          {
            bookingId,
            userId: req.user._id,
            showId: show._id,
            movieId: show.movieId,
            theaterId: show.theaterId,
            screenId: show.screenId,
            seats: seatLabels,
            totalAmount,
            paymentStatus: "SUCCESS",
            bookingStatus: "CONFIRMED",
            paymentId,
            paymentMethod: "ONLINE",
          },
        ],
        { session }
      );

      // Update booked seats
      show.bookedSeats.push(...seatLabels);

      // Update available seats category wise
      const categoryCount = {};

      for (const seat of seatDocuments) {
        categoryCount[seat.category] =
          (categoryCount[seat.category] || 0) + 1;
      }

      for (const category in categoryCount) {
        const priceInfo = show.priceMap.get(category);

        priceInfo.availableSeats -= categoryCount[category];
      }

      await show.save({ session });

      await session.commitTransaction();

      session.endSession();

      // 8. Release Redis locks

      const bookingKey = `booking_lock:${req.user._id}:${show._id}`;

      const seatKeys = seatLabels.map(
        (seat) => `seat_lock:${show._id}:${seat}`
      );

      await redisClient.del(...seatKeys);

      await redisClient.del(bookingKey);

      return res.status(201).json({
        success: true,
        message: "Booking confirmed successfully.",
        data: booking[0],
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
    // 9. Return success
    return res.status(201).json({
    success: true,
    message: "Booking created successfully.",
    data: {
      bookingId: booking[0].bookingId,
      showId: booking[0].showId,
      seats: booking[0].seats,
      totalAmount: booking[0].totalAmount,
      paymentStatus: booking[0].paymentStatus,
      bookingStatus: booking[0].bookingStatus,
      bookedAt: booking[0].bookedAt,
    },
  });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * DELETE /bookings/lock
 * User: release previously locked seats (cancel/timeout)
 */


/**
 * GET /bookings/me
 * User: get all bookings of the logged-in user
 */

/**
 * GET /bookings/:bookingId
 * User: get details of a specific booking
 */

/**
 * POST /bookings/:bookingId/cancel
 * User: cancel a confirmed booking (subject to cancellation policy)
 */

module.exports = bookingRouter;