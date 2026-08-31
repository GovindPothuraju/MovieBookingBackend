const express = require('express');
const mongoose = require('mongoose');
const showRouter = express.Router();

const redisClient = require("../../config/redis");


const Movie = require('../../models/admin/movieModel');
const Show = require('../../models/admin/showModel');
const Seat = require("../../models/admin/seatSchema");
const Theater = require("../../models/admin/theaterModel");
const Screen = require("../../models/admin/screenModel");

const adminAuth = require("../../middleware/adminAuth");
const { validateShowInput,validateShowUpdateInput } = require('../../validators/showValidator');

// dynamic show status (if show is ended, mark as completed; if cancelled, mark as cancelled; else scheduled)
const getShowStatus = (show) => {
  const now = new Date();

  // If already cancelled
  if (show.status === "CANCELLED") {
    return "CANCELLED";
  }

  const showStartTime = new Date(show.showTime);

  // Movie duration in minutes
  const duration = show.movieId.duration;

  // Calculate show end time
  const showEndTime = new Date(
    showStartTime.getTime() + duration * 60 * 1000
  );

  if (now < showStartTime) {
    return "SCHEDULED";
  }

  if (now >= showStartTime && now < showEndTime) {
    return "RUNNING";
  }

  return "COMPLETED";
};

const deleteShowCaches = async () => {
  try {
    const keys = [];

    for await (const key of redisClient.scanIterator({
      MATCH: "admin:shows:*",
      COUNT: 100,
    })) {
      keys.push(key);
    }

    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error("Redis cache delete error:", err.message);
  }
};

/**
 * POST /shows
 * Admin only: create a new show
 */
showRouter.post("/shows", adminAuth, async (req, res) => {
  try {
    // 1. Validate input
    const { value, error } = validateShowInput(req);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // 2. Validate movie
    const movie = await Movie.findById(value.movieId);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    if (!movie.isActive) {
      return res.status(400).json({
        success: false,
        message: "Movie is inactive",
      });
    }

    if (movie.status === "ARCHIVED") {
      return res.status(400).json({
        success: false,
        message: "Cannot create show for archived movie",
      });
    }

    if (new Date(value.showTime) < new Date(movie.releaseDate)) {
      return res.status(400).json({
        success: false,
        message: "Show cannot be scheduled before movie release date",
      });
    }

    // 3. Validate theater
    const theater = await Theater.findById(value.theaterId);

    if (!theater) {
      return res.status(404).json({
        success: false,
        message: "Theater not found",
      });
    }

    if (!theater.isActive) {
      return res.status(400).json({
        success: false,
        message: "Theater is inactive",
      });
    }

    // 4. Validate screen
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

    if (!screen.isActive) {
      return res.status(400).json({
        success: false,
        message: "Screen is inactive",
      });
    }

    if (!screen.seatsGenerated) {
      return res.status(400).json({
        success: false,
        message: "Seat layout is not generated for this screen",
      });
    }

    // 5. Prevent past shows
    const newShowStart = new Date(value.showTime);

    if (newShowStart <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot create show in the past",
      });
    }

    // 6. Check overlapping shows
    const BUFFER_TIME = 30;

    const newShowEnd = new Date(
      newShowStart.getTime() +
      (movie.duration + BUFFER_TIME) * 60 * 1000
    );

    const existingShows = await Show.find({
      screenId: value.screenId,
      status: "SCHEDULED",
    }).populate("movieId", "duration");

    for (const existingShow of existingShows) {

      if (!existingShow.movieId) continue;

      const existingStart = new Date(existingShow.showTime);

      const existingEnd = new Date(
        existingStart.getTime() +
        (existingShow.movieId.duration + BUFFER_TIME) * 60 * 1000
      );

      const isOverlap =
        newShowStart < existingEnd &&
        newShowEnd > existingStart;

      if (isOverlap) {
        return res.status(409).json({
          success: false,
          message: `Screen is already occupied between ${existingStart.toLocaleString()} and ${existingEnd.toLocaleString()}`,
        });
      }
    }

    // 7. Get seat count per category
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
          totalSeats: {
            $sum: 1,
          },
        },
      },
    ]);

    if (seatCounts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No seats found for this screen",
      });
    }

    // 8. Convert to map
    const seatCountMap = {};

    seatCounts.forEach((seat) => {
      seatCountMap[seat._id] = seat.totalSeats;
    });

    // 9. Validate price map

    for (const category in seatCountMap) {

      if (!(category in value.priceMap)) {
        return res.status(400).json({
          success: false,
          message: `Price missing for category ${category}`,
        });
      }

      const price = Number(value.priceMap[category]);

      if (isNaN(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for category ${category}`,
        });
      }
    }

    for (const category in value.priceMap) {

      if (!(category in seatCountMap)) {
        return res.status(400).json({
          success: false,
          message: `Category ${category} does not exist in this screen`,
        });
      }
    }

    // 10. Build price map
    const priceMap = {};

    for (const category in seatCountMap) {

      priceMap[category] = {
        price: Number(value.priceMap[category]),
        totalSeats: seatCountMap[category],
        availableSeats: seatCountMap[category],
      };

    }
    
    // 11. Create show
    const newShow = await Show.create({
      ...value,
      priceMap,
    });
    // 12 delete from redis
    await deleteShowCaches();
    // 13. Response
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
showRouter.get("/shows/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid show ID",
      });
    }

    const cacheKey = `admin:shows:${id}`;

    try {
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }
    } catch (redisErr) {
      console.error("Redis GET Error:", redisErr.message);
    }

    const show = await Show.findById(id)
      .populate(
        "movieId",
        "title duration posterUrl releaseDate status"
      )
      .populate(
        "theaterId",
        "name city"
      )
      .populate(
        "screenId",
        "name screenType totalSeats"
      );

    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found",
      });
    }

    const computedStatus = getShowStatus(show);

    const showObj = show.toObject();
    showObj.status = computedStatus;

    const response = {
      success: true,
      message: "Show details fetched successfully",
      data: showObj,
    };

    try {
      await redisClient.setEx(
        cacheKey,
        300,
        JSON.stringify(response)
      );
    } catch (redisErr) {
      console.error("Redis SET Error:", redisErr.message);
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("Get show error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get show",
    });
  }
});


/**
 * PATCH /shows/:id
 * Admin only: update show priceMap or status
 */
showRouter.patch("/shows/:id", adminAuth, async (req, res) => {
  try {
    // 1. Validate show ID
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid show ID",
      });
    }

    // 2. Fetch show
    const show = await Show.findById(id);

    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found",
      });
    }

    // 3. Prevent updating completed/started shows
    if (show.showTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot update show after it has started",
      });
    }

    // 4. Validate request body
    const { value, error } = validateShowUpdateInput(req);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // 5. Update Price Map
    if (value.priceMap) {

      const seatCounts = await Seat.aggregate([
        {
          $match: {
            screenId: new mongoose.Types.ObjectId(show.screenId),
            isActive: true,
          },
        },
        {
          $group: {
            _id: "$category",
            totalSeats: {
              $sum: 1,
            },
          },
        },
      ]);

      if (seatCounts.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No seats found for this screen",
        });
      }

      const seatCountMap = {};

      seatCounts.forEach((seat) => {
        seatCountMap[seat._id] = seat.totalSeats;
      });

      // Validate all seat categories have prices
      for (const category in seatCountMap) {

        if (!(category in value.priceMap)) {
          return res.status(400).json({
            success: false,
            message: `Price missing for category ${category}`,
          });
        }

        const price = Number(value.priceMap[category]);

        if (isNaN(price) || price <= 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid price for category ${category}`,
          });
        }
      }

      // Reject extra categories
      for (const category in value.priceMap) {

        if (!(category in seatCountMap)) {
          return res.status(400).json({
            success: false,
            message: `Category ${category} does not exist in this screen`,
          });
        }
      }

      const newPriceMap = {};

      for (const category in seatCountMap) {

        newPriceMap[category] = {
          price: Number(value.priceMap[category]),
          totalSeats: seatCountMap[category],

          // Preserve current availability
          availableSeats:
            show.priceMap?.[category]?.availableSeats ??
            seatCountMap[category],
        };

      }

      show.priceMap = newPriceMap;
    }

    // 6. Update status
    if (value.status) {
      show.status = value.status;
    }

    // 7. Save
    await show.save();

    // 8. delete from redis
    await deleteShowCaches();

    // 9. Response
    const showObj = show.toObject();
    showObj.status = getShowStatus(show);

    return res.status(200).json({
      success: true,
      message: "Show details fetched successfully",
      data: showObj,
    });

  } catch (err) {
    console.error("Update show error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update show",
    });
  }
});

/**
 * GET /shows
 * Admin only: List shows with filters & pagination
 */
showRouter.get("/shows", adminAuth, async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      movieId,
      theaterId,
      screenId,
      date,
      status,
    } = req.query;

    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(50, Math.max(1, parseInt(limit) || 10));

    const cacheKey = `admin:shows:list:${JSON.stringify(req.query)}`;

    try {
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }
    } catch (redisErr) {
      console.error("Redis GET Error:", redisErr.message);
    }

    const filter = {};

    if (movieId) {
      if (!mongoose.Types.ObjectId.isValid(movieId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid movie ID",
        });
      }

      filter.movieId = movieId;
    }

    if (theaterId) {
      if (!mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid theater ID",
        });
      }

      filter.theaterId = theaterId;
    }

    if (screenId) {
      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID",
        });
      }

      filter.screenId = screenId;
    }

    if (date) {
      const startDate = new Date(date);

      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date",
        });
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      filter.showTime = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const allowedStatus = [
      "SCHEDULED",
      "RUNNING",
      "COMPLETED",
      "CANCELLED",
    ];

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const shows = await Show.find(filter)
      .populate(
        "movieId",
        "title duration posterUrl releaseDate"
      )
      .populate(
        "theaterId",
        "name city"
      )
      .populate(
        "screenId",
        "name screenType totalSeats"
      )
      .sort({ showTime: 1 })
      .select("-__v")
      .lean();

    let updatedShows = shows.map((show) => ({
      ...show,
      status: getShowStatus(show),
    }));

    if (status) {
      updatedShows = updatedShows.filter(
        (show) => show.status === status
      );
    }

    const totalShows = updatedShows.length;
    const totalPages = Math.ceil(totalShows / limit);
    const skip = (page - 1) * limit;

    const paginatedShows = updatedShows.slice(
      skip,
      skip + limit
    );

    const response = {
      success: true,
      message: "Shows retrieved successfully",
      data: paginatedShows,
      pagination: {
        totalShows,
        currentPage: page,
        totalPages,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    try {
      await redisClient.setEx(
        cacheKey,
        300,
        JSON.stringify(response)
      );
    } catch (redisErr) {
      console.error("Redis SET Error:", redisErr.message);
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("Get shows error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get shows",
    });
  }
});

/**
 * PATCH /shows/:id/status
 * Admin only: Cancel a show
 */
showRouter.patch("/shows/:id/status", adminAuth, async (req, res) => {
  try {
    // 1. Validate show ID
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid show ID",
      });
    }

    // 2. Fetch show
    const show = await Show.findById(id);

    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found",
      });
    }

    // 3. Already cancelled
    if (show.status === "CANCELLED") {
      return res.status(409).json({
        success: false,
        message: "Show is already cancelled",
      });
    }

    // 4. Prevent cancelling completed/started shows
    if (show.showTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a show that has already started",
      });
    }

    // 5. Validate request body
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    if (status!== "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Only 'cancelled' status is allowed",
      });
    }

    // 6. Update status
    show.status = "CANCELLED";
    await show.save();

    // 7. delete from redis
    await deleteShowCaches();

    // 8. Response
    return res.status(200).json({
      success: true,
      message: "Show cancelled successfully",
      data: show,
    });

  } catch (err) {
    console.error("Cancel show error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to cancel show",
    });
  }
});



module.exports = showRouter;