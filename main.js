console.log("V4 LOADED - SYSTEM ACTIVE");
window.v4 = true;
// alert("VITE HMR: V4 RELOADED");
import './style.css'
import { supabase, getUserProfile } from './src/supabase.js'
import { fetchProducts, createProduct, updateProduct, deleteProduct, uploadImageToCloudinary } from './src/inventory.js'
import { fetchOrders, updateOrderStatus, deleteOrder } from './src/orders.js'
import { registerSale, registerExpense, fetchTransactions, getFinancialSummary, registerPayment, registerPayroll, registerInventoryExit } from './src/sales.js'

// Inicializar en DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Elementos de la Interfaz
  const loginContainer = document.getElementById('login-container')
  const dashboardContainer = document.getElementById('dashboard-container')
  const loginForm = document.getElementById('login-form')
  const logoutBtn = document.getElementById('logout-btn')
  const loginError = document.getElementById('login-error')
  const appContainer = document.getElementById('app')
  const navLinks = document.querySelectorAll('.sidebar a')
  const pageTitle = document.getElementById('page-title')
  const productsTbody = document.getElementById('products-tbody')
  const ordersTbody = document.getElementById('orders-tbody')

  // --- Mobile Sidebar Toggle ---
  const mobileMenuBtn = document.getElementById('mobile-menu-btn') || document.querySelector('.mobile-menu-btn')
  const mobileOverlay = document.getElementById('mobile-overlay')
  const sidebar = document.querySelector('.sidebar')

  function toggleMobileMenu() {
    if (!sidebar) return
    sidebar.classList.toggle('sidebar-open')
    if (mobileOverlay) mobileOverlay.classList.toggle('active')

    // Lock Body Scroll when menu is open
    if (sidebar.classList.contains('sidebar-open')) {
      document.body.classList.add('lock-scroll')
      document.documentElement.classList.add('lock-scroll')
    } else {
      document.body.classList.remove('lock-scroll')
      document.documentElement.classList.remove('lock-scroll')
    }
  }

  if (mobileMenuBtn) mobileMenuBtn.onclick = toggleMobileMenu
  if (mobileOverlay) mobileOverlay.onclick = toggleMobileMenu

  // Modales
  const productModal = document.getElementById('product-modal')
  const btnNewProduct = document.getElementById('btn-new-product')
  const closeModalBtn = document.getElementById('close-modal')
  const productForm = document.getElementById('product-form')
  const productError = document.getElementById('product-error')
  const saveProductBtn = document.getElementById('save-product-btn')

  const salesModal = document.getElementById('sales-modal')
  const btnNewOrder = document.getElementById('btn-new-order')
  const closeSalesModalBtn = document.getElementById('close-sales-modal')
  const salesForm = document.getElementById('sales-form')

  const expenseModal = document.getElementById('expense-modal')
  const btnNewExpense = document.getElementById('btn-new-expense')
  const closeExpenseModalBtn = document.getElementById('close-expense-modal')
  const expenseForm = document.getElementById('expense-form')

  const payrollModal = document.getElementById('payroll-modal')
  const btnAddPayroll = document.getElementById('btn-add-payroll')
  const closePayrollModalBtn = document.getElementById('close-payroll-modal')
  const payrollForm = document.getElementById('payroll-form')
  const payrollError = document.getElementById('payroll-error')
  const btnAddItem = document.getElementById('btn-add-item')
  const salesItemsContainer = document.getElementById('sale-items-container')
  const salesError = document.getElementById('sales-error')

  // Abono Modal
  const abonoModal = document.getElementById('abono-modal')
  const closeAbonoModalBtn = document.getElementById('close-abono-modal')
  const abonoForm = document.getElementById('abono-form')
  const abonoError = document.getElementById('abono-error')
  // Estado Global
  let currentUserRole = 'vendedor'
  let inventoryEditEnabled = false
  let allProducts = [] // Cache para filtros rápidos
  let knownCustomers = [] // Cache de clientes para autocompletado

  // --- Dual Currency & Mobile State ---
  window.currentExchangeRate = 1.0;

  function formatCurrency(amountUSD, paymentMethod = null) {
    const rate = window.currentExchangeRate || 1.0;
    const isBs = ['Bs', 'Pago Movil', 'Transferencia Bs', 'Efectivo Bs'].includes(paymentMethod);
    const amountBs = (amountUSD * rate).toFixed(2);
    const amountUSDFmt = parseFloat(amountUSD).toFixed(2);

    if (isBs) {
      return `Bs. ${amountBs} <small style="color:var(--text-muted)">($${amountUSDFmt})</small>`;
    } else {
      // For USD or general reference, show both if rate > 1
      if (rate > 1) {
        return `$${amountUSDFmt} <span style="font-size:0.8em; color:var(--text-muted); display:block;">(Ref: Bs. ${amountBs})</span>`;
      }
      return `$${amountUSDFmt}`;
    }
  }

  // --- Inicialización y Sesión ---
  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const profile = await getUserProfile(session.user.id)
      currentUserRole = profile?.role || 'vendedor'
      allProducts = await fetchProducts() // Cargar cache inicial
      await syncExchangeRate() // Carga inicial de la tasa
      showDashboard(session.user)
      applyPermissions(currentUserRole)
      setTimeout(loadHomeData, 100) // Give it a moment for layout to settle
    } else {
      showLogin()
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const profile = await getUserProfile(session.user.id)
        currentUserRole = profile?.role || 'vendedor'
        showDashboard(session.user)
        applyPermissions(currentUserRole)
      } else {
        showLogin()
      }
    })
  }

  function applyPermissions(role) {
    const adminElements = document.querySelectorAll('.admin-only')
    adminElements.forEach(el => {
      if (!el.classList.contains('view-section')) {
        el.style.display = (role === 'admin') ? '' : 'none'
      }
    })
    updateInventoryUIState()
  }


  function updateInventoryUIState() {
    const canEdit = (currentUserRole === 'admin' || inventoryEditEnabled)
    if (btnNewProduct) btnNewProduct.style.display = canEdit ? 'block' : 'none'
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.style.display = canEdit ? 'block' : 'none'
    })
  }

  function showDashboard(user) {
    if (loginContainer) loginContainer.classList.add('hidden')
    if (dashboardContainer) {
      dashboardContainer.style.display = 'flex'
      dashboardContainer.classList.remove('hidden')
    }
    if (appContainer) {
      appContainer.style.alignItems = 'flex-start'
      appContainer.style.justifyContent = 'flex-start'
    }
    const userProfile = document.querySelector('.user-profile')
    if (userProfile && user.email) userProfile.textContent = user.email
  }

  function showLogin() {
    if (dashboardContainer) dashboardContainer.classList.add('hidden')
    if (loginContainer) loginContainer.classList.remove('hidden')
    if (appContainer) {
      appContainer.style.alignItems = 'center'
      appContainer.style.justifyContent = 'center'
    }
  }

  // --- Manejadores de Eventos ---
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('email').value
      const password = document.getElementById('password').value
      const rememberMe = document.getElementById('remember-me')?.checked
      const btn = loginForm.querySelector('button')
      const originalText = btn.textContent
      btn.textContent = 'Iniciando sesión...'
      btn.disabled = true
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          loginError.textContent = error.message
        } else {
          // Persistence logic
          if (rememberMe) {
            localStorage.setItem('dlux_remembered_email', email)
          } else {
            localStorage.removeItem('dlux_remembered_email')
          }
        }
      } catch (err) {
        loginError.textContent = 'Error de conexión'
      } finally {
        btn.textContent = originalText
        btn.disabled = false
      }
    })
  }

  // Auto-fill remembered email
  const rememberedEmail = localStorage.getItem('dlux_remembered_email')
  if (rememberedEmail) {
    const emailField = document.getElementById('email')
    if (emailField) emailField.value = rememberedEmail
    const rememberCheckbox = document.getElementById('remember-me')
    if (rememberCheckbox) rememberCheckbox.checked = true
  }

  // --- Utilidades de UI (Custom Modals & Toasts) ---
  const customModal = document.getElementById('custom-modal')
  const customModalTitle = document.getElementById('custom-modal-title')
  const customModalBody = document.getElementById('custom-modal-body')
  const customModalFooter = document.getElementById('custom-modal-footer')
  const customModalClose = document.getElementById('custom-modal-close')
  const toastContainer = document.getElementById('toast-container')

  function sanitizeFilename(name) {
    return name.replace(/[:\\/<>*|?]/g, '-').replace(/\s+/g, '_');
  }

  // Descarga robusta usando Blob y etiqueta Ancla para evitar UUIDs en Chrome
  function forceDownloadPDF(doc, filename) {
    const rawFilename = sanitizeFilename(filename);
    try {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = rawFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      console.warn("Blob saving failed, falling back to doc.save()", e);
      doc.save(rawFilename); // Fallback en caso de que el entorno no soporte Blobs
    }
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    toast.innerHTML = `<span>${message}</span>`
    toastContainer.appendChild(toast)
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.5s ease forwards'
      setTimeout(() => toast.remove(), 500)
    }, 3000)
  }

  function showCustomModal(title, content) {
    customModalTitle.textContent = title
    customModalBody.innerHTML = content
    customModalFooter.innerHTML = '<button id="modal-ok" class="btn btn-primary" style="width: auto;">Entendido</button>'
    customModal.classList.add('custom-modal-active')
    const okBtn = document.getElementById('modal-ok')
    if (okBtn) okBtn.onclick = () => customModal.classList.remove('custom-modal-active')
  }

  function showCustomConfirm(title, message, onConfirm) {
    customModalTitle.textContent = title
    customModalBody.textContent = message
    customModalFooter.innerHTML = `
      <button id="confirm-cancel" class="btn btn-outline" style="width: auto;">Cancelar</button>
      <button id="confirm-yes" class="btn btn-danger" style="width: auto;">Eliminar</button>
    `
    customModal.classList.add('custom-modal-active')
    document.getElementById('confirm-cancel').onclick = () => customModal.classList.remove('custom-modal-active')
    document.getElementById('confirm-yes').onclick = () => {
      customModal.classList.remove('custom-modal-active')
      onConfirm()
    }
  }

  if (customModalClose) customModalClose.onclick = () => customModal.classList.remove('custom-modal-active')

  if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut())

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      navLinks.forEach(l => l.classList.remove('active'))
      link.classList.add('active')
      const target = link.getAttribute('data-target')
      document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none')
      const targetView = document.getElementById(`view-${target}`)
      if (targetView) targetView.style.display = 'block'

      // Close mobile sidebar if open
      const sidebar = document.querySelector('.sidebar')
      const pOverlay = document.getElementById('mobile-overlay')
      if (sidebar) sidebar.classList.remove('sidebar-open')
      if (pOverlay) pOverlay.classList.remove('active')

      if (pageTitle) {
        const titles = {
          home: 'Dashboard',
          inventory: 'Inventario',
          orders: 'Ventas / Pedidos',
          reports: 'Reportes Contables',
          users: 'Usuarios',
          credits: 'Créditos y Apartados',
          payroll: 'Nómina y Servicios',
          audit: 'Auditoría de Movimientos'
        }
        pageTitle.textContent = titles[target] || 'Dashboard'
      }

      if (target === 'home') setTimeout(loadHomeData, 50)
      if (target === 'inventory') loadProductsTable()
      if (target === 'orders') loadOrdersTable()
      if (target === 'reports') loadReportsTable()
      if (target === 'credits') loadCreditsTable()
      if (target === 'payroll') loadPayrollTable()
      if (target === 'users') loadUsersTable()
      if (target === 'audit') loadAuditTable()
    })
  })

  // --- Lógica de Inventario ---
  async function loadProductsTable() {
    if (!productsTbody) return
    productsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Cargando inventario...</td></tr>'
    try {
      allProducts = await fetchProducts()
      populateCategories(allProducts)
      renderProducts(allProducts)
    } catch (error) {
      productsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Error al cargar productos.</td></tr>'
    }
  }

  function populateCategories(products) {
    const filter = document.getElementById('inventory-category-filter')
    if (!filter || filter.options.length > 1) return
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))]
    categories.forEach(cat => {
      const opt = document.createElement('option')
      opt.value = cat
      opt.textContent = cat
      filter.appendChild(opt)
    })
  }

  function renderProducts(products) {
    const searchTerm = document.getElementById('inventory-search')?.value.toLowerCase() || ''
    const categoryFilter = document.getElementById('inventory-category-filter')?.value || 'all'
    const genderFilter = document.getElementById('inventory-gender-filter')?.value || 'all'

    const filtered = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm) || (p.sku && p.sku.toLowerCase().includes(searchTerm))
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
      const matchesGender = genderFilter === 'all' || p.gender === genderFilter
      return matchesSearch && matchesCategory && matchesGender
    })

    const kpiProducts = document.getElementById('kpi-products')
    if (kpiProducts) kpiProducts.textContent = filtered.length

    if (filtered.length === 0) {
      productsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No se encontraron productos.</td></tr>'
      return
    }

    productsTbody.innerHTML = ''
    filtered.forEach(p => {
      const tr = document.createElement('tr')
      let mainImg = 'https://placehold.co/60x60?text=DLUX'
      if (p.images && p.images.length > 0) mainImg = p.images[0]
      else if (p.image_url) mainImg = p.image_url

      const stockClass = p.stock <= 0 ? 'badge-danger' : (p.stock <= 5 ? 'badge-warning' : 'badge-success')
      const stockText = p.stock <= 0 ? 'Agotado' : (p.stock <= 5 ? 'Bajo Stock' : 'Disponible')

      const utility = (p.price - (p.cost_price || 0)).toFixed(2)

      tr.innerHTML = `
        <td><img src="${mainImg}" class="product-img-thumb" onerror="this.src='https://placehold.co/60x60?text=Error'"></td>
        <td>
          <div style="font-weight:700">${p.name}</div>
          <div style="font-size:0.7rem; color:var(--text-muted)">SKU: ${p.sku || 'N/A'} | ${p.brand || 'Marca n/a'}</div>
          <div style="font-size:0.7rem; color:var(--text-muted)">${p.color || ''} ${p.size ? '| Talla: ' + p.size : ''}</div>
        </td>
        <td>
          <div style="font-weight:600">$${p.price.toFixed(2)}</div>
          <div style="font-size:0.7rem; color:var(--success)">Utilidad: $${utility}</div>
          <div style="font-size:0.6rem; color:var(--text-muted)">Costo: $${(p.cost_price || 0).toFixed(2)}</div>
        </td>
        <td>${p.stock}</td>
        <td><span class="badge ${stockClass}">${stockText}</span></td>
        <td>
          <button class="btn btn-outline btn-small edit-btn" data-id="${p.id}">Editar</button>
        </td>
      `
      productsTbody.appendChild(tr)
    })

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id')
        const product = allProducts.find(prod => String(prod.id) === String(id))
        if (product) openEditModal(product)
      })
    })
    updateInventoryUIState()
  }

  // --- Filtros de Inventario ---
  document.getElementById('inventory-search')?.addEventListener('input', () => renderProducts(allProducts))
  document.getElementById('inventory-category-filter')?.addEventListener('change', () => renderProducts(allProducts))
  document.getElementById('inventory-gender-filter')?.addEventListener('change', () => renderProducts(allProducts))

  // --- Lógica de Pedidos ---
  async function loadOrdersTable() {
    if (!ordersTbody) return
    ordersTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Cargando pedidos...</td></tr>'
    try {
      const orders = await fetchOrders()

      // Actualizar caché de clientes para autocompletado
      knownCustomers = []
      orders.forEach(o => {
        if (o.customer_name && !knownCustomers.some(c => c.name.toLowerCase() === o.customer_name.toLowerCase())) {
          knownCustomers.push({ name: o.customer_name, doc: o.customer_doc, phone: o.customer_phone })
        }
      })
      const datalist = document.getElementById('customer-suggestions')
      if (datalist) {
        datalist.innerHTML = knownCustomers.map(c => `<option value="${c.name}"></option>`).join('')
      }

      ordersTbody.innerHTML = orders.length ? '' : '<tr><td colspan="6" style="text-align: center;">No hay pedidos registrados.</td></tr>'
      orders.forEach(o => {
        const tr = document.createElement('tr')
        tr.innerHTML = `
          <td><small>${new Date(o.created_at).toLocaleString()}</small></td>
          <td>${o.customer_name}</td>
          <td>${o.items?.length || 0} items</td>
          <td>${formatCurrency(o.total_amount)}</td>
          <td><span class="badge ${o.status === 'paid' ? 'badge-success' : 'badge-warning'}">${o.status.toUpperCase()}</span></td>
          <td>
            <button class="btn btn-outline btn-small view-order" data-id="${o.id}">Ver</button>
            <button class="btn btn-outline btn-danger btn-small delete-order" data-id="${o.id}">Eliminar</button>
          </td>
        `
        ordersTbody.appendChild(tr)
      })
    } catch (e) {
      console.error(e)
    }
  }

  // === UNIFIED EVENT DELEGATION ===
  console.log("DEBUG: Event delegator initialized on body");
  document.body.addEventListener('click', async (e) => {
    const target = e.target;
    console.log("DEBUG: Click detected on:", target.tagName, "Class:", target.className, "ID:", target.id);

    // ----- Botón ELIMINAR Pedido -----
    const btnDelete = target.closest('.delete-order')
    if (btnDelete) {
      showCustomConfirm(
        'Confirmar Eliminación',
        '¿Estás seguro de que deseas eliminar este pedido permanentemente? Esta acción no se puede deshacer.',
        async () => {
          const id = btnDelete.getAttribute('data-id')
          btnDelete.disabled = true
          btnDelete.textContent = '...'

          try {
            const { error } = await supabase.from('orders').delete().eq('id', id)
            if (error) throw error
            await loadOrdersTable()
            showToast('Pedido eliminado correctamente', 'success')
          } catch (err) {
            console.error('Error al eliminar:', err)
            showToast(`Error: ${err.message}`, 'error')
          } finally {
            if (btnDelete && document.body.contains(btnDelete)) {
              btnDelete.disabled = false
              btnDelete.textContent = 'Eliminar'
            }
          }
        }
      )
      return
    }

    // ----- Botón VER Pedido -----
    const btnView = target.closest('.view-order')
    if (btnView) {
      const id = btnView.getAttribute('data-id')
      console.log("DEBUG: Processing .view-order click. Fetching ID:", id);
      try {
        console.log("DEBUG: Calling Supabase table 'orders'...");
        const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).single()

        if (error) {
          console.error("DEBUG: Supabase error observed:", error);
          throw error
        }

        console.log("DEBUG: Data received successfully:", order);
        const items = order.items || []
        const itemLines = items.map(i => `<li><strong>${i.name}</strong> x${i.quantity} - $${(i.total || 0).toFixed(2)}</li>`).join('')

        const content = `
          <div style="border-left: 4px solid #000; padding-left: 1rem; margin-bottom: 1.5rem;">
            <p><strong>Cliente:</strong> ${order.customer_name || 'N/A'}</p>
            <p><strong>Cédula:</strong> ${order.customer_doc || 'N/A'}</p>
            <p><strong>Teléfono:</strong> ${order.customer_phone || 'N/A'}</p>
            <p><strong>Fecha:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            <p><strong>Estado:</strong> <span class="badge ${order.status === 'paid' ? 'badge-success' : 'badge-warning'}">${order.status?.toUpperCase()}</span></p>
          </div>
          <p><strong>Artículos:</strong></p>
          <ul style="margin-top: 0.5rem; margin-bottom: 1.5rem; padding-left: 1.2rem;">${itemLines}</ul>
          <div style="text-align: right; border-top: 1px solid #EEE; padding-top: 1rem;">
            <p style="font-size: 1.2rem; font-weight: 800;">TOTAL: $${(order.total_amount || order.total || 0).toFixed(2)}</p>
            ${order.notes ? `<p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;"><em>${order.notes}</em></p>` : ''}
          </div>
        `;
        console.log("DEBUG: Finalizing modal content. Opening modal...");
        showCustomModal('Detalle de Venta', content)
      } catch (err) {
        console.error("DEBUG: Error block in btnView reached:", err);
        showToast('Error al cargar detalle: ' + err.message, 'error')
      }
      return
    }

    // ---- Eliminar Registro Auditoría ----
    const btnDeleteTrans = target.closest('.delete-trans')
    if (btnDeleteTrans) {
      showCustomConfirm(
        'Eliminar Registro',
        '¿Eliminar este registro financiero permanentemente?\nNota: Esto NO revierte el stock ni las ventas relacionadas.',
        async () => {
          const transId = btnDeleteTrans.getAttribute('data-id')
          if (btnDeleteTrans && document.body.contains(btnDeleteTrans)) btnDeleteTrans.disabled = true
          try {
            const { error } = await supabase.from('transactions').delete().eq('id', transId)
            if (error) throw error
            await loadAuditTable()
            showToast('Registro eliminado', 'success')
          } catch (err) {
            console.error('Error:', err)
            showToast(err.message, 'error')
          } finally {
            if (btnDeleteTrans && document.body.contains(btnDeleteTrans)) btnDeleteTrans.disabled = false
          }
        }
      )
      return
    }

    // ---- Editar Registro Auditoría ----
    const btnEditTrans = target.closest('.edit-trans')
    if (btnEditTrans) {
      const transId = btnEditTrans.getAttribute('data-id')
      try {
        const { data: trans, error } = await supabase.from('transactions').select('*').eq('id', transId).single()
        if (error) throw error

        document.getElementById('edit-trans-id').value = trans.id
        document.getElementById('edit-trans-concept').value = trans.concept
        document.getElementById('edit-trans-amount').value = trans.amount
        document.getElementById('edit-trans-method').value = trans.payment_method || 'Bs'

        document.getElementById('edit-trans-modal').style.display = 'flex'
      } catch (err) {
        showToast('Error al cargar datos del movimiento', 'error')
      }
      return
    }

    // ---- Exportar PDF de Auditoría ----
    const btnExportAuditPdf = target.closest('#btn-export-audit-pdf')
    if (btnExportAuditPdf) {
      const { jsPDF } = window.jspdf;
      if (!jsPDF) {
        showToast("Error: Librería PDF no cargada", "error");
        return;
      }
      showToast("Generando PDF...", "info");
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text("D'Lux Admin - Auditoría de Movimientos", 14, 20);
      doc.setFontSize(11);
      doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);

      const rows = [];
      document.querySelectorAll('#audit-tbody tr').forEach(tr => {
        const cols = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        if (cols.length > 0 && cols[0] !== "Cargando auditoría...") {
          rows.push(cols.slice(0, -1));
        }
      });

      if (rows.length === 0) {
        showToast("No hay datos para exportar", "warning");
        return;
      }

      doc.autoTable({
        startY: 35,
        head: [['Fecha', 'Tipo', 'Concepto', 'Justificación', 'Monto']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [0, 0, 0] }
      });

      forceDownloadPDF(doc, `Auditoria_Dlux_${Date.now()}.pdf`);
      showToast("PDF Descargado", "success");
      return
    }
  })


  // --- Lógica del Modal de Ventas ---
  if (btnNewOrder) btnNewOrder.addEventListener('click', () => {
    salesForm.reset()
    if (salesItemsContainer) {
      salesItemsContainer.innerHTML = '<label>Productos</label>' // Reset
      addSalesItemRow() // Add first row
    }
    salesModal.style.display = 'flex'
  })

  if (closeSalesModalBtn) closeSalesModalBtn.addEventListener('click', () => salesModal.style.display = 'none')

  if (btnAddItem) btnAddItem.addEventListener('click', addSalesItemRow)

  function addSalesItemRow() {
    const row = document.createElement('div')
    row.className = 'sale-item-row'
    row.style.display = 'flex'
    row.style.gap = '0.5rem'
    row.style.marginBottom = '0.5rem'

    let options = '<option value="">Seleccionar producto...</option>'
    allProducts.forEach(p => {
      options += `<option value="${p.id}" data-price="${p.price}">${p.name} ($${p.price})</option>`
    })

    row.innerHTML = `
      <select class="sale-product-select" style="flex: 2;" required>${options}</select>
      <input type="number" class="sale-quantity" placeholder="Cant" min="1" value="1" style="flex: 1;" required>
      <button type="button" class="btn btn-outline btn-danger btn-small remove-item" style="width: auto;">&times;</button>
    `
    salesItemsContainer.appendChild(row)

    row.querySelector('.remove-item').addEventListener('click', () => row.remove())
    row.querySelector('.sale-product-select').addEventListener('change', updateSalesTotal)
    row.querySelector('.sale-quantity').addEventListener('input', updateSalesTotal)
  }

  function updateSalesTotal() {
    let total = 0
    document.querySelectorAll('.sale-item-row').forEach(row => {
      const select = row.querySelector('.sale-product-select')
      const qty = row.querySelector('.sale-quantity').value
      const price = select.options[select.selectedIndex]?.getAttribute('data-price') || 0
      total += price * qty
    })
    document.getElementById('sale-total-display').textContent = `Total: $${total.toFixed(2)}`
    const rate = document.getElementById('sale-rate').value || 36
    document.getElementById('sale-total-bs-display').textContent = `(Bs. ${(total * rate).toFixed(2)})`
  }

  const saleCustomerInput = document.getElementById('sale-customer')
  if (saleCustomerInput) {
    saleCustomerInput.addEventListener('input', (e) => {
      const val = e.target.value.toLowerCase()
      const match = knownCustomers.find(c => c.name.toLowerCase() === val)
      if (match) {
        document.getElementById('sale-customer-doc').value = match.doc || ''
        document.getElementById('sale-customer-phone').value = match.phone || ''
      }
    })
  }

  if (salesForm) {
    salesForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = e.target.querySelector('button[type="submit"]')
      btn.disabled = true
      salesError.textContent = ''

      try {
        const items = []
        document.querySelectorAll('.sale-item-row').forEach(row => {
          items.push({
            productId: row.querySelector('.sale-product-select').value,
            quantity: parseInt(row.querySelector('.sale-quantity').value)
          })
        })

        const { data: { user } } = await supabase.auth.getUser()
        const saleData = {
          customer: document.getElementById('sale-customer').value,
          customerDoc: document.getElementById('sale-customer-doc').value,
          customerPhone: document.getElementById('sale-customer-phone').value,
          items,
          notes: document.getElementById('sale-notes').value,
          userId: user.id,
          currency: document.getElementById('sale-currency').value,
          exchangeRate: parseFloat(document.getElementById('sale-rate').value),
          paymentMethod: document.getElementById('sale-payment-method').value,
          paymentStatus: document.getElementById('sale-status').value,
          dueDate: document.getElementById('sale-due-date').value,
          installments: parseInt(document.getElementById('credit-installments')?.value || 1),
          paymentCycle: document.getElementById('credit-cycle')?.value || 'mensual'
        }

        const res = await registerSale(saleData)
        if (res.success) {
          salesModal.style.display = 'none'
          loadOrdersTable()
          loadHomeData()
        } else {
          salesError.textContent = res.error
        }
      } catch (err) {
        salesError.textContent = 'Error al procesar la venta'
      } finally {
        btn.disabled = false
      }
    })
  }

  document.getElementById('sale-status')?.addEventListener('change', (e) => {
    const status = e.target.value
    const dateContainer = document.getElementById('due-date-container')
    const creditContainer = document.getElementById('credit-options-container')
    const dateLabel = document.getElementById('sale-due-date-label')

    if (status === 'completed') {
      if (dateContainer) dateContainer.style.display = 'none'
      if (creditContainer) creditContainer.style.display = 'none'
    } else if (status === 'pending') {
      if (dateContainer) dateContainer.style.display = 'block'
      if (creditContainer) creditContainer.style.display = 'grid'
      if (dateLabel) dateLabel.textContent = 'Fecha Primer Pago'
    } else if (status === 'partial') {
      if (dateContainer) dateContainer.style.display = 'block'
      if (creditContainer) creditContainer.style.display = 'none'
      if (dateLabel) dateLabel.textContent = 'Fecha Tope (Límite)'
    }
  })

  // --- Lógica de Créditos ---
  async function loadCreditsTable() {
    const creditsTbody = document.getElementById('credits-tbody')
    if (!creditsTbody) return
    try {
      creditsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Cargando créditos...</td></tr>'
      const { data, error } = await supabase.from('credits').select('*').order('due_date', { ascending: true })
      if (error) throw error
      creditsTbody.innerHTML = data.length ? '' : '<tr><td colspan="6" style="text-align: center;">No hay créditos pendientes.</td></tr>'
      data.forEach(c => {
        const tr = document.createElement('tr')
        const statusBadge = c.status === 'overdue' ? 'badge-danger' : (c.status === 'paid' ? 'badge-success' : 'badge-warning')
        tr.innerHTML = `
          <td><strong>${c.customer_name}</strong></td>
          <td>${formatCurrency(c.total_amount)}</td>
          <td style="color: var(--danger); font-weight:700;">${formatCurrency(c.remaining_amount)}</td>
          <td>${c.due_date || 'N/A'}</td>
          <td><span class="badge ${statusBadge}">${c.status.toUpperCase()}</span></td>
          <td><button class="btn btn-outline btn-small abonar-btn" data-id="${c.id}">Abonar</button></td>
        `
        creditsTbody.appendChild(tr)
      })

      // Eventos para abonar
      document.querySelectorAll('.abonar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.getAttribute('data-id')
          const credit = data.find(c => c.id === id)
          if (credit) openAbonoModal(credit)
        })
      })
    } catch (e) {
      console.error(e)
    }
  }

  function openAbonoModal(credit) {
    if (abonoForm) abonoForm.reset()
    document.getElementById('abono-credit-id').value = credit.id
    document.getElementById('abono-customer-name').textContent = credit.customer_name
    document.getElementById('abono-remaining-amount').innerHTML = formatCurrency(credit.remaining_amount)
    if (abonoModal) abonoModal.style.display = 'flex'
  }

  if (closeAbonoModalBtn) closeAbonoModalBtn.addEventListener('click', () => abonoModal.style.display = 'none')

  if (abonoForm) {
    abonoForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      abonoError.textContent = ''
      const id = document.getElementById('abono-credit-id').value
      const amount = document.getElementById('abono-amount').value
      const method = document.getElementById('abono-method').value

      const { data: { user } } = await supabase.auth.getUser()
      const res = await registerPayment(id, amount, method, user.id)

      if (res.success) {
        abonoModal.style.display = 'none'
        loadCreditsTable()
      } else {
        abonoError.textContent = res.error
      }
    })
  }

  // --- Lógica Editar Movimiento (Auditoría) ---
  const editTransModal = document.getElementById('edit-trans-modal')
  const closeEditTransModalBtn = document.getElementById('close-edit-trans-modal')
  const editTransForm = document.getElementById('edit-trans-form')

  if (closeEditTransModalBtn) closeEditTransModalBtn.addEventListener('click', () => editTransModal.style.display = 'none')

  if (editTransForm) {
    editTransForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const errorDiv = document.getElementById('edit-trans-error')
      errorDiv.textContent = ''
      const btn = document.getElementById('save-edit-trans-btn')
      btn.disabled = true

      const id = document.getElementById('edit-trans-id').value
      const concept = document.getElementById('edit-trans-concept').value
      const amount = parseFloat(document.getElementById('edit-trans-amount').value)
      const method = document.getElementById('edit-trans-method').value

      try {
        const { error } = await supabase.from('transactions')
          .update({
            concept: concept,
            amount: amount,
            payment_method: method
          })
          .eq('id', id)

        if (error) throw error

        editTransModal.style.display = 'none'
        await loadAuditTable()
        if (typeof loadHomeData === 'function') loadHomeData()
        showToast('Movimiento actualizado correctamente', 'success')
      } catch (err) {
        errorDiv.textContent = 'Error al actualizar: ' + err.message
      } finally {
        btn.disabled = false
      }
    })
  }

  // --- Lógica de Nómina ---
  async function loadPayrollTable() {
    const payrollTbody = document.getElementById('payroll-tbody')
    if (!payrollTbody) return
    try {
      payrollTbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando nómina...</td></tr>'
      const { data, error } = await supabase.from('payroll').select('*').order('payment_date', { ascending: false })
      if (error) throw error
      payrollTbody.innerHTML = data.length ? '' : '<tr><td colspan="5" style="text-align: center;">No hay registros de nómina.</td></tr>'
      data.forEach(p => {
        const tr = document.createElement('tr')
        tr.innerHTML = `
          <td><strong>${p.employee_name}</strong></td>
          <td><span class="badge" style="background:#edf2f7; color:#4a5568">${p.category || 'Nómina'}</span></td>
          <td style="color:var(--danger); font-weight:600">-${formatCurrency(p.amount, p.payment_method)}</td>
          <td>${new Date(p.payment_date).toLocaleDateString()}</td>
          <td>${p.payment_method}</td>
        `
        payrollTbody.appendChild(tr)
      })
    } catch (e) {
      console.error(e)
    }
  }

  if (closePayrollModalBtn) closePayrollModalBtn.addEventListener('click', () => payrollModal.style.display = 'none')
  if (btnAddPayroll) btnAddPayroll.addEventListener('click', () => {
    payrollForm.reset()
    payrollModal.style.display = 'flex'
  })

  if (payrollForm) {
    payrollForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      payrollError.textContent = ''
      const { data: { user } } = await supabase.auth.getUser()

      const res = await registerPayroll({
        employeeName: document.getElementById('pay-employee').value,
        amount: document.getElementById('pay-amount').value,
        method: document.getElementById('pay-method').value,
        periodStart: document.getElementById('pay-start').value,
        periodEnd: document.getElementById('pay-end').value,
        notes: document.getElementById('pay-notes').value,
        userId: user.id
      })

      if (res.success) {
        payrollModal.style.display = 'none'
        loadPayrollTable()
      } else {
        payrollError.textContent = res.error
      }
    })
  }

  // --- Lógica de Gastos ---
  if (closeExpenseModalBtn) closeExpenseModalBtn.addEventListener('click', () => expenseModal.style.display = 'none')
  if (btnNewExpense) btnNewExpense.addEventListener('click', () => {
    expenseForm.reset()
    expenseModal.style.display = 'flex'
  })

  if (expenseForm) {
    expenseForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      expenseError.textContent = ''
      const { data: { user } } = await supabase.auth.getUser()

      const res = await registerExpense({
        concept: document.getElementById('exp-concept').value,
        category: document.getElementById('exp-category').value,
        amount: document.getElementById('exp-amount').value,
        paymentMethod: document.getElementById('exp-payment-method').value,
        userId: user.id
      })

      if (res.success) {
        expenseModal.style.display = 'none'
        loadReportsTable()
      } else {
        expenseError.textContent = res.error
      }
    })
  }


  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = document.getElementById('save-product-btn')
      btn.disabled = true
      productError.textContent = ''

      try {
        const id = document.getElementById('prod-id').value
        const productData = {
          name: document.getElementById('prod-name').value,
          sku: document.getElementById('prod-sku').value,
          price: parseFloat(document.getElementById('prod-price').value),
          cost_price: parseFloat(document.getElementById('prod-cost').value),
          stock: parseInt(document.getElementById('prod-stock').value),
          brand: document.getElementById('prod-brand').value,
          color: document.getElementById('prod-color').value,
          size: document.getElementById('prod-size').value,
          gender: document.getElementById('prod-gender').value,
          category: document.getElementById('prod-category').value,
          description: document.getElementById('prod-desc').value,
          status: document.getElementById('prod-status').value
        }

        const imageFiles = document.getElementById('prod-image').files
        if (imageFiles.length > 0) {
          const uploadedUrls = []
          for (const file of imageFiles) {
            const url = await uploadImageToCloudinary(file)
            uploadedUrls.push(url)
          }
          productData.images = uploadedUrls
        }

        if (id) {
          await updateProduct(id, productData)
        } else {
          await createProduct(productData)
        }

        productModal.style.display = 'none'
        loadProductsTable()
        loadHomeData()
      } catch (err) {
        productError.textContent = err.message
      } finally {
        btn.disabled = false
      }
    })
  }

  // --- Lógica de Reportes ---
  async function loadReportsTable() {
    const reportsTbody = document.getElementById('reports-tbody')
    if (!reportsTbody) return
    const startDate = document.getElementById('report-date-start')?.value
    const endDate = document.getElementById('report-date-end')?.value
    try {
      reportsTbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Cargando reporte...</td></tr>'
      let query = supabase.from('transactions').select('*').order('date', { ascending: false })
      if (startDate) query = query.gte('date', `${startDate}T00:00:00`)
      if (endDate) query = query.lte('date', `${endDate}T23:59:59`)
      const { data, error } = await query
      if (error) throw error
      reportsTbody.innerHTML = data.length ? '' : '<tr><td colspan="7" style="text-align: center;">No hay transacciones en este periodo.</td></tr>'
      data.forEach(t => {
        const tr = document.createElement('tr')
        const typeBadge = t.type === 'ingreso' ? 'badge-success' : 'badge-danger'
        tr.innerHTML = `
          <td><small>${new Date(t.date).toLocaleString()}</small></td>
          <td><span class="badge ${typeBadge}">${t.type.toUpperCase()}</span></td>
          <td><span class="badge badge-outline">${t.category}</span></td>
          <td><strong>${t.concept}</strong></td>
          <td style="font-weight:700">${formatCurrency(t.amount, t.payment_method)}</td>
          <td><span class="badge badge-outline">${t.payment_method || 'N/A'}</span></td>
          <td><span class="badge ${t.payment_status === 'pending' ? 'badge-warning' : 'badge-success'}">${(t.payment_status || 'completed').toUpperCase()}</span></td>
        `
        reportsTbody.appendChild(tr)
      })
      const summary = await getFinancialSummary()
      const reportRev = document.getElementById('report-total-revenue')
      const reportProfit = document.getElementById('report-net-profit')
      if (reportRev) reportRev.innerHTML = formatCurrency(summary.totalRevenue)
      if (reportProfit) reportProfit.innerHTML = formatCurrency(summary.netProfit)
    } catch (e) {
      console.error(e)
    }
  }

  document.getElementById('report-date-start')?.addEventListener('change', loadReportsTable)
  document.getElementById('report-date-end')?.addEventListener('change', loadReportsTable)

  // PDF Export
  document.getElementById('btn-export-pdf')?.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const startDate = document.getElementById('report-date-start')?.value || 'Inicio';
    const endDate = document.getElementById('report-date-end')?.value || 'Fin';

    doc.setFontSize(18);
    doc.text("D'Lux Admin - Reporte Contable", 14, 20);
    doc.setFontSize(11);
    doc.text(`Periodo: ${startDate} al ${endDate}`, 14, 30);

    const rows = [];
    document.querySelectorAll('#reports-tbody tr').forEach(tr => {
      const cols = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
      if (cols.length > 0) rows.push(cols);
    });

    if (rows.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    doc.autoTable({
      startY: 35,
      head: [['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Monto', 'Método', 'Estado']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [0, 0, 0] }
    });

    forceDownloadPDF(doc, `Reporte_Dlux_${startDate}_${endDate}.pdf`);
  });

  // --- Dashboard Home ---
  async function loadHomeData() {
    try {
      allProducts = await fetchProducts()
      const kpiProducts = document.getElementById('kpi-products')
      if (kpiProducts) kpiProducts.textContent = allProducts.length

      const summary = await getFinancialSummary()
      const incomeEl = document.getElementById('kpi-total-income')
      const expensesEl = document.getElementById('kpi-total-expenses')
      const profitEl = document.getElementById('kpi-net-profit')
      const breakdownEl = document.getElementById('income-breakdown')

      if (incomeEl) incomeEl.innerHTML = formatCurrency(summary.totalRevenue)
      if (expensesEl) expensesEl.innerHTML = formatCurrency(summary.totalExpenses)
      if (profitEl) profitEl.innerHTML = formatCurrency(summary.netProfit)

      if (breakdownEl && summary.breakdown) {
        breakdownEl.innerHTML = Object.entries(summary.breakdown)
          .map(([method, amount]) => `<div>${method}: ${formatCurrency(amount, method)}</div>`)
          .join('')
      }

      renderFinancialCharts()
    } catch (e) {
      console.error(e)
    }
  }


  let incomeExpenseChart = null
  let categoryChart = null

  async function renderFinancialCharts() {
    const trans = await fetchTransactions()
    const ctx1 = document.getElementById('chart-income-expenses')?.getContext('2d')
    const ctx2 = document.getElementById('chart-categories')?.getContext('2d')

    if (!ctx1 || !ctx2) return

    // Datos simplificados para gráfico 1: Últimos 10 movimientos
    const last10 = trans.slice(0, 10).reverse()
    const labels = last10.map(t => new Date(t.date).toLocaleDateString())
    const incomes = last10.map(t => t.type === 'ingreso' ? t.amount : 0)
    const expenses = last10.map(t => t.type === 'egreso' ? t.amount : 0)

    if (incomeExpenseChart) incomeExpenseChart.destroy()
    incomeExpenseChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Ingresos', data: incomes, borderColor: '#48bb78', backgroundColor: 'rgba(72, 187, 120, 0.1)', fill: true, tension: 0.4 },
          { label: 'Egresos', data: expenses, borderColor: '#f56565', backgroundColor: 'rgba(245, 101, 101, 0.1)', fill: true, tension: 0.4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    })

    const cats = trans.reduce((acc, t) => {
      if (t.type === 'ingreso') {
        const cat = t.category || 'Otros'
        acc[cat] = (acc[cat] || 0) + Number(t.amount)
      }
      return acc
    }, {})

    if (categoryChart) categoryChart.destroy()
    categoryChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: Object.keys(cats),
        datasets: [{
          data: Object.values(cats),
          backgroundColor: ['#4299E1', '#48BB78', '#F6E05E', '#ED8936', '#9F7AEA', '#F56565']
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right' } }
      }
    })
  }

  const exitModal = document.getElementById('exit-modal')
  const exitForm = document.getElementById('exit-form')
  const btnInventoryExit = document.getElementById('btn-inventory-exit')
  const closeExitModal = document.getElementById('close-exit-modal')

  if (btnInventoryExit) btnInventoryExit.onclick = async () => {
    const prods = await fetchProducts()
    const select = document.getElementById('exit-product')
    if (select) {
      select.innerHTML = '<option value="">Seleccione producto...</option>'
      prods.forEach(p => {
        const opt = document.createElement('option')
        opt.value = p.id
        opt.textContent = `${p.name} (Stock: ${p.stock})`
        select.appendChild(opt)
      })
    }
    if (exitModal) exitModal.style.display = 'flex'
  }

  if (closeExitModal) closeExitModal.onclick = () => exitModal.style.display = 'none'

  if (exitForm) {
    exitForm.onsubmit = async (e) => {
      e.preventDefault()
      const { data: { user } } = await supabase.auth.getUser()
      const exitData = {
        productId: document.getElementById('exit-product').value,
        quantity: parseInt(document.getElementById('exit-quantity').value),
        reason: document.getElementById('exit-reason').value,
        receivedBy: document.getElementById('exit-received').value,
        userId: user.id
      }

      const res = await registerInventoryExit(exitData)
      if (res.success) {
        exitModal.style.display = 'none'
        generateExitPDF(exitData, res.productName)
        loadProductsTable()
        exitForm.reset()
      } else {
        const errEl = document.getElementById('exit-error')
        if (errEl) errEl.textContent = res.error
      }
    }
  }

  function generateExitPDF(data, productName) {
    const { jsPDF } = window.jspdf
    const doc = jsPDF()
    doc.setFontSize(20)
    doc.text("D'Lux Boutique - Vale de Salida", 20, 20)
    doc.setFontSize(12)
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 20, 35)
    doc.text(`ID Producto: ${data.productId}`, 20, 45)
    doc.text(`Producto: ${productName}`, 20, 55)
    doc.text(`Cantidad: ${data.quantity}`, 20, 65)
    doc.text(`Motivo: ${data.reason}`, 20, 75)
    doc.text(`Retirado por: ${data.receivedBy}`, 20, 85)

    doc.line(20, 110, 100, 110)
    doc.text("Firma de Quien Retira", 20, 115)

    doc.line(110, 110, 190, 110)
    doc.text("Firma Autorizada Admin", 110, 115)

    forceDownloadPDF(doc, `salida_${productName}.pdf`)
  }

  // --- Tasa de Cambio DolarAPI ---
  async function syncExchangeRate() {
    const btnSync = document.getElementById('btn-sync-rate')
    const rateInput = document.getElementById('sale-rate')
    if (btnSync) btnSync.style.opacity = '0.5'
    try {
      // Usar tasa Paralelo (USDT/Monitor) según requerimiento del usuario
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo')
      const data = await response.json()
      if (data && data.promedio) {
        window.currentExchangeRate = parseFloat(data.promedio);
        rateInput.value = data.promedio.toFixed(2)
        rateInput.dispatchEvent(new Event('change'))
      }
    } catch (e) {
      console.error("Error al sincronizar tasa:", e)
      alert("No se pudo obtener la tasa USDT en tiempo real.")
    } finally {
      if (btnSync) btnSync.style.opacity = '1'
    }
  }

  const btnSyncRate = document.getElementById('btn-sync-rate')
  if (btnSyncRate) btnSyncRate.onclick = syncExchangeRate

  async function loadAuditTable() {
    const tbody = document.getElementById('audit-tbody')
    if (!tbody) return
    try {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Cargando auditoría...</td></tr>'
      const trans = await fetchTransactions()
      tbody.innerHTML = ''
      trans.forEach(t => {
        const tr = document.createElement('tr')
        const isExit = t.category === 'inventario_salida'
        tr.innerHTML = `
          <td><small>${new Date(t.date).toLocaleString()}</small></td>
          <td><span class="badge ${t.type === 'ingreso' ? 'badge-success' : 'badge-danger'}">${t.type.toUpperCase()}</span></td>
          <td>${t.concept}</td>
          <td>${isExit ? `<strong>${t.exit_reason}</strong> / ${t.received_by}` : (t.payment_method || 'N/A')}</td>
          <td>${formatCurrency(t.amount, t.payment_method)}</td>
          <td>
            <button class="btn btn-outline btn-small edit-trans" data-id="${t.id}" style="padding: 2px 8px; margin-right: 4px;" title="Editar">✏️</button>
            <button class="btn btn-outline btn-small btn-danger delete-trans" data-id="${t.id}" style="padding: 2px 8px;" title="Eliminar">&times;</button>
          </td>
        `
        tbody.appendChild(tr)
      })
    } catch (e) {
      console.error(e)
    }
  }

  // Delegación de eventos para auditoría (Soluciona botón × inactivo y PDF)
  document.body.addEventListener('click', async (e) => {
    // ---- Eliminar Registro ----
    const btnDeleteTrans = e.target.closest('.delete-trans')
    if (btnDeleteTrans) {
      console.log('Trace: Delete transaction button clicked');
      if (confirm('¿Eliminar este registro financiero?\nAdvertencia: Esto NO revertirá el stock automáticamente.')) {
        const transId = btnDeleteTrans.getAttribute('data-id')
        btnDeleteTrans.disabled = true
        btnDeleteTrans.textContent = '...'
        try {
          const { error } = await supabase.from('transactions').delete().eq('id', transId)
          if (error) throw error
          loadAuditTable()
          alert('Registro eliminado exitosamente.')
        } catch (err) {
          console.error('Error al eliminar transacción:', err)
          alert(`Error: ${err.message}\n\nRevisa la conexión o permisos.`)
        } finally {
          if (btnDeleteTrans && document.body.contains(btnDeleteTrans)) {
            btnDeleteTrans.disabled = false
            btnDeleteTrans.textContent = '×'
          }
        }
      }
      return
    }

    // ---- Editar Registro ----
    const btnEditTrans = e.target.closest('.edit-trans')
    if (btnEditTrans) {
      console.log('Trace: Edit transaction button clicked');
      const transId = btnEditTrans.getAttribute('data-id')
      const transType = btnEditTrans.getAttribute('data-type')
      const transConcept = btnEditTrans.getAttribute('data-concept')
      const transAmount = btnEditTrans.getAttribute('data-amount')
      const transCategory = btnEditTrans.getAttribute('data-category')
      const transPaymentMethod = btnEditTrans.getAttribute('data-payment-method')

      const editTransModal = document.getElementById('edit-transaction-modal')
      const editTransForm = document.getElementById('edit-transaction-form')
      const editTransError = document.getElementById('edit-transaction-error')

      if (editTransModal && editTransForm) {
        editTransForm.reset()
        document.getElementById('edit-trans-id').value = transId
        document.getElementById('edit-trans-type').value = transType
        document.getElementById('edit-trans-concept').value = transConcept
        document.getElementById('edit-trans-amount').value = parseFloat(transAmount).toFixed(2)
        document.getElementById('edit-trans-category').value = transCategory
        document.getElementById('edit-trans-payment-method').value = transPaymentMethod
        if (editTransError) editTransError.textContent = ''
        editTransModal.style.display = 'flex'
      }
      return
    }

    // ---- Exportar PDF de Auditoría ----
    const btnExportAuditPdf = e.target.closest('#btn-export-audit-pdf')
    if (btnExportAuditPdf) {
      console.log('Trace: Export audit PDF button clicked');
      const { jsPDF } = window.jspdf;
      if (!jsPDF) {
        alert("Error: jsPDF no está cargado.");
        return;
      }
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text("D'Lux Admin - Auditoría de Movimientos", 14, 20);
      doc.setFontSize(11);
      doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);

      const rows = [];
      document.querySelectorAll('#audit-tbody tr').forEach(tr => {
        const cols = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        // Excluir la última columna (acciones)
        if (cols.length > 0) {
          rows.push(cols.slice(0, -1));
        }
      });

      if (rows.length === 0 || (rows.length === 1 && rows[0][0].includes("Cargando"))) {
        alert("No hay datos de auditoría para exportar.");
        return;
      }

      doc.autoTable({
        startY: 35,
        head: [['Fecha', 'Tipo', 'Concepto', 'Justificación', 'Monto']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [0, 0, 0] }
      });

      forceDownloadPDF(doc, sanitizeFilename(`Auditoria_Dlux_${Date.now()}.pdf`));
      return
    }

    // ---- Abrir Modal de Salida de Inventario ----
    const btnInventoryExit = e.target.closest('#btn-inventory-exit')
    if (btnInventoryExit) {
      console.log('Trace: Inventory Exit button clicked');
      const prods = await fetchProducts()
      const select = document.getElementById('exit-product')
      if (select) {
        select.innerHTML = '<option value="">Seleccione producto...</option>'
        prods.forEach(p => {
          const opt = document.createElement('option')
          opt.value = p.id
          opt.textContent = `${p.name} (Stock: ${p.stock})`
          select.appendChild(opt)
        })
      }
      if (exitModal) exitModal.style.display = 'flex'
      return
    }

    // ---- Cerrar Modal de Salida de Inventario ----
    const closeExitModal = e.target.closest('#close-exit-modal')
    if (closeExitModal) {
      console.log('Trace: Close Exit Modal button clicked');
      if (exitModal) exitModal.style.display = 'none'
      return
    }

    // ---- Sincronizar Tasa de Cambio ----
    const btnSyncRate = e.target.closest('#btn-sync-rate')
    if (btnSyncRate) {
      console.log('Trace: Sync Exchange Rate button clicked');
      syncExchangeRate()
      return
    }

    // ---- Cerrar Modal de Producto ----
    const closeModalBtn = e.target.closest('#close-modal-btn')
    if (closeModalBtn) {
      console.log('Trace: Close Product Modal button clicked');
      if (productModal) productModal.style.display = 'none'
      return
    }

    // ---- Abrir Modal de Nuevo Producto ----
    const btnNewProduct = e.target.closest('#btn-new-product')
    if (btnNewProduct) {
      console.log('Trace: New Product button clicked');
      if (productForm) productForm.reset()
      const prodIdEl = document.getElementById('prod-id')
      if (prodIdEl) prodIdEl.value = ''
      const modalTitleEl = document.getElementById('modal-title')
      if (modalTitleEl) modalTitleEl.textContent = 'Nuevo Producto'
      const deleteBtn = document.getElementById('delete-product-btn')
      if (deleteBtn) deleteBtn.style.display = 'none'
      if (productModal) productModal.style.display = 'flex'
      return
    }

    // ---- Eliminar Producto ----
    const deleteProductBtn = e.target.closest('#delete-product-btn')
    if (deleteProductBtn) {
      console.log('Trace: Delete Product button clicked');
      const id = document.getElementById('prod-id').value
      if (id && confirm('¿Seguro que desea eliminar este producto?')) {
        try {
          await deleteProduct(id)
          if (productModal) productModal.style.display = 'none'
          loadProductsTable()
        } catch (err) {
          const productError = document.getElementById('product-error')
          if (productError) productError.textContent = err.message
        }
      }
      return
    }

    // ---- Abrir Modal de Nuevo Usuario ----
    const btnNewUser = e.target.closest('#btn-new-user')
    if (btnNewUser) {
      console.log('Trace: New User button clicked');
      const userForm = document.getElementById('user-form')
      const userModal = document.getElementById('user-modal')
      if (userForm) userForm.reset()
      if (userModal) userModal.style.display = 'flex'
      return
    }

    // ---- Cerrar Modal de Usuario ----
    const closeUserModal = e.target.closest('#close-user-modal')
    if (closeUserModal) {
      console.log('Trace: Close User Modal button clicked');
      const userModal = document.getElementById('user-modal')
      if (userModal) userModal.style.display = 'none'
      return
    }

    // ---- Cambiar Rol de Usuario ----
    const changeRoleBtn = e.target.closest('.change-role')
    if (changeRoleBtn) {
      console.log('Trace: Change Role button clicked');
      const userId = changeRoleBtn.getAttribute('data-id')
      const currentRole = changeRoleBtn.getAttribute('data-role')
      const newRole = currentRole === 'admin' ? 'seller' : 'admin'

      if (confirm(`¿Cambiar el rol de este usuario a ${newRole.toUpperCase()}?`)) {
        try {
          const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
          if (error) throw error
          loadUsersTable()
          alert('Rol de usuario actualizado.')
        } catch (err) {
          console.error('Error al cambiar rol:', err)
          alert(`Error: ${err.message}`)
        }
      }
      return
    }
  })

  // --- Modales (Apertura/Cierre) ---
  function openEditModal(p) {
    if (productForm) productForm.reset()
    document.getElementById('prod-id').value = p.id || ''
    document.getElementById('prod-name').value = p.name || ''
    document.getElementById('prod-sku').value = p.sku || ''
    document.getElementById('prod-price').value = p.price || 0
    document.getElementById('prod-cost').value = p.cost_price || 0
    document.getElementById('prod-stock').value = p.stock || 0
    document.getElementById('prod-brand').value = p.brand || ''
    document.getElementById('prod-color').value = p.color || ''
    document.getElementById('prod-size').value = p.size || ''
    document.getElementById('prod-desc').value = p.description || ''
    document.getElementById('prod-gender').value = p.gender || 'Woman'
    document.getElementById('prod-category').value = p.category || ''
    document.getElementById('prod-status').value = p.status || 'active'
    const modalTitle = document.getElementById('modal-title')
    if (modalTitle) modalTitle.textContent = 'Editar Producto'
    const deleteBtn = document.getElementById('delete-product-btn')
    if (deleteBtn) deleteBtn.style.display = 'block'
    const gallery = document.getElementById('image-gallery-preview')
    if (gallery) {
      gallery.innerHTML = ''
      const imgs = p.images || (p.image_url ? [p.image_url] : [])
      imgs.forEach(url => {
        const img = document.createElement('img')
        img.src = url
        img.className = 'product-img-thumb'
        gallery.appendChild(img)
      })
    }
    if (productModal) productModal.style.display = 'flex'
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', () => productModal.style.display = 'none')
  if (btnNewProduct) btnNewProduct.addEventListener('click', () => {
    productForm.reset()
    document.getElementById('prod-id').value = ''
    document.getElementById('modal-title').textContent = 'Nuevo Producto'
    document.getElementById('delete-product-btn').style.display = 'none'
    document.getElementById('image-gallery-preview').innerHTML = ''
    productModal.style.display = 'flex'
  })

  // --- Manejo del Formulario de Productos ---
  if (productForm) {
    productForm.onsubmit = async (e) => {
      e.preventDefault()
      const btn = document.getElementById('save-product-btn')
      if (btn) btn.disabled = true
      if (productError) productError.textContent = ''

      try {
        const id = document.getElementById('prod-id').value
        const imageFiles = document.getElementById('prod-image').files

        let imageUrls = []
        if (imageFiles.length > 0) {
          for (let i = 0; i < imageFiles.length; i++) {
            const url = await uploadImageToCloudinary(imageFiles[i])
            imageUrls.push(url)
          }
        }

        const productData = {
          name: document.getElementById('prod-name').value,
          sku: document.getElementById('prod-sku').value,
          price: parseFloat(document.getElementById('prod-price').value),
          cost_price: parseFloat(document.getElementById('prod-cost').value),
          stock: parseInt(document.getElementById('prod-stock').value),
          brand: document.getElementById('prod-brand').value,
          color: document.getElementById('prod-color').value,
          size: document.getElementById('prod-size').value,
          description: document.getElementById('prod-desc').value,
          gender: document.getElementById('prod-gender').value,
          category: document.getElementById('prod-category').value,
          status: document.getElementById('prod-status').value
        }

        if (imageUrls.length > 0) {
          productData.images = imageUrls
        }

        if (id) {
          await updateProduct(id, productData)
        } else {
          await createProduct(productData)
        }

        productModal.style.display = 'none'
        loadProductsTable()
        productForm.reset()
      } catch (err) {
        console.error(err)
        productError.textContent = 'Error: ' + err.message
      } finally {
        if (btn) btn.disabled = false
      }
    }
  }

  const deleteProductBtn = document.getElementById('delete-product-btn')
  if (deleteProductBtn) {
    deleteProductBtn.onclick = async () => {
      const id = document.getElementById('prod-id').value
      if (id && confirm('¿Seguro que desea eliminar este producto?')) {
        try {
          await deleteProduct(id)
          productModal.style.display = 'none'
          loadProductsTable()
        } catch (err) {
          productError.textContent = err.message
        }
      }
    }
  }

  // --- Lógica de Usuarios ---
  async function loadUsersTable() {
    const tbody = document.getElementById('users-tbody')
    if (!tbody) return

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Cargando perfiles...</td></tr>'

    try {
      const { data: profiles, error } = await supabase.from('profiles').select('*')
      const tbody = document.getElementById('users-tbody')
      if (error) throw error

      tbody.innerHTML = profiles.length ? '' : '<tr><td colspan="4" style="text-align:center">No hay otros perfiles.</td></tr>'

      profiles.forEach(u => {
        const tr = document.createElement('tr')
        tr.innerHTML = `
          <td><small>${u.email}</small></td>
          <td>${u.full_name || 'Sin nombre'}</td>
          <td><span class="badge ${u.role === 'admin' ? 'badge-success' : 'badge-warning'}">${u.role.toUpperCase()}</span></td>
          <td>
            <button class="btn btn-outline btn-small change-role" data-id="${u.id}" data-role="${u.role}">
              Cambiar a ${u.role === 'admin' ? 'Vendedor' : 'Admin'}
            </button>
          </td>
        `
        tbody.appendChild(tr)
      })

      // Eventos para el modal de usuario
      const btnNewUser = document.getElementById('btn-new-user')
      const userModal = document.getElementById('user-modal')
      const closeUserModal = document.getElementById('close-user-modal')
      const userForm = document.getElementById('user-form')
      const userError = document.getElementById('user-error')

      if (btnNewUser) btnNewUser.onclick = () => {
        userForm.reset()
        userModal.style.display = 'flex'
      }
      if (closeUserModal) closeUserModal.onclick = () => userModal.style.display = 'none'

      if (userForm) {
        userForm.onsubmit = async (e) => {
          e.preventDefault()
          const email = document.getElementById('user-email').value
          const password = document.getElementById('user-password').value
          const fullName = document.getElementById('user-full-name').value
          const role = document.getElementById('user-role').value
          const btn = document.getElementById('save-user-btn')

          btn.disabled = true
          userError.textContent = ''

          try {
            // 1. Crear usuario en Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: fullName }

              }
            })
            if (authError) throw authError

            // 2. Actualizar perfil (el trigger ya lo crea como admin por defecto en este proyecto, 
            // pero vamos a forzar el rol y nombre que eligió el admin)
            if (authData.user) {
              const { error: profError } = await supabase
                .from('profiles')
                .update({ role, full_name: fullName })
                .eq('id', authData.user.id)
              if (profError) throw profError
            }

            userModal.style.display = 'none'
            loadUsersTable()
            alert('Usuario creado con éxito. El usuario debe confirmar su correo si aplica.')
          } catch (err) {
            userError.textContent = err.message
          } finally {
            btn.disabled = false
          }
        }
      }

      document.querySelectorAll('.change-role').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id')
          const currentRole = e.target.getAttribute('data-role')
          const newRole = currentRole === 'admin' ? 'vendedor' : 'admin'
          if (confirm(`¿Cambiar rol a ${newRole}?`)) {
            await supabase.from('profiles').update({ role: newRole }).eq('id', id)
            loadUsersTable()
          }
        })
      })
    } catch (e) {
      console.error(e)
    }
  }

  // --- Mobile Interactivity ---
  const mobileMenuBtn = document.getElementById('mobile-menu-btn')
  const mobileOverlay = document.getElementById('mobile-overlay')
  const sidebarEl = document.querySelector('.sidebar')

  if (mobileMenuBtn && mobileOverlay && sidebarEl) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebarEl.classList.add('sidebar-open')
      mobileOverlay.classList.add('active')
    })

    mobileOverlay.addEventListener('click', () => {
      sidebarEl.classList.remove('sidebar-open')
      mobileOverlay.classList.remove('active')
    })
  }

  // Carga Inicial
  checkSession()
})
