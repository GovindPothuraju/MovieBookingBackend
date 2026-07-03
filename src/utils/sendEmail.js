const axios = require("axios");

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: process.env.SMTP_FROM_NAME,
          email: process.env.SMTP_FROM_EMAIL,
        },

        to: [
          {
            email: to,
          },
        ],

        subject,

        htmlContent: html,

        textContent: text || "",
      },
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
      }
    );

    console.log("Email Sent Successfully");
    console.log(response.data);

    return response.data;
  } catch (err) {
    console.error(
      "Brevo Error:",
      err.response?.data || err.message
    );

    throw err;
  }
};

module.exports = sendEmail;