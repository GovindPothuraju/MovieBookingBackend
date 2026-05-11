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
        name: {
          type: String,
          required: true,
          trim: true,
        },
        image: {
          type: String, // cloud URL
          default: null,
        }, 
      },
    ],
    // crew
    crew: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        image: {
          type: String, // cloud URL
          default: null,
        }, 
      },
    ],

    // media
    posterUrl: {
      type: String,
      required: true, // cloud URL
    },

    trailerUrl: {
      type: String,
      trim:true,
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


movieSchema.pre("save", async function (next) {
  if (this.isModified("title")) {
    let slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const existing = await mongoose.models.Movie.findOne({ slug });

    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    this.slug = slug;
  }
});

module.exports = mongoose.model("Movie", movieSchema);