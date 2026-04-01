
const express = require('express');
const movieRouter = express.Router();
const Movie = require('../models/movieModel');
const upload = require('../config/multer');

const { validateCreateMovie } = require('../validators/movieValidator');
const { adminAuth ,adminMiddleware } = require('../middleware/adminAuth');
const uploadToCloudinary = require('../utils/cloudinaryUpload');


/**
 * POST /movies
 * Admin only: create a new movie
 */
movieRouter.post('/movies',adminAuth,adminMiddleware,upload.fields([
    { name: "poster", maxCount: 1 },
    { name: "castImages", maxCount: 10 }
  ]),async (req, res) => {
    try {
      // 1. Validate
      const { error, value } = validateCreateMovie(req);

      if (error) {
        return res.status(400).json({
          success: false,
          message: error,
        });
      }

      // 2. Poster check
      if (!req.files || !req.files.poster) {
        return res.status(400).json({
          success: false,
          message: "Poster image is required",
        });
      }

      // 3. Duplicate check
      const movieExists = await Movie.findOne({
        title: value.title,
        releaseDate: value.releaseDate
      });

      if (movieExists) {
        return res.status(409).json({
          success: false,
          message: "Movie already exists",
        });
      }

      // 4. Upload poster
      const posterUpload = await uploadToCloudinary(
        req.files.poster[0].buffer,
        "movies/posters"
      );

      const posterUrl = posterUpload.secure_url;

      // 5. Cast handling
      let cast = [];
      const castImages = req.files.castImages || [];

      if (value.cast.length !== castImages.length) {
        return res.status(400).json({
          success: false,
          message: "Cast and images count mismatch",
        });
      }

      const castUploads = await Promise.all(
        castImages.map(file =>
          uploadToCloudinary(file.buffer, "movies/cast")
        )
      );

      cast = castUploads.map((upload, index) => ({
        name: value.cast[index].name,
        image: upload.secure_url,
      }));

      // 6. Create movie
      const movie = new Movie({
        ...value,
        posterUrl,
        cast,
      });

      await movie.save({ runValidators: true });

      return res.status(201).json({
        success: true,
        message: "Movie created successfully",
        data: movie,
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to create movie",
      });
    }
  }
);
/**
 * PATCH /movies/:movieId
 * Admin only: update movie details
 */
movieRouter.patch('/movies/:movieId', adminAuth, adminMiddleware, async (req, res) => {
});


/**
 * PATCH /movies/:movieId/status
 * Admin only: update movie status (active / inactive / archived)
 */
movieRouter.patch('/movies/:movieId/status', adminAuth, adminMiddleware, async (req, res) => {
});


/**
 * DELETE /movies/:movieId
 * Admin only: delete a movie
 */
movieRouter.delete('/movies/:movieId', adminAuth, adminMiddleware, async (req, res) => {
});


/**
 * GET /movies/:movieId
 * Admin only: get movie details by ID
 */
movieRouter.get('/movies/:movieId', adminAuth, adminMiddleware, async (req, res) => {
});


/**
 * GET /movies
 * Admin only: get all movies
 */
movieRouter.get('/movies', adminAuth, adminMiddleware, async (req, res) => {
});


module.exports = movieRouter;