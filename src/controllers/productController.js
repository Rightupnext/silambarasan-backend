const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const db = require("../db");

// ---------------- Create Product ----------------
exports.createProductWithVariants = async (req, res) => {
  const {
    product_name,
    product_code,
    category,
    description,
    price,
    discount = 0,
    Bulk_discount = 0,
    trend = "regular",
    offerExpiry,
    variants,
  } = req.body;

  const images = req.imageFilenames || []; // array of 1–5 images
  let parsedVariants = [];
  try {
    parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
    if (!Array.isArray(parsedVariants))
      throw new Error("Variants must be an array");
  } catch (err) {
    return res.status(400).json({ error: "Invalid variants format. Must be JSON array." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [productResult] = await connection.query(
      `INSERT INTO boutique_inventory 
      (product_name, product_code, category, description, images, price, discount, offerExpiry, trend, Bulk_discount) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product_name,
        product_code,
        category,
        description,
        JSON.stringify(images), // store as JSON
        price,
        discount,
        JSON.stringify(offerExpiry || []),
        trend,
        Bulk_discount,
      ]
    );

    const productId = productResult.insertId;

    const variantPromises = parsedVariants.map((variant) => {
      const sizeString = Array.isArray(variant.size) ? variant.size.join(",") : variant.size;
      return connection.query(
        `INSERT INTO inventory_variants (product_id, color, size, quantity)
         VALUES (?, ?, ?, ?)`,
        [productId, variant.color, sizeString, variant.quantity]
      );
    });

    await Promise.all(variantPromises);
    await connection.commit();

    res.status(201).json({ message: "Product and variants added", productId });
  } catch (err) {
    await connection.rollback();
    console.error(err.message);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

// ---------------- Update Product ----------------
exports.updateProductWithVariants = async (req, res) => {
  const { id } = req.params;
  const {
    product_name,
    product_code,
    category,
    description,
    price,
    discount = 0,
    Bulk_discount = 0,
    trend = "regular",
    offerExpiry,
    variants,
    existingImages, // JSON array
  } = req.body;

  const uploadDir = path.join(__dirname, "../../uploads/products");
  let existingImagesArray = [];

  if (existingImages) {
    try {
      existingImagesArray =
        typeof existingImages === "string" ? JSON.parse(existingImages) : existingImages;
      if (!Array.isArray(existingImagesArray)) existingImagesArray = [];
    } catch {
      existingImagesArray = [];
    }
  }

  const newImages = req.imageFilenames || [];
  let parsedVariants = [];

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch old images
    const [rows] = await connection.query(
      `SELECT images FROM boutique_inventory WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    let oldImagesArray = [];
    try {
      oldImagesArray = JSON.parse(rows[0].images || "[]");
    } catch {
      oldImagesArray = [];
    }

    // 2. Delete removed images from local folder
    const imagesToDelete = oldImagesArray.filter(img => !existingImagesArray.includes(img));
    for (const img of imagesToDelete) {
      const imgPath = path.join(uploadDir, img.replace(/^products\//, ""));
      if (fsSync.existsSync(imgPath)) {
        await fs.promises.unlink(imgPath);
        console.log("🗑 Deleted:", img);
      }
    }

    // 3. Combine existing and new images
    const finalImagesArray = [...existingImagesArray, ...newImages];

    // 4. Parse offerExpiry
    let finalOfferExpiry = offerExpiry ? JSON.stringify(offerExpiry) : null;

    // 5. Update product
    await connection.query(
      `UPDATE boutique_inventory
       SET product_name=?, product_code=?, category=?, description=?,
           images=?, price=?, discount=?, Bulk_discount=?, offerExpiry=?, trend=?
       WHERE id=?`,
      [
        product_name,
        product_code,
        category,
        description,
        JSON.stringify(finalImagesArray),
        price,
        discount,
        Bulk_discount,
        finalOfferExpiry,
        trend,
        id,
      ]
    );

    // 6. Update variants
    parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
    if (!Array.isArray(parsedVariants)) throw new Error("Variants must be array");

    await connection.query(`DELETE FROM inventory_variants WHERE product_id = ?`, [id]);

    for (const variant of parsedVariants) {
      const sizeString = Array.isArray(variant.size) ? variant.size.join(",") : variant.size;
      await connection.query(
        `INSERT INTO inventory_variants (product_id, color, size, quantity)
         VALUES (?, ?, ?, ?)`,
        [id, variant.color, sizeString, variant.quantity]
      );
    }

    await connection.commit();

    res.json({
      message: "✅ Product and variants updated successfully",
      images: finalImagesArray,
    });
  } catch (err) {
    await connection.rollback();
    console.error(err.message);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const [products] = await db.query(`SELECT * FROM boutique_inventory`);
    const [variants] = await db.query(`SELECT * FROM inventory_variants`);

    const grouped = {};
    for (const v of variants) {
      if (!grouped[v.product_id]) grouped[v.product_id] = [];
      grouped[v.product_id].push({
        color: v.color,
        size: v.size.split(","), // return as array
        quantity: v.quantity,
      });
    }

    const result = products.map((product) => ({
      ...product,
      variants: grouped[product.id] || [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  const uploadDir = path.join(__dirname, "../../uploads/products");

  try {
    // Step 1: Get image name
    const [rows] = await db.query(`SELECT image FROM boutique_inventory WHERE id = ?`, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    let image = rows[0].image;
    if (!image) image = "";

    const cleanImage = image.replace(/^products\//, "").trim();
    const imagePath = path.join(uploadDir, cleanImage);
    // console.log("🧭 Full image path to delete:", imagePath);

    // Step 2: Delete product and variants
    await db.query(`DELETE FROM boutique_inventory WHERE id = ?`, [id]);
    await db.query(`DELETE FROM inventory_variants WHERE product_id = ?`, [id]);

    // Step 3: Delete image
    if (cleanImage && fsSync.existsSync(imagePath)) {
      await fs.unlink(imagePath);
      // console.log("🗑 Deleted image from folder:", cleanImage);
    } else {
      console.log("⚠️ Image file not found or already deleted.");
    }

    res.json({ message: "✅ Product and image deleted successfully" });

  } catch (error) {
    console.error("❌ Deletion failed:", error.message);
    res.status(500).json({ error: error.message });
  }
};
exports.getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    // Step 1: Get the product by ID
    const [productRows] = await db.query(
      `SELECT * FROM boutique_inventory WHERE id = ?`,
      [id]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = productRows[0];

    // Step 2: Get all variants for that product
    const [variantRows] = await db.query(
      `SELECT color, size, quantity FROM inventory_variants WHERE product_id = ?`,
      [id]
    );

    // Convert size strings to arrays (e.g., "S,M,L" => ["S", "M", "L"])
    const variants = variantRows.map((variant) => ({
      ...variant,
      size: variant.size.split(",").map((s) => s.trim()),
    }));

    // Step 3: Combine product with its variants
    const result = {
      ...product,
      variants,
    };

    res.json(result);
  } catch (error) {
    console.error("❌ Failed to fetch product:", error.message);
    res.status(500).json({ error: error.message });
  }
};
