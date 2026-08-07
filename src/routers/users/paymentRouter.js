const express = require("express");
const crypto = require("crypto");

const paymentRouter = express.Router();

const razorpay = require("../../config/razorpay");
const Payment = require("../../models/paymentSchema");

const { userAuth } = require("../../middleware/userAuth");

const {
  validateCreateOrderRequest,
} = require("../../utils/users/paymentValidation");

const {
  verifySeatLocks,
} = require("../../utils/redis/seatLock");

const {
  validateBookingDetails,
} = require("../../utils/users/bookingValidation");

/**
 * POST /payments/create-order
 * Create Razorpay Order
 */
paymentRouter.post(
  "/payments/create-order",
  userAuth,
  async (req, res) => {
    try {
      // 1. Read request
      const { showId } = req.body;

      // 2. Validate request
      const error = validateCreateOrderRequest(showId);

      if (error) {
        return res.status(400).json({
          success: false,
          message: error,
        });
      }

      // 3. Verify Redis Seat Locks
      const lockValidation = await verifySeatLocks({
        showId,
        userId: req.user._id,
      });

      if (!lockValidation.success) {
        return res.status(lockValidation.status).json({
          success: false,
          message: lockValidation.message,
        });
      }

      const { seatLabels } = lockValidation;

      // 4. Validate Booking Details
      const bookingValidation = await validateBookingDetails(
        showId,
        seatLabels
      );

      if (!bookingValidation.isValid) {
        return res.status(bookingValidation.status).json({
          success: false,
          message: bookingValidation.message,
        });
      }

      const { show, totalAmount } = bookingValidation;

      // 5. Create Razorpay Order
      const receipt = crypto.randomUUID();

      const razorpayOrder = await razorpay.orders.create({
        amount: totalAmount * 100,
        currency: "INR",
        receipt,
        notes: {
          userId: req.user._id.toString(),
          showId: show._id.toString(),
        },
      });

      if (!razorpayOrder) {
        return res.status(500).json({
          success: false,
          message: "Unable to create Razorpay order",
        });
      }

      // 6. Save Payment
      const payment = await Payment.create({
        razorpayOrderId: razorpayOrder.id,
        receipt,
        userId: req.user._id,
        showId: show._id,
        amount: totalAmount,
        currency: "INR",
        paymentStatus: "PENDING",
      });

      // 7. Return Order Details
      return res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: process.env.RAZORPAY_KEY_ID,
          paymentId: payment._id,
        },
      });

    } catch (err) {
      console.error(err);

      return res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    }
  }
);

module.exports = paymentRouter;