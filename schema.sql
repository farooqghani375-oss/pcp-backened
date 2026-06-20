-- ============================================================
-- PCP DATABASE SCHEMA (PostgreSQL)
-- ============================================================
-- In Firestore, a product document just had an `images` array
-- and a `colors` array baked right in. SQL doesn't store arrays
-- of related things like that (well, it can, but it's bad
-- practice) -- instead we give each "many" thing its own table
-- and link it back with a foreign key (product_id).
-- ============================================================

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  featured BOOLEAN DEFAULT false,
  in_stock BOOLEAN DEFAULT true,
  stock_qty INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- One product -> many images
CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- One product -> many color swatches
CREATE TABLE product_colors (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  hex_color TEXT NOT NULL
);

-- Orders placed by customers (mirrors your Cart.jsx checkout form)
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT NOT NULL,
  customer_city TEXT,
  notes TEXT,
  subtotal NUMERIC(10,2) NOT NULL,
  shipping NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT now()
);

-- Line items inside an order. We snapshot product_name and price
-- here (instead of just joining to products) so that if you later
-- rename a product or change its price, old orders still show
-- exactly what the customer actually bought and paid.
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL,
  color TEXT
);

-- Replaces Firebase Auth for the admin panel login
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
