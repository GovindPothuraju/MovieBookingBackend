
const express = require("express");
const bookingRouter = express.Router();

const Booking = require("../../models/bookingSchema");
const adminAuth = require("../../middleware/adminAuth");
const redisClient = require("../../config/redis"); // Update path if needed

/**
 * GET /bookings
 * Admin only: List all bookings with pagination
 */
/*bookingRouter.get("/bookings", async (req, res) => {
  try {
    // 1. Parse pagination
    let { page = 1, limit = 10 } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1 || limit > 50) limit = 10;

    const skip = (page - 1) * limit;

    // 2. Generate cache key
    const cacheKey = `admin:bookings:${JSON.stringify(req.query)}`;

    // 3. Check Redis Cache
    try {
      const redisData = await redisClient.get(cacheKey);

      if (redisData) {
        const cachedResponse = JSON.parse(redisData);
        cachedResponse.source = "Redis";

        return res.status(200).json(cachedResponse);
      }
      console.log("redis Data" + redisData);
    } catch (redisErr) {
      console.error("Redis GET Error:", redisErr.message);
    }

    // 4. Fetch bookings from MongoDB
    const [bookings, totalBookings] = await Promise.all([
      Booking.find({})
        .populate("userId", "name email")
        .populate("movieId", "title")
        .populate("theaterId", "name")
        .populate("screenId", "name")
        .populate("showId", "showTime")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Booking.countDocuments(),
    ]);

    // 5. Pagination
    const totalPages = Math.ceil(totalBookings / limit);

    const pagination = {
      totalBookings,
      currentPage: page,
      totalPages,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    // 6. Response
    const response = {
      success: true,
      message: "Bookings fetched successfully",
      source: "MongoDB",
      data: bookings,
      pagination,
    };

    // 7. Store in Redis (10 minutes)
    try {
      await redisClient.setEx(
        cacheKey,
        600,
        JSON.stringify(response)
      );
    } catch (redisErr) {
      console.error("Redis SET Error:", redisErr.message);
    }

    // 8. Return Response
    return res.status(200).json(response);

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
});*/
bookingRouter.get("/bookings", async (req, res) => {
  try {
    // 1. Parse pagination
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    if (!page || page < 1) page = 1;
    if (!limit || limit < 1 || limit > 50) limit = 10;

    const skip = (page - 1) * limit;

    // 2. Cache key
    const cacheKey = `admin:bookings:page=${page}:limit=${limit}`;

    // 3. Check Redis Cache
    try {
      console.time("REDIS_GET");

      const redisData = await redisClient.get(cacheKey);

      console.timeEnd("REDIS_GET");

      if (redisData) {
        return res.status(200).json({
          ...redisData,
          source: "Redis",
        });
      }
    } catch (redisErr) {
      console.error("Redis GET Error:", redisErr.message);
    }

    // 4. Fetch from MongoDB
    const [bookings, totalBookings] = await Promise.all([
      Booking.find({})
        .populate("userId", "name email")
        .populate("movieId", "title")
        .populate("theaterId", "name")
        .populate("screenId", "name")
        .populate("showId", "showTime")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Booking.countDocuments(),
    ]);

    // 5. Pagination
    const totalPages = Math.ceil(totalBookings / limit);

    const response = {
      success: true,
      message: "Bookings fetched successfully",
      source: "MongoDB",
      data: bookings,
      pagination: {
        totalBookings,
        currentPage: page,
        totalPages,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    // 6. Store in Redis (10 minutes)
    try {
      await redisClient.set(
        cacheKey,
        response,
        {
          ex: 600,
        }
      );
    } catch (redisErr) {
      console.error("Redis SET Error:", redisErr.message);
    }

    // 7. Return Response
    return res.status(200).json(response);

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
});
/**
 * GET /bookings/:bookingId
 * Admin only: get booking details by ID
 */
bookingRouter.get("/bookings/:bookingId", adminAuth, async (req, res) => {
  try {
    // 1. Get bookingId from params
    const { bookingId } = req.params;

    // 2. Validate request
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    // 3. Fetch booking details
    const bookingDetails = await Booking.findOne({ bookingId })
      .populate("userId", "name email")
      .populate("movieId", "title")
      .populate("theaterId", "name")
      .populate("screenId", "name")
      .populate("showId", "showTime")
      .lean();

    // 4. Booking not found
    if (!bookingDetails) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // 5. Success response
    return res.status(200).json({
      success: true,
      message: "Booking details fetched successfully",
      data: bookingDetails,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
});

/**
 * PATCH /bookings/:bookingId/cancel
 * Admin only: cancel a booking and restore seats
 */
bookingRouter.patch('/bookings/:bookingId/cancel', adminAuth,async (req, res) => {});

module.exports = bookingRouter;