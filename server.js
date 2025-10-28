const express = require("express");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
require("dotenv").config();

const app = express();

// Import routes
const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const HeroRoutes = require("./src/routes/heroRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const productRoutes = require("./src/routes/productRoutes");
const OrderRoutes = require("./src/routes/orderRoutes");
const ReviewRoutes = require("./src/routes/reviewRoutes");
const cleanUnusedFiles = require("./cleanUnusedFiles");

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/hero", HeroRoutes);
app.use("/categories", categoryRoutes);
app.use("/products", productRoutes);
app.use("/order", OrderRoutes);
app.use("/reviews", ReviewRoutes);

// Static file serving
app.use("/uploads/products", express.static(path.join(__dirname, "uploads/products")));
app.use("/uploads/hero", express.static(path.join(__dirname, "uploads/hero")));
app.use("/uploads/gifts", express.static(path.join(__dirname, "uploads/gifts")));
app.use("/uploads/barcodes", express.static(path.join(__dirname, "uploads/barcodes")));

app.get("/", (req, res) => {
  res.send("API Running...");
});

// Config
const PORT = process.env.PORT || 5000;

console.log("ENV ENCRYPTION_ENABLED:", process.env.ENCRYPTION_ENABLED);
console.log(
  "ENCRYPTION_ENABLED === 'true':",
  process.env.ENCRYPTION_ENABLED === "true"
);

// Start Server
(async () => {
  console.log("🕒 Starting cleanup before server launch...");
  try {
    await cleanUnusedFiles();
  } catch (err) {
    console.error("⚠️ Cleanup failed, continuing startup:", err);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
})();

// Schedule auto-clean every hour
cron.schedule("0 * * * *", () => {
  console.log("🕑 Running auto-clean job...");
  cleanUnusedFiles();
});
