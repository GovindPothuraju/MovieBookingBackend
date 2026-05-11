
const express = require('express');
const bookingRouter = express.Router();
const Booking = require('../../models/admin/bookingModel');

const { adminAuth, adminMiddleware } = require('../../middleware/adminAuth');

/**
 * GET /bookings
 * Admin only: list all bookings with filters & pagination
 */
bookingRouter.get('/bookings', adminAuth, adminMiddleware, async (req, res) => {
  
});

/**
 * GET /bookings/:bookingId
 * Admin only: get booking details by ID
 */
bookingRouter.get('/bookings/:bookingId', adminAuth, adminMiddleware, async (req, res) => {});

/**
 * PATCH /bookings/:bookingId/cancel
 * Admin only: cancel a booking and restore seats
 */
bookingRouter.patch('/bookings/:bookingId/cancel', adminAuth, adminMiddleware, async (req, res) => {});

module.exports = bookingRouter;