const express=require('express');
const {adminAuth , adminMiddleware} = require("../middleware/adminAuth");

const screenRouter=express.Router();

const {validateCreateTheater}=require("../validators/theaterValidator");
const { validateCreateScreen}=require("../validators/screenValidators");
const Theater = require("../models/TheaterModel");
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
 * PUT /screens/:screenId
 * Admin only: partially update screen (e.g., status, type)
 */
screenRouter.patch("/theaters/:theaterId/screens/:id" ,()=>{})

/**
 * DELETE /screens/:screenId
 * Admin only: delete a screen (soft delete recommended)
 */
screenRouter.delete("/theaters/:theaterId/screens/:id" ,()=>{})
/**
 * GET /theaters/:theaterId/screens
 * Authenticated: list screens for a theater
 */
screenRouter.get('/theaters/:theaterId/screens/:id',(req, res) => {});
 
// ------------------- Screen Seat Management ------------------ //
/**
 * POST /screens/:screenId/seats
 * Admin only: generate seat layout for a screen (runs once)
 */
screenRouter.post('/screens/:screenId/seats',(req, res) => {});
 
/**
 * GET /screens/:screenId/seats
 * Authenticated: get all seats grouped by row
 */
screenRouter.get('/screens/:screenId/seats',(req, res) => {});
 
/**
 * PATCH /screens/:screenId/layout
 * Admin only: delete old seats and regenerate with new dimensions
 */
screenRouter.patch('/screens/:screenId/layout',(req, res) => {});
 
module.exports = screenRouter;
