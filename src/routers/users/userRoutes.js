const express = require('express');
const userRouter = express.Router();
const bcrypt = require("bcrypt");

const User = require('../../models/users/userModel');
const { validateUserRegistration } = require('../../validators/userValidators/userValidator');
const { userAuth } = require('../../middleware/userAuth');

const SALT_ROUNDS = 10;

/**
 * POST /auth/register
 * User: register a new account
 */
userRouter.post('/register', async (req, res) => {
  try {

    // 1. Validate data
    const { value, error } = validateUserRegistration(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Registration failed",
        error: error.details?.[0]?.message || error.message
      });
    }

    // 2. Extract values
    const { name, email, password, phone } = value;

    // 3. Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // 4. Check existing user
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists"
      });
    }

    // 5. Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 6. Create user
    const newUser = new User({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      ...(phone && { phone })
    });

    // 7. Save
    await newUser.save();

    // 8. Success response
    return res.status(201).json({
      success: true,
      message: "User registered successfully"
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error"
    });
  }
});


/**
 * POST /auth/login
 * User: login and receive JWT token
 */
userRouter.post('/login', async (req, res) => {
  try {

    // 1. Extract credentials
    const { email, password } = req.body;

    // 2. Validate email,password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // 3. Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // 4. Find user by email
    const user = await User.findOne({
      email: normalizedEmail
    }).select("+password");

    // 5. Validate user
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // 6. Validate password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // 7. Generate jwt
    const token = await user.getJWT();

    // 8. Set cookie
    const cookieExpireDays =
      parseInt(process.env.COOKIE_EXPIRE) || 7;

    const maxAgeMs =
      cookieExpireDays * 24 * 60 * 60 * 1000;

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,          // required for sameSite:none
      sameSite: "none",      // required for cross-origin cookies
      maxAge: maxAgeMs,
      expires: new Date(Date.now() + maxAgeMs),
      path: "/"
    });

    // 9. Response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Login failed",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error"
    });
  }
});


/**
 * POST /auth/logout
 * User: logout current user
 */
userRouter.post('/logout', async (req, res) => {
  try {

    // 1. Clear cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/"
    });

    // 2. Response
    return res.status(200).json({
      success: true,
      message: "Logout successful"
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Logout failed",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error"
    });
  }
});


/**
 * GET /auth/profile
 * User: get current user profile
 */
userRouter.get('/profile', userAuth, async (req, res) => {
  try {

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        avatar: req.user.avatar,
        role: req.user.role,
        isVerified: req.user.isVerified
      }
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


/**
 * PATCH /auth/change-password
 * User: change current account password
 */
userRouter.patch('/change-password', userAuth, async (req, res) => {

});


module.exports = userRouter;
