const express = require("express");
const cors = require("cors");
const path = require("path"); // ✅ FIXED: Add this line
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
const cleanUnusedFiles=require('./cleanUnusedFiles')
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
app.get("/", (req, res) => {
  res.send("API Running...");
});

const PORT = process.env.PORT || 5000;
const IP = process.env.IP || "localhost";
// if (process.env.PHONEPE_ENV === "SANDBOX") {
//   // Run this block for sandbox
//   app.listen(PORT, IP, () => {
//     console.log(`Sandbox server running at http://${IP}:${PORT}/`);
//   });
// } else {
//   // Run this block for production or other environments
//   app.listen(PORT, () => {
//     console.log(`Production server running at http://localhost:${PORT}/`);
//   });
// }

console.log("ENV ENCRYPTION_ENABLED:", process.env.ENCRYPTION_ENABLED);
console.log(
  "ENCRYPTION_ENABLED === 'true':",
  process.env.ENCRYPTION_ENABLED === "true"
);
async function startServer() {
  console.log("🕒 Starting cleanup before server launch...");
  await cleanUnusedFiles(); // await so logs are printed before server starts

  app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
  });
}

startServer();
cron.schedule("0 * * * *", () => {
  console.log("🕑 Running auto-clean job...");
  cleanUnusedFiles();
});