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
// exports.paymentSuccess = async (req, res) => {
//   try {
//     const {
//       customer,
//       cartItems,
//       subtotal,
//       shipping,
//       tax,
//       total,
//       phonepe_order_id,
//     } = req.body;

//     if (!customer || !cartItems || !phonepe_order_id)
//       return res.status(400).json({ error: "Missing required data" });

//     // Start a transaction
//     const connection = await db.getConnection();
//     await connection.beginTransaction();

//     try {
//       // 1. Update the pending order as successful
//       await connection.query(
//         `UPDATE full_orders 
//          SET customer_id=?, customer_name=?, customer_email=?, customer_phone=?, customer_address=?,state=?, city=?, pin=?,
//              subtotal=?, shipping=?, tax=?, total=?, phonepe_payment_status=?, cart_items=? 
//          WHERE phonepe_order_id=?`,
//         [
//           customer.id || null,
//           customer.name || "",
//           customer.email || "",
//           customer.phone || "",
//           customer.address || "",
//           customer.state || "",   // new
//           customer.city || "",    // new
//           customer.pin || "",     // new
//           subtotal || 0,
//           shipping || 0,
//           tax || 0,
//           total || 0,
//           "done",
//           JSON.stringify(cartItems),
//           phonepe_order_id,
//         ]
//       );

//       // 2. Reduce quantity in inventory_variants for each cart item
//       for (const item of cartItems) {
//         const { id: productId, selectedColor, selectedSize, quantity } = item;
//         console.log("cartItems", productId, selectedColor, selectedSize, quantity)

//         // Get current quantity
//         const [rows] = await connection.query(
//           `SELECT quantity FROM inventory_variants 
//            WHERE product_id = ? AND color = ? AND size = ?`,
//           [productId, selectedColor, selectedSize]
//         );

//         if (rows.length === 0) continue; // variant not found

//         const currentQty = rows[0].quantity;
//         const newQty = Math.max(currentQty - quantity, 0);

//         // Update quantity
//         await connection.query(
//           `UPDATE inventory_variants 
//            SET quantity = ? 
//            WHERE product_id = ? AND color = ? AND size = ?`,
//           [newQty, productId, selectedColor, selectedSize]
//         );
//       }

//       // Commit transaction
//       await connection.commit();
//       connection.release();

//       res.json({ message: "Order saved, payment verified, and inventory updated successfully" });
//     } catch (err) {
//       await connection.rollback();
//       connection.release();
//       throw err;
//     }
//   } catch (err) {
//     console.error("Failed to save order:", err);
//     res.status(500).json({ error: "Failed to save order" });
//   }
// };


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
      referral_code, // optional affiliate tracking
    } = req.body;

    if (!customer || !cartItems?.length || !phonepe_order_id) {
      return res.status(400).json({ error: "Missing required data" });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // 1️⃣ Update order details
      await connection.query(
        `UPDATE full_orders
         SET
            customer_id = ?,
            customer_name = ?,
            customer_email = ?,
            customer_phone = ?,
            customer_address = ?,
            state = ?,
            city = ?,
            pin = ?,
            subtotal = ?,
            shipping = ?,
            tax = ?,
            total = ?,
            phonepe_payment_status = ?,
            cart_items = ?,
            referral_code = ?
         WHERE phonepe_order_id = ?`,
        [
          customer.id || null,
          customer.name || "",
          customer.email || "",
          customer.phone || "",
          customer.address || "",
          customer.state || "",
          customer.city || "",
          customer.pin || "",
          subtotal || 0,
          shipping || 0,
          tax || 0,
          total || 0,
          "done",
          JSON.stringify(cartItems),
          referral_code || null,
          phonepe_order_id,
        ]
      );

      // 2️⃣ Reduce inventory
      for (const item of cartItems) {
        const { id: productId, selectedColor, selectedSize, quantity } = item;

        const [rows] = await connection.query(
          `SELECT quantity FROM inventory_variants
           WHERE product_id = ? AND color = ? AND size = ?`,
          [productId, selectedColor, selectedSize]
        );

        if (!rows.length) continue;

        const newQty = Math.max(rows[0].quantity - quantity, 0);

        await connection.query(
          `UPDATE inventory_variants
           SET quantity = ?
           WHERE product_id = ? AND color = ? AND size = ?`,
          [newQty, productId, selectedColor, selectedSize]
        );
      }

      // 3️⃣ Affiliate Commission Logic
      if (referral_code && referral_code.trim() !== "") {
        console.log("✅ Referral code detected:", referral_code);

        const [affiliateLink] = await connection.query(
          `SELECT affiliate_id, product_id FROM affiliate_links
           WHERE referral_code = ?`,
          [referral_code]
        );

        if (affiliateLink.length > 0) {
          const affiliateId = affiliateLink[0].affiliate_id;
          const linkedProductId = affiliateLink[0].product_id;

          const matchingProduct = cartItems.find(
            (item) => item.id === linkedProductId
          );

          if (matchingProduct) {
            // 🔹 Get commission number (treat it as %)
            const [commissionSetting] = await connection.query(
              `SELECT commission_amount FROM commission_settings LIMIT 1`
            );

            const commissionPercent =
              commissionSetting.length > 0
                ? commissionSetting[0].commission_amount
                : 5; // fallback 5%

            // 🔹 Calculate commission (as percentage of total)
            const commissionAmount = (total * commissionPercent) / 100;

            // 🔹 Update affiliate stats
            await connection.query(
              `UPDATE affiliate_links
               SET total_sales = total_sales + 1,
                   commission_earned = commission_earned + ?
               WHERE referral_code = ?`,
              [commissionAmount, referral_code]
            );

            // 🔹 Record commission
            await connection.query(
              `INSERT INTO affiliate_commissions
               (affiliate_id, product_id, referral_code, order_id, commission_amount)
               VALUES (?, ?, ?, ?, ?)`,
              [
                affiliateId,
                linkedProductId,
                referral_code,
                phonepe_order_id,
                commissionAmount,
              ]
            );

            console.log(
              `💰 ${commissionPercent}% of ₹${total} = ₹${commissionAmount.toFixed(
                2
              )} credited to affiliate ID ${affiliateId}`
            );
          } else {
            console.log("⚠️ Referral code not linked to any purchased product.");
          }
        } else {
          console.log("⚠️ Invalid referral code — no commission credited.");
        }
      } else {
        console.log("🧾 Normal order — no referral code provided.");
      }

      // ✅ Commit transaction
      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message:
          referral_code && referral_code.trim() !== ""
            ? "✅ Order saved, payment verified, and percentage commission credited."
            : "✅ Order saved and payment verified successfully.",
      });
    } catch (err) {
      await connection.rollback();
      connection.release();
      console.error("❌ Transaction failed:", err);
      res.status(500).json({ error: "Failed to complete order transaction" });
    }
  } catch (err) {
    console.error("❌ Server Error in paymentSuccess:", err);
    res.status(500).json({ error: "Internal Server Error" });
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




