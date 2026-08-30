const express = require("express");
const mongoose = require("mongoose");
const showRouter = express.Router();

const Movie = require("../../models/admin/movieModel");
const Show = require("../../models/admin/showModel");
const Seat = require("../../models/admin/seatSchema");
const Screen = require("../../models/admin/screenModel");
const Theater = require("../../models/admin/theaterModel");
const redisClient = require("../../config/redis");

const theaterAdminAuth = require("../../middleware/theaterAdminAuth");
const {
  validateTheaterAdminShowInput,
  validateShowUpdateInput,
} = require("../../validators/showValidator");

const getShowStatus = (show) => {
  if (show.status === "CANCELLED") return "CANCELLED";

  const now = new Date();
  const startTime = new Date(show.showTime);
  const duration = show.movieId?.duration || 0;

  const endTime = new Date(
    startTime.getTime() + duration * 60 * 1000
  );

  if (now < startTime) return "SCHEDULED";
  if (now < endTime) return "RUNNING";

  return "COMPLETED";
};

/**
 * GET /theater-admin/movies
 * Theater Admin: get active movies available for creating shows
 */
showRouter.post("/theater-admin/shows", theaterAdminAuth, async (req, res) => {
  try {
    const theaterId = req.theaterAdmin?.theaterId;

    if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater assigned to admin",
      });
    }

    const { value, error } = validateTheaterAdminShowInput(req);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const { movieId, screenId, showTime, priceMap } = value;

    const theater = await Theater.findOne({
      _id: theaterId,
      isActive: true,
    });

    if (!theater) {
      return res.status(404).json({
        success: false,
        message: "Theater not found or inactive",
      });
    }

    const movie = await Movie.findById(movieId);

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

    const newShowStart = new Date(showTime);

    if (Number.isNaN(newShowStart.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid show time",
      });
    }

    if (newShowStart < new Date(movie.releaseDate)) {
      return res.status(400).json({
        success: false,
        message: "Show cannot be scheduled before movie release date",
      });
    }

    if (newShowStart <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot create show in the past",
      });
    }

    const screen = await Screen.findOne({
      _id: screenId,
      theaterId,
      isActive: true,
    });

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found in your theater",
      });
    }

    if (!screen.seatsGenerated) {
      return res.status(400).json({
        success: false,
        message: "Seat layout is not generated for this screen",
      });
    }

    const BUFFER_TIME = 30;

    const newShowEnd = new Date(
      newShowStart.getTime() +
        (movie.duration + BUFFER_TIME) * 60 * 1000
    );

    const existingShows = await Show.find({
      theaterId,
      screenId,
      status: "SCHEDULED",
    }).populate("movieId", "duration");

    for (const existingShow of existingShows) {
      if (!existingShow.movieId) {
        continue;
      }

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

    const seatCounts = await Seat.aggregate([
      {
        $match: {
          screenId: new mongoose.Types.ObjectId(screenId),
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

    if (!seatCounts.length) {
      return res.status(400).json({
        success: false,
        message: "No seats found for this screen",
      });
    }

    const seatCountMap = {};

    seatCounts.forEach((seat) => {
      seatCountMap[seat._id] = seat.totalSeats;
    });

    if (
      !priceMap ||
      typeof priceMap !== "object" ||
      Array.isArray(priceMap)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid price map",
      });
    }

    for (const category in seatCountMap) {
      if (!(category in priceMap)) {
        return res.status(400).json({
          success: false,
          message: `Price missing for category ${category}`,
        });
      }

      const price = Number(priceMap[category]);

      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for category ${category}`,
        });
      }
    }

    for (const category in priceMap) {
      if (!(category in seatCountMap)) {
        return res.status(400).json({
          success: false,
          message: `Category ${category} does not exist in this screen`,
        });
      }
    }

    const finalPriceMap = {};

    for (const category in seatCountMap) {
      finalPriceMap[category] = {
        price: Number(priceMap[category]),
        totalSeats: seatCountMap[category],
        availableSeats: seatCountMap[category],
      };
    }

    const newShow = await Show.create({
      movieId,
      theaterId,
      screenId,
      showTime: newShowStart,
      priceMap: finalPriceMap,
    });

    return res.status(201).json({
      success: true,
      message: "Show created successfully",
      data: newShow,
    });
  } catch (err) {
    console.error("Theater Admin Create Show Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create show",
    });
  }
});
/**
 * POST /theater-admin/shows
 * Theater Admin: create a show for his own theater
 * also redis applied
 */
showRouter.post("/theater-admin/shows", theaterAdminAuth, async (req, res) => {
  try {
    const theaterId = req.theaterAdmin?.theaterId;

    if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater assigned to admin",
      });
    }

    const { value, error } = validateTheaterAdminShowInput(req);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const { movieId, screenId, showTime, priceMap } = value;

    const theater = await Theater.findOne({
      _id: theaterId,
      isActive: true,
    });

    if (!theater) {
      return res.status(404).json({
        success: false,
        message: "Theater not found or inactive",
      });
    }

    const movie = await Movie.findById(movieId);

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

    const newShowStart = new Date(showTime);

    if (Number.isNaN(newShowStart.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid show time",
      });
    }

    if (newShowStart < new Date(movie.releaseDate)) {
      return res.status(400).json({
        success: false,
        message: "Show cannot be scheduled before movie release date",
      });
    }

    if (newShowStart <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot create show in the past",
      });
    }

    const screen = await Screen.findOne({
      _id: screenId,
      theaterId,
      isActive: true,
    });

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found in your theater",
      });
    }

    if (!screen.seatsGenerated) {
      return res.status(400).json({
        success: false,
        message: "Seat layout is not generated for this screen",
      });
    }

    const BUFFER_TIME = 30;

    const newShowEnd = new Date(
      newShowStart.getTime() +
        (movie.duration + BUFFER_TIME) * 60 * 1000
    );

    const existingShows = await Show.find({
      theaterId,
      screenId,
      status: "SCHEDULED",
    }).populate("movieId", "duration");

    for (const existingShow of existingShows) {
      if (!existingShow.movieId) continue;

      const existingStart = new Date(existingShow.showTime);

      const existingEnd = new Date(
        existingStart.getTime() +
          (existingShow.movieId.duration + BUFFER_TIME) * 60 * 1000
      );

      if (
        newShowStart < existingEnd &&
        newShowEnd > existingStart
      ) {
        return res.status(409).json({
          success: false,
          message: `Screen is already occupied between ${existingStart.toLocaleString()} and ${existingEnd.toLocaleString()}`,
        });
      }
    }

    const cacheKey = `screen:${screenId}:seat-counts`;

    let seatCountMap = null;

    try {
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        seatCountMap = JSON.parse(cachedData);
      }
    } catch (redisErr) {
      console.error("Redis GET Error:", redisErr.message);
    }

    if (!seatCountMap) {
      const seatCounts = await Seat.aggregate([
        {
          $match: {
            screenId: new mongoose.Types.ObjectId(screenId),
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

      if (!seatCounts.length) {
        return res.status(400).json({
          success: false,
          message: "No seats found for this screen",
        });
      }

      seatCountMap = {};

      seatCounts.forEach((seat) => {
        seatCountMap[seat._id] = seat.totalSeats;
      });

      try {
        await redisClient.setEx(
          cacheKey,
          600,
          JSON.stringify(seatCountMap)
        );
      } catch (redisErr) {
        console.error("Redis SET Error:", redisErr.message);
      }
    }

    if (
      !priceMap ||
      typeof priceMap !== "object" ||
      Array.isArray(priceMap)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid price map",
      });
    }

    for (const category in seatCountMap) {
      if (!(category in priceMap)) {
        return res.status(400).json({
          success: false,
          message: `Price missing for category ${category}`,
        });
      }

      const price = Number(priceMap[category]);

      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for category ${category}`,
        });
      }
    }

    for (const category in priceMap) {
      if (!(category in seatCountMap)) {
        return res.status(400).json({
          success: false,
          message: `Category ${category} does not exist in this screen`,
        });
      }
    }

    const finalPriceMap = {};

    for (const category in seatCountMap) {
      finalPriceMap[category] = {
        price: Number(priceMap[category]),
        totalSeats: seatCountMap[category],
        availableSeats: seatCountMap[category],
      };
    }

    const newShow = await Show.create({
      movieId,
      theaterId,
      screenId,
      showTime: newShowStart,
      priceMap: finalPriceMap,
    });

    return res.status(201).json({
      success: true,
      message: "Show created successfully",
      data: newShow,
    });
  } catch (err) {
    console.error("Theater Admin Create Show Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create show",
    });
  }
});

/**
 * GET /theater-admin/shows
 * Theater Admin: get shows from his own theater
 */
showRouter.get("/theater-admin/shows", theaterAdminAuth, async (req, res) => {
  try {
    const theaterId = req.theaterAdmin.theaterId;

    if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater assigned to admin"
      });
    }

    let {
      page = 1,
      limit = 10,
      movieId,
      screenId,
      date,
      status
    } = req.query;

    page = Math.max(1, parseInt(page) || 1);
    limit = Math.min(50, Math.max(1, parseInt(limit) || 10));

    const filter = { theaterId };

    if (movieId) {
      if (!mongoose.Types.ObjectId.isValid(movieId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid movie ID"
        });
      }

      filter.movieId = movieId;
    }

    if (screenId) {
      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID"
        });
      }

      filter.screenId = screenId;
    }

    if (date) {
      const startDate = new Date(date);

      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date"
        });
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      filter.showTime = {
        $gte: startDate,
        $lt: endDate
      };
    }

    const allowedStatus = [
      "SCHEDULED",
      "RUNNING",
      "COMPLETED",
      "CANCELLED"
    ];

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const shows = await Show.find(filter)
      .populate(
        "movieId",
        "title duration posterUrl releaseDate status"
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
      status: getShowStatus(show)
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

    return res.status(200).json({
      success: true,
      message: "Shows retrieved successfully",
      data: paginatedShows,
      pagination: {
        totalShows,
        currentPage: page,
        totalPages,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error("Theater Admin Get Shows Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get shows"
    });
  }
});
/**
 * GET /theater-admin/shows/:id
 * Theater Admin: get one of his shows
 */
showRouter.get("/theater-admin/shows/:id", theaterAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const theaterId = req.theaterAdmin.theaterId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid show ID"
      });
    }

    if (!theaterId) {
      return res.status(403).json({
        success: false,
        message: "No theater assigned to this admin"
      });
    }

    const show = await Show.findOne({
      _id: id,
      theaterId
    })
      .populate("movieId", "title duration posterUrl releaseDate status")
      .populate("screenId", "name screenType totalSeats");

    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found"
      });
    }

    const showObj = show.toObject();
    showObj.status = getShowStatus(showObj);

    return res.status(200).json({
      success: true,
      message: "Show details fetched successfully",
      data: showObj
    });
  } catch (err) {
    console.error("Theater Admin Get Show Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get show"
    });
  }
});

/**
 * PATCH /theater-admin/shows/:id
 * Theater Admin: update price map of his show
 */
showRouter.patch("/theater-admin/shows/:id", theaterAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const theaterId = req.theaterAdmin.theaterId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid show ID"
      });
    }

    if (!theaterId) {
      return res.status(403).json({
        success: false,
        message: "No theater assigned to this admin"
      });
    }

    const show = await Show.findOne({
      _id: id,
      theaterId
    });

    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found"
      });
    }

    if (new Date(show.showTime) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot update show after it has started"
      });
    }

    if (show.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cannot update a cancelled show"
      });
    }

    const { value, error } = validateShowUpdateInput(req);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    if (value.priceMap) {
      const seatCounts = await Seat.aggregate([
        {
          $match: {
            screenId: new mongoose.Types.ObjectId(show.screenId),
            isActive: true
          }
        },
        {
          $group: {
            _id: "$category",
            totalSeats: { $sum: 1 }
          }
        }
      ]);

      if (!seatCounts.length) {
        return res.status(400).json({
          success: false,
          message: "No seats found for this screen"
        });
      }

      const seatCountMap = {};

      seatCounts.forEach((seat) => {
        seatCountMap[seat._id] = seat.totalSeats;
      });

      for (const category in seatCountMap) {
        if (!(category in value.priceMap)) {
          return res.status(400).json({
            success: false,
            message: `Price missing for category ${category}`
          });
        }

        const price = Number(value.priceMap[category]);

        if (!Number.isFinite(price) || price <= 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid price for category ${category}`
          });
        }
      }

      for (const category in value.priceMap) {
        if (!(category in seatCountMap)) {
          return res.status(400).json({
            success: false,
            message: `Category ${category} does not exist in this screen`
          });
        }
      }

      const newPriceMap = {};

      for (const category in seatCountMap) {
        newPriceMap[category] = {
          price: Number(value.priceMap[category]),
          totalSeats: seatCountMap[category],
          availableSeats:
            show.priceMap?.[category]?.availableSeats ??
            seatCountMap[category]
        };
      }

      show.priceMap = newPriceMap;
    }

    await show.save();

    const showObj = show.toObject();
    showObj.status = getShowStatus(showObj);

    return res.status(200).json({
      success: true,
      message: "Show updated successfully",
      data: showObj
    });
  } catch (err) {
    console.error("Theater Admin Update Show Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update show"
    });
  }
});

/**
 * PATCH /theater-admin/shows/:id/status
 * Theater Admin: cancel his show
 */
showRouter.patch("/theater-admin/shows/:id/status", theaterAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const theaterId = req.theaterAdmin.theaterId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid show ID"
      });
    }

    if (!theaterId) {
      return res.status(403).json({
        success: false,
        message: "No theater assigned to this admin"
      });
    }

    const show = await Show.findOne({
      _id: id,
      theaterId
    });

    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found"
      });
    }

    if (show.status === "CANCELLED") {
      return res.status(409).json({
        success: false,
        message: "Show is already cancelled"
      });
    }

    if (new Date(show.showTime) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a show that has already started"
      });
    }

    if (req.body.status !== "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Only CANCELLED status is allowed"
      });
    }

    show.status = "CANCELLED";

    await show.save();

    return res.status(200).json({
      success: true,
      message: "Show cancelled successfully",
      data: show
    });
  } catch (err) {
    console.error("Theater Admin Cancel Show Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to cancel show"
    });
  }
});

module.exports = showRouter;