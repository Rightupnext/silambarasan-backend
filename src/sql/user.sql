CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  city VARCHAR(255),

  -- ✅ Role types
  role ENUM(
    'admin',
    'super-admin',
    'customer',
    'D-partner',
    'client',
    'affiliater',
    'pending-affiliater'
  ) DEFAULT 'customer',

  -- ✅ Affiliate bank details
  bank_name VARCHAR(255),
  ifsc_code VARCHAR(50),
  account_number VARCHAR(50),

  -- ✅ Forgot password fields
  reset_otp VARCHAR(10),
  otp_expiry DATETIME

  -- ✅ Optional timestamps
  -- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
