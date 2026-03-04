import './style.css'
import { supabase } from './src/supabase.js'
import { fetchProducts, createProduct, updateProduct, deleteProduct, uploadImageToCloudinary } from './src/inventory.js'
import { fetchOrders, updateOrderStatus, deleteOrder } from './src/orders.js'

import './style.css'
import { supabase } from './src/supabase.js'
import { fetchProducts, createProduct, updateProduct, deleteProduct, uploadImageToCloudinary } from './src/inventory.js'
import { fetchOrders, updateOrderStatus, deleteOrder } from './src/orders.js'

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
      if (viewHome) viewHome.style.display = 'none';
      if (viewInventory) viewInventory.style.display = 'none';
      if (viewOrders) viewOrders.style.display = 'none';

      if (target === 'home') {
        if (pageTitle) pageTitle.textContent = 'Dashboard';
        if (viewHome) viewHome.style.display = 'block';
        loadKpis();
      } else if (target === 'inventory') {
        if (pageTitle) pageTitle.textContent = 'Inventario';
        if (viewInventory) viewInventory.style.display = 'block';
        loadProductsTable();
      } else if (target === 'orders') {
        if (pageTitle) pageTitle.textContent = 'Pedidos';
        if (viewOrders) viewOrders.style.display = 'block';
        loadOrdersTable();
      }
    });
  });

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
        let mainImg = '/vite.svg';
        if (p.images && p.images.length > 0) mainImg = p.images[0];
        else if (p.image_url) mainImg = p.image_url;

        const stockClass = p.stock <= 0 ? 'badge-danger' : (p.stock <= 5 ? 'badge-warning' : 'badge-success');
        const stockText = p.stock <= 0 ? 'Agotado' : (p.stock <= 5 ? 'Bajo Stock' : 'Disponible');

        tr.innerHTML = `
        <td><img src="${mainImg}" class="product-img-thumb" onerror="this.src='/vite.svg'"></td>
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

  // Load KPIs for Home
  async function loadKpis() {
    try {
      const products = await fetchProducts();
      const kpiProducts = document.getElementById('kpi-products');
      if (kpiProducts) kpiProducts.textContent = products.length;

      const orders = await fetchOrders();
      const kpiSales = document.getElementById('kpi-sales');
      if (kpiSales) kpiSales.textContent = orders.length;

      const pendingOrders = orders.filter(o => o.status === 'pending');
      const kpiOrders = document.getElementById('kpi-orders');
      if (kpiOrders) kpiOrders.textContent = pendingOrders.length;

      // Calculate total revenue (only paid/shipped/delivered)
      const validStatuses = ['paid', 'shipped', 'delivered'];
      const revenue = orders
        .filter(o => validStatuses.includes(o.status))
        .reduce((sum, o) => sum + Number(o.total || 0), 0);

      const kpiRevenue = document.getElementById('kpi-revenue');
      if (kpiRevenue) kpiRevenue.textContent = '$' + revenue.toFixed(2);
    } catch (e) {
      console.error('Error loading KPIs', e);
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

  // Initialize
  checkSession();
  loadKpis();
});
