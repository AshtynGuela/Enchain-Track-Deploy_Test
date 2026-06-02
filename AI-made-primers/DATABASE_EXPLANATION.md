# Enchain-Track — Complete Database Explanation

This document provides a **comprehensive breakdown** of every database-related aspect of the Enchain-Track application: the connection setup, complete table schemas with column details, every SQL query used in the codebase, and how the tables relate to each other.

---

## Table of Contents

1. [Database Connection](#1-database-connection)
2. [Complete Table Schemas](#2-complete-table-schemas)
3. [Entity Relationship Diagram](#3-entity-relationship-diagram)
4. [Every SQL Query Explained](#4-every-sql-query-explained)
   - [Authentication Queries](#41-authentication-queries)
   - [Product Queries](#42-product-queries)
   - [Cart Queries](#43-cart-queries)
   - [Order & Checkout Queries](#44-order--checkout-queries)
   - [Admin Dashboard Queries](#45-admin-dashboard-queries)
   - [Admin CRUD Queries](#46-admin-crud-queries)
5. [How the Cart-as-Order Pattern Works](#5-how-the-cart-as-order-pattern-works)
6. [Security Measures](#6-security-measures)

---

## 1. Database Connection

### Connection Configuration

Found in `server.js` (Lines 20–26):

```javascript
const mysql = require("mysql2/promise");
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'enchain'
});
```

| Setting    | Value       | Explanation                                                                 |
|------------|-------------|-----------------------------------------------------------------------------|
| `host`     | `localhost` | Connects to a MySQL instance running on the same machine (e.g., XAMPP)     |
| `user`     | `root`      | Default XAMPP MySQL superuser                                               |
| `password` | `''`        | Default XAMPP MySQL has no password                                         |
| `database` | `enchain`   | The specific database schema to use                                         |

### Why a Connection Pool?

`mysql.createPool()` creates a **pool of reusable connections** rather than a single connection. Benefits:

- **Concurrency** — Multiple API requests can query the database simultaneously without waiting for each other.
- **Automatic management** — The pool opens new connections as needed and releases them back to the pool when done.
- **Resilience** — If a connection drops, the pool creates a new one transparently.

### Why `mysql2/promise`?

Using the promise-based API allows `async/await` syntax throughout the codebase:

```javascript
// With promises (what this project uses):
const [rows] = await db.query("SELECT * FROM product");

// Without promises (callback hell):
db.query("SELECT * FROM product", (err, rows) => {
    if (err) { /* handle error */ }
    // use rows
});
```

### Startup Connection Test

Found in `server.js` (Lines 28–37):

```javascript
async function testDB() {
    try {
        const [rows] = await db.query("SELECT 1");
        console.log("DB Connected Successfully ✔", rows);
    } catch (err) {
        console.error("DB Connection Failed ❌", err);
    }
}
testDB();
```

This runs **immediately on server startup**. `SELECT 1` is a minimal query that simply verifies the connection is working. If the database is down or misconfigured, the error message appears in the console right away.

---

## 2. Complete Table Schemas

Based on all SQL queries in `server.js`, here is every table and column in the `enchain` database:

### `customer`

Stores registered customer accounts.

| Column              | Type          | Key         | Description                                |
|---------------------|---------------|-------------|--------------------------------------------|
| `customer_id`       | INT           | Primary Key | Auto-increment unique identifier           |
| `customer_name`     | VARCHAR       |             | Username for login                         |
| `customer_number`   | VARCHAR       |             | Phone number                               |
| `customer_passkey`  | VARCHAR(255+) |             | bcrypt-hashed password                     |

### `employee`

Stores admin/employee accounts with dashboard access.

| Column              | Type          | Key         | Description                                |
|---------------------|---------------|-------------|--------------------------------------------|
| `employee_id`       | INT           | Primary Key | Auto-increment unique identifier           |
| `employee_name`     | VARCHAR       |             | Username for login                         |
| `employee_number`   | VARCHAR       |             | Phone number                               |
| `employee_passkey`  | VARCHAR(255+) |             | bcrypt-hashed password                     |

### `product`

Consumer-facing products displayed in the storefront.

| Column              | Type            | Key         | Description                                           |
|---------------------|-----------------|-------------|-------------------------------------------------------|
| `product_id`        | INT             | Primary Key | Auto-increment unique identifier                      |
| `product_name`      | VARCHAR         |             | Display name                                          |
| `product_type`      | VARCHAR         |             | Category (e.g., "Electronics", "Food")                |
| `product_description`| TEXT           |             | Detailed description shown in modals                  |
| `product_price`     | DECIMAL         |             | Unit price in PHP (₱)                                 |
| `product_discount`  | DECIMAL         |             | Discount percentage (0–100)                           |
| `product_stock`     | INT             |             | Current available quantity                             |
| `product_image`     | VARCHAR         |             | URL/path to the product image                          |
| `supplier_id`       | INT             | Foreign Key | References `supplier.supplier_id`                     |

### `goods`

Backend inventory items (separate from consumer products).

| Column          | Type    | Key         | Description                            |
|-----------------|---------|-------------|----------------------------------------|
| `goods_id`      | INT     | Primary Key | Auto-increment unique identifier       |
| `item_name`     | VARCHAR |             | Name of the inventory item             |
| `item_stock`    | INT     |             | Current stock count                    |
| `item_price`    | DECIMAL |             | Unit cost/price                        |
| `supplier_id`   | INT     | Foreign Key | References `supplier.supplier_id`      |

### `supplier`

Vendors that supply both goods and products.

| Column            | Type    | Key         | Description                        |
|-------------------|---------|-------------|------------------------------------|
| `supplier_id`     | INT     | Primary Key | Auto-increment unique identifier   |
| `supplier_name`   | VARCHAR |             | Company or vendor name             |
| `supplier_number` | VARCHAR |             | Contact phone number               |

### `orders`

Central transactional table — also doubles as the shopping cart.

| Column             | Type      | Key         | Description                                          |
|--------------------|-----------|-------------|------------------------------------------------------|
| `order_id`         | INT       | Primary Key | Unique order identifier                              |
| `customer_id`      | INT       | Foreign Key | References `customer.customer_id`                    |
| `order_date`       | DATETIME  |             | Date/time order was placed (set on checkout)         |
| `order_status`     | VARCHAR   |             | `'cart'`, `'pending'`, `'processing'`, `'shipped'`, `'delivered'`, `'completed'` |
| `transaction_type` | CHAR(1)   |             | `'c'` = Cash on Delivery, `'g'` = GCash             |
| `transaction_date` | DATETIME  |             | Date/time of GCash payment (GCash orders only)       |
| `transaction_total`| DECIMAL   |             | Total amount for GCash transactions                  |

### `order_item`

Junction table linking orders to products (many-to-many).

| Column          | Type    | Key                 | Description                               |
|-----------------|---------|---------------------|-------------------------------------------|
| `order_id`      | INT     | Foreign Key (composite) | References `orders.order_id`          |
| `product_id`    | INT     | Foreign Key (composite) | References `product.product_id`       |
| `item_quantity`  | INT    |                     | How many units of this product were ordered |
| `item_price`    | DECIMAL |                     | Captured unit price at time of purchase     |

### `gcash`

Records GCash payment reference numbers.

| Column            | Type    | Key         | Description                              |
|-------------------|---------|-------------|------------------------------------------|
| `Gorder_id`       | INT     | Foreign Key | References `orders.order_id`             |
| `gcash_reference`  | VARCHAR |             | The GCash transaction reference string   |

---

## 3. Entity Relationship Diagram

```
┌──────────────┐          ┌──────────────┐
│   customer   │          │   employee   │
│──────────────│          │──────────────│
│ customer_id  │◄──┐      │ employee_id  │
│ customer_name│   │      │ employee_name│
│ customer_num │   │      │ employee_num │
│ customer_pass│   │      │ employee_pass│
└──────────────┘   │      └──────────────┘
                   │
                   │ 1:N (one customer has many orders)
                   │
              ┌────┴─────────┐
              │    orders     │
              │──────────────│
              │ order_id (PK)│
              │ customer_id  │──────────────────────────────────┐
              │ order_date   │                                  │
              │ order_status │                                  │
              │ txn_type     │                                  │
              │ txn_date     │                                  │
              │ txn_total    │                                  │
              └──────┬───────┘                                  │
                     │                                          │
          ┌──────────┤ 1:N                                      │
          │          │                                          │
          │   ┌──────┴────────┐        ┌──────────────┐         │
          │   │  order_item   │        │   product    │         │
          │   │───────────────│        │──────────────│         │
          │   │ order_id (FK) │◄──────►│ product_id   │         │
          │   │ product_id(FK)│  N:1   │ product_name │         │
          │   │ item_quantity │        │ product_type │         │
          │   │ item_price    │        │ product_price│         │
          │   └───────────────┘        │ product_disc │         │
          │                            │ product_stock│         │
          │                            │ product_image│         │
          │                            │ supplier_id  │──┐      │
          │                            └──────────────┘  │      │
          │                                              │      │
          │   ┌──────────────┐        ┌──────────────┐   │      │
          │   │    gcash     │        │   supplier   │   │      │
          │   │──────────────│        │──────────────│   │      │
          └──►│ Gorder_id(FK)│        │ supplier_id  │◄──┘      │
              │ gcash_ref    │        │ supplier_name│          │
              └──────────────┘        │ supplier_num │          │
                                      └──────┬───────┘          │
                                             │                  │
                                      ┌──────┴────────┐        │
                                      │    goods      │        │
                                      │──────────────│        │
                                      │ goods_id (PK)│        │
                                      │ item_name    │        │
                                      │ item_stock   │        │
                                      │ item_price   │        │
                                      │ supplier_id  │        │
                                      └───────────────┘        │
```

**Relationship Summary:**

| Relationship                     | Type    | Description                                    |
|----------------------------------|---------|------------------------------------------------|
| customer → orders                | 1:N     | One customer has many orders                   |
| orders → order_item              | 1:N     | One order has many line items                  |
| product → order_item             | 1:N     | One product appears in many order items        |
| supplier → product               | 1:N     | One supplier supplies many products            |
| supplier → goods                 | 1:N     | One supplier supplies many goods               |
| orders → gcash                   | 1:1     | One order has at most one GCash reference      |

---

## 4. Every SQL Query Explained

### 4.1 Authentication Queries

**Customer Signup — `POST /signup`**
```sql
INSERT INTO customer (customer_name, customer_number, customer_passkey)
VALUES (?, ?, ?)
```
- The `?` placeholders are filled with the username, phone number, and **bcrypt-hashed** password (never plaintext).

**Employee Signup — `POST /signup/employee`**
```sql
INSERT INTO employee (employee_name, employee_number, employee_passkey)
VALUES (?, ?, ?)
```

**Login — `POST /login`**
```sql
SELECT customer_id as id, customer_name as name, customer_passkey as passkey, 'customer' as role
FROM customer WHERE customer_name = ?
UNION
SELECT employee_id as id, employee_name as name, employee_passkey as passkey, 'employee' as role
FROM employee WHERE employee_name = ?
```
- **`UNION`** combines results from both tables into one result set.
- The hardcoded `'customer'` and `'employee'` strings are added as a virtual `role` column.
- The server then uses `bcrypt.compare()` on the returned `passkey` — the SQL only finds the user, it does **not** check the password.

**User Existence — `GET /user/:userId`**
```sql
SELECT customer_id as id, customer_name as name, customer_passkey as passkey, 'customer' as role
FROM customer WHERE customer_id = ?
UNION
SELECT employee_id as id, employee_name as name, employee_passkey as passkey, 'employee' as role
FROM employee WHERE employee_id = ?
```

---

### 4.2 Product Queries

**All Products — `GET /products`**
```sql
SELECT * FROM product ORDER BY product_discount DESC, product_type, product_name
```
- Discounted products appear first (highest discount), then sorted by category, then alphabetically.

**Popular Products — `GET /products/popular`**
```sql
SELECT p.*
FROM order_item AS oi JOIN product AS p ON p.product_id = oi.product_id
GROUP BY p.product_id
ORDER BY p.product_discount DESC, SUM(oi.item_quantity) DESC
```
- Joins products with order items and ranks them by total quantity ever sold.
- Products that have never been ordered are excluded (INNER JOIN).

**Discounted Products — `GET /products/discount`**
```sql
SELECT p.* FROM product AS p
WHERE p.product_discount > 0.00
ORDER BY p.product_discount DESC
```

**Categories — `GET /products/categories`**
```sql
SELECT DISTINCT product_type FROM product ORDER BY product_type
```

**Product Existence Check**
```sql
SELECT 1 FROM product WHERE product_id = ?
```
- Returns one row if the product exists, empty set if not. The `SELECT 1` is efficient — it doesn't fetch any actual column data.

---

### 4.3 Cart Queries

**Get Cart — `GET /cart/:userId`**
```sql
SELECT p.*, oi.item_quantity
FROM orders o
JOIN order_item oi ON o.order_id = oi.order_id
JOIN product p ON p.product_id = oi.product_id
WHERE o.customer_id = ? AND o.order_status = 'cart'
```
- Three-table join: `orders` → `order_item` → `product`.
- Filters to only the order with status `'cart'`.
- Returns full product data plus the quantity in the cart.

**Find Existing Cart**
```sql
SELECT order_id FROM orders WHERE customer_id = ? AND order_status = 'cart' LIMIT 1
```

**Create New Cart — `POST /cart`**
```sql
SELECT COALESCE(MAX(order_id), 0) + 1 AS nextId FROM orders
```
- Manually generates the next order ID. `COALESCE` handles the case where no orders exist yet (returns 0 + 1 = 1).

```sql
INSERT INTO orders (order_id, customer_id, order_date, order_status)
VALUES (?, ?, NOW(), 'cart')
```

**Update Existing Cart Item**
```sql
UPDATE order_item SET item_quantity = item_quantity + ?
WHERE order_id = ? AND product_id = ?
```
- Increments the quantity if the product is already in the cart.

**Insert New Cart Item**
```sql
INSERT INTO order_item (order_id, product_id, item_quantity) VALUES (?, ?, ?)
```

**Delete Cart Item — `DELETE /cart/:userId/:productId`**
```sql
DELETE FROM order_item WHERE order_id = ? AND product_id = ?
```

**Update Cart Quantity — `PUT /cart/:userId/:productId/:quantity`**
```sql
SELECT product_stock FROM product WHERE product_id = ?
-- Server checks: quantity <= 0 || quantity > product_stock → reject
UPDATE order_item SET item_quantity = ? WHERE order_id = ? AND product_id = ?
```

---

### 4.4 Order & Checkout Queries

**Get User Orders — `GET /orders/:userId`**
```sql
SELECT o.*, p.*, oi.item_quantity
FROM orders o
JOIN order_item oi ON o.order_id = oi.order_id
JOIN product p ON p.product_id = oi.product_id
WHERE o.customer_id = ? AND o.order_status != 'cart'
ORDER BY
    CASE order_status
        WHEN 'pending' THEN 1
        WHEN 'shipped' THEN 2
        WHEN 'delivered' THEN 3
        ELSE 4
    END,
    o.order_date DESC
```
- **`CASE` expression** provides custom sort priority — pending orders appear first, then shipped, then delivered.
- Within each status group, newer orders appear first (`DESC`).

**Checkout Cart (COD) — `POST /orders/:userId`**
```sql
-- Step 1: Verify cart exists
SELECT 1 FROM orders WHERE customer_id = ? AND order_status = 'cart' LIMIT 1

-- Step 2: Get cart items grouped by product
SELECT oi.product_id, SUM(oi.item_quantity) AS qty
FROM orders o JOIN order_item oi ON o.order_id = oi.order_id
WHERE o.customer_id = ? AND o.order_status = 'cart'
GROUP BY oi.product_id

-- Step 3: Decrement stock for each product (atomic check)
UPDATE product SET product_stock = product_stock - ?
WHERE product_id = ? AND product_stock >= ?
-- If affectedRows === 0, stock was insufficient → rollback

-- Step 4: Convert cart to order
UPDATE orders SET order_status = 'pending', order_date = NOW(), transaction_type = 'c'
WHERE customer_id = ? AND order_status = 'cart'
```
- **Step 3 is critical** — the `AND product_stock >= ?` clause acts as an atomic guard against overselling. If the stock is less than the requested quantity, the UPDATE affects 0 rows and the server returns an error.

**Checkout Cart (GCash) — `POST /orders/:userId/:gcashref`**
Same as above, plus:
```sql
UPDATE orders SET order_status = 'pending', order_date = NOW(), transaction_type = 'g',
    transaction_date = NOW(),
    transaction_total = (SELECT SUM(oi.item_quantity * oi.item_price)
                         FROM order_item oi JOIN orders o ON oi.order_id = o.order_id
                         WHERE o.customer_id = ? AND o.order_status = 'cart')
WHERE customer_id = ? AND order_status = 'cart'

INSERT INTO gcash (Gorder_id, gcash_reference) VALUES (?, ?)
```
- The `transaction_total` is calculated via a **subquery** that sums all items in the cart.

**QuickBuy — `POST /quickbuy`**
```sql
-- Deduct stock
UPDATE product SET product_stock = product_stock - ? WHERE product_id = ? AND product_stock >= ?

-- Create order directly
INSERT INTO orders (customer_id, order_date, order_status, transaction_type)
VALUES (?, NOW(), 'pending', ?)

-- Add the single item
INSERT INTO order_item (order_id, product_id, item_quantity, item_price)
VALUES (?, ?, ?, (SELECT product_price FROM product WHERE product_id = ?))

-- If GCash:
UPDATE orders SET transaction_date = NOW(),
    transaction_total = (SELECT SUM(item_quantity * item_price * (1 - product_discount / 100))
                         FROM order_item oi JOIN product p ON oi.product_id = p.product_id
                         WHERE oi.order_id = ?) + 5.00
WHERE order_id = ?

INSERT INTO gcash (Gorder_id, gcash_reference) VALUES (?, ?)
```
- Note the `+ 5.00` for shipping fee added to the GCash total.
- The `item_price` is captured at time of purchase via a subquery reading the current `product_price`.

---

### 4.5 Admin Dashboard Queries

**Dashboard Summary — `GET /admin/dashboard/summary`**
```sql
SELECT
  COALESCE(SUM(oi.item_quantity * p.product_price * (1 - p.product_discount / 100)), 0) AS revenue,
  COUNT(DISTINCT o.order_id) AS sales,
  COALESCE(SUM(oi.item_quantity), 0) AS items_sold
FROM orders o
JOIN order_item oi ON o.order_id = oi.order_id
JOIN product p ON p.product_id = oi.product_id
WHERE o.order_status <> 'cart'
```
- **Revenue** is calculated as: `quantity × price × (1 - discount/100)`.
- **`COUNT(DISTINCT o.order_id)`** counts unique orders (not individual items).
- **`COALESCE(..., 0)`** ensures a 0 result instead of NULL when there are no orders.

```sql
SELECT COUNT(*) AS customers FROM customer
SELECT COUNT(*) AS low_stock FROM product WHERE product_stock <= 5
```

**Stock Alerts — `GET /admin/dashboard/stock-alerts`**
```sql
SELECT p.product_id, p.product_name, p.product_stock, p.product_type, s.supplier_name
FROM product p
LEFT JOIN supplier s ON s.supplier_id = p.supplier_id
WHERE p.product_stock <= ?
ORDER BY p.product_stock ASC, p.product_name
```
- **`LEFT JOIN`** ensures products without a supplier still appear.
- The `threshold` parameter defaults to 5 but can be customized via query string.

**Top Products — `GET /admin/dashboard/top-products`**
```sql
SELECT p.product_id, p.product_name,
       SUM(oi.item_quantity) AS units,
       SUM(oi.item_quantity * p.product_price * (1 - p.product_discount / 100)) AS revenue
FROM orders o
JOIN order_item oi ON o.order_id = oi.order_id
JOIN product p ON p.product_id = oi.product_id
WHERE o.order_status <> 'cart'
GROUP BY p.product_id
ORDER BY units DESC
LIMIT ?
```

**Sales Report — `GET /admin/sales`**
```sql
SELECT o.order_id, o.order_date, o.order_status, c.customer_name,
       GROUP_CONCAT(CONCAT(p.product_name, ' x', oi.item_quantity)
           ORDER BY p.product_name SEPARATOR ' | ') AS product_list,
       SUM(oi.item_quantity) AS items,
       SUM(oi.item_quantity * p.product_price) AS gross,
       SUM(oi.item_quantity * p.product_price * (p.product_discount / 100)) AS discount,
       SUM(oi.item_quantity * p.product_price * (1 - p.product_discount / 100)) AS total
FROM orders o
JOIN order_item oi ON o.order_id = oi.order_id
JOIN product p ON p.product_id = oi.product_id
LEFT JOIN customer c ON c.customer_id = o.customer_id
WHERE o.order_status <> 'cart'
GROUP BY o.order_id
ORDER BY o.order_date DESC
```
- **`GROUP_CONCAT`** builds a readable string of all products in each order (e.g., `"Widget x2 | Gadget x1"`). This is parsed on the frontend by `parseProductList()`.
- Three financial columns are computed: `gross` (before discount), `discount` (amount saved), `total` (after discount).

**Order Details — `GET /admin/orders/:orderId/details`**
```sql
SELECT o.order_id, o.order_date, o.order_status, c.customer_name,
       p.product_name, p.product_description, p.product_price, p.product_discount,
       oi.item_quantity
FROM orders o
JOIN order_item oi ON o.order_id = oi.order_id
JOIN product p ON p.product_id = oi.product_id
LEFT JOIN customer c ON c.customer_id = o.customer_id
WHERE o.order_id = ? AND o.order_status <> 'cart'
ORDER BY p.product_name
```
- Returns one row per item in the order (un-aggregated), used for the detail modal.

**Suppliers — `GET /admin/suppliers`**
```sql
SELECT s.supplier_id, s.supplier_name, s.supplier_number,
       COUNT(DISTINCT g.goods_id) AS goods_count,
       COUNT(DISTINCT p.product_id) AS product_count
FROM supplier s
LEFT JOIN goods g ON g.supplier_id = s.supplier_id
LEFT JOIN product p ON p.supplier_id = s.supplier_id
GROUP BY s.supplier_id
ORDER BY s.supplier_name
```
- Two `LEFT JOIN`s count how many goods and products each supplier provides.
- `COUNT(DISTINCT ...)` ensures accurate counts even with multiple joins.

---

### 4.6 Admin CRUD Queries

**Update Order Status — `PUT /admin/orders/:orderId/status`**
```sql
UPDATE orders SET order_status = ? WHERE order_id = ? AND order_status <> 'cart'
```
- The `AND order_status <> 'cart'` prevents accidentally modifying active shopping carts.
- Allowed status values are validated server-side: `pending`, `processing`, `completed`.

**Dynamic Update Builder — `buildUpdateFields()`**

This function is used by all PUT endpoints. For example, when updating a product:

```javascript
const { updates, values, invalid } = buildUpdateFields(req.body, {
    product_name:     { column: "product_name", type: "text" },
    product_type:     { column: "product_type", type: "text" },
    product_stock:    { column: "product_stock", type: "number", min: 0 },
    product_price:    { column: "product_price", type: "number", min: 0 },
    product_discount: { column: "product_discount", type: "number", min: 0, max: 100 }
});
```

If the request body is `{ product_price: 29.99, product_stock: 50 }`, the function produces:

```
updates = ["product_price = ?", "product_stock = ?"]
values  = [29.99, 50]
```

Which gets assembled into:
```sql
UPDATE product SET product_price = ?, product_stock = ? WHERE product_id = ?
```

**Create Inventory Item — `POST /admin/inventory`**
```sql
INSERT INTO goods (item_name, item_stock, item_price, supplier_id) VALUES (?, ?, ?, ?)
```

**Delete Inventory Item — `DELETE /admin/inventory/:goodsId`**
```sql
DELETE FROM goods WHERE goods_id = ?
```

---

## 5. How the Cart-as-Order Pattern Works

One of the most important design decisions is that **the shopping cart is stored as a regular order** with a special status.

```
 ┌─────────────────────────────────────────────────────┐
 │                  orders table                       │
 │                                                     │
 │  order_id=1  status='completed'  ← past order       │
 │  order_id=2  status='pending'    ← placed order      │
 │  order_id=3  status='cart'       ← ACTIVE CART ←──── │ ← This is the cart!
 │  order_id=4  status='delivered'  ← past order       │
 └─────────────────────────────────────────────────────┘
```

**Benefits of this approach:**
1. **No separate cart table** — reduces schema complexity.
2. **Checkout is a simple status update** — `UPDATE orders SET order_status = 'pending' WHERE order_status = 'cart'`. No need to copy data between tables.
3. **Cart items use the same `order_item` table** — all item-tracking logic is shared.

**Constraints:**
- Each customer can have **at most one** active cart (filtered by `LIMIT 1`).
- Cart orders are **excluded from all reports** using `WHERE order_status <> 'cart'`.
- Cart orders have no `order_date` set meaningfully until checkout (when it's set to `NOW()`).

---

## 6. Security Measures

### Password Hashing with bcrypt

```javascript
// On signup: hash the password before storing
const hashedPassword = await encrypt.hash(password, 10);

// On login: compare the plaintext password with the stored hash
const match = await encrypt.compare(password, user.passkey);
```

- **Salt rounds = 10** means the password is hashed through 2^10 = 1024 iterations, making brute-force attacks computationally expensive.
- Each hash includes a **unique random salt**, so two users with the same password will have different hashes.
- The plaintext password is **never stored** anywhere — not in the database, not in logs.

### SQL Injection Prevention

Every query uses **parameterized placeholders** (`?`):

```javascript
// SAFE — parameterized:
await db.query("SELECT * FROM product WHERE product_id = ?", [productId]);

// UNSAFE — string concatenation (NOT used in this project):
await db.query("SELECT * FROM product WHERE product_id = " + productId);
```

The `mysql2` driver automatically escapes special characters in the parameter values, making SQL injection attacks impossible.

### Input Validation

The `buildUpdateFields()` function enforces:
- **Type checking** — numeric fields must parse to a valid number.
- **Range limits** — stock can't go below 0, discount can't exceed 100.
- **String trimming** — text values are trimmed of whitespace.
- **Status allow-list** — order status changes only accept `pending`, `processing`, or `completed`.

### Stock Guard (Atomic Check)

```sql
UPDATE product SET product_stock = product_stock - ?
WHERE product_id = ? AND product_stock >= ?
```

The `AND product_stock >= ?` clause prevents negative stock. If two users try to buy the last item simultaneously, only one UPDATE will succeed (the other will affect 0 rows and be rejected). This is an **atomic database-level guard** — no race conditions.
