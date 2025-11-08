const db = require("../db");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");
// const { hashPassword } = require("../utils/password");
const { sendMail } = require("../utils/mailer");

// ===============================
// Normal User Registration (NO CHANGE)
// ===============================
exports.register = async (req, res) => {
  const { name, email, password, confirmPassword, role, phone } = req.body;
  const username = name;

  if (!username || !email || !password || !confirmPassword || !phone) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashed = await hashPassword(password);

    await db.query(
      "INSERT INTO users (username, email, password, phone, role) VALUES (?, ?, ?, ?, ?)",
      [username, email, hashed, phone, role || "customer"]
    );

    res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err });
  }
};

// ===============================
// Affiliate Registration (UPDATED ONLY THIS)
// ===============================
exports.registerAffiliate = async (req, res) => {
  const { 
    name, 
    email, 
    password, 
    confirmPassword, 
    phone,
    city,
    bank_name,
    ifsc_code,
    account_number
  } = req.body;

  const username = name;

  // ✅ Validation for all fields
  if (
    !username ||
    !email ||
    !password ||
    !confirmPassword ||
    !phone ||
    !city ||
    !bank_name ||
    !ifsc_code ||
    !account_number
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    // ✅ Check if email already exists
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // ✅ Hash the password
    const hashed = await hashPassword(password);

    // ✅ Insert new affiliate with city
    await db.query(
      `INSERT INTO users 
        (username, email, password, phone, city, role, bank_name, ifsc_code, account_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        email,
        hashed,
        phone,
        city,
        "pending-affiliater",  // default role for new affiliates
        bank_name,
        ifsc_code,
        account_number
      ]
    );

    res.status(201).json({
      message: "Affiliate registered successfully. Awaiting admin approval."
    });

  } catch (err) {
    console.error("Affiliate registration error:", err);
    res.status(500).json({ message: "Server error during affiliate registration", error: err });
  }
};

// ===============================
// Login Function (NO CHANGE)
// ===============================
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [userRows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    const user = userRows[0];

    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await comparePassword(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken(user);

    res.json({
      message: "Login Successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        phone: user.phone,
        bank_name: user.bank_name,
        ifsc_code: user.ifsc_code,
        account_number: user.account_number,
      },
    });

  } catch (err) {
    res.status(500).json({ message: "Error", error: err });
  }
};




// ===============================
// Step 1: Request OTP
// ===============================
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // valid for 10 mins

    // Save OTP in DB
    await db.query("UPDATE users SET reset_otp = ?, otp_expiry = ? WHERE email = ?", [
      otp,
      expiry,
      email,
    ]);

    // Send mail
    const html = `
      <h2>Password Reset Request</h2>
      <p>Your OTP for password reset is:</p>
      <h3>${otp}</h3>
      <p>This OTP will expire in 10 minutes.</p>
    `;
    await sendMail(email, "Password Reset OTP", html);

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error sending OTP", error: err });
  }
};

// ===============================
// Step 2: Verify OTP
// ===============================
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp)
    return res.status(400).json({ message: "Email and OTP are required" });

  try {
    const [rows] = await db.query(
      "SELECT reset_otp, otp_expiry FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const user = rows[0];

    if (user.reset_otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (new Date() > new Date(user.otp_expiry))
      return res.status(400).json({ message: "OTP expired" });

    // OTP verified
    res.json({ message: "OTP verified successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error verifying OTP", error: err });
  }
};

// ===============================
// Step 3: Reset Password
// ===============================
exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword)
    return res.status(400).json({ message: "Email and new password required" });

  try {
    const hashed = await hashPassword(newPassword);

    await db.query(
      "UPDATE users SET password = ?, reset_otp = NULL, otp_expiry = NULL WHERE email = ?",
      [hashed, email]
    );

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (err) {
    res.status(500).json({ message: "Error resetting password", error: err });
  }
};