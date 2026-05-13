const movieRouter = require('express').Router();
const Movie = require('../../models/admin/movieModel');
const Mongoose = require('mongoose');
const Show = require('../../models/admin/showModel');

const { userAuth} = require('../../middleware/userAuth');
/**
 * GET /movies
 * User: list all active movies available for booking
 */
movieRouter.get("/movies", async (req, res) => {

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
 * GET /movies/:id
 * User: get movie details by ID
 */
movieRouter.get("/movies/:id", userAuth, async (req, res) => {

  try {

    // 1. Extract ID
    const { id } = req.params;

    // 2. Validate ID
    if (!Mongoose.Types.ObjectId.isValid(id)) {

      return res.status(400).json({
        success: false,
        message: "Invalid movie ID",
      });
    }

    // 3. Find movie
    const movie = await Movie.findById(id)
      .select(
        "title description genres languages duration releaseDate rating cast crew posterUrl trailerUrl status slug"
      )
      .lean();
    // 4. Validate movie
    if (!movie || !movie.status === "NOW_SHOWING") {

      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    // 5. Response
    return res.status(200).json({
      success: true,
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

/**
 * GET /movies/:id/shows
 * User: get all available shows for a movie
 */
movieRouter.get('/movies/:id/shows', userAuth, async (req, res) => {
  try{
    // 1.extract details from query
    const {id} = req.params;
    // 2.validate id
    if(!Mongoose.Types.ObjectId.isValid(id)){
      return res.status(400).json({
        success: false,
        message: "Invalid movie ID"
      });
    }
    // 3.find movie
    const movie = await Movie.findById(id).select("title").lean();
    if(!movie){
      return res.status(404).json({
        success: false,
        message: "Movie not found"
      });
    }
     // 4. find all shows for the movie
    const shows = await Show.find({
      movieId: id,
    }).populate("theaterId", "name location")
    .populate("screenId", "name")
    .select("showTime priceMap status")
    .lean();

    // 5. response
    return res.status(200).json({
      success: true,
      data: shows,
      movieTitle: movie.title,
      totalShows: shows.length
    });
  } 
  catch(err){
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  } 
});

module.exports = movieRouter;