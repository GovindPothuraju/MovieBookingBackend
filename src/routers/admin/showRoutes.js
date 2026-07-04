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
    // 1. Validate request (theaterId param + body)
    const result = validateCreateScreen(req);
    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
    const { theaterId, name } = result.value;

    // 2. Check theater exists and active
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

    // 3. Check for duplicate screen name in this theater (active screens only)
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

    // 4. Create screen
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
    // 1. Validate screenId param
    const { screenId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(screenId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID"
      });
    }

    // 2. Validate partial update data
    const result = validatePartialScreenUpdate(req);
    if (result.error) {
      return res.status(422).json({
        success: false,
        message: result.error.details || result.error
      });
    }

    const { screenType, isActive } = result.value;

    // 3. Find existing screen with theater details
    const screen = await Screen.findById(screenId)
      .populate('theaterId', 'name isActive')
      .lean();

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found"
      });
    }

    // 4. Verify associated theater exists and is active
    if (!screen.theaterId || !screen.theaterId.isActive) {
      return res.status(409).json({
        success: false,
        message: "Cannot update screen: associated theater not found or inactive"
      });
    }

    // 5. Prepare atomic update fields (only provided ones)
    const updateFields = { $set: {} };
    if (screenType !== undefined) updateFields.$set.screenType = screenType;
    if (isActive !== undefined) updateFields.$set.isActive = isActive;

    // 6. Perform safe update
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

    // 7. Final consistency check (theater still active post-update)
    if (!updatedScreen.theaterId?.isActive) {
      return res.status(409).json({
        success: false,
        message: "Update failed: associated theater became inactive"
      });
    }

    res.status(200).json({
      success: true,
      message: "Screen updated successfully",
      data: updatedScreen
    });

  } catch (err) {
    console.error("Update screen error:", err);

    // Handle specific Mongo errors
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
 * Admin only: delete a screen (soft delete)
 */
screenRouter.delete("/screens/:id", adminAuth, async (req, res) => {
  try {
    // 1. Validate screenId param
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID"
      });
    }

    // 2. Check if screen exists in database
    const screen = await Screen.findById(id);
    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found"
      });
    }

    // 3. Check if screen is already inactive
    if (!screen.isActive) {
      return res.status(409).json({
        success: false,
        message: "Screen is already inactive/deleted"
      });
    }

    // 4. Perform soft delete by setting isActive to false
    screen.isActive = false;

    // 5. Return success response
    await screen.save();
    res.status(200).json({
      success: true,
      message: "Screen deleted successfully"
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Server error during screen deletion"
    });
  }
});

/**
 * GET /screens/deleted
 * Admin only: list deleted (inactive) screens
 * NOTE: must be registered BEFORE /screens/:id
 */
screenRouter.get("/screens/deleted", adminAuth, async (req, res) => {
  try {
    // 1. Extract query params
    let { theaterId, page = 1, limit = 10 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50;

    // 2. Build query
    const query = { isActive: false };

    if (theaterId) {
      if (!mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid theater ID",
        });
      }
      query.theaterId = theaterId;
    }

    // 3. Pagination
    const skip = (page - 1) * limit;

    // 4. Fetch deleted screens
    const screens = await Screen.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1 })
      .populate("theaterId", "name city");

    // 5. Count
    const totalScreens = await Screen.countDocuments(query);

    // 6. Pagination metadata
    const totalPages = Math.ceil(totalScreens / limit);

    // 7. Response
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
 * NOTE: must be registered AFTER /screens/deleted
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
    // 1. validate theater id
    const { theaterId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater ID"
      });
    }
    // 2. check theater exists and active
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
    // 3. find all screens for that theater
    const screens = await Screen.find({
      theaterId,
      isActive: true,
    }).select("name totalSeats screenType");
    // 4. return all theater screens with names
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
    let { theaterId, page = 1, limit = 10 } = req.query;

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

/**
 * GET /screens
 * Admin only: list active screens with optional ?theaterId=, ?search=,
 * and pagination
 */
screenRouter.get("/screens", adminAuth, async (req, res) => {
  try {
    let { theaterId, search, page = 1, limit = 10 } = req.query;

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

    // Search by screen name OR parent theater name
    if (search && search.trim()) {
      const term = search.trim();

      const matchingTheaters = await Theater.find({
        name: { $regex: term, $options: "i" },
      }).select("_id");

      const theaterIds = matchingTheaters.map((t) => t._id);

      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { theaterId: { $in: theaterIds } },
      ];
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