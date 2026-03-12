const mongoose = require('mongoose');

const connectDB = async () => {
  try{
    await mongoose.connect("mongodb+srv://dbuser:qPAcPuFEFNPItKUa@devtinder.ix9cqnf.mongodb.net/movieBookingApp");
  }
   catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}
module.exports = connectDB;