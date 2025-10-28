const express = require("express");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
require("dotenv").config();
const app = express();

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const HeroRoutes = require("./src/routes/heroRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const productRoutes = require("./src/routes/productRoutes");
const OrderRoutes = require("./src/routes/orderRoutes");
const ReviewRoutes = require("./src/routes/reviewRoutes");
const cleanUnusedFiles = require("./cleanUnusedFiles");

// ✅ Allow all CORS origins for now (can restrict later)
app.use(cors({ origin: "*" }));
app.use(express.json());

// ✅ Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/hero", HeroRoutes);
app.use("/categories", categoryRoutes);
app.use("/products", productRoutes);
app.use("/order", OrderRoutes);
app.use("/reviews", ReviewRoutes);

// ✅ Static file routes
app.use("/uploads/products", express.static(path.join(__dirname, "uploads/products")));
app.use("/uploads/hero", express.static(path.join(__dirname, "uploads/hero")));
app.use("/uploads/gifts", express.static(path.join(__dirname, "uploads/gifts")));
app.use("/uploads/barcodes", express.static(path.join(__dirname, "uploads/barcodes")));

app.get("/", (req, res) => {
  res.send("API Running...");
});

// ✅ Always bind to 0.0.0.0 so Nginx can reach it
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

async function startServer() {
  console.log("🕒 Running cleanup before server launch...");
  await cleanUnusedFiles();

  app.listen(PORT, HOST, () => {
    console.log(`✅ Server running on http://${HOST}:${PORT}`);
  });
}

startServer();

// ✅ Schedule hourly cleanup
cron.schedule("0 * * * *", () => {
  console.log("🕑 Running auto-clean job...");
  cleanUnusedFiles();
});
