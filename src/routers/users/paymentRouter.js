const express =require("express");

const paymentRouter = express.Router();

const razorpay = require("../../config/razorpay");
const Payment = require("../../models/paymentSchema");
const crypto = require("crypto");

const {userAuth} = require("../../middleware/userAuth");
const {validateCreateOrderRequest} = require("../../utils/users/paymentValidation");
const {verifySeatLocks} = require("../../utils/redis/seatLock");
const {validateBookingDetails} = require("../../utils/users/bookingValidation");
const {createBooking,} = require("../../services/bookingService");

// to validate webhook signature
const { validateWebhookSignature } = require("razorpay/dist/utils/razorpay-utils");


paymentRouter.post("/payments/create-order" , userAuth , async (req,res)=>{
  try{
    // 1. read request
    const {showId} = req.body;
    // 2. validate request
    const error = validateCreateOrderRequest(showId);
    if(error){
      return res.status(400).json({
          success: false,
          message: error,
      });
    }
    // 3. verify redis lock
    const lockValidation = await verifySeatLocks({showId ,userId: req.user._id });
    if (!lockValidation.success) {
        return res.status(lockValidation.status).json({
            success: false,
            message: lockValidation.message,
        });
    }
    const {seatLabels} = lockValidation;

    // 4. verify booking details
    const bookingValidation = await validateBookingDetails( showId, seatLabels);
     if (!bookingValidation.isValid) {
        return res.status(bookingValidation.status).json({
            success: false,
            message: bookingValidation.message,
        });
    }
    const {show , totalAmount} = bookingValidation;

    // 5. create razorPay order
    const receipt = crypto.randomUUID();
    const razorpayOrder = await razorpay.orders.create({
        amount: totalAmount * 100,
        currency: "INR",
        receipt,
        notes: {
          userId: req.user._id.toString(),
          showId:show._id.toString(),
        },
    });

    // 6. save payement
    const payment = await Payment.create({
      razorpayOrderId:razorpayOrder.id,
      receipt,
      userId : req.user._id,
      showId:show._id,
      amount : totalAmount,
      currency : "INR",
      paymentStatus: "PENDING",
    })
    // 7. return order
    return res.status(201).json({
      success:true,
      data :{
        orderId:razorpayOrder.id,
        amount:razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key:process.env.RAZORPAY_KEY_ID,
        paymentId: payment._id
      },
    })
  }catch(err){
     return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
})

/**
 * POST /payments/webhook
 * Razorpay Webhook
 */
paymentRouter.post("/payments/webhook", async (req, res) => {
  try {
    console.log("========== WEBHOOK RECEIVED ==========");

    // 1. Read Razorpay webhook signature
    const webhookSignature = req.get("X-Razorpay-Signature");


    if (!webhookSignature) {
      return res.status(400).json({
        success: false,
        message: "Webhook signature missing.",
      });
    }

    // 2. Verify webhook signature
    // Same approach as your working code
    const isWebhookValid = validateWebhookSignature(
      JSON.stringify(req.body),
      webhookSignature,
      process.env.RAZORPAY_WEBHOOK_SECRET
    );

    if (!isWebhookValid) {
      return res.status(400).json({
        success: false,
        message: "Webhook signature is invalid.",
      });
    }

    // 3. Get payment details directly from req.body
    const paymentDetails = req.body.payload.payment.entity;

    console.log("Payment ID:", paymentDetails.id);
    console.log("Order ID:", paymentDetails.order_id);
    console.log("Payment Status:", paymentDetails.status);

    // 4. Find payment in database
    const payment = await Payment.findOne({
      razorpayOrderId: paymentDetails.order_id,
    });

    if (!payment) {
      console.log(
        `Payment not found for Order: ${paymentDetails.order_id}`
      );

      return res.status(200).json({
        success: true,
        message: "Payment not found in database.",
      });
    }

    // 5. Handle payment.captured
    if (req.body.event === "payment.captured") {
      payment.paymentStatus = "SUCCESS";
      payment.razorpayPaymentId = paymentDetails.id;
      payment.paymentMethod = paymentDetails.method;
      payment.capturedAt = new Date();

      await payment.save();

      console.log("Payment saved successfully");

      // 6. Create booking
      const booking = await createBooking({
        payment,
      });

      console.log("Booking created successfully");

      return res.status(200).json({
        success: true,
        message: "Payment captured and booking created successfully.",
      });
    }

    // 7. Handle payment.failed
    if (req.body.event === "payment.failed") {
      payment.paymentStatus = "FAILED";
      payment.razorpayPaymentId = paymentDetails.id;
      payment.paymentMethod = paymentDetails.method;

      await payment.save();

      console.log(
        `Payment ${payment.razorpayOrderId} marked FAILED`
      );

      return res.status(200).json({
        success: true,
        message: "Payment marked as failed.",
      });
    }

    // 8. Ignore other events
    console.log(`Ignoring Event: ${req.body.event}`);

    return res.status(200).json({
      success: true,
      message: "Webhook received successfully.",
    });

  } catch (err) {
    console.error("Webhook Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = paymentRouter;