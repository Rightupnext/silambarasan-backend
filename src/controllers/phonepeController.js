const { MetaInfo, StandardCheckoutPayRequest, CreateSdkOrderRequest } = require("pg-sdk-node");
const { randomUUID } = require("crypto");
const phonePeClient = require("../middleware/phonepeClient"); // ✅ singleton client

// ✅ 1. Initiate Payment
exports.initiatePayment = async (req, res) => {
  try {
    const { amount } = req.query;
    const merchantOrderId = randomUUID();
    const redirectUrl = `${process.env.FRONTEND_URL}/payment/callback`;

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
    console.error("Error initiating payment:", err);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
};

// ✅ 2. Create SDK Order (for Mobile App flow)
exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.query;
    const merchantOrderId = randomUUID();
    const redirectUrl = `${process.env.FRONTEND_URL}/payment/callback`;

    const request = CreateSdkOrderRequest.StandardCheckoutBuilder()
      .merchantOrderId(merchantOrderId)
      .amount(Number(amount) * 100)
      .redirectUrl(redirectUrl)
      .build();

    const response = await phonePeClient.createSdkOrder(request);

    return res.json({
      token: response.token,
      orderId: response.orderId,
      state: response.state,
    });
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
};

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
