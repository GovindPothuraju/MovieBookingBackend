const express=require("express");
const bcrypt=require("bcrypt");
const crypto=require("crypto");

const theaterAdminAuthRouter=express.Router();

const TheaterAdmin=require("../../models/theater/TheaterAdmin");
const theaterAdminAuth=require("../../middleware/theaterAdminAuth");

const sendEmail=require("../../utils/emailTemplates/sendEmail");
const {getLoginOTPTemplate}=require("../../utils/emailTemplates/emailTemplate");

const redisClient=require("../../config/redis");

const OTP_EXPIRY=300;
const MAX_OTP_ATTEMPTS=5;

const generateOTP=()=>{
  return crypto.randomInt(100000,1000000).toString();
};

const getOTPKey=(email)=>{
  return `theater-admin:otp:${email}`;
};

const getOTPAttemptsKey=(email)=>{
  return `theater-admin:otp-attempts:${email}`;
};


// 1. Theater Admin Login
theaterAdminAuthRouter.post("/theater-admin/login",async(req,res)=>{
  try{

    // 1. Get login data
    const {email,password}=req.body;

    // 2. Validate input
    if(!email||!password){
      return res.status(400).json({
        success:false,
        message:"Email and password are required"
      });
    }

    // 3. Normalize email
    const normalizedEmail=email.toLowerCase().trim();

    // 4. Find Theater Admin
    const theaterAdmin=await TheaterAdmin.findOne({
      email:normalizedEmail
    }).select("+password");

    if(!theaterAdmin){
      return res.status(401).json({
        success:false,
        message:"Invalid credentials"
      });
    }

    // 5. Check account status
    if(!theaterAdmin.isActive){
      return res.status(403).json({
        success:false,
        message:"Your account is inactive"
      });
    }

    // 6. Verify password
    const isPasswordValid=await bcrypt.compare(
      password,
      theaterAdmin.password
    );

    if(!isPasswordValid){
      return res.status(401).json({
        success:false,
        message:"Invalid credentials"
      });
    }

    // 7. Generate OTP
    const otp=generateOTP();

    // 8. Hash OTP before storing in Redis
    const hashedOTP=await bcrypt.hash(
      otp,
      Number(process.env.BCRYPT_SALT_ROUNDS)||10
    );

    // 9. Store OTP in Redis
    await redisClient.setEx(
      getOTPKey(normalizedEmail),
      OTP_EXPIRY,
      hashedOTP
    );

    // 10. Store OTP attempts in Redis
    await redisClient.setEx(
      getOTPAttemptsKey(normalizedEmail),
      OTP_EXPIRY,
      "0"
    );

    // 11. Send OTP
    await sendEmail({
      to:theaterAdmin.email,
      subject:"Your Theater Admin Login OTP",
      text:`Your OTP is ${otp}. This OTP is valid for 5 minutes.`,
      html:getLoginOTPTemplate(otp)
    });

    // 12. Response
    return res.status(200).json({
      success:true,
      message:"OTP sent successfully",
      email:theaterAdmin.email
    });

  }catch(err){

    console.error("Theater Admin Login Error:",err);

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});


// 2. Verify Theater Admin OTP
theaterAdminAuthRouter.post(
  "/theater-admin/verify-otp",
  async (req, res) => {
    try {
      console.log("\n========================================");
      console.log("THEATER ADMIN OTP VERIFICATION STARTED");
      console.log("========================================");

      console.log("1. Request body:");
      console.log(req.body);

      const { email, otp } = req.body;

      if (!email || !otp) {
        console.log("ERROR: Email or OTP missing");

        return res.status(400).json({
          success: false,
          message: "Email and OTP are required.",
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const normalizedOTP = otp.toString().trim();

      console.log("\n2. Normalized values:");
      console.log("Email:", normalizedEmail);
      console.log("OTP:", normalizedOTP);
      console.log("OTP type:", typeof normalizedOTP);

      const theaterAdmin = await TheaterAdmin.findOne({
        email: normalizedEmail,
      });

      console.log("\n3. Theater Admin lookup:");
      console.log("Admin found:", !!theaterAdmin);

      if (!theaterAdmin) {
        console.log("ERROR: Theater Admin not found");

        return res.status(404).json({
          success: false,
          message: "Theater Admin not found.",
        });
      }

      console.log("Admin ID:", theaterAdmin._id.toString());
      console.log("Admin email:", theaterAdmin.email);
      console.log(
        "Admin theaterId:",
        theaterAdmin.theaterId?.toString()
      );
      console.log("Admin active:", theaterAdmin.isActive);

      if (!theaterAdmin.isActive) {
        console.log("ERROR: Admin account inactive");

        return res.status(403).json({
          success: false,
          message: "Your account is inactive.",
        });
      }

      if (!theaterAdmin.theaterId) {
        console.log("ERROR: No theater assigned");

        return res.status(403).json({
          success: false,
          message: "No theater assigned to this admin.",
        });
      }

      const otpKey = getOTPKey(normalizedEmail);
      const attemptsKey = getOTPAttemptsKey(normalizedEmail);

      console.log("\n4. Redis keys:");
      console.log("OTP key:", otpKey);
      console.log("Attempts key:", attemptsKey);

      const hashedOTP = await redisClient.get(otpKey);
      const attemptsValue = await redisClient.get(attemptsKey);

      console.log("\n5. Redis values:");
      console.log("Has OTP hash:", !!hashedOTP);
      console.log("OTP hash:", hashedOTP);
      console.log("Attempts value:", attemptsValue);

      if (!hashedOTP) {
        console.log("ERROR: No OTP found in Redis");

        return res.status(400).json({
          success: false,
          message: "OTP expired or not found. Please login again.",
        });
      }

      const attempts = Number(attemptsValue || 0);

      console.log("\n6. Attempts:");
      console.log("Current attempts:", attempts);
      console.log("Maximum attempts:", MAX_OTP_ATTEMPTS);

      if (attempts >= MAX_OTP_ATTEMPTS) {
        console.log("ERROR: Maximum OTP attempts reached");

        await redisClient.del(otpKey);
        await redisClient.del(attemptsKey);

        console.log("OTP deleted from Redis");
        console.log("Attempts deleted from Redis");

        return res.status(429).json({
          success: false,
          message: "Too many invalid OTP attempts. Please login again.",
        });
      }

      console.log("\n7. Starting bcrypt comparison:");
      console.log("Entered OTP:", normalizedOTP);
      console.log("Redis hash:", hashedOTP);

      const isOTPValid = await bcrypt.compare(
        normalizedOTP,
        hashedOTP
      );

      console.log("bcrypt result:", isOTPValid);

      if (!isOTPValid) {
        const newAttempts = attempts + 1;

        console.log("\n8. OTP INVALID");
        console.log("Old attempts:", attempts);
        console.log("New attempts:", newAttempts);

        if (newAttempts >= MAX_OTP_ATTEMPTS) {
          await redisClient.del(otpKey);
          await redisClient.del(attemptsKey);

          console.log("Maximum attempts reached");
          console.log("OTP deleted");
          console.log("Attempts deleted");

          return res.status(429).json({
            success: false,
            message:
              "Too many invalid OTP attempts. Please login again.",
          });
        }

        await redisClient.setEx(
          attemptsKey,
          OTP_EXPIRY,
          newAttempts.toString()
        );

        console.log(
          "Updated attempts in Redis:",
          newAttempts
        );

        return res.status(401).json({
          success: false,
          message: "Invalid OTP.",
          attemptsRemaining:
            MAX_OTP_ATTEMPTS - newAttempts,
        });
      }

      console.log("\n8. OTP VALID");

      await redisClient.del(otpKey);
      await redisClient.del(attemptsKey);

      console.log("OTP deleted from Redis");
      console.log("Attempts deleted from Redis");

      theaterAdmin.lastLogin = new Date();

      await theaterAdmin.save();

      console.log("\n9. Last login updated");

      const token = await theaterAdmin.getJWT();

      console.log("\n10. JWT generated:");
      console.log("Token generated:", !!token);

      const cookieExpireDays =
        parseInt(process.env.COOKIE_EXPIRE, 10) || 7;

      const maxAgeMs =
        cookieExpireDays * 24 * 60 * 60 * 1000;

      console.log("\n11. Cookie configuration:");
      console.log("Cookie expire days:", cookieExpireDays);
      console.log("Max age:", maxAgeMs);

      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: maxAgeMs,
        path: "/",
      });

      console.log("Token cookie set");

      console.log("\n========================================");
      console.log("THEATER ADMIN OTP VERIFICATION SUCCESS");
      console.log("========================================\n");

      return res.status(200).json({
        success: true,
        message: "Login successful.",
        theaterAdmin: {
          id: theaterAdmin._id,
          name: theaterAdmin.name,
          email: theaterAdmin.email,
          theaterId: theaterAdmin.theaterId,
          mustChangePassword:
            theaterAdmin.mustChangePassword,
        },
      });
    } catch (err) {
      console.error("\n========================================");
      console.error("THEATER ADMIN OTP VERIFICATION ERROR");
      console.error("========================================");
      console.error(err);
      console.error("Message:", err.message);
      console.error("Stack:", err.stack);

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  }
);


// 3. Resend Theater Admin OTP
theaterAdminAuthRouter.post("/theater-admin/resend-otp",async(req,res)=>{
  try{

    // 1. Get email
    const {email}=req.body;

    // 2. Validate email
    if(!email){
      return res.status(400).json({
        success:false,
        message:"Email is required"
      });
    }

    // 3. Normalize email
    const normalizedEmail=email.toLowerCase().trim();

    // 4. Find Theater Admin
    const theaterAdmin=await TheaterAdmin.findOne({
      email:normalizedEmail
    });

    if(!theaterAdmin){
      return res.status(404).json({
        success:false,
        message:"Theater Admin not found"
      });
    }

    // 5. Check account status
    if(!theaterAdmin.isActive){
      return res.status(403).json({
        success:false,
        message:"Your account is inactive"
      });
    }

    // 6. Generate OTP
    const otp=generateOTP();

    // 7. Hash OTP
    const hashedOTP=await bcrypt.hash(
      otp,
      Number(process.env.BCRYPT_SALT_ROUNDS)||10
    );

    // 8. Replace OTP in Redis
    await redisClient.setEx(
      getOTPKey(normalizedEmail),
      OTP_EXPIRY,
      hashedOTP
    );

    // 9. Reset attempts
    await redisClient.setEx(
      getOTPAttemptsKey(normalizedEmail),
      OTP_EXPIRY,
      "0"
    );

    // 10. Send OTP
    await sendEmail({
      to:theaterAdmin.email,
      subject:"Your Theater Admin Login OTP",
      text:`Your OTP is ${otp}. This OTP is valid for 5 minutes.`,
      html:getLoginOTPTemplate(otp)
    });

    // 11. Response
    return res.status(200).json({
      success:true,
      message:"OTP resent successfully"
    });

  }catch(err){

    console.error("Theater Admin Resend OTP Error:",err);

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});


// 4. Theater Admin Logout
theaterAdminAuthRouter.post("/theater-admin/logout",(req,res)=>{
  try{

    // 1. Clear authentication cookie
    res.cookie("token",null,{
      httpOnly:true,
      secure:true,
      sameSite:"none",
      expires:new Date(0),
      path:"/"
    });

    // 2. Response
    return res.status(200).json({
      success:true,
      message:"Logout successful"
    });

  }catch(err){

    console.error("Theater Admin Logout Error:",err);

    return res.status(500).json({
      success:false,
      message:"Logout failed"
    });
  }
});


// 5. Theater Admin Profile
theaterAdminAuthRouter.get("/theater-admin/profile",theaterAdminAuth,async(req,res)=>{
  try{

    // 1. Response
    return res.status(200).json({
      success:true,
      message:"Profile fetched successfully",
      data:{
        id:req.theaterAdmin._id,
        name:req.theaterAdmin.name,
        email:req.theaterAdmin.email,
        phoneNumber:req.theaterAdmin.phoneNumber,
        theaterId:req.theaterAdmin.theaterId,
        isActive:req.theaterAdmin.isActive,
        lastLogin:req.theaterAdmin.lastLogin,
        mustChangePassword:req.theaterAdmin.mustChangePassword
      }
    });

  }catch(err){

    console.error("Theater Admin Profile Error:",err);

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});


// 6. Theater Admin Change Password
theaterAdminAuthRouter.post("/theater-admin/change-password",theaterAdminAuth,async(req,res)=>{
  try{

    // 1. Get passwords
    const {currentPassword,newPassword}=req.body;

    // 2. Validate input
    if(!currentPassword||!newPassword){
      return res.status(400).json({
        success:false,
        message:"Current password and new password are required"
      });
    }

    // 3. Validate password length
    if(newPassword.length<6){
      return res.status(400).json({
        success:false,
        message:"New password must be at least 6 characters"
      });
    }

    // 4. Get password
    const theaterAdmin=await TheaterAdmin.findById(
      req.theaterAdmin._id
    ).select("+password");

    if(!theaterAdmin){
      return res.status(404).json({
        success:false,
        message:"Theater Admin not found"
      });
    }

    // 5. Verify current password
    const isPasswordValid=await bcrypt.compare(
      currentPassword,
      theaterAdmin.password
    );

    if(!isPasswordValid){
      return res.status(401).json({
        success:false,
        message:"Current password is incorrect"
      });
    }

    // 6. Check old and new password
    const samePassword=await bcrypt.compare(
      newPassword,
      theaterAdmin.password
    );

    if(samePassword){
      return res.status(400).json({
        success:false,
        message:"New password must be different from current password"
      });
    }

    // 7. Hash new password
    theaterAdmin.password=await bcrypt.hash(
      newPassword,
      Number(process.env.BCRYPT_SALT_ROUNDS)||10
    );

    // 8. Update password status
    theaterAdmin.mustChangePassword=false;

    await theaterAdmin.save();

    // 9. Response
    return res.status(200).json({
      success:true,
      message:"Password changed successfully"
    });

  }catch(err){

    console.error("Theater Admin Change Password Error:",err);

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});


module.exports=theaterAdminAuthRouter;