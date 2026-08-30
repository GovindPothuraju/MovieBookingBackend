const express = require("express");
const mongoose = require("mongoose");

const screenRouter = express.Router();

const Screen = require("../../models/admin/screenModel");
const Theater = require("../../models/admin/theaterModel");

const theaterAdminAuth = require("../../middleware/theaterAdminAuth");

const getTheaterId = (req) => {
  return req.user?.theaterId || req.theaterAdmin?.theaterId;
};

/**
 * GET /theater-admin/screens
 * Theater Admin: get all active screens of own theater
 */
screenRouter.get("/theater-admin/screens", theaterAdminAuth, async (req, res) => {
  try {
    const theaterId = getTheaterId(req);

    if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(403).json({
        success: false,
        message: "Theater access not found",
      });
    }

    const screens = await Screen.find({
      theaterId,
      isActive: true,
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Screens fetched successfully",
      data: screens,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch screens",
    });
  }
});

/**
 * GET /theater-admin/screens/:screenId
 * Theater Admin: get one screen of own theater
 */
screenRouter.get(
  "/theater-admin/screens/:screenId",
  theaterAdminAuth,
  async (req, res) => {
    try {
      const { screenId } = req.params;
      const theaterId = getTheaterId(req);

      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID",
        });
      }

      if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(403).json({
          success: false,
          message: "Theater access not found",
        });
      }

      const screen = await Screen.findOne({
        _id: screenId,
        theaterId,
        isActive: true,
      })
        .populate("theaterId", "name city")
        .lean();

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
        message: err.message || "Failed to fetch screen",
      });
    }
  }
);

/**
 * POST /theater-admin/screens
 * Theater Admin: create screen in own theater
 */
screenRouter.post(
  "/theater-admin/screens",
  theaterAdminAuth,
  async (req, res) => {
    try {
      const theaterId = getTheaterId(req);
      const { name, screenType, rows, columns } = req.body;

      if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(403).json({
          success: false,
          message: "Theater access not found",
        });
      }

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Screen name is required",
        });
      }

      if (name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Screen name must be at least 2 characters",
        });
      }

      if (name.trim().length > 50) {
        return res.status(400).json({
          success: false,
          message: "Screen name cannot exceed 50 characters",
        });
      }

      const allowedTypes = ["2D", "3D", "IMAX", "4DX"];

      if (!screenType || !allowedTypes.includes(screenType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid screen type. Allowed: ${allowedTypes.join(", ")}`,
        });
      }

      if (rows === undefined || rows === null || rows === "") {
        return res.status(400).json({
          success: false,
          message: "Rows are required",
        });
      }

      if (columns === undefined || columns === null || columns === "") {
        return res.status(400).json({
          success: false,
          message: "Columns are required",
        });
      }

      const parsedRows = Number(rows);
      const parsedColumns = Number(columns);

      if (!Number.isInteger(parsedRows) || parsedRows < 1 || parsedRows > 26) {
        return res.status(400).json({
          success: false,
          message: "Rows must be an integer between 1 and 26",
        });
      }

      if (!Number.isInteger(parsedColumns) || parsedColumns < 1) {
        return res.status(400).json({
          success: false,
          message: "Columns must be a positive integer",
        });
      }

      if (parsedRows * parsedColumns > 500) {
        return res.status(400).json({
          success: false,
          message: "Total seats cannot exceed 500",
        });
      }

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

      const existingScreen = await Screen.findOne({
        theaterId,
        name: name.trim(),
        isActive: true,
      });

      if (existingScreen) {
        return res.status(409).json({
          success: false,
          message: `Screen "${name.trim()}" already exists in this theater`,
        });
      }

      const screen = await Screen.create({
        theaterId,
        name: name.trim(),
        screenType,
        rows: parsedRows,
        columns: parsedColumns,
        totalSeats: parsedRows * parsedColumns,
        seatsGenerated: false,
      });

      return res.status(201).json({
        success: true,
        message: "Screen created successfully",
        data: screen,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to create screen",
      });
    }
  }
);

/**
 * PATCH /theater-admin/screens/:screenId
 * Theater Admin: update screen name and type
 */
screenRouter.patch(
  "/theater-admin/screens/:screenId",
  theaterAdminAuth,
  async (req, res) => {
    try {
      const { screenId } = req.params;
      const theaterId = getTheaterId(req);
      const { name, screenType } = req.body;

      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID",
        });
      }

      if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(403).json({
          success: false,
          message: "Theater access not found",
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

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Screen name is required",
        });
      }

      if (name.trim().length < 2 || name.trim().length > 50) {
        return res.status(400).json({
          success: false,
          message: "Screen name must be between 2 and 50 characters",
        });
      }

      const allowedTypes = ["2D", "3D", "IMAX", "4DX"];

      if (!screenType || !allowedTypes.includes(screenType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen type",
        });
      }

      const duplicate = await Screen.findOne({
        _id: { $ne: screenId },
        theaterId,
        name: name.trim(),
        isActive: true,
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Screen "${name.trim()}" already exists`,
        });
      }

      screen.name = name.trim();
      screen.screenType = screenType;

      await screen.save();

      return res.status(200).json({
        success: true,
        message: "Screen updated successfully",
        data: screen,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to update screen",
      });
    }
  }
);

/**
 * DELETE /theater-admin/screens/:screenId
 * Theater Admin: deactivate screen
 */
screenRouter.delete(
  "/theater-admin/screens/:screenId",
  theaterAdminAuth,
  async (req, res) => {
    try {
      const { screenId } = req.params;
      const theaterId = getTheaterId(req);

      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID",
        });
      }

      if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(403).json({
          success: false,
          message: "Theater access not found",
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

      screen.isActive = false;

      await screen.save();

      return res.status(200).json({
        success: true,
        message: "Screen deleted successfully",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to delete screen",
      });
    }
  }
);

module.exports = screenRouter;