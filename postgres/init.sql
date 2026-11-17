CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  available BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id INT NOT NULL REFERENCES menu_items(id),
  dish_name VARCHAR(120) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL
);
INSERT INTO menu_items(name,description,price) VALUES
 ('Chicken Karahi','Traditional spicy chicken karahi',1450),
 ('Beef Biryani','Aromatic rice with beef',420),
 ('Chapli Kebab','Peshawari style kebab',280),
 ('Chicken Tikka','Charcoal grilled chicken',550)
ON CONFLICT DO NOTHING;
