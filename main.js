import './style.css'
import { supabase } from './src/supabase.js'
import { fetchProducts, createProduct, deleteProduct, uploadImageToCloudinary } from './src/inventory.js'
import { fetchOrders, updateOrderStatus, deleteOrder } from './src/orders.js'

const loginContainer = document.getElementById('login-container')
const dashboardContainer = document.getElementById('dashboard-container')
const loginForm = document.getElementById('login-form')
const logoutBtn = document.getElementById('logout-btn')
const loginError = document.getElementById('login-error')
const appContainer = document.getElementById('app')

// Navigation Elements
const navLinks = document.querySelectorAll('.sidebar a')
const pageTitle = document.getElementById('page-title')

// View Elements
const viewHome = document.getElementById('view-home')
const viewInventory = document.getElementById('view-inventory')
const viewOrders = document.getElementById('view-orders')

// Modal Elements
const productModal = document.getElementById('product-modal')
const btnNewProduct = document.getElementById('btn-new-product')
const btnSyncSheets = document.getElementById('btn-sync-sheets')
const closeModalBtn = document.getElementById('close-modal')
const productForm = document.getElementById('product-form')
const productError = document.getElementById('product-error')
const saveProductBtn = document.getElementById('save-product-btn')
const productsTbody = document.getElementById('products-tbody')
const ordersTbody = document.getElementById('orders-tbody')

// Check active session on load
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    showDashboard(session.user)
  } else {
    showLogin()
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showDashboard(session.user)
    } else {
      showLogin()
    }
  })
}

// UI State Management
function showDashboard(user) {
  loginContainer.style.display = 'none'
  dashboardContainer.style.display = 'flex'
  appContainer.style.alignItems = 'flex-start'
  appContainer.style.justifyContent = 'flex-start'

  const userProfile = document.querySelector('.user-profile')
  if (userProfile && user.email) {
    userProfile.textContent = user.email
  }
}

function showLogin() {
  dashboardContainer.style.display = 'none'
  loginContainer.style.display = 'block'
  appContainer.style.alignItems = 'center'
  appContainer.style.justifyContent = 'center'
}

// Login Handler
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  loginError.textContent = ''

  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const btn = loginForm.querySelector('button')
  btn.textContent = 'Logging in...'
  btn.disabled = true

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    loginError.textContent = error.message
    btn.textContent = 'Login'
    btn.disabled = false
  } else {
    btn.textContent = 'Login'
    btn.disabled = false
  }
})

// Logout Handler
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut()
})

// Tab Navigation logic
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    const target = link.getAttribute('data-target');

    // Hide all views
    viewHome.style.display = 'none';
    viewInventory.style.display = 'none';
    viewOrders.style.display = 'none';

    if (target === 'home') {
      pageTitle.textContent = 'Dashboard';
      viewHome.style.display = 'block';
      loadKpis();
    } else if (target === 'inventory') {
      pageTitle.textContent = 'Inventory';
      viewInventory.style.display = 'block';
      loadProductsTable();
    } else if (target === 'orders') {
      pageTitle.textContent = 'Orders';
      viewOrders.style.display = 'block';
      loadOrdersTable();
    }
  });
});

// Modal Logic
btnNewProduct.addEventListener('click', () => {
  productModal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
  productModal.style.display = 'none';
  productForm.reset();
  productError.textContent = '';
});

// Sync from Sheets Logic
btnSyncSheets.addEventListener('click', async () => {
  if (!confirm('This will fetch all items from Google Sheets and add them to Supabase. Continue?')) return;

  btnSyncSheets.textContent = 'Syncing...';
  btnSyncSheets.disabled = true;

  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbyTaPDwM3geTMyA76jaZSeaf1tC7RPRBfUbhPipwWJWktjfzYQH3C38FAfY3DbCXQpt/exec');
    const data = await response.json();

    if (data.status === 'success' && data.catalog && data.catalog.length > 0) {
      const productsToInsert = data.catalog.map(item => ({
        name: item.NOMBRE_PRENDA || 'Unnamed',
        sku: String(item.SKU || ''),
        category: item.CATEGORIA || '',
        brand: item.MARCA || '',
        line: item.LINEA || '',
        sizes: item.TALLES || '',
        colors: item.COLORES || '',
        description: '',
        price: parseFloat(item.PRECIO_VENTA) || 0,
        cost_price: parseFloat(item.COSTO_COMPRA) || 0,
        stock: parseInt(item.STOCK_FISICO, 10) || 0,
        status: String(item.ESTADO).toLowerCase() === 'activo' ? 'active' : 'draft',
        image_url: item.FOTOGRAFIA || ''
      }));

      // Insert all into Supabase
      const { error } = await supabase.from('products').insert(productsToInsert);
      if (error) throw error;

      alert(`Success! Imported ${productsToInsert.length} products.`);
      loadProductsTable();
    } else {
      alert('No data found in Google Sheets.');
    }
  } catch (err) {
    console.error(err);
    alert('Error syncing: ' + err.message);
  } finally {
    btnSyncSheets.innerHTML = '&#8635; Sync from Sheets';
    btnSyncSheets.disabled = false;
  }
});

// Load Products
async function loadProductsTable() {
  productsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading...</td></tr>';
  try {
    const products = await fetchProducts();
    document.getElementById('kpi-products').textContent = products.length;

    if (products.length === 0) {
      productsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No products found.</td></tr>';
      return;
    }

    productsTbody.innerHTML = '';
    products.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img src="${p.image_url || '/vite.svg'}" class="product-img-thumb" alt="product"></td>
        <td><strong>${p.name}</strong><br><small style="color:var(--text-muted)">${p.sku || ''}</small></td>
        <td>$${p.price.toFixed(2)}</td>
        <td>${p.stock}</td>
        <td>
          <button class="btn btn-outline btn-small delete-btn" data-id="${p.id}" style="color: var(--danger); border-color: var(--danger);">Delete</button>
        </td>
      `;
      productsTbody.appendChild(tr);
    });

    // Attach delete handlers
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (confirm('Are you sure you want to delete this product?')) {
          const id = e.target.getAttribute('data-id');
          await deleteProduct(id);
          loadProductsTable(); // Refresh
        }
      });
    });

  } catch (error) {
    productsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Error loading products. Table may not exist yet.</td></tr>';
    console.error(error);
  }
}

// Load Orders
async function loadOrdersTable() {
  if (!ordersTbody) return;
  ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading Orders...</td></tr>';
  try {
    const orders = await fetchOrders();
    document.getElementById('kpi-orders').textContent = orders.filter(o => o.status === 'pending').length;

    if (orders.length === 0) {
      ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No orders found.</td></tr>';
      return;
    }

    ordersTbody.innerHTML = '';
    orders.forEach(o => {
      const tr = document.createElement('tr');
      const date = new Date(o.created_at).toLocaleDateString();
      const statusColors = {
        pending: '#eab308',
        paid: '#3b82f6',
        shipped: '#a855f7',
        delivered: '#22c55e',
        cancelled: '#ef4444'
      };
      const badgeColor = statusColors[o.status] || '#999';

      tr.innerHTML = `
        <td>${date}<br><small style="color:var(--text-muted)">${o.order_number}</small></td>
        <td><strong>${o.customer_name}</strong><br><small style="color:var(--text-muted)">ID: ${o.customer_doc}</small></td>
        <td>${o.items ? o.items.length : 0} items</td>
        <td>$${Number(o.total).toFixed(2)}</td>
        <td><span style="background:${badgeColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; text-transform:uppercase; font-weight: bold;">${o.status}</span></td>
        <td>
          <select class="status-select btn-outline" data-id="${o.id}" style="padding: 4px; border-radius: 4px; font-size: 11px; background: transparent; color: white; border: 1px solid var(--border-color); outline:none;">
             <option value="" disabled selected>Update...</option>
             <option value="pending" style="color:black">Pending</option>
             <option value="paid" style="color:black">Paid</option>
             <option value="shipped" style="color:black">Shipped</option>
             <option value="delivered" style="color:black">Delivered</option>
             <option value="cancelled" style="color:black">Cancelled</option>
          </select>
          <button class="btn btn-outline btn-small print-btn" data-id="${o.id}" style="color: white; border-color: white; margin-left: 4px; padding: 4px;">PDF</button>
          <button class="btn btn-outline btn-small delete-order" data-id="${o.id}" style="color: var(--danger); border-color: var(--danger); margin-left: 4px; padding: 4px;">Del</button>
        </td>
      `;
      ordersTbody.appendChild(tr);
    });

    // Attach Status Update handlers
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const newStatus = e.target.value;
        await updateOrderStatus(id, newStatus);
        loadOrdersTable();
      });
    });

    // Attach Delete handlers
    document.querySelectorAll('.delete-order').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (confirm('Delete this order forever?')) {
          const id = e.target.getAttribute('data-id');
          await deleteOrder(id);
          loadOrdersTable();
        }
      });
    });

    // Attach Print/PDF handlers
    document.querySelectorAll('.print-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const order = orders.find(o => String(o.id) === String(id));
        if (order) generateReceiptPDF(order);
      });
    });

  } catch (error) {
    ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Error loading orders. Table may not exist yet.</td></tr>';
    console.error(error);
  }
}

// Load KPIs for Home
async function loadKpis() {
  try {
    const products = await fetchProducts();
    document.getElementById('kpi-products').textContent = products.length;

    const orders = await fetchOrders();
    document.getElementById('kpi-sales').textContent = orders.length;

    const pendingOrders = orders.filter(o => o.status === 'pending');
    document.getElementById('kpi-orders').textContent = pendingOrders.length;

    // Calculate total revenue (only paid/shipped/delivered)
    const validStatuses = ['paid', 'shipped', 'delivered'];
    const revenue = orders
      .filter(o => validStatuses.includes(o.status))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    document.getElementById('kpi-revenue').textContent = '$' + revenue.toFixed(2);
  } catch (e) { console.error('Error loading KPIs', e); }
}

// PDF Generation
function generateReceiptPDF(order) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const GOLD = [212, 175, 55];
  const OBSIDIAN = [5, 5, 5];

  // Header Background
  doc.setFillColor(...OBSIDIAN);
  doc.rect(0, 0, 210, 60, 'F');

  // Brand Name
  doc.setTextColor(...GOLD);
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.text("D'LUX BOUTIQUE", 105, 30, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("RECIBO DE COMPRA EXCLUSIVO", 105, 45, { align: "center" });
  doc.text(`ORDEN #${order.order_number}`, 105, 52, { align: "center" });

  // Body
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);

  doc.setFont("helvetica", "bold");
  doc.text(" DETALLES DEL CLIENTE", 14, 80);
  doc.setDrawColor(...GOLD);
  doc.line(14, 82, 196, 82);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`CLIENTE: ${order.customer_name.toUpperCase()}`, 14, 90);
  doc.text(`IDENTIFICACIÓN: ${order.customer_doc}`, 14, 96);
  doc.text(`MÉTODO DE PAGO: ${order.payment_method}`, 14, 102);
  doc.text(`ENTREGA: ${order.delivery_mode}`, 14, 108);
  doc.text(`FECHA: ${new Date(order.created_at).toLocaleDateString()}`, 14, 114);

  // Items Table
  const tableColumn = ["Descripción", "Cant", "Precio Unit.", "Subtotal"];
  const tableRows = [];

  let fallbackTotal = 0;
  if (Array.isArray(order.items)) {
    order.items.forEach(item => {
      const lineTotal = (item.q * item.p).toFixed(2);
      fallbackTotal += (item.q * item.p);
      tableRows.push([
        item.n,
        item.q.toString(),
        "$" + item.p.toFixed(2),
        "$" + lineTotal
      ]);
    });
  }

  doc.autoTable({
    startY: 125,
    head: [tableColumn],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: OBSIDIAN,
      textColor: GOLD,
      fontSize: 10,
      fontStyle: 'bold'
    },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  });

  const finalY = doc.lastAutoTable.finalY + 15;

  // Total Section
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(130, finalY - 5, 196, finalY - 5);

  doc.setFont("times", "bolditalic");
  doc.setFontSize(16);
  const totalAmount = order.total ? Number(order.total) : fallbackTotal;
  doc.text(`TOTAL A PAGAR: $${totalAmount.toFixed(2)}`, 196, finalY, { align: "right" });

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Gracias por elegir la exclusividad. D'Lux Boutique.", 105, 280, { align: "center" });

  doc.save(`DLUX_RECIBO_${order.order_number}.pdf`);
}

// Create Product Form Submission
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  productError.textContent = '';
  saveProductBtn.textContent = 'Uploading Image...';
  saveProductBtn.disabled = true;

  try {
    const name = document.getElementById('prod-name').value;
    const sku = document.getElementById('prod-sku').value;
    const category = document.getElementById('prod-category').value;
    const description = document.getElementById('prod-desc').value;
    const brand = document.getElementById('prod-brand').value;
    const line = document.getElementById('prod-line').value;
    const sizes = document.getElementById('prod-sizes').value;
    const colors = document.getElementById('prod-colors').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const cost_price = document.getElementById('prod-cost').value ? parseFloat(document.getElementById('prod-cost').value) : 0;
    const stock = parseInt(document.getElementById('prod-stock').value, 10);
    const status = document.getElementById('prod-status').value;
    const fileInput = document.getElementById('prod-image');

    let imageUrl = '';

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      imageUrl = await uploadImageToCloudinary(file);
    }

    saveProductBtn.textContent = 'Saving to Database...';

    await createProduct({
      name,
      sku,
      category,
      brand,
      line,
      sizes,
      colors,
      description,
      price,
      cost_price,
      stock,
      status,
      image_url: imageUrl
    });

    // Success
    productModal.style.display = 'none';
    productForm.reset();
    saveProductBtn.textContent = 'Save Product';
    saveProductBtn.disabled = false;

    // Refresh table
    loadProductsTable();

  } catch (error) {
    console.error(error);
    productError.textContent = error.message;
    saveProductBtn.textContent = 'Save Product';
    saveProductBtn.disabled = false;
  }
});

// Initialize
checkSession();
