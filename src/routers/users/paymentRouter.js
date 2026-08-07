const express =require("express");

const paymentRouter = express.Router();

const razorpay = require("../../config/razorpay");
const Payment = require("../../models/paymentSchema");
const crypto = require("crypto");

const {userAuth} = require("../../middleware/userAuth");

const {
    validateCreateOrderRequest
} = require("../../utils/users/paymentValidation");

const {
    verifySeatLocks
} = require("../../utils/redis/seatLock");

const {
    validateBookingDetails
} = require("../../utils/users/bookingValidation");


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


module.exports = paymentRouter;