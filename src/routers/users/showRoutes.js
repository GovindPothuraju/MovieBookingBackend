const express = require('express');
const showRoutes = express.Router();

const mongoose = require('mongoose');
const Show = require('../../models/admin/showModel');
const Seat = require('../../models/admin/seatSchema');
const Theater = require('../../models/admin/theaterModel');

/**
 * GET /shows/:movieId/:date
 * User: get all available shows for a movie by date
 */
showRoutes.get('/movies/shows/:movieId/:date', async (req, res) => {
  try {
    // 1. get movieId and date from req.params
    const { movieId, date } = req.params;
    // 2. validate movieId and date (basic validation)
    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid movieId',
      });
    }

    // Convert incoming date param to a Date object
    const startDate = new Date(date);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date',
      });
    }
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    // 4. fetch shows from the database that match the movieId and date range
    const shows = await Show.find({
      movieId : new mongoose.Types.ObjectId(movieId),
      status: "scheduled",
      showTime:{
        $gte: startDate,
        $lt: endDate
      }
    })
    .populate('theaterId', 'name location')
    .populate('screenId', 'name')
    .sort({ showTime: 1 })
    .lean();

    // 5. group shows by theater and format the response
    const groupedShows = {};

    shows.forEach(show => {
      const theaterId = show.theaterId._id.toString();
      if (!groupedShows[theaterId]) {
        groupedShows[theaterId] = {
          theater: show.theaterId,
          shows: []
        };
      }
      groupedShows[theaterId].shows.push({
        showId: show._id,
        screen: show.screenId.name,
        showTime: show.showTime
      });
    });
    const result = Object.values(groupedShows);
    
    res.status(200).json({
      message: 'Shows fetched successfully',
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching shows',
      error: err.message
    });
  }
});


/**
 * GET /shows/:showId/seats
 * User: get seat availability for a show
 */
showRoutes.get("/shows/:showId/seats", async (req, res) => {
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