const express=require('express');
const app=express();

const connectDB = require('./config/databse');

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
