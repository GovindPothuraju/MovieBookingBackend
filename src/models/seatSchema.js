const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    screenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Screen',
      required: [true, 'Screen reference is required'],
      index: true,
    },
    row: {
      type: String,
      required: [true, 'Row is required'],
      uppercase: true,
      match: [/^[A-Z]$/, 'Row must be a single uppercase letter'],
    },
    column: {
      type: Number,
      required: [true, 'Seat number is required'],
      min: [1, 'Seat number must be at least 1'],
    },
    seatLabel: {
      type: String,
      required: [true, 'Seat label is required'],
      uppercase: true,
    },
    category: {
      type: String,
      enum: ['REGULAR', 'VIP', 'PREMIUM', 'RECLINER'],
      default: 'REGULAR',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

seatSchema.index({ screenId: 1, row: 1 });
seatSchema.index({ screenId: 1, row: 1, column: 1 }, { unique: true });

module.exports = mongoose.model('Seat', seatSchema);