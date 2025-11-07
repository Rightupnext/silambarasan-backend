const db = require("../db");

// 🔗 Generate new affiliate link
// exports.generateAffiliateLink = async (req, res) => {
//   const { affiliate_id, product_id, product_url } = req.body;

//   if (!affiliate_id || !product_id || !product_url)
//     return res
//       .status(400)
//       .json({ error: "affiliate_id, product_id, and product_url are required" });

//   const referral_code = `AFF-${affiliate_id}-${product_id}-${Date.now()}`;

//   try {
//     // Insert new affiliate link into DB
//     await db.query(
//       `INSERT INTO affiliate_links (affiliate_id, product_id, referral_code)
//        VALUES (?, ?, ?)`,
//       [affiliate_id, product_id, referral_code]
//     );

//     // ✅ Just attach ?ref=... or &ref=... depending on URL
//     const hasQuery = product_url.includes("?");
//     const referral_link = `${product_url}${hasQuery ? "&" : "?"}ref=${referral_code}`;

//     res.json({
//       message: "✅ Affiliate link created successfully",
//       referral_link,
//     });
//   } catch (error) {
//     console.error("❌ Link creation failed:", error.message);
//     res.status(500).json({ error: error.message });
//   }
// };


exports.generateAffiliateLink = async (req, res) => {
  const { affiliate_id, product_id, product_url } = req.body;

  if (!affiliate_id || !product_id || !product_url) {
    return res.status(400).json({
      error: "affiliate_id, product_id, and product_url are required",
    });
  }

  // Generate a unique referral code
  const referral_code = `AFF-${affiliate_id}-${product_id}-${Date.now()}`;

  // Append the code to the URL
  const hasQuery = product_url.includes("?");
  const referral_link = `${product_url}${hasQuery ? "&" : "?"}ref=${referral_code}`;

  try {
    // Insert new affiliate link into DB (store both code and full link)
    await db.query(
      `INSERT INTO affiliate_links (affiliate_id, product_id, referral_code, full_referral_link)
       VALUES (?, ?, ?, ?)`,
      [affiliate_id, product_id, referral_code, referral_link]
    );

    res.json({
      message: "✅ Affiliate link created successfully",
      referral_code,
      referral_link,
    });
  } catch (error) {
    console.error("❌ Link creation failed:", error.message);
    res.status(500).json({ error: error.message });
  }
};





// 👣 Track referral link click
exports.trackClick = async (req, res) => {
  const ref = req.params.ref || req.query.ref;
  if (!ref) return res.status(400).json({ error: "Referral code missing" });

  try {
    // Increment click count
    const [result] = await db.query(
      `UPDATE affiliate_links SET total_clicks = total_clicks + 1 WHERE referral_code = ?`,
      [ref]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Invalid referral code" });

    res.json({ message: "✅ Click recorded successfully", referral_code: ref });
  } catch (error) {
    console.error("❌ Click tracking failed:", error.message);
    res.status(500).json({ error: error.message });
  }
};



// 👀 Track referral link click

// 💸 Track sale after payment success
exports.trackSale = async (req, res) => {
  const { referral_code, product_id, order_id, commission_amount = 100 } = req.body;

  if (!referral_code || !product_id || !order_id)
    return res.status(400).json({ error: "Missing required fields" });

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Update main affiliate link stats
    await connection.query(
      `UPDATE affiliate_links 
       SET total_sales = total_sales + 1,
           commission_earned = commission_earned + ?
       WHERE referral_code = ?`,
      [commission_amount, referral_code]
    );

    // Log commission history
    const [linkRow] = await connection.query(
      `SELECT affiliate_id FROM affiliate_links WHERE referral_code = ?`,
      [referral_code]
    );

    if (linkRow.length > 0) { 
      await connection.query( 
        `INSERT INTO affiliate_commissions (affiliate_id, product_id, referral_code, order_id, commission_amount)
         VALUES (?, ?, ?, ?, ?)`,
        [
          linkRow[0].affiliate_id,
          product_id,
          referral_code,
          order_id,
          commission_amount,
        ]
      );
    }

    await connection.commit();
    res.json({ message: "✅ Sale tracked and commission recorded" });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Sale tracking failed:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// 📊 Get affiliate dashboard
exports.getAffiliateStats = async (req, res) => {
  const { affiliate_id } = req.params;

  try {
    const [links] = await db.query(
      `SELECT 
         al.product_id, 
         bi.product_name, 
         al.referral_code, 
         al.total_clicks, 
         al.total_sales, 
         al.commission_earned
       FROM affiliate_links al
       JOIN boutique_inventory bi ON al.product_id = bi.id
       WHERE al.affiliate_id = ?`,
      [affiliate_id]
    );

    const [summary] = await db.query(
      `SELECT 
         SUM(total_clicks) AS total_clicks,
         SUM(total_sales) AS total_sales,
         SUM(commission_earned) AS total_commission
       FROM affiliate_links WHERE affiliate_id = ?`,
      [affiliate_id]
    );

    res.json({
      summary: summary[0] || {},
      links,
    });
  } catch (error) {
    console.error("❌ Failed to fetch affiliate stats:", error.message);
    res.status(500).json({ error: error.message });
  }
};
// 👥 Get total number of affiliater users
exports.getAffiliateUsersCount = async (req, res) => {
  try {
    const [result] = await db.query(
      `SELECT COUNT(*) AS total_affiliaters FROM users WHERE role = 'affiliater'`
    );
    res.json({ total_affiliaters: result[0].total_affiliaters });
  } catch (error) {
    console.error("❌ Failed to get affiliater user count:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// 📋 Get all affiliater users with stats
exports.getAllAffiliateUsers = async (req, res) => {
  try {
    const [affiliaters] = await db.query(`
      SELECT 
        u.id AS affiliater_id,
        u.username,
        u.email,
        COUNT(al.id) AS total_links,
        COALESCE(SUM(al.total_clicks), 0) AS total_clicks,
        COALESCE(SUM(al.total_sales), 0) AS total_sales,
        COALESCE(SUM(al.commission_earned), 0) AS total_commission
      FROM users u
      LEFT JOIN affiliate_links al ON u.id = al.affiliate_id
      WHERE u.role = 'affiliater'
      GROUP BY u.id, u.username, u.email
      ORDER BY total_commission DESC
    `);

    res.json({ affiliaters });
  } catch (error) {
    console.error("❌ Failed to fetch affiliater users:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// 📊 Get all affiliater users with their full stats & link details
exports.getAllAffiliaterFullData = async (req, res) => {
  try {
    // Fetch affiliater summary + link stats
    const [affiliaters] = await db.query(`
      SELECT 
        u.id AS affiliater_id,
        u.username,
        u.email,
        u.phone,
        COUNT(al.id) AS total_links,
        COALESCE(SUM(al.total_clicks), 0) AS total_clicks,
        COALESCE(SUM(al.total_sales), 0) AS total_sales,
        COALESCE(SUM(al.commission_earned), 0) AS total_commission
      FROM users u
      LEFT JOIN affiliate_links al ON u.id = al.affiliate_id
      WHERE u.role = 'affiliater'
      GROUP BY u.id, u.username, u.email, u.phone
      ORDER BY total_commission DESC
    `);

    // Fetch all link details for affiliaters
    const [linkDetails] = await db.query(`
      SELECT 
        al.affiliate_id,
        al.referral_code,
        al.product_id,
        bi.product_name,
        al.total_clicks,
        al.total_sales,
        al.commission_earned
      FROM affiliate_links al
      LEFT JOIN boutique_inventory bi ON bi.id = al.product_id
    `);

    // Group link details under each affiliater
    const affiliaterData = affiliaters.map((aff) => {
      const links = linkDetails.filter(
        (link) => link.affiliate_id === aff.affiliater_id
      );
      return {
        ...aff,
        links, // array of link details
      };
    });

    res.json({
      total_affiliaters: affiliaterData.length,
      affiliaters: affiliaterData,
    });
  } catch (error) {
    console.error("❌ Failed to fetch affiliater full data:", error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.getAffiliateDetailsById = async (req, res) => {
  const { affiliate_id } = req.params;

  if (!affiliate_id)
    return res.status(400).json({ error: "affiliate_id is required" });

  try {
    // ✅ Get basic affiliate info
    const [[affiliate]] = await db.query(
      `SELECT id AS affiliater_id, username, email, phone
       FROM users
       WHERE id = ? AND role = 'affiliate'`,
      [affiliate_id]
    );

    if (!affiliate) {
      return res.status(404).json({ error: "Affiliate not found" });
    }

    // ✅ Get all links created by this affiliate
    const [links] = await db.query(
      `SELECT 
          al.affiliate_id,
          al.referral_code,
          al.product_id,
          p.name AS product_name,
          COALESCE(COUNT(ac.id), 0) AS total_clicks,
          COALESCE(SUM(CASE WHEN ao.status = 'completed' THEN 1 ELSE 0 END), 0) AS total_sales,
          COALESCE(SUM(CASE WHEN ao.status = 'completed' THEN ao.commission ELSE 0 END), 0) AS commission_earned
       FROM affiliate_links al
       LEFT JOIN affiliate_clicks ac ON ac.referral_code = al.referral_code
       LEFT JOIN affiliate_orders ao ON ao.referral_code = al.referral_code
       LEFT JOIN products p ON p.id = al.product_id
       WHERE al.affiliate_id = ?
       GROUP BY al.referral_code, al.product_id, p.name
       ORDER BY al.id DESC`,
      [affiliate_id]
    );

    // ✅ Compute totals
    const total_links = links.length;
    const total_clicks = links.reduce((sum, link) => sum + Number(link.total_clicks || 0), 0);
    const total_sales = links.reduce((sum, link) => sum + Number(link.total_sales || 0), 0);
    const total_commission = links.reduce(
      (sum, link) => sum + Number(link.commission_earned || 0),
      0
    );

    // ✅ Response
    res.json({
      affiliater_id: affiliate.affiliater_id,
      username: affiliate.username,
      email: affiliate.email,
      phone: affiliate.phone,
      total_links,
      total_clicks,
      total_sales,
      total_commission,
      links,
    });
  } catch (error) {
    console.error("Error fetching affiliate details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};