const validator = require("validator");

const GENRES = [
  "ACTION",
  "DRAMA",
  "COMEDY",
  "THRILLER",
  "HORROR",
  "ROMANCE",
  "SCI-FI",
];

const STATUS = ["UPCOMING", "NOW_SHOWING", "ARCHIVED"];

const validateCreateMovie = (req) => {
  try {
    let {
      title,
      description,
      genres = [],
      languages = [],
      duration,
      releaseDate,
      rating,
      cast = [],
      crew=[],
      trailerUrl,
      status,
    } = req.body;

    // 🔥 FIX: Parse JSON (for form-data)
    try {
      if (typeof genres === "string") genres = JSON.parse(genres);
      if (typeof languages === "string") languages = JSON.parse(languages);
      if (typeof cast === "string") cast = JSON.parse(cast);
      if (typeof crew === "string") crew = JSON.parse(crew);
    } catch (err) {
      return { error: "Invalid JSON format in genres/languages/cast/crew" };
    }

    // 1. Title
    if (!title || title.trim().length === 0) {
      return { error: "Title is required" };
    }
    if (title.length > 150) {
      return { error: "Title must be ≤ 150 characters" };
    }

    // 2. Description
    if (!description || description.trim().length === 0) {
      return { error: "Description is required" };
    }
    if (description.length > 2000) {
      return { error: "Description too long" };
    }

    // 3. Genres
    if (!Array.isArray(genres)) {
      return { error: "Genres must be an array" };
    }
    if (genres.length === 0) {
      return { error: "At least one genre required" };
    }
    for (let g of genres) {
      if (!GENRES.includes(g)) {
        return { error: `Invalid genre: ${g}` };
      }
    }

    // 4. Languages
    if (!Array.isArray(languages)) {
      return { error: "Languages must be an array" };
    }
    languages = languages.map((lang) =>
      lang.trim().toUpperCase()
    );

    // 5. Duration
    duration = Number(duration);
    if (isNaN(duration) || duration < 1 || duration > 400) {
      return { error: "Duration must be between 1–400 minutes" };
    }

    // 6. Release Date
    if (!releaseDate || !validator.isDate(releaseDate)) {
      return { error: "Invalid release date" };
    }

    // 7. Rating (optional)
    if (rating !== undefined) {
      rating = Number(rating);
      if (isNaN(rating) || rating < 0 || rating > 10) {
        return { error: "Rating must be between 0–10" };
      }
    }

    // 8. Cast
    if (!Array.isArray(cast)) {
      return { error: "Cast must be an array" };
    }
    for (let actor of cast) {
      if (!actor.name || actor.name.trim().length === 0) {
        return { error: "Cast member must have valid name" };
      }
    }

    // 9. Crew
    if (!Array.isArray(crew)) {
      return { error: "Crew must be an array" };
    }
    for (let member of crew) {
      if (!member.name || member.name.trim().length === 0) {
        return { error: "Crew member must have valid name" };
      }
    }
    // 9. Trailer URL
    if (trailerUrl && !validator.isURL(trailerUrl)) {
      return { error: "Invalid trailer URL" };
    }

    // 10. Status
    if (status && !STATUS.includes(status)) {
      return { error: "Invalid movie status" };
    }

    // ✅ FINAL CLEAN VALUE
    return {
      value: {
        title: title.trim(),
        description: description.trim(),
        genres,
        languages,
        duration,
        releaseDate: new Date(releaseDate),
        rating,
        cast,
        crew,
        trailerUrl,
        status: status || "UPCOMING",
      },
    };

  } catch (err) {
    return { error: "Validation failed" };
  }
};

const validateUpdateMovie = (req) => {
  try {
    let {
      title,
      description,
      genres = [],
      languages = [],
      duration,
      releaseDate,
      rating,
      cast = [],
      crew = [],
      trailerUrl,
      status,
    } = req.body;

    // Parse JSON arrays (form-data)
    try {
      if (typeof genres === "string") genres = JSON.parse(genres);
      if (typeof languages === "string") languages = JSON.parse(languages);
      if (typeof cast === "string") cast = JSON.parse(cast);
      if (typeof crew === "string") crew = JSON.parse(crew);
    } catch (err) {
      return { error: "Invalid JSON format in genres/languages/cast/crew" };
    }

    // 1. Title (optional)
    if (title !== undefined) {
      title = title.trim();
      if (title.length === 0) {
        return { error: "Title cannot be empty" };
      }
      if (title.length > 150) {
        return { error: "Title must be ≤ 150 characters" };
      }
    }

    // 2. Description (optional)
    if (description !== undefined) {
      description = description.trim();
      if (description.length === 0) {
        return { error: "Description cannot be empty" };
      }
      if (description.length > 2000) {
        return { error: "Description too long" };
      }
    }

    // 3. Genres (optional)
    if (genres !== undefined) {
      if (!Array.isArray(genres)) {
        return { error: "Genres must be an array" };
      }
      for (let g of genres) {
        if (!GENRES.includes(g)) {
          return { error: `Invalid genre: ${g}` };
        }
      }
    }

    // 4. Languages (optional)
    if (languages !== undefined) {
      if (!Array.isArray(languages)) {
        return { error: "Languages must be an array" };
      }
      languages = languages.map((lang) => lang.trim().toUpperCase());
    }

    // 5. Duration (optional)
    if (duration !== undefined) {
      duration = Number(duration);
      if (isNaN(duration) || duration < 1 || duration > 400) {
        return { error: "Duration must be between 1–400 minutes" };
      }
    }

    // 6. Release Date (optional)
    if (releaseDate !== undefined) {
      if (!validator.isDate(releaseDate)) {
        return { error: "Invalid release date" };
      }
    }

    // 7. Rating (optional)
    if (rating !== undefined) {
      rating = Number(rating);
      if (isNaN(rating) || rating < 0 || rating > 10) {
        return { error: "Rating must be between 0–10" };
      }
    }

    // 8. Cast (optional)
    if (cast !== undefined) {
      if (!Array.isArray(cast)) {
        return { error: "Cast must be an array" };
      }
      for (let actor of cast) {
        if (!actor.name || actor.name.trim().length === 0) {
          return { error: "Cast member must have valid name" };
        }
      }
    }

    // 9. Crew (optional)
    if (crew !== undefined) {
      if (!Array.isArray(crew)) {
        return { error: "Crew must be an array" };
      }
      for (let member of crew) {
        if (!member.name || member.name.trim().length === 0) {
          return { error: "Crew member must have valid name" };
        }
      }
    }

    // 10. Trailer URL (optional)
    if (trailerUrl !== undefined && trailerUrl !== "") {
      if (!validator.isURL(trailerUrl)) {
        return { error: "Invalid trailer URL" };
      }
    }

    // 11. Status (optional)
    if (status !== undefined && !STATUS.includes(status)) {
      return { error: "Invalid movie status" };
    }

    //  Return only provided fields
    const value = {};
    if (title !== undefined) value.title = title;
    if (description !== undefined) value.description = description;
    if (genres !== undefined) value.genres = genres;
    if (languages !== undefined) value.languages = languages;
    if (duration !== undefined) value.duration = duration;
    if (releaseDate !== undefined) value.releaseDate = new Date(releaseDate);
    if (rating !== undefined) value.rating = rating;
    if (cast !== undefined) value.cast = cast;
    if (crew !== undefined) value.crew = crew;
    if (trailerUrl !== undefined) value.trailerUrl = trailerUrl;
    if (status !== undefined) value.status = status;

    if (Object.keys(value).length === 0) {
      return { error: "No valid fields to update" };
    }

    return { value };

  } catch (err) {
    return { error: "Validation failed" };
  }
};

module.exports = {
  validateCreateMovie,
  validateUpdateMovie
};