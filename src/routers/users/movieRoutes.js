const movieRouter = require('express').Router();
const Movie = require('../../models/admin/movieModel');
const Mongoose = require('mongoose');
const Show = require('../../models/admin/showModel');

const { userAuth} = require('../../middleware/userAuth');
/**
 * GET /movies
 * User: list all active movies available for booking
 */
movieRouter.get("/movies",userAuth , async (req, res) => {

  try {

    // 1. Parse query params
    let { page = 1, limit = 10 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    // 2. Validate params
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    if (isNaN(limit) || limit < 1 || limit > 50) {
      limit = 10;
    }

    // 3. Calculate skip
    const skip = (page - 1) * limit;

    // 4. Query
    const query = {
      status: "NOW_SHOWING",
      isActive: true,
    };

    // 5. Parallel DB calls
    const [movies, totalMovies] = await Promise.all([

      Movie.find(query)
        .select(
          "title genres languages releaseDate rating posterUrl slug"
        )
        .sort({ releaseDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Movie.countDocuments(query),
    ]);

    // 6. Response
    return res.status(200).json({
      success: true,

      data: movies,

      pagination: {
        total: totalMovies,
        currentPage: page,
        totalPages: Math.ceil(totalMovies / limit),
        limit,
        hasNextPage: page * limit < totalMovies,
        hasPrevPage: page > 1,
      },
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * GET /movies/:slug
 * User: get movie details by slug
 */
movieRouter.get("/movies/:slug", userAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    const movie = await Movie.findOne({
      slug,
      isActive: true,
      status: "NOW_SHOWING",
    })
      .select(
        "title description genres languages duration releaseDate rating cast crew posterUrl trailerUrl status slug"
      )
      .lean();

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Movie fetched successfully",
      data: movie,
    });
  } catch (err) {
    console.error("Get Movie Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});


module.exports = movieRouter;