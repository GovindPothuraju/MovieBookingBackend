const express=require('express');

const theaterRouter=express.Router();

/**
 * GET /theaters
 * Public: list active theaters with optional ?city= and pagination
 */
theaterRouter.get("/theaters",(req,res)=>{});
/**
 * POST /theaters
 * Admin only: create a new theater
 */
theaterRouter.post("/theaters", (req, res) => {});
 
/**
 * GET /theaters/:id
 * Authenticated: get theater by ID (includes screens)
 */
theaterRouter.get('/theaters/:id',(req, res) => {});
 
/**
 * PATCH /theaters/:id
 * Admin only: update theater fields
 */
theaterRouter.patch('/theaters/:id',(req, res) => {});
 
/**
 * DELETE /theaters/:id
 * Admin only: soft-delete (blocks if screens exist)
 */
theaterRouter.delete('/theaters/:id',(req, res) => {});

// SEAT ROUTES  (nested under /screens/:screenId)

/**
 * GET /theaters/:theaterId/screens
 * Authenticated: list screens for a theater
 */
theaterRouter.get('/theaters/:theaterId/screens',(req, res) => {});
 
/**
 * POST /theaters/:theaterId/screens
 * Admin only: create a screen under a theater
 */
theaterRouter.post('/theaters/:theaterId/screens',(req, res) => {});
 

module.exports=theaterRouter;