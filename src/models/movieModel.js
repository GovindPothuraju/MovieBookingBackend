const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    genres: [
      {
        type: String,
        enum: [
          "ACTION",
          "DRAMA",
          "COMEDY",
          "THRILLER",
          "HORROR",
          "ROMANCE",
        ],
      },
    ],

    languages: [
      {
        type: String,
        uppercase: true,
        trim: true,
      },
    ],

    duration: {
      type: Number, // minutes
      required: true,
      min: 1,
      max: 400,
    },

    releaseDate: {
      type: Date,
      required: true,
    },

    // rating 
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },

    // cast
    cast: [
      {
        name: String,
        image: String, // cloud URL
      },
    ],

    // media
    posterUrl: {
      type: String,
      required: true,
    },

    trailerUrl: {
      type: String,
    },

    // status
    status: {
      type: String,
      enum: ["UPCOMING", "NOW_SHOWING", "ARCHIVED"],
      default: "UPCOMING",
    },

    //  soft delete
    isActive: {
      type: Boolean,
      default: true,
    },

    // 🔎 slug
    slug: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);


// auto slug
movieSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
});

module.exports = mongoose.model("Movie", movieSchema);