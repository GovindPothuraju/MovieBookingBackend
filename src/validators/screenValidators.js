const validator = require("validator");

const MAX_SEATS = 500;

const SCREEN_TYPES = ["STANDARD", "IMAX", "DOLBY", "4DX", "DRIVE_IN"];


const validateCreateScreen = (req) => {
  try {
    const { theaterId } = req.params;
    let { name, rows, columns, screenType } = req.body;

    // 🔹 Theater ID
    if (!validator.isMongoId(theaterId)) {
      return { error: "Invalid theater ID" };
    }

    // 🔹 Name
    if (!name || name.trim().length === 0) {
      return { error: "Screen name is required" };
    }

    if (name.trim().length > 50) {
      return { error: "Screen name cannot exceed 50 characters" };
    }

    // 🔹 Rows
    if (rows === undefined || rows === null) {
      return { error: "Rows is required" };
    }

    rows = Number(rows);

    if (!Number.isInteger(rows) || rows < 1 || rows > 26) {
      return { error: "Rows must be between 1 and 26" };
    }

    // 🔹 Columns
    if (columns === undefined || columns === null) {
      return { error: "Columns is required" };
    }

    columns = Number(columns);

    if (!Number.isInteger(columns) || columns < 1) {
      return { error: "Columns must be a positive integer" };
    }

    // 🔹 Max seats constraint
    if (rows * columns > MAX_SEATS) {
      return { error: `rows × columns cannot exceed ${MAX_SEATS}` };
    }

    // 🔹 Screen Type
    if (screenType !== undefined) {
      if (!SCREEN_TYPES.includes(screenType)) {
        return { error: "Invalid screen type" };
      }
    }

    return {
      value: {
        theaterId,
        name: name.trim(),
        rows,
        columns,
        screenType
      }
    };

  } catch (error) {
    return { error: "Validation failed" };
  }
};
const validateTheaterId = (req) => {
  try {
    const { theaterId } = req.params;

    if (!validator.isMongoId(theaterId)) {
      return { error: "Invalid theater ID" };
    }

    return { value: { theaterId } };

  } catch (error) {
    return { error: "Validation failed" };
  }
};

module.exports = {
  validateCreateScreen,
  validateTheaterId
};