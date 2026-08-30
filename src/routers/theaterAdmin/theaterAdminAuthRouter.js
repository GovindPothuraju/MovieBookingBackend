const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const theaterAdminAuthRouter = express.Router();

const TheaterAdmin = require("../../models/theater/TheaterAdmin");
const theaterAdminAuth = require("../../middleware/theaterAdminAuth");

const sendEmail = require("../../utils/emailTemplates/sendEmail");
const {
  getLoginOTPTemplate,
} = require("../../utils/emailTemplates/emailTemplate");

const redisClient = require("../../config/redis");

const OTP_EXPIRY = 300;
const MAX_OTP_ATTEMPTS = 5;

const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const getOTPKey = (email) => {
  return `theater-admin:otp:${email}`;
};

const getOTPAttemptsKey = (email) => {
  return `theater-admin:otp-attempts:${email}`;
};

theaterAdminAuthRouter.post(
  "/theater-admin/login",
  async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      if (typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid input format",
        });
      }

      const normalizedEmail = email.toLowerCase().trim();

      const theaterAdmin = await TheaterAdmin.findOne({
        email: normalizedEmail,
      }).select("+password");

      const genericInvalid = () =>
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });

      if (!theaterAdmin) {
        return genericInvalid();
      }

      if (!theaterAdmin.isActive) {
        return genericInvalid();
      }

      if (!theaterAdmin.theaterId) {
        return genericInvalid();
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        theaterAdmin.password
      );

      if (!isPasswordValid) {
        return genericInvalid();
      }

      const otpKey = getOTPKey(normalizedEmail);
      const attemptsKey = getOTPAttemptsKey(normalizedEmail);

      const existingOTP = await redisClient.get(otpKey);
      if (existingOTP) {
        return res.status(429).json({
          success: false,
          message:
            "An OTP was already sent. Please wait for it to expire before requesting a new one.",
        });
      }

      const otp = generateOTP();

      const hashedOTP = await bcrypt.hash(
        otp,
        Number(process.env.BCRYPT_SALT_ROUNDS) || 10
      );

      await redisClient.setEx(otpKey, OTP_EXPIRY, hashedOTP);
      await redisClient.setEx(attemptsKey, OTP_EXPIRY, "0");

      try {
        await sendEmail({
          to: theaterAdmin.email,
          subject: "Your Theater Admin Login OTP",
          text: `Your OTP is ${otp}. This OTP is valid for 5 minutes.`,
          html: getLoginOTPTemplate(otp),
        });
      } catch (emailError) {
        await redisClient.del(otpKey);
        await redisClient.del(attemptsKey);

        console.error("Theater Admin OTP Email Error:", emailError);

        return res.status(502).json({
          success: false,
          message: "Failed to send OTP. Please try again.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        email: theaterAdmin.email,
      });
    } catch (err) {
      console.error("Theater Admin Login Error:", err);

      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

theaterAdminAuthRouter.post(
  "/theater-admin/verify-otp",
  async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: "Email and OTP are required",
        });
      }

      if (
        typeof email !== "string" ||
        (typeof otp !== "string" && typeof otp !== "number")
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid input format",
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const otpString = otp.toString().trim();

      if (!/^\d{4,8}$/.test(otpString)) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP format",
        });
      }

      const theaterAdmin = await TheaterAdmin.findOne({
        email: normalizedEmail,
      });

      const genericInvalid = () =>
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });

      if (!theaterAdmin) {
        return genericInvalid();
      }

      if (!theaterAdmin.isActive) {
        return genericInvalid();
      }

      if (!theaterAdmin.theaterId) {
        return genericInvalid();
      }

      const otpKey = getOTPKey(normalizedEmail);
      const attemptsKey = getOTPAttemptsKey(normalizedEmail);

      const hashedOTP = await redisClient.get(otpKey);

      if (!hashedOTP) {
        return res.status(400).json({
          success: false,
          message: "OTP expired or not found. Please login again.",
        });
      }

      const attempts = await redisClient.incr(attemptsKey);
      if (attempts === 1) {
        await redisClient.expire(attemptsKey, OTP_EXPIRY);
      }

      if (attempts > MAX_OTP_ATTEMPTS) {
        await redisClient.del(otpKey);
        await redisClient.del(attemptsKey);

        return res.status(429).json({
          success: false,
          message:
            "Too many invalid OTP attempts. Please login again.",
        });
      }

      const isOTPValid = await bcrypt.compare(otpString, hashedOTP);

      if (!isOTPValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid OTP",
          attemptsRemaining: Math.max(
            MAX_OTP_ATTEMPTS - attempts,
            0
          ),
        });
      }

      await redisClient.del(otpKey);
      await redisClient.del(attemptsKey);

      theaterAdmin.lastLogin = new Date();

      try {
        await theaterAdmin.save();
      } catch (saveErr) {
        console.error(
          "Theater Admin lastLogin Save Error:",
          saveErr
        );
      }

      const token = theaterAdmin.getJWT();

      const cookieExpireDays =
        parseInt(process.env.COOKIE_EXPIRE, 10) || 7;

      const maxAgeMs = cookieExpireDays * 24 * 60 * 60 * 1000;

      const isProduction = process.env.NODE_ENV === "production";

      res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: maxAgeMs,
        path: "/",
      });

      return res.status(200).json({
        success: true,
        message: "Login successful",
        theaterAdmin: {
          id: theaterAdmin._id,
          name: theaterAdmin.name,
          email: theaterAdmin.email,
          theaterId: theaterAdmin.theaterId,
          mustChangePassword: theaterAdmin.mustChangePassword,
        },
      });
    } catch (err) {
      console.error("Theater Admin Verify OTP Error:", err);

      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

theaterAdminAuthRouter.post(
  "/theater-admin/resend-otp",
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const normalizedEmail = email.toLowerCase().trim();

      const theaterAdmin = await TheaterAdmin.findOne({
        email: normalizedEmail,
      });

      if (!theaterAdmin) {
        return res.status(404).json({
          success: false,
          message: "Theater Admin not found",
        });
      }

      if (!theaterAdmin.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account is inactive",
        });
      }

      if (!theaterAdmin.theaterId) {
        return res.status(403).json({
          success: false,
          message: "No theater assigned to this admin",
        });
      }

      const otp = generateOTP();

      const hashedOTP = await bcrypt.hash(
        otp,
        Number(process.env.BCRYPT_SALT_ROUNDS) || 10
      );

      const otpKey = getOTPKey(normalizedEmail);
      const attemptsKey = getOTPAttemptsKey(normalizedEmail);

      await redisClient.setEx(
        otpKey,
        OTP_EXPIRY,
        hashedOTP
      );

      await redisClient.setEx(
        attemptsKey,
        OTP_EXPIRY,
        "0"
      );

      try {
        await sendEmail({
          to: theaterAdmin.email,
          subject: "Your Theater Admin Login OTP",
          text: `Your OTP is ${otp}. This OTP is valid for 5 minutes.`,
          html: getLoginOTPTemplate(otp),
        });
      } catch (emailError) {
        await redisClient.del(otpKey);
        await redisClient.del(attemptsKey);

        throw emailError;
      }

      return res.status(200).json({
        success: true,
        message: "OTP resent successfully",
      });
    } catch (err) {
      console.error(
        "Theater Admin Resend OTP Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

theaterAdminAuthRouter.post(
  "/theater-admin/logout",
  (req, res) => {
    try {
      res.cookie("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite:
          process.env.NODE_ENV === "production"
            ? "none"
            : "lax",
        expires: new Date(0),
        path: "/",
      });

      return res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    } catch (err) {
      console.error(
        "Theater Admin Logout Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  }
);

theaterAdminAuthRouter.get(
  "/theater-admin/profile",
  theaterAdminAuth,
  async (req, res) => {
    try {
      return res.status(200).json({
        success: true,
        message: "Profile fetched successfully",
        data: {
          id: req.theaterAdmin._id,
          name: req.theaterAdmin.name,
          email: req.theaterAdmin.email,
          phoneNumber: req.theaterAdmin.phoneNumber,
          theaterId: req.theaterAdmin.theaterId,
          isActive: req.theaterAdmin.isActive,
          lastLogin: req.theaterAdmin.lastLogin,
          mustChangePassword:
            req.theaterAdmin.mustChangePassword,
        },
      });
    } catch (err) {
      console.error(
        "Theater Admin Profile Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

theaterAdminAuthRouter.post(
  "/theater-admin/change-password",
  theaterAdminAuth,
  async (req, res) => {
    try {
      const {
        currentPassword,
        newPassword,
      } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message:
            "Current password and new password are required",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be at least 6 characters",
        });
      }

      const theaterAdmin = await TheaterAdmin.findById(
        req.theaterAdmin._id
      ).select("+password");

      if (!theaterAdmin) {
        return res.status(404).json({
          success: false,
          message: "Theater Admin not found",
        });
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        theaterAdmin.password
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      const samePassword = await bcrypt.compare(
        newPassword,
        theaterAdmin.password
      );

      if (samePassword) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be different from current password",
        });
      }

      theaterAdmin.password = await bcrypt.hash(
        newPassword,
        Number(process.env.BCRYPT_SALT_ROUNDS) || 10
      );

      theaterAdmin.mustChangePassword = false;

      await theaterAdmin.save();

      return res.status(200).json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (err) {
      console.error(
        "Theater Admin Change Password Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
);

module.exports = theaterAdminAuthRouter;