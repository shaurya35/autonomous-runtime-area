-- migrations/0001_initial.sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO products (id, name, description, price, stock) VALUES
    (1, 'Widget A', 'A reliable widget', 9.99, 100),
    (2, 'Widget B', 'An improved widget', 19.99, 50),
    (3, 'Gadget X', 'The latest gadget', 49.99, 25),
    (4, 'Gadget Y', 'Classic model gadget', 29.99, 75),
    (5, 'Doohickey Z', 'Mysterious but useful', 4.99, 200),
    (6, 'Widget C', 'The premium widget', 39.99, 30),
    (7, 'Gadget Z', 'Budget gadget', 14.99, 150),
    (8, 'Widget D', 'Industrial widget', 59.99, 10),
    (9, 'Super Gadget', 'Next gen gadget', 99.99, 5),
    (10, 'Starter Kit', 'Everything you need', 24.99, 80);
