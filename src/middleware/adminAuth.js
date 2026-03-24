require("dotenv").config();

const jwt=require("jsonwebtoken");
const Admin = require("../models/AdminModel");

const adminAuth  = async (req, res, next) => {
  try {
    const {token} = req.cookies;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please login to access this resource",
      });
    }

    const cookie= jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(cookie.id);
    if(!admin || !admin.isActive){
      return res.status(401).json({
        success: false,
        message: "Admin not found. Invalid token.",
      });
    }

    req.user=admin;
    next();
  }
  catch (err) {
    console.error("Admin Auth Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// ADMIN ROLE CHECK (OPTIONAL BUT CLEAN)
const adminMiddleware = (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    next();

  } catch (err) {
    console.error("Admin Middleware Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


module.exports={adminAuth , adminMiddleware};