const express=require('express');
const app=express();
require("dotenv").config();
const cors=require('cors');
const cookieParser = require("cookie-parser");


const connectDB = require('./config/databse');
// Admin Routes 
const adminRoutes = require('./routers/admin/adminRoutes');
const theaterRoutes = require('./routers/admin/theaterRouter');
const screenRoutes = require('./routers/admin/screenRoutes');
const seatRoutes = require('./routers/admin/seatRoutes');
const movieRoutes = require('./routers/admin/movieRoutes')
const showRoutes = require('./routers/admin/showRoutes');
const bookingRoutes = require('./routers/admin/bookingRoutes');

// User Routes
const userRoutes = require('./routers/users/userRoutes');

app.use(cors());
app.use(express.json());
app.use(cookieParser());


// Admin routes
app.use('/',adminRoutes);
app.use('/',theaterRoutes);
app.use('/',screenRoutes);
app.use('/',seatRoutes);
app.use('/',movieRoutes);
app.use('/',showRoutes);
app.use('/',bookingRoutes);
// User routes
app.use('/',userRoutes);

connectDB().then(()=>{
    console.log("Database connected successfully");
    const port=3000;
    app.listen(port,()=>{
        console.log(`Server is running on port ${port}`);
    })
}).catch((err)=>{
    console.log("Database connection failed",err);
});
