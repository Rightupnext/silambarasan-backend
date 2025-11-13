// controllers/orderController.js
const db = require("../db");
require("dotenv").config();

const { CreateSdkOrderRequest,crypto } = require("pg-sdk-node");
const { randomUUID } = require("crypto");
const phonepeClient = require("../middleware/phonepeClient");


// CREATE  Order and Save Temp Order with failed status
exports.createOrder = async (req, res) => {
  try {
    const { customer, amount } = req.body; // amount in paisa
    const merchantOrderId = randomUUID();

    // Must be HTTPS + public URL (ngrok for local testing)
    const redirectUrl = process.env.PHONEPE_REDIRECT_URL;

    const request = CreateSdkOrderRequest.StandardCheckoutBuilder()
      .merchantOrderId(merchantOrderId)
      .amount(amount)
      .redirectUrl(redirectUrl)
      .build();

    const response = await phonepeClient.createSdkOrder(request);

    res.json({
      merchantOrderId,
      token: response.token,
      checkoutUrl: `https://sandbox-dashboard.phonepe.com/standard-checkout?token=${response.token}`
    });
  } catch (err) {
    console.error("PhonePe Create Order Error:", err.message || err);
    res.status(500).json({ error: "Failed to create PhonePe order" });
  }
};

// Confirm Order
exports.confirmOrder = async (req, res) => {
  try {
    const { merchantOrderId } = req.body;
    const response = await phonepeClient.getOrderStatus(merchantOrderId);
    res.json({
      merchantOrderId,
      state: response.state,
      paymentDetails: response.paymentDetails
    });
  } catch (err) {
    console.error("PhonePe Verify Order Error:", err.message || err);
    res.status(500).json({ error: "Failed to verify PhonePe order" });
  }
};

// Update Order
exports.updateOrder = async (req, res) => {
  const { orderId } = req.params;
  const {
    deliveryman_name,
    deliveryman_phone,
    otp,
    order_status,
    admin_issue_returnReply,
  } = req.body;

  try {
    // Fetch existing order info
    const [rows] = await db.query(
      `SELECT otp, order_status, deliveryman_name, deliveryman_phone, admin_issue_returnReply FROM full_orders WHERE id = ?`,
      [orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const existing = rows[0];
    const cleanedOtp = (otp || "").toString().trim();
    const updates = [];
    let finalStatus = existing.order_status;

    // Check OTP
    if (cleanedOtp) {
      if (cleanedOtp !== existing.otp) {
        return res.status(400).json({ error: "Invalid OTP provided." });
      } else {
        finalStatus = "delivered";
        updates.push("OTP verified and status updated to 'delivered'");
      }
    } else if (order_status && order_status !== existing.order_status) {
      finalStatus = order_status;
      updates.push("Order status updated");
    }

    // Compare other fields and record changes
    if (deliveryman_name && deliveryman_name !== existing.deliveryman_name) {
      updates.push("Deliveryman name updated");
    }

    if (deliveryman_phone && deliveryman_phone !== existing.deliveryman_phone) {
      updates.push("Deliveryman phone updated");
    }

    if (
      admin_issue_returnReply &&
      admin_issue_returnReply !== existing.admin_issue_returnReply
    ) {
      updates.push("Admin issue reply updated");
    }

    // If nothing actually changed, notify
    if (updates.length === 0) {
      return res.json({
        message: "No changes detected.",
        updated: false,
      });
    }

    // Perform update
    const [updateResult] = await db.query(
      `UPDATE full_orders
       SET 
         deliveryman_name = ?, 
         deliveryman_phone = ?, 
         order_status = ?, 
         admin_issue_returnReply = ?
       WHERE id = ?`,
      [
        deliveryman_name || existing.deliveryman_name,
        deliveryman_phone || existing.deliveryman_phone,
        finalStatus,
        admin_issue_returnReply || existing.admin_issue_returnReply,
        orderId,
      ]
    );

    return res.json({
      message: updates.join(", "),
      updated: true,
      finalStatus,
    });
  } catch (error) {
    console.error("Update Order Error:", error);
    return res.status(500).json({ error: "Failed to update order" });
  }
};

exports.clientUpdateOrderIssue = async (req, res) => {
  const { orderId } = req.params;
  const { issue_type, issue_description } = req.body;

  try {
    if (!issue_type || !issue_description) {
      return res.status(400).json({ error: "Missing issue details." });
    }

    const [result] = await db.query(
      `UPDATE full_orders 
       SET issue_type = ?, issue_description = ?
       WHERE id = ?`,
      [issue_type, issue_description, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Order not found or not updated." });
    }

    const [updatedRow] = await db.query(
      `SELECT id, issue_type, issue_description FROM full_orders WHERE id = ?`,
      [orderId]
    );

    res.json({
      message: "Issue details updated successfully.",
      updated: updatedRow[0],
    });
  } catch (error) {
    console.error("Client Issue Update Error:", error);
    res.status(500).json({ error: "Failed to update issue details." });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT fo.*, u.username, u.email
      FROM full_orders fo
      JOIN users u ON fo.customer_id = u.id
      ORDER BY fo.id DESC
    `);

    res.json(orders);
  } catch (error) {
    console.error("Get All Orders Error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

exports.getUserIdByOrder = async (req, res) => {
  const { customer_id } = req.query;

  try {
    let query = "SELECT * FROM full_orders";
    const params = [];

    if (customer_id) {
      query += " WHERE customer_id = ?";
      params.push(customer_id);
    }

    const [rows] = await db.query(query, params);

    res.json(rows);
  } catch (error) {
    console.error("Get All Orders Error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

exports.getOrderAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = "";
    if (startDate && endDate) {
      dateFilter = `AND DATE(created_at) BETWEEN '${startDate}' AND '${endDate}'`;
    }

    const [statusResults] = await db.query(`
      SELECT order_status, COUNT(*) as count, SUM(total) as totalAmount
      FROM full_orders
      WHERE phonepe_payment_status = 'done' ${dateFilter}
      GROUP BY order_status
    `);

    const [overall] = await db.query(`
      SELECT COUNT(*) as totalOrders, SUM(total) as totalRevenue
      FROM full_orders
      WHERE phonepe_payment_status = 'done' ${dateFilter}
    `);

    const [paymentHistory] = await db.query(`
      SELECT 
        DATE(created_at) AS date, 
        COUNT(*) AS orders,
        SUM(total) AS totalAmount
      FROM full_orders
      WHERE phonepe_payment_status = 'done' ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    const statusAnalytics = {
      pending: { count: 0, totalAmount: 0 },
      packed: { count: 0, totalAmount: 0 },
      shipped: { count: 0, totalAmount: 0 },
      delivered: { count: 0, totalAmount: 0 },
      "order-cancelled": { count: 0, totalAmount: 0 },
    };

    statusResults.forEach((row) => {
      if (statusAnalytics[row.order_status]) {
        statusAnalytics[row.order_status] = {
          count: row.count,
          totalAmount: parseFloat(row.totalAmount),
        };
      }
    });

    const analytics = {
      ...statusAnalytics,
      totalOrders: overall[0].totalOrders,
      totalRevenue: parseFloat(overall[0].totalRevenue),
      paymentHistory: paymentHistory.map((entry) => ({
        date: entry.date,
        orders: entry.orders,
        totalAmount: parseFloat(entry.totalAmount),
      })),
    };

    res.json(analytics);
  } catch (error) {
    console.error("Order Analytics Error:", error);
    res.status(500).json({ error: "Failed to generate order analytics" });
  }
};
