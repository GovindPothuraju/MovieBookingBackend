const express = require("express");
const app = express();

require("dotenv").config();

const cors = require("cors");
const cookieParser = require("cookie-parser");

app.set("trust proxy", 1);

const connectDB = require("./config/databse");

// Admin Routes
const adminRoutes = require("./routers/admin/adminRoutes");
const theaterRoutes = require("./routers/admin/theaterRouter");
const screenRoutes = require("./routers/admin/screenRoutes");
const seatRoutes = require("./routers/admin/seatRoutes");
const movieRoutes = require("./routers/admin/movieRoutes");
const showRoutes = require("./routers/admin/showRoutes");
const bookingRoutes = require("./routers/admin/bookingRoutes");

// User Routes
const userRoutes = require("./routers/users/userRoutes");
const userMovieRoutes = require("./routers/users/movieRoutes");
const userShowRoutes = require("./routers/users/showRoutes");

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Admin routes
app.use("/", adminRoutes);
app.use("/", theaterRoutes);
app.use("/", screenRoutes);
app.use("/", seatRoutes);
app.use("/", movieRoutes);
app.use("/", showRoutes);
app.use("/", bookingRoutes);

// User routes
app.use("/user", userRoutes);
app.use("/user", userMovieRoutes);
app.use("/user", userShowRoutes);

// Health check
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running smoothly",
  });
});

connectDB()
  .then(() => {
    console.log("Database connected successfully");

    const port = process.env.PORT || 5000;

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.log("Database connection failed", err);
  });
