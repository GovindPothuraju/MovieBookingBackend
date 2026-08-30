const express = require("express");
const app = express();

require("dotenv").config();

const cors = require("cors");
const cookieParser = require("cookie-parser");

app.set("trust proxy", 1);

const connectDB = require("./config/databse");



// Redis Import from config-redis
const  redisClient  = require("./config/redis");

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://cineflow-booking-admin-panel.vercel.app",
  "https://quickbook-eosin.vercel.app",
  "https://quickbook.dpdns.org",
  "https://cineflow-booking-theater-admin.vercel.app"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked CORS origin:", origin);

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(cookieParser());

// Admin Routes
const adminRoutes = require("./routers/admin/adminRoutes");
const theaterRoutes = require("./routers/admin/theaterRouter");
const screenRoutes = require("./routers/admin/screenRoutes");
const seatRoutes = require("./routers/admin/seatRoutes");
const movieRoutes = require("./routers/admin/movieRoutes");
const showRoutes = require("./routers/admin/showRoutes");
const bookingRoutes = require("./routers/admin/bookingRoutes");
const dashboardRoutes = require("./routers/admin/dashboardRoutes")
// User Routes
const userRoutes = require("./routers/users/userRoutes");
const userMovieRoutes = require("./routers/users/movieRoutes");
const userShowRoutes = require("./routers/users/showRoutes");
const bookingRouter = require("./routers/users/bookingRoutes");
const paymentRouter = require("./routers/users/paymentRouter")
// theater routes
const theaterRequestRouter = require("./routers/admin/theaterRequests");
const theaterAdminAuthRouter=require("./routers/theaterAdmin/theaterAdminAuth");
const theaterRouter=require("./routers/theaterAdmin/theater");
const screenRouter=require("./routers/theaterAdmin/screenRouter");
const seatRouter = require("./routers/theaterAdmin/seatRouter");
const showRouter = require("./routers/theaterAdmin/showRouter");


// Admin routes
app.use("/", adminRoutes);
app.use("/", theaterRoutes);
app.use("/", screenRoutes);
app.use("/", seatRoutes);
app.use("/", movieRoutes);
app.use("/", showRoutes);
app.use("/", bookingRoutes);
app.use("/",dashboardRoutes)


// User routes
app.use("/user", userRoutes);
app.use("/user", userMovieRoutes);
app.use("/user", userShowRoutes);
app.use("/user", bookingRouter);
app.use("/user", paymentRouter);

// theater admin router
app.use("/api",theaterRequestRouter);
app.use("/api",theaterAdminAuthRouter);
app.use("/api",theaterRouter);
app.use("/api",screenRouter);
app.use("/api",seatRouter);
app.use("/api",showRouter)

// Health check
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running smoothly",
  });
});


// Redis server start
// Connect MongoDB
//         ↓
// Connect Redis
//         ↓
// Start Express Server
const startServer = async () => {
  try {
    await connectDB();
    console.log("Database Connected");

    await redisClient.connect();
    console.log(" Redis Connected");

    const port = process.env.PORT || 5000;

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

  } catch (err) {
    console.error("Server startup failed:", err);
    process.exit(1);
  }
};

startServer();
