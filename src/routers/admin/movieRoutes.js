
const express = require('express');
const movieRouter = express.Router();
const mongoose = require('mongoose');
const Movie = require('../../models/admin/movieModel');
const upload = require('../../config/multer');
const redisClient = require("../../config/redis");


const { validateCreateMovie , validateUpdateMovie} = require('../../validators/movieValidator');
const adminAuth = require('../../middleware/adminAuth');
const uploadToCloudinary = require('../../utils/cloudinaryUpload');
const parseMovieFormData = require("../../middleware/parseMovieFormData");


/**
 * POST /movies
 * Admin only: create a new movie
 */
movieRouter.post(
  "/movies",
  adminAuth,
  upload.fields([
    { name: "poster", maxCount: 1 },
    { name: "castImages", maxCount: 10 },
    { name: "crewImages", maxCount: 10 },
  ]),
  parseMovieFormData,
  async (req, res) => {
    try {
      console.log(req.body);
      // 1. Validate Request
      const { error, value } = validateCreateMovie(req);

      if (error) {
        return res.status(400).json({
          success: false,
          message: error,
        });
      }

      // 2. Poster Validation
      if (!req.files?.poster?.length) {
        return res.status(400).json({
          success: false,
          message: "Poster image is required.",
        });
      }

      // 3. Duplicate Movie Check
      const existingMovie = await Movie.findOne({
        title: value.title,
        releaseDate: value.releaseDate,
      });

      if (existingMovie) {
        return res.status(409).json({
          success: false,
          message: "Movie already exists.",
        });
      }

      // 4. Upload Poster
      const posterUpload = await uploadToCloudinary(
        req.files.poster[0].buffer,
        "movies/posters"
      );

      const posterUrl = posterUpload.secure_url;

      // ===========================
      // CAST
      // ===========================

      const castData = value.cast || [];
      const castImages = req.files.castImages || [];

      if (castImages.length && castData.length !== castImages.length) {
        return res.status(400).json({
          success: false,
          message: "Cast members and cast images count must match.",
        });
      }

      let cast = [];

      if (castImages.length) {
        const uploadedCastImages = await Promise.all(
          castImages.map((file) =>
            uploadToCloudinary(file.buffer, "movies/cast")
          )
        );

        cast = castData.map((member, index) => ({
          name: member.name,
          image: uploadedCastImages[index].secure_url,
        }));
      } else {
        cast = castData.map((member) => ({
          name: member.name,
          image: null,
        }));
      }

      // ===========================
      // CREW
      // ===========================

      const crewData = value.crew || [];
      const crewImages = req.files.crewImages || [];

      if (crewImages.length && crewData.length !== crewImages.length) {
        return res.status(400).json({
          success: false,
          message: "Crew members and crew images count must match.",
        });
      }

      let crew = [];

      if (crewImages.length) {
        const uploadedCrewImages = await Promise.all(
          crewImages.map((file) =>
            uploadToCloudinary(file.buffer, "movies/crew")
          )
        );

        crew = crewData.map((member, index) => ({
          name: member.name,
          image: uploadedCrewImages[index].secure_url,
        }));
      } else {
        crew = crewData.map((member) => ({
          name: member.name,
          image: null,
        }));
      }

      // ===========================
      // CREATE MOVIE
      // ===========================

      const movie = await Movie.create({
        ...value,
        posterUrl,
        cast,
        crew,
      });

      return res.status(201).json({
        success: true,
        message: "Movie created successfully.",
        data: movie,
      });
    } catch (err) {
      console.error("Create Movie Error:", err);

      return res.status(500).json({
        success: false,
        message: err.message || "Failed to create movie.",
      });
    }
  }
);


/**
 * PATCH /movies/:movieId
 * Admin only: update movie details
 */
movieRouter.patch("/movies/:movieId",adminAuth,
  upload.fields([
    { name: "poster", maxCount: 1 },
    { name: "castImages", maxCount: 10 },
    { name: "crewImages", maxCount: 10 },
  ]),
  parseMovieFormData,
  async (req, res) => {
    try {
      // 1. Validate movieId
      const { movieId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(movieId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid movie ID",
        });
      }

      // 2. Find movie
      const movie = await Movie.findById(movieId);
      if (!movie) {
        return res.status(404).json({
          success: false,
          message: "Movie not found",
        });
      }

      // 3. Prevent updating archived movie
      if (movie.status === "ARCHIVED") {
        return res.status(400).json({
          success: false,
          message: "Cannot update archived movie",
        });
      }

      // 4. Validate request body
      const { error, value } = validateUpdateMovie(req);
      if (error) {
        return res.status(400).json({
          success: false,
          message: error,
        });
      }

      // 5. Handle poster upload (optional)
      if (req.files?.poster) {
        const uploadResult = await uploadToCloudinary(
          req.files.poster[0].buffer,
          "movies/posters"
        );
        movie.posterUrl = uploadResult.secure_url;
      }

      // 6. Update basic fields (partial update)
      if (value.title !== undefined) movie.title = value.title;
      if (value.description !== undefined) movie.description = value.description;
      if (value.language !== undefined) movie.language = value.language;
      if (value.duration !== undefined) movie.duration = value.duration;
      if (value.genre !== undefined) movie.genre = value.genre;
      if (value.releaseDate !== undefined) movie.releaseDate = value.releaseDate;

      // 7. Handle cast (append + safe update)
      if (value.cast !== undefined && value.cast.length > 0) {
        const castData = value.cast;
        const castImages = req.files?.castImages || [];

        if (castImages.length > 0) {
          if (castData.length !== castImages.length) {
            return res.status(400).json({
              success: false,
              message: "Cast data and images count mismatch",
            });
          }

          const uploads = await Promise.all(
            castImages.map((file) =>
              uploadToCloudinary(file.buffer, "movies/cast")
            )
          );

          const newCast = uploads.map((upload, idx) => ({
            name: castData[idx].name,
            image: upload.secure_url,
          }));

          // Append new cast
          movie.cast = [...movie.cast, ...newCast];
        } else {
          // Update names only (keep images)
          movie.cast = movie.cast.map((existing, idx) => ({
            ...existing,
            name: castData[idx]?.name || existing.name,
          }));
        }
      }

      // 8. Handle crew (append + safe update)
      if (value.crew !== undefined && value.crew.length > 0) {
        const crewData = value.crew;
        const crewImages = req.files?.crewImages || [];

        if (crewImages.length > 0) {
          if (crewData.length !== crewImages.length) {
            return res.status(400).json({
              success: false,
              message: "Crew data and images count mismatch",
            });
          }

          const uploads = await Promise.all(
            crewImages.map((file) =>
              uploadToCloudinary(file.buffer, "movies/crew")
            )
          );

          const newCrew = uploads.map((upload, idx) => ({
            name: crewData[idx].name,
            image: upload.secure_url,
          }));

          // Append new crew
          movie.crew = [...movie.crew, ...newCrew];
        } else {
          // Update names only
          movie.crew = movie.crew.map((existing, idx) => ({
            ...existing,
            name: crewData[idx]?.name || existing.name,
          }));
        }
      }

      // 9. Duplicate check
      if (value.title || value.releaseDate) {
        const duplicate = await Movie.findOne({
          title: value.title || movie.title,
          releaseDate: value.releaseDate || movie.releaseDate,
          _id: { $ne: movie._id },
        });

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message: "Movie already exists with same title and release date",
          });
        }
      }

      // 10. Save movie
      await movie.save();

      // 11. Send response
      const { __v, ...safeMovie } = movie.toObject();

      return res.status(200).json({
        success: true,
        message: "Movie updated successfully",
        data: safeMovie,
      });

    } catch (err) {
      console.error("Update movie error:", err);

      // 12. Error response
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to update movie",
      });
    }
  }
);


/**
 * PATCH /movies/:movieId/status
 * Admin only: update movie status
 */

movieRouter.patch('/movies/:movieId/status',adminAuth, async (req, res) => {
    try {
      const { movieId } = req.params;
      const { status } = req.body;

      // 1️. Validate movieId
      if (!mongoose.Types.ObjectId.isValid(movieId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid movie ID",
        });
      }

      // 2️. Validate status
      const allowedStatus = ["UPCOMING", "NOW_SHOWING", "ARCHIVED"];

      if (!status || !allowedStatus.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid or missing status",
        });
      }

      // 3️. Check movie exists
      const movie = await Movie.findById(movieId);

      if (!movie) {
        return res.status(404).json({
          success: false,
          message: "Movie not found",
        });
      }

      // 4️. prevent same status update
      if (movie.status === status) {
        return res.status(400).json({
          success: false,
          message: `Movie is already ${status}`,
        });
      }

      // 5️. Update status
      movie.status = status;
      await movie.save();

      // 6️. Response
      return res.status(200).json({
        success: true,
        message: "Movie status updated successfully",
        data: {
          _id: movie._id,
          title: movie.title,
          status: movie.status,
        },
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to update movie status",
      });
    }
  }
);



/**
 * DELETE /movies/:movieId
 * Admin only: archive a movie (soft delete)
 */
movieRouter.delete("/movies/:movieId",adminAuth,async (req, res) => {
    try {
      const { movieId } = req.params;

      // 1 validate movieId
      if (!mongoose.Types.ObjectId.isValid(movieId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid movie ID",
        });
      }

      // 2 check movie exists
      const movie = await Movie.findById(movieId);
      if (!movie) {
        return res.status(404).json({
          success: false,
          message: "Movie not found",
        });
      }

      // 3 check already archived
      if (movie.status === "ARCHIVED") {
        return res.status(400).json({
          success: false,
          message: "Movie already archived",
        });
      }

      // 4 check if movie has upcoming shows
      // (Assuming you have Show model with movieId and showTime)
      // const hasUpcomingShows = await Show.findOne({
      //   movieId: movie._id,
      //   showTime: { $gte: new Date() },
      // });

      // if (hasUpcomingShows) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "Cannot delete movie with upcoming shows",
      //   });
      // }

      // 5 archive movie (soft delete)
      movie.status = "ARCHIVED";
      await movie.save();

      // 6 send response
      return res.status(200).json({
        success: true,
        message: "Movie archived successfully",
        data: {
          _id: movie._id,
          title: movie.title,
          status: movie.status,
        },
      });

    } catch (err) {
      console.error("Delete movie error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to delete movie",
      });
    }
  }
);

/**
 * GET /movies/:movieId
 * Admin only: get movie details by ID
 */
movieRouter.get('/movies/:movieId', adminAuth, async (req, res) => {
  try{
    // 1. Validate movieId
    const { movieId } = req.params;
    if(!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid movie ID",
      });
    }
    // 2. Find movie
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }
    // 3. response with movie details 
    const { __v, ...safeMovie } = movie.toObject();
    return res.status(200).json({
      success: true,
      message: "Movie details retrieved successfully",
      data: safeMovie,
    });
  }catch(err){
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get movie details",
    });
  }
});


/**
 * GET /movies
 * Admin only: get all movies
 */
movieRouter.get("/movies", adminAuth, async (req, res) => {
  try {
    // 1. Validate and parse pagination
    let { page = 1, limit = 3 } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1 || limit > 50) limit = 3;

    // 2. Build MongoDB query
    const query = {};
    const { status, language, genre, search } = req.query;

    if (status) query.status = status;
    if (language) query.language = language;
    if (genre) query.genre = genre;

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // 3. Generate Redis Cache Key
    const cacheKey = `movies:${JSON.stringify(req.query)}`;

    // 4. Check Redis Cache
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData){
        return res.status(200).json({
          source: "Redis Cache",
          ...JSON.parse(cachedData),
        });
      }
    } catch (redisErr) {
      console.error("Redis GET Error:", redisErr.message);
    }

    // 5. Pagination
    const skip = (page - 1) * limit;

    // 6. Fetch data from MongoDB
    const [movies, total] = await Promise.all([
      Movie.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ releaseDate: -1 })
        .select("title releaseDate language genre status"),

      Movie.countDocuments(query),
    ]);

    // 7. Pagination info
    const totalPages = Math.ceil(total / limit);

    const pagination = {
      totalMovies: total,
      currentPage: page,
      totalPages,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    // 8. Response Object
    const response = {
      success: true,
      message: "Movies fetched successfully",
      source: "MongoDB",
      data: movies,
      pagination,
    };

    // 9. Store in Redis (10 Minutes)
    try {
      await redisClient.setEx(
        cacheKey,
        600,
        JSON.stringify(response)
      );

      console.log("✅ Cached:", cacheKey);
    } catch (redisErr) {
      console.error("Redis SET Error:", redisErr.message);
    }

    // 10. Return Response
    return res.status(200).json(response);

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get movies",
    });
  }
});

module.exports = movieRouter;

