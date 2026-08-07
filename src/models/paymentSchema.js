const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Razorpay Order ID
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Show",
      required: true,
      index: true,
    },
    seats : [{
        type: String,
        required: true
    }],
    currency: {
      type: String,
      default: "INR",
    },
    status :{
      type : String,
      enum :["PENDING","AUTHORIZED","CAPTURED","FAILED", "REFUNDED"],
      default : "PENDING",
      index : true
    },
    ookingId: {
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
  },
  {
    timestamps:true
  }
)
paymentSchema.index({ userId: 1, createdAt: -1 });


module.exports = mongoose.model("Payement",paymentSchema);