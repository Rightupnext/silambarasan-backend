const express = require("express");
const router = express.Router();
const {
  getCommissionAmount,
  updateCommissionAmount,
} = require("../controllers/commissionController");

// Get current commission
router.get("/commission", getCommissionAmount);

// Update commission (₹)
router.put("/commission", updateCommissionAmount);

module.exports = router;
