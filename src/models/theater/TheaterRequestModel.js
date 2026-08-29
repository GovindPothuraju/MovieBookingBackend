const mongoose = require("mongoose");

const THEATER_AMENITIES=["PARKING","FOOD COURT","WHEELCHAIR ACCESSIBLE","AC","DOLBY ATMOS","IMAX","ONLINE BOOKING","WIFI"];


const theaterRequestSchema = new mongoose.Schema(
  {
    // THEATER ADMIN DETAILS

    adminName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50
    },

    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },

    adminPhone: {
      type: String,
      required: true,
      trim: true
    },

    // THEATER DETAILS

    theaterName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },

    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    contactPhone: {
      type: String,
      required: true,
      trim: true
    },

    amenities: {
      type: [String],
      enum: THEATER_AMENITIES,
      default: []
    },

    // REQUEST STATUS

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED"
      ],
      default: "PENDING",
      index: true
    },

    rejectionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500
    },

    // PROCESSING DETAILS

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null
    },

    processedAt: {
      type: Date,
      default: null
    },

    // CREATED RESOURCES

    theaterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theater",
      default: null
    },

    theaterAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TheaterAdmin",
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "TheaterRequest",
  theaterRequestSchema
);