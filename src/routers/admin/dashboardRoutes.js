const express = require("express");
const dashboardRouter = express.Router();

const adminAuth = require("../../middleware/adminAuth");

const User = require("../../models/users/userModel");
const Movie = require("../../models/admin/movieModel");
const Theater = require("../../models/admin/theaterModel");
const Show = require("../../models/admin/showModel");
const Bookings = require("../../models/bookingSchema")
const Payments = require("../../models/paymentSchema");
/**
 * GET /dashboard/stats
 * Admin: get dashboard summary statistics
 */
dashboardRouter.get("/dashboard/stats", adminAuth, async (req, res) => {
    try{
      // 1 . totalUsers
      const totalUsers = await User.countDocuments({});
      // 2. totalMovies
      const totalMovies = await Movie.countDocuments({})
      // 3. totalTheaters
      const totalTheaters = await Theater.countDocuments({});
      // 4. totalShows
      const totalShows = await Show.countDocuments({});
      // 5. totalBookings
      const totalBookings = await Booking.countDocuments({});
      // 6. total Revenu
      const bookings = await Booking.find({});
      let revenue = 0;
      for(let booking of bookings){
        if(booking.paymentStatus=="SUCCESS" && booking.bookingStatus=="CONFIRMED"){
          revenue+=booking.totalAmount;
        }
      }
      return res.status(200).json({
        success: true,
        data: {
          totalUsers,
          totalMovies,
          totalTheaters,
          totalShows,
          totalBookings,
          totalRevenue
        }
      });
    }catch(err){
      res.status(500).send({
        "success":false,
        "message": err || "Internal Server Error"
      })
    }
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