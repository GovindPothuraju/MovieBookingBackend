const validator = require("validator");

const AMENITIES = [
  "PARKING",
  "FOOD_COURT",
  "WHEELCHAIR_ACCESS",
  "AC",
  "DOLBY",
  "IMAX"
];

const validateCreateTheater = (req) => {
  try {
    const {
      name,
      city,
      address = {},
      contactEmail,
      contactPhone,
      amenities
    } = req.body;

    // Name
    if (!name || name.trim().length < 2 || name.trim().length > 100) {
      return { error: "Theater name must be 2–100 characters" };
    }

    // City
    if (!city || city.trim().length > 60) {
      return { error: "City is required and must be ≤ 60 chars" };
    }

    // Pincode
    if (address.pincode && !/^\d{6}$/.test(address.pincode)) {
      return { error: "Pincode must be 6 digits" };
    }

    // Email
    if (contactEmail && !validator.isEmail(contactEmail)) {
      return { error: "Invalid email format" };
    }

    // Phone
    if (contactPhone && !/^\d{10}$/.test(contactPhone)) {
      return { error: "Phone must be exactly 10 digits" };
    }

    // Amenities
    if (amenities) {
      if (!Array.isArray(amenities)) {
        return { error: "Amenities must be an array" };
      }

      for (let item of amenities) {
        if (!AMENITIES.includes(item)) {
          return { error: `Invalid amenity: ${item}` };
        }
      }
    }

    return {
      value: {
        name: name.trim(),
        city: city.trim(),
        address,
        contactEmail: contactEmail
          ? validator.normalizeEmail(contactEmail)
          : undefined,
        contactPhone,
        amenities
      }
    };

  } catch (error) {
    return { error: "Validation failed" };
  }
};