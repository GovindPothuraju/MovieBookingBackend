const express = require("express");
const mongoose = require("mongoose");
const seatRouter = express.Router();

const Seat = require("../models/seatSchema");
const Theater = require("../models/theaterModel");
const Screen = require("../models/screenModel");

const { adminAuth, adminMiddleware } = require("../middleware/adminAuth");

// ------------------- Screen Seat Management ------------------ //

/**
 * POST /screens/:screenId/layout
 * Admin only: generate seat layout for a screen (runs once)
 */
seatRouter.post("/screens/:screenId/layout", async (req, res) => {});
/**
 * GET /screens/:screenId/seats
 * Authenticated: get all seats grouped by row
 */
seatRouter.get("/screens/:screenId/seats", async (req, res) => {});
/**
 * PUT /screens/:screenId/layout
 * Admin only: update seat layout (only if no active shows/bookings)
 */
seatRouter.put("/screens/:screenId/layout", async (req, res) => {});
/**
 * DELETE /screens/:screenId/layout
 * Admin only: delete seat layout (safe delete)
 */
seatRouter.delete("/screens/:screenId/layout", async (req, res) => {});


module.exports = seatRouter;