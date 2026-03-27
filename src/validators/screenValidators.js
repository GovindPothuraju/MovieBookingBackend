const validator = require("validator");

const MAX_SEATS = 500;
const SCREEN_TYPES = ["2D","STANDARD", "IMAX", "DOLBY", "4DX", "DRIVE_IN"]; // Consistent with schema

const validateCreateScreen = (req) => {
  try {
    const { theaterId } = req.params;
    const { name, rows, columns, screenType } = req.body;

    // Theater ID
    if (!theaterId || !validator.isMongoId(theaterId)) {
      return { error: "Invalid theater ID" };
    }

    // Name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { error: "Screen name is required" };
    }
    if (name.trim().length > 50) {
      return { error: "Screen name cannot exceed 50 characters" };
    }

    // Rows
    const parsedRows = Number(rows);
    if (isNaN(parsedRows) || !Number.isInteger(parsedRows) || parsedRows < 1 || parsedRows > 26) {
      return { error: "Rows must be an integer between 1 and 26" };
    }

    // Columns
    const parsedColumns = Number(columns);
    if (isNaN(parsedColumns) || !Number.isInteger(parsedColumns) || parsedColumns < 1) {
      return { error: "Columns must be a positive integer" };
    }

    // Max seats constraint
    if (parsedRows * parsedColumns > MAX_SEATS) {
      return { error: `Total seats (rows × columns) cannot exceed ${MAX_SEATS}` };
    }

    // Screen Type
    if (screenType !== undefined && screenType !== null) {
      if (!SCREEN_TYPES.includes(screenType)) {
        return { error: `Invalid screen type. Allowed: ${SCREEN_TYPES.join(', ')}` };
      }
    }

    return {
      error: null,
      value: {
        theaterId,
        name: name.trim(),
        rows: parsedRows,
        columns: parsedColumns,
        screenType: screenType || 'STANDARD'
      }
    };

  } catch (error) {
    return { error: "Validation failed" };
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
        ...(updateData.screenType !== undefined && { screenType: updateData.screenType }),
        ...(updateData.isActive !== undefined && { isActive: updateData.isActive })
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
