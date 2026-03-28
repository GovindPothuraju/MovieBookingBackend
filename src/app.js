const express=require('express');
const app=express();
require("dotenv").config();
const cors=require('cors');
const cookieParser = require("cookie-parser");


const connectDB = require('./config/databse');
const adminRoutes = require('./routers/adminRoutes');
const theaterRoutes = require('./routers/theaterRouter');
const screenRoutes = require('./routers/screenRoutes');
const seatRoutes = require('./routers/seatRoutes');


app.use(cors());
app.use(express.json());
app.use(cookieParser());



app.use('/',adminRoutes);
app.use('/',theaterRoutes);
app.use('/',screenRoutes);
app.use('/',seatRoutes);


app.use("/hello",(req,res)=>{
    res.send("Hello World brother");
})


connectDB().then(()=>{
    console.log("Database connected successfully");
    const port=3000;
    app.listen(port,()=>{
        console.log(`Server is running on port ${port}`);
    })
}).catch((err)=>{
    console.log("Database connection failed",err);
});
