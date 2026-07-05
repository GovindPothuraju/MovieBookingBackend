const validator = require("validator");

const SCREEN_TYPES = ['IMAX', '4DX', '2D', '3D']; // Consistent with schema

const validateCreateScreen = (req) => {
  try {
    const { theaterId } = req.params;
    const { name, screenType } = req.body;

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

    // Screen Type — required, must be a valid enum value
    if (!screenType || !SCREEN_TYPES.includes(screenType)) {
      return { error: `Screen type is required. Allowed: ${SCREEN_TYPES.join(', ')}` };
    }

    return {
      error: null,
      value: {
        theaterId,
        name: name.trim(),
        screenType
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