const getLoginOTPTemplate = (otp) => {
  return `
  <div style="margin:0;padding:40px 20px;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
    <table align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

      <tr>
        <td style="background:#2563eb;padding:24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:28px;">
            Admin Login
          </h1>
        </td>
      </tr>

      <tr>
        <td style="padding:40px 32px;">

          <h2 style="margin:0 0 16px;color:#111827;font-size:24px;">
            Verify Your Identity
          </h2>

          <p style="margin:0 0 24px;color:#4b5563;font-size:16px;line-height:1.7;">
            Use the One-Time Password (OTP) below to complete your login.
          </p>

          <table align="center" cellpadding="0" cellspacing="8" style="margin:20px auto;">
            <tr>
              ${otp
                .split("")
                .map(
                  (digit) => `
                    <td
                      style="
                        width:55px;
                        height:65px;
                        background:#f8fafc;
                        border:2px solid #d1d5db;
                        border-radius:8px;
                        text-align:center;
                        font-size:32px;
                        font-weight:bold;
                        color:#111827;
                      "
                    >
                      ${digit}
                    </td>
                  `
                )
                .join("")}
            </tr>
          </table>

          <p style="margin-top:24px;text-align:center;color:#dc2626;font-size:15px;font-weight:bold;">
            This OTP is valid for only <strong>5 minutes</strong>.
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">

          <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.7;">
            If you didn't request this login, you can safely ignore this email.
            Your account remains secure.
          </p>

        </td>
      </tr>

      <tr>
        <td style="background:#f9fafb;padding:20px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#9ca3af;">
            © ${new Date().getFullYear()} Admin Panel. All rights reserved.
          </p>
        </td>
      </tr>

    </table>
  </div>
  `;
};

module.exports = {getLoginOTPTemplate};