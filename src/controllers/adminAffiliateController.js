const db = require("../db");

// 📋 Get all affiliater users with full stats (for Admin)
// 📋 Get all affiliater users with full stats (for Admin)
exports.adminGetAllAffiliaters = async (req, res) => {
  try {
    const [affiliaters] = await db.query(`
      SELECT 
        u.id AS affiliater_id,
        u.username,
        u.email,
        u.phone,
        u.city,                  -- ✅ Added city
        u.bank_name,
        u.ifsc_code,
        u.account_number,
        COUNT(al.id) AS total_links,
        COALESCE(SUM(al.total_clicks), 0) AS total_clicks,
        COALESCE(SUM(al.total_sales), 0) AS total_sales,
        COALESCE(SUM(al.commission_earned), 0) AS total_commission
      FROM users u
      LEFT JOIN affiliate_links al ON u.id = al.affiliate_id
      WHERE u.role = 'affiliater'
      GROUP BY 
        u.id, u.username, u.email, u.phone, u.city,
        u.bank_name, u.ifsc_code, u.account_number
      ORDER BY total_commission DESC
    `);

    const [linkDetails] = await db.query(`
      SELECT 
        al.affiliate_id,
        al.referral_code,
        al.product_id,
        bi.product_name,
        al.total_clicks,
        al.total_sales,
        al.commission_earned,
        al.created_at
      FROM affiliate_links al
      LEFT JOIN boutique_inventory bi ON bi.id = al.product_id
    `);

    const affiliaterData = affiliaters.map((aff) => ({
      ...aff,
      links: linkDetails.filter((l) => l.affiliate_id === aff.affiliater_id),
    }));

    res.json({
      total_affiliaters: affiliaterData.length,
      affiliaters: affiliaterData,
    });
  } catch (error) {
    console.error("❌ Admin failed to get affiliaters:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// 🔍 Get single affiliater full details by ID
exports.adminGetAffiliaterById = async (req, res) => {
  const { id } = req.params;

  try {
    const [[affiliater]] = await db.query(
      `SELECT 
         id AS affiliater_id,
         username,
         email,
         phone,
         city,                  -- ✅ Already included
         bank_name,
         ifsc_code,
         account_number,
         role
       FROM users 
       WHERE id = ? AND role = 'affiliater'`,
      [id]
    );

    if (!affiliater)
      return res.status(404).json({ error: "Affiliater not found" });

    const [links] = await db.query(
      `SELECT 
         al.referral_code,
         al.full_referral_link,
         al.product_id,
         bi.product_name,
         al.total_clicks,
         al.total_sales,
         al.commission_earned,
         al.created_at
       FROM affiliate_links al
       LEFT JOIN boutique_inventory bi 
         ON bi.id = al.product_id
       WHERE al.affiliate_id = ?`,
      [id]
    );

    const [[summary]] = await db.query(
      `SELECT 
         COUNT(*) AS total_links,
         COALESCE(SUM(total_clicks), 0) AS total_clicks,
         COALESCE(SUM(total_sales), 0) AS total_sales,
         COALESCE(SUM(commission_earned), 0) AS total_commission
       FROM affiliate_links 
       WHERE affiliate_id = ?`,
      [id]
    );

    res.json({
      affiliater,
      summary,
      links
    });

  } catch (error) {
    console.error("❌ Admin failed to fetch affiliater:", error.message);
    res.status(500).json({ error: error.message });
  }
};



// ✏️ Edit affiliater details
exports.adminEditAffiliater = async (req, res) => {
  const { id } = req.params;
  const { username, email, phone } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE users SET username = ?, email = ?, phone = ? 
       WHERE id = ? AND role = 'affiliater'`,
      [username, email, phone, id]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ error: "Affiliater not found or no changes made" });

    res.json({ message: "✅ Affiliater details updated successfully" });
  } catch (error) {
    console.error("❌ Admin failed to update affiliater:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// ❌ Delete affiliater user and all related data
exports.adminDeleteAffiliater = async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `DELETE FROM affiliate_links WHERE affiliate_id = ?`,
      [id]
    );
    await connection.query(
      `DELETE FROM users WHERE id = ? AND role = 'affiliater'`,
      [id]
    );

    await connection.commit();
    res.json({
      message: "🗑️ Affiliater and all related data deleted successfully",
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Admin failed to delete affiliater:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// 💰 Get total earnings (summary) of one affiliater
exports.getAffiliateSummary = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT 
         affiliate_id,
         COALESCE(SUM(commission_earned), 0) AS total_earnings,
         COALESCE(SUM(total_sales), 0) AS total_sales,
         COALESCE(SUM(total_clicks), 0) AS total_clicks
       FROM affiliate_links
       WHERE affiliate_id = ?
       GROUP BY affiliate_id`,
      [id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Affiliate not found" });

    res.status(200).json({
      success: true,
      summary: rows[0],
    });
  } catch (error) {
    console.error("Error fetching affiliate summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch affiliate summary",
    });
  }
};

// 💼 Get total summary for all affiliates
exports.getAllAffiliateSummaries = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         affiliate_id,
         COALESCE(SUM(commission_earned), 0) AS total_earnings,
         COALESCE(SUM(total_sales), 0) AS total_sales,
         COALESCE(SUM(total_clicks), 0) AS total_clicks
       FROM affiliate_links
       GROUP BY affiliate_id`
    );

    res.status(200).json({
      success: true,
      summaries: rows,
    });
  } catch (error) {
    console.error("Error fetching all affiliate summaries:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch affiliate summaries",
    });
  }
};


// 💸 Record payment and reset commission
// 💸 Record payment automatically using total commission and reset commissions
exports.adminPayAffiliate = async (req, res) => {
  const { id } = req.params; // affiliate ID
  const { note } = req.body; // optional note

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1️⃣ Get the total commission for this affiliate
    const [[commissionSummary]] = await connection.query(
      `SELECT COALESCE(SUM(commission_earned), 0) AS total_commission
       FROM affiliate_links
       WHERE affiliate_id = ?`,
      [id]
    );

    const totalCommission = parseFloat(commissionSummary.total_commission || 0);

    if (totalCommission <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "❌ No commission available to pay for this affiliate.",
      });
    }

    // 2️⃣ Insert payment record (auto amount)
    await connection.query(
      `INSERT INTO affiliate_payments (affiliate_id, amount, note)
       VALUES (?, ?, ?)`,
      [id, totalCommission, note || "Automatic payout for earned commission"]
    );

    // 3️⃣ Reset commissions to zero
    await connection.query(
      `UPDATE affiliate_links 
       SET commission_earned = 0 
       WHERE affiliate_id = ?`,
      [id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "✅ Payment recorded and commissions reset.",
      payment: {
        affiliate_id: id,
        amount: totalCommission,
        date: new Date(),
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Admin payment failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to record payment.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};



exports.getAffiliatePayments = async (req, res) => {
  const { id } = req.params;
  try {
    const [payments] = await db.query(
      `SELECT * FROM affiliate_payments WHERE affiliate_id = ? ORDER BY payment_date DESC`,
      [id]
    );
    res.json({ success: true, payments });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payments" });
  }
};
