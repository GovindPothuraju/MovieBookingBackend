const express = require('express');
const showRoutes = express.Router();

const mongoose = require('mongoose');
const Show = require('../../models/admin/showModel');
const Seat = require('../../models/admin/seatSchema');
const Theater = require('../../models/admin/theaterModel');
const Movie = require("../../models/admin/movieModel")

const { userAuth } = require('../../middleware/userAuth');


/**
 * GET /movies/shows/:slug/:date
 * User: get shows for a movie on a specific date
 */
showRoutes.get("/movies/shows/:slug/:date", userAuth, async (req, res) => {
  try {
    const { slug, date } = req.params;

    // Validate date
    const selectedDate = new Date(date);

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    // Find movie
    const movie = await Movie.findOne({
      slug,
      isActive: true,
      status: "NOW_SHOWING",
    }).select("_id title slug");

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    // Start and end of requested UTC date
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // Find shows
    const shows = await Show.find({
      movieId: movie._id,
      showTime: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: "SCHEDULED",
    })
      .populate("theaterId", "name location")
      .populate("screenId", "name")
      .sort({ showTime: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Shows fetched successfully",
      data: {
        movie,
        date,
        shows,
      },
    });
  } catch (err) {
    console.error("Get Shows Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * GET /shows/:showId/seats
 * User: get seat availability for a show
 */
showRoutes.get("/shows/:showId/seats", userAuth, async (req, res) => {
  try {

    const { showId } = req.params;

    // Validate showId
    if (!mongoose.Types.ObjectId.isValid(showId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid showId",
      });
    }

    // Get show
    const show = await Show.findById(showId)
      .select("screenId bookedSeats priceMap showTime")
      .lean();

    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found",
      });
    }

    // Get seat layout
    const seats = await Seat.find({
      screenId: show.screenId,
      isActive: true,
    })
      .sort({
        row: 1,
        column: 1,
      })
      .lean();

    // Mark booked seats
    const seatAvailability = seats.map(seat => ({
      ...seat,
      isBooked: show.bookedSeats.includes(seat.seatLabel),
    }));

    return res.status(200).json({
      success: true,

      data: {
        showId: show._id,
        showTime: show.showTime,
        priceMap: show.priceMap,
        seats: seatAvailability,
      },
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Error fetching seat availability",
    });
  }
});

/**
 * DELETE /shows/:showId/seats/lock
 * User: release their seat locks
 */
showRoutes.delete(
  "/shows/:showId/seats/lock",
  userAuth,
  async (req, res) => {
    try {
      const { showId } = req.params;
      const { seats } = req.body;

      const userId = req.user._id;

      if (!Array.isArray(seats) || seats.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Seats are required",
        });
      }

      // Release only locks owned by this user
      const result = await releaseSeatLocks({
        showId,
        userId: userId.toString(),
        seatLabels: seats,
      });

      return res.status(200).json({
        success: true,
        message: "Seat locks released successfully",
        data: result,
      });
    } catch (err) {
      console.error("Release seat locks error:", err);

      return res.status(500).json({
        success: false,
        message: err.message || "Failed to release seat locks",
      });
    }
  }
);
module.exports = showRoutes ;