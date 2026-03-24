const express=require('express');
const screenRouter=express.Router();

/**
 * POST /screens/:screenId/seats
 * Admin only: generate seat layout for a screen (runs once)
 */
screenRouter.post('/screens/:screenId/seats',(req, res) => {});
 
/**
 * GET /screens/:screenId/seats
 * Authenticated: get all seats grouped by row
 */
screenRouter.get('/screens/:screenId/seats',(req, res) => {});
 
/**
 * PATCH /screens/:screenId/layout
 * Admin only: delete old seats and regenerate with new dimensions
 */
screenRouter.patch('/screens/:screenId/layout',(req, res) => {});
 
module.exports = screenRouter;
