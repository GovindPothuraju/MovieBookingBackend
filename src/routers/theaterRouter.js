const express=require('express');
const {adminAuth , adminMiddleware} = require("../middleware/adminAuth");

const theaterRouter=express.Router();

const {validateCreateTheater}=require("../validators/theaterValidator");
const Theater = require("../models/TheaterModel");
/**
 * GET /theaters
 * Public: list active theaters with optional ?city= and pagination
 */
theaterRouter.get("/theaters",(req,res)=>{
  res.send("List of theaters with optional city filter and pagination");
});
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
 * GET /theaters/:id
 * Authenticated: get theater by ID (includes screens)
 */
theaterRouter.get('/theaters/:id',(req, res) => {
  
});
 
/**
 * PATCH /theaters/:id
 * Admin only: update theater fields
 */
theaterRouter.patch('/theaters/:id',(req, res) => {});
 
/**
 * DELETE /theaters/:id
 * Admin only: soft-delete (blocks if screens exist)
 */
theaterRouter.delete('/theaters/:id',(req, res) => {});

// SEAT ROUTES  (nested under /screens/:screenId)

/**
 * GET /theaters/:theaterId/screens
 * Authenticated: list screens for a theater
 */
theaterRouter.get('/theaters/:theaterId/screens',(req, res) => {});
 
/**
 * POST /theaters/:theaterId/screens
 * Admin only: create a screen under a theater
 */
theaterRouter.post('/theaters/:theaterId/screens',(req, res) => {});
 

module.exports=theaterRouter;