const express = require("express");
const router = express.Router();
const affiliateController = require("../controllers/affiliateController");

// ==========================
// 🧪 Affiliate Routes (No Encryption / No Auth)
// ==========================

// 🧩 Generate affiliate link
router.post("/generate", affiliateController.generateAffiliateLink);

// 👣 Track affiliate click (visitor clicked ?ref=)
router.get("/track-click", affiliateController.trackClick);

// 💰 Track sale (after payment success)
router.post("/track-sale", affiliateController.trackSale);

// 📊 Get affiliate stats/dashboard
router.get("/stats/:affiliate_id", affiliateController.getAffiliateStats);

// 🧮 Get total affiliate users count
router.get("/count", affiliateController.getAffiliateUsersCount);

// 📈 Get all affiliate stats (general)
router.get("/stats", affiliateController.getAffiliateStats);

// 🧾 Get full affiliate data (for admin overview)
router.get("/full", affiliateController.getAllAffiliaterFullData);

// 👤 Get single affiliate data by ID (for testing)
router.get("single/:affiliate_id", affiliateController.getAffiliateDetailsById);

module.exports = router;
