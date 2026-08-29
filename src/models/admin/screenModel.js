const mongoose=require("mongoose");

const MAX_SEATS=500;

const screenSchema=new mongoose.Schema(
  {
    name:{
      type:String,
      required:[true,"Screen name is required"],
      trim:true,
      minlength:[2,"Screen name must be at least 2 characters"],
      maxlength:[50,"Screen name cannot exceed 50 characters"]
    },

    theaterId:{
      type:mongoose.Schema.Types.ObjectId,
      ref:"Theater",
      required:[true,"Theater reference is required"],
      index:true
    },

    rows:{
      type:Number,
      required:[true,"Rows are required"],
      min:[1,"Rows must be at least 1"],
      max:[26,"Rows cannot exceed 26"],
      validate:{
        validator:Number.isInteger,
        message:"Rows must be an integer"
      }
    },

    columns:{
      type:Number,
      required:[true,"Columns are required"],
      min:[1,"Columns must be at least 1"],
      validate:{
        validator:function(value){
          return Number.isInteger(value)&&this.rows*value<=MAX_SEATS;
        },
        message:`Total seats cannot exceed ${MAX_SEATS}`
      }
    },

    totalSeats:{
      type:Number,
      default:0,
      min:[0,"Total seats cannot be negative"],
      max:[MAX_SEATS,`Total seats cannot exceed ${MAX_SEATS}`]
    },

    screenType:{
      type:String,
      enum:{
        values:["IMAX","4DX","2D","3D"],
        message:"Invalid screen type"
      },
      required:[true,"Screen type is required"]
    },

    isActive:{
      type:Boolean,
      default:true,
      index:true
    },

    seatsGenerated:{
      type:Boolean,
      default:false
    }
  },
  {
    timestamps:true
  }
);

screenSchema.index(
  {theaterId:1,name:1},
  {
    unique:true,
    partialFilterExpression:{isActive:true}
  }
);

screenSchema.pre("save",function(next){
  if(this.rows!=null&&this.columns!=null){
    const total=this.rows*this.columns;

    if(total>MAX_SEATS){
      return next(new Error(`Total seats cannot exceed ${MAX_SEATS}`));
    }

    this.totalSeats=total;
  }

  next();
});

module.exports=mongoose.model("Screen",screenSchema);