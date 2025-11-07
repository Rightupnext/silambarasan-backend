const express = require("express");
const router = express.Router();
const affiliateController = require("../controllers/affiliateControllers");
const {
  decryptMiddleware,
  wrapEncryptedHandler,
} = require("../middleware/encryption");

const isEncryptionEnabled = process.env.ENCRYPTION_ENABLED === "true";
const withEncryption = (handler) =>
  isEncryptionEnabled ? [decryptMiddleware, wrapEncryptedHandler(handler)] : [handler];

// ✅ Get pending affiliates
router.get("/pending", ...withEncryption(affiliateController.getPendingAffiliates));

// ✅ Get all approved affiliates
router.get("/all", ...withEncryption(affiliateController.getAllAffiliates));

// ✅ Approve affiliate
router.put("/approve/:id", ...withEncryption(affiliateController.approveAffiliate));

// ✏️ Update affiliate details
router.put("/update/:id", ...withEncryption(affiliateController.updateAffiliate));

// 🗑️ Delete affiliate
router.delete("/delete/:id", ...withEncryption(affiliateController.deleteAffiliate));

module.exports = router;
