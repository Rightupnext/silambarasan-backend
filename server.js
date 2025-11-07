const express = require("express");
const cors = require("cors");
const path = require("path"); // ✅ FIXED: Add this line
const cron = require("node-cron");
require("dotenv").config();
const db = require("./src/db");


const app = express();

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const HeroRoutes = require("./src/routes/heroRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const productRoutes = require("./src/routes/productRoutes");
const OrderRoutes = require("./src/routes/orderRoutes");
const ReviewRoutes = require("./src/routes/reviewRoutes");
const cleanUnusedFiles=require('./cleanUnusedFiles')
const affiliateRoutes = require("./src/routes/affiliateRoutes");
const adminAffiliateRoutes = require("./src/routes/adminAffiliateRoutes");
const affiliateRoutess = require("./src/routes/affiliateRoutess");
const commissionRoutes = require("./src/routes/commissionRoutes");

// app.use(cors());
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/hero", HeroRoutes);
app.use("/categories", categoryRoutes);
app.use("/products", productRoutes);
app.use("/order", OrderRoutes);
app.use("/reviews", ReviewRoutes);

app.use(
  "/uploads/products",
  express.static(path.join(__dirname, "uploads/products")) // ✅ FIXED
);
app.use(
  "/uploads/hero",
  express.static(path.join(__dirname, "uploads/hero")) // ✅ FIXED
);
app.use(
  "/uploads/gifts",
  express.static(path.join(__dirname, "uploads/gifts")) // ✅ FIXED
);
app.use(
  "/uploads/barcodes",
  express.static(path.join(__dirname, "uploads/barcodes")) // ✅ FIXED
);

app.use("/api/affiliate", affiliateRoutes);  // affiliated 

app.use("/api/admin", commissionRoutes);

app.use("/admin", adminAffiliateRoutes);

app.use("/api", affiliateRoutess);

app.get('/redirect', async (req, res) => {
  const { ref } = req.query;
  if (!ref) return res.status(400).send("Missing referral code");

  try {
    // 1️⃣ Find link
    const [[link]] = await db.query(
      "SELECT id, product_id FROM affiliate_links WHERE referral_code = ?",
      [ref]
    );

    if (!link) return res.status(404).send("Invalid referral link");

    // 2️⃣ Log the click
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const agent = req.headers['user-agent'];

    await db.query(
      "INSERT INTO affiliate_clicks (link_id, ip_address, user_agent) VALUES (?, ?, ?)",
      [link.id, ip, agent]
    );

    // 3️⃣ Redirect to product page
    res.redirect(`/product/${link.product_id}`);
  } catch (error) {
    console.error("Error logging click:", error.message);
    res.status(500).send("Server error");
  }
});

// need to hide this 

// Total clicks for all links of an affiliate
app.get('/api/affiliate/clicks/:affiliate_id', async (req, res) => {
  const { affiliate_id } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT 
        al.id AS link_id,
        al.referral_code,
        al.product_id,
        COUNT(ac.id) AS total_clicks
      FROM affiliate_links al
      LEFT JOIN affiliate_clicks ac ON al.id = ac.link_id
      WHERE al.affiliate_id = ?
      GROUP BY al.id, al.referral_code, al.product_id
    `, [affiliate_id]);

    if (rows.length === 0)
      return res.status(404).json({ message: "No affiliate links or clicks found" });

    res.json({ affiliate_id, data: rows });
  } catch (error) {
    console.error("Error fetching affiliate clicks:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/affiliate/click/:ref", async (req, res) => {
  const { ref } = req.params; // referral code, e.g., AFF-3-1-1761195727790

  if (!ref) return res.status(400).json({ error: "Missing referral code" });

  try {
    // 1️⃣ Find the affiliate link in DB
    const [[link]] = await db.query(
      "SELECT id, product_id FROM affiliate_links WHERE referral_code = ?",
      [ref]
    );

    if (!link) return res.status(404).json({ error: "Invalid referral code" });

    // 2️⃣ Log the click
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"] || "Postman";

    await db.query(
      "INSERT INTO affiliate_clicks (link_id, ip_address, user_agent) VALUES (?, ?, ?)",
      [link.id, ip, userAgent]
    );

    // 3️⃣ Return success (instead of redirect, for API testing)
    res.json({
      message: "Click logged successfully ✅",
      link_id: link.id,
      product_id: link.product_id,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});







app.get("/", (req, res) => {
  res.send("API Running...");
});

const PORT = process.env.PORT || 5000;
const IP = process.env.IP || "localhost";
if (process.env.PHONEPE_ENV === "SANDBOX") {
  // Run this block for sandbox
  app.listen(PORT, IP, () => {
    console.log(`Sandbox server running at http://${IP}:${PORT}/`);
  });
} else {
  // Run this block for production or other environments
  app.listen(PORT, () => {
    console.log(`Production server running at http://localhost:${PORT}/`);
  });
}

console.log("ENV ENCRYPTION_ENABLED:", process.env.ENCRYPTION_ENABLED);
console.log(
  "ENCRYPTION_ENABLED === 'true':",
  process.env.ENCRYPTION_ENABLED === "true"
);
async function startServer() {
  console.log("🕒 Starting cleanup before server launch...");
  await cleanUnusedFiles(); // await so logs are printed before server starts

  app.listen(PORT, () => {
    console.log(`Server started on http://${IP}:${PORT}`);
  });
}

startServer();
cron.schedule("0 * * * *", () => {
  console.log("🕑 Running auto-clean job...");
  cleanUnusedFiles();
});