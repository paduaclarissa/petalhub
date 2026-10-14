CREATE DATABASE IF NOT EXISTS petalhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE petalhub;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  salt CHAR(32) NOT NULL,
  password_hash CHAR(128) NOT NULL,
  role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  security_question VARCHAR(120) NULL,
  security_salt CHAR(32) NULL,
  security_hash CHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  qty INT NOT NULL,
  unit VARCHAR(40) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1
);

INSERT IGNORE INTO products (id, name, price, qty, unit) VALUES
  (1, 'Garden Rose', 18.00, 24, 'bunches available'),
  (2, 'Tulip',       12.00, 40, 'bunches available'),
  (3, 'Sunflower',    9.00, 30, 'bunches available'),
  (4, 'Peony',       22.00, 12, 'bunches available'),
  (5, 'Orchid',      28.00, 15, 'pots available'),
  (6, 'Lily',        16.00, 20, 'bunches available');

CREATE TABLE IF NOT EXISTS orders (
  code VARCHAR(12) PRIMARY KEY,
  user_id INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  fulfillment ENUM('pickup','delivery') NOT NULL,
  street VARCHAR(200) NOT NULL DEFAULT '',
  city VARCHAR(100) NOT NULL DEFAULT '',
  zip VARCHAR(20) NOT NULL DEFAULT '',
  payment VARCHAR(40) NOT NULL,
  status ENUM('Pending','Preparing','Ready','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(12) NOT NULL,
  product_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  qty INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_code) REFERENCES orders(code) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
