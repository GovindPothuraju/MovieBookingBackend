const mongoose = require("mongoose");

const validateLockSeatsRequest = ({ showId, seats }) => {
  if (!showId || !mongoose.Types.ObjectId.isValid(showId)) {
    return "Invalid showId.";
  }

  if (!Array.isArray(seats) || seats.length === 0) {
    return "Please select at least one seat.";
  }

  if (seats.length > 10) {
    return "You can book a maximum of 10 seats.";
  }

  for (const seat of seats) {
    if (!seat._id ||  !mongoose.Types.ObjectId.isValid(seat._id) ||!seat.seatLabel) {
      return "Invalid seat data.";
    }
  }
  // check for unique seats
  const uniqueSeats = new Set(seats.map((seat) => seat._id));

  if (uniqueSeats.size !== seats.length) {
    return "Duplicate seats selected.";
  }

  return null;
};

// validations/booking.validation.js

const Show = require("../../models/admin/showModel");
const Seat = require("../../models/admin/seatSchema");

const validateShowAndSeats = async (showId, seatIds) => {
  // Check show exists
  const show = await Show.findById(showId).select("screenId");

  if (!show) {
    return {
      isValid: false,
      status: 404,
      message: "Show not found.",
    };
  }

  // Fetch requested seats
  const seatDocuments = await Seat.find({
    _id: { $in: seatIds },
  });

  // Ensure every seat exists
  if (seatDocuments.length !== seatIds.length) {
    return {
      isValid: false,
      status: 400,
      message: "One or more selected seats do not exist.",
    };
  }

  // Ensure every seat belongs to the show's screen
  const invalidSeat = seatDocuments.find(
    (seat) => seat.screenId.toString() !== show.screenId.toString()
  );

  if (invalidSeat) {
    return {
      isValid: false,
      status: 400,
      message: `${invalidSeat.seatLabel} does not belong to this show.`,
    };
  }

  return {
    isValid: true,
    show,
    seats: seatDocuments,
  };
};


const Booking  = require("../../models/bookingSchema");

const validateBookedSeats = async (showId , seatDocuments)=>{
    //get all set labels
    const seatLabels = seatDocuments.map((seat)=>seat.seatLabel);
    // for o(1) operation
    const requestedSeats = new Set(seatLabels);

    //check if any one seat is alredy booked
    const existingBookings = await Booking.find({showId,bookingStatus:"CONFIRMED", seats :{$in:seatLabels}}).select("seats").lean();
    if(existingBookings.length > 0){
      const bookedSeats = new Set();

      existingBookings.forEach((booking)=>{
        booking.seats.forEach((seat)=>{
          if(requestedSeats.has(seat)){
            bookedSeats.add(seat);
          }
        })
      })
      return {
        isValid: false,
        status: 409,
        message: `Seat(s) ${[...bookedSeats].join(", ")} already booked.`,
      };
    }
    return {
      isValid:true
    }
}

module.exports = {validateLockSeatsRequest,validateShowAndSeats,validateBookedSeats};