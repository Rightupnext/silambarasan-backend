
const db = require("../db");

// ✅ Get all pending affiliates
exports.getPendingAffiliates = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, username, email, phone,city, bank_name, ifsc_code, account_number
      FROM users 
      WHERE role = 'pending-affiliater'
    `);

    res.status(200).json({
      message: "Pending affiliates fetched successfully",
      affiliates: rows,
    });
  } catch (error) {
    console.error("Error fetching pending affiliates:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Approve affiliate (convert from pending → active)
exports.approveAffiliate = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "UPDATE users SET role = 'affiliater' WHERE id = ? AND role = 'pending-affiliater'",
      [id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Affiliate not found or already approved" });
    }

    res.status(200).json({ message: "Affiliate approved successfully" });
  } catch (error) {
    console.error("Error approving affiliate:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✏️ Edit affiliate details
exports.updateAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, phone, bank_name, ifsc_code, account_number } = req.body;

    const [result] = await db.query(
      `UPDATE users 
       SET username = ?, email = ?, phone = ?, bank_name = ?, ifsc_code = ?, account_number = ?
       WHERE id = ? AND role IN ('pending-affiliater', 'affiliater')`,
      [username, email, phone, bank_name, ifsc_code, account_number, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Affiliate not found" });
    }

    res.status(200).json({ message: "Affiliate details updated successfully" });
  } catch (error) {
    console.error("Error updating affiliate:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🗑️ Delete affiliate
exports.deleteAffiliate = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM users WHERE id = ? AND role IN ('pending-affiliater', 'affiliater')",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Affiliate not found" });
    }

    res.status(200).json({ message: "Affiliate deleted successfully" });
  } catch (error) {
    console.error("Error deleting affiliate:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🧾 Get all approved affiliates (safe version without created_at)
exports.getAllAffiliates = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, username, email, phone, bank_name, ifsc_code, account_number
      FROM users 
      WHERE role = 'affiliater'
    `);

    res.status(200).json({
      message: "Approved affiliates fetched successfully",
      affiliates: rows,
    });
  } catch (error) {
    console.error("Error fetching affiliates:", error);
    res.status(500).json({ message: "Server error" });
  }
};
