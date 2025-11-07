const db = require("../db");

/**
 * GET - Get Current Commission Amount
 */
exports.getCommissionAmount = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT commission_amount FROM commission_settings LIMIT 1`
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        commission_amount: 0,
        message: "No commission setting found.",
      });
    }

    res.json({
      success: true,
      commission_amount: rows[0].commission_amount,
    });
  } catch (err) {
    console.error("❌ Failed to fetch commission amount:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * PUT - Update Commission Amount (in ₹)
 */
exports.updateCommissionAmount = async (req, res) => {
  try {
    const { commission_amount } = req.body;

    if (!commission_amount || isNaN(commission_amount)) {
      return res.status(400).json({ error: "Invalid commission amount" });
    }

    await db.query(
      `UPDATE commission_settings SET commission_amount = ?, updated_at = NOW() WHERE id = 1`,
      [commission_amount]
    );

    res.json({
      success: true,
      message: `Commission updated to ₹${commission_amount}`,
    });
  } catch (err) {
    console.error("❌ Failed to update commission amount:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
