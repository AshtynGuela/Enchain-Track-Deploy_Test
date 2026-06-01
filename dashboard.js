const dashboardRoutes = {
  Dashboard: '/dashboard/home.html',
  Inventory: '/dashboard/inventory.html',
  Products: '/dashboard/products.html',
  Sales: '/dashboard/sales.html',
  Orders: '/dashboard/orders.html',
  Supplier: '/dashboard/supplier.html'
};

const ADMIN_API_BASE = ['null', 'file://'].includes(window.location.origin)
  ? 'http://localhost:3000'
  : window.location.origin;
window.ADMIN_API_BASE = ADMIN_API_BASE;
console.log('dashboard.js loaded', ADMIN_API_BASE);

function formatCurrency(value) {
  const num = Number(value || 0);
  return `₱${num.toFixed(2)}`;
}

function formatDateShort(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function parseProductList(value) {
  if (!value) return [];
  return String(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Edit mode edits through id
const EDIT_MODE_STORAGE_KEY = "adminEditMode";
const editBuffer = new Map();
let editModeEnabled = false;

function getEditModeControls() {
  return {
    toggle: document.querySelector(".edit-toggle"),
    actions: document.querySelector(".edit-actions"),
    save: document.querySelector(".edit-save"),
    cancel: document.querySelector(".edit-cancel")
  };
}

function normalizeEditValue(value, type) {
  if (["number", "currency", "percent"].includes(type)) {
    return parseNumberValue(value);
  }
  return String(value ?? "").trim();
}

function formatEditDisplay(value, type) {
  if (type === "currency") {
    return formatCurrency(value);
  }
  if (type === "percent") {
    const numeric = Number(value) || 0;
    return `${numeric}%`;
  }
  return String(value ?? "");
}

function updateEditModeControls() {
  const { toggle, actions, save } = getEditModeControls();
  if (toggle) {
    toggle.setAttribute("aria-pressed", editModeEnabled ? "true" : "false");
    toggle.textContent = editModeEnabled ? "Exit Edit Mode" : "Edit Mode";
  }
  if (actions) {
    actions.hidden = !editModeEnabled;
  }
  if (save) {
    save.disabled = editBuffer.size === 0;
  }
}

function enterEditMode() {
  document.body.classList.add("admin-edit-mode");
  document.querySelectorAll('[data-editable="true"]').forEach((cell) => {
    if (cell.querySelector("input")) return;

    const type = cell.dataset.type || "text";
    const rawValue = normalizeEditValue(cell.dataset.value ?? cell.textContent, type);
    cell.dataset.originalValue = String(rawValue ?? "");

    const input = document.createElement("input");
    input.type = type === "text" ? "text" : "number";
    if (type === "currency" || type === "percent") {
      input.step = "0.01";
    } else if (type === "number") {
      input.step = "1";
    }
    if (type !== "text") {
      input.min = "0";
    }
    if (type === "percent") {
      input.max = "100";
    }
    input.value = rawValue ?? "";
    input.className = "edit-input";
    input.addEventListener("input", () => queueEditChange(cell, input.value));

    cell.textContent = "";
    cell.appendChild(input);
    cell.classList.add("is-editing");
  });

  document.querySelectorAll('[data-edit-control="order-status"]').forEach((select) => {
    if (!select.dataset.originalValue) {
      select.dataset.originalValue = select.value;
    }
    select.disabled = false;
  });
}

function exitEditMode({ discard } = {}) {
  document.body.classList.remove("admin-edit-mode");
  document.querySelectorAll('[data-editable="true"]').forEach((cell) => {
    const input = cell.querySelector("input");
    const hasOriginal = Object.prototype.hasOwnProperty.call(cell.dataset, "originalValue");
    if (!input && !hasOriginal) return;

    const type = cell.dataset.type || "text";
    const original = cell.dataset.originalValue ?? "";
    const rawValue = discard ? original : (input ? input.value : original);
    const normalized = normalizeEditValue(rawValue, type);

    cell.textContent = formatEditDisplay(normalized, type);
    if (["number", "currency", "percent"].includes(type)) {
      cell.dataset.value = String(normalized);
    }
    cell.classList.remove("is-editing");
    delete cell.dataset.originalValue;
  });

  document.querySelectorAll('[data-edit-control="order-status"]').forEach((select) => {
    if (discard && select.dataset.originalValue) {
      select.value = select.dataset.originalValue;
    }
    delete select.dataset.originalValue;
    select.disabled = true;
  });
}

function applyEditModeToPage(options = {}) {
  if (editModeEnabled) {
    enterEditMode();
  } else {
    exitEditMode({ discard: options.discardChanges });
  }
  updateEditModeControls();
}

function setEditModeEnabled(nextState, options = {}) {
  editModeEnabled = Boolean(nextState);
  localStorage.setItem(EDIT_MODE_STORAGE_KEY, editModeEnabled ? "on" : "off");
  applyEditModeToPage(options);
}

function clearEditBuffer() {
  editBuffer.clear();
  updateEditModeControls();
}

function queueEditChange(cell, value) {
  const row = cell.closest("tr");
  if (!row) return;

  const entity = row.dataset.entity;
  const id = row.dataset.id;
  const field = cell.dataset.field;
  if (!entity || !id || !field) return;

  const type = cell.dataset.type || "text";
  const normalized = normalizeEditValue(value, type);
  const baseline = normalizeEditValue(cell.dataset.originalValue ?? "", type);
  const key = `${entity}:${id}`;

  if (!editBuffer.has(key)) {
    editBuffer.set(key, { entity, id, fields: {} });
  }

  const entry = editBuffer.get(key);
  if (normalized === baseline) {
    delete entry.fields[field];
  } else {
    entry.fields[field] = normalized;
  }

  if (Object.keys(entry.fields).length === 0) {
    editBuffer.delete(key);
  }
  updateEditModeControls();
}

function queueOrderStatusChange(select) {
  const row = select.closest("tr");
  if (!row) return;

  const entity = row.dataset.entity;
  const id = row.dataset.id;
  if (!entity || !id) return;

  if (!select.dataset.originalValue) {
    select.dataset.originalValue = select.defaultValue || "";
  }

  const key = `${entity}:${id}`;
  const normalized = String(select.value || "").toLowerCase();
  const baseline = String(select.dataset.originalValue || "").toLowerCase();

  if (!editBuffer.has(key)) {
    editBuffer.set(key, { entity, id, fields: {} });
  }

  const entry = editBuffer.get(key);
  if (normalized === baseline) {
    delete entry.fields.order_status;
  } else {
    entry.fields.order_status = normalized;
  }

  if (Object.keys(entry.fields).length === 0) {
    editBuffer.delete(key);
  }
  updateEditModeControls();
}

async function saveEditModeChanges() {
  if (editBuffer.size === 0) {
    setEditModeEnabled(false, { discardChanges: false });
    return;
  }

  const { save } = getEditModeControls();
  if (save) save.disabled = true;

  const updates = Array.from(editBuffer.values()).map(async (entry) => {
    let endpoint = "";
    let payload = entry.fields;

    if (entry.entity === "inventory") {
      endpoint = `/admin/inventory/${entry.id}`;
    } else if (entry.entity === "products") {
      endpoint = `/admin/products/${entry.id}`;
    } else if (entry.entity === "suppliers") {
      endpoint = `/admin/suppliers/${entry.id}`;
    } else if (entry.entity === "orders") {
      endpoint = `/admin/orders/${entry.id}/status`;
      payload = { status: entry.fields.order_status };
    }

    if (!endpoint) return;

    const res = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Update failed for ${entry.entity} ${entry.id}`);
    }
  });

  try {
    await Promise.all(updates);
    clearEditBuffer();
    setEditModeEnabled(false, { discardChanges: false });
    await refreshAdminTables();
  } catch (err) {
    console.error(err);
    if (save) save.disabled = false;
    alert("Some updates failed. Please review and try again.");
  }
}

function cancelEditModeChanges() {
  clearEditBuffer();
  setEditModeEnabled(false, { discardChanges: true });
}

function initEditModeControls() {
  const controls = getEditModeControls();
  if (!controls.toggle) return;

  if (!controls.toggle.dataset.bound) {
    controls.toggle.addEventListener("click", () => {
      if (editModeEnabled) {
        if (editBuffer.size > 0 && !window.confirm("Discard unsaved edits?")) {
          return;
        }
        cancelEditModeChanges();
      } else {
        setEditModeEnabled(true, { discardChanges: false });
      }
    });
    controls.toggle.dataset.bound = "true";
  }

  if (controls.save && !controls.save.dataset.bound) {
    controls.save.addEventListener("click", saveEditModeChanges);
    controls.save.dataset.bound = "true";
  }

  if (controls.cancel && !controls.cancel.dataset.bound) {
    controls.cancel.addEventListener("click", cancelEditModeChanges);
    controls.cancel.dataset.bound = "true";
  }

  editModeEnabled = localStorage.getItem(EDIT_MODE_STORAGE_KEY) === "on";
  applyEditModeToPage({ discardChanges: false });
}

// Compact product list summary for admin dash
function buildOrderItemsSummary(value) {
  const items = parseProductList(value);
  if (!items.length) {
    return '<span class="order-items-empty">--</span>';
  }

  const preview = items.slice(0, 3);
  const remaining = items.length - preview.length;
  const title = items.join(", ").replace(/"/g, "&quot;");
  const more = remaining > 0
    ? ` <span class="order-items-more">+${remaining} more</span>`
    : "";

  return `<span class="order-items-summary" title="${title}">${preview.join(", ")}${more}</span>`;
}

const ADMIN_SHIPPING_FEE = 5;

function computeAdminOrderTotals(items) {
  let subtotal = 0;
  let discountTotal = 0;

  items.forEach((item) => {
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.price) || 0;
    const discount = Number(item.discount) || 0;
    subtotal += qty * unitPrice;
    discountTotal += qty * unitPrice * (discount / 100);
  });

  const shipping = items.length ? ADMIN_SHIPPING_FEE : 0;
  const total = subtotal - discountTotal + shipping;

  return { subtotal, discountTotal, shipping, total };
}

// Fetch detailed line items for the admin order modal
async function fetchAdminOrderDetails(orderId) {
  const rows = await fetchJson(`/admin/orders/${orderId}/details`);
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const base = rows[0];
  const items = rows.map((row) => ({
    name: row.product_name,
    description: row.product_description || "",
    price: Number(row.product_price) || 0,
    discount: Number(row.product_discount) || 0,
    quantity: Number(row.item_quantity) || 0
  }));

  return {
    order_id: base.order_id,
    order_date: base.order_date,
    order_status: base.order_status,
    customer_name: base.customer_name || "",
    items
  };
}

function buildAdminOrderItemsList(items) {
  if (!items.length) {
    return '<div class="order-detail-item"><div class="product-name">No items found.</div></div>';
  }

  return items.map((item) => {
    const qty = Number(item.quantity) || 0;
    const lineTotal = qty * (Number(item.price) || 0);
    const details = item.description ? item.description : "--";

    return `
      <div class="order-detail-item">
        <div>
          <div class="product-name">${item.name}</div>
          <div class="product-sku">${details}</div>
        </div>
        <div class="text-center">${qty}</div>
        <div class="text-right">${formatCurrency(lineTotal)}</div>
      </div>
    `;
  }).join("");
}

async function openAdminOrderDetails(orderId) {
  const overlay = document.getElementById("adminOrderDetailsOverlay");
  if (!overlay) return;

  const titleEl = document.getElementById("adminOrderModalTitle");
  const statusEl = document.getElementById("adminOrderModalStatus");
  const summaryEl = document.getElementById("adminOrderModalSummary");
  const listEl = document.getElementById("adminOrderItemsList");
  const subtotalEl = document.getElementById("adminModalSubtotal");
  const discountEl = document.getElementById("adminModalDiscount");
  const shippingEl = document.getElementById("adminModalShipping");
  const totalEl = document.getElementById("adminModalTotal");

  if (titleEl) titleEl.textContent = `Order #${orderId}`;
  if (statusEl) statusEl.textContent = "Status: --";
  if (summaryEl) summaryEl.textContent = "Loading order details...";
  if (listEl) listEl.innerHTML = '<div class="order-detail-item"><div class="product-name">Loading...</div></div>';
  if (subtotalEl) subtotalEl.textContent = "--";
  if (discountEl) discountEl.textContent = "--";
  if (shippingEl) shippingEl.textContent = "--";
  if (totalEl) totalEl.textContent = "--";

  overlay.hidden = false;
  document.body.style.overflow = "hidden";

  try {
    const order = await fetchAdminOrderDetails(orderId);
    if (!order) throw new Error("Order not found");

    const itemCount = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const customerLabel = order.customer_name ? `Customer: ${order.customer_name}` : "Customer: --";

    if (titleEl) titleEl.textContent = `Order #${order.order_id}`;
    if (statusEl) statusEl.textContent = `Status: ${order.order_status}`;
    if (summaryEl) {
      summaryEl.textContent = `Date: ${formatDateShort(order.order_date)} | ${customerLabel} | Items: ${itemCount}`;
    }
    if (listEl) listEl.innerHTML = buildAdminOrderItemsList(order.items);

    const totals = computeAdminOrderTotals(order.items);
    if (subtotalEl) subtotalEl.textContent = formatCurrency(totals.subtotal);
    if (discountEl) discountEl.textContent = `-${formatCurrency(totals.discountTotal)}`;
    if (shippingEl) shippingEl.textContent = formatCurrency(totals.shipping);
    if (totalEl) totalEl.textContent = formatCurrency(totals.total);
  } catch (err) {
    console.error(err);
    overlay.hidden = true;
    document.body.style.overflow = "";
    alert("Could not load order details.");
  }
}

// Bind table row clicks to open the admin order details modal.
function initAdminOrderDetails() {
  const overlay = document.getElementById("adminOrderDetailsOverlay");
  if (!overlay) return;

  const closeButton = overlay.querySelector(".modal-close");
  const closeModal = () => {
    overlay.hidden = true;
    document.body.style.overflow = "";
  };

  if (!overlay.dataset.bound) {
    if (closeButton) {
      closeButton.addEventListener("click", closeModal);
    }
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal();
    });
    overlay.dataset.bound = "true";
  }

  ["ordersBody", "salesBody"].forEach((tbodyId) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody || tbody.dataset.modalBound) return;

    tbody.addEventListener("click", (event) => {
      if (event.target.closest("select")) return;
      const row = event.target.closest("tr[data-order-id]");
      if (!row) return;
      openAdminOrderDetails(row.dataset.orderId);
    });

    tbody.dataset.modalBound = "true";
  });
}

function bindOrderStatusEvents() {
  document.querySelectorAll(".order-status").forEach((select) => {
    if (select.dataset.bound) return;
    select.addEventListener("change", (event) => {
      const target = event.currentTarget;
      if (!editModeEnabled) {
        target.value = target.dataset.originalValue || target.value;
        return;
      }
      queueOrderStatusChange(target);
    });
    select.dataset.bound = "true";
  });
}

async function refreshAdminTables() {
  const tasks = [];
  if (document.getElementById("inventoryBody")) tasks.push(loadInventory());
  if (document.getElementById("productsBody")) tasks.push(loadProducts());
  if (document.getElementById("salesBody")) tasks.push(loadSales());
  if (document.getElementById("ordersBody")) tasks.push(loadOrders());
  if (document.getElementById("suppliersBody")) tasks.push(loadSuppliers());
  if (tasks.length) {
    const results = await Promise.allSettled(tasks);
    results.forEach((result) => {
      if (result.status === "rejected") {
        console.error("Admin table refresh failed:", result.reason);
      }
    });
  }
}

async function fetchJson(path) {
  const res = await fetch(`${ADMIN_API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
}

function parseNumberValue(value) {
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function normalizeSortValue(value, type) {
  switch (type) {
    case "number":
    case "currency":
      return parseNumberValue(value);
    case "date": {
      const timestamp = Date.parse(value);
      return Number.isNaN(timestamp) ? 0 : timestamp;
    }
    default:
      return String(value || "").trim().toLowerCase();
  }
}

function getCellSortValue(cell, type) {
  if (!cell) return "";
  const select = cell.querySelector("select");
  const input = cell.querySelector("input");
  const rawValue = select ? select.value : (input ? input.value : cell.textContent);
  return normalizeSortValue(rawValue, type);
}

function setSortIndicator(table, activeHeader, direction) {
  table.querySelectorAll("thead th.sortable").forEach((header) => {
    if (header === activeHeader) {
      header.dataset.sortDir = direction;
    } else {
      delete header.dataset.sortDir;
    }
  });
}

function sortTableRows(table, columnIndex, type, direction) {
  const tbody = table.tBodies[0];
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));
  if (rows.length < 2) return;

  const multiplier = direction === "desc" ? -1 : 1;
  rows.sort((rowA, rowB) => {
    const valueA = getCellSortValue(rowA.children[columnIndex], type);
    const valueB = getCellSortValue(rowB.children[columnIndex], type);

    if (typeof valueA === "number" && typeof valueB === "number") {
      return (valueA - valueB) * multiplier;
    }

    return String(valueA).localeCompare(String(valueB)) * multiplier;
  });

  rows.forEach((row) => tbody.appendChild(row));
}

function initSortableTables() {
  document.querySelectorAll(".product-table").forEach((table) => {
    const headers = table.querySelectorAll("thead th");
    headers.forEach((header, index) => {
      const type = header.dataset.type;
      if (!type || header.dataset.sortBound) return;

      header.classList.add("sortable");
      if (!header.querySelector(".sort-indicator")) {
        const indicator = document.createElement("span");
        indicator.className = "sort-indicator";
        header.appendChild(indicator);
      }

      header.addEventListener("click", () => {
        const direction = header.dataset.sortDir === "asc" ? "desc" : "asc";
        setSortIndicator(table, header, direction);
        sortTableRows(table, index, type, direction);
      });

      header.dataset.sortBound = "true";
    });
  });
}

function initAdminDropdownFallback() {
  const profile = document.querySelector('.header-actions .profile');
  if (!profile) return;

  const headerActions = profile.closest('.header-actions');
  if (!headerActions) return;

  let menu = headerActions.querySelector('.header-dropdown-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.className = 'header-dropdown-menu';
    headerActions.appendChild(menu);
    profile.dataset.dropdownBound = 'true';
  }

  let button = menu.querySelector('.header-dropdown-item');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'header-dropdown-item';
    button.textContent = 'Logout';
    menu.appendChild(button);
  }

  if (!button.dataset.bound) {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (typeof clearUserSession === 'function') {
        clearUserSession();
      } else {
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
      }
      window.location.href = '/login.html';
    });
    button.dataset.bound = 'true';
  }

  if (!profile.dataset.dropdownBound) {
    profile.addEventListener('click', (event) => {
      event.stopPropagation();
      menu.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      menu.classList.remove('open');
    });

    menu.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    profile.dataset.dropdownBound = 'true';
  }
}

async function loadDashboardHome() {
  const summary = await fetchJson("/admin/dashboard/summary");
  document.getElementById("dashboardRevenue").textContent = formatCurrency(summary.revenue);
  document.getElementById("dashboardSales").textContent = summary.sales;
  document.getElementById("dashboardItems").textContent = summary.items_sold;
  document.getElementById("dashboardCustomers").textContent = summary.customers;

  const STOCK_THRESHOLD = 5;

  const stockRows = await fetchJson(`/admin/dashboard/stock-alerts?threshold=${STOCK_THRESHOLD}`);

  // Update the Stock Alert title with a live count badge
  const stockTitleEl = document.querySelector('.stock-alerts .table-title');
  if (stockTitleEl) {
    stockTitleEl.innerHTML = `Stock Alert <span class="stock-alert-count ${stockRows.length === 0 ? 'stock-count-ok' : 'stock-count-warn'}">${stockRows.length}</span>`;
  }

  function stockBadge(qty) {
    if (qty === 0) return `<span class="stock-pill stock-out">Out of Stock</span>`;
    if (qty <= 3)  return `<span class="stock-pill stock-critical">${qty}</span>`;
    return             `<span class="stock-pill stock-low">${qty}</span>`;
  }

  document.getElementById("stockAlertsBody").innerHTML = stockRows.length
    ? stockRows.map(row => `
    <tr>
      <td>${row.product_name}</td>
      <td>${row.product_type || "—"}</td>
      <td class="text-center">${stockBadge(row.product_stock)}</td>
      <td>${row.supplier_name || "—"}</td>
    </tr>
  `).join("")
    : `<tr><td colspan="4" class="stock-alerts-empty">ALL PRODUCTS ARE CURRENTLY WELL-STOCKED.</td></tr>`;

  const topRows = await fetchJson("/admin/dashboard/top-products?limit=5");
  document.getElementById("topProductsBody").innerHTML = topRows.map(row => `
    <tr>
      <td>${row.product_name}</td>
      <td class="text-center">${row.units}</td>
      <td class="text-right">${formatCurrency(row.revenue)}</td>
    </tr>
  `).join("");
}

async function loadInventory() {
  const rows = await fetchJson("/admin/inventory");
  document.getElementById("inventoryBody").innerHTML = rows.map((row) => {
    const stock = Number(row.item_stock) || 0;
    const price = Number(row.item_price) || 0;
    return `
    <tr data-entity="inventory" data-id="${row.goods_id}">
      <td>${row.goods_id}</td>
      <td data-editable="true" data-field="item_name" data-type="text">${row.item_name}</td>
      <td class="text-center" data-editable="true" data-field="item_stock" data-type="number" data-value="${stock}">${stock}</td>
      <td class="text-right" data-editable="true" data-field="item_price" data-type="currency" data-value="${price}">${formatCurrency(price)}</td>
      <td>${row.supplier_name || ""}</td>
    </tr>
  `;
  }).join("");
  applyEditModeToPage({ discardChanges: false });
}

async function loadProducts() {
  const body = document.getElementById("productsBody");
  if (!body) return;

  try {
    const rows = await fetchJson("/admin/products");
    body.innerHTML = rows.map((row) => {
      const stock = Number(row.product_stock) || 0;
      const price = Number(row.product_price) || 0;
      const discount = Number(row.product_discount) || 0;
      return `
      <tr data-entity="products" data-id="${row.product_id}">
        <td>${row.product_id}</td>
        <td data-editable="true" data-field="product_name" data-type="text">${row.product_name}</td>
        <td data-editable="true" data-field="product_type" data-type="text">${row.product_type || ""}</td>
        <td class="text-center" data-editable="true" data-field="product_stock" data-type="number" data-value="${stock}">${stock}</td>
        <td class="text-right" data-editable="true" data-field="product_price" data-type="currency" data-value="${price}">${formatCurrency(price)}</td>
        <td class="text-center" data-editable="true" data-field="product_discount" data-type="percent" data-value="${discount}">${discount}%</td>
        <td>${row.supplier_name || ""}</td>
      </tr>
    `;
    }).join("");

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7" class="text-center">No products found.</td></tr>`;
    }
    applyEditModeToPage({ discardChanges: false });
    return rows;
  } catch (err) {
    console.error('Products load failed:', err);
    body.innerHTML = `<tr><td colspan="7" class="text-center">Failed to load products.</td></tr>`;
    return [];
  }
}

async function loadSales() {
  const rows = await fetchJson("/admin/sales");
  document.getElementById("salesBody").innerHTML = rows.map(row => `
    <tr class="admin-order-row" data-order-id="${row.order_id}" data-entity="orders" data-id="${row.order_id}">
      <td>${row.order_id}</td>
      <td>${formatDateShort(row.order_date)}</td>
      <td>${row.customer_name || ""}</td>
      <td>${buildOrderItemsSummary(row.product_list)}</td>
      <td class="text-center">${row.items}</td>
      <td class="text-right">${formatCurrency(row.gross)}</td>
      <td class="text-right">${formatCurrency(row.discount)}</td>
      <td class="text-right">${formatCurrency(row.total)}</td>
      <td>
        <select class="order-status" data-order-id="${row.order_id}" data-edit-control="order-status" data-original-value="${row.order_status}" ${editModeEnabled ? "" : "disabled"}>
          <option value="pending" ${row.order_status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="processing" ${row.order_status === 'processing' ? 'selected' : ''}>Processing</option>
          <option value="completed" ${row.order_status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
    </tr>
  `).join("");
  bindOrderStatusEvents();
}

async function loadOrders() {
  const rows = await fetchJson("/admin/orders");
  document.getElementById("ordersBody").innerHTML = rows.map(row => `
    <tr class="admin-order-row" data-order-id="${row.order_id}" data-entity="orders" data-id="${row.order_id}">
      <td>${row.order_id}</td>
      <td>${formatDateShort(row.order_date)}</td>
      <td>${row.customer_name || ""}</td>
      <td>${buildOrderItemsSummary(row.product_list)}</td>
      <td class="text-center">${row.items}</td>
      <td>
        <select class="order-status" data-order-id="${row.order_id}" data-edit-control="order-status" data-original-value="${row.order_status}" ${editModeEnabled ? "" : "disabled"}>
          <option value="pending" ${row.order_status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="processing" ${row.order_status === 'processing' ? 'selected' : ''}>Processing</option>
          <option value="completed" ${row.order_status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
    </tr>
  `).join("");
  bindOrderStatusEvents();
}

async function loadSuppliers() {
  const rows = await fetchJson("/admin/suppliers");
  document.getElementById("suppliersBody").innerHTML = rows.map(row => `
    <tr data-entity="suppliers" data-id="${row.supplier_id}">
      <td>${row.supplier_id}</td>
      <td data-editable="true" data-field="supplier_name" data-type="text">${row.supplier_name}</td>
      <td data-editable="true" data-field="supplier_number" data-type="text">${row.supplier_number || ""}</td>
      <td class="text-center">${row.goods_count}</td>
      <td class="text-center">${row.product_count}</td>
    </tr>
  `).join("");
  applyEditModeToPage({ discardChanges: false });
}

window.loadProducts = loadProducts;
window.loadInventory = loadInventory;
window.loadSales = loadSales;
window.loadOrders = loadOrders;
window.loadSuppliers = loadSuppliers;
window.loadDashboardHome = loadDashboardHome;

async function initDashboard() {
  const profileName = document.querySelector('.profile-name');
  if (profileName && !profileName.textContent.trim()) {
    const storedName = localStorage.getItem('username') || 'Admin';
    profileName.textContent = `${storedName} ▼`;
  }

  initEditModeControls();
  initAdminDropdownFallback();
  initSortableTables();
  initAdminOrderDetails();

  if (document.getElementById("dashboardRevenue")) {
  try { await loadDashboardHome(); } catch(e) { console.error('Dashboard load failed:', e); }
}
if (document.getElementById("inventoryBody")) {
  try { await loadInventory(); } catch(e) { console.error('Inventory load failed:', e); }
}
if (document.getElementById("productsBody")) {
  try { await loadProducts(); } catch(e) { console.error('Products load failed:', e); }
}
if (document.getElementById("salesBody")) {
  try { await loadSales(); } catch(e) { console.error('Sales load failed:', e); }
}
if (document.getElementById("ordersBody")) {
  try { await loadOrders(); } catch(e) { console.error('Orders load failed:', e); }
}
if (document.getElementById("suppliersBody")) {
  try { await loadSuppliers(); } catch(e) { console.error('Suppliers load failed:', e); }
}

  const productsBody = document.getElementById("productsBody");
  if (productsBody && !productsBody.innerHTML.trim()) {
    setTimeout(() => {
      loadProducts();
    }, 150);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}