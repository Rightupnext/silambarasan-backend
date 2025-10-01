const { MetaInfo, StandardCheckoutPayRequest } = require("pg-sdk-node");
const { randomUUID } = require("crypto");
const phonePeClient = require("../middleware/phonepeClient"); // singleton client
const db = require("../db");
// ✅ 1. Initiate PhonePe Payment
exports.initiatePayment = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const merchantOrderId = randomUUID();
    const redirectUrl = `${process.env.FRONTEND_URL}/payment-success`;

    const metaInfo = MetaInfo.builder().udf1("order-udf1").build();

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(Number(amount) * 100) // paisa
      .redirectUrl(redirectUrl)
      .metaInfo(metaInfo)
      .build();

    const response = await phonePeClient.pay(request);

    res.json({
      checkoutUrl: response.redirectUrl,
      orderId: response.orderId,
      state: response.state,
    });
  } catch (err) {
    console.error("Error initiating PhonePe payment:", err);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
};

// ✅ 2. Save order after PhonePe payment success
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
      phonepe_token,
      barcodeData, // optional
    } = req.body;

    if (!customer || !cartItems || !phonepe_order_id) {
      return res.status(400).json({ error: "Missing required data" });
    }

    const query = `
      INSERT INTO full_orders (
        customer_id, customer_name, customer_email, customer_phone, customer_address,
        subtotal, shipping, tax, total,
        phonepe_order_id, phonepe_token, phonepe_payment_status,
        cart_items, Barcode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      customer.id || null,
      customer.name || null,
      customer.email || null,
      customer.phone || null,
      customer.address || null,
      subtotal || 0,
      shipping || 0,
      tax || 0,
      total || 0,
      phonepe_order_id,
      phonepe_token,
      "done", // mark payment as done
      JSON.stringify(cartItems),
      barcodeData ? JSON.stringify(barcodeData) : null
    ];

    await db.query(query, values);

    res.json({ message: "Order saved successfully" });
  } catch (err) {
    console.error("Error saving order:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
};
