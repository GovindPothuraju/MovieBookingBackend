const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require("../../middleware/adminAuth");

const screenRouter = express.Router();

const { validateCreateScreen, validatePartialScreenUpdate } = require("../../validators/screenValidators");
const Theater = require("../../models/admin/theaterModel");
const Screen = require("../../models/admin/screenModel");

// -------------------- Screen Management ------------------ //

/**
 * POST /theaters/:theaterId/screens
 * Admin only: create a new screen under a theater
 */
screenRouter.post('/theaters/:theaterId/screens', adminAuth, async (req, res) => {
  try {
    const result = validateCreateScreen(req);
    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    const { theaterId, name } = result.value;

    const theater = await Theater.findById(theaterId);
    if (!theater) {
      return res.status(404).json({
        success: false,
        message: "Theater not found"
      });
    }
    if (!theater.isActive) {
      return res.status(403).json({
        success: false,
        message: "Theater is inactive"
      });
    }

    // scope duplicate check to active screens only
    const existingScreen = await Screen.findOne({
      theaterId,
      name,
      isActive: true
    });
    if (existingScreen) {
      return res.status(409).json({
        success: false,
        message: `Screen "${name}" already exists in this theater`
      });
    }

    const newScreen = new Screen(result.value);
    await newScreen.save();

    res.status(201).json({
      success: true,
      message: "Screen created successfully",
      data: newScreen
    });

  } catch (err) {
    console.error("Create screen error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Server error during screen creation"
    });
  }
});

/**
 * PATCH /screens/:screenId
 * Admin only: partially update screen (e.g., status, type)
 */
screenRouter.patch("/screens/:screenId", adminAuth, async (req, res) => {
  try {
    const { screenId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(screenId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID"
      });
    }

    const result = validatePartialScreenUpdate(req);
    if (result.error) {
      return res.status(422).json({
        success: false,
        message: result.error.details || result.error
      });
    }

    const { screenType, isActive } = result.value;

    const screen = await Screen.findById(screenId)
      .populate('theaterId', 'name isActive')
      .lean();

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found"
      });
    }

    if (!screen.theaterId || !screen.theaterId.isActive) {
      return res.status(409).json({
        success: false,
        message: "Cannot update screen: associated theater not found or inactive"
      });
    }

    const updateFields = { $set: {} };
    if (screenType !== undefined) updateFields.$set.screenType = screenType;
    if (isActive !== undefined) updateFields.$set.isActive = isActive;

    const updatedScreen = await Screen.findByIdAndUpdate(
      screenId,
      updateFields,
      {
        new: true,
        runValidators: true,
        context: 'query'
      }
    ).populate('theaterId', 'name isActive');

    if (!updatedScreen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found during update"
      });
    }

    res.status(200).json({
      success: true,
      message: "Screen updated successfully",
      data: updatedScreen
    });

  } catch (err) {
    console.error("Update screen error:", err);

    if (err.name === 'ValidationError') {
      return res.status(422).json({
        success: false,
        message: Object.values(err.errors)[0].message
      });
    }
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Update violates unique constraint"
      });
    }

    res.status(500).json({
      success: false,
      message: err.message || "Server error during screen update"
    });
  }
});

/**
 * DELETE /screens/:id
 * Admin only: soft-delete a screen
 */
screenRouter.delete("/screens/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID"
      });
    }

    const screen = await Screen.findById(id);
    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found"
      });
    }

    if (!screen.isActive) {
      return res.status(409).json({
        success: false,
        message: "Screen is already inactive/deleted"
      });
    }

    screen.isActive = false;
    await screen.save();

    res.status(200).json({
      success: true,
      message: "Screen deleted successfully"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Server error during screen deletion"
    });
  }
});

/**
 * GET /screens/deleted
 * Admin only: list deleted (inactive) screens
 * MUST be registered BEFORE /screens/:id
 */
screenRouter.get("/screens/deleted", adminAuth, async (req, res) => {
  try {
    let { theaterId, page = 1, limit = 10 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50;

    const query = { isActive: false };

    if (theaterId) {
      if (!mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid theater ID"
        });
      }
      query.theaterId = theaterId;
    }

    const skip = (page - 1) * limit;

    const screens = await Screen.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1 })
      .populate("theaterId", "name city");

    const totalScreens = await Screen.countDocuments(query);
    const totalPages = Math.ceil(totalScreens / limit);

    res.status(200).json({
      success: true,
      message: "Deleted screens fetched successfully",
      data: screens,
      pagination: {
        totalScreens,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Get deleted screens error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Server error during fetching deleted screens",
    });
  }
});

/**
 * GET /screens/:id
 * Admin only: get screen by ID
 * MUST be registered AFTER /screens/deleted
 */
screenRouter.get("/screens/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID",
      });
    }

    const screen = await Screen.findById(id).populate("theaterId", "name city");

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Screen details retrieved successfully",
      data: screen,
    });
  } catch (err) {
    console.error("Get screen error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Server error during fetching screen details",
    });
  }
});

/**
 * GET /theaters/:theaterId/screens
 * Admin Authenticated: list screens for a theater
 */
screenRouter.get('/theaters/:theaterId/screens', adminAuth, async (req, res) => {
  try {
    const { theaterId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater ID"
      });
    }

    const theater = await Theater.findById(theaterId);
    if (!theater) {
      return res.status(404).json({
        success: false,
        message: "Theater not found"
      });
    }
    if (!theater.isActive) {
      return res.status(403).json({
        success: false,
        message: "Theater is inactive"
      });
    }

    const screens = await Screen.find({
      theaterId,
      isActive: true,
    }).select("name totalSeats screenType");

    return res.status(200).json({
      success: true,
      message: `Screens for theater "${theater.name}" retrieved successfully`,
      data: screens
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Server error during fetching screens"
    });
  }
});

/**
 * GET /screens
 * Admin only: list active screens with optional ?theaterId= and pagination
 */
screenRouter.get("/screens", adminAuth, async (req, res) => {
  try {
    let { theaterId,search ,page = 1, limit = 10 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50;

    const query = { isActive: true };

    if (theaterId) {
      if (!mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid theater ID",
        });
      }
      query.theaterId = theaterId;
    }

    // search by screen name
    if(search && search.trim()){
      query.name = {
        $regex: search.trim(),
        $options: "i",
      }
    }

    const skip = (page - 1) * limit;

    const screens = await Screen.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("theaterId", "name city");

    const totalScreens = await Screen.countDocuments(query);
    const totalPages = Math.ceil(totalScreens / limit);

    res.status(200).json({
      success: true,
      message: "Screens fetched successfully",
      data: screens,
      pagination: {
        totalScreens,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Get screens error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Server error during fetching screens",
    });
  }
});

module.exports = screenRouter;