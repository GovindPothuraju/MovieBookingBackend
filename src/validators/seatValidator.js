const validator = require("validator");
const mongoose = require('mongoose');
const Screen = require('../models/screenModel');

const allowedTypes = ["REGULAR", "VIP", "PREMIUM", "RECLINER"];

const validateScreenId = (screenId) => {
  if(!mongoose.Types.ObjectId.isValid(screenId)){
    return { 
      isValid: false, 
      message : "Invalid screen ID" 
    };
  }
  return { isValid: true };
};

const validateScreenExists = async (screenId, isActiveCheck = false) => {
  const screen = await Screen.findById(screenId);
  if(!screen){
    return { 
      isValid: false, 
      message : "Screen not found" 
    };
  }
  if (isActiveCheck && !screen.isActive) {
    return {
      isValid: false,
      message: "Screen is inactive",
    };
  }
  return { isValid: true, screen };
};

const validateRowsColumnsLayout = (req) => {
  let { rows, columns, layout ={} } = req.body;
  rows= parseInt(rows);
  columns = parseInt(columns);

  if(!rows || !columns || rows < 1 || columns < 1 || rows > 26 || rows * columns > 500){
    return { 
      isValid: false, 
      message : "Invalid rows or columns" 
    };
  }
  return { isValid: true, rows, columns, layout };
};

const validateLayoutTypes = (layout) => {
  for(let row in layout){
    if(!allowedTypes.includes(layout[row])){
      return { 
        isValid: false, 
        message : `Invalid seat type for row ${row}` 
      };
    }
  }
  return { isValid: true };
};

module.exports = {
  validateScreenId,
  validateScreenExists,
  validateRowsColumnsLayout,
  validateLayoutTypes
};
