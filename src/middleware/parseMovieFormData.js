const parseMovieFormData = (req, res, next) => {
  try {
    // Parse Cast
    if (req.body.cast) {
      if (!Array.isArray(req.body.cast)) {
        req.body.cast = [req.body.cast];
      }

      req.body.cast = req.body.cast.map((member) =>
        typeof member === "string" ? JSON.parse(member) : member
      );
    }

    // Parse Crew
    if (req.body.crew) {
      if (!Array.isArray(req.body.crew)) {
        req.body.crew = [req.body.crew];
      }

      req.body.crew = req.body.crew.map((member) =>
        typeof member === "string" ? JSON.parse(member) : member
      );
    }

    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Invalid cast or crew format.",
    });
  }
};

module.exports = parseMovieFormData;