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

async function fetchJson(path) {
  const res = await fetch(`${ADMIN_API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
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

  const stockRows = await fetchJson("/admin/dashboard/stock-alerts");
  document.getElementById("stockAlertsBody").innerHTML = stockRows.map(row => `
    <tr>
      <td>${row.product_name}</td>
      <td>${row.product_type || ""}</td>
      <td class="text-center">${row.product_stock}</td>
      <td>${row.supplier_name || ""}</td>
    </tr>
  `).join("");

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
  document.getElementById("inventoryBody").innerHTML = rows.map(row => `
    <tr>
      <td>${row.goods_id}</td>
      <td>${row.item_name}</td>
      <td class="text-center">${row.item_stock}</td>
      <td class="text-right">${formatCurrency(row.item_price)}</td>
      <td>${row.supplier_name || ""}</td>
    </tr>
  `).join("");
}

async function loadProducts() {
  const body = document.getElementById("productsBody");
  if (!body) return;

  try {
    const rows = await fetchJson("/admin/products");
    body.innerHTML = rows.map(row => `
      <tr>
        <td>${row.product_id}</td>
        <td>${row.product_name}</td>
        <td>${row.product_type || ""}</td>
        <td class="text-center">${row.product_stock}</td>
        <td class="text-right">${formatCurrency(row.product_price)}</td>
        <td class="text-center">${row.product_discount || 0}%</td>
        <td>${row.supplier_name || ""}</td>
      </tr>
    `).join("");

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7" class="text-center">No products found.</td></tr>`;
    }
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
    <tr>
      <td>${row.order_id}</td>
      <td>${formatDateShort(row.order_date)}</td>
      <td>${row.customer_name || ""}</td>
      <td class="text-center">${row.items}</td>
      <td class="text-right">${formatCurrency(row.gross)}</td>
      <td class="text-right">${formatCurrency(row.discount)}</td>
      <td class="text-right">${formatCurrency(row.total)}</td>
      <td>
        <select class="order-status" data-order-id="${row.order_id}">
          <option value="pending" ${row.order_status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="processing" ${row.order_status === 'processing' ? 'selected' : ''}>Processing</option>
          <option value="completed" ${row.order_status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll('.order-status').forEach((select) => {
    if (select.dataset.bound) return;
    select.addEventListener('change', async (event) => {
      const target = event.currentTarget;
      const orderId = target.dataset.orderId;
      const status = target.value;
      try {
        const res = await fetch(`${ADMIN_API_BASE}/admin/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        if (!res.ok) {
          throw new Error('Status update failed');
        }
      } catch (err) {
        console.error(err);
        alert('Could not update status.');
      }
    });
    select.dataset.bound = 'true';
  });
}

async function loadOrders() {
  const rows = await fetchJson("/admin/orders");
  document.getElementById("ordersBody").innerHTML = rows.map(row => `
    <tr>
      <td>${row.order_id}</td>
      <td>${formatDateShort(row.order_date)}</td>
      <td>${row.customer_name || ""}</td>
      <td class="text-center">${row.items}</td>
      <td>${row.order_status}</td>
    </tr>
  `).join("");
}

async function loadSuppliers() {
  const rows = await fetchJson("/admin/suppliers");
  document.getElementById("suppliersBody").innerHTML = rows.map(row => `
    <tr>
      <td>${row.supplier_id}</td>
      <td>${row.supplier_name}</td>
      <td>${row.supplier_number || ""}</td>
      <td class="text-center">${row.goods_count}</td>
      <td class="text-center">${row.product_count}</td>
    </tr>
  `).join("");
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

  initAdminDropdownFallback();

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