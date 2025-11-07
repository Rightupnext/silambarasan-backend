const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  decryptMiddleware,
  wrapEncryptedHandler,
} = require("../middleware/encryption");
const { initiatePayment, paymentSuccess,verifyPaymentStatus } =require("../controllers/phonepeController.js");
const isEncryptionEnabled = process.env.ENCRYPTION_ENABLED === "true";

const withEncryption = (handler) =>
  isEncryptionEnabled
    ? [decryptMiddleware, wrapEncryptedHandler(handler)]
    : [handler];


// Protected routes with conditional encryption and authentication

router.get(
  "/get-all-order",
  authenticate,
  authorizeRoles("admin", 'D-partner'),
  ...withEncryption(orderController.getAllOrders)
);

router.get(
  "/get-useridby-order",
  authenticate,
  authorizeRoles('admin', 'super-admin', 'customer', 'D-partner'),
  ...withEncryption(orderController.getUserIdByOrder)
);
router.get(
  "/order-analytics",
  authenticate,
  authorizeRoles('admin', 'super-admin', 'D-partner'),
  ...withEncryption(orderController.getOrderAnalytics)
);

router.put(
  "/admin-update-order/:orderId",
  authenticate,
  authorizeRoles("admin", 'D-partner'),
  ...withEncryption(orderController.updateOrder)
);

router.put(
  "/client-update-order/:orderId",
  authenticate,
  authorizeRoles('admin', 'super-admin', 'D-partner'),
  ...withEncryption(orderController.clientUpdateOrderIssue)
);
// Initiate PhonePe payment
router.post("/initiate",authenticate,
  authorizeRoles('admin', 'super-admin','customer','D-partner'), ...withEncryption(initiatePayment));

// Save order after payment success
router.post("/payment-success",authenticate,
  authorizeRoles('admin', 'super-admin','customer','D-partner'), ...withEncryption( paymentSuccess));
router.get("/verify",authenticate,
  authorizeRoles('admin', 'super-admin','customer','D-partner'), ...withEncryption( verifyPaymentStatus));
module.exports = router;
