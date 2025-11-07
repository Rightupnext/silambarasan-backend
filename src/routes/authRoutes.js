const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  decryptMiddleware,
  wrapEncryptedHandler,
} = require("../middleware/encryption");

const isEncryptionEnabled = process.env.ENCRYPTION_ENABLED === "true";

// 🔧 Helper to conditionally wrap handlers with encryption
const withEncryption = (handler) => {
  if (isEncryptionEnabled) {
    return [decryptMiddleware, wrapEncryptedHandler(handler)];
  }
  return [handler];
};

// 👤 Normal User Registration
router.post("/register", ...withEncryption(authController.register));

// 💼 Affiliate Registration
router.post("/register-affiliate", ...withEncryption(authController.registerAffiliate));

// 🔐 Login Route
router.post("/login", ...withEncryption(authController.login));

router.post("/forgot-password", ...withEncryption(authController.forgotPassword));
router.post("/verify-otp", ...withEncryption(authController.verifyOtp));
router.post("/reset-password", ...withEncryption(authController.resetPassword));

module.exports = router;
