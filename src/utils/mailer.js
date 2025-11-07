const nodemailer = require("nodemailer");

exports.transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",       // ✅ Hostinger SMTP server
  port: 465,                        // or 587
  secure: true,                     // true for port 465
  auth: {
    user: "support@thirdborn.in", // your Hostinger email
    pass: "Thirdborn@2025",     // your Hostinger email password (or app password)
  },
});

exports.sendMail = async (to, subject, html) => {
  try {
    await exports.transporter.sendMail({
      from: `"Third Born E Commerce " <support@thirdborn.in>`,
      to,
      subject,
      html,
    });
    console.log("✅ Mail sent successfully to:", to);
  } catch (err) {
    console.error("❌ Mail send error:", err);
  }
};
