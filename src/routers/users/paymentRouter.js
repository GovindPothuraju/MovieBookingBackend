const express =require("express");

const paymentRouter = express.Router();

const razorpay = require("../../config/razorpay");
const Payment = require("../../models/paymentSchema");
const crypto = require("crypto");

const {userAuth} = require("../../middleware/userAuth");
const {validateCreateOrderRequest} = require("../../utils/users/paymentValidation");
const {verifySeatLocks} = require("../../utils/redis/seatLock");
const {validateBookingDetails} = require("../../utils/users/bookingValidation");

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
    console.log("========== WEBHOOK CALLED ==========");

    // 1. Read Signature
    const webhookSignature = req.headers("x-razorpay-signature");

    if (!webhookSignature) {
      console.log("Webhook signature missing");

      return res.status(400).json({
        success: false,
        message: "Webhook signature missing.",
      });
    }

    // 2. Convert Raw Buffer -> String
    const body = req.body.toString("utf8");

    // 3. Verify Signature
    const isWebhookValid = validateWebhookSignature(
      body,
      webhookSignature,
      process.env.RAZORPAY_WEBHOOK_SECRET
    );

    if (!isWebhookValid) {
      console.log("Invalid Webhook Signature");

      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    console.log("Webhook Signature Verified");

    // 4. Parse Payload
    const payload = JSON.parse(body);

    const event = payload.event;
    const paymentEntity = payload.payload.payment.entity;

    console.log("Event:", event);

    // 5. Find Payment
    const payment = await Payment.findOne({
      razorpayOrderId: paymentEntity.order_id,
    });

    if (!payment) {
      console.log(
        `Payment not found for Order: ${paymentEntity.order_id}`
      );

      // Return 200 so Razorpay doesn't retry forever
      return res.status(200).json({
        success: true,
      });
    }

    // 6. Idempotency Check
    if (payment.paymentStatus === "SUCCESS") {
      console.log("Webhook already processed");

      return res.status(200).json({
        success: true,
      });
    }

    // 7. Handle Events
    switch (event) {
      case "payment.captured": {

        payment.paymentStatus = "SUCCESS";
        payment.razorpayPaymentId = paymentEntity.id;
        payment.paymentMethod = paymentEntity.method;
        payment.capturedAt = new Date();

        await payment.save();

        console.log(
          `Payment ${payment.razorpayOrderId} marked SUCCESS`
        );

        break;
      }

      case "payment.failed": {

        payment.paymentStatus = "FAILED";
        payment.razorpayPaymentId = paymentEntity.id;
        payment.paymentMethod = paymentEntity.method;

        await payment.save();

        console.log(
          `Payment ${payment.razorpayOrderId} marked FAILED`
        );

        break;
      }

      default:
        console.log(`Ignoring Event: ${event}`);
    }

    // 8. Success Response
    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully.",
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = paymentRouter;