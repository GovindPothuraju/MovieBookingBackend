const express=require("express");
const mongoose=require("mongoose");

const screenRouter=express.Router();

const Screen=require("../../models/admin/screenModel");
const Theater=require("../../models/admin/theaterModel");
const theaterAdminAuth=require("../../middleware/theaterAdminAuth");

const SCREEN_TYPES=["IMAX","4DX","2D","3D"];


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
    const {name,screenType,rows,columns}=req.body;

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

    // 8. Validate rows
    const screenRows=Number(rows);

    if(!Number.isInteger(screenRows)||screenRows<1||screenRows>26){
      return res.status(400).json({
        success:false,
        message:"Rows must be an integer between 1 and 26"
      });
    }

    // 9. Validate columns
    const screenColumns=Number(columns);

    if(!Number.isInteger(screenColumns)||screenColumns<1){
      return res.status(400).json({
        success:false,
        message:"Columns must be a positive integer"
      });
    }

    // 10. Validate total seats
    const totalSeats=screenRows*screenColumns;

    if(totalSeats>500){
      return res.status(400).json({
        success:false,
        message:"Total seats cannot exceed 500"
      });
    }

    // 11. Check theater
    const theater=await Theater.findById(theaterId).select("_id name isActive");

    if(!theater){
      return res.status(404).json({
        success:false,
        message:"Theater not found"
      });
    }

    // 12. Check theater status
    if(!theater.isActive){
      return res.status(403).json({
        success:false,
        message:"Cannot create screen because theater is inactive"
      });
    }

    // 13. Check duplicate active screen
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

    // 14. Create screen
    const screen=await Screen.create({
      theaterId,
      name:normalizedName,
      screenType,
      rows:screenRows,
      columns:screenColumns,
      totalSeats,
      isActive:true
    });

    // 15. Response
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
    .select("_id name screenType rows columns totalSeats isActive seatsGenerated createdAt updatedAt")
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
    const {name,screenType,rows,columns}=req.body;

    // 4. Prevent empty update
    if(name===undefined&&screenType===undefined&&rows===undefined&&columns===undefined){
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

    // 8. Prevent layout change after seats are generated
    if(screen.seatsGenerated&&(rows!==undefined||columns!==undefined)){
      return res.status(409).json({
        success:false,
        message:"Rows and columns cannot be changed after seats are generated"
      });
    }

    // 9. Update name
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

    // 10. Update screen type
    if(screenType!==undefined){

      if(!SCREEN_TYPES.includes(screenType)){
        return res.status(400).json({
          success:false,
          message:"Invalid screen type"
        });
      }

      screen.screenType=screenType;
    }

    // 11. Update rows
    if(rows!==undefined){

      const screenRows=Number(rows);

      if(!Number.isInteger(screenRows)||screenRows<1||screenRows>26){
        return res.status(400).json({
          success:false,
          message:"Rows must be an integer between 1 and 26"
        });
      }

      screen.rows=screenRows;
    }

    // 12. Update columns
    if(columns!==undefined){

      const screenColumns=Number(columns);

      if(!Number.isInteger(screenColumns)||screenColumns<1){
        return res.status(400).json({
          success:false,
          message:"Columns must be a positive integer"
        });
      }

      screen.columns=screenColumns;
    }

    // 13. Validate total seats
    if(rows!==undefined||columns!==undefined){

      const totalSeats=screen.rows*screen.columns;

      if(totalSeats>500){
        return res.status(400).json({
          success:false,
          message:"Total seats cannot exceed 500"
        });
      }

      screen.totalSeats=totalSeats;
    }

    // 14. Save
    await screen.save();

    // 15. Response
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

    // 4. Prevent deletion if seats are generated
    if(screen.seatsGenerated){
      return res.status(409).json({
        success:false,
        message:"Screen cannot be deleted after seats are generated"
      });
    }

    // 5. Soft delete screen
    screen.isActive=false;

    await screen.save();

    // 6. Response
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