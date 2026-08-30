const mongoose = require("mongoose");

const ALLOWED_CATEGORIES = ["REGULAR", "VIP", "PREMIUM", "RECLINER"];
const ALLOWED_STATUS = ["SCHEDULED", "CANCELLED", "COMPLETED"];

const validateShowInput = (req) => {
  try {
    const { movieId, theaterId, screenId, showTime, priceMap } = req.body;

    // 1 check required fields
    if (!movieId || !theaterId || !screenId || !showTime || !priceMap) {
      return { error: "All fields are required" };
    }

    // 2 validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return { error: "Invalid movieId" };
    }

    if (!mongoose.Types.ObjectId.isValid(theaterId)) {
      return { error: "Invalid theaterId" };
    }

    if (!mongoose.Types.ObjectId.isValid(screenId)) {
      return { error: "Invalid screenId" };
    }

    // 3 validate showTime
    const showDate = new Date(showTime);

    if (isNaN(showDate.getTime())) {
      return { error: "Invalid showTime format" };
    }

    if (showDate <= new Date()) {
      return { error: "showTime must be in the future" };
    }

    // 4 validate priceMap (must be object)
    if (typeof priceMap !== "object" || Array.isArray(priceMap)) {
      return { error: "priceMap must be an object" };
    }

    const categories = Object.keys(priceMap);

    if (categories.length === 0) {
      return { error: "priceMap cannot be empty" };
    }

    // 5 validate each category
    for (let category of categories) {
      const price = priceMap[category];

      // category validation
      if (!ALLOWED_CATEGORIES.includes(category)) {
        return { error: `Invalid category: ${category}` };
      }

      // price validation
      if (typeof price !== "number" || isNaN(price) || price <= 0) {
        return { error: `Invalid price for category ${category}` };
      }
    }

    // 6 return cleaned value
    return {
      value: {
        movieId,
        theaterId,
        screenId,
        showTime: showDate,
        priceMap,
      },
    };

  } catch (err) {
    return {
      error: err.message || "Validation failed",
    };
  }
};


const validateShowUpdateInput = (req) => {
  try {
    const { priceMap, status } = req.body;

    // must have at least one field
    if (!priceMap && !status) {
      return { error: "At least one field (priceMap or status) is required" };
    }

    // validate priceMap
    if (priceMap) {
      if (typeof priceMap !== "object" || Array.isArray(priceMap)) {
        return { error: "priceMap must be an object" };
      }

      const categories = Object.keys(priceMap);

      if (categories.length === 0) {
        return { error: "priceMap cannot be empty" };
      }

      for (let category of categories) {
        if (!ALLOWED_CATEGORIES.includes(category)) {
          return { error: `Invalid category: ${category}` };
        }

        const price = priceMap[category];

        if (typeof price !== "number" || price <= 0) {
          return { error: `Invalid price for category ${category}` };
        }
      }
    }

    // validate status
    if (status) {
      if (!ALLOWED_STATUS.includes(status)) {
        return { error: "Invalid status value" };
      }
    }

    return {
      value: {
        priceMap,
        status,
      },
    };

  } catch (err) {
    return {
      error: err.message || "Validation failed",
    };
  }
};

const validateTheaterAdminShowInput = (req) => {
  try {
    const { movieId, screenId, showTime, priceMap } = req.body;

    if (!movieId || !mongoose.Types.ObjectId.isValid(movieId)) {
      return { error: "Invalid movie ID" };
    }

    if (!screenId || !mongoose.Types.ObjectId.isValid(screenId)) {
      return { error: "Invalid screen ID" };
    }

    if (!showTime || isNaN(new Date(showTime).getTime())) {
      return { error: "Valid show time is required" };
    }

    if (!priceMap || typeof priceMap !== "object") {
      return { error: "Price map is required" };
    }

    return {
      error: null,
      value: {
        movieId,
        screenId,
        showTime: new Date(showTime),
        priceMap,
      },
    };
  } catch (err) {
    return {
      error: "Validation failed",
    };
  }
};

module.exports = { validateShowInput ,validateShowUpdateInput , validateTheaterAdminShowInput};