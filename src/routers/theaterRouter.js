const express=require('express');
const mongoose = require('mongoose');
const {adminAuth , adminMiddleware} = require("../middleware/adminAuth");

const theaterRouter=express.Router();

const {validateCreateTheater,validateUpdateTheater}=require("../validators/theaterValidator");
const Theater = require("../models/theaterModel");
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
theaterRouter.patch("/theaters/:id", adminAuth, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate update data
    const result = validateUpdateTheater(req);
    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        message: result.error || "Invalid update data"
      });
    }

    const updateData = result.value;
    console.log("Update data:", updateData);

    // 2. Fetch existing theater
    const theater = await Theater.findById(id);
    if (!theater) {
      return res.status(404).json({
        success: false,
        message: "Theater not found"
      });
    }

    // Allow re-activation of inactive theaters, block other updates if inactive
    if (!theater.isActive && !(updateData.isActive === true)) {
      return res.status(403).json({
        success: false,
        message: "Inactive theater can only be reactivated (set isActive: true)"
      });
    }

    // 3. Duplicate check (only if name/city changing)
    const query = { _id: { $ne: id } };
    if (updateData.name !== undefined) query.name = updateData.name.trim();
    if (updateData.city !== undefined) query.city = updateData.city.trim();
    if (updateData.address?.street !== undefined) query['address.street'] = updateData.address.street.trim();

    if (Object.keys(query).length > 1) { // has fields to check
      const duplicate = await Theater.findOne(query);
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Duplicate theater name/city/address combination exists"
        });
      }
    }

    // 4. Atomic update
    const updatedTheater = await Theater.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).exec();

    if (!updatedTheater) {
      return res.status(500).json({
        success: false,
        message: "Update failed"
      });
    }


    res.status(200).json({
      success: true,
      message: "Theater updated successfully",
      data: updatedTheater
    });

  } catch (err) {
    console.error("Update theater error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Server error during theater update"
    });
  }
});
 
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
theaterRouter.get('/theaters/:id', adminAuth, adminMiddleware,async (req, res) => {
  try {
    // 1. validate theater id
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater ID",
      });
    }

    // 2. check theater exists and active
    const theater = await Theater.findById(id);

    if (!theater) {
      return res.status(404).json({
        success: false,
        message: "Theater not found",
      });
    }

    if (!theater.isActive) {
      return res.status(400).json({
        success: false,
        message: "Theater is inactive",
      });
    }

    // 3. populate active screens (optimized)
    await theater.populate({
      path: "screens",
      match: { isActive: true },
      select: "name totalSeats screenType",
    });

    // 4. return response
    return res.status(200).json({
      success: true,
      message: "Theater details retrieved successfully",
      data: theater,
    });

  } catch (err) {
    console.error("Get Theater Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Server error during fetching theater details",
    });
  }
});

/**
 * GET /theaters
 * Public: list active theaters with optional ?city= and pagination
 */
theaterRouter.get("/theaters",(req,res)=>{
  res.send("List of theaters with optional city filter and pagination");
});


module.exports=theaterRouter;