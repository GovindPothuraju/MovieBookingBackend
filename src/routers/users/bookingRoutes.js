const express = require("express");
const bookingRouter = express.Router();
const mongoose = require("mongoose");

const { userAuth } = require("../../middleware/userAuth");

const Booking = require("../../models/bookingSchema");
const redisClient = require("../../config/redis");

const {
  validateLockSeatsRequest,
  validateShowAndSeats,
  validateBookedSeats,
} = require("../../utils/users/bookingValidation");

const {
  lockSeats,
  releaseSeatLocks,
  releaseAllUserSeatLocks,
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

    // Validate request
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

    // Extract seat IDs
    const seatIds = seats.map((seat) => seat._id);

    // Validate show and seats
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

    // Check whether seats are already booked
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

    // Convert DB seats to labels
    const seatLabels = seatDocuments.map(
      (seat) => seat.seatLabel
    );

    // Remove duplicate seats
    const uniqueSeatLabels = [
      ...new Set(seatLabels),
    ];

    // Lock seats atomically in Redis
    const redisLock = await lockSeats({
      showId: show._id.toString(),
      seatLabels: uniqueSeatLabels,
      userId: userId.toString(),
    });

    if (!redisLock.success) {
      return res.status(409).json({
        success: false,
        message:
          redisLock.message ||
          `Seat ${redisLock.seat} was just selected by another user.`,
        seat: redisLock.seat,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seats locked successfully.",
      data: {
        showId: show._id,
        seats: uniqueSeatLabels,
        expiresIn: LOCK_TTL,
      },
    });
  } catch (err) {
    console.error("Seat lock error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to lock seats",
    });
  }
});

/**
 * DELETE /bookings/lock
 * User: release their own temporarily locked seats
 */
bookingRouter.delete(
  "/bookings/lock",
  userAuth,
  async (req, res) => {
    try {
      const { showId, seats } = req.body;
      const userId = req.user._id;

      if (!showId) {
        return res.status(400).json({
          success: false,
          message: "Show ID is required",
        });
      }

      if (
        !Array.isArray(seats) ||
        seats.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Seats are required",
        });
      }

      // Validate showId
      if (!mongoose.Types.ObjectId.isValid(showId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid show ID",
        });
      }

      // Extract seat labels
      const seatLabels = seats
        .map((seat) => {
          if (typeof seat === "string") {
            return seat;
          }

          return seat.seatLabel;
        })
        .filter(Boolean);

      if (seatLabels.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Valid seat labels are required",
        });
      }

      // Release only user's own locks
      const result = await releaseSeatLocks({
        showId,
        seatLabels,
        userId: userId.toString(),
      });

      return res.status(200).json({
        success: true,
        message: "Seat locks released successfully",
        data: {
          released: result.released,
        },
      });
    } catch (err) {
      console.error("Release seat lock error:", err);

      return res.status(500).json({
        success: false,
        message:
          err.message || "Failed to release seat locks",
      });
    }
  }
);

/**
 * DELETE /bookings/lock/all
 * User: release all their locks for a show
 */
bookingRouter.delete(
  "/bookings/lock/all",
  userAuth,
  async (req, res) => {
    try {
      const { showId } = req.body;
      const userId = req.user._id;

      if (!showId) {
        return res.status(400).json({
          success: false,
          message: "Show ID is required",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(showId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid show ID",
        });
      }

      const result = await releaseAllUserSeatLocks({
        showId,
        userId: userId.toString(),
      });

      return res.status(200).json({
        success: true,
        message: "All seat locks released successfully",
        data: {
          released: result.released,
        },
      });
    } catch (err) {
      console.error(
        "Release all seat locks error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Failed to release all seat locks",
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
      console.error("Get my bookings error:", err);

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Failed to fetch bookings",
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

      // Validate MongoDB ObjectId
      if (
        !mongoose.Types.ObjectId.isValid(bookingId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID.",
        });
      }

      const booking = await Booking.findOne({
        _id: bookingId,
        userId: req.user._id,
      })
        .populate("movieId", "title poster")
        .populate("theaterId", "name location")
        .populate("screenId", "name")
        .populate("showId", "showTime")
        .lean();

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
          "Failed to fetch booking",
      });
    }
  }
);

module.exports = bookingRouter;