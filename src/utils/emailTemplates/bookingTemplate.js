const bookingTemplate = ({
  userName,
  bookingId,
  movieName,
  theaterName,
  screenName,
  showTime,
  seats,
  amount,
  qrCode,
}) => {
  return {
        subject: `🎟 Booking Confirmed - ${movieName}`,

        html: `
          <div style="font-family:Arial,sans-serif;padding:20px">

            <h2>Booking Confirmed 🎉</h2>

            <p>Hello <b>${userName}</b>,</p>

            <p>Your booking has been confirmed successfully.</p>

            <hr/>

            <p><strong>Booking ID:</strong> ${bookingId}</p>

            <p><strong>Movie:</strong> ${movieName}</p>

            <p><strong>Theatre:</strong> ${theaterName}</p>

            <p><strong>Screen:</strong> ${screenName}</p>

            <p><strong>Show Time:</strong> ${new Date(
              showTime
            ).toLocaleString("en-IN")}</p>

            <p><strong>Seats:</strong> ${seats.join(", ")}</p>

            <p><strong>Amount Paid:</strong> ₹${amount}</p>

            <hr/>

            <p>Please show this QR Code at the theatre entrance.</p>

            <img
                src="${qrCode}"
                alt="QR Code"
                width="250"
            />

            <br/><br/>

            <p>Enjoy your movie 🍿</p>

          </div>
        `,

        text: `
    Booking Confirmed

    Booking ID : ${bookingId}

    Movie : ${movieName}

    Theatre : ${theaterName}

    Screen : ${screenName}

    Seats : ${seats.join(", ")}

    Amount : ₹${amount}
    `,
      };
    };

module.exports = bookingTemplate;