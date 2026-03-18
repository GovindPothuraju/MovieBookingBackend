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
    if(!admin){
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

module.exports={adminAuth};