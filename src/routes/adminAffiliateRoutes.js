const express = require("express");
const router = express.Router();
const adminAffiliateController = require("../controllers/adminAffiliateController");

// Admin routes for managing affiliater users
router.get("/affiliaters", adminAffiliateController.adminGetAllAffiliaters);
router.get("/affiliaters/:id", adminAffiliateController.adminGetAffiliaterById);
router.put("/affiliaters/:id", adminAffiliateController.adminEditAffiliater);
router.delete("/affiliaters/:id", adminAffiliateController.adminDeleteAffiliater);

router.get("/affiliate/:id", adminAffiliateController.getAffiliateSummary);
router.get("/affiliate/summaries/all", adminAffiliateController.getAllAffiliateSummaries);
router.post("/affiliates/pay/:id", adminAffiliateController.adminPayAffiliate);
router.get("/affiliates/:id/payments", adminAffiliateController.getAffiliatePayments);

module.exports = router;
