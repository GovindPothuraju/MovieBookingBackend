const express=require('express');
const {adminAuth , adminMiddleware} = require("../middleware/adminAuth");

const theaterRouter=express.Router();

const {validateCreateTheater}=require("../validators/theaterValidator");
const { validateCreateScreen}=require("../validators/screenValidators");
const Theater = require("../models/TheaterModel");
const Screen = require("../models/screenModel");

/**
 * POST /theaters
 * Admin only: create a new theater
 */
theaterRouter.post("/theaters", adminAuth, adminMiddleware, async (req, res) => {
  try{
    // 1. Validate request body
    const {isValid,message,value}=validateCreateTheater(req);

    if(!isValid){
      return res.status(400).json({
        success: false,
        message: message || "Invalid request data",
      });
    }

    const {name, city, address, contactEmail, contactPhone, amenities} = value;

    // 2. Check required fields (extra safety)
    if (!name || !city) {
      return res.status(400).json({
        success: false,
        message: "Name and city are required",
      });
    }

    // 4. Check duplicate theater (same name + city)
    const existingTheater = await Theater.findOne({name,city,"address.street":address.street });
    if(existingTheater){
      return res.status(409).json({
        success: false,
        message: "Theater already exists in this city",
      });
    }
    // 5. Create theater
    const newTheater = new Theater({
      name: name,
      city: city,
      address:address,
      contactEmail : contactEmail,
      contactPhone: contactPhone,
      amenities: amenities
    });
    //6. save to DB
    await newTheater.save();
    res.status(201).json({
      success: true,
      message: "Theater created successfully",
      data: newTheater
    });
  }catch(err){
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
 
 
/**
 * PATCH /theaters/:id
 * Admin only: update theater fields (partial updates supported)
 */
theaterRouter.patch("/theaters/:id" , adminAuth, adminMiddleware, async (req, res) =>{
  try{
     const {id} = req.params;
    // 1. validate request body 
    const result = validateCreateTheater(req);
    if (result.error || !result.isValid) {
      return res.status(400).json({
        success: false,
        message: result.error || result.message || "Invalid request data"
      });
    }
    const value = result.value;
    // 2. Check if the theater exists and is active 
    const theater= await Theater.findById(id);
    if(!theater){
      return res.status(400).json({
        success : false,
        message: "Theater not found"
      });
    }
    if(!theater.isActive){
      res.status(403).json({
        success: false,
        message: "Theater is inactive"
      });
    }
    // 3. ckeck for duplicate theater (same name + city) already exists in the databse
    const updateData = value;
    const checkForDuplicates = await Theater.findOne({
      _id: { $ne: id }, // excluding current theater
      name: updateData.name || theater.name,
      city: updateData.city || theater.city,
      "address.street": updateData.address?.street || theater.address.street
    });
    if(checkForDuplicates){
      return res.status(409).json({
        success: false,
        message: "Theater with this name already exists in the same city"
      });
    }
    // 4. Update theater with new data (only provided fields)
    const updatedTheater = await Theater.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    res.status(200).json({
      success: true,
      message: "Theater updated successfully",
      data: updatedTheater
    });

  } catch (err) {
    console.error("Update theater error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during update"
    });
  }
})
 
/**
 * DELETE /theaters/:id
 * Admin only: soft-delete (blocks if screens exist)
 */
theaterRouter.delete('/theaters/:id', adminAuth, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find theater
    const theater = await Theater.findById(id);
    if (!theater) {
      return res.status(404).json({
        success: false,
        message: "Theater not found"
      });
    }

    // 2. Check if already soft-deleted
    if (!theater.isActive) {
      return res.status(409).json({
        success: false,
        message: "Theater is already inactive/deleted"
      });
    }

    // 3. Check for active screens (import Screen needed)
    const activeScreensCount = await Screen.countDocuments({
      theaterId: id,
      isActive: true
    });
    if (activeScreensCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete theater - ${activeScreensCount} active screen(s) exist`
      });
    }

    // 4. Soft-delete theater
    const deletedTheater = await Theater.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Theater soft-deleted successfully",
      data: {
        id: deletedTheater._id,
        message: "Theater is now inactive"
      }
    });

  } catch (err) {
    console.error("Delete theater error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Server error during deletion"
    });
  }
});

/**
 * GET /theaters/:id
 * Authenticated: get theater by ID (includes screens)
 */
theaterRouter.get('/theaters/:id',(req, res) => {
  
});

/**
 * GET /theaters
 * Public: list active theaters with optional ?city= and pagination
 */
theaterRouter.get("/theaters",(req,res)=>{
  res.send("List of theaters with optional city filter and pagination");
});


module.exports=theaterRouter;