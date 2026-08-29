const express = require("express");
const theaterRequestRouter = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const adminAuth = require("../../middleware/adminAuth");

const TheaterRequest = require("../../models/theater/TheaterRequestModel");
console.log("TheaterRequest fields:", Object.keys(TheaterRequest.schema.paths));
const Theater = require("../../models/admin/theaterModel");
const TheaterAdmin = require("../../models/theater/TheaterAdmin");


const sendEmail = require("../../utils/emailTemplates/sendEmail");
const { getTheaterAdminCredentialsTemplate } = require("../../utils/emailTemplates/theaterAdminEmail");


const generateTemporaryPassword = () => {
  return crypto.randomBytes(9).toString("base64url");
};


// 1. Submit Theater Registration Request
theaterRequestRouter.post("/theater-requests", async (req, res) => {
  try {

    // 1. Get data from request
    const { adminName, adminEmail, adminPhone, theaterName, city, address, contactEmail, contactPhone, amenities } = req.body;

    // 2. Validate required fields
    if (!adminName || !adminEmail || !adminPhone || !theaterName || !city || !address || !contactEmail || !contactPhone) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    // 3. Normalize email
    const normalizedEmail = adminEmail.toLowerCase().trim();

    // 4. Check if Theater Admin already exists
    const existingAdmin = await TheaterAdmin.findOne({
      email: normalizedEmail
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "A Theater Admin already exists with this email"
      });
    }

    // 5. Check if pending request already exists
    const existingRequest = await TheaterRequest.findOne({
      adminEmail: normalizedEmail,
      status: "PENDING"
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "A pending request already exists for this email"
      });
    }
    console.log("data validated");
    // 6. Create Theater Request
    const request = await TheaterRequest.create({
      adminName: adminName.trim(),
      adminEmail: normalizedEmail,
      adminPhone: adminPhone.trim(),
      theaterName: theaterName.trim(),
      city: city.trim(),
      address: address.trim(),
      contactEmail: contactEmail.toLowerCase().trim(),
      contactPhone: contactPhone.trim(),
      amenities: Array.isArray(amenities) ? amenities : []
    });

    // 7. Response
    return res.status(201).json({
      success: true,
      message: "Theater registration request submitted successfully",
      data: {
        requestId: request._id,
        status: request.status
      }
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
});


// 2. Get All Theater Requests - Super Admin
theaterRequestRouter.get("/admin/theater-requests", adminAuth, async (req, res) => {
  try {

    // 1. Fetch all theater requests
    const requests = await TheaterRequest.find({})
      .populate("processedBy", "name email")
      .populate("theaterId", "name city")
      .populate("theaterAdminId", "name email phoneNumber")
      .sort({ createdAt: -1 })
      .lean();

    // 2. Response
    return res.status(200).json({
      success: true,
      message: "Theater requests fetched successfully",
      data: requests
    });

  } catch (err) {

    console.error("Get Theater Requests Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
});


// 3. Get Single Theater Request - Super Admin
theaterRequestRouter.get("/admin/theater-requests/:requestId", adminAuth, async (req, res) => {
  try {

    // 1. Get request ID
    const { requestId } = req.params;

    // 2. Validate request ID
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater request ID"
      });
    }

    // 3. Fetch theater request
    const request = await TheaterRequest.findById(requestId)
      .populate("processedBy", "name email")
      .populate("theaterId", "name city address contactEmail contactPhone amenities")
      .populate("theaterAdminId", "name email phoneNumber")
      .lean();

    // 4. Check request exists
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Theater request not found"
      });
    }

    // 5. Response
    return res.status(200).json({
      success: true,
      message: "Theater request fetched successfully",
      data: request
    });

  } catch (err) {

    console.error("Get Theater Request Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
});


// 4. Approve Theater Request - Super Admin
theaterRequestRouter.post("/admin/theater-requests/:requestId/approve", adminAuth, async (req, res) => {

  const session = await mongoose.startSession();

  try {

    // 1. Get request ID
    const { requestId } = req.params;

    // 2. Validate request ID
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater request ID"
      });
    }

    let emailData = null;

    // 3. Start MongoDB transaction
    await session.withTransaction(async () => {

      // 4. Find theater request
      const request = await TheaterRequest.findById(requestId).session(session);

      if (!request) {
        throw new Error("REQUEST_NOT_FOUND");
      }

      // 5. Check request status
      if (request.status !== "PENDING") {
        throw new Error("REQUEST_ALREADY_PROCESSED");
      }

      // 6. Check existing Theater Admin
      const existingAdmin = await TheaterAdmin.findOne({
        email: request.adminEmail
      }).session(session);

      if (existingAdmin) {
        throw new Error("ADMIN_ALREADY_EXISTS");
      }

      // 7. Check existing Theater
      const existingTheater = await Theater.findOne({
        name: request.theaterName,
        city: request.city
      }).session(session);

      if (existingTheater) {
        throw new Error("THEATER_ALREADY_EXISTS");
      }

      // 8. Generate temporary password
      const temporaryPassword = generateTemporaryPassword();

      // 9. Hash temporary password
      const hashedPassword = await bcrypt.hash(
        temporaryPassword,
        Number(process.env.BCRYPT_SALT_ROUNDS) || 10
      );

      // 10. Create Theater
      const theaterArray = await Theater.create([{
        name: request.theaterName,
        city: request.city,
        address: request.address,
        contactEmail: request.contactEmail,
        contactPhone: request.contactPhone,
        amenities: request.amenities,
        isActive: true
      }], { session });

      const theater = theaterArray[0];

      // 11. Create Theater Admin
      const theaterAdminArray = await TheaterAdmin.create([{
        name: request.adminName,
        email: request.adminEmail,
        phoneNumber: request.adminPhone,
        password: hashedPassword,
        theaterId: theater._id,
        isActive: true,
        isVerified: true,
        mustChangePassword: true
      }], { session });

      const theaterAdmin = theaterAdminArray[0];

      // 12. Link Theater Admin with Theater
      theater.adminId = theaterAdmin._id;

      await theater.save({
        session
      });

      // 13. Update Theater Request
      request.status = "APPROVED";
      request.processedBy = req.admin._id;
      request.processedAt = new Date();
      request.theaterId = theater._id;
      request.theaterAdminId = theaterAdmin._id;

      await request.save({
        session
      });

      // 14. Store email data
      emailData = {
        name: theaterAdmin.name,
        email: theaterAdmin.email,
        password: temporaryPassword
      };
    });

    // 15. Send credentials email after successful transaction
    let emailSent = true;

    try {

      await sendEmail({
        to: emailData.email,
        subject: "Your Theater Admin Account",
        text: `Hello ${emailData.name},

      Your Theater Admin account has been approved.

      Login Email: ${emailData.email}
      Temporary Password: ${emailData.password}

      Please login and change your password immediately.

      Regards,
      Admin Team`,
        html: getTheaterAdminCredentialsTemplate(emailData)
      });

    } catch (emailErr) {

      emailSent = false;

      console.error("Theater Admin Email Error:", emailErr.message);
    }

    // 16. Response
    return res.status(200).json({
      success: true,
      message: emailSent ? "Theater approved and Theater Admin created successfully" : "Theater approved and Theater Admin created, but email could not be sent",
      data: {
        email: emailData.email,
        emailSent
      }
    });

  } catch (err) {

    console.error("Approve Theater Error:", err);

    const errorResponses = {
      REQUEST_NOT_FOUND: [404, "Theater request not found"],
      REQUEST_ALREADY_PROCESSED: [409, "Theater request has already been processed"],
      ADMIN_ALREADY_EXISTS: [409, "Theater Admin already exists"],
      THEATER_ALREADY_EXISTS: [409, "Theater already exists in this city"]
    };

    const response = errorResponses[err.message];

    if (response) {
      return res.status(response[0]).json({
        success: false,
        message: response[1]
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });

  } finally {

    // 17. Close MongoDB session
    await session.endSession();
  }
});


// 5. Reject Theater Request - Super Admin
theaterRequestRouter.post("/admin/theater-requests/:requestId/reject", adminAuth, async (req, res) => {
  try {

    // 1. Get request data
    const { requestId } = req.params;
    const { reason } = req.body;

    // 2. Validate request ID
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid theater request ID"
      });
    }

    // 3. Validate rejection reason
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "A valid rejection reason is required"
      });
    }

    // 4. Find theater request
    const request = await TheaterRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Theater request not found"
      });
    }

    // 5. Check request status
    if (request.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: "Theater request has already been processed"
      });
    }

    // 6. Update request
    request.status = "REJECTED";
    request.rejectionReason = reason.trim();
    request.processedBy = req.admin._id;
    request.processedAt = new Date();

    await request.save();

    // 7. Response
    return res.status(200).json({
      success: true,
      message: "Theater request rejected successfully"
    });

  } catch (err) {

    console.error("Reject Theater Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  }
});


module.exports = theaterRequestRouter;