const validator = require("validator");

const validateUserRegistration = (data) => {
  try {
    const { name, email, password, phone } = data;

    // Required fields
    if (!name || !email || !password) {
      throw new Error("All required fields must be provided");
    }

    // Name validation
    if (name.trim().length < 3) {
      throw new Error("Name must be at least 3 characters");
    }

    // Email validation
    if (!validator.isEmail(email)) {
      throw new Error("Invalid email format");
    }

    // Password validation
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Phone validation
    if (phone && !validator.isMobilePhone(phone, "en-IN")) {
      throw new Error("Invalid phone number");
    }

    // Sanitized object
    const sanitizedData = {
      name: validator.escape(name.trim()),
      email: validator.normalizeEmail(email),
      password: password
    };

    if (phone) {
      sanitizedData.phone = validator.escape(phone.trim());
    }

    return { value: sanitizedData };

  } catch (err) {
    return { error: err.message };
  }
};

module.exports = { validateUserRegistration };