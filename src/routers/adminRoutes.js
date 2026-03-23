const express = require('express');
const adminRouter=express.Router();
const bcrypt = require("bcrypt");

// -- 🔐 ADMIN ROUTERS
// - POST /auth/signup      → Register new user
// - POST /auth/login       → Login user (JWT / session)
// - POST /auth/logOut     → Logout user (JWT / session)


const { validateAdminRegister } = require("../validators/adminValidator");
const { validateAdminLogin } = require("../validators/adminValidator");

const Admin = require("../models/AdminModel");

adminRouter.post("/admin/register", async (req, res) => {
  try {

    // STEP 0: Check if admin already exists
    const adminCount = await Admin.countDocuments();

    if (adminCount > 0) {
      return res.status(403).json({
        success: false,
        message: "Admin already exists. Registration is closed.",
      });
    }
    // 1️  Validate input
    const { error, value } = validateAdminRegister(req);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const { name, email, password } = value;

    // 2️  Check duplicate admin
    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "Admin already exists with this email",
      });
    }

    // 3️  Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4️ Create admin
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
    });

    const savedAdmin = await newAdmin.save();

    // 5️ Generate JWT
    const token = await savedAdmin.getJWT();

    const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE) || 7;
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: cookieExpireDays * 24 * 60 * 60 * 1000,
      expires: new Date(
        Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000
      )
    })

    // 6️  Response
    res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      Admin: {
        id: savedAdmin._id,
        name: savedAdmin.name,
        email: savedAdmin.email,
      },
    });
  } catch (err) {
    console.error("Admin Register Error:", err);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

adminRouter.post("/admin/login", async (req, res) => {
  try {
    // 1️ Validate input
    const { error, value } = validateAdminLogin(req);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const { email, password } = value;

    // 2️ Check if admin exists
    // Note: password field is select:false in the schema, so we need to include it explicitly here.
    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 3️ Check password
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 4️ Generate JWT
    const token = await admin.getJWT();

    // 5️ Set cookie
    const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE) || 7;

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: cookieExpireDays * 24 * 60 * 60 * 1000,
      expires: new Date(
        Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000
      ),
    });

    // 6️ Response
    res.status(200).json({
      success: true,
      message: "Login successful",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });

  } catch (err) {
    console.error("Admin Login Error:", err);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

adminRouter.post("/admin/logout", (req, res) => {
  res.cookie("token",null,{httpOnly:true,secure: true,
    sameSite: "None", expires: new Date(Date.now())});
  res.send("Logout Sucessful");
});



module.exports = adminRouter;