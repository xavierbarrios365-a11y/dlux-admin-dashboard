import './style.css'
import { supabase, getUserProfile } from './src/supabase.js'
import { fetchProducts, createProduct, updateProduct, deleteProduct, uploadImageToCloudinary } from './src/inventory.js'
import { fetchOrders, updateOrderStatus, deleteOrder } from './src/orders.js'
import { registerSale, registerExpense, fetchTransactions, getFinancialSummary } from './src/sales.js'

// Initialize on DOM Ready to avoid null errors
document.addEventListener('DOMContentLoaded', () => {
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
  const closeModalBtn = document.getElementById('close-modal')
  const productForm = document.getElementById('product-form')
  const productError = document.getElementById('product-error')
  const saveProductBtn = document.getElementById('save-product-btn')
  const productsTbody = document.getElementById('products-tbody')
  const ordersTbody = document.getElementById('orders-tbody')

  // Sales Modal Elements
  const salesModal = document.getElementById('sales-modal')
  const btnNewOrder = document.getElementById('btn-new-order')
  const closeSalesModalBtn = document.getElementById('close-sales-modal')
  const salesForm = document.getElementById('sales-form')
  const saleItemsContainer = document.getElementById('sale-items-container')
  const btnAddItem = document.getElementById('btn-add-item')
  const saleTotalDisplay = document.getElementById('sale-total-display')
  const salesError = document.getElementById('sales-error')

  // Expense Modal Elements
  const expenseModal = document.getElementById('expense-modal')
  const btnNewExpense = document.getElementById('btn-new-expense')
  const closeExpenseModalBtn = document.getElementById('close-expense-modal')
  const expenseForm = document.getElementById('expense-form')
  const expenseError = document.getElementById('expense-error')

  let currentUserRole = 'vendedor';
  let inventoryEditEnabled = false;

  // Check active session on load
  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      const profile = await getUserProfile(session.user.id);
      currentUserRole = profile.role;
      showDashboard(session.user)
      applyPermissions(currentUserRole);
    } else {
      showLogin()
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const profile = await getUserProfile(session.user.id);
        currentUserRole = profile.role;
        showDashboard(session.user)
        applyPermissions(currentUserRole);
      } else {
        showLogin()
      }
    })
  }

  function applyPermissions(role) {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
      el.style.display = (role === 'admin') ? 'block' : 'none';
      if (el.tagName === 'A' && role === 'admin') el.style.display = 'block';
    });

    // Handle inventory edit restriction
    updateInventoryUIState();
  }

  const toggleInvEdit = document.getElementById('toggle-inventory-edit');
  if (toggleInvEdit) {
    toggleInvEdit.addEventListener('change', (e) => {
      inventoryEditEnabled = e.target.checked;
      updateInventoryUIState();
    });
  }

  function updateInventoryUIState() {
    const canEdit = (currentUserRole === 'admin' || inventoryEditEnabled);
    if (btnNewProduct) btnNewProduct.style.display = canEdit ? 'block' : 'none';

    // Disable/Enable edit buttons in rows
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.style.display = canEdit ? 'block' : 'none';
    });
  }

  // UI State Management
  function showDashboard(user) {
    if (loginContainer) loginContainer.style.display = 'none'
    if (dashboardContainer) dashboardContainer.style.display = 'flex'
    if (appContainer) {
      appContainer.style.alignItems = 'flex-start'
      appContainer.style.justifyContent = 'flex-start'
    }

    const userProfile = document.querySelector('.user-profile')
    if (userProfile && user.email) {
      userProfile.textContent = user.email
    }
  }

  function showLogin() {
    if (dashboardContainer) dashboardContainer.style.display = 'none'
    if (loginContainer) loginContainer.style.display = 'block'
    if (appContainer) {
      appContainer.style.alignItems = 'center'
      appContainer.style.justifyContent = 'center'
    }
  }

  // Login Handler
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      if (loginError) loginError.textContent = ''

      const email = document.getElementById('email').value
      const password = document.getElementById('password').value
      const btn = loginForm.querySelector('button')
      const originalText = btn.textContent
      btn.textContent = 'Iniciando sesión...'
      btn.disabled = true

      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) {
          if (loginError) loginError.textContent = error.message
        }
      } catch (err) {
        if (loginError) loginError.textContent = 'Error de conexión'
      } finally {
        btn.textContent = originalText
        btn.disabled = false
      }
    })
  }

  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut()
    })
  }

  // Tab Navigation logic
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const target = link.getAttribute('data-target');

      // Hide all views
      const views = document.querySelectorAll('.view-section');
      views.forEach(v => v.style.display = 'none');

      const targetView = document.getElementById(`view-${target}`);
      if (targetView) targetView.style.display = 'block';

      if (pageTitle) {
        const titles = {
          home: 'Dashboard',
          inventory: 'Inventario',
          orders: 'Ventas / Pedidos',
          reports: 'Reportes Contables',
          users: 'Usuarios',
          credits: 'Créditos y Apartados',
          payroll: 'Nómina y Servicios'
        };
        pageTitle.textContent = titles[target] || 'Dashboard';
      }

      // Refresh Data
      if (target === 'home') loadHomeData();
      if (target === 'inventory') loadProductsTable();
      if (target === 'orders') loadOrdersTable();
      if (target === 'reports') loadReportsTable();
      if (target === 'users') loadUsersTable();
      if (target === 'credits') loadCreditsTable();
      if (target === 'payroll') loadPayrollTable();
    });
  });

  async function loadUsersTable() {
    const usersTbody = document.getElementById('users-tbody');
    if (!usersTbody) return;

    try {
      usersTbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Cargando equipo...</td></tr>';
      const { data: users, error } = await supabase.from('profiles').select('*');
      if (error) throw error;

      usersTbody.innerHTML = '';
      users.forEach(u => {
        const tr = document.createElement('tr');
        const roleBadge = u.role === 'admin' ? 'badge-primary' : 'badge-outline';
        tr.innerHTML = `
          <td><strong>${u.id.substring(0, 8)}...</strong></td>
          <td><span class="badge ${roleBadge}">${u.role}</span></td>
          <td><span class="badge badge-success">Activo</span></td>
          <td>
            <button class="btn btn-outline btn-small dev-only" disabled>Editar Rol</button>
          </td>
        `;
        usersTbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
      usersTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color:var(--danger)">Error cargando usuarios.</td></tr>';
    }
  }

  async function loadCreditsTable() {
    const creditsTbody = document.getElementById('credits-tbody');
    if (!creditsTbody) return;
    try {
      creditsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Cargando créditos...</td></tr>';
      const { data, error } = await supabase.from('credits').select('*').order('due_date', { ascending: true });
      if (error) throw error;
      creditsTbody.innerHTML = data.length ? '' : '<tr><td colspan="6" style="text-align: center;">No hay créditos pendientes.</td></tr>';
      data.forEach(c => {
        const tr = document.createElement('tr');
        const statusBadge = c.status === 'overdue' ? 'badge-danger' : (c.status === 'paid' ? 'badge-success' : 'badge-warning');
        tr.innerHTML = `
          <td><strong>${c.customer_name}</strong></td>
          <td>$${c.total_amount.toFixed(2)}</td>
          <td style="color: var(--danger); font-weight:700;">$${c.remaining_amount.toFixed(2)}</td>
          <td>${c.due_date || 'N/A'}</td>
          <td><span class="badge ${statusBadge}">${c.status.toUpperCase()}</span></td>
          <td><button class="btn btn-outline btn-small dev-only" disabled>Abonar</button></td>
        `;
        creditsTbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function loadPayrollTable() {
    const payrollTbody = document.getElementById('payroll-tbody');
    if (!payrollTbody) return;
    try {
      payrollTbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando nómina...</td></tr>';
      const { data, error } = await supabase.from('payroll').select('*').order('payment_date', { ascending: false });
      if (error) throw error;
      payrollTbody.innerHTML = data.length ? '' : '<tr><td colspan="5" style="text-align: center;">No hay registros de nómina.</td></tr>';
      data.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${p.employee_name}</strong></td>
          <td>$${p.amount.toFixed(2)}</td>
          <td>${p.payment_date}</td>
          <td><small>${p.period_start || ''} al ${p.period_end || ''}</small></td>
          <td><span class="badge badge-outline">${p.payment_method}</span></td>
        `;
        payrollTbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  }

  // Inventory Search Logic
  const inventorySearch = document.getElementById('inventory-search');
  if (inventorySearch) {
    inventorySearch.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      document.querySelectorAll('#inventory-tbody tr').forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  // Gallery Preview Logic
  const imageGalleryPreview = document.getElementById('image-gallery-preview');
  const prodImageInput = document.getElementById('prod-image');

  if (prodImageInput && imageGalleryPreview) {
    prodImageInput.addEventListener('change', (e) => {
      imageGalleryPreview.innerHTML = '';
      const files = Array.from(e.target.files).slice(0, 5);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (rev) => {
          const img = document.createElement('img');
          img.src = rev.target.result;
          img.style.width = '60px';
          img.style.height = '60px';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '4px';
          img.style.border = '1px solid var(--border-clean)';
          imageGalleryPreview.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  // Modal Logic
  if (btnNewProduct) {
    btnNewProduct.addEventListener('click', () => {
      if (productForm) productForm.reset();
      const prodId = document.getElementById('prod-id');
      if (prodId) prodId.value = '';
      const modalTitle = document.getElementById('modal-title');
      if (modalTitle) modalTitle.textContent = 'Nuevo Producto';
      const deleteBtn = document.getElementById('delete-product-btn');
      if (deleteBtn) deleteBtn.style.display = 'none';
      if (imageGalleryPreview) imageGalleryPreview.innerHTML = '';
      if (productModal) productModal.style.display = 'flex';
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      if (productModal) productModal.style.display = 'none';
      if (productForm) productForm.reset();
      if (productError) productError.textContent = '';
    });
  }

  // Load Products
  async function loadProductsTable() {
    if (!productsTbody) return;
    productsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Cargando inventario...</td></tr>';
    try {
      const products = await fetchProducts();
      const kpiProducts = document.getElementById('kpi-products');
      if (kpiProducts) kpiProducts.textContent = products.length;

      if (products.length === 0) {
        productsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No hay productos en el inventario.</td></tr>';
        return;
      }

      productsTbody.innerHTML = '';
      products.forEach(p => {
        const tr = document.createElement('tr');

        // Determine image (handle gallery or single url)
        let mainImg = 'https://via.placeholder.com/60?text=DLUX';
        if (p.images && p.images.length > 0) mainImg = p.images[0];
        else if (p.image_url) mainImg = p.image_url;

        const stockClass = p.stock <= 0 ? 'badge-danger' : (p.stock <= 5 ? 'badge-warning' : 'badge-success');
        const stockText = p.stock <= 0 ? 'Agotado' : (p.stock <= 5 ? 'Bajo Stock' : 'Disponible');

        tr.innerHTML = `
        <td><img src="${mainImg}" class="product-img-thumb" onerror="this.src='https://via.placeholder.com/60?text=Error'"></td>
        <td>
          <div style="font-weight:700">${p.name}</div>
          <div style="font-size:0.7rem; color:var(--text-muted)">${p.sku || 'SIN SKU'}</div>
        </td>
        <td style="font-weight:600">$${p.price.toFixed(2)}</td>
        <td>${p.stock}</td>
        <td><span class="badge ${stockClass}">${stockText}</span></td>
        <td>
          <button class="btn btn-outline btn-small edit-btn" data-id="${p.id}">Editar</button>
        </td>
      `;
        productsTbody.appendChild(tr);
      });

      // Attach edit handlers
      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.getAttribute('data-id');
          const product = products.find(p => String(p.id) === String(id));
          if (product) openEditModal(product);
        });
      });

      updateInventoryUIState(); // Re-apply visibility based on current permissions

    } catch (error) {
      productsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--danger);">Error al cargar productos. Por favor intente de nuevo.</td></tr>';
      console.error(error);
    }
  }

  function openEditModal(p) {
    if (productForm) productForm.reset();
    const prodId = document.getElementById('prod-id');
    if (prodId) prodId.value = p.id;
    const prodName = document.getElementById('prod-name');
    if (prodName) prodName.value = p.name;
    const prodPrice = document.getElementById('prod-price');
    if (prodPrice) prodPrice.value = p.price;
    const prodStock = document.getElementById('prod-stock');
    if (prodStock) prodStock.value = p.stock;
    const prodDesc = document.getElementById('prod-desc');
    if (prodDesc) prodDesc.value = p.description || '';
    const prodStatus = document.getElementById('prod-status');
    if (prodStatus) prodStatus.value = p.status || 'active';

    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) modalTitle.textContent = 'Editar Producto';
    const deleteBtn = document.getElementById('delete-product-btn');
    if (deleteBtn) deleteBtn.style.display = 'block';

    // Show images
    if (imageGalleryPreview) {
      imageGalleryPreview.innerHTML = '';
      const currentImages = p.images || (p.image_url ? [p.image_url] : []);
      currentImages.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '60px'; img.style.height = '60px';
        img.style.objectFit = 'cover'; img.style.borderRadius = '4px';
        img.style.border = '1px solid var(--border-clean)';
        imageGalleryPreview.appendChild(img);
      });
    }

    if (productModal) productModal.style.display = 'flex';
  }

  // Load Orders
  async function loadOrdersTable() {
    if (!ordersTbody) return;
    ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Cargando pedidos...</td></tr>';
    try {
      const orders = await fetchOrders();
      const kpiOrders = document.getElementById('kpi-orders');
      if (kpiOrders) kpiOrders.textContent = orders.filter(o => o.status === 'pending').length;

      if (orders.length === 0) {
        ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No se encontraron pedidos.</td></tr>';
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
          <select class="status-select btn-outline" data-id="${o.id}" style="padding: 4px; border-radius: 4px; font-size: 11px; background: transparent; color: var(--text-main); border: 1px solid var(--border-clean); outline:none;">
             <option value="" disabled selected>Actualizar...</option>
             <option value="pending">Pediente</option>
             <option value="paid">Pagado</option>
             <option value="shipped">Enviado</option>
             <option value="delivered">Entregado</option>
             <option value="cancelled">Cancelado</option>
          </select>
          <button class="btn btn-outline btn-small print-btn" data-id="${o.id}" style="margin-left: 4px; padding: 4px; width:auto">PDF</button>
          <button class="btn btn-outline btn-small delete-order" data-id="${o.id}" style="color: var(--danger); border-color: var(--danger); margin-left: 4px; padding: 4px; width:auto">Eliminar</button>
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
          if (confirm('¿Eliminar este pedido permanentemente?')) {
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
      ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Error cargando pedidos.</td></tr>';
      console.error(error);
    }
  }

  // Load Data for Dashboard Home
  async function loadHomeData() {
    try {
      // 1. Fetch Products for Stock Count
      const products = await fetchProducts();
      const kpiProducts = document.getElementById('kpi-products');
      if (kpiProducts) kpiProducts.textContent = products.length;

      // 2. Fetch Financial Summary from Sales Service
      const summary = await getFinancialSummary();

      const incomeEl = document.getElementById('kpi-total-income');
      const expensesEl = document.getElementById('kpi-total-expenses');
      const profitEl = document.getElementById('kpi-net-profit');

      if (incomeEl) incomeEl.textContent = '$' + summary.totalRevenue.toFixed(2);
      if (expensesEl) expensesEl.textContent = '$' + summary.totalExpenses.toFixed(2);
      if (profitEl) profitEl.textContent = '$' + summary.netProfit.toFixed(2);

    } catch (e) {
      console.error('Error loading Home Data', e);
    }
  }

  // Load Reports / Audit Table
  async function loadReportsTable() {
    const reportsTbody = document.getElementById('reports-tbody');
    if (!reportsTbody) return;

    try {
      const transactions = await fetchTransactions();
      reportsTbody.innerHTML = '';

      if (transactions.length === 0) {
        reportsTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No hay transacciones registradas.</td></tr>';
        return;
      }

      transactions.forEach(t => {
        const tr = document.createElement('tr');
        const badgeClass = t.type === 'ingreso' ? 'badge-success' : 'badge-danger';
        const dateStr = new Date(t.date).toLocaleDateString();

        tr.innerHTML = `
          <td><small>${t.id.substring(0, 8)}</small></td>
          <td><span class="badge ${badgeClass}">${t.type}</span></td>
          <td>
            <div style="font-weight: 600;">${t.concept}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">${t.payment_method || 'N/A'}</div>
          </td>
          <td style="font-weight: 700;">
            ${t.currency === 'USD' ? '$' : 'Bs.'}${t.amount.toFixed(2)}
            ${t.amount_bs ? `<br><small style="color:var(--text-muted); font-weight:normal;">(Bs. ${t.amount_bs.toFixed(2)})</small>` : ''}
          </td>
          <td>${dateStr}</td>
        `;
        reportsTbody.appendChild(tr);
      });

      // Update Report KPIs as well
      const summary = await getFinancialSummary();
      const reportRev = document.getElementById('report-total-revenue');
      const reportProfit = document.getElementById('report-net-profit');
      if (reportRev) reportRev.textContent = '$' + summary.totalRevenue.toFixed(2);
      if (reportProfit) reportProfit.textContent = '$' + summary.netProfit.toFixed(2);

    } catch (error) {
      reportsTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--danger);">Error cargando transacciones.</td></tr>';
      console.error(error);
    }
  }

  // PDF Generation
  function generateReceiptPDF(order) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Clean, minimalist PDF style
    doc.setFontSize(22);
    doc.text("D'LUX BOUTIQUE", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`ORDEN #${order.order_number}`, 105, 28, { align: "center" });

    doc.setFontSize(12);
    doc.text("DETALLES DEL CLIENTE", 14, 45);
    doc.line(14, 47, 196, 47);

    doc.setFontSize(10);
    doc.text(`Cliente: ${order.customer_name}`, 14, 55);
    doc.text(`Documento: ${order.customer_doc}`, 14, 61);
    doc.text(`Fecha: ${new Date(order.created_at).toLocaleDateString()}`, 14, 67);

    const tableColumn = ["Artículo", "Cant", "Precio", "Subtotal"];
    const tableRows = [];

    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        tableRows.push([item.n, item.q, `$${item.p.toFixed(2)}`, `$${(item.q * item.p).toFixed(2)}`]);
      });
    }

    doc.autoTable({
      startY: 75,
      head: [tableColumn],
      body: tableRows,
      theme: 'plain',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: $${Number(order.total).toFixed(2)}`, 196, finalY, { align: "right" });

    doc.save(`Pedido_${order.order_number}.pdf`);
  }

  // Create/Update Product Form Submission
  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (productError) productError.textContent = '';

      const id = document.getElementById('prod-id').value;
      if (saveProductBtn) {
        saveProductBtn.textContent = 'Procesando...';
        saveProductBtn.disabled = true;
      }

      try {
        const name = document.getElementById('prod-name').value;
        const price = parseFloat(document.getElementById('prod-price').value);
        const stock = parseInt(document.getElementById('prod-stock').value, 10);
        const description = document.getElementById('prod-desc').value;
        const status = document.getElementById('prod-status').value;
        const fileInput = document.getElementById('prod-image');

        let images = [];

        if (fileInput.files.length > 0) {
          if (saveProductBtn) saveProductBtn.textContent = 'Subiendo Imágenes...';
          const files = Array.from(fileInput.files).slice(0, 5);
          for (const file of files) {
            const url = await uploadImageToCloudinary(file);
            images.push(url);
          }
        }

        const productData = {
          name,
          price,
          stock,
          description,
          status
        };

        if (images.length > 0) {
          productData.images = images;
        }

        if (id) {
          if (saveProductBtn) saveProductBtn.textContent = 'Actualizando...';
          await updateProduct(id, productData);
        } else {
          if (saveProductBtn) saveProductBtn.textContent = 'Creando...';
          await createProduct(productData);
        }

        if (productModal) productModal.style.display = 'none';
        productForm.reset();
        loadProductsTable();

      } catch (error) {
        console.error(error);
        if (productError) productError.textContent = 'Error: ' + error.message;
      } finally {
        if (saveProductBtn) {
          saveProductBtn.textContent = 'Guardar Cambios';
          saveProductBtn.disabled = false;
        }
      }
    });
  }

  // Delete Product Handler
  const deleteProdBtn = document.getElementById('delete-product-btn');
  if (deleteProdBtn) {
    deleteProdBtn.addEventListener('click', async () => {
      const id = document.getElementById('prod-id').value;
      if (!id) return;

      if (confirm('¿Realmente desea eliminar este producto de forma permanente?')) {
        try {
          await deleteProduct(id);
          if (productModal) productModal.style.display = 'none';
          loadProductsTable();
        } catch (error) {
          if (productError) productError.textContent = 'Error al eliminar: ' + error.message;
        }
      }
    });
  }

  // --- Sales Flow ---
  let allProductsCache = [];

  if (btnNewOrder) {
    btnNewOrder.addEventListener('click', async () => {
      salesModal.style.display = 'flex';
      allProductsCache = await fetchProducts();
      resetSalesForm();
    });
  }

  if (closeSalesModalBtn) {
    closeSalesModalBtn.addEventListener('click', () => {
      salesModal.style.display = 'none';
    });
  }

  if (btnAddItem) {
    btnAddItem.addEventListener('click', () => addSaleRow());
  }

  function resetSalesForm() {
    saleItemsContainer.innerHTML = '<label>Productos</label>';
    addSaleRow();
    if (salesForm) salesForm.reset();
    updateSaleTotal();
  }

  function addSaleRow() {
    const row = document.createElement('div');
    row.className = 'sale-item-row';
    row.style.display = 'flex';
    row.style.gap = '0.5rem';
    row.style.marginBottom = '0.5rem';

    let options = '<option value="">Seleccionar producto...</option>';
    allProductsCache.forEach(p => {
      options += `<option value="${p.id}" data-price="${p.price}">${p.name} ($${p.price})</option>`;
    });

    row.innerHTML = `
      <select class="sale-product-select" style="flex: 2;" required>${options}</select>
      <input type="number" class="sale-quantity" placeholder="Cant" min="1" value="1" style="flex: 1;" required>
      <button type="button" class="btn btn-outline btn-danger btn-small remove-item" style="width: auto;">&times;</button>
    `;

    saleItemsContainer.appendChild(row);

    row.querySelector('.remove-item').addEventListener('click', () => {
      if (saleItemsContainer.querySelectorAll('.sale-item-row').length > 1) {
        row.remove();
        updateSaleTotal();
      }
    });

    row.querySelector('.sale-product-select').addEventListener('change', updateSaleTotal);
    row.querySelector('.sale-quantity').addEventListener('input', updateSaleTotal);
  }

  function updateSaleTotal() {
    let total = 0;
    document.querySelectorAll('.sale-item-row').forEach(row => {
      const select = row.querySelector('.sale-product-select');
      const qty = row.querySelector('.sale-quantity').value;
      const price = select.options[select.selectedIndex]?.getAttribute('data-price') || 0;
      total += price * qty;
    });
    if (saleTotalDisplay) saleTotalDisplay.innerText = `Total: $${total.toFixed(2)}`;

    // Update BS Total
    const rateEl = document.getElementById('sale-rate');
    const currencyEl = document.getElementById('sale-currency');
    const bsDisplayEl = document.getElementById('sale-total-bs-display');

    if (rateEl && bsDisplayEl && currencyEl) {
      const rate = parseFloat(rateEl.value) || 0;
      const isBS = currencyEl.value === 'BS';

      if (isBS) {
        bsDisplayEl.innerText = `(USD $${(total / (rate || 1)).toFixed(2)})`;
        if (saleTotalDisplay) saleTotalDisplay.innerText = `Total: Bs. ${total.toFixed(2)}`;
      } else {
        bsDisplayEl.innerText = `(Bs. ${(total * rate).toFixed(2)})`;
      }
    }
  }

  // Add listeners for currency and rate
  document.getElementById('sale-currency')?.addEventListener('change', updateSaleTotal);
  document.getElementById('sale-rate')?.addEventListener('input', updateSaleTotal);

  if (salesForm) {
    salesForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      salesError.innerText = '';
      const saveBtn = document.getElementById('save-sale-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Procesando...';
      }

      const items = [];
      document.querySelectorAll('.sale-item-row').forEach(row => {
        const productId = row.querySelector('.sale-product-select').value;
        const quantity = parseInt(row.querySelector('.sale-quantity').value);
        if (productId) items.push({ productId, quantity });
      });

      const { data: { user } } = await supabase.auth.getUser();
      const saleData = {
        customer: document.getElementById('sale-customer').value,
        notes: document.getElementById('sale-notes').value,
        currency: document.getElementById('sale-currency').value,
        exchangeRate: parseFloat(document.getElementById('sale-rate').value) || 1.0,
        paymentMethod: document.getElementById('sale-payment-method').value,
        items,
        userId: user.id
      };

      const result = await registerSale(saleData);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Procesar Venta';
      }

      if (result.success) {
        salesModal.style.display = 'none';
        loadOrdersTable();
        loadHomeData(); // Refresh KPIs
      } else {
        salesError.innerText = result.error;
      }
    });
  }

  // --- Expense Flow ---
  if (btnNewExpense) {
    btnNewExpense.addEventListener('click', () => {
      expenseModal.style.display = 'flex';
    });
  }

  if (closeExpenseModalBtn) {
    closeExpenseModalBtn.addEventListener('click', () => {
      expenseModal.style.display = 'none';
      if (expenseForm) expenseForm.reset();
    });
  }

  if (expenseForm) {
    expenseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      expenseError.innerText = '';
      const saveBtn = document.getElementById('save-expense-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Guardando...';
      }

      const { data: { user } } = await supabase.auth.getUser();
      const expenseData = {
        concept: document.getElementById('exp-concept').value,
        category: document.getElementById('exp-category').value,
        amount: document.getElementById('exp-amount').value,
        paymentMethod: document.getElementById('exp-payment-method').value,
        userId: user.id
      };

      const result = await registerExpense(expenseData);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Guardar Gasto';
      }

      if (result.success) {
        expenseModal.style.display = 'none';
        expenseForm.reset();
        loadReportsTable();
        loadHomeData();
      } else {
        expenseError.innerText = result.error;
      }
    });
  }

  // --- Initialize ---
  checkSession();
  loadHomeData();
});
