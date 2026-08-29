const express=require("express");
const mongoose=require("mongoose");

const screenRouter=express.Router();

const Screen=require("../../models/admin/screenModel");
const Theater=require("../../models/admin/theaterModel");
const theaterAdminAuth=require("../../middleware/theaterAdminAuth");

const SCREEN_TYPES=["STANDARD","IMAX","DOLBY","DOLBY_ATMOS","4DX","MX4D","OTHER"];


// 1. Create Screen - Theater Admin
screenRouter.post("/theater-admin/screens",theaterAdminAuth,async(req,res)=>{
  try{

    // 1. Get theater ID from authenticated Theater Admin
    const theaterId=req.theaterAdmin.theaterId;

    // 2. Validate theater ID
    if(!mongoose.Types.ObjectId.isValid(theaterId)){
      return res.status(400).json({
        success:false,
        message:"Invalid theater ID"
      });
    }

    // 3. Get request data
    const {name,screenType,totalSeats}=req.body;

    // 4. Validate screen name
    if(typeof name!=="string"||!name.trim()){
      return res.status(400).json({
        success:false,
        message:"Screen name is required"
      });
    }

    // 5. Normalize screen name
    const normalizedName=name.trim();

    // 6. Validate screen name length
    if(normalizedName.length<2||normalizedName.length>50){
      return res.status(400).json({
        success:false,
        message:"Screen name must be between 2 and 50 characters"
      });
    }

    // 7. Validate screen type
    if(!screenType||!SCREEN_TYPES.includes(screenType)){
      return res.status(400).json({
        success:false,
        message:"Invalid screen type"
      });
    }

    // 8. Validate total seats
    const seats=Number(totalSeats);

    if(!Number.isInteger(seats)||seats<1||seats>1000){
      return res.status(400).json({
        success:false,
        message:"Total seats must be an integer between 1 and 1000"
      });
    }

    // 9. Check theater
    const theater=await Theater.findById(theaterId).select("_id name isActive");

    if(!theater){
      return res.status(404).json({
        success:false,
        message:"Theater not found"
      });
    }

    // 10. Check theater status
    if(!theater.isActive){
      return res.status(403).json({
        success:false,
        message:"Cannot create screen because theater is inactive"
      });
    }

    // 11. Check duplicate active screen
    const existingScreen=await Screen.findOne({
      theaterId,
      name:normalizedName,
      isActive:true
    });

    if(existingScreen){
      return res.status(409).json({
        success:false,
        message:`Screen "${normalizedName}" already exists`
      });
    }

    // 12. Create screen
    const screen=await Screen.create({
      theaterId,
      name:normalizedName,
      screenType,
      totalSeats:seats,
      isActive:true
    });

    // 13. Response
    return res.status(201).json({
      success:true,
      message:"Screen created successfully",
      data:screen
    });

  }catch(err){

    console.error("Create Screen Error:",err);

    if(err.code===11000){
      return res.status(409).json({
        success:false,
        message:"A screen with this name already exists in your theater"
      });
    }

    if(err.name==="ValidationError"){
      return res.status(422).json({
        success:false,
        message:Object.values(err.errors)[0]?.message||"Invalid screen data"
      });
    }

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});


// 2. Get All Screens - Theater Admin
screenRouter.get("/theater-admin/screens",theaterAdminAuth,async(req,res)=>{
  try{

    // 1. Get theater ID from authenticated Theater Admin
    const theaterId=req.theaterAdmin.theaterId;

    // 2. Validate theater ID
    if(!mongoose.Types.ObjectId.isValid(theaterId)){
      return res.status(400).json({
        success:false,
        message:"Invalid theater ID"
      });
    }

    // 3. Check theater
    const theater=await Theater.findById(theaterId).select("_id name isActive");

    if(!theater){
      return res.status(404).json({
        success:false,
        message:"Theater not found"
      });
    }

    // 4. Get screens
    const screens=await Screen.find({
      theaterId,
      isActive:true
    })
    .select("_id name screenType totalSeats isActive createdAt updatedAt")
    .sort({createdAt:-1})
    .lean();

    // 5. Response
    return res.status(200).json({
      success:true,
      message:"Screens fetched successfully",
      data:screens
    });

  }catch(err){

    console.error("Get Screens Error:",err);

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});


// 3. Get Single Screen - Theater Admin
screenRouter.get("/theater-admin/screens/:screenId",theaterAdminAuth,async(req,res)=>{
  try{

    // 1. Get IDs
    const {screenId}=req.params;
    const theaterId=req.theaterAdmin.theaterId;

    // 2. Validate IDs
    if(!mongoose.Types.ObjectId.isValid(screenId)||!mongoose.Types.ObjectId.isValid(theaterId)){
      return res.status(400).json({
        success:false,
        message:"Invalid screen or theater ID"
      });
    }

    // 3. Find screen only inside authenticated theater
    const screen=await Screen.findOne({
      _id:screenId,
      theaterId,
      isActive:true
    }).lean();

    // 4. Check screen
    if(!screen){
      return res.status(404).json({
        success:false,
        message:"Screen not found"
      });
    }

    // 5. Response
    return res.status(200).json({
      success:true,
      message:"Screen details fetched successfully",
      data:screen
    });

  }catch(err){

    console.error("Get Screen Error:",err);

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});


// 4. Update Screen - Theater Admin
screenRouter.patch("/theater-admin/screens/:screenId",theaterAdminAuth,async(req,res)=>{
  try{

    // 1. Get IDs
    const {screenId}=req.params;
    const theaterId=req.theaterAdmin.theaterId;

    // 2. Validate IDs
    if(!mongoose.Types.ObjectId.isValid(screenId)||!mongoose.Types.ObjectId.isValid(theaterId)){
      return res.status(400).json({
        success:false,
        message:"Invalid screen or theater ID"
      });
    }

    // 3. Get request data
    const {name,screenType,totalSeats}=req.body;

    // 4. Prevent empty update
    if(name===undefined&&screenType===undefined&&totalSeats===undefined){
      return res.status(400).json({
        success:false,
        message:"At least one field is required for update"
      });
    }

    // 5. Check theater
    const theater=await Theater.findById(theaterId).select("_id isActive");

    if(!theater){
      return res.status(404).json({
        success:false,
        message:"Theater not found"
      });
    }

    // 6. Check theater status
    if(!theater.isActive){
      return res.status(403).json({
        success:false,
        message:"Cannot update screen because theater is inactive"
      });
    }

    // 7. Find screen inside theater
    const screen=await Screen.findOne({
      _id:screenId,
      theaterId,
      isActive:true
    });

    if(!screen){
      return res.status(404).json({
        success:false,
        message:"Screen not found"
      });
    }

    // 8. Update name
    if(name!==undefined){

      if(typeof name!=="string"||!name.trim()){
        return res.status(400).json({
          success:false,
          message:"Screen name must be a valid string"
        });
      }

      const normalizedName=name.trim();

      if(normalizedName.length<2||normalizedName.length>50){
        return res.status(400).json({
          success:false,
          message:"Screen name must be between 2 and 50 characters"
        });
      }

      const duplicateScreen=await Screen.findOne({
        _id:{$ne:screenId},
        theaterId,
        name:normalizedName,
        isActive:true
      });

      if(duplicateScreen){
        return res.status(409).json({
          success:false,
          message:`Screen "${normalizedName}" already exists`
        });
      }

      screen.name=normalizedName;
    }

    // 9. Update screen type
    if(screenType!==undefined){

      if(!SCREEN_TYPES.includes(screenType)){
        return res.status(400).json({
          success:false,
          message:"Invalid screen type"
        });
      }

      screen.screenType=screenType;
    }

    // 10. Update seats
    if(totalSeats!==undefined){

      const seats=Number(totalSeats);

      if(!Number.isInteger(seats)||seats<1||seats>1000){
        return res.status(400).json({
          success:false,
          message:"Total seats must be an integer between 1 and 1000"
        });
      }

      screen.totalSeats=seats;
    }

    // 11. Save
    await screen.save();

    // 12. Response
    return res.status(200).json({
      success:true,
      message:"Screen updated successfully",
      data:screen
    });

  }catch(err){

    console.error("Update Screen Error:",err);

    if(err.code===11000){
      return res.status(409).json({
        success:false,
        message:"A screen with this name already exists in your theater"
      });
    }

    if(err.name==="ValidationError"){
      return res.status(422).json({
        success:false,
        message:Object.values(err.errors)[0]?.message||"Invalid screen data"
      });
    }

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});


// 5. Delete Screen - Theater Admin
screenRouter.delete("/theater-admin/screens/:screenId",theaterAdminAuth,async(req,res)=>{
  try{

    // 1. Get IDs
    const {screenId}=req.params;
    const theaterId=req.theaterAdmin.theaterId;

    // 2. Validate IDs
    if(!mongoose.Types.ObjectId.isValid(screenId)||!mongoose.Types.ObjectId.isValid(theaterId)){
      return res.status(400).json({
        success:false,
        message:"Invalid screen or theater ID"
      });
    }

    // 3. Find active screen inside theater
    const screen=await Screen.findOne({
      _id:screenId,
      theaterId,
      isActive:true
    });

    if(!screen){
      return res.status(404).json({
        success:false,
        message:"Screen not found"
      });
    }

    // 4. Soft delete screen
    screen.isActive=false;

    await screen.save();

    // 5. Response
    return res.status(200).json({
      success:true,
      message:"Screen deleted successfully"
    });

  }catch(err){

    console.error("Delete Screen Error:",err);

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});

module.exports=screenRouter;