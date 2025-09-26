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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
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

// ---------------- Image processing middleware ----------------
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
      let buffer;

      const sharpInstance = sharp(file.buffer).resize({ width: 800, fit: "inside" });

      switch (ext) {
        case "jpg":
        case "jpeg":
          buffer = await sharpInstance.jpeg({ quality: 60, mozjpeg: true }).toBuffer();
          break;
        case "png":
          buffer = await sharpInstance.png({ compressionLevel: 9, palette: true }).toBuffer();
          break;
        case "webp":
          buffer = await sharpInstance.webp({ quality: 60 }).toBuffer();
          break;
        case "tiff":
          buffer = await sharpInstance.tiff({ quality: 60 }).toBuffer();
          break;
        case "bmp":
          buffer = await sharpInstance.bmp().toBuffer();
          break;
        case "gif":
          fs.writeFileSync(outputPath, file.buffer);
          savedImages.push(`products/${filename}`);
          continue;
      }

      fs.writeFileSync(outputPath, buffer);
      savedImages.push(`products/${filename}`);
    } catch (err) {
      console.error("❌ Image processing failed:", err.message);
      return next(err);
    }
  }

  req.imageFilenames = savedImages; // attach array of filenames
  next();
};
module.exports = { upload, processImages };
