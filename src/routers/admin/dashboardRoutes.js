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
 * GET /dashboard/bookings
 * Admin: get booking trend for the last 7 days
 */
dashboardRouter.get("/dashboard/bookings",adminAuth ,  async (req, res) => {
  try{
    //1. calculate 7 daus
    const endDate = new Date();

    const startDate = new Date();
    startDate.setDate(startDate.getDate()-6);
    // set hours
    startDate.setHours(0,0,0,0);
    // 2. get booking count grouped by date
    const bookings = await Booking.aggregate([
      {
        $match:{
          createdAt:{
            $gte : startDate,
            $lte : endDate,
          },
          paymentStatus : "SUCCESS",
          bookingStatus : "CONFIRMED"
        }
      },{
        $group:{
          _id:{
            $dateToString:{
              format: "%Y-%m-%d",
              date: "$createdAt",
            }
          },
          bookings:{$sum:1}
        }
      },{
        $sort:{_id:1}
      }
    ]);
    const result= [];
    for(let i=0;i<7;i++){
      const date = new Date();
      date.setDate(date.getDate()- (6-i));
      const dateString = date.toISOString().split("T")[0];
      const found = bookings.find((item)=>item._id === dateString);
      result.push({
        date : dateString,
        bookings : found ? found.bookings : 0
      })
    }
    return res.status(200).json({
      success: true,
      data: result,
    });   
  }catch(err){
    console.error("Dashboard bookings error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
});

/**
 * GET /dashboard/revenue
 * Admin: get revenue trend for the last 7 days
 */
dashboardRouter.get("/dashboard/revenue", adminAuth, async (req, res) => {
  try {
    // 1. Calculate last 7 days
    const endDate = new Date();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);

    // Start from beginning of the first day
    startDate.setHours(0, 0, 0, 0);

    // 2. Get revenue grouped by date
    const revenue = await Booking.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },

          paymentStatus: "SUCCESS",
          bookingStatus: "CONFIRMED",
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },

          revenue: {
            $sum: "$totalAmount",
          },
        },
      },

      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    // 3. Make sure all 7 days are present
    const result = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();

      date.setDate(date.getDate() - (6 - i));

      const dateString = date.toISOString().split("T")[0];

      const found = revenue.find(
        (item) => item._id === dateString
      );

      result.push({
        date: dateString,
        revenue: found ? found.revenue : 0,
      });
    }

    // 4. Send response
    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (err) {
    console.error("Dashboard revenue error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
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