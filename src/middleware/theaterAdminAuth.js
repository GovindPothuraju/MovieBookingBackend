const jwt = require("jsonwebtoken");
const TheaterAdmin = require("../models/theater/TheaterAdmin");

const theaterAdminAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "THEATER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Theater Admin access required"
      });
    }

    const theaterAdmin = await TheaterAdmin.findById(decoded.id);

    if (!theaterAdmin) {
      return res.status(401).json({
        success: false,
        message: "Theater Admin not found"
      });
    }

    if (!theaterAdmin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Theater Admin account is inactive"
      });
    }

    if (!theaterAdmin.theaterId) {
      return res.status(403).json({
        success: false,
        message: "No theater assigned to this admin"
      });
    }

    req.theaterAdmin = theaterAdmin;

    next();
  } catch (err) {
    console.error("Theater Admin Auth Error:", err);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};

module.exports = theaterAdminAuth;