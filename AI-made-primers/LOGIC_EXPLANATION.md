# Enchain-Track — Complete Logic Explanation

This document provides a **comprehensive, line-by-line breakdown** of every piece of logic in the Enchain-Track application: the backend server, client-side scripts, page routing, session management, and user interaction flows.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File-by-File Breakdown](#2-file-by-file-breakdown)
   - [server.js — Backend](#21-serverjs--backend)
   - [global.js — Shared Client Utilities](#22-globaljs--shared-client-utilities)
   - [login.js — Authentication UI](#23-loginjs--authentication-ui)
   - [store.js — Customer Storefront](#24-storejs--customer-storefront)
   - [dashboard.js — Admin Dashboard](#25-dashboardjs--admin-dashboard)
   - [CSS & HTML Templates](#26-css--html-templates)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [Key Design Patterns](#4-key-design-patterns)

---

## 1. Architecture Overview

Enchain-Track is a full-stack web application using a **Client ↔ Server ↔ Database** architecture:

```
┌──────────────────────────────────────────────────────────┐
│  BROWSER (Client)                                        │
│                                                          │
│  login.js ──► login.html / signup.html                   │
│  global.js ──► shared API wrappers + session management  │
│  store.js ──► store/home, store/browse, store/cart,      │
│               store/order                                │
│  dashboard.js ──► dashboard/home, dashboard/inventory,   │
│                   dashboard/products, dashboard/sales,   │
│                   dashboard/orders, dashboard/supplier   │
└──────────────┬───────────────────────────────────────────┘
               │  HTTP fetch() calls (JSON)
               ▼
┌──────────────────────────────────────────────────────────┐
│  SERVER (server.js — Node.js + Express)                  │
│                                                          │
│  • Serves static HTML/CSS/JS files                       │
│  • REST API endpoints for auth, products, cart, orders   │
│  • Admin API endpoints for inventory, reports, edits     │
│  • bcrypt password hashing                               │
└──────────────┬───────────────────────────────────────────┘
               │  mysql2/promise queries
               ▼
┌──────────────────────────────────────────────────────────┐
│  DATABASE (MySQL via XAMPP)                               │
│                                                          │
│  Tables: customer, employee, product, goods (inventory), │
│          supplier, orders, order_item, gcash              │
└──────────────────────────────────────────────────────────┘
```

**Key Points:**

- There is **no frontend build step** — all HTML/CSS/JS is served as-is by Express's static file middleware.
- Session state (which user is logged in) is stored entirely in `localStorage` on the client; there are no server-side sessions or tokens.
- The app has **two user interfaces** that share the same backend: a **Customer Storefront** and an **Admin Dashboard**.

---

## 2. File-by-File Breakdown

### 2.1 `server.js` — Backend

This is the **entire backend** of the application — a single Express server file containing all route handlers and database logic.

#### Initialization (Lines 1–37)

```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
const encrypt = require("bcrypt");
require('dotenv').config();
```

- **Express** — web framework that handles HTTP routing.
- **CORS** — allows cross-origin requests (needed when frontend is opened as a local file or from a different port).
- **bcrypt** — cryptographic library for hashing and comparing passwords. Passwords are **never stored in plaintext**.
- **dotenv** — loads environment variables from a `.env` file (used for `PORT`).

```javascript
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());       // Parse JSON request bodies
app.use(cors());               // Allow all origins
app.use(express.static(path.join(__dirname))); // Serve all project files
```

The `express.static` middleware serves **the entire project directory** as static files. This means the browser can directly access HTML, CSS, JS, and image files by their path.

```javascript
const mysql = require("mysql2/promise");
const db = mysql.createPool({
  host: 'localhost', user: 'root', password: '', database: 'enchain'
});
```

A **connection pool** is created (not a single connection), so multiple simultaneous database queries can be handled without blocking each other.

```javascript
async function testDB() {
    const [rows] = await db.query("SELECT 1");
    console.log("DB Connected Successfully ✔", rows);
}
testDB();
```

On startup, the server immediately tests the database connection and logs success or failure to the console.

---

#### Authentication Endpoints (Lines 39–171)

**`POST /signup`** — Customer registration.
1. Validates that `username`, `phonenumber`, and `password` are all present.
2. Confirms `password` matches `confirmPassword`.
3. Hashes the password with `bcrypt.hash(password, 10)` — the `10` is the salt rounds (how many times the hash is applied, making brute-force attacks harder).
4. Inserts the new customer into the `customer` table.

**`POST /signup/employee`** — Employee registration (used from admin employee management).
- Same flow as customer signup but inserts into the `employee` table instead.

**`POST /login`** — Unified login for both customers and employees.
1. Executes a `UNION` query searching both `customer` and `employee` tables by username.
2. If a user is found, uses `bcrypt.compare()` to check the password against the stored hash.
3. Returns `{ success, userId, name, role }` where `role` is either `'customer'` or `'employee'`. The frontend uses the `role` to decide which interface to redirect to.

**`GET /user/:userId`** — Checks if a user exists and returns their data.
- Uses the same `UNION` approach to search both tables.

---

#### Helper Functions (Lines 175–224)

```javascript
async function productExists(productId)   // returns true/false
async function customerExists(userId)     // returns true/false
async function orderExists(orderId, status) // returns true/false, optionally filtered by status
async function updateProductStock(productId, quantity) // decrements stock
```

These are **reusable guard functions** called before any operation that depends on a record existing. For example, before adding to a cart, the server first checks `customerExists(userId)` and `productExists(productId)`.

---

#### Product Endpoints (Lines 228–290)

| Endpoint                    | Purpose                                                          |
|-----------------------------|------------------------------------------------------------------|
| `GET /products`             | All products, ordered by discount (highest first), then type and name |
| `GET /products/popular`     | Products ranked by total quantity ever ordered (uses `SUM(oi.item_quantity)`) |
| `GET /products/discount`    | Only products with `product_discount > 0`, ordered by discount   |
| `GET /products/categories`  | Distinct `product_type` values, alphabetically                   |

---

#### Cart Endpoints (Lines 294–476)

The cart is **not a separate table** — it's a row in the `orders` table where `order_status = 'cart'`. This means each customer can have at most **one active cart** at any time.

**`GET /cart/:userId`** — Fetches the user's cart.
- Joins `orders → order_item → product` with `WHERE order_status = 'cart'`.

**`POST /cart/:userId/:productId/:quantity`** — Adds an item to cart.
1. Checks if user and product exist.
2. Looks for an existing cart (`order_status = 'cart'`).
3. If no cart exists, creates one:
   - Generates a new `order_id` using `COALESCE(MAX(order_id), 0) + 1` (manual auto-increment).
   - Inserts a new row into `orders` with status `'cart'`.
4. Tries to update the quantity if the product is already in the cart (`UPDATE order_item SET item_quantity = item_quantity + ?`).
5. If no existing row was updated (`affectedRows === 0`), inserts a new `order_item`.

**`DELETE /cart/:userId/:productId`** — Removes a specific product from the cart.

**`PUT /cart/:userId/:productId/:quantity`** — Updates the quantity of a cart item.
- Validates that the new quantity is within stock limits (`quantity <= product_stock`).

---

#### Checkout & Order Endpoints (Lines 480–682)

**`GET /orders/:userId`** — Fetches all orders for a customer (excluding carts).
- Returns results ordered by status priority: `pending → shipped → delivered → other`.

**`POST /orders/:userId`** — Checks out the cart (Cash on Delivery).
1. Verifies a cart exists.
2. Groups items by product and sums quantities.
3. **For each product**, attempts to decrement `product_stock`. The SQL uses `AND product_stock >= ?` to prevent overselling — if the update affects 0 rows, it means stock is insufficient and the checkout is rejected.
4. Updates the order's status from `'cart'` to `'pending'` and sets `transaction_type = 'c'` (cash).

**`POST /orders/:userId/:gcashref`** — Checks out with GCash.
- Same flow as above, but also:
  - Sets `transaction_type = 'g'`.
  - Records `transaction_date` and `transaction_total`.
  - Inserts a row into the `gcash` table with the reference number.

**`POST /quickbuy`** — Instant purchase bypassing the cart.
1. Validates user, product, and stock.
2. Deducts stock immediately.
3. Creates a new order with status `'pending'` directly (no intermediate cart).
4. If a GCash reference is provided, records the payment details.

---

#### Admin API (Lines 686–1141)

**Dashboard Summary (`GET /admin/dashboard/summary`)**
- Aggregates revenue, total sales count, total items sold, total customers, and low-stock product count in a single response.

**Stock Alerts (`GET /admin/dashboard/stock-alerts?threshold=5`)**
- Returns all products with stock at or below the threshold, joined with supplier info.

**Top Products (`GET /admin/dashboard/top-products?limit=5`)**
- Ranks products by total units sold across all orders, calculates revenue factoring in discounts.

**CRUD for Inventory, Products, Suppliers, Orders:**

| Endpoint                              | Method | Description                              |
|---------------------------------------|--------|------------------------------------------|
| `/admin/inventory`                    | GET    | List all goods with supplier names        |
| `/admin/inventory`                    | POST   | Create a new goods item                   |
| `/admin/inventory/:goodsId`           | PUT    | Update goods fields (name, stock, price)  |
| `/admin/inventory/:goodsId`           | DELETE | Delete a goods item                       |
| `/admin/products`                     | GET    | List all products with supplier names     |
| `/admin/products/:productId`          | PUT    | Update product fields                     |
| `/admin/sales`                        | GET    | Aggregated sales report with financials   |
| `/admin/orders`                       | GET    | Aggregated order list                     |
| `/admin/orders/:orderId/details`      | GET    | Line items for a specific order           |
| `/admin/orders/:orderId/status`       | PUT    | Change order status (pending/processing/completed) |
| `/admin/suppliers`                    | GET    | List suppliers with goods/product counts  |
| `/admin/suppliers/:supplierId`        | PUT    | Update supplier name or phone number      |

**The `buildUpdateFields()` Function (Lines 716–748):**
This is a **dynamic SQL builder** used by all PUT endpoints. It:
1. Takes the request body and a field configuration map.
2. For each field in the config, checks if the body contains that key.
3. Validates the type (casts to number, enforces min/max limits, trims strings).
4. Builds an array of `column = ?` clauses and corresponding values.
5. Returns `{ updates, values, invalid }` which the endpoint uses to construct the final `UPDATE` SQL.

This prevents writing separate endpoints for every possible field combination.

---

### 2.2 `global.js` — Shared Client Utilities

This file is loaded on **all customer-facing store pages** and provides:

#### Session Management (Lines 1–21)

```javascript
const API_BASE_URL = "http://localhost:3000";
let CURRENT_USER_ID = "00000003"; // fallback default

function clearUserSession() {
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
}

function setUpUser() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        clearUserSession();
        window.location.href = '/login.html'; // redirect to login
    } else {
        document.querySelector('.profile-name').textContent = `${escapeHTML(username)} ▼`;
        CURRENT_USER_ID = userId;
    }
}
```

Every store page calls `setUpUser()` at the top of `store.js`. If there's no `userId` in `localStorage`, the user is **immediately redirected to login**. This acts as a simple client-side auth guard.

#### Header Dropdown (Lines 23–72)

`createHeaderDropdown()` programmatically creates a dropdown menu under the user profile button with a "Logout" option. It uses event delegation and `stopPropagation()` to handle opening/closing without conflicting with other click handlers.

#### Sidebar Navigation (Lines 74–95)

On `DOMContentLoaded`, the script attaches click handlers to all sidebar navigation buttons. Each button's `.nav-title` text is matched against the `dashboardRoutes` map to determine which page to navigate to.

#### API Wrapper Functions (Lines 97–256)

| Function                 | HTTP Method | Endpoint                       | Purpose                              |
|--------------------------|-------------|--------------------------------|--------------------------------------|
| `loadProducts()`         | GET         | `/products`                    | Fetch all products                   |
| `popularProducts()`      | GET         | `/products/popular`            | Fetch popular products               |
| `discountedProducts()`   | GET         | `/products/discount`           | Fetch discounted products            |
| `getCategories()`        | GET         | `/products/categories`         | Fetch category names                 |
| `getCart()`              | GET         | `/cart/:userId`                | Fetch current user's cart            |
| `addToCart(id, qty)`     | POST        | `/cart/:userId/:id/:qty`       | Add item to cart                     |
| `removeFromCart(id)`     | DELETE      | `/cart/:userId/:id`            | Remove item from cart                |
| `updateCart(id, qty)`    | PUT         | `/cart/:userId/:id/:qty`       | Update item quantity in cart         |
| `quickBuy(id, qty, ref)` | POST       | `/quickbuy`                    | Instant purchase (JSON body)         |
| `getOrders()`            | GET         | `/orders/:userId`              | Fetch user's order history           |
| `addOrder(ref)`          | POST        | `/orders/:userId[/:gcashref]`  | Checkout cart → order                |

#### Utility Functions

- `formatPrice(number)` — returns a number formatted to 2 decimal places.
- `formatDate(dateString)` — returns a date string in ISO format (`YYYY-MM-DD`).
- `categoryAddPlace(categories)` — adds a `place` index to each category for positioning the sliding category indicator.
- `escapeHTML(str)` — sanitizes strings to prevent XSS by replacing `&`, `<`, `>`, `"`, `'` with HTML entities.

---

### 2.3 `login.js` — Authentication UI

This script runs on both `login.html` and `signup.html`.

```javascript
clearUserSession(); // Always clear session when visiting login/signup
```

On page load, it clears any existing session, ensuring a fresh login state.

**Signup Flow:**
1. Intercepts form submission with `e.preventDefault()`.
2. Serializes the form data using `new FormData()` → `Object.fromEntries()`.
3. POSTs the JSON to `/signup`.
4. On success, redirects to `/login.html`.

**Login Flow:**
1. Intercepts form submission.
2. POSTs credentials to `/login`.
3. On success, stores `userId` and `username` in `localStorage`.
4. Checks the `role` field in the response:
   - **`employee`** → redirects to `/dashboard/home.html`
   - **`customer`** → redirects to `/store/home.html`

---

### 2.4 `store.js` — Customer Storefront

This is the **largest client-side file** and uses `document.body.id` to conditionally run logic for different pages.

#### Store Home (`store-home`, Lines 150–197)

- Fetches discounted products and displays them in a **carousel** of 3 "deal cards" at a time.
- Fetches popular products and displays them in a grid of "item cards".
- Creates numbered pagination categories for deals (e.g., page 1, 2, 3…) and product-type categories for items.
- **Event delegation** is used on the category selection containers — a single click handler on the parent catches clicks on any category button.

#### Store Browse (`store-browse`, Lines 199–262)

- Maintains local state variables: `browseProducts`, `currentBrowseCategory`, `currentBrowseSearch`.
- `refreshBrowseDisplay()` re-fetches all products, then filters them client-side by category and search text.
- The **search bar** triggers `refreshBrowseDisplay()` on every keystroke (`'input'` event), providing real-time filtering.

#### Store Cart (`store-cart`, Lines 265–421)

- `createCartTable()` — fetches cart data and renders each item as a table row with a quantity input, product details, price, and a delete button.
- `updateTotals()` — iterates every cart row in the DOM, reads quantity inputs, calculates line totals, discounts, shipping, and grand total. Also enforces **stock limits**: if a user types a quantity higher than available stock, it clamps the value and shows a warning.
- `removeRow()` — removes the DOM row and calls `removeFromCart()` on the backend.
- `onQuantityChange()` — triggers `updateTotals()` for visual feedback and `updateCartQuantity()` to persist the change to the backend.
- `checkoutCart()` — collects all cart items and opens the payment modal.

#### Store Orders (`store-order`, Lines 424–552)

- `renderOrders()` — fetches raw order data from the backend (which comes as flat rows — one row per order-item) and **groups them by `order_id`** into an `orderCache` array of order objects, each containing an `items` array.
- Each order row is clickable. Clicking opens a detail modal with item-by-item breakdown, subtotal, discount, shipping, and total.

#### Product Card Modal (Lines 558–653)

- When any product card (deal card or item card) is clicked, a modal overlay opens showing the product name, description, image, and price.
- The modal has two action buttons:
  - **"Add to Cart"** — calls `addToCartItem()` which wraps `addToCart()` and shows confirmation.
  - **"Buy Now"** — closes the card modal and opens the **Payment Modal** with `quickBuy` context.

#### Payment Modal (Lines 655–777)

This modal handles payment method selection for both cart checkout and quick-buy:

1. **COD (Cash on Delivery):** Immediately places the order via `quickBuy()` or `addOrder(null)`.
2. **GCash:** Shows a secondary view with a text input for the GCash reference number. On submit, calls `quickBuy(productId, quantity, gcashReference)` or `addOrder(gcashReference)`.

The `checkoutContext` object stores which type of checkout is in progress (`'quickBuy'` or `'cartCheckout'`) and any associated data (product ID, quantity). This context is read by the COD and GCash handlers to call the correct backend endpoint.

---

### 2.5 `dashboard.js` — Admin Dashboard

#### Route Map & API Base (Lines 1–14)

```javascript
const dashboardRoutes = {
  Dashboard: '/dashboard/home.html',
  Inventory: '/dashboard/inventory.html',
  Products: '/dashboard/products.html',
  Sales: '/dashboard/sales.html',
  Orders: '/dashboard/orders.html',
  Supplier: '/dashboard/supplier.html'
};
```

The `ADMIN_API_BASE` is dynamically set — if the page is opened as a local file (`file://`), it falls back to `http://localhost:3000`.

#### Formatting Utilities (Lines 16–33)

- `formatCurrency(value)` — returns `₱X.XX`.
- `formatDateShort(value)` — returns `YYYY-MM-DD`.
- `parseProductList(value)` — splits the `GROUP_CONCAT` pipe-separated product list from the backend into an array.

#### Edit Mode System (Lines 35–317)

This is the most complex feature. It allows the admin to **click a button** and convert all table cells marked `data-editable="true"` into live input fields, edit values, and batch-save them.

**State:**
- `editModeEnabled` (boolean) — tracks whether edit mode is on.
- `editBuffer` (Map) — stores pending changes keyed by `"entity:id"` (e.g., `"products:42"`).
- `EDIT_MODE_STORAGE_KEY` — persists edit mode state in `localStorage` so it survives page reloads.

**`enterEditMode()` (Lines 81–117):**
1. Adds the `admin-edit-mode` class to `<body>`.
2. Finds all cells with `data-editable="true"`.
3. Reads the cell's current value and stores it in `data-original-value`.
4. Creates an `<input>` element (type based on `data-type`: text, number, currency, percent).
5. Sets min/max/step attributes for numeric inputs.
6. Attaches an `input` event listener that calls `queueEditChange()`.
7. Replaces the cell's text content with the input.
8. Also enables any `<select>` elements used for order status.

**`exitEditMode({ discard })` (Lines 120–147):**
1. Removes the `admin-edit-mode` class.
2. For each editable cell, reads the input value (or original value if discarding).
3. Replaces the input with formatted text content.
4. Cleans up `data-original-value`.
5. Disables order status selects.

**`queueEditChange(cell, value)` (Lines 169–198):**
1. Finds the parent `<tr>` and reads `data-entity` and `data-id`.
2. Normalizes the new value by type.
3. Compares to the original value:
   - If **different**, stores the change in `editBuffer`.
   - If **same as original**, removes the field from the buffer (the user reverted their change).
4. If an entity entry has no remaining changed fields, it's removed entirely from the buffer.
5. Updates the Save button's disabled state.

**`saveEditModeChanges()` (Lines 233–280):**
1. If the buffer is empty, simply exits edit mode.
2. Disables the Save button to prevent double-clicks.
3. Maps each buffer entry to a `fetch()` `PUT` request to the appropriate endpoint:
   - `inventory` → `/admin/inventory/:id`
   - `products` → `/admin/products/:id`
   - `suppliers` → `/admin/suppliers/:id`
   - `orders` → `/admin/orders/:id/status`
4. Uses `Promise.all` to fire all requests concurrently.
5. On success, clears the buffer, exits edit mode, and refreshes all tables.
6. On failure, re-enables the Save button and shows an error alert.

#### Table Sorting (Lines 534–611)

Client-side sorting is implemented without refetching data:

1. `initSortableTables()` — finds all tables with class `product-table` and attaches click handlers to headers that have a `data-type` attribute.
2. On header click, `sortTableRows()` reads the cell values from the specified column index, normalizes them (strips currency symbols, parses dates), and sorts the `<tr>` elements using `Array.sort()`.
3. Sorted rows are re-appended to the `<tbody>` in order (DOM re-ordering).
4. The sort direction toggles between `asc` and `desc` on each click.

#### Data Loading Functions (Lines 669–823)

Each admin page has a dedicated `load*()` function:

- **`loadDashboardHome()`** — Fetches the summary, stock alerts, and top products. Renders summary cards, stock alert table with color-coded badges (out of stock = red, critical = amber, low = green), and top sellers table.
- **`loadInventory()`** — Fetches goods and renders rows with editable name, stock, and price cells.
- **`loadProducts()`** — Fetches products and renders rows with editable name, type, stock, price, and discount cells.
- **`loadSales()`** — Fetches aggregated sales data including gross, discount, and net totals.
- **`loadOrders()`** — Fetches aggregated order data with status dropdowns.
- **`loadSuppliers()`** — Fetches suppliers with their associated goods and product counts.

Each `load*()` function calls `applyEditModeToPage()` after rendering to ensure that if edit mode is active, the newly rendered cells are converted to inputs.

#### Init Sequence (`initDashboard()`, Lines 832–869)

1. Sets the profile name in the header.
2. Initializes edit mode controls (binds toggle/save/cancel buttons).
3. Initializes the admin dropdown (logout button).
4. Initializes sortable table headers.
5. Initializes the order details modal.
6. Detects which page elements exist and loads the appropriate data.

---

### 2.6 CSS & HTML Templates

#### `css/styles.css`

A single CSS file for the entire application. Key design systems:

- **Layout** — Fixed header (90px), fixed sidebar (100px), scrollable main content area.
- **Badge System** — `.stock-pill` badges use a CSS variable `--badge-bg` for color, with modifier classes: `.stock-out` (red), `.stock-critical` (amber), `.stock-low` (green), `.pending` (amber), `.processing`/`.shipped` (blue), `.completed`/`.delivered` (green).
- **Edit Mode Buttons** — `.edit-toggle`, `.edit-save`, `.edit-cancel` match the badge styling with the same `--badge-bg` variable.

#### HTML Templates

- **`dashboard/*.html`** — 6 pages, each with the same header/sidebar structure and a unique table/content area. Tables include `data-editable`, `data-field`, `data-type`, and `data-entity` attributes for the edit mode system.
- **`store/*.html`** — 5 pages sharing a header and product card/modal structure. Pages are differentiated by `<body id="store-home">`, `store-browse`, etc.
- **`login.html` / `signup.html`** — Form pages with `#login-form` / `#signup-form` IDs.

---

## 3. Data Flow Diagrams

### Customer Purchase Flow
```
User clicks product card
        │
        ▼
   Card Modal opens (store.js openCardModal)
        │
   ┌────┴────┐
   │         │
Add to Cart  Buy Now
   │         │
   ▼         ▼
POST /cart   Payment Modal opens
   │         │
   │    ┌────┴────┐
   │    │         │
   │   COD      GCash
   │    │         │
   │    ▼         ▼
   │  POST      Enter reference
   │  /orders     │
   │    │         ▼
   │    │    POST /orders/:gcashref
   │    │    or POST /quickbuy
   │    │         │
   │    └────┬────┘
   │         │
   │         ▼
   │  Server decrements product_stock
   │  Server updates order_status → 'pending'
   │         │
   ▼         ▼
Cart page   Order page (redirect)
```

### Admin Edit Mode Flow
```
Admin clicks "Edit Mode" button
        │
        ▼
enterEditMode() — all [data-editable] cells get <input>
        │
Admin types changes
        │
        ▼
queueEditChange() — diffs against originalValue → editBuffer
        │
Admin clicks "Save"
        │
        ▼
saveEditModeChanges() — Promise.all(PUT requests)
        │
        ▼
Server runs buildUpdateFields() → dynamic SQL UPDATE
        │
        ▼
refreshAdminTables() — re-fetches and re-renders all tables
```

---

## 4. Key Design Patterns

| Pattern                    | Where Used                                                  | Why                                                    |
|----------------------------|-------------------------------------------------------------|--------------------------------------------------------|
| **Cart-as-Order**          | `orders` table with `status = 'cart'`                       | Avoids a separate cart table; checkout is just a status update |
| **UNION Login**            | `POST /login` queries both customer and employee tables     | Single login endpoint for all user types               |
| **Dynamic SQL Builder**    | `buildUpdateFields()` in server.js                          | One generic PUT handler per entity instead of one per field |
| **Edit Buffer (Map)**      | `dashboard.js` edit mode                                    | Batches multiple field changes into minimal API calls   |
| **Event Delegation**       | Category buttons, table rows, card containers               | Avoids re-binding events after dynamic content is rendered |
| **Conditional Page Logic** | `store.js` uses `document.body.id` to branch                | One JS file serves multiple pages without a bundler     |
| **Client-Side Sorting**    | `sortTableRows()` in dashboard.js                           | Instant sort without server round-trip                  |
| **`localStorage` Session** | userId/username stored in browser                           | Simple auth without server sessions or JWT              |
