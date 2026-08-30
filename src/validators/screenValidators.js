const validator = require("validator");

const SCREEN_TYPES = ['IMAX', '4DX', '2D', '3D']; // Consistent with schema

const validateCreateScreen = (req) => {
  try {
    const { theaterId } = req.params;
    const { name, screenType, rows, columns } = req.body;

    if (!theaterId || !validator.isMongoId(theaterId)) {
      return { error: "Invalid theater ID", value: null };
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return { error: "Screen name is required", value: null };
    }

    if (name.trim().length < 2) {
      return { error: "Screen name must be at least 2 characters", value: null };
    }

    if (name.trim().length > 50) {
      return { error: "Screen name cannot exceed 50 characters", value: null };
    }

    if (!screenType || !SCREEN_TYPES.includes(screenType)) {
      return {
        error: `Screen type is required. Allowed: ${SCREEN_TYPES.join(", ")}`,
        value: null
      };
    }

    if (rows === undefined || rows === null || rows === "") {
      return { error: "Rows are required", value: null };
    }

    const parsedRows = Number(rows);

    if (!Number.isInteger(parsedRows)) {
      return { error: "Rows must be an integer", value: null };
    }

    if (parsedRows < 1 || parsedRows > 26) {
      return { error: "Rows must be between 1 and 26", value: null };
    }

    if (columns === undefined || columns === null || columns === "") {
      return { error: "Columns are required", value: null };
    }

    const parsedColumns = Number(columns);

    if (!Number.isInteger(parsedColumns)) {
      return { error: "Columns must be an integer", value: null };
    }

    if (parsedColumns < 1) {
      return { error: "Columns must be at least 1", value: null };
    }

    if (parsedRows * parsedColumns > 500) {
      return { error: "Total seats cannot exceed 500", value: null };
    }

    return {
      error: null,
      value: {
        theaterId,
        name: name.trim(),
        screenType,
        rows: parsedRows,
        columns: parsedColumns
      }
    };
  } catch (error) {
    return {
      error: "Validation failed",
      value: null
    };
  }
};

const validatePartialScreenUpdate = (req) => {
  try {
    const { screenId } = req.params;
    const { screenType, isActive } = req.body;

    // Screen ID validation
    if (!screenId || !validator.isMongoId(screenId)) {
      return { error: "Invalid screen ID" };
    }

    // No data to update
    if (Object.keys(req.body).length === 0) {
      return { error: "No update data provided" };
    }

    const updateData = {};

    // screenType: optional, enum
    if (screenType !== undefined && screenType !== null) {
      if (typeof screenType !== 'string' || !SCREEN_TYPES.includes(screenType)) {
        return { error: `Invalid screenType. Allowed: ${SCREEN_TYPES.join(', ')}` };
      }
      updateData.screenType = screenType;
    }

    // isActive: optional, boolean
    if (isActive !== undefined && isActive !== null) {
      if (typeof isActive !== 'boolean') {
        return { error: "isActive must be a boolean" };
      }
      updateData.isActive = isActive;
    }

    // Ensure at least one valid field
    if (Object.keys(updateData).length === 0) {
      return { error: "No valid fields to update (screenType or isActive)" };
    }

    return {
      error: null,
      value: {
        screenId,
        ...updateData
      }
    };

  } catch (error) {
    return { error: "Validation failed" };
  }
};

module.exports = {
  validateCreateScreen,
  validatePartialScreenUpdate
};