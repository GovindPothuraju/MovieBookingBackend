const validator = require("validator");

// 🎯 Allowed seat types (optional but recommended)
const SEAT_TYPES = ["REGULAR", "VIP"];

// 1️ SCREEN ID VALIDATOR
const validateScreenId = (req) => {
  try {
    const { screenId } = req.params;

    if (!validator.isMongoId(screenId)) {
      return { error: "Invalid screen ID" };
    }

    return { value: { screenId } };

  } catch (error) {
    return { error: "Validation failed" };
  }
};
const validateUpdateLayout = (req) => {
  try {
    const { screenId } = req.params;
    let { rows, columns, seatTypes } = req.body;

    // 🔹 Screen ID
    if (!validator.isMongoId(screenId)) {
      return { error: "Invalid screen ID" };
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
    if (rows * columns > 500) {
      return { error: "rows × columns cannot exceed 500" };
    }

    const maxRowChar = String.fromCharCode(64 + rows);

    if (rows > maxRowChar) {
      return { error: `Row ${rows} exceeds defined rows` };
    }

    // 🔹 Seat Types (optional)
    if (seatTypes !== undefined) {

      if (typeof seatTypes !== "object" || Array.isArray(seatTypes)) {
        return { error: "seatTypes must be an object mapping row → type" };
      }

      for (let rowKey in seatTypes) {

        // row must be A-Z
        if (!/^[A-Z]$/.test(rowKey)) {
          return { error: `Invalid row key: ${rowKey}` };
        }

        const type = seatTypes[rowKey];

        if (!SEAT_TYPES.includes(type)) {
          return { error: `Invalid seat type for row ${rowKey}` };
        }
      }
    }

    return {
      value: {
        screenId,
        rows,
        columns,
        seatTypes
      }
    };

  } catch (error) {
    return { error: "Validation failed" };
  }
};

module.exports = {
  validateScreenId,
  validateUpdateLayout
};