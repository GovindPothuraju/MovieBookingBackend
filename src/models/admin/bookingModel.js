const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  showId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Show',
    required: true,
  },

  // seats booked
  seats: [
    {
      seatNumber: { type: String, required: true }, // A1, B2
      category: { 
        type: String, 
        enum: ['REGULAR', 'VIP', 'PREMIUM', 'RECLINER'],
        required: true 
      },
      price: { type: Number, required: true }
    }
  ],

  totalAmount: {
    type: Number,
    required: true,
  },

  bookingStatus: {
    type: String,
    enum: ['confirmed', 'cancelled'],
    default: 'confirmed',
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'paid',
  },

  paymentId: {
    type: String,
  },

}, {
  timestamps: true,
});


// indexes 
bookingSchema.index({ showId: 1 });
bookingSchema.index({ userId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);