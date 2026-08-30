const express = require("express");
const mongoose = require("mongoose");
const seatRouter = express.Router();

const Seat = require("../../models/admin/seatSchema");
const Theater = require("../../models/admin/theaterModel");
const Screen = require("../../models/admin/screenModel");

const adminAuth = require("../../middleware/adminAuth");


// ------------------- Screen Seat Management ------------------ //


/**
 * POST /screens/:screenId/layout
 * Admin only: generate seat layout for a screen (runs once)
 */
seatRouter.post("/screens/:screenId/layout", adminAuth, async (req, res) => {
  try {
    const { screenId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(screenId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID"
      });
    }

    const screen = await Screen.findById(screenId);

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found"
      });
    }

    const existingLayout = await Seat.exists({ screenId });

    if (existingLayout) {
      return res.status(400).json({
        success: false,
        message: "Seat layout already exists"
      });
    }

    const { rows, columns } = screen;
    const { layout = {} } = req.body;

    if (
      !Number.isInteger(rows) ||
      !Number.isInteger(columns) ||
      rows < 1 ||
      columns < 1 ||
      rows > 26 ||
      rows * columns > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen rows or columns"
      });
    }

    const allowedTypes = [
      "REGULAR",
      "VIP",
      "PREMIUM",
      "RECLINER"
    ];

    for (const row in layout) {
      if (!/^[A-Z]$/.test(row)) {
        return res.status(400).json({
          success: false,
          message: `Invalid row ${row}`
        });
      }

      if (!allowedTypes.includes(layout[row])) {
        return res.status(400).json({
          success: false,
          message: `Invalid seat type for row ${row}`
        });
      }
    }

    const seats = [];

    for (let i = 0; i < rows; i++) {
      const rowLetter = String.fromCharCode(65 + i);

      for (let j = 1; j <= columns; j++) {
        seats.push({
          screenId,
          row: rowLetter,
          column: j,
          seatLabel: `${rowLetter}${j}`,
          category: layout[rowLetter] || "REGULAR"
        });
      }
    }

    await Seat.insertMany(seats);

    screen.seatsGenerated = true;
    screen.totalSeats = seats.length;

    await screen.save();

    return res.status(201).json({
      success: true,
      message: "Seat layout created successfully",
      data: {
        totalSeats: seats.length,
        rows,
        columns
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create seat layout"
    });
  }
});

/**
 * GET /screens/:screenId/seats
 * Adimn only: get all seats grouped by row ( it is admin purpose only)
 */
seatRouter.get("/screens/:screenId/seats", adminAuth, async (req, res) => {
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
seatRouter.put("/screens/:screenId/layout", adminAuth, async (req, res) => {
    try {
      // 1. validate screenId
      const { screenId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID",
        });
      }

      // 2. check screen exists
      const screen = await Screen.findById(screenId);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Screen not found",
        });
      }

      // 3. check screen active
      if (!screen.isActive) {
        return res.status(403).json({
          success: false,
          message: "Screen is inactive",
        });
      }

      // 4. check if active shows exist (IMPORTANT)
      // (Assuming Show model exists)
      // const activeShows = await Show.exists({ screenId });
      // if (activeShows) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "Cannot update layout, active shows exist",
      //   });
      // }

      // 4. validate input
      let { rows, columns, layout = {} } = req.body;

      rows = parseInt(rows);
      columns = parseInt(columns);

      if (!rows || !columns || rows < 1 || columns < 1 || rows > 26 || rows * columns > 500) {
        return res.status(400).json({
          success: false,
          message: "Invalid rows or columns",
        });
      }


      // 5. validate categories
      const allowedTypes = ["REGULAR", "VIP", "PREMIUM", "RECLINER"];

      for (let r in layout) {
        if (!allowedTypes.includes(layout[r])) {
          return res.status(400).json({
            success: false,
            message: `Invalid seat type for row ${r}`,
          });
        }
      }

      // 6. delete old seats
      await Seat.deleteMany({ screenId });

      // 7. generate new seats
      const seats = [];

      for (let i = 0; i < rows; i++) {
        const rowLetter = String.fromCharCode(65 + i);

        for (let j = 1; j <= columns; j++) {
          seats.push({
            screenId,
            row: rowLetter,
            column: j,
            seatLabel: `${rowLetter}${j}`,
            category: layout[rowLetter] || "REGULAR",
          });
        }
      }

      // 8. insert new seats
      await Seat.insertMany(seats);

      // 9. update screen
      screen.rows = rows;
      screen.columns = columns;
      screen.totalSeats = rows * columns;

      await screen.save();

      // 10. response
      return res.status(200).json({
        success: true,
        message: "Seat layout updated successfully",
        totalSeats: seats.length,
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Can't update seat",
      });
    }
  }
);
/**
 * DELETE /screens/:screenId/layout
 * Admin only: delete seat layout (safe delete)
 */
seatRouter.delete("/screens/:screenId/layout", adminAuth, async (req, res) => {
    try {
      // 1. validate screenId
      const { screenId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID",
        });
      }

      // 2. check screen exists
      const screen = await Screen.findById(screenId);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Screen not found",
        });
      }

      // 3. check screen active
      if (!screen.isActive) {
        return res.status(403).json({
          success: false,
          message: "Screen is inactive",
        });
      }

      // 4. check if seats exist
      const seatsExist = await Seat.exists({ screenId });

      if (!seatsExist) {
        return res.status(404).json({
          success: false,
          message: "No seat layout found for this screen",
        });
      }

      // 5. delete seats
      await Seat.deleteMany({ screenId });

      // 6. update screen flag
      screen.seatsGenerated = false;
      await screen.save();

      // 7. success response
      return res.status(200).json({
        success: true,
        message: "Seat layout deleted successfully",
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to delete layout",
      });
    }
  }
);

/**
 * GET /screens/:id
 * Admin only: Get screen details by ID
 */
seatRouter.get("/screens/:id", adminAuth, async (req, res) => {
  try {
    // 1. Validate screen ID
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid screen ID",
      });
    }

    // 2. Find screen
    const screen = await Screen.findById(id)
      .populate("theaterId", "name city")
      .lean();

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: "Screen not found",
      });
    }

    // 3. Return response
    return res.status(200).json({
      success: true,
      message: "Screen details fetched successfully",
      data: screen,
    });

  } catch (err) {
    console.error("Get Screen Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch screen details",
    });
  }
});

module.exports = seatRouter;