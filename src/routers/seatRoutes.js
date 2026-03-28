const express = require("express");
const mongoose = require("mongoose");
const seatRouter = express.Router();

const Seat = require("../models/seatSchema");
const Theater = require("../models/theaterModel");
const Screen = require("../models/screenModel");

const { adminAuth, adminMiddleware } = require("../middleware/adminAuth");

// ------------------- Screen Seat Management ------------------ //

/**
 * POST /screens/:screenId/layout
 * Admin only: generate seat layout for a screen (runs once)
 */
seatRouter.post("/screens/:screenId/layout", adminAuth, adminMiddleware , async (req, res) => {
  try{
    // 1. validate input
    const { screenId } = req.params;
    if(!mongoose.Types.ObjectId.isValid(screenId)){
      return res.status(400).json({
        success : false,
        message : "Invalid screen ID",
      })
    }
    // 2. check if screen exists 
    const screen = await Screen.findById(screenId);
    if(!screen){
      return res.status(404).json({
        success : false,
        message : "Screen not found",
      });
    }
    // 3. check if layout already exists (if yes, return error)
    const existingLayout = await Seat.exists({screenId });
    if(existingLayout){
      return res.status(400).json({
        success : false,
        message : "Seat layout already exists",
      });
    }

    // 4. get rows, columns, layout from req.body
    let { rows, columns, layout ={} } = req.body;
    rows= parseInt(rows);
    columns = parseInt(columns);

    if(!rows || !columns || rows < 1 || columns < 1 || rows > 26 || rows * columns > 500){
      return res.status(400).json({
        success : false,
        message : "Invalid rows or columns",
      });
    }
    // 5. Validate seat categories
    const allowedTypes = ["REGULAR", "VIP", "PREMIUM", "RECLINER"];
    for(let row in layout){
      if(!allowedTypes.includes(layout[row])){
        return res.status(400).json({
          success : false,
          message : `Invalid seat type for row ${row}`,
        });
      }
    }
    // 6. Generate seats
    const seats = [];
    for(let i=0;i<rows ;i++){
      const rowLetter = String.fromCharCode(65 + i); // A,B 
      for(let j=1;j<=columns;j++){
        const seatLabel = `${rowLetter}${j}`; // A1  B2 ...

        seats.push({
          screenId,
          row : rowLetter,
          column : j,
          seatLabel,
          category : layout[rowLetter] || "REGULAR",
        });
      }
    }
    // 7. insert seats in DB
    await Seat.insertMany(seats);

    // 8 main important step - mark screen documnet with seat generated = true 
    screen.seatsGenerated = true;
    await screen.save();

    // 9. return success response
    res.status(201).json({
      success : true,
      message : "Seat layout created successfully",
      data : {
        totalSeats : seats.length,
        rows,
        columns,
      }
    });
  } catch (err) {
      console.error("Create Seat Layout Error:", err);

      return res.status(500).json({
        success: false,
        message: err.message || "Failed to create seat layout",
      });
    }
});

/**
 * GET /screens/:screenId/seats
 * Adimn only: get all seats grouped by row ( it is admin purpose only)
 */
seatRouter.get("/screens/:screenId/seats", adminAuth, adminMiddleware ,async (req, res) => {
  try{
    // 1. validate input
    const { screenId } = req.params;
    if(!mongoose.Types.ObjectId.isValid(screenId)){
      return res.status(404).json({
        success : false,
        message : "Invalid screen ID",
      })
    }
    // 2. check if screen exists 
    const screen = await Screen.findById(screenId);
    if(!screen){
      return res.status(404).json({
        success : false,
        message : "Screen not found",
      });
    }
    // 3. get already generated seats
    const seats = await Seat.find({ screenId, isActive: true })
        .sort({ row: 1, column: 1 });
    if(seats.length == 0){
      return res.status(404).json({
        sucess:false,
        message: "No seats found for this screen" 
      })
    }
    // 3. group the seats by rows 
    const groupedSeats = {};
    seats.forEach((seat)=>{
      if(!groupedSeats[seat.row]){
        groupedSeats[seat.row]=[]
      }
      groupedSeats[seat.row].push({
          seatLabel: seat.seatLabel,
          category: seat.category,
        });
    });
    // 5. return response;
    return res.status(200).json({
        success: true,
        message: "Seats fetched successfully",
        data: {
          totalSeats: seats.length,
          seats: groupedSeats,
        },
      });
  }catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch seats",
    });
  }
});
/**
 * PUT /screens/:screenId/layout
 * Admin only: update seat layout (only if no active shows/bookings)
 */
seatRouter.put("/screens/:screenId/layout", async (req, res) => {});
/**
 * DELETE /screens/:screenId/layout
 * Admin only: delete seat layout (safe delete)
 */
seatRouter.delete("/screens/:screenId/layout", async (req, res) => {});


module.exports = seatRouter;