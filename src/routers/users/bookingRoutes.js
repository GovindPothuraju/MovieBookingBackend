const express = require("express");
const bookingRouter = express.Router();
const { userAuth} = require('../../middleware/userAuth');
const { default: mongoose } = require("mongoose");



const {validateLockSeatsRequest,validateShowAndSeats,validateBookedSeats} = require("../../utils/users/bookingValidation");
const { lockSeats } = require("../../utils/redis/seatLock");
/**
 * POST /bookings/lock
 * User: temporarily lock selected seats before payment (Redis)
 */
bookingRouter.post("/bookings/lock", userAuth, async (req, res) => {
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
 * DELETE /bookings/lock
 * User: release previously locked seats (cancel/timeout)
 */

/**
 * POST /bookings
 * User: confirm payment and create a booking for locked seats
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