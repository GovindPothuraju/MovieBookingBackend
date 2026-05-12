const jwt = require('jsonwebtoken');
const User = require('../models/users/userModel');

const userAuth = async (req, res, next) => {
  try {

    // 1 get token from cookies
    const { token } = req.cookies;

    // 2 check token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please login to continue",
      });
    }

    // 3 verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4 find user
    const user = await User.findById(decoded.id);

    // 5 check user exists
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    // 6 attach user to request
    req.user = user;

    next();

  } catch (err) {

    // token expired / invalid
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = {userAuth};