
const mongoose = require('mongoose');

const showSchema = new mongoose.Schema({
  movieId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  theaterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: true
  },
  screenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Screen',
    required: true
  },
  showTime: {
    type: Date,
    required: true,
  },
  priceMap: {
    type: Map,
    of: new mongoose.Schema({
      price: { type: Number, required: true },
      totalSeats: { type: Number, required: true },
      availableSeats: { type: Number, required: true },
    }),
    required: true,
  },
  status: {
    type: String,
    enum: ['scheduled', 'cancelled', 'completed'],
    default: 'scheduled'
  },
  // optional but useful for booking
  bookedSeats: {
    type: [String], // ["A1", "A2"]
    default: [],
  },
}, {timestamps: true});

showSchema.index({ theaterId: 1, screenId: 1, showTime: 1 }); // for checking overlapping shows
showSchema.index({ movieId: 1 }); // for fetching shows by movie

module.exports = mongoose.model('Show', showSchema);