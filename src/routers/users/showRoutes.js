const express = require('express');
const showRoutes = express.Router();

const mongoose = require('mongoose');
const Show = require('../../models/admin/showModel');
const Seat = require('../../models/admin/seatSchema');
const Theater = require('../../models/admin/theaterModel');

const { userAuth } = require('../../middleware/userAuth');


/**
 * GET /movies/shows/:slug/:date
 * User: get shows for a movie on a specific date
 */
showRoutes.get("/movies/shows/:slug/:date", userAuth, async (req, res) => {
  try {
    // 1. Extract params
    const { slug, date } = req.params;

    // 2. Validate date
    const selectedDate = new Date(date);

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    // 3. Find movie by slug
    const movie = await Movie.findOne({
      slug,
      isActive: true,
    }).select("_id title slug");

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    // 4. Create date range
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 5. Find shows
    const shows = await Show.find({
      movieId: movie._id,
      showTime: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      isActive: true,
    })
      .populate("theaterId", "name location")
      .populate("screenId", "name")
      .sort({ showTime: 1 })
      .lean();

    // 6. Response
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
module.exports = showRoutes ;