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
      min: [1, 'Rows must be at least 1'],
      max: [26, 'Rows cannot exceed 26 (A–Z)'],
      validate: {
        validator: function (val) {
          return val == null || Number.isInteger(val);
        },
        message: 'Rows must be an integer',
      },
    },
    columns: {
      type: Number,
      min: [1, 'Columns must be at least 1'],
      validate: [
        {
          validator: function (val) {
            return val == null || Number.isInteger(val);
          },
          message: 'Columns must be an integer',
        },
        {
          validator: function (cols) {
            if (cols == null || this.rows == null) return true;
            return this.rows * cols <= MAX_SEATS;
          },
          message: `Total seats (rows × columns) cannot exceed ${MAX_SEATS}`,
        },
      ],
    },
    totalSeats: {
      type: Number,
      default: 0,
    },
    screenType: {
      type: String,
      enum: ['IMAX', '4DX', '2D', '3D'],
      required: [true, 'Screen type is required'],
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

// Pre-save hook to calculate totalSeats — only runs once rows/columns exist
screenSchema.pre('save', function () {
  if (this.rows != null && this.columns != null) {
    this.totalSeats = this.rows * this.columns;
  }
});

module.exports = mongoose.model('Screen', screenSchema);