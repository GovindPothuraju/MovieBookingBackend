require("dotenv").config();

const jwt = require('jsonwebtoken');
const Admin = require('../models/admin/AdminModel');

const adminAuth = async (req, res, next) => {
  try {

    // 1 get token
    const { token } = req.cookies;

    // 2 validate token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    // 3 verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4 find admin
    const admin = await Admin.findById(decoded.id);

    // 5 validate admin
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // 6 attach admin
    req.admin = admin;

    next();

  } catch (err) {

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = adminAuth;
