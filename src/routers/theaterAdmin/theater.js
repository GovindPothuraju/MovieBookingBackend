const express=require("express");
const mongoose=require("mongoose");
const theaterRouter=express.Router();

const Theater=require("../../models/admin/theaterModel");
const theaterAdminAuth=require("../../middleware/theaterAdminAuth");

const THEATER_AMENITIES=["PARKING","FOOD COURT","WHEELCHAIR ACCESSIBLE","AC","DOLBY ATMOS","IMAX","ONLINE BOOKING","WIFI"];


// 1. Get Theater Details - Theater Admin
theaterRouter.get("/theater-admin/theater",theaterAdminAuth,async(req,res)=>{
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

    // 3. Find theater
    const theater=await Theater.findById(theaterId).lean();

    // 4. Check theater exists
    if(!theater){
      return res.status(404).json({
        success:false,
        message:"Theater not found"
      });
    }

    // 5. Response
    return res.status(200).json({
      success:true,
      message:"Theater details fetched successfully",
      data:theater
    });

  }catch(err){

    console.error("Get Theater Error:",err);

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});


// 2. Update Theater Details - Theater Admin
theaterRouter.put("/theater-admin/theater",theaterAdminAuth,async(req,res)=>{
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

    // 3. Get theater data
    const {
      name,
      city,
      address,
      contactEmail,
      contactPhone,
      amenities
    }=req.body;

    // 4. Validate required fields
    if(!name||!city||!address||!contactEmail||!contactPhone){
      return res.status(400).json({
        success:false,
        message:"All required theater fields must be provided"
      });
    }

    // 5. Validate amenities
    if(amenities!==undefined){

      if(!Array.isArray(amenities)){
        return res.status(400).json({
          success:false,
          message:"Amenities must be an array"
        });
      }

      const invalidAmenities=amenities.filter(
        amenity=>!THEATER_AMENITIES.includes(amenity)
      );

      if(invalidAmenities.length>0){
        return res.status(400).json({
          success:false,
          message:"Invalid theater amenities",
          invalidAmenities
        });
      }
    }

    // 6. Normalize data
    const normalizedName=name.trim();
    const normalizedCity=city.trim().toLowerCase();
    const normalizedAddress=address.trim();
    const normalizedEmail=contactEmail.toLowerCase().trim();
    const normalizedPhone=contactPhone.trim();

    // 7. Validate phone
    if(!/^\d{10}$/.test(normalizedPhone)){
      return res.status(400).json({
        success:false,
        message:"Phone must be 10 digits"
      });
    }

    // 8. Validate email
    if(!/^\S+@\S+\.\S+$/.test(normalizedEmail)){
      return res.status(400).json({
        success:false,
        message:"Invalid email format"
      });
    }

    // 9. Check theater exists
    const theater=await Theater.findById(theaterId);

    if(!theater){
      return res.status(404).json({
        success:false,
        message:"Theater not found"
      });
    }

    // 10. Check duplicate theater
    const duplicateTheater=await Theater.findOne({
      _id:{$ne:theaterId},
      name:normalizedName,
      city:normalizedCity,
      address:normalizedAddress
    });

    if(duplicateTheater){
      return res.status(409).json({
        success:false,
        message:"Another theater with the same details already exists"
      });
    }

    // 11. Update theater
    theater.name=normalizedName;
    theater.city=normalizedCity;
    theater.address=normalizedAddress;
    theater.contactEmail=normalizedEmail;
    theater.contactPhone=normalizedPhone;

    if(amenities!==undefined){
      theater.amenities=amenities;
    }

    // 12. Save theater
    await theater.save();

    // 13. Response
    return res.status(200).json({
      success:true,
      message:"Theater updated successfully",
      data:theater
    });

  }catch(err){

    console.error("Update Theater Error:",err);

    // 14. Handle duplicate index
    if(err.code===11000){
      return res.status(409).json({
        success:false,
        message:"Another theater with the same details already exists"
      });
    }

    return res.status(500).json({
      success:false,
      message:"Internal Server Error"
    });
  }
});

module.exports=theaterRouter;