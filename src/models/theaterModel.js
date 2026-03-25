const mongoose = require('mongoose');

const theaterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Theater name is required'],
      trim: true,
      minlength: [2, 'Theater name must be at least 2 characters'],
      maxlength: [100, 'Theater name cannot exceed 100 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      lowercase: true,
      maxlength: [60, 'City name cannot exceed 60 characters'],
    },
    address: {
      street: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true, match: [/^\d{6}$/, 'Invalid pincode'] },
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    contactPhone: {
      type: String,
      trim: true,
      match: [/^\d{10}$/, 'Phone must be 10 digits'],
    },
    amenities: [
      {
        type: String,
        enum: ['PARKING', 'FOOD_COURT', 'WHEELCHAIR_ACCESS', 'AC', 'DOLBY', 'IMAX'],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

theaterSchema.index({ name: 1, city: 1 ,"address.street":1}, { unique: true });
theaterSchema.index({ city: 1 });
theaterSchema.index({ isActive: 1 });


theaterSchema.virtual('screens', {
  ref: 'Screen',
  localField: '_id',
  foreignField: 'theaterId',
  match: { isActive: true },
});

module.exports = mongoose.model('Theater', theaterSchema);