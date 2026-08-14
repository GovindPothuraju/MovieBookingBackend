const getLoginOTPTemplate = (otp) => {
  return `
  <div style="
    margin:0;
    padding:40px 16px;
    background:#05060A;
    font-family:Arial,Helvetica,sans-serif;
  ">

    <table
      align="center"
      cellpadding="0"
      cellspacing="0"
      width="100%"
      style="
        max-width:600px;
        background:#0b0c10;
        border-radius:18px;
        overflow:hidden;
        border:1px solid #27272a;
        box-shadow:0 12px 40px rgba(0,0,0,0.45);
      "
    >

      <!-- Header -->

      <tr>
        <td
          style="
            background:#09090b;
            padding:30px 20px;
            text-align:center;
            border-bottom:1px solid #27272a;
          "
        >

          <div style="
            font-size:28px;
            font-weight:800;
            letter-spacing:1px;
            color:#ffffff;
          ">
            CINE<span style="color:#ed1c24;">FLOW</span>
          </div>

          <p style="
            margin:8px 0 0;
            color:#71717a;
            font-size:12px;
            letter-spacing:0.5px;
          ">
            Admin Login
          </p>

        </td>
      </tr>

      <!-- Main Content -->

      <tr>
        <td style="padding:42px 32px;">

          <div style="
            width:58px;
            height:58px;
            line-height:58px;
            margin:0 auto 22px;
            border-radius:50%;
            background:#ed1c24;
            color:#ffffff;
            text-align:center;
            font-size:26px;
            font-weight:bold;
            box-shadow:0 0 25px rgba(237,28,36,0.35);
          ">
            🔐
          </div>

          <h2 style="
            margin:0 0 14px;
            color:#ffffff;
            font-size:25px;
            text-align:center;
            font-weight:700;
          ">
            Verify Your Identity
          </h2>

          <p style="
            margin:0 auto 28px;
            max-width:460px;
            color:#a1a1aa;
            font-size:15px;
            line-height:1.7;
            text-align:center;
          ">
            Use the One-Time Password (OTP) below to complete your login.
          </p>

          <!-- OTP -->

          <table
            align="center"
            cellpadding="0"
            cellspacing="8"
            style="margin:25px auto;"
          >
            <tr>
              ${otp
                .split("")
                .map(
                  (digit) => `
                    <td
                      style="
                        width:52px;
                        height:62px;
                        background:#141416;
                        border:1px solid #3f3f46;
                        border-radius:10px;
                        text-align:center;
                        vertical-align:middle;
                        font-size:29px;
                        font-weight:700;
                        color:#ffffff;
                        box-shadow:inset 0 0 12px rgba(255,255,255,0.02);
                      "
                    >
                      ${digit}
                    </td>
                  `
                )
                .join("")}
            </tr>
          </table>

          <!-- Expiry -->

          <div style="
            margin:28px auto;
            max-width:430px;
            padding:13px 16px;
            background:#2a1113;
            border:1px solid #4a181c;
            border-radius:10px;
            text-align:center;
          ">

            <p style="
              margin:0;
              color:#f87171;
              font-size:14px;
              font-weight:600;
            ">
              This OTP is valid for only <strong>5 minutes</strong>.
            </p>

          </div>

          <div style="
            height:1px;
            background:#27272a;
            margin:32px 0;
          "></div>

          <p style="
            margin:0;
            color:#71717a;
            font-size:13px;
            line-height:1.7;
            text-align:center;
          ">
            If you didn't request this login, you can safely ignore this email.
            Your account remains secure.
          </p>

        </td>
      </tr>

      <!-- Footer -->

      <tr>
        <td
          style="
            background:#09090b;
            padding:22px 20px;
            text-align:center;
            border-top:1px solid #27272a;
          "
        >

          <p style="
            margin:0;
            color:#52525b;
            font-size:12px;
          ">
            © ${new Date().getFullYear()} Admin Panel. All rights reserved.
          </p>

        </td>
      </tr>

    </table>

  </div>
  `;
};

module.exports = { getLoginOTPTemplate };