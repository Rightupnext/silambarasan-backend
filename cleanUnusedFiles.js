const fs = require("fs");
const path = require("path");
const db = require("./src/db"); // Your MySQL connection module

const productFolder = path.join(__dirname, "./uploads/products");

// Normalize DB filenames: lowercase + trim
function normalizeDB(file) {
  return path.basename(file).trim().toLowerCase();
}

// Normalize local filenames: lowercase + trim + fix broken extensions + remove spaces
function normalizeLocal(file) {
  let name = file
    .trim()
    .toLowerCase()
    .replace(/[\s\u00A0\u200B]+/g, ""); // remove all spaces & hidden chars
  // Fix common broken extensions
  name = name.replace(/\.jp[g]?g$/i, ".jpg"); // .jp g or .jpeg -> .jpg
  name = name.replace(/\.pn[g]?g$/i, ".png"); // .pn g -> .png
  return name;
}

async function cleanUnusedFiles() {
  const connection = await db.getConnection();

  try {
    // 1️⃣ Fetch all images from boutique_inventory
    const [rows] = await connection.query(
      `SELECT images FROM boutique_inventory`
    );
    console.log("💾 Raw DB rows:", JSON.stringify(rows, null, 2));

    // 2️⃣ Flatten DB filenames into a Set of normalized basenames
    const dbFiles = new Set(
      rows
        .map((row) => {
          try {
            const images = Array.isArray(row.images)
              ? row.images
              : JSON.parse(row.images || "[]");
            console.log("🖼 Images from row:", images);
            return images.map((f) => normalizeDB(f));
          } catch (err) {
            console.error("❌ Failed to parse images:", row.images, err);
            return [];
          }
        })
        .flat()
    );

    console.log("📦 Normalized DB filenames:");
    dbFiles.forEach((f) => console.log(" -", f));

    // 3️⃣ Check if product folder exists
    if (!fs.existsSync(productFolder)) {
      console.warn("⚠️ Product folder does not exist:", productFolder);
      return;
    }

    // 4️⃣ Read local files
    const localFiles = fs.readdirSync(productFolder);
    console.log("📂 Local files found:", localFiles);

    // 5️⃣ Compare local files against DB
    for (const file of localFiles) {
      const normalizedFile = normalizeLocal(file);
      console.log(
        `🔍 Comparing local file: ${file} -> normalized: ${normalizedFile}`
      );

      const matched = Array.from(dbFiles).some(
        (dbFile) => normalizeLocal(dbFile) === normalizedFile
      );

      if (!matched) {
        const filePath = path.join(productFolder, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑 Deleted unmatched file: ${filePath}`);
        } catch (err) {
          console.warn(`⚠️ Failed to delete ${filePath}: ${err.message}`);
        }
      } else {
        console.log(`✅ Matched file (kept): ${file}`);
      }
    }

    console.log("✅ Product folder cleanup completed!");
  } catch (err) {
    console.error("❌ Cleanup failed:", err.message);
  } finally {
    connection.release();
  }
}

module.exports = cleanUnusedFiles;

// If run directly
if (require.main === module) {
  cleanUnusedFiles();
}
