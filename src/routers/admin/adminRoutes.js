const express = require('express');
const adminRouter=express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");

// -- 🔐 ADMIN ROUTERS
// - POST /auth/signup      → Register new user
// - POST /auth/login       → Login user (JWT / session)
// - POST /auth/logOut     → Logout user (JWT / session)


const { validateAdminRegister } = require("../../validators/adminValidator");
const { validateAdminLogin } = require("../../validators/adminValidator");
const {getLoginOTPTemplate} = require("../../utils/emailTemplate");

const Admin = require("../../models/admin/AdminModel");
const sendEmail = require("../../utils/sendEmail");
const adminAuth = require("../../middleware/adminAuth");


adminRouter.post("/admin/register", async (req, res) => {
  try {

    // step 0 : Check if admin already exists
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
    
    // 65  Response
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

    // 4 Genearate OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // 5 hash OTP
    const hashedOtp = await bcrypt.hash(otp, Number(process.env.BCRYPT_SALT_ROUNDS))

    // 6 save OTP and its expiry in the admin document

    admin.otp = hashedOtp;
    admin.otpExpires = new Date(Date.now() + 5*60*1000); // valid only 5 minutes
    admin.otpAttempts = 0; //reset attempts on new Login
    await admin.save();

    // 7. send otp to admin email
    await sendEmail({
      to: admin.email,
      subject: "Your Admin Login OTP",
      text: `Your OTP is ${otp}. This OTP is valid for 5 minutes.`,
      html: getLoginOTPTemplate(otp),
    });
    // 8. Response
    return res.status(200).json({
        success: true,
        message: "OTP sent successfully.",
        email: admin.email
    });

  } catch (err) {
    console.error("Admin Login Error:", err);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

adminRouter.post("/admin/verify-otp" ,async (req,res)=>{
  try{
    const {email,otp} = req.body;
    // 1. validate input
    if(!email || !otp){
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required.",
      });
    }

    // 2. find admin by email
    const admin = await Admin.findOne({email}).select("+otp +otpExpires +otpAttempts");
    if(!admin){
      return res.status(404).json({
        success: false,
        message: "Admin not found.",
      });
    }

    // 3. cheeck if OTP exists
    if (!admin.otp || !admin.otpExpires) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please login again.",
      });
    }
    // 4. check if OTP is expired
    if(admin.otpExpires < new Date()){
      // reset otp if expires otherwise it remains in the databse
      admin.otp = null;
      admin.otpExpires = null;
      admin.otpAttempts = 0;

      await admin.save();
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    if (admin.otpAttempts >= 5) {
        return res.status(429).json({
            success: false,
            message: "Too many invalid OTP attempts. Please login again.",
        });
    }

    // 5. compare OTP
    const isOTPValid = await bcrypt.compare(otp,admin.otp);
    if(!isOTPValid){
      // increment otpAttempts
      admin.otpAttempts += 1;
      await admin.save();
      return res.status(401).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    // 6. clear OTP
    admin.otp = null;
    admin.otpExpires = null;
    admin.otpAttempts = 0;

    // 7. last login
    admin.lastLogin = new Date();
    await admin.save();

     // 7. Generate jwt
    const token = await user.getJWT();

    // 8. Set cookie
    const cookieExpireDays =
      parseInt(process.env.COOKIE_EXPIRE) || 7;

    const maxAgeMs =
      cookieExpireDays * 24 * 60 * 60 * 1000;

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,          // required for sameSite:none
      sameSite: "none",      // required for cross-origin cookies
      maxAge: maxAgeMs,
      expires: new Date(Date.now() + maxAgeMs),
      path: "/"
    });
    
    // 10. Success
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  }catch(err){
    console.error("Verify OTP Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
})

adminRouter.post("/admin/resend-otp", async (req,res)=>{
  try{
    // 1. validate input
    const {email} = req.body;
    if(!email){
      return res.status(400).json({
        success:false,
        message : "Email is required"
      })
    }

    // 2. find admin by email
    const admin = await Admin.findOne({email});
    if(!admin){
      return res.status(404).json({
        success:false,
        message : "Admin not found"
      })
    }

    // 3. generate new OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = await bcrypt.hash(otp, Number(process.env.BCRYPT_SALT_ROUNDS))

    // 4. save new otp  
    admin.otp = hashedOtp;
    admin.otpExpires = new Date(Date.now() + 5*60*1000); // valid only 5 minutes

    await admin.save();

    // 5. send otp to admin email
    await sendEmail({
      to: admin.email,
      subject: "Your Admin Login OTP",
      text: `Your OTP is ${otp}. This OTP is valid for 5 minutes.`,
      html: getLoginOTPTemplate(otp),
    });

    return res.status(200).json({
      success:true,
      message: "OTP resent successfully",
    });

  }catch(err){
    return res.status(500).json({
      success:false,
      message: "Internal server error",
      error : err.message
    })
  }
})

adminRouter.post("/admin/logout", (req, res) => {
  try{
    res.cookie("token",null,{httpOnly:true,secure: true,sameSite: "None", expires: new Date(Date.now())});
    
    return res.status(200).json({
      success: true,
      message: "Logout successful"
    });
  }catch(err){
    return res.status(500).json({
      success: false,
      message: "Logout failed"
    });
  }
});

adminRouter.get("/admin/profile", adminAuth , async (req,res)=>{
  try{

    return res.status(200).json({
      sucess : true,
      message: "Profile fetched successfully",
      data:{
        "id" : req.admin._id,
        "name" : req.admin.name,
        "email" : req.admin.email,
        "lastLogin" : req.admin.lastLogin
      }
    })
  }catch(err){
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
})



module.exports = adminRouter;