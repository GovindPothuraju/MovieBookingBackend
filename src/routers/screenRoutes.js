const express=require('express');
const mongoose = require('mongoose');
const {adminAuth , adminMiddleware} = require("../middleware/adminAuth");

const screenRouter=express.Router();

const { validateCreateScreen, validatePartialScreenUpdate }=require("../validators/screenValidators");
const Theater = require("../models/theaterModel");
const Screen = require("../models/screenModel");

// -------------------- Screen Management ------------------ //

/**
 * POST /theaters/:theaterId/screens
 * Admin only: create a new screen under a theater
 */
screenRouter.post('/theaters/:theaterId/screens', adminAuth, adminMiddleware, async (req, res) => {
  try {
    // 1. Validate request (theaterId param + body)
    const result = validateCreateScreen(req);
    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
    const { name, rows, columns, screenType } = result.value;

    // 2. Check theater exists and active
    const theater = await Theater.findById(result.value.theaterId);
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

    // 3. Check for duplicate screen name in this theater
    const existingScreen = await Screen.findOne({
      theaterId: result.value.theaterId,
      name
    });
    if (existingScreen) {
      return res.status(409).json({
        success: false,
        message: `Screen "${name}" already exists in this theater`
      });
    }

    // 4. Create screen
    const newScreen = new Screen(result.value);
    await newScreen.save({ runValidators: true });

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
screenRouter.patch("/screens/:screenId", adminAuth, adminMiddleware, async (req, res) => {
  try {
    // 1. Validate partial update data
    const result = validatePartialScreenUpdate(req);
    if (result.error) {
      return res.status(422).json({
        success: false,
        message: result.error.details || result.error
      });
    }

    const { screenId, screenType, isActive } = result.value;

    // 2. Find existing screen with theater details
    const screen = await Screen.findById(screenId)
      .populate('theaterId', 'name isActive')
      .lean();

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found"
      });
    }

    // 3. Verify associated theater exists and is active
    if (!screen.theaterId || !screen.theaterId.isActive) {
      return res.status(409).json({
        success: false,
        message: "Cannot update screen: associated theater not found or inactive"
      });
    }

    // 4. Prepare atomic update fields (only provided ones)
    const updateFields = { $set: {} };
    if (screenType !== undefined) updateFields.$set.screenType = screenType;
    if (isActive !== undefined) updateFields.$set.isActive = isActive;

    // 5. Perform safe update
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

    // 6. Final consistency check (theater still active post-update)
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
 * DELETE /screens/:screenId
 * Admin only: delete a screen (soft delete recommended)
 */
screenRouter.delete("/screens/:id" ,adminAuth, adminMiddleware , async (req,res)=>{
    try{
      // 1. Validate screenId param
      const { id } = req.params;
      if(!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID"
        });
      }
      // 2. check if screen exists in databse
      const screen= await Screen.findById(id);
      if(!screen){
        return res.status(404).json({
          success: false,
          message: "Screen not found"
        });
      }
      // 3 check if screen is already inactive
      if(!screen.isActive){
        return res.status(409).json({
          success: false,
          message: "Screen is already inactive/deleted"
        });
      }
      // 4. Perform soft delete by setting isActive to false
      screen.isActive=false;
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
 * GET /theaters/:theaterId/screens
 * Admin Authenticated: list screens for a theater
 */
screenRouter.get('/theaters/:theaterId/screens',adminAuth, adminMiddleware ,async (req, res) => {
  try{
    // 1. validate theater id
    const { theaterId } = req.params;
    if(!mongoose.Types.ObjectId.isValid(theaterId)){
      return res.status(400).json({
        success: false,
        message: "Invalid theater ID"
      });
    }
    // 2. check theater exists and active
    const theater = await Theater.findById(theaterId);
    if(!theater){
      return res.status(404).json({
        success: false,
        message: "Theater not found"
      });
    }
    if(!theater.isActive){
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
    // 4.return all theater screens with names 
    return res.status(200).json({
      success: true,
      message: `Screens for theater "${theater.name}" retrieved successfully`,
      data: screens
    });
  }catch(err){
    res.status(500).json({
      success: false,
      message: err.message || "Server error during fetching screens"
    });
  }
});

 
module.exports = screenRouter;
