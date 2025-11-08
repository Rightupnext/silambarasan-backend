-- PRODUCT TABLE
CREATE TABLE boutique_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(255) NOT NULL,
  product_code VARCHAR(100) UNIQUE,
  category VARCHAR(100),
  description TEXT,
  images JSON,
  price INT NOT NULL,
  discount INT DEFAULT 0,
  Bulk_discount INT DEFAULT 0,
  offerExpiry JSON,
  trend ENUM('new', 'bestseller', 'regular') DEFAULT 'regular',
  is_deleted TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VARIANTS TABLE
CREATE TABLE inventory_variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  color VARCHAR(50),
  size VARCHAR(100),
  quantity INT DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES boutique_inventory(id) ON DELETE CASCADE
);

-CREATE TABLE affiliate_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  affiliate_id INT NOT NULL,
  product_id INT NOT NULL,
  referral_code VARCHAR(100) UNIQUE,
  full_referral_link VARCHAR(500),
  total_clicks INT DEFAULT 0,
  total_sales INT DEFAULT 0,
  commission_earned INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES boutique_inventory(id) ON DELETE CASCADE
);


-- OPTIONAL: COMMISSION HISTORY TABLE
CREATE TABLE affiliate_commissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  affiliate_id INT NOT NULL,
  product_id INT NOT NULL,
  referral_code VARCHAR(100),
  order_id VARCHAR(100),
  commission_amount INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES users(id) ON DELETE CASCADE
);