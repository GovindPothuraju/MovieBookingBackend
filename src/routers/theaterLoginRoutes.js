const express = require("express");
const theaterRouter = express.Router();
const bcrypt = require("bcrypt");

// -- 🔐 THEATER AUTH ROUTERS
// - POST /theater/register → Register theater owner
// - POST /theater/login    → Login theater owner
// - POST /theater/logout   → Logout theater owner

const {
  validateTheaterRegister,
  validateTheaterLogin,
} = require("../validators/theaterLoginValidator");

const TheaterUser = require("../models/theaterLoginModel");

theaterRouter.post("/theater/register", async (req, res) => {
  try {
    // 1️ Validate input
    const { error, value } = validateTheaterRegister(req);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const { name, email, password, theaterId } = value;

    // 2️ Check duplicate
    const existingUser = await TheaterUser.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Theater user already exists with this email",
      });
    }

    // 3️ Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4️ Create theater user
    const newUser = new TheaterUser({
      name,
      email,
      password: hashedPassword,
      theaterId, // 🔥 important
    });

    const savedUser = await newUser.save();

    // 5️ Generate JWT
    const token = await savedUser.getJWT();

    // 6️ Set cookie
    const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE) || 7;

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: cookieExpireDays * 24 * 60 * 60 * 1000,
      expires: new Date(
        Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000
      ),
    });

    // 7️ Response
    res.status(201).json({
      success: true,
      message: "Theater user registered successfully",
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        theaterId: savedUser.theaterId,
      },
    });

  } catch (err) {
    console.error("Theater Register Error:", err);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

theaterRouter.post("/theater/login", async (req, res) => {
  try {
    // 1️ Validate input
    const { error, value } = validateTheaterLogin(req);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const { email, password } = value;

    // 2️ Check user
    const user = await TheaterUser.findOne({ email }).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 3️ Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 4️ Generate JWT
    const token = await user.getJWT();

    // 5️ Set cookie
    const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE) || 7;

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: cookieExpireDays * 24 * 60 * 60 * 1000,
      expires: new Date(
        Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000
      ),
    });

    // 6️ Response
    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        theaterId: user.theaterId,
      },
    });

  } catch (err) {
    console.error("Theater Login Error:", err);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = theaterRouter;