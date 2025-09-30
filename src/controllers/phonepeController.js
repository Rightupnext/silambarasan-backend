const {
  MetaInfo,
  StandardCheckoutPayRequest,
  CreateSdkOrderRequest,
} = require("pg-sdk-node");
const { randomUUID } = require("crypto");
const phonePeClient = require("../middleware/phonepeClient"); // ✅ singleton client
const db = require("../db");
// ✅ 1. Initiate Payment
exports.initiatePayment = async (req, res) => {
  try {
    const { amount } = req.query;
    const merchantOrderId = randomUUID();
    const redirectUrl = `${process.env.FRONTEND_URL}/cart`;

    const metaInfo = MetaInfo.builder().udf1("order-udf1").build();

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(Number(amount) * 100) // paisa
      .redirectUrl(redirectUrl)
      .metaInfo(metaInfo)
      .build();

    const response = await phonePeClient.pay(request);
    console.log("response",response)

    res.json({
      checkoutUrl: response.redirectUrl,
      orderId: response.orderId,
      state: response.state,
    });
  } catch (err) {
    console.error("Error initiating payment:", err);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
};

// ✅ 2. Create SDK Order (for Mobile App flow)
// exports.createOrder = async (req, res) => {
//   try {
//     const { amount } = req.query;
//     const merchantOrderId = randomUUID();
//     const redirectUrl = `${process.env.FRONTEND_URL}/payment/callback`;

//     const request = CreateSdkOrderRequest.StandardCheckoutBuilder()
//       .merchantOrderId(merchantOrderId)
//       .amount(Number(amount) * 100)
//       .redirectUrl(redirectUrl)
//       .build();

//     const response = await phonePeClient.createSdkOrder(request);

//     return res.json({
//       token: response.token,
//       orderId: response.orderId,
//       state: response.state,
//     });
//   } catch (err) {
//     console.error("Error creating order:", err);
//     res.status(500).json({ error: "Failed to create order" });
//   }
// };

// ✅ 3. Get Order Status
exports.getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const response = await phonePeClient.getOrderStatus(orderId);

    return res.json({
      orderId: response.orderId,
      state: response.state,
      amount: response.amount,
      paymentDetails: response.paymentDetails,
    });
  } catch (err) {
    console.error("Error fetching order status:", err);
    res.status(500).json({ error: "Failed to fetch order status" });
  }
};

// ✅ 4. Refund Payment
exports.refundPayment = async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    const response = await phonePeClient.refund(orderId, Number(amount) * 100);

    return res.json({
      refundId: response.refundId,
      state: response.state,
    });
  } catch (err) {
    console.error("Error initiating refund:", err);
    res.status(500).json({ error: "Failed to initiate refund" });
  }
};
// src/controllers/phonepeController.js

exports.createOrder = async (req, res) => {
  const { customer, cartItems, subtotal, shipping, tax, total } = req.body;
  try {
    // Generate PhonePe SDK Order
    const merchantOrderId = randomUUID();
    const redirectUrl = `${process.env.FRONTEND_URL}/payment/callback`;

    const request = CreateSdkOrderRequest.StandardCheckoutBuilder()
      .merchantOrderId(merchantOrderId)
      .amount(total * 100) // paisa
      .redirectUrl(redirectUrl)
      .build();

    const phonePeOrder = await phonePeClient.createSdkOrder(request);

    // Save order to DB
    await db.query(
      `INSERT INTO full_orders (
        customer_id, customer_name, customer_email, customer_phone, customer_address,
        subtotal, shipping, tax, total,
        phonepe_order_id,
        phonepe_token,
        phonepe_payment_status,
        cart_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer.id,
        customer.name,
        customer.email,
        customer.phone,
        customer.address,
        subtotal,
        shipping,
        tax,
        total,
        phonePeOrder.orderId,
        phonePeOrder.token,
        "pending",             // phonePe status
        JSON.stringify(cartItems)
      ]
    );

    res.json({
      orderId: phonePeOrder.orderId,
      token: phonePeOrder.token,
      redirectUrl: phonePeOrder.redirectUrl,
    });
  } catch (err) {
    console.error("Create PhonePe Order Error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
};

exports.confirmOrder = async (req, res) => {
  const { orderId } = req.body; // PhonePe orderId from callback

  try {
    const response = await phonePeClient.getOrderStatus(orderId);

    if (response.state === "SUCCESS") {
      // Update DB with payment status
      await db.query(
        `UPDATE full_orders SET payment_status = 'done' WHERE phonepe_order_id = ?`,
        [orderId]
      );

      res.json({ message: "Payment successful" });
    } else {
      res.status(400).json({ error: "Payment failed or pending" });
    }
  } catch (err) {
    console.error("Confirm PhonePe Order Error:", err);
    res.status(500).json({ error: "Failed to confirm order" });
  }
};
