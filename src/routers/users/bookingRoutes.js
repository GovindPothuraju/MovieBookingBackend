const express = require("express");
const bookingRouter = express.Router();
const mongoose = require("mongoose");

const { userAuth } = require("../../middleware/userAuth");

const Booking = require("../../models/bookingSchema");

const {
  validateLockSeatsRequest,
  validateShowAndSeats,
  validateBookedSeats,
} = require("../../utils/users/bookingValidation");

const {
  lockSeats,
  releaseSeatLocks,
  LOCK_TTL,
} = require("../../utils/redis/seatLock");

/**
 * POST /bookings/lock
 * User: temporarily lock selected seats before payment
 */
bookingRouter.post("/bookings/lock", userAuth, async (req, res) => {
  try {
    const { showId, seats } = req.body;
    const userId = req.user._id;

    // 1. Validate request
    const error = validateLockSeatsRequest({
      showId,
      seats,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // 2. Check duplicate seat IDs
    const seatIds = seats.map((seat) => seat._id);

    if (new Set(seatIds).size !== seatIds.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate seats are not allowed.",
      });
    }

    // 3. Validate show and seats
    const validation = await validateShowAndSeats(
      showId,
      seatIds
    );

    if (!validation.isValid) {
      return res.status(validation.status).json({
        success: false,
        message: validation.message,
      });
    }

    const {
      show,
      seats: seatDocuments,
    } = validation;

    // 4. Check already booked seats
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

    // 5. Convert to unique seat labels
    const seatLabels = [
      ...new Set(
        seatDocuments.map(
          (seat) => seat.seatLabel
        )
      ),
    ];

    // 6. Lock seats in Redis
    const redisLock = await lockSeats({
      showId: show._id.toString(),
      seatLabels,
      userId: userId.toString(),
    });

    // 7. Redis lock failed
    if (!redisLock.success) {
      return res.status(409).json({
        success: false,
        message:
          redisLock.message ||
          `Seat ${redisLock.seat} was just selected by another user.`,
        seat: redisLock.seat || null,
      });
    }

    // 8. Success
    return res.status(200).json({
      success: true,
      message: "Seats locked successfully.",
      data: {
        showId: show._id,
        seats: seatLabels,
        expiresIn: LOCK_TTL,
      },
    });
  } catch (err) {
    console.error("Seat lock error:", err);

    return res.status(500).json({
      success: false,
      message:
        err.message || "Failed to lock seats.",
    });
  }
});

/**
 * DELETE /bookings/lock
 * User: release their temporarily locked seats
 */
bookingRouter.delete("/bookings/lock", userAuth, async (req, res) => {
    try {
      const { showId, seats } = req.body;
      const userId = req.user._id;

      // 1. Validate show ID
      if (!showId) {
        return res.status(400).json({
          success: false,
          message: "Show ID is required.",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(showId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid show ID.",
        });
      }

      // 2. Validate seats
      if (
        !Array.isArray(seats) ||
        seats.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Seats are required.",
        });
      }

      // 3. Extract seat labels
      const seatLabels = [
        ...new Set(
          seats
            .map((seat) => {
              if (typeof seat === "string") {
                return seat;
              }

              return seat?.seatLabel;
            })
            .filter(Boolean)
        ),
      ];

      if (seatLabels.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Valid seat labels are required.",
        });
      }

      // 4. Release only locks owned by this user
      const result = await releaseSeatLocks({
        showId,
        seatLabels,
        userId: userId.toString(),
      });

      return res.status(200).json({
        success: true,
        message: "Seat locks released successfully.",
        data: {
          released: result.released,
        },
      });
    } catch (err) {
      console.error(
        "Release seat locks error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Failed to release seat locks.",
      });
    }
  }
);

/**
 * GET /bookings/me
 * User: get all bookings of logged-in user
 */
bookingRouter.get(
  "/bookings/me",
  userAuth,
  async (req, res) => {
    try {
      const bookings = await Booking.find({
        userId: req.user._id,
      })
        .populate("movieId", "title poster")
        .populate("theaterId", "name location")
        .populate("showId", "showTime")
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        message: "Bookings fetched successfully.",
        data: bookings,
      });
    } catch (err) {
      console.error(
        "Get user bookings error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Failed to fetch bookings.",
      });
    }
  }
);

/**
 * GET /bookings/:bookingId
 * User: get details of a specific booking
 */
bookingRouter.get(
  "/bookings/:bookingId",
  userAuth,
  async (req, res) => {
    try {
      const { bookingId } = req.params;

      // 1. Validate booking ID
      if (
        !mongoose.Types.ObjectId.isValid(
          bookingId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID.",
        });
      }

      // 2. Find only user's booking
      const booking = await Booking.findOne({
        _id: bookingId,
        userId: req.user._id,
      })
        .populate("movieId", "title poster")
        .populate("theaterId", "name location")
        .populate("screenId", "name")
        .populate("showId", "showTime")
        .lean();

      // 3. Booking not found
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Booking fetched successfully.",
        data: booking,
      });
    } catch (err) {
      console.error(
        "Get booking details error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Failed to fetch booking.",
      });
    }
  }
);

module.exports = bookingRouter;