const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const theaterAdminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },

    theaterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theater",
      required: true,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    isVerified: {
      type: Boolean,
      default: true
    },

    mustChangePassword: {
      type: Boolean,
      default: true
    },

    lastLogin: {
      type: Date,
      default: null
    },

    otp: {
      type: String,
      default: null,
      select: false
    },

    otpExpires: {
      type: Date,
      default: null,
      select: false
    },

    otpAttempts: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

theaterAdminSchema.methods.getJWT = function () {
  return jwt.sign(
    {
      id: this._id,
      type: "THEATER_ADMIN",
      theaterId: this.theaterId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE
    }
  );
};

module.exports = mongoose.model("TheaterAdmin",theaterAdminSchema);