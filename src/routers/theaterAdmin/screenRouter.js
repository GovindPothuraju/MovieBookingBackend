const express = require("express");
const mongoose = require("mongoose");
const screenRouter = express.Router();

const Screen = require("../../models/admin/screenModel");
const Theater = require("../../models/admin/theaterModel");
const theaterAdminAuth = require("../../middleware/theaterAdminAuth");

const SCREEN_TYPES = ["IMAX", "4DX", "2D", "3D"];

/**
 * POST /theater-admin/screens
 * Theater Admin: create a screen
 */
screenRouter.post("/theater-admin/screens", theaterAdminAuth, async (req, res) => {
  try {
    const theaterId = req.theaterAdmin?.theaterId;
    console.log(theaterId);
    if (!theaterId) {
      return res.status(401).json({
        success: false,
        message: "Theater Admin is not associated with a theater",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater ID",
      });
    }

    const { name, screenType, rows, columns } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Screen name is required",
      });
    }

    const normalizedName = name.trim();

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Screen name must be between 2 and 50 characters",
      });
    }

    if (!screenType || !SCREEN_TYPES.includes(screenType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen type",
      });
    }

    const screenRows = Number(rows);
    const screenColumns = Number(columns);

    if (!Number.isInteger(screenRows) || screenRows < 1 || screenRows > 26) {
      return res.status(400).json({
        success: false,
        message: "Rows must be an integer between 1 and 26",
      });
    }

    if (!Number.isInteger(screenColumns) || screenColumns < 1) {
      return res.status(400).json({
        success: false,
        message: "Columns must be a positive integer",
      });
    }

    const totalSeats = screenRows * screenColumns;

    if (totalSeats > 500) {
      return res.status(400).json({
        success: false,
        message: "Total seats cannot exceed 500",
      });
    }

    const theater = await Theater.findById(theaterId).select(
      "_id name isActive"
    );

    if (!theater) {
      return res.status(404).json({
        success: false,
        message: "Theater not found",
      });
    }

    if (!theater.isActive) {
      return res.status(403).json({
        success: false,
        message: "Theater is inactive",
      });
    }

    const existingScreen = await Screen.findOne({
      theaterId: theater._id,
      name: normalizedName,
      isActive: true,
    });

    if (existingScreen) {
      return res.status(409).json({
        success: false,
        message: `Screen "${normalizedName}" already exists in this theater`,
      });
    }

    const screen = await Screen.create({
      theaterId: theater._id,
      name: normalizedName,
      screenType,
      rows: screenRows,
      columns: screenColumns,
      totalSeats,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Screen created successfully",
      data: screen,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A screen with this name already exists in your theater",
      });
    }

    if (err.name === "ValidationError") {
      return res.status(422).json({
        success: false,
        message:
          Object.values(err.errors)[0]?.message || "Invalid screen data",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
});

/**
 * GET /theater-admin/screens
 * Theater Admin: get own theater screens
 */
screenRouter.get("/theater-admin/screens", theaterAdminAuth, async (req, res) => {
  try {
    const theaterId = req.theaterAdmin?.theaterId;

    if (!theaterId) {
      return res.status(401).json({
        success: false,
        message: "Theater Admin is not associated with a theater",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater ID",
      });
    }

    const screens = await Screen.find({
      theaterId,
      isActive: true,
    })
      .select(
        "_id name screenType rows columns totalSeats isActive seatsGenerated createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Screens fetched successfully",
      data: screens,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
});

/**
 * GET /theater-admin/screens/:screenId
 * Theater Admin: get own theater screen
 */
screenRouter.get(
  "/theater-admin/screens/:screenId",
  theaterAdminAuth,
  async (req, res) => {
    try {
      const { screenId } = req.params;
      const theaterId = req.theaterAdmin?.theaterId;

      if (!theaterId) {
        return res.status(401).json({
          success: false,
          message: "Theater Admin is not associated with a theater",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(screenId) ||
        !mongoose.Types.ObjectId.isValid(theaterId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen or theater ID",
        });
      }

      const screen = await Screen.findOne({
        _id: screenId,
        theaterId,
        isActive: true,
      }).lean();

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Screen not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Screen details fetched successfully",
        data: screen,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    }
  }
);

/**
 * PATCH /theater-admin/screens/:screenId
 * Theater Admin: update own theater screen
 */
screenRouter.patch(
  "/theater-admin/screens/:screenId",
  theaterAdminAuth,
  async (req, res) => {
    try {
      const { screenId } = req.params;
      const theaterId = req.theaterAdmin?.theaterId;

      if (!theaterId) {
        return res.status(401).json({
          success: false,
          message: "Theater Admin is not associated with a theater",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(screenId) ||
        !mongoose.Types.ObjectId.isValid(theaterId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen or theater ID",
        });
      }

      const { name, screenType, rows, columns } = req.body;

      if (
        name === undefined &&
        screenType === undefined &&
        rows === undefined &&
        columns === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "At least one field is required for update",
        });
      }

      const theater = await Theater.findById(theaterId).select(
        "_id isActive"
      );

      if (!theater) {
        return res.status(404).json({
          success: false,
          message: "Theater not found",
        });
      }

      if (!theater.isActive) {
        return res.status(403).json({
          success: false,
          message: "Theater is inactive",
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
          message: "Screen not found",
        });
      }

      if (
        screen.seatsGenerated &&
        (rows !== undefined || columns !== undefined)
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Rows and columns cannot be changed after seats are generated",
        });
      }

      if (name !== undefined) {
        if (typeof name !== "string" || !name.trim()) {
          return res.status(400).json({
            success: false,
            message: "Screen name must be a valid string",
          });
        }

        const normalizedName = name.trim();

        if (normalizedName.length < 2 || normalizedName.length > 50) {
          return res.status(400).json({
            success: false,
            message: "Screen name must be between 2 and 50 characters",
          });
        }

        const duplicateScreen = await Screen.findOne({
          _id: { $ne: screenId },
          theaterId,
          name: normalizedName,
          isActive: true,
        });

        if (duplicateScreen) {
          return res.status(409).json({
            success: false,
            message: `Screen "${normalizedName}" already exists`,
          });
        }

        screen.name = normalizedName;
      }

      if (screenType !== undefined) {
        if (!SCREEN_TYPES.includes(screenType)) {
          return res.status(400).json({
            success: false,
            message: "Invalid screen type",
          });
        }

        screen.screenType = screenType;
      }

      if (rows !== undefined) {
        const screenRows = Number(rows);

        if (!Number.isInteger(screenRows) || screenRows < 1 || screenRows > 26) {
          return res.status(400).json({
            success: false,
            message: "Rows must be an integer between 1 and 26",
          });
        }

        screen.rows = screenRows;
      }

      if (columns !== undefined) {
        const screenColumns = Number(columns);

        if (!Number.isInteger(screenColumns) || screenColumns < 1) {
          return res.status(400).json({
            success: false,
            message: "Columns must be a positive integer",
          });
        }

        screen.columns = screenColumns;
      }

      if (rows !== undefined || columns !== undefined) {
        const totalSeats = screen.rows * screen.columns;

        if (totalSeats > 500) {
          return res.status(400).json({
            success: false,
            message: "Total seats cannot exceed 500",
          });
        }

        screen.totalSeats = totalSeats;
      }

      await screen.save();

      return res.status(200).json({
        success: true,
        message: "Screen updated successfully",
        data: screen,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "A screen with this name already exists in your theater",
        });
      }

      if (err.name === "ValidationError") {
        return res.status(422).json({
          success: false,
          message:
            Object.values(err.errors)[0]?.message || "Invalid screen data",
        });
      }

      return res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    }
  }
);

/**
 * DELETE /theater-admin/screens/:screenId
 * Theater Admin: delete own theater screen
 */
screenRouter.delete(
  "/theater-admin/screens/:screenId",
  theaterAdminAuth,
  async (req, res) => {
    try {
      const { screenId } = req.params;
      const theaterId = req.theaterAdmin?.theaterId;

      if (!theaterId) {
        return res.status(401).json({
          success: false,
          message: "Theater Admin is not associated with a theater",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(screenId) ||
        !mongoose.Types.ObjectId.isValid(theaterId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen or theater ID",
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
          message: "Screen not found",
        });
      }

      if (screen.seatsGenerated) {
        return res.status(409).json({
          success: false,
          message: "Screen cannot be deleted after seats are generated",
        });
      }

      screen.isActive = false;
      await screen.save();

      return res.status(200).json({
        success: true,
        message: "Screen deleted successfully",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    }
  }
);

module.exports = screenRouter;