const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const theaterUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // never return password
    },

    role: {
      type: String,
      enum: ["THEATER_OWNER"],
      default: "THEATER_OWNER",
    },

    // Link to theater
    theaterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theater",
      required: true,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
    },
  },
  { timestamps: true }
);

//  JWT Generator
theaterUserSchema.methods.getJWT = async function () {
  const user = this;

  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      theaterId: user.theaterId, // CRITICAL for access control
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );

  return token;
};

module.exports = mongoose.model("TheaterUser", theaterUserSchema);