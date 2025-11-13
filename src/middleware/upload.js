const path = require("path");
const fs = require("fs");
const fsSync = require("fs");
const sharp = require("sharp");
const db = require("../db");
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
  limits: {}, // ✅ No upload size limit
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

// ---------------- Image processing middleware (≈ 1 MP optimization) ----------------
const processImages = async (req, res, next) => {
  if (!req.files || !req.files.length) return next();

  const outputDir = path.join(__dirname, "../../uploads/products");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const savedImages = [];

  for (const file of req.files) {
    const ext = mimeToExtension[file.mimetype];
    if (!ext) continue;

    const filename = `product_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    const outputPath = path.join(outputDir, filename);

    try {
      // Get metadata to compute resize dimensions (~1 MP)
      const metadata = await sharp(file.buffer).metadata();
      const aspectRatio = metadata.width / metadata.height;
      const targetPixels = 1_000_000; // 1 megapixel
      const targetWidth = Math.round(Math.sqrt(targetPixels * aspectRatio));
      const targetHeight = Math.round(targetWidth / aspectRatio);

      // Optimize and resize
      let transformer = sharp(file.buffer).resize({
        width: targetWidth,
        height: targetHeight,
        fit: "inside",
      });

      if (ext === "jpg" || ext === "jpeg") {
        transformer = transformer.jpeg({ quality: 80 });
      } else if (ext === "png") {
        transformer = transformer.png({ compressionLevel: 8 });
      } else if (ext === "webp") {
        transformer = transformer.webp({ quality: 80 });
      } else {
        // Fallback for other image types
        transformer = transformer.jpeg({ quality: 80 });
      }

      await transformer.toFile(outputPath);

      savedImages.push(`products/${filename}`);
    } catch (err) {
      console.error("❌ Image processing failed:", err.message);
      return next(err);
    }
  }

  req.imageFilenames = savedImages;
  next();
};
module.exports = { upload, processImages };
