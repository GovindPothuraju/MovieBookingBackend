const express = require("express");
const dashboardRouter = express.Router();

const adminAuth = require("../../middleware/adminAuth");

const User = require("../../models/users/userModel");
const Movie = require("../../models/admin/movieModel");
const Theater = require("../../models/admin/theaterModel");
const Show = require("../../models/admin/showModel");
const Booking = require("../../models/bookingSchema")
/**
 * GET /dashboard/stats
 * Admin: get dashboard summary statistics
 */
dashboardRouter.get("/dashboard/stats", adminAuth , async (req, res) => {
    try{
      // 1 . totalUsers
      // 2. totalMovie
      // 3. totalTheaters
      // 4. totalShows
      // 5. totalBookings
      // 6. total Revenu
      const [totalUsers,totalMovies,totalTheaters,totalShows,totalBookings,revenueResult] = await Promise.all([
          User.countDocuments({}),
          Movie.countDocuments({}),
          Theater.countDocuments({}),
          Show.countDocuments({}),
          Booking.countDocuments({}),
          Booking.aggregate([
            {
              $match:{
                paymentStatus: "SUCCESS",
                bookingStatus: "CONFIRMED"
              }
            },{
              $group:{
                _id :null,
                totalRevenue:{$sum:"$totalAmount"}
              }
            }
          ])
      ]);
      console.log(revenueResult)
      const totalRevenue = revenueResult[0]?.totalRevenue || 0;
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
      console.log(err)
      res.status(500).send({
        "success":false,
        "message": err
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