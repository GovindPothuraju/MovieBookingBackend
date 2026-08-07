const mongoose = require("mongoose");

const validateCreateOrderRequest = ({showId}) =>{
  if(!showId){
    return "showId is required.";
  }
  if (!mongoose.Types.ObjectId.isValid(showId)) {
    return "Invalid showId.";
  }
  return null;
}

module.exports = {
  validateCreateOrderRequest,
};