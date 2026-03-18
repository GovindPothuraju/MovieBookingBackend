const validator = require("validator");

const validateAdminRegister = (req) => {
  try {
    const { name, email, password } = req.body;

    // 1️ Check empty body
    if (!req.body || Object.keys(req.body).length === 0) {
      return { error: "Request body cannot be empty" };
    }

    // 2️ Allow only specific fields
    const allowedFields = ["name", "email", "password"];
    const updates = Object.keys(req.body);

    const isValidField = updates.every((key) =>
      allowedFields.includes(key)
    );

    if (!isValidField) {
      return { error: "Invalid fields in request body" };
    }

    // 3️  Required fields check
    if (!name || !email || !password) {
      return { error: "All fields are required" };
    }

    // 4️  Name validation
    const trimmedName = name.trim();

    if (trimmedName.length < 3) {
      return { error: "Name must be at least 3 characters" };
    }

    if (!validator.isAlpha(trimmedName.replace(/\s/g, ""))) {
      return { error: "Name must contain only letters" };
    }

    // 5️  Email validation
    const normalizedEmail = validator.normalizeEmail(email);

    if (!validator.isEmail(normalizedEmail)) {
      return { error: "Invalid email format" };
    }

    // 6️  Password validation
    if (password.length < 6) {
      return { error: "Password must be at least 6 characters" };
    }

    if (!/[A-Z]/.test(password)) {
      return { error: "Password must contain at least one uppercase letter" };
    }

    if (!/[a-z]/.test(password)) {
      return { error: "Password must contain at least one lowercase letter" };
    }

    if (!/[0-9]/.test(password)) {
      return { error: "Password must contain at least one number" };
    }

    // 7️ Sanitized output
    return {
      value: {
        name: trimmedName,
        email: normalizedEmail,
        password,
      },
    };

  } catch (error) {
    return { error: "Validation failed" };
  }
};


const validateAdminLogin = (req) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return { error: "Email and password are required" };
    }

    if (!validator.isEmail(email)) {
      return { error: "Invalid email format" };
    }

    return {
      value: {
        email: validator.normalizeEmail(email),
        password,
      },
    };
  } catch (error) {
    return { error: "Validation failed" };
  }
};

module.exports = {
  validateAdminRegister,
  validateAdminLogin,
};
