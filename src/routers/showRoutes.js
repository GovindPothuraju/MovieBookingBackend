
const express = require('express');
const mongoose = require('mongoose');
const showRouter = express.Router();


const Show = require('../models/showModel');
const Movie = require('../models/movieModel');
const Theater = require('../models/theaterModel');
const Screen = require('../models/screenModel');
const Seat = require('../models/seatSchema');

const {adminAuth, adminMiddleware} = require('../middleware/adminAuth');
const { validateShowInput,validateShowUpdateInput } = require('../validators/showValidator');

// dynamic show status (if show is ended, mark as completed; if cancelled, mark as cancelled; else scheduled)
const getShowStatus = (show) => {
  const now = new Date();
  const showEndTime = new Date(show.showTime.getTime() + 3 * 60 * 60 * 1000);

  if (now >= showEndTime) return "completed";
  if (show.status === "cancelled") return "cancelled";

  return "scheduled";
};

/**
 * POST /shows
 * Admin only: create a new show
 */
showRouter.post('/shows', adminAuth, adminMiddleware, async (req, res) => {
  try {
    // 1 validate input
    const { value, error } = validateShowInput(req);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // 2 validate movie exists
    const movie = await Movie.findById(value.movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    // 3 validate theater exists
    const theater = await Theater.findById(value.theaterId);
    if (!theater) {
      return res.status(404).json({
        success: false,
        message: "Theater not found",
      });
    }

    // 4 validate screen exists
    const screen = await Screen.findOne({
      _id: value.screenId,
      theaterId: value.theaterId,
    });

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found in this theater",
      });
    }

    // 5 prevent creating show in past
    if (value.showTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot create show in the past",
      });
    }

    // 6 check overlapping show (same time)
    const overlappingShow = await Show.findOne({
      theaterId: value.theaterId,
      screenId: value.screenId,
      showTime: value.showTime,
    });

    if (overlappingShow) {
      return res.status(400).json({
        success: false,
        message: "Another show already exists at this time",
      });
    }

    // 7 get seat count per category
    const seatCounts = await Seat.aggregate([
      {
        $match: {
          screenId: new mongoose.Types.ObjectId(value.screenId),
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$category",
          totalSeats: { $sum: 1 },
        },
      },
    ]);

    if (!seatCounts.length) {
      return res.status(400).json({
        success: false,
        message: "No seats found for this screen",
      });
    }

    // convert to map
    const seatCountMap = {};
    seatCounts.forEach((item) => {
      seatCountMap[item._id] = item.totalSeats;
    });

    // 8 build priceMap
    const priceMap = {};

    for (let category in value.priceMap) {
      const price = value.priceMap[category];
      const totalSeats = seatCountMap[category];

      if (!totalSeats) {
        return res.status(400).json({
          success: false,
          message: `No seats found for category ${category}`,
        });
      }

      priceMap[category] = {
        price,
        totalSeats,
        availableSeats: totalSeats,
      };
    }

    // 9 create show
    const newShow = new Show({
      ...value,
      priceMap,
    });

    await newShow.save();

    // 10 response
    return res.status(201).json({
      success: true,
      message: "Show created successfully",
      data: newShow,
    });

  } catch (err) {
    console.error("Create show error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create show",
    });
  }
});

/**
 * GET /shows/:id
 * Admin only: get show details by ID
 */
showRouter.get('/shows/:id', adminAuth, adminMiddleware, async (req, res) => {
  try {
    // 1 validate showId
    const showId = req.params.id;
    if(!mongoose.Types.ObjectId.isValid(showId)){
      return res.status(400).json({
        success: false,
        message: "Invalid show ID",
      });
    }
    // 2 fetch show
    const show = await Show.findById(showId);
    // 3 if not found return 404
    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found",
      });
    }
    // 4 send response
    return res.status(200).json({
      success: true,
      message: "Show details fetched successfully",
      data: show,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get show",
    });
  }
});

/**
 * PATCH /shows/:id
 * Admin only: update show details (priceMap, status)
 */
showRouter.patch('/shows/:id', adminAuth, adminMiddleware, async (req, res) => {
  try {
    // 1 validate showId
    const showId = req.params.id;
    if(!mongoose.Types.ObjectId.isValid(showId)){
      return res.status(400).json({
        success: false,
        message: "Invalid show ID",
      });
    }
    // 2 fetch show
    const show = await Show.findById(showId);
    // 3 if not found return 404
    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found",
      });
    }

    // 4 validate input (priceMap, status)
    const { value, error } = validateShowUpdateInput(req);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // 5 prevent update if show already started (optional)
    if (show.showTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot update show after it has started",
      });
    }

    // 6 update allowed fields only
    if (value.priceMap) {
      // update priceMap logic (similar to create)
      const seatCounts= await Seat.aggregate(
        [
          {
            $match:{
                screenId: new mongoose.Types.ObjectId(show.screenId),
                isActive: true
            }
          },
          {
            $group: {
              _id: "$category",
              totalSeats: { $sum: 1 },
            },
          }
      ]);
      const seatCountMap = {};
      seatCounts.forEach((item) => {
        seatCountMap[item._id] = item.totalSeats;
      });
      const newPriceMap = {};

      for (let category in value.priceMap) {
        const price = value.priceMap[category];

        const totalSeats = seatCountMap[category];

        if (!totalSeats) {
          return res.status(400).json({
            success: false,
            message: `No seats found for category ${category}`,
          });
        }

        newPriceMap[category] = {
          price,
          totalSeats,
          availableSeats: totalSeats,
        };
    }
      show.priceMap = newPriceMap;
    }
    if(!value.status){
      show.status = value.status;
    }
    // 7 save show
    await show.save();
    // 8 send response
    return res.status(200).json({
      success: true,
      message: "Show updated successfully",
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update show",
    });
  }
});

/**
 * GET /shows
 * Admin only: list all shows with pagination & filters
 */
showRouter.get('/shows', adminAuth, adminMiddleware, async (req, res) => {
  try {
    // 1 parse query params
    let { page = 1, limit = 10, movieId, theaterId, date, status } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1 || limit > 50) limit = 10;

    // 2 build filter
    const filter = {};

    if (movieId) {
      if (!mongoose.Types.ObjectId.isValid(movieId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid movieId",
        });
      }
      filter.movieId = new mongoose.Types.ObjectId(movieId);
    }

    if (theaterId) {
      if (!mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid theaterId",
        });
      }
      filter.theaterId = new mongoose.Types.ObjectId(theaterId);
    }

    if (date) {
      const startDate = new Date(date);

      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      filter.showTime = { $gte: startDate, $lt: endDate };
    }

    if (status) {
      filter.status = status;
    }

    // 3 pagination
    const skip = (page - 1) * limit;

    // 4 fetch shows
    const shows = await Show.find(filter)
      .populate("movieId", "title duration")
      .populate("theaterId", "name location")
      .sort({ showTime: 1 })
      .skip(skip)
      .limit(limit)
      .select("-__v");

    //  5 apply dynamic status
    const updatedShows = shows.map(show => {
      const obj = show.toObject();
      obj.computedStatus = getShowStatus(show);
      return obj;
    });

    // 6 count
    const totalShows = await Show.countDocuments(filter);

    // 7 response
    return res.status(200).json({
      success: true,
      message: "Shows retrieved successfully",
      data: {
        shows: updatedShows, // 
        pagination: {
          total: totalShows,
          currentPage: page,
          totalPages: Math.ceil(totalShows / limit),
          limit,
          hasNextPage: page * limit < totalShows,
          hasPrevPage: page > 1,
        },
      },
    });

  } catch (err) {
    console.error("Get shows error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get shows",
    });
  }
});
module.exports = showRouter;