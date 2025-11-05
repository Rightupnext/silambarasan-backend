const path = require("path");
const fs = require("fs");
const fsSync = require("fs");
const sharp = require("sharp");
const db = require("../db"); // your DB connection
const multer = require("multer");

// ---------------- Multer setup ----------------
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
  limits: {}, // ✅ Removed file size limit (allow any size)
});

// MIME to extension map
const mimeToExtension = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
};

// ---------------- Image processing middleware (ORIGINAL SIZE) ----------------
const processImages = async (req, res, next) => {
  if (!req.files || !req.files.length) return next();

  const outputDir = path.join(__dirname, "../../uploads/products");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const savedImages = [];

  for (let file of req.files) {
    const ext = mimeToExtension[file.mimetype];
    if (!ext) continue;

    const filename = `product_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    const outputPath = path.join(outputDir, filename);

    try {
      // ✅ Save original file buffer exactly as uploaded
      fs.writeFileSync(outputPath, file.buffer);

      savedImages.push(`products/${filename}`);
    } catch (err) {
      console.error("❌ Image saving failed:", err.message);
      return next(err);
    }
  }

  req.imageFilenames = savedImages;
  next();
};
module.exports = { upload, processImages };
