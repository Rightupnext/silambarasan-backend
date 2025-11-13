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

  const images = req.imageFilenames || [];
  let parsedVariants = [];  try {
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
        JSON.stringify(images),
        price,
        discount,
        JSON.stringify(offerExpiry || []),
        trend,
        Bulk_discount,
      ]
    );

    const productId = productResult.insertId;

    const variantPromises = parsedVariants.map((variant) => {
      const colorValue = variant.color && variant.color.trim() !== "" ? variant.color : null; // ✅ Optional
      const sizeString = Array.isArray(variant.size) ? variant.size.join(",") : variant.size || null;
      const quantity = variant.quantity || 0;
      return connection.query(
        `INSERT INTO inventory_variants (product_id, color, size, quantity)
         VALUES (?, ?, ?, ?)`,
        [productId, colorValue, sizeString, quantity]
      );
    });

    await Promise.all(variantPromises);
    await connection.commit();

    res.status(201).json({ message: "✅ Product and variants added successfully", productId });
  } catch (err) {
    await connection.rollback();
    console.error("❌ Error creating product:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

// ---------------- Update Product with Variants ----------------
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
    existingImages,
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

    // Fetch old images
    const [rows] = await connection.query(`SELECT images FROM boutique_inventory WHERE id = ?`, [id]);
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

    // Delete removed images
    const imagesToDelete = oldImagesArray.filter(img => !existingImagesArray.includes(img));
    for (const img of imagesToDelete) {
      const imgPath = path.join(uploadDir, img.replace(/^products\//, ""));
      if (fsSync.existsSync(imgPath)) {
        await fs.promises.unlink(imgPath);
        console.log("🗑 Deleted:", img);
      }
    }

    // Combine images
    const finalImagesArray = [...existingImagesArray, ...newImages];

    // Update product details
    const finalOfferExpiry = offerExpiry ? JSON.stringify(offerExpiry) : null;
    await connection.query(
      `UPDATE boutique_inventory
       SET product_name=?, product_code=?, category=?, description=?, images=?,
           price=?, discount=?, Bulk_discount=?, offerExpiry=?, trend=?
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

    // Update variants
    parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
    if (!Array.isArray(parsedVariants)) throw new Error("Variants must be an array");

    await connection.query(`DELETE FROM inventory_variants WHERE product_id = ?`, [id]);

    for (const variant of parsedVariants) {
      const colorValue = variant.color && variant.color.trim() !== "" ? variant.color : null; // ✅ Optional
      const sizeString = Array.isArray(variant.size) ? variant.size.join(",") : variant.size || null;
      const quantity = variant.quantity || 0;

      await connection.query(
        `INSERT INTO inventory_variants (product_id, color, size, quantity)
         VALUES (?, ?, ?, ?)`,
        [id, colorValue, sizeString, quantity]
      );
    }

    await connection.commit();

    res.json({
      message: "✅ Product and variants updated successfully",
      images: finalImagesArray,
    });
  } catch (err) {
    await connection.rollback();
    console.error("❌ Error updating product:", err.message);
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

exports.PermenantlydeleteProduct = async (req, res) => {
  const { id } = req.params;
  const uploadDir = path.join(__dirname, "../../uploads/products");

  try {
    // Step 1: Get images (JSON array) from DB
    const [rows] = await db.query(`SELECT images FROM boutique_inventory WHERE id = ?`, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    let imagesArray = [];
    try {
      imagesArray = JSON.parse(rows[0].images || "[]");
    } catch {
      imagesArray = [];
    }

    // Step 2: Delete product and variants
    await db.query(`DELETE FROM boutique_inventory WHERE id = ?`, [id]);
    await db.query(`DELETE FROM inventory_variants WHERE product_id = ?`, [id]);

    // Step 3: Delete images from folder
    for (const img of imagesArray) {
      const cleanImage = img.replace(/^products\//, "").trim();
      const imagePath = path.join(uploadDir, cleanImage);

      if (fsSync.existsSync(imagePath)) {
        await fs.unlink(imagePath);
        console.log("🗑 Deleted image from folder:", cleanImage);
      } else {
        console.log("⚠️ Image file not found or already deleted:", cleanImage);
      }
    }

    res.json({ message: "✅ Product and images deleted successfully" });

  } catch (error) {
    console.error("❌ Deletion failed:", error.message);
    res.status(500).json({ error: error.message });
  }
};
exports.softDeleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if product exists
    const [rows] = await db.query(
      `SELECT id FROM boutique_inventory WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Soft delete
    await db.query(
      `UPDATE boutique_inventory SET is_deleted = 1 WHERE id = ?`,
      [id]
    );

    res.json({ message: "✅ Product hidden successfully (soft deleted)" });
  } catch (error) {
    console.error("❌ Soft delete failed:", error.message);
    res.status(500).json({ error: error.message });
  }
};
exports.restoreProduct = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `UPDATE boutique_inventory SET is_deleted = 0 WHERE id = ?`,
      [id]
    );

    res.json({ message: "✅ Product restored successfully" });
  } catch (error) {
    console.error("❌ Restore failed:", error.message);
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
