import './style.css'
import { supabase, getUserProfile } from './src/supabase.js'
import { fetchProducts, createProduct, updateProduct, deleteProduct, uploadImageToCloudinary } from './src/inventory.js'
import { fetchOrders, updateOrderStatus, deleteOrder } from './src/orders.js'
import { registerSale, registerExpense, fetchTransactions, getFinancialSummary, registerPayment, registerPayroll } from './src/sales.js'

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

  // --- Inicialización y Sesión ---
  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const profile = await getUserProfile(session.user.id)
      currentUserRole = profile?.role || 'vendedor'
      allProducts = await fetchProducts() // Cargar cache inicial
      showDashboard(session.user)
      applyPermissions(currentUserRole)
      loadHomeData()
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
      el.style.display = (role === 'admin') ? 'block' : 'none'
      if (el.tagName === 'A' && role === 'admin') el.style.display = 'block'
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
    if (loginContainer) loginContainer.style.display = 'none'
    if (dashboardContainer) dashboardContainer.style.display = 'flex'
    if (appContainer) {
      appContainer.style.alignItems = 'flex-start'
      appContainer.style.justifyContent = 'flex-start'
    }
    const userProfile = document.querySelector('.user-profile')
    if (userProfile && user.email) userProfile.textContent = user.email
  }

  function showLogin() {
    if (dashboardContainer) dashboardContainer.style.display = 'none'
    if (loginContainer) loginContainer.style.display = 'block'
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
      const btn = loginForm.querySelector('button')
      const originalText = btn.textContent
      btn.textContent = 'Iniciando sesión...'
      btn.disabled = true
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) loginError.textContent = error.message
      } catch (err) {
        loginError.textContent = 'Error de conexión'
      } finally {
        btn.textContent = originalText
        btn.disabled = false
      }
    })
  }

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

      if (pageTitle) {
        const titles = {
          home: 'Dashboard',
          inventory: 'Inventario',
          orders: 'Ventas / Pedidos',
          reports: 'Reportes Contables',
          users: 'Usuarios',
          credits: 'Créditos y Apartados',
          payroll: 'Nómina y Servicios'
        }
        pageTitle.textContent = titles[target] || 'Dashboard'
      }

      if (target === 'home') loadHomeData()
      if (target === 'inventory') loadProductsTable()
      if (target === 'orders') loadOrdersTable()
      if (target === 'reports') loadReportsTable()
      if (target === 'credits') loadCreditsTable()
      if (target === 'payroll') loadPayrollTable()
      if (target === 'users') loadUsersTable()
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
      ordersTbody.innerHTML = orders.length ? '' : '<tr><td colspan="6" style="text-align: center;">No hay pedidos registrados.</td></tr>'
      orders.forEach(o => {
        const tr = document.createElement('tr')
        tr.innerHTML = `
          <td><small>${new Date(o.created_at).toLocaleString()}</small></td>
          <td>${o.customer_name}</td>
          <td>${o.items?.length || 0} items</td>
          <td>$${o.total_amount.toFixed(2)}</td>
          <td><span class="badge ${o.status === 'paid' ? 'badge-success' : 'badge-warning'}">${o.status.toUpperCase()}</span></td>
          <td>
            <button class="btn btn-outline btn-small view-order" data-id="${o.id}">Ver</button>
            <button class="btn btn-outline btn-danger btn-small delete-order" data-id="${o.id}">Eliminar</button>
          </td>
        `
        ordersTbody.appendChild(tr)
      })

      document.querySelectorAll('.delete-order').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (confirm('¿Eliminar este pedido?')) {
            const id = e.target.getAttribute('data-id')
            await deleteOrder(id)
            loadOrdersTable()
          }
        })
      })
    } catch (e) {
      console.error(e)
    }
  }

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
          items,
          notes: document.getElementById('sale-notes').value,
          userId: user.id,
          currency: document.getElementById('sale-currency').value,
          exchangeRate: parseFloat(document.getElementById('sale-rate').value),
          paymentMethod: document.getElementById('sale-payment-method').value,
          paymentStatus: document.getElementById('sale-status').value,
          dueDate: document.getElementById('sale-due-date').value
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
    document.getElementById('due-date-container').style.display = e.target.value === 'completed' ? 'none' : 'block'
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
          <td>$${c.total_amount.toFixed(2)}</td>
          <td style="color: var(--danger); font-weight:700;">$${c.remaining_amount.toFixed(2)}</td>
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
    document.getElementById('abono-remaining-amount').textContent = `$${credit.remaining_amount.toFixed(2)}`
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
          <td style="color:var(--danger); font-weight:600">-$${p.amount.toFixed(2)}</td>
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
          <td style="font-weight:700">$${t.amount.toFixed(2)}</td>
          <td><span class="badge badge-outline">${t.payment_method || 'N/A'}</span></td>
          <td><span class="badge ${t.payment_status === 'pending' ? 'badge-warning' : 'badge-success'}">${(t.payment_status || 'completed').toUpperCase()}</span></td>
        `
        reportsTbody.appendChild(tr)
      })
      const summary = await getFinancialSummary()
      const reportRev = document.getElementById('report-total-revenue')
      const reportProfit = document.getElementById('report-net-profit')
      if (reportRev) reportRev.textContent = '$' + summary.totalRevenue.toFixed(2)
      if (reportProfit) reportProfit.textContent = '$' + summary.netProfit.toFixed(2)
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

    doc.save(`Reporte_Dlux_${startDate}_${endDate}.pdf`);
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
      if (incomeEl) incomeEl.textContent = '$' + summary.totalRevenue.toFixed(2)
      if (expensesEl) expensesEl.textContent = '$' + summary.totalExpenses.toFixed(2)
      if (profitEl) profitEl.textContent = '$' + summary.netProfit.toFixed(2)
    } catch (e) {
      console.error(e)
    }
  }

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

  // Carga Inicial
  checkSession()
})
