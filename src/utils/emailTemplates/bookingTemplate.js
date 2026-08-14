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
  const formattedDate = new Date(showTime).toLocaleDateString(
    "en-IN",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );

  const formattedTime = new Date(showTime).toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  return {
    subject: `🎟️ Booking Confirmed — ${movieName}`,

    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QuickBook Booking Confirmation</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f3f4f6;
  font-family:Arial,Helvetica,sans-serif;
  color:#111827;
">

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="background:#f3f4f6;padding:30px 10px;"
>
<tr>
<td align="center">

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="
    max-width:620px;
    background:#ffffff;
    border-radius:14px;
    overflow:hidden;
    box-shadow:0 4px 20px rgba(0,0,0,0.08);
  "
>

<!-- HEADER -->

<tr>
<td
  style="
    background:#09090b;
    padding:30px 25px;
    text-align:center;
  "
>

<div style="
  font-size:27px;
  font-weight:bold;
  color:#ffffff;
  letter-spacing:0.5px;
">
  QUICK<span style="color:#ed1c24;">BOOK</span>
</div>

<p style="
  margin:10px 0 0;
  color:#a1a1aa;
  font-size:13px;
">
  Your movie. Your seats. Your experience.
</p>

</td>
</tr>

<!-- SUCCESS -->

<tr>
<td style="padding:30px 30px 10px;text-align:center;">

<div style="
  width:58px;
  height:58px;
  line-height:58px;
  margin:0 auto 15px;
  border-radius:50%;
  background:#dcfce7;
  color:#16a34a;
  font-size:28px;
  font-weight:bold;
">
  ✓
</div>

<h1 style="
  margin:0;
  font-size:25px;
  color:#111827;
">
  Booking Confirmed!
</h1>

<p style="
  margin:10px 0 0;
  color:#6b7280;
  font-size:14px;
  line-height:1.6;
">
  Hi <strong>${userName}</strong>, your movie tickets are confirmed.
  We can't wait to see you at the theatre.
</p>

</td>
</tr>

<!-- BOOKING ID -->

<tr>
<td style="padding:20px 30px;">

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    background:#f9fafb;
    border:1px solid #e5e7eb;
    border-radius:10px;
  "
>

<tr>

<td style="padding:15px 18px;">

<p style="
  margin:0;
  color:#6b7280;
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:1px;
">
  Booking ID
</p>

<p style="
  margin:6px 0 0;
  font-size:16px;
  font-weight:bold;
  color:#111827;
">
  ${bookingId}
</p>

</td>

<td
  align="right"
  style="padding:15px 18px;"
>

<span style="
  display:inline-block;
  padding:6px 10px;
  border-radius:20px;
  background:#dcfce7;
  color:#15803d;
  font-size:11px;
  font-weight:bold;
">
  CONFIRMED
</span>

</td>

</tr>

</table>

</td>
</tr>

<!-- MOVIE DETAILS -->

<tr>
<td style="padding:0 30px 20px;">

<h2 style="
  margin:0 0 15px;
  font-size:17px;
  color:#111827;
">
  🎬 Movie Details
</h2>

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
>

<tr>

<td
  width="50%"
  style="
    padding:10px 0;
    color:#6b7280;
    font-size:13px;
  "
>
  Movie
</td>

<td
  width="50%"
  style="
    padding:10px 0;
    color:#111827;
    font-size:13px;
    font-weight:bold;
  "
>
  ${movieName}
</td>

</tr>

<tr>

<td
  style="
    padding:10px 0;
    color:#6b7280;
    font-size:13px;
    border-top:1px solid #f0f0f0;
  "
>
  Theatre
</td>

<td
  style="
    padding:10px 0;
    color:#111827;
    font-size:13px;
    font-weight:bold;
    border-top:1px solid #f0f0f0;
  "
>
  ${theaterName}
</td>

</tr>

<tr>

<td
  style="
    padding:10px 0;
    color:#6b7280;
    font-size:13px;
    border-top:1px solid #f0f0f0;
  "
>
  Screen
</td>

<td
  style="
    padding:10px 0;
    color:#111827;
    font-size:13px;
    font-weight:bold;
    border-top:1px solid #f0f0f0;
  "
>
  ${screenName}
</td>

</tr>

<tr>

<td
  style="
    padding:10px 0;
    color:#6b7280;
    font-size:13px;
    border-top:1px solid #f0f0f0;
  "
>
  Date
</td>

<td
  style="
    padding:10px 0;
    color:#111827;
    font-size:13px;
    font-weight:bold;
    border-top:1px solid #f0f0f0;
  "
>
  ${formattedDate}
</td>

</tr>

<tr>

<td
  style="
    padding:10px 0;
    color:#6b7280;
    font-size:13px;
    border-top:1px solid #f0f0f0;
  "
>
  Showtime
</td>

<td
  style="
    padding:10px 0;
    color:#111827;
    font-size:13px;
    font-weight:bold;
    border-top:1px solid #f0f0f0;
  "
>
  ${formattedTime}
</td>

</tr>

<tr>

<td
  style="
    padding:10px 0;
    color:#6b7280;
    font-size:13px;
    border-top:1px solid #f0f0f0;
  "
>
  Seats
</td>

<td
  style="
    padding:10px 0;
    color:#111827;
    font-size:13px;
    font-weight:bold;
    border-top:1px solid #f0f0f0;
  "
>
  ${seats.join(", ")}
</td>

</tr>

</table>

</td>
</tr>

<!-- PAYMENT -->

<tr>
<td style="padding:0 30px 25px;">

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    background:#fafafa;
    border-radius:10px;
    border:1px solid #eeeeee;
  "
>

<tr>
<td style="padding:18px;">

<p style="
  margin:0;
  color:#6b7280;
  font-size:12px;
">
  Total Amount Paid
</p>

<p style="
  margin:5px 0 0;
  color:#111827;
  font-size:23px;
  font-weight:bold;
">
  ₹${amount}
</p>

<p style="
  margin:5px 0 0;
  color:#16a34a;
  font-size:12px;
  font-weight:bold;
">
  ✓ Payment Successful
</p>

</td>
</tr>

</table>

</td>
</tr>

<!-- QR TICKET -->

<tr>
<td
  style="
    padding:10px 30px 30px;
    text-align:center;
  "
>

<h2 style="
  margin:0 0 8px;
  font-size:18px;
  color:#111827;
">
  🎟️ Your Digital Ticket
</h2>

<p style="
  margin:0 0 18px;
  color:#6b7280;
  font-size:12px;
  line-height:1.6;
">
  Show this QR code at the theatre entrance for verification.
</p>

<div style="
  display:inline-block;
  padding:14px;
  background:#ffffff;
  border:1px solid #e5e7eb;
  border-radius:12px;
">

<img
  src="${qrCode}"
  alt="Booking QR Code"
  width="190"
  height="190"
  style="
    display:block;
    width:190px;
    height:190px;
  "
/>

</div>

<p style="
  margin:15px 0 0;
  color:#9ca3af;
  font-size:11px;
">
  Keep this email handy when you arrive at the theatre.
</p>

</td>
</tr>

<!-- IMPORTANT -->

<tr>
<td style="padding:0 30px 25px;">

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    background:#fff7ed;
    border:1px solid #fed7aa;
    border-radius:10px;
  "
>

<tr>
<td style="padding:15px;">

<p style="
  margin:0 0 8px;
  color:#9a3412;
  font-size:13px;
  font-weight:bold;
">
  Before you arrive
</p>

<p style="
  margin:0;
  color:#7c2d12;
  font-size:12px;
  line-height:1.7;
">
  Please arrive at least 15–20 minutes before the show.
  Carry your digital ticket and a valid ID if required by the theatre.
</p>

</td>
</tr>

</table>

</td>
</tr>

<!-- FOOTER -->

<tr>
<td
  style="
    background:#09090b;
    padding:25px 20px;
    text-align:center;
  "
>

<p style="
  margin:0;
  color:#ffffff;
  font-size:15px;
  font-weight:bold;
">
  Enjoy the movie! 🍿
</p>

<p style="
  margin:8px 0 0;
  color:#71717a;
  font-size:11px;
  line-height:1.6;
">
  This is an automated booking confirmation from QuickBook.
  Please do not reply to this email.
</p>

<p style="
  margin:15px 0 0;
  color:#52525b;
  font-size:10px;
">
  © ${new Date().getFullYear()} QuickBook
</p>

</td>
</tr>

</table>

</td>
</tr>

</table>

</body>
</html>
`,

    text: `
QUICKBOOK - BOOKING CONFIRMED

Hi ${userName},

Your movie booking has been confirmed successfully.

BOOKING DETAILS
-------------------------
Booking ID : ${bookingId}
Movie      : ${movieName}
Theatre    : ${theaterName}
Screen     : ${screenName}
Date       : ${formattedDate}
Show Time  : ${formattedTime}
Seats      : ${seats.join(", ")}

PAYMENT
-------------------------
Amount Paid: ₹${amount}
Payment Status: SUCCESS

YOUR DIGITAL TICKET
-------------------------
Please show the QR code attached in this email at the theatre entrance.

IMPORTANT
-------------------------
Please arrive 15–20 minutes before the show.
Keep your booking confirmation and QR ticket ready.

Enjoy the movie! 🍿

QuickBook - Your movie. Your seats. Your experience.
`,
  };
};

module.exports = bookingTemplate;