const express = require("express");
const mongoose = require("mongoose");

const seatRouter = express.Router();

const Seat = require("../../models/admin/seatSchema");
const Screen = require("../../models/admin/screenModel");
const redisClient = require("../../config/redis");

const theaterAdminAuth = require("../../middleware/theaterAdminAuth");

const getTheaterId = (req) => {
  return req.user?.theaterId || req.theaterAdmin?.theaterId;
};

const ALLOWED_SEAT_TYPES = [
  "REGULAR",
  "VIP",
  "PREMIUM",
  "RECLINER",
];

/**
 * POST /theater-admin/screens/:screenId/layout
 * Theater Admin: create seat layout
 */
seatRouter.post( "/theater-admin/screens/:screenId/layout",theaterAdminAuth,
  async (req, res) => {
    try {
      const { screenId } = req.params;
      const theaterId = getTheaterId(req);
      const { layout = {} } = req.body;

      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID",
        });
      }

      if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(403).json({
          success: false,
          message: "Theater access not found",
        });
      }

      const screen = await Screen.findOne({
        _id: screenId,
        theaterId,
        isActive: true,
      });

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Screen not found",
        });
      }

      const existingLayout = await Seat.exists({
        screenId,
        isActive: true,
      });

      if (existingLayout) {
        return res.status(409).json({
          success: false,
          message: "Seat layout already exists",
        });
      }

      const rows = screen.rows;
      const columns = screen.columns;

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
          message: "Invalid screen rows or columns",
        });
      }

      for (const row in layout) {
        if (!/^[A-Z]$/.test(row)) {
          return res.status(400).json({
            success: false,
            message: `Invalid row ${row}`,
          });
        }

        const rowIndex = row.charCodeAt(0) - 65;

        if (rowIndex < 0 || rowIndex >= rows) {
          return res.status(400).json({
            success: false,
            message: `Row ${row} does not exist`,
          });
        }

        if (!ALLOWED_SEAT_TYPES.includes(layout[row])) {
          return res.status(400).json({
            success: false,
            message: `Invalid seat type for row ${row}`,
          });
        }
      }

      const seats = [];

      for (let i = 0; i < rows; i++) {
        const rowLetter = String.fromCharCode(65 + i);
        const category = layout[rowLetter] || "REGULAR";

        for (let j = 1; j <= columns; j++) {
          seats.push({
            screenId,
            row: rowLetter,
            column: j,
            seatLabel: `${rowLetter}${j}`,
            category,
            isActive: true,
          });
        }
      }

      await Seat.insertMany(seats);

      screen.seatsGenerated = true;
      screen.totalSeats = seats.length;

      await screen.save();
      // delelte seats from redis
      await redisClient.del(`screen:${screenId}:seat-counts`);

      return res.status(201).json({
        success: true,
        message: "Seat layout created successfully",
        data: {
          totalSeats: seats.length,
          rows,
          columns,
          seats,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to create seat layout",
      });
    }
  }
);

/**
 * GET /theater-admin/screens/:screenId/seats
 * Theater Admin: get seat layout
 */
seatRouter.get( "/theater-admin/screens/:screenId/seats", theaterAdminAuth,
  async (req, res) => {
    try {
      const { screenId } = req.params;
      const theaterId = getTheaterId(req);

      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID",
        });
      }

      if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(403).json({
          success: false,
          message: "Theater access not found",
        });
      }

      const screen = await Screen.findOne({
        _id: screenId,
        theaterId,
        isActive: true,
      }).lean();

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Screen not found",
        });
      }

      const seats = await Seat.find({
        screenId,
        isActive: true,
      })
        .sort({ row: 1, column: 1 })
        .lean();

      if (seats.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No seat layout found for this screen",
        });
      }

      const groupedSeats = {};

      seats.forEach((seat) => {
        if (!groupedSeats[seat.row]) {
          groupedSeats[seat.row] = [];
        }

        groupedSeats[seat.row].push({
          seatLabel: seat.seatLabel,
          category: seat.category,
          column: seat.column,
        });
      });

      return res.status(200).json({
        success: true,
        message: "Seats fetched successfully",
        data: {
          screen: {
            _id: screen._id,
            name: screen.name,
            screenType: screen.screenType,
            rows: screen.rows,
            columns: screen.columns,
            totalSeats: screen.totalSeats,
            seatsGenerated: screen.seatsGenerated,
          },
          totalSeats: seats.length,
          rows: screen.rows,
          columns: screen.columns,
          seats: groupedSeats,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to fetch seats",
      });
    }
  }
);

/**
 * PUT /theater-admin/screens/:screenId/layout
 * Theater Admin: update row categories
 */
seatRouter.put("/theater-admin/screens/:screenId/layout",theaterAdminAuth,async (req, res) => {
    try {
      const { screenId } = req.params;
      const theaterId = getTheaterId(req);
      const { layout = {} } = req.body;

      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID",
        });
      }

      if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(403).json({
          success: false,
          message: "Theater access not found",
        });
      }

      const screen = await Screen.findOne({
        _id: screenId,
        theaterId,
        isActive: true,
      });

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Screen not found",
        });
      }

      const existingSeats = await Seat.countDocuments({
        screenId,
        isActive: true,
      });

      if (existingSeats === 0) {
        return res.status(404).json({
          success: false,
          message: "No seat layout found for this screen",
        });
      }

      const rows = screen.rows;
      const columns = screen.columns;

      for (const row in layout) {
        if (!/^[A-Z]$/.test(row)) {
          return res.status(400).json({
            success: false,
            message: `Invalid row ${row}`,
          });
        }

        const rowIndex = row.charCodeAt(0) - 65;

        if (rowIndex < 0 || rowIndex >= rows) {
          return res.status(400).json({
            success: false,
            message: `Row ${row} does not exist`,
          });
        }

        if (!ALLOWED_SEAT_TYPES.includes(layout[row])) {
          return res.status(400).json({
            success: false,
            message: `Invalid seat type for row ${row}`,
          });
        }
      }

      for (let i = 0; i < rows; i++) {
        const rowLetter = String.fromCharCode(65 + i);
        const category = layout[rowLetter] || "REGULAR";

        await Seat.updateMany(
          {
            screenId,
            row: rowLetter,
            isActive: true,
          },
          {
            $set: {
              category,
            },
          }
        );
      }
      //  delete cache from redis
      await redisClient.del(`screen:${screenId}:seat-counts`);
      return res.status(200).json({
        success: true,
        message: "Seat layout updated successfully",
        data: {
          rows,
          columns,
          totalSeats: rows * columns,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to update seat layout",
      });
    }
  }
);

/**
 * DELETE /theater-admin/screens/:screenId/layout
 * Theater Admin: delete seat layout
 */
seatRouter.delete( "/theater-admin/screens/:screenId/layout", theaterAdminAuth,async (req, res) => {
    try {
      const { screenId } = req.params;
      const theaterId = getTheaterId(req);

      if (!mongoose.Types.ObjectId.isValid(screenId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid screen ID",
        });
      }

      if (!theaterId || !mongoose.Types.ObjectId.isValid(theaterId)) {
        return res.status(403).json({
          success: false,
          message: "Theater access not found",
        });
      }

      const screen = await Screen.findOne({
        _id: screenId,
        theaterId,
        isActive: true,
      });

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Screen not found",
        });
      }

      const seatsExist = await Seat.exists({
        screenId,
        isActive: true,
      });

      if (!seatsExist) {
        return res.status(404).json({
          success: false,
          message: "No seat layout found for this screen",
        });
      }

      await Seat.deleteMany({
        screenId,
      });

      screen.seatsGenerated = false;

      await screen.save();
      // delete cache from redis
      await redisClient.del(`screen:${screenId}:seat-counts`);
      return res.status(200).json({
        success: true,
        message: "Seat layout deleted successfully",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to delete seat layout",
      });
    }
  }
);

module.exports = seatRouter;