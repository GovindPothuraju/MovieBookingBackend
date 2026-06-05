const mongoose = require("mongoose");

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
          "SCI-FI",
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
      type: Number,
      required: true,
      min: 1,
      max: 400,
    },

    releaseDate: {
      type: Date,
      required: true,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },

    cast: [
      {
        name: String,
        image: String,
      },
    ],

    crew: [
      {
        name: String,
        image: String,
      },
    ],

    posterUrl: {
      type: String,
      required: true,
    },

    trailerUrl: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["UPCOMING", "NOW_SHOWING", "ARCHIVED"],
      default: "UPCOMING",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    slug: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);



// IMPORTANT INDEXES
movieSchema.index({
  status: 1,
  releaseDate: -1,
});


movieSchema.index({
  isActive: 1,
});



// SLUG GENERATION
movieSchema.pre("save", function (next) {

  if (this.isModified("title")) {

    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") +
      "-" +
      Date.now();
  }

});

module.exports = mongoose.model("Movie", movieSchema);