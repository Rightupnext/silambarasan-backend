// controllers/orderController.js
const { 
  MetaInfo, 
  StandardCheckoutPayRequest, 
  StandardCheckoutPayStatusRequest  
} = require("pg-sdk-node");
const { randomUUID } = require("crypto");
const { phonePeClient } = require("../middleware/phonepeClient");
const db = require("../db");
// 1️⃣ Initiate PhonePe Payment
exports.initiatePayment = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Invalid amount" });

    const merchantOrderId = randomUUID();
    const redirectUrl = `${process.env.FRONTEND_URL}/payment-callback?orderId=${merchantOrderId}`;

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(Number(amount) * 100) // paisa
      .redirectUrl(redirectUrl)
      .metaInfo(MetaInfo.builder().udf1("order-udf1").build())
      .build();

    const response = await phonePeClient.pay(request);

    // Save a temporary "pending" order in DB
    await db.query(
      `INSERT INTO full_orders (phonepe_order_id, phonepe_payment_status) VALUES (?, ?)`,
      [merchantOrderId, "pending"]
    );

    res.json({
      checkoutUrl: response.redirectUrl,
      orderId: merchantOrderId,
      state: response.state,
    });
  } catch (err) {
    console.error("Error initiating PhonePe payment:", err);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
};

// 2️⃣ Save order after frontend callback
exports.paymentSuccess = async (req, res) => {
  try {
    const {
      customer,
      cartItems,
      subtotal,
      shipping,
      tax,
      total,
      phonepe_order_id,
    } = req.body;

    if (!customer || !cartItems || !phonepe_order_id)
      return res.status(400).json({ error: "Missing required data" });

    // Update the pending order as successful
    await db.query(
      `UPDATE full_orders 
       SET customer_id=?, customer_name=?, customer_email=?, customer_phone=?, customer_address=?,
           subtotal=?, shipping=?, tax=?, total=?, phonepe_payment_status=?, cart_items=? 
       WHERE phonepe_order_id=?`,
      [
        customer.id || null,
        customer.name || "",
        customer.email || "",
        customer.phone || "",
        customer.address || "",
        subtotal || 0,
        shipping || 0,
        tax || 0,
        total || 0,
        "done",
        JSON.stringify(cartItems),
        phonepe_order_id,
      ]
    );

    res.json({ message: "Order saved and payment verified successfully" });
  } catch (err) {
    console.error("Failed to save order:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
};

// 3️⃣ Payment verification
exports.verifyPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.query;
    if (!orderId) {
      return res.status(400).json({ status: "failed", message: "Missing orderId" });
    }

    const response = await phonePeClient.getOrderStatus(orderId);
    console.log("PhonePe order status response:", response);

    // Use `state` from the response
    const orderState = response?.state;
    const paymentState = response?.paymentDetails?.[0]?.state; // fallback to first payment

    if (orderState === "COMPLETED" || paymentState === "COMPLETED") {
      // Mark order as done in DB
      await db.query(
        "UPDATE full_orders SET phonepe_payment_status='done' WHERE phonepe_order_id=?",
        [orderId]
      );
      return res.json({ status: "done", message: "Payment successful" });
    } else if (orderState === "FAILED" || paymentState === "FAILED") {
      return res.json({ status: "failed", message: "Payment failed" });
    } else {
      return res.json({ status: "pending", message: "Payment not completed or expired" });
    }
  } catch (err) {
    console.error("Payment verification failed:", err);
    return res.status(500).json({ status: "failed", message: "Internal server error" });
  }
};




