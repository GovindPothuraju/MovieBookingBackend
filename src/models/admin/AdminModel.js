const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const adminSchema = new mongoose.Schema(
  {
    name:{ type:String, required:true, trim:true,minlength:3,maxlength:50},
    email:{
          type:String,
          required:true,
          unique:true,
          lowercase:true,
          trim:true,
          index:true
      },

      password:{
          type:String,
          required:true,
          minlength:6,
          select:false
      },

      role:{
          type:String,
          enum:["ADMIN"],
          default:"ADMIN"
      },

      isActive:{
          type:Boolean,
          default:true
      },

      isVerified:{
          type:Boolean,
          default:true
      },

      lastLogin:{
          type:Date
      },

      otp:{
          type:String,
          default:null,
          select:false
      },

      otpExpires:{
          type:Date,
          default:null,
          select:false
      },

      otpAttempts:{
          type:Number,
          default:0
      }

  },
  {timestamps:true}
);

adminSchema.methods.getJWT = async function () {
  const user = this;

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );

  return token;
};

module.exports = mongoose.model("Admin", adminSchema);