const QRCode = require("qrcode");
const cloudinary = require("../../src/config/cloudinary");
const streamifier = require("streamifier");

const generateQRCode = async ({
  bookingId,
  userId,
  showId,
  movieId,
  theaterId,
  screenId,
  seats,
}) => {
  try {
    const payload = {
      bookingId,
      userId,
      showId,
      movieId,
      theaterId,
      screenId,
      seats,
      issuedAt: new Date().toISOString(),
    };

    // Generate PNG Buffer
    const qrBuffer = await QRCode.toBuffer(
      JSON.stringify(payload),
      {
        errorCorrectionLevel: "H",
        width: 500,
        margin: 2,
      }
    );

    // Upload Buffer to Cloudinary
    const qrUrl = await uploadQRCode(qrBuffer, bookingId);

    return qrUrl;
  } catch (err) {
    throw new Error(`QR Generation Failed : ${err.message}`);
  }
};

const uploadQRCode = (buffer, bookingId) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "booking-app/qr-codes",
        public_id: bookingId,
        resource_type: "image",
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

module.exports = {
  generateQRCode,
};