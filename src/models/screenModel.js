const mongoose = require('mongoose');

const MAX_SEATS = 500;

const screenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Screen name is required'],
      trim: true,
      maxlength: [50, 'Screen name cannot exceed 50 characters'],
    },
    theaterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theater',
      required: [true, 'Theater reference is required'],
      index: true,
    },
    rows: {
      type: Number,
      required: [true, 'Number of rows is required'],
      min: [1, 'Rows must be at least 1'],
      max: [26, 'Rows cannot exceed 26 (A–Z)'],
      validate: {
        validator: Number.isInteger,
        message: 'Rows must be an integer',
      },
    },
    columns: {
      type: Number,
      required: [true, 'Number of columns is required'],
      min: [1, 'Columns must be at least 1'],
      validate: [
        {
          validator: Number.isInteger,
          message: 'Columns must be an integer',
        },
        {
          validator: function (cols) {
            return this.rows * cols <= MAX_SEATS;
          },
          message: `Total seats (rows × columns) cannot exceed ${MAX_SEATS}`,
        },
      ],
    },
    totalSeats: {
      type: Number,
    },
    screenType: {
      type: String,
      enum: ['STANDARD', 'IMAX', 'DOLBY', '4DX', 'DRIVE_IN','2D'],
      default: 'STANDARD',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    seatsGenerated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

screenSchema.index({ theaterId: 1, name: 1 }, { unique: true });
screenSchema.index({ isActive: 1 });

// Pre-save hook to calculate totalSeats
screenSchema.pre('save', async function () {
  // Calculate totalSeats whenever rows or columns are present
  if (this.rows != null && this.columns != null) {
    this.totalSeats = this.rows * this.columns;
  }
});

module.exports = mongoose.model('Screen', screenSchema);