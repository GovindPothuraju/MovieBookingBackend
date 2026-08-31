const express = require("express");
const mongoose = require("mongoose");
const adminAuth = require("../../middleware/adminAuth");
const redisClient = require("../../config/redis");

const theaterRouter = express.Router();

const {
  validateCreateTheater,
  validateUpdateTheater,
} = require("../../validators/theaterValidator");

const Theater = require("../../models/admin/theaterModel");
const Screen = require("../../models/admin/screenModel");

const deleteTheaterCaches = async (theaterId = null) => {
  try {
    const keysToDelete = [];

    for await (const key of redisClient.scanIterator({
      MATCH: "admin:theaters:*",
      COUNT: 100,
    })) {
      keysToDelete.push(key);
    }

    if (theaterId) {
      keysToDelete.push(`admin:theaters:${theaterId}`);
    }

    if (keysToDelete.length > 0) {
      await redisClient.del([...new Set(keysToDelete)]);
    }
  } catch (err) {
    console.error("Redis Theater Cache Delete Error:", err.message);
  }
};

/**
 * POST /theaters
 * Admin only: create a new theater
 */
theaterRouter.post("/theaters", adminAuth, async (req, res) => {
  try {
    const { isValid, message, value } = validateCreateTheater(req);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: message || "Invalid request data",
      });
    }

    const {
      name,
      city,
      address,
      contactEmail,
      contactPhone,
      amenities,
    } = value;

    if (!name || !city) {
      return res.status(400).json({
        success: false,
        message: "Name and city are required",
      });
    }

    const existingTheater = await Theater.findOne({
      name,
      city,
      "address.street": address.street,
    });

    if (existingTheater) {
      return res.status(409).json({
        success: false,
        message: "Theater already exists in this city",
      });
    }

    const newTheater = new Theater({
      name,
      city,
      address,
      contactEmail,
      contactPhone,
      amenities,
    });

    await newTheater.save();

    await deleteTheaterCaches();

    return res.status(201).json({
      success: true,
      message: "Theater created successfully",
      data: newTheater,
    });
  } catch (err) {
    console.error("Create theater error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/**
 * PATCH /theaters/:id
 * Admin only: update theater fields
 */
theaterRouter.patch(
  "/theaters/:id",
  adminAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = validateUpdateTheater(req);

      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          message: result.error || "Invalid update data",
        });
      }

      const updateData = result.value;

      console.log("Update data:", updateData);

      const theater = await Theater.findById(id);

      if (!theater) {
        return res.status(404).json({
          success: false,
          message: "Theater not found",
        });
      }

      if (
        !theater.isActive &&
        !(updateData.isActive === true)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Inactive theater can only be reactivated (set isActive: true)",
        });
      }

      const query = {
        _id: {
          $ne: id,
        },
      };

      if (updateData.name !== undefined) {
        query.name = updateData.name.trim();
      }

      if (updateData.city !== undefined) {
        query.city = updateData.city.trim();
      }

      if (
        updateData.address?.street !== undefined
      ) {
        query["address.street"] =
          updateData.address.street.trim();
      }

      if (Object.keys(query).length > 1) {
        const duplicate = await Theater.findOne(query);

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message:
              "Duplicate theater name/city/address combination exists",
          });
        }
      }

      const updatedTheater =
        await Theater.findByIdAndUpdate(
          id,
          {
            $set: updateData,
          },
          {
            new: true,
            runValidators: true,
          }
        ).exec();

      if (!updatedTheater) {
        return res.status(500).json({
          success: false,
          message: "Update failed",
        });
      }

      await deleteTheaterCaches(id);

      return res.status(200).json({
        success: true,
        message: "Theater updated successfully",
        data: updatedTheater,
      });
    } catch (err) {
      console.error("Update theater error:", err);

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Server error during theater update",
      });
    }
  }
);

/**
 * DELETE /theaters/:id
 * Admin only: soft-delete
 */
theaterRouter.delete(
  "/theaters/:id",
  adminAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      const theater = await Theater.findById(id);

      if (!theater) {
        return res.status(404).json({
          success: false,
          message: "Theater not found",
        });
      }

      if (!theater.isActive) {
        return res.status(409).json({
          success: false,
          message:
            "Theater is already inactive/deleted",
        });
      }

      const activeScreensCount =
        await Screen.countDocuments({
          theaterId: id,
          isActive: true,
        });

      if (activeScreensCount > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete theater - ${activeScreensCount} active screen(s) exist`,
        });
      }

      const deletedTheater =
        await Theater.findByIdAndUpdate(
          id,
          {
            $set: {
              isActive: false,
            },
          },
          {
            new: true,
          }
        );

      await deleteTheaterCaches(id);

      return res.status(200).json({
        success: true,
        message:
          "Theater soft-deleted successfully",
        data: {
          id: deletedTheater._id,
          message: "Theater is now inactive",
        },
      });
    } catch (err) {
      console.error("Delete theater error:", err);

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Server error during deletion",
      });
    }
  }
);

/**
 * GET /theaters/deleted
 * Admin only: list deleted theaters
 */
theaterRouter.get(
  "/theaters/deleted",
  adminAuth,
  async (req, res) => {
    try {
      let {
        city,
        page = 1,
        limit = 10,
      } = req.query;

      page = parseInt(page);
      limit = parseInt(limit);

      if (isNaN(page) || page < 1) {
        page = 1;
      }

      if (isNaN(limit) || limit < 1) {
        limit = 10;
      }

      if (limit > 50) {
        limit = 50;
      }

      const query = {
        isActive: false,
      };

      if (city) {
        query.city = {
          $regex: city.trim(),
          $options: "i",
        };
      }

      const skip = (page - 1) * limit;

      const cacheKey =
        `admin:theaters:deleted:${JSON.stringify({
          city: city || "",
          page,
          limit,
        })}`;

      try {
        const cachedData =
          await redisClient.get(cacheKey);

        if (cachedData) {
          return res.status(200).json({
            source: "Redis Cache",
            ...JSON.parse(cachedData),
          });
        }
      } catch (redisErr) {
        console.error(
          "Redis GET Error:",
          redisErr.message
        );
      }

      const theaters = await Theater.find(query)
        .skip(skip)
        .limit(limit)
        .sort({
          updatedAt: -1,
        })
        .select(
          "name city address amenities contactEmail contactPhone"
        );

      const totalTheaters =
        await Theater.countDocuments(query);

      const totalPages = Math.ceil(
        totalTheaters / limit
      );

      const pagination = {
        totalTheaters,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };

      const response = {
        success: true,
        message:
          "Deleted theaters fetched successfully",
        source: "MongoDB",
        data: theaters,
        pagination,
      };

      try {
        await redisClient.setEx(
          cacheKey,
          600,
          JSON.stringify(response)
        );
      } catch (redisErr) {
        console.error(
          "Redis SET Error:",
          redisErr.message
        );
      }

      return res.status(200).json(response);
    } catch (err) {
      console.error(
        "Get Deleted Theaters Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Server error during fetching deleted theaters",
      });
    }
  }
);

/**
 * GET /theaters/:id
 * Admin only: get theater by ID
 */
theaterRouter.get(
  "/theaters/:id",
  adminAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid theater ID",
        });
      }

      const cacheKey = `admin:theaters:${id}`;

      try {
        const cachedData =
          await redisClient.get(cacheKey);

        if (cachedData) {
          return res.status(200).json({
            source: "Redis Cache",
            ...JSON.parse(cachedData),
          });
        }
      } catch (redisErr) {
        console.error(
          "Redis GET Error:",
          redisErr.message
        );
      }

      const theater =
        await Theater.findById(id);

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

      await theater.populate({
        path: "screens",
        match: {
          isActive: true,
        },
        select:
          "name totalSeats screenType",
      });

      const response = {
        success: true,
        message:
          "Theater details retrieved successfully",
        source: "MongoDB",
        data: theater,
      };

      try {
        await redisClient.setEx(
          cacheKey,
          600,
          JSON.stringify(response)
        );
      } catch (redisErr) {
        console.error(
          "Redis SET Error:",
          redisErr.message
        );
      }

      return res.status(200).json(response);
    } catch (err) {
      console.error(
        "Get Theater Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Server error during fetching theater details",
      });
    }
  }
);

/**
 * GET /theaters
 * Admin only: list active theaters
 */
theaterRouter.get(
  "/theaters",
  adminAuth,
  async (req, res) => {
    try {
      let {
        city,
        page = 1,
        limit = 10,
      } = req.query;

      page = parseInt(page);
      limit = parseInt(limit);

      if (isNaN(page) || page < 1) {
        page = 1;
      }

      if (isNaN(limit) || limit < 1) {
        limit = 10;
      }

      if (limit > 50) {
        limit = 50;
      }

      const query = {
        isActive: true,
      };

      if (city) {
        query.city = {
          $regex: city.trim(),
          $options: "i",
        };
      }

      const skip = (page - 1) * limit;

      const cacheKey =
        `admin:theaters:list:${JSON.stringify({
          city: city || "",
          page,
          limit,
        })}`;

      try {
        const cachedData =
          await redisClient.get(cacheKey);

        if (cachedData) {
          return res.status(200).json({
            source: "Redis Cache",
            ...JSON.parse(cachedData),
          });
        }
      } catch (redisErr) {
        console.error(
          "Redis GET Error:",
          redisErr.message
        );
      }

      const theaters =
        await Theater.find(query)
          .skip(skip)
          .limit(limit)
          .sort({
            createdAt: -1,
          })
          .select(
            "name city address amenities"
          );

      const totalTheaters =
        await Theater.countDocuments(query);

      const totalPages = Math.ceil(
        totalTheaters / limit
      );

      const pagination = {
        totalTheaters,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };

      const response = {
        success: true,
        message: "Theaters fetched successfully",
        source: "MongoDB",
        data: theaters,
        pagination,
      };

      try {
        await redisClient.setEx(
          cacheKey,
          600,
          JSON.stringify(response)
        );
      } catch (redisErr) {
        console.error(
          "Redis SET Error:",
          redisErr.message
        );
      }

      return res.status(200).json(response);
    } catch (err) {
      console.error(
        "Get Theaters Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          "Server error during fetching theaters",
      });
    }
  }
);

module.exports = theaterRouter;