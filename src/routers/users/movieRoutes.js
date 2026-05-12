const movieRouter = require('express').Router();
const Movie = require('../../models/admin/movieModel');

const { userAuth} = require('../../middleware/userAuth');
/**
 * GET /movies
 * User: list all active movies available for booking
 */
movieRouter.get('/movies', async (req, res) => {
  try {

    // 1 parse pagination query parameters
    let { page = 1, limit = 10 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    // 2 validate pagination parameters
    if (isNaN(page) || page < 1) page = 1;

    if (isNaN(limit) || limit < 1 || limit > 50) {
      limit = 10;
    }

    // 3 calculate skip
    const skip = (page - 1) * limit;

    // 4 find movies with pagination
    const movies = await Movie.find({
      status: "NOW_SHOWING"
    })
      .select('title genres languages releaseDate rating posterUrl')
      .skip(skip)
      .limit(limit)
      .sort({ releaseDate: -1 })
      .lean();

    // 5 count total movies
    const totalMovies = await Movie.countDocuments({
      status: "NOW_SHOWING"
    });

    // 6 pagination metadata
    const pagination = {
      total: totalMovies,
      currentPage: page,
      totalPages: Math.ceil(totalMovies / limit),
      limit,
      hasNextPage: page * limit < totalMovies,
      hasPrevPage: page > 1,
    };

    // 7 response
    return res.status(200).json({
      success: true,
      data: movies,
      pagination,
    });

  } catch (err) {

    console.error("Get movies error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
});


/**
 * GET /movies/:id
 * User: get movie details by ID
 */
movieRouter.get('/movies/:id', userAuth, async (req, res) => {});


/**
 * GET /movies/:id/shows
 * User: get all available shows for a movie
 */
movieRouter.get('/movies/:id/shows', userAuth, async (req, res) => {});

module.exports = movieRouter;