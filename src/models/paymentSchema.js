const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true,
  },

  razorpayPaymentId: {
    type: String,
    default: null,
  },

  receipt: {
    type: String,
    required: true,
    unique: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  showId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Show",
    required: true,
  },

  seats: [{
    type: String,
    required: true,
  }],

  amount: {
    type: Number,
    required: true,
  },

  currency: {
    type: String,
    default: "INR",
  },

  status: {
    type: String,
    enum: ["PENDING", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED"],
    default: "PENDING",
  },

  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    default: null,
  },

  refundId: {
    type: String,
    default: null,
  },

  failureReason: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});
paymentSchema.index({ userId: 1, createdAt: -1 });

paymentSchema.index({ showId: 1 });

module.exports = mongoose.model("Payement",paymentSchema);