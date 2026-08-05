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
  const show = await Show.findById(showId).select(
    "screenId status showTime"
  );

  if (!show) {
    return {
      isValid: false,
      status: 404,
      message: "Show not found.",
    };
  }

  if (show.status !== "SCHEDULED") {
    return {
      isValid: false,
      status: 400,
      message: "Show is not available for booking.",
    };
  }

  if (show.showTime <= new Date()) {
    return {
      isValid: false,
      status: 400,
      message: "Show has already started.",
    };
  }
  // Fetch requested seats
  const seatDocuments = await Seat.find(
    {
      _id: { $in: seatIds },
      isActive: true,
    },
    {
      seatLabel: 1,
      category: 1,
      screenId: 1,
    }
  );
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
    const existingBookings = await Booking.find({
      showId,
      bookingStatus: "CONFIRMED",
      paymentStatus: "SUCCESS",
      seats: { $in: seatLabels },
    })
      .select("seats")
      .lean();
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


const validateCreateBookingRequest = ({ showId, paymentId }) => {
  if (!showId || !mongoose.Types.ObjectId.isValid(showId)) {
    return "Invalid showId.";
  }

  if (!paymentId) {
    return "PaymentId is required.";
  }

  return null;
};


const validateBookingDetails = async (showId, seatLabels) => {
  // Fetch show
  const show = await Show.findById(showId);

  if (!show) {
    return {
      isValid: false,
      status: 404,
      message: "Show not found.",
    };
  }

  if (show.status !== "SCHEDULED") {
    return {
      isValid: false,
      status: 400,
      message: "Show is not available for booking.",
    };
  }

  // Fetch seat documents
  const seatDocuments = await Seat.find({
    screenId: show.screenId,
    seatLabel: { $in: seatLabels },
    isActive: true,
  });

  // Ensure every seat exists
  if (seatDocuments.length !== seatLabels.length) {
    return {
      isValid: false,
      status: 400,
      message: "One or more seats are invalid.",
    };
  }

  // Calculate amount
  let totalAmount = 0;

  for (const seat of seatDocuments) {
    const category = seat.category;

    const pricing = show.priceMap.get(category);

    if (!pricing) {
      return {
        isValid: false,
        status: 400,
        message: `Pricing not found for category ${category}.`,
      };
    }

    totalAmount += Number(pricing.price);
  }

  return {
    isValid: true,
    show,
    seatDocuments,
    totalAmount,
  };
};

module.exports = {
  validateLockSeatsRequest,
  validateShowAndSeats,
  validateBookedSeats,
  validateCreateBookingRequest,
  validateBookingDetails,
};