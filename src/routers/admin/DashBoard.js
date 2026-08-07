const express = require("express");
const dashboardRouter = express.Router();

const adminAuth = require("../../middleware/adminAuth");

/**
 * GET /dashboard/stats
 * Admin: get dashboard summary statistics
 */
dashboardRouter.get("/dashboard/stats", adminAuth, async (req, res) => {

});

/**
 * GET /dashboard/revenue
 * Admin: get revenue trend for the last 7 days
 */
dashboardRouter.get("/dashboard/revenue", adminAuth, async (req, res) => {

});

/**
 * GET /dashboard/bookings
 * Admin: get booking trend for the last 7 days
 */
dashboardRouter.get("/dashboard/bookings", adminAuth, async (req, res) => {

});

/**
 * GET /dashboard/booking-status
 * Admin: get booking status distribution
 */
dashboardRouter.get("/dashboard/booking-status", adminAuth, async (req, res) => {

});

/**
 * GET /dashboard/top-movies
 * Admin: get top booked movies
 */
dashboardRouter.get("/dashboard/top-movies", adminAuth, async (req, res) => {

});

/**
 * GET /dashboard/movie-genres
 * Admin: get movie genre distribution
 */
dashboardRouter.get("/dashboard/movie-genres", adminAuth, async (req, res) => {

});

/**
 * GET /dashboard/top-theaters
 * Admin: get theaters with highest bookings
 */
dashboardRouter.get("/dashboard/top-theaters", adminAuth, async (req, res) => {

});

/**
 * GET /dashboard/recent-bookings
 * Admin: get latest bookings
 */
dashboardRouter.get("/dashboard/recent-bookings", adminAuth, async (req, res) => {

});

module.exports = dashboardRouter;