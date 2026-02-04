// CONFIG
const CONFIG = {
  SUPABASE_URL: "https://mpwyzefkazbgnastcahd.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wd3l6ZWZrYXpiZ25hc3RjYWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDg4NTUsImV4cCI6MjA4NTAyNDg1NX0.9bcksevoXtniNvcUiFYhcmWzd8xHDmsY75FJljPO-_4",
  COMPANY_ID: window.COMPANY_ID || "18b94000-046c-476b-a0f9-ab813e57e3d7",
  ADMIN_PASSWORD: "admin123"
};

// STATE
const state = {
  db: null,
  products: [],
  suppliers: [],
  clients: [],
  categories: [],
  cart: [],
  mode: 'sale',
  currentSection: 'trading',
  period: 'day',
  selectedSale: null,
  receiveBatches: []
};

// HELPERS
const $ = id => document.getElementById(id);
const formatMoney = n => new Intl.NumberFormat('ru-KZ').format(n) + ' ₸';
const formatDate = d => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatTime = d => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// INIT
async function initApp() {
  try {
    state.db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    
    // Check auth
    const { data: { session } } = await state.db.auth.getSession();
    if (!session && !localStorage.getItem('kassir_user')) {
      window.location.replace('login.html');
      return;
    }

    updateStatus('Загрузка данных...');
    await Promise.all([loadProducts(), loadSuppliers(), loadClients(), loadCategories()]);
    loadMiniReport();
    loadMoneyBalance();
    updateStatus('Готово', true);
  } catch (e) {
    console.error('Init error:', e);
    updateStatus('Ошибка подключения', false);
    showToast('Ошибка инициализации: ' + e.message, 'error');
  }
}

function updateStatus(text, connected = null) {
  const statusText = $("statusText"), statusDot = $("statusDot");
  if (statusText) statusText.textContent = text;
  if (statusDot && connected !== null) statusDot.className = 'status-dot ' + (connected ? 'connected' : 'error');
}

// DATA LOADING
async function loadProducts() {
  try {
    const { data, error } = await state.db
      .from('products_with_stock')
      .select('*')
      .eq('company_id', CONFIG.COMPANY_ID)
      .eq('active', true)
      .order('name');
    
    if (error) throw error;
    state.products = data || [];
    console.log('Loaded products:', state.products.length);
  } catch (e) {
    console.error('Load products:', e);
    state.products = [];
  }
}

async function loadSuppliers() {
  try {
    const { data } = await state.db.from('suppliers').select('*').eq('company_id', CONFIG.COMPANY_ID).order('name');
    state.suppliers = data || [];
  } catch (e) { console.error('Load suppliers:', e); state.suppliers = []; }
}

async function loadClients() {
  try {
    const { data } = await state.db.from('clients').select('*').eq('company_id', CONFIG.COMPANY_ID).order('name');
    state.clients = data || [];
  } catch (e) { console.error('Load clients:', e); state.clients = []; }
}

async function loadCategories() {
  try {
    const { data } = await state.db.from('expense_categories').select('*').eq('company_id', CONFIG.COMPANY_ID).order('name');
    state.categories = data || [];
  } catch (e) { console.error('Load categories:', e); state.categories = []; }
}

// SECTIONS
function showSection(section) {
  state.currentSection = section;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = $('section-' + section); if (sec) sec.classList.add('active');
  const nav = document.querySelector(`[data-section="${section}"]`); if (nav) nav.classList.add('active');
  
  if (section === 'products') renderProductsList();
  else if (section === 'suppliers') renderSuppliersList();
  else if (section === 'clients') renderClientsList();
  else if (section === 'expenses') showExpenseTab('list');
  else if (section === 'reports') showReportTab('sales');
  else if (section === 'money') { loadMoneyBalance(); showTab('moneyBalance'); }
}

// MINI REPORT
function changePeriod(p) {
  state.period = p;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === p));
  loadMiniReport();
}

async function loadMiniReport() {
  const now = new Date(), from = new Date(now);
  if (state.period === 'day') from.setHours(0,0,0,0);
  else if (state.period === 'week') { from.setDate(now.getDate() - 7); from.setHours(0,0,0,0); }
  else if (state.period === 'month') { from.setDate(1); from.setHours(0,0,0,0); }

  const table = { sale: 'sales', receive: 'stock_movements', return: 'refunds', writeoff: 'stock_movements', supplier_return: 'stock_movements' }[state.mode] || 'sales';
  const typeFilter = (state.mode === 'receive' || state.mode === 'writeoff' || state.mode === 'supplier_return') ? state.mode : null;
  
  try {
    let query = state.db.from(table).select('*').eq('company_id', CONFIG.COMPANY_ID).is('deleted_at', null).gte('operation_at', from.toISOString());
    if (state.mode === 'sale') query = query.eq('status', 'completed');
    if (typeFilter) query = query.eq('type', typeFilter === 'receive' ? 'in' : typeFilter);
    
    const { data } = await query.order('operation_at', { ascending: false });
    
    const ops = data || [];
    const sum = ops.reduce((s, o) => s + (Number(o.total_amount) || Number(o.price) * Number(o.quantity) || 0), 0);
    
    if ($('miniReportCount')) $('miniReportCount').textContent = ops.length;
    if ($('miniReportSum')) $('miniReportSum').textContent = formatMoney(sum);
    
    const list = $('miniOperationsList');
    if (list) {
      list.innerHTML = ops.length === 0 ? '<div class="list-empty">Нет операций</div>' : '';
      ops.slice(0, 10).forEach(o => {
        const d = document.createElement('div'); d.className = 'mini-operation';
        const amt = Number(o.total_amount) || Number(o.price) * Number(o.quantity) || 0;
        d.innerHTML = `<div class="mini-op-left"><div class="mini-op-time">${formatTime(o.operation_at)}</div></div><div class="mini-op-right">${formatMoney(amt)}${state.mode === 'sale' && o.id ? `<button class="btn-delete-mini" onclick="requestDelete('${o.id}','sale')">✕</button>` : ''}</div>`;
        list.appendChild(d);
      });
    }
  } catch (e) { console.error('Load mini report:', e); }
}

// MODES
function setMode(mode) {
  state.mode = mode;
  state.cart = [];
  state.receiveBatches = [];
  state.selectedSale = null;
  
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[onclick*="${mode}"]`)?.classList.add('active');
  
  const titles = { sale: 'Продажа', receive: 'Приход', return: 'Возврат', writeoff: 'Списание', supplier_return: 'Возврат поставщику' };
  const modeTitle = $('modeTitle'); if (modeTitle) modeTitle.textContent = titles[mode] || mode;
  
  const miniCard = $('miniReportCard');
  if (miniCard) {
    const miniTitles = { sale: 'Продажи за', receive: 'Приходы за', return: 'Возвраты за', writeoff: 'Списания за', supplier_return: 'Возвраты поставщику за' };
    const periods = { day: 'день', week: 'неделю', month: 'месяц' };
    const miniTitle = $('miniReportTitle');
    if (miniTitle) miniTitle.textContent = (miniTitles[mode] || 'Операции за') + ' ' + periods[state.period];
  }
  
  const searchCard = $('searchCard'), returnBlock = $('returnSearchBlock'), receiveBlock = $('receiveBatchesBlock'), cartCard = $('cartCard');
  if (searchCard) searchCard.style.display = mode === 'return' ? 'none' : 'block';
  if (returnBlock) returnBlock.style.display = mode === 'return' ? 'block' : 'none';
  if (receiveBlock) receiveBlock.style.display = mode === 'receive' ? 'block' : 'none';
  if (cartCard) cartCard.style.display = mode === 'receive' ? 'none' : 'block';
  
  if (mode === 'supplier_return') {
    const supplierBlock = $('supplierSelectBlock');
    if (supplierBlock) supplierBlock.style.display = 'block';
    const supplierSelect = $('supplierSelect');
    if (supplierSelect) {
      supplierSelect.innerHTML = '<option value="">Выберите поставщика</option>' + state.suppliers.filter(s => s.active !== false).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
  } else {
    const supplierBlock = $('supplierSelectBlock');
    if (supplierBlock) supplierBlock.style.display = 'none';
  }
  
  renderCart();
  loadMiniReport();
  
  const searchInput = $('searchInput');
  if (searchInput) { searchInput.value = ''; searchInput.focus(); }
  const suggestions = $('suggestions');
  if (suggestions) suggestions.innerHTML = '';
}

// SEARCH
let searchTimeout = null;
function handleSearch(e) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => search(e.target.value), 300);
}

function search(q) {
  const sug = $('suggestions'); if (!sug) return;
  q = q.trim().toLowerCase();
  if (!q) { sug.innerHTML = ''; return; }
  
  const results = state.products.filter(p => 
    p.name.toLowerCase().includes(q) || 
    (p.sku && p.sku.toLowerCase().includes(q)) || 
    (p.barcode && p.barcode.includes(q))
  ).slice(0, 10);
  
  sug.innerHTML = results.length === 0 ? '<div class="suggestion-empty">Не найдено</div>' : '';
  results.forEach(p => {
    const d = document.createElement('div'); d.className = 'suggestion';
    d.innerHTML = `<div class="suggestion-left"><div class="suggestion-name">${p.name}</div><div class="suggestion-meta">${p.sku || ''} ${p.type === 'service' ? '(Услуга)' : ''}</div></div><div class="suggestion-right"><div class="suggestion-price">${formatMoney(p.sale_price)}</div><div class="suggestion-stock">${p.type === 'product' ? 'Ост: ' + p.available_qty + ' ' + p.unit : ''}</div></div>`;
    d.onclick = () => addToCart(p);
    sug.appendChild(d);
  });
}

if ($('searchInput')) {
  $('searchInput').addEventListener('input', handleSearch);
  $('searchInput').addEventListener('focus', (e) => search(e.target.value));
}

// CART
function addToCart(product) {
  if (state.mode === 'receive') {
    const existing = state.receiveBatches.find(b => b.id === product.id);
    if (existing) { existing.qty++; } 
    else { state.receiveBatches.push({ ...product, qty: 1, cost: product.purchase_price || 0 }); }
    renderReceiveBatches();
  } else {
    const existing = state.cart.find(i => i.id === product.id);
    if (existing) { existing.qty++; } 
    else { state.cart.push({ ...product, qty: 1 }); }
    renderCart();
  }
  
  const searchInput = $('searchInput');
  if (searchInput) { searchInput.value = ''; searchInput.focus(); }
  const suggestions = $('suggestions');
  if (suggestions) suggestions.innerHTML = '';
}

function renderCart() {
  const list = $('cartList'), total = $('cartTotal'), count = $('cartCount');
  if (!list) return;
  
  const sum = state.cart.reduce((s, i) => s + (i.sale_price * i.qty), 0);
  const cnt = state.cart.reduce((c, i) => c + i.qty, 0);
  
  if (total) total.textContent = formatMoney(sum);
  if (count) count.textContent = cnt;
  
  list.innerHTML = state.cart.length === 0 ? '<div class="list-empty">Корзина пуста</div>' : '';
  state.cart.forEach((item, idx) => {
    const d = document.createElement('div'); d.className = 'cart-item';
    d.innerHTML = `<div class="cart-item-left"><div class="cart-item-name">${item.name}</div><div class="cart-item-price">${formatMoney(item.sale_price)} × ${item.qty} = ${formatMoney(item.sale_price * item.qty)}</div></div><div class="cart-item-right"><button class="qty-btn" onclick="${state.mode === 'return' ? 'changeReturnQty' : state.mode === 'sale' ? 'changeSaleQty' : 'changeSimpleQty'}(${idx}, -1)">−</button><span class="qty-display">${item.qty}</span><button class="qty-btn" onclick="${state.mode === 'return' ? 'changeReturnQty' : state.mode === 'sale' ? 'changeSaleQty' : 'changeSimpleQty'}(${idx}, 1)">+</button></div>`;
    list.appendChild(d);
  });
}

function changeSaleQty(idx, delta) {
  const item = state.cart[idx]; if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) state.cart.splice(idx, 1);
  else if (item.type === 'product' && newQty > item.available_qty) showToast(`Макс: ${item.available_qty}`, 'error');
  else item.qty = newQty;
  renderCart();
}

function changeSimpleQty(idx, delta) {
  const item = state.cart[idx]; if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) state.cart.splice(idx, 1);
  else item.qty = newQty;
  renderCart();
}

function changeReturnQty(idx, delta) {
  const item = state.cart[idx]; if (!item) return;
  const newQty = item.qty + delta;
  const maxQty = item.max_qty || item.qty;
  if (newQty <= 0) state.cart.splice(idx, 1);
  else if (newQty > maxQty) showToast(`Макс: ${maxQty}`, 'error');
  else item.qty = newQty;
  renderCart();
}

// RECEIVE
function renderReceiveBatches() {
  const list = $('receiveBatchesList');
  if (!list) return;
  
  list.innerHTML = state.receiveBatches.length === 0 ? '<div class="list-empty">Добавьте товары</div>' : '';
  state.receiveBatches.forEach((batch, idx) => {
    const d = document.createElement('div'); d.className = 'receive-batch';
    d.innerHTML = `<div class="batch-left"><div class="batch-name">${batch.name}</div><div class="batch-inputs"><input type="number" class="input-small" value="${batch.qty}" onchange="setReceiveQty(${idx}, this.value)" placeholder="Кол-во"> <span class="batch-unit">${batch.unit}</span> <input type="number" class="input-small" value="${batch.cost}" onchange="setReceiveCost(${idx}, this.value)" placeholder="Себес."></div></div><div class="batch-right"><button class="btn-remove" onclick="removeReceiveBatch(${idx})">✕</button></div>`;
    list.appendChild(d);
  });
}

function setReceiveQty(idx, val) { const b = state.receiveBatches[idx]; if (b) { b.qty = Number(val) || 1; renderReceiveBatches(); } }
function setReceiveCost(idx, val) { const b = state.receiveBatches[idx]; if (b) { b.cost = Number(val) || 0; renderReceiveBatches(); } }
function removeReceiveBatch(idx) { state.receiveBatches.splice(idx, 1); renderReceiveBatches(); }

// RETURN SEARCH
let returnSearchTimeout = null;
function handleReturnSearch(e) {
  clearTimeout(returnSearchTimeout);
  returnSearchTimeout = setTimeout(() => searchReturns(e.target.value), 300);
}

async function searchReturns(q) {
  const res = $('returnResults'); if (!res) return;
  q = q.trim().toLowerCase();
  if (!q) { res.innerHTML = ''; return; }
  
  try {
    const { data } = await state.db.from('sales').select('*, sale_items(product_id, quantity, price, products(name))').eq('company_id', CONFIG.COMPANY_ID).eq('status', 'completed').is('deleted_at', null).order('operation_at', { ascending: false }).limit(20);
    
    const filtered = (data || []).filter(s => {
      const items = s.sale_items || [];
      return items.some(i => i.products?.name.toLowerCase().includes(q));
    });
    
    res.innerHTML = filtered.length === 0 ? '<div class="list-empty">Не найдено</div>' : '';
    filtered.forEach(s => {
      const d = document.createElement('div'); d.className = 'return-result';
      const items = (s.sale_items || []).map(i => i.products?.name).join(', ');
      d.innerHTML = `<div class="return-result-left"><div class="return-result-date">${formatDate(s.operation_at)} ${formatTime(s.operation_at)}</div><div class="return-result-items">${items}</div></div><div class="return-result-right"><div class="return-result-sum">${formatMoney(s.total_amount)}</div><button class="btn-small" onclick="selectSaleForReturn('${s.id}')">Выбрать</button></div>`;
      res.appendChild(d);
    });
  } catch (e) { console.error('Search returns:', e); }
}

if ($('returnSearchInput')) $('returnSearchInput').addEventListener('input', handleReturnSearch);

async function selectSaleForReturn(saleId) {
  try {
    const { data } = await state.db.from('sales').select('*, sale_items(id, product_id, quantity, price, products(*))').eq('id', saleId).single();
    if (!data) { showToast('Продажа не найдена', 'error'); return; }
    
    state.selectedSale = data;
    state.cart = (data.sale_items || []).map(i => ({ ...i.products, qty: i.quantity, max_qty: i.quantity, original_price: i.price }));
    renderCart();
    showToast('Продажа выбрана', 'success');
  } catch (e) { console.error('Select sale:', e); showToast('Ошибка', 'error'); }
}

function clearReturnSelection() {
  state.cart = []; 
  state.selectedSale = null;
  $('returnSearchInput').value = ''; 
  $('returnResults').innerHTML = ''; 
  renderCart();
}

function getComment() { return $('commentInput')?.value.trim() || ''; }

// SUBMIT
async function submitOperation() {
  if (state.mode === 'sale') await submitSale();
  else if (state.mode === 'receive') await submitReceive();
  else if (state.mode === 'return') await submitReturn();
  else if (state.mode === 'writeoff') await submitWriteoff();
  else if (state.mode === 'supplier_return') await submitSupplierReturn();
}

async function submitSale() {
  if (state.cart.length === 0) { showToast('Добавьте товары', 'error'); return; }
  
  const pm = $('paymentMethod')?.value || 'cash';
  const clientId = $('clientSelect')?.value || null;
  const comment = getComment();
  const total = state.cart.reduce((s, i) => s + (i.sale_price * i.qty), 0);
  
  try {
    const { data: sale } = await state.db.from('sales').insert({
      company_id: CONFIG.COMPANY_ID,
      client_id: clientId,
      total_amount: total,
      payment_method: pm,
      status: 'completed',
      comment: comment || null,
      operation_at: new Date().toISOString()
    }).select().single();
    
    for (const item of state.cart) {
      await state.db.from('sale_items').insert({
        sale_id: sale.id,
        product_id: item.id,
        quantity: item.qty,
        price: item.sale_price
      });
      
      if (item.type === 'product') {
        await state.db.from('stock_movements').insert({
          company_id: CONFIG.COMPANY_ID,
          product_id: item.id,
          type: 'out',
          quantity: item.qty,
          price: item.purchase_price || 0,
          comment: `Продажа #${sale.id}`,
          operation_at: new Date().toISOString()
        });
      }
    }
    
    showToast('Продажа ✓', 'success');
    state.cart = [];
    if ($('clientSelect')) $('clientSelect').value = '';
    if ($('commentInput')) $('commentInput').value = '';
    await loadProducts();
    renderCart();
    loadMiniReport();
  } catch (e) {
    console.error('Sale error:', e);
    showToast('Ошибка: ' + e.message, 'error');
  }
}

async function submitReceive() {
  if (state.receiveBatches.length === 0) { showToast('Добавьте товары', 'error'); return; }
  
  const supId = $('receiveSupplierSelect')?.value || null;
  const comment = getComment() || 'Приход товара';
  
  try {
    for (const batch of state.receiveBatches) {
      if (batch.qty <= 0) continue;
      
      await state.db.from('stock_movements').insert({
        company_id: CONFIG.COMPANY_ID,
        product_id: batch.id,
        supplier_id: supId,
        type: 'in',
        quantity: batch.qty,
        price: batch.cost || 0,
        comment: comment,
        operation_at: new Date().toISOString()
      });
      
      if (batch.cost > 0) {
        await state.db.from('products').update({ purchase_price: batch.cost }).eq('id', batch.id);
      }
    }
    
    showToast('Приход оформлен ✓', 'success');
    state.receiveBatches = [];
    if ($('receiveSupplierSelect')) $('receiveSupplierSelect').value = '';
    if ($('commentInput')) $('commentInput').value = '';
    await loadProducts();
    renderReceiveBatches();
    loadMiniReport();
  } catch (e) {
    console.error('Receive error:', e);
    showToast('Ошибка: ' + e.message, 'error');
  }
}

async function submitReturn() {
  if (state.cart.length === 0) { showToast('Добавьте товары', 'error'); return; }
  if (!state.selectedSale) { showToast('Выберите продажу', 'error'); return; }
  
  const total = state.cart.reduce((s, i) => s + (i.original_price * i.qty), 0);
  
  try {
    const { data: refund } = await state.db.from('refunds').insert({
      company_id: CONFIG.COMPANY_ID,
      sale_id: state.selectedSale.id,
      total_amount: total,
      comment: getComment() || 'Возврат',
      operation_at: new Date().toISOString()
    }).select().single();
    
    for (const item of state.cart) {
      await state.db.from('refund_items').insert({
        refund_id: refund.id,
        product_id: item.id,
        quantity: item.qty,
        price: item.original_price
      });
      
      if (item.type === 'product') {
        await state.db.from('stock_movements').insert({
          company_id: CONFIG.COMPANY_ID,
          product_id: item.id,
          type: 'return',
          quantity: item.qty,
          price: item.purchase_price || 0,
          comment: `Возврат #${refund.id}`,
          operation_at: new Date().toISOString()
        });
      }
    }
    
    showToast('Возврат оформлен ✓', 'success');
    state.cart = [];
    state.selectedSale = null;
    $('returnSearchInput').value = '';
    $('returnResults').innerHTML = '';
    if ($('commentInput')) $('commentInput').value = '';
    await loadProducts();
    renderCart();
    loadMiniReport();
  } catch (e) {
    console.error('Return error:', e);
    showToast('Ошибка: ' + e.message, 'error');
  }
}

async function submitWriteoff() {
  if (state.cart.length === 0) { showToast('Добавьте товары', 'error'); return; }
  const comment = getComment() || 'Списание';
  
  try {
    for (const item of state.cart) {
      await state.db.from('stock_movements').insert({
        company_id: CONFIG.COMPANY_ID,
        product_id: item.id,
        type: 'writeoff',
        quantity: item.qty,
        price: item.purchase_price || 0,
        comment: comment,
        operation_at: new Date().toISOString()
      });
    }
    
    showToast('Списание ✓', 'success');
    state.cart = [];
    if ($('commentInput')) $('commentInput').value = '';
    await loadProducts();
    renderCart();
    loadMiniReport();
  } catch (e) {
    console.error('Writeoff error:', e);
    showToast('Ошибка: ' + e.message, 'error');
  }
}

async function submitSupplierReturn() {
  if (state.cart.length === 0) { showToast('Добавьте товары', 'error'); return; }
  
  const supId = $('supplierSelect')?.value;
  const comment = getComment() || 'Возврат поставщику';
  
  try {
    for (const item of state.cart) {
      await state.db.from('stock_movements').insert({
        company_id: CONFIG.COMPANY_ID,
        product_id: item.id,
        supplier_id: supId || null,
        type: 'supplier_return',
        quantity: item.qty,
        price: item.purchase_price || 0,
        comment: comment,
        operation_at: new Date().toISOString()
      });
    }
    
    showToast('Возврат поставщику ✓', 'success');
    state.cart = [];
    if ($('supplierSelect')) $('supplierSelect').value = '';
    if ($('commentInput')) $('commentInput').value = '';
    await loadProducts();
    renderCart();
    loadMiniReport();
  } catch (e) {
    console.error('Supplier return error:', e);
    showToast('Ошибка: ' + e.message, 'error');
  }
}

// PRODUCTS
function filterProducts() { renderProductsList(); }

function renderProductsList() {
  const list = $('productsList');
  const q = ($('productSearchInput')?.value || '').trim().toLowerCase();
  if (!list) return;
  
  const filtered = q ? state.products.filter(p => 
    p.name.toLowerCase().includes(q) || 
    (p.sku && p.sku.toLowerCase().includes(q)) || 
    (p.barcode && p.barcode.includes(q))
  ) : state.products;
  
  list.innerHTML = filtered.length === 0 ? '<div class="list-empty">Не найдено</div>' : '';
  filtered.forEach(p => {
    const d = document.createElement('div');
    d.className = 'list-item';
    d.innerHTML = `<div class="list-item-left"><div class="list-item-name">${p.name}</div><div class="list-item-meta">${p.type === 'service' ? '<span class="badge service">Услуга</span>' : ''}${p.sku || ''}</div></div><div class="list-item-right"><div class="list-item-price">${formatMoney(p.sale_price)}</div><div class="list-item-stock">${p.type === 'product' ? 'Ост: ' + p.available_qty + ' ' + p.unit : ''}</div></div>`;
    d.onclick = () => openEditProduct(p);
    list.appendChild(d);
  });
}

function openNewProduct(type = 'product') {
  $('productModalTitle').textContent = type === 'service' ? 'Новая услуга' : 'Новый товар';
  $('productId').value = '';
  $('productName').value = '';
  $('productSku').value = '';
  $('productBarcode').value = '';
  $('productType').value = type;
  $('productUnit').value = 'шт';
  $('productPurchasePrice').value = '';
  $('productSalePrice').value = '';
  $('productQty').value = '0';
  $('productQtyGroup').style.display = type === 'product' ? 'block' : 'none';
  $('productStatusGroup').style.display = 'none';
  $('deleteProductBtn').style.display = 'none';
  openModal('productModal');
}

function openEditProduct(p) {
  $('productModalTitle').textContent = 'Редактировать';
  $('productId').value = p.id;
  $('productName').value = p.name;
  $('productSku').value = p.sku || '';
  $('productBarcode').value = p.barcode || '';
  $('productType').value = p.type;
  $('productUnit').value = p.unit || 'шт';
  $('productPurchasePrice').value = p.purchase_price || '';
  $('productSalePrice').value = p.sale_price || '';
  $('productQtyGroup').style.display = 'none';
  $('productStatusGroup').style.display = 'block';
  $('productActive').value = p.active !== false ? 'true' : 'false';
  $('deleteProductBtn').style.display = 'block';
  openModal('productModal');
}

async function saveProduct() {
  const id = $('productId').value;
  const name = $('productName').value.trim();
  let sku = $('productSku').value.trim() || 'SKU-' + Date.now();
  const barcode = $('productBarcode').value.trim();
  const type = $('productType').value;
  const unit = $('productUnit').value;
  const pp = Number($('productPurchasePrice').value) || 0;
  const sp = Number($('productSalePrice').value) || 0;
  
  if (!name) { showToast('Укажите название', 'error'); return; }
  if (!sp) { showToast('Укажите цену', 'error'); return; }
  
  try {
    if (id) {
      const active = $('productActive').value === 'true';
      await state.db.from('products').update({
        name, sku, type, unit,
        purchase_price: pp,
        sale_price: sp,
        barcode: barcode || null,
        active
      }).eq('id', id);
      showToast('Обновлено ✓', 'success');
    } else {
      const qty = Number($('productQty').value) || 0;
      const { data } = await state.db.from('products').insert({
        company_id: CONFIG.COMPANY_ID,
        name, sku, type, unit,
        purchase_price: pp,
        sale_price: sp,
        barcode: barcode || null,
        active: true
      }).select().single();
      
      if (type === 'product' && qty > 0 && data) {
        await state.db.from('stock_movements').insert({
          company_id: CONFIG.COMPANY_ID,
          product_id: data.id,
          type: 'initial',
          quantity: qty,
          price: pp,
          comment: 'Начальный остаток',
          operation_at: new Date().toISOString()
        });
      }
      showToast('Создано ✓', 'success');
    }
    
    closeModal('productModal');
    await loadProducts();
    renderProductsList();
  } catch (e) {
    console.error('Save product error:', e);
    showToast('Ошибка: ' + e.message, 'error');
  }
}

async function deleteProduct() {
  const id = $('productId').value;
  if (!id || !confirm('Удалить?')) return;
  
  try {
    await state.db.from('products').update({ active: false }).eq('id', id);
    showToast('Удалено', 'success');
    closeModal('productModal');
    await loadProducts();
    renderProductsList();
  } catch (e) {
    showToast('Ошибка', 'error');
  }
}

// SUPPLIERS
function filterSuppliers() { renderSuppliersList(); }

function renderSuppliersList() {
  const list = $('suppliersList');
  const q = ($('supplierSearchInput')?.value || '').trim().toLowerCase();
  if (!list) return;
  
  const filtered = q ? state.suppliers.filter(s => 
    s.name.toLowerCase().includes(q) || 
    (s.phone && s.phone.includes(q))
  ) : state.suppliers;
  
  list.innerHTML = filtered.length === 0 ? '<div class="list-empty">Не найдено</div>' : '';
  filtered.forEach(s => {
    const d = document.createElement('div');
    d.className = 'list-item';
    d.innerHTML = `<div class="list-item-left"><div class="list-item-name">${s.name}</div><div class="list-item-meta">${s.phone || ''}${s.active === false ? ' <span class="badge inactive">Архив</span>' : ''}</div></div>`;
    d.onclick = () => openEditSupplier(s);
    list.appendChild(d);
  });
}

function openNewSupplier() {
  $('supplierModalTitle').textContent = 'Новый поставщик';
  $('supplierId').value = '';
  $('supplierName').value = '';
  $('supplierPhone').value = '';
  $('supplierComment').value = '';
  $('supplierStatusGroup').style.display = 'none';
  $('deleteSupplierBtn').style.display = 'none';
  openModal('supplierModal');
}

function openEditSupplier(s) {
  $('supplierModalTitle').textContent = 'Редактировать';
  $('supplierId').value = s.id;
  $('supplierName').value = s.name;
  $('supplierPhone').value = s.phone || '';
  $('supplierComment').value = s.comment || '';
  $('supplierStatusGroup').style.display = 'block';
  $('supplierActive').value = s.active !== false ? 'true' : 'false';
  $('deleteSupplierBtn').style.display = 'block';
  openModal('supplierModal');
}

async function saveSupplier() {
  const id = $('supplierId').value;
  const name = $('supplierName').value.trim();
  const phone = $('supplierPhone').value.trim();
  const comment = $('supplierComment').value.trim();
  
  if (!name) { showToast('Укажите название', 'error'); return; }
  
  try {
    if (id) {
      const active = $('supplierActive').value === 'true';
      await state.db.from('suppliers').update({
        name,
        phone: phone || null,
        comment: comment || null,
        active
      }).eq('id', id);
    } else {
      await state.db.from('suppliers').insert({
        company_id: CONFIG.COMPANY_ID,
        name,
        phone: phone || null,
        comment: comment || null,
        active: true
      });
    }
    
    showToast('Сохранено ✓', 'success');
    closeModal('supplierModal');
    await loadSuppliers();
    renderSuppliersList();
  } catch (e) {
    showToast('Ошибка', 'error');
  }
}

async function deleteSupplier() {
  const id = $('supplierId').value;
  if (!id || !confirm('Удалить?')) return;
  
  const { data } = await state.db.from('stock_movements').select('id').eq('supplier_id', id).limit(1);
  if (data && data.length > 0) {
    showToast('Есть операции, архивируем', 'error');
    $('supplierActive').value = 'false';
    return;
  }
  
  try {
    await state.db.from('suppliers').delete().eq('id', id);
    showToast('Удалено', 'success');
    closeModal('supplierModal');
    await loadSuppliers();
    renderSuppliersList();
  } catch (e) {
    await state.db.from('suppliers').update({ active: false }).eq('id', id);
    showToast('Архивировано', 'success');
    closeModal('supplierModal');
    await loadSuppliers();
    renderSuppliersList();
  }
}

// CLIENTS
function filterClients() { renderClientsList(); }

function renderClientsList() {
  const list = $('clientsList');
  const q = ($('clientSearchInput')?.value || '').trim().toLowerCase();
  if (!list) return;
  
  const filtered = q ? state.clients.filter(c => 
    c.name.toLowerCase().includes(q) || 
    (c.phone && c.phone.includes(q))
  ) : state.clients;
  
  list.innerHTML = filtered.length === 0 ? '<div class="list-empty">Не найдено</div>' : '';
  filtered.forEach(c => {
    const d = document.createElement('div');
    d.className = 'list-item';
    d.innerHTML = `<div class="list-item-left"><div class="list-item-name">${c.name}</div><div class="list-item-meta">${c.phone || ''}</div></div><div class="list-item-right"><button class="btn-small" onclick="event.stopPropagation();showClientHistory('${c.id}')">История</button></div>`;
    d.onclick = () => openEditClient(c);
    list.appendChild(d);
  });
}

function openNewClient() {
  $('clientModalTitle').textContent = 'Новый клиент';
  $('clientId').value = '';
  $('clientName').value = '';
  $('clientPhone').value = '';
  $('clientComment').value = '';
  $('deleteClientBtn').style.display = 'none';
  openModal('clientModal');
}

function openEditClient(c) {
  $('clientModalTitle').textContent = 'Редактировать';
  $('clientId').value = c.id;
  $('clientName').value = c.name;
  $('clientPhone').value = c.phone || '';
  $('clientComment').value = c.comment || '';
  $('deleteClientBtn').style.display = 'block';
  openModal('clientModal');
}

async function saveClient() {
  const id = $('clientId').value;
  const name = $('clientName').value.trim();
  const phone = $('clientPhone').value.trim();
  const comment = $('clientComment').value.trim();
  
  if (!name) { showToast('Укажите имя', 'error'); return; }
  
  try {
    if (id) {
      await state.db.from('clients').update({
        name,
        phone: phone || null,
        comment: comment || null
      }).eq('id', id);
    } else {
      await state.db.from('clients').insert({
        company_id: CONFIG.COMPANY_ID,
        name,
        phone: phone || null,
        comment: comment || null
      });
    }
    
    showToast('Сохранено ✓', 'success');
    closeModal('clientModal');
    await loadClients();
    renderClientsList();
  } catch (e) {
    showToast('Ошибка', 'error');
  }
}

async function deleteClient() {
  const id = $('clientId').value;
  if (!id || !confirm('Удалить?')) return;
  
  try {
    await state.db.from('clients').delete().eq('id', id);
    showToast('Удалено', 'success');
    closeModal('clientModal');
    await loadClients();
    renderClientsList();
  } catch (e) {
    showToast('Ошибка', 'error');
  }
}

async function showClientHistory(clientId) {
  // TODO: Implement client history
  showToast('Функция в разработке', 'info');
}

// EXPENSES
function showExpenseTab(tab) {
  const tabs = ['list', 'categories'];
  tabs.forEach(t => {
    const btn = document.querySelector(`[onclick*="showExpenseTab('${t}')"]`);
    const content = $(`expense${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (content) content.style.display = t === tab ? 'block' : 'none';
  });
  
  if (tab === 'list') loadExpenses();
  else if (tab === 'categories') renderCategories();
}

async function loadExpenses() {
  const from = $('expenseDateFrom')?.value;
  const to = $('expenseDateTo')?.value;
  if (!from || !to) return;
  
  try {
    const { data } = await state.db
      .from('expenses')
      .select('*, expense_categories(name)')
      .eq('company_id', CONFIG.COMPANY_ID)
      .gte('operation_at', from + 'T00:00:00')
      .lte('operation_at', to + 'T23:59:59')
      .order('operation_at', { ascending: false });
    
    const list = $('expensesList');
    if (!list) return;
    
    const expenses = data || [];
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    
    const totalEl = $('expensesTotal');
    if (totalEl) totalEl.textContent = formatMoney(total);
    
    list.innerHTML = expenses.length === 0 ? '<div class="list-empty">Нет расходов</div>' : '';
    expenses.forEach(e => {
      const d = document.createElement('div');
      d.className = 'list-item';
      d.innerHTML = `<div class="list-item-left"><div class="list-item-name">${e.expense_categories?.name || 'Расход'}</div><div class="list-item-meta">${formatDate(e.operation_at)}${e.comment ? ' | ' + e.comment : ''}</div></div><div class="list-item-right"><div class="list-item-price">${formatMoney(e.amount)}</div></div>`;
      list.appendChild(d);
    });
  } catch (e) {
    console.error('Load expenses:', e);
  }
}

function openNewExpense() {
  $('expenseModalTitle').textContent = 'Новый расход';
  $('expenseId').value = '';
  $('expenseAmount').value = '';
  $('expenseCategory').innerHTML = '<option value="">Категория</option>' + 
    state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  $('expensePaymentMethod').value = 'cash';
  $('expenseComment').value = '';
  openModal('expenseModal');
}

async function saveExpense() {
  const id = $('expenseId').value;
  const amount = Number($('expenseAmount').value);
  const categoryId = $('expenseCategory').value;
  const pm = $('expensePaymentMethod').value;
  const comment = $('expenseComment').value.trim();
  
  if (!amount || amount <= 0) { showToast('Укажите сумму', 'error'); return; }
  if (!categoryId) { showToast('Выберите категорию', 'error'); return; }
  
  try {
    await state.db.from('expenses').insert({
      company_id: CONFIG.COMPANY_ID,
      category_id: categoryId,
      amount,
      payment_method: pm,
      comment: comment || null,
      operation_at: new Date().toISOString()
    });
    
    showToast('Расход добавлен ✓', 'success');
    closeModal('expenseModal');
    loadExpenses();
  } catch (e) {
    showToast('Ошибка', 'error');
  }
}

function openNewCategory() {
  $('categoryModalTitle').textContent = 'Новая категория';
  $('categoryId').value = '';
  $('categoryName').value = '';
  $('deleteCategoryBtn').style.display = 'none';
  openModal('categoryModal');
}

async function saveCategory() {
  const id = $('categoryId').value;
  const name = $('categoryName').value.trim();
  
  if (!name) { showToast('Укажите название', 'error'); return; }
  
  try {
    if (id) {
      await state.db.from('expense_categories').update({ name }).eq('id', id);
    } else {
      await state.db.from('expense_categories').insert({
        company_id: CONFIG.COMPANY_ID,
        name
      });
    }
    
    showToast('Сохранено ✓', 'success');
    closeModal('categoryModal');
    await loadCategories();
    renderCategories();
  } catch (e) {
    showToast('Ошибка', 'error');
  }
}

function renderCategories() {
  const list = $('categoriesList');
  if (!list) return;
  
  list.innerHTML = state.categories.length === 0 ? '<div class="list-empty">Нет категорий</div>' : '';
  state.categories.forEach(c => {
    const d = document.createElement('div');
    d.className = 'list-item';
    d.innerHTML = `<div class="list-item-left"><div class="list-item-name">${c.name}</div></div>`;
    list.appendChild(d);
  });
}

// REPORTS
function showReportTab(tab) {
  const tabs = ['sales', 'products', 'stock'];
  tabs.forEach(t => {
    const btn = document.querySelector(`[onclick*="showReportTab('${t}')"]`);
    const content = $(`report${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (content) content.style.display = t === tab ? 'block' : 'none';
  });
}

async function loadReports() {
  // TODO: Implement reports
  showToast('Функция в разработке', 'info');
}

// MONEY
async function loadMoneyBalance() {
  try {
    const { data: salesData } = await state.db
      .from('sales')
      .select('total_amount, payment_method')
      .eq('company_id', CONFIG.COMPANY_ID)
      .eq('status', 'completed')
      .is('deleted_at', null);
    
    const { data: refundsData } = await state.db
      .from('refunds')
      .select('total_amount')
      .eq('company_id', CONFIG.COMPANY_ID)
      .is('deleted_at', null);
    
    const { data: expensesData } = await state.db
      .from('expenses')
      .select('amount, payment_method')
      .eq('company_id', CONFIG.COMPANY_ID);
    
    const sales = salesData || [];
    const refunds = refundsData || [];
    const expenses = expensesData || [];
    
    const cashSales = sales.filter(s => s.payment_method === 'cash').reduce((s, i) => s + Number(i.total_amount), 0);
    const cardSales = sales.filter(s => s.payment_method === 'card').reduce((s, i) => s + Number(i.total_amount), 0);
    const totalRefunds = refunds.reduce((s, i) => s + Number(i.total_amount), 0);
    const cashExpenses = expenses.filter(e => e.payment_method === 'cash').reduce((s, i) => s + Number(i.amount), 0);
    const cardExpenses = expenses.filter(e => e.payment_method === 'card').reduce((s, i) => s + Number(i.amount), 0);
    
    const cashBalance = cashSales - totalRefunds - cashExpenses;
    const cardBalance = cardSales - cardExpenses;
    const totalBalance = cashBalance + cardBalance;
    
    const cashEl = $('moneyCash');
    const cardEl = $('moneyCard');
    const totalEl = $('moneyTotal');
    
    if (cashEl) cashEl.textContent = formatMoney(cashBalance);
    if (cardEl) cardEl.textContent = formatMoney(cardBalance);
    if (totalEl) totalEl.textContent = formatMoney(totalBalance);
  } catch (e) {
    console.error('Load money balance:', e);
  }
}

async function saveInitialBalance() {
  const cash = Number($('initialCash')?.value) || 0;
  const card = Number($('initialCard')?.value) || 0;
  
  try {
    if (cash > 0) {
      await state.db.from('money_movements').insert({
        company_id: CONFIG.COMPANY_ID,
        type: 'deposit',
        amount: cash,
        payment_method: 'cash',
        comment: 'Начальный баланс',
        operation_at: new Date().toISOString()
      });
    }
    
    if (card > 0) {
      await state.db.from('money_movements').insert({
        company_id: CONFIG.COMPANY_ID,
        type: 'deposit',
        amount: card,
        payment_method: 'card',
        comment: 'Начальный баланс',
        operation_at: new Date().toISOString()
      });
    }
    
    showToast('Баланс установлен ✓', 'success');
    if ($('initialCash')) $('initialCash').value = '';
    if ($('initialCard')) $('initialCard').value = '';
    loadMoneyBalance();
  } catch (e) {
    showToast('Ошибка', 'error');
  }
}

function openMoneyOperation(type) {
  $('moneyModalTitle').textContent = type === 'deposit' ? 'Внесение' : 'Изъятие';
  $('moneyOperationType').value = type;
  $('moneyAmount').value = '';
  $('moneyPaymentMethod').value = 'cash';
  $('moneyComment').value = '';
  openModal('moneyModal');
}

async function saveMoneyOperation() {
  const type = $('moneyOperationType').value;
  const amt = Number($('moneyAmount').value);
  const pm = $('moneyPaymentMethod').value;
  const comment = $('moneyComment').value.trim();
  
  if (!amt || amt <= 0) { showToast('Укажите сумму', 'error'); return; }
  
  try {
    await state.db.from('money_movements').insert({
      company_id: CONFIG.COMPANY_ID,
      type,
      amount: type === 'deposit' ? amt : -amt,
      payment_method: pm,
      comment: comment || null,
      operation_at: new Date().toISOString()
    });
    
    showToast(type === 'deposit' ? 'Внесено ✓' : 'Изъято ✓', 'success');
    closeModal('moneyModal');
    loadMoneyBalance();
  } catch (e) {
    showToast('Ошибка', 'error');
  }
}

async function loadMoneyHistory() {
  const from = $('moneyDateFrom')?.value;
  const to = $('moneyDateTo')?.value;
  if (!from || !to) return;
  
  const [salesD, refD, expD] = await Promise.all([
    state.db.from('sales').select('*').eq('company_id', CONFIG.COMPANY_ID).eq('status', 'completed').is('deleted_at', null).gte('operation_at', from + 'T00:00:00').lte('operation_at', to + 'T23:59:59').order('operation_at', { ascending: false }),
    state.db.from('refunds').select('*').eq('company_id', CONFIG.COMPANY_ID).is('deleted_at', null).gte('operation_at', from + 'T00:00:00').lte('operation_at', to + 'T23:59:59').order('operation_at', { ascending: false }),
    state.db.from('expenses').select('*, expense_categories(name)').eq('company_id', CONFIG.COMPANY_ID).gte('operation_at', from + 'T00:00:00').lte('operation_at', to + 'T23:59:59').order('operation_at', { ascending: false })
  ]);
  
  const all = [];
  (salesD.data || []).forEach(s => all.push({ date: s.operation_at, desc: `Продажа (${s.payment_method === 'cash' ? 'Нал' : 'Безнал'})${s.comment ? ' | ' + s.comment : ''}`, amount: Number(s.total_amount), positive: true }));
  (refD.data || []).forEach(r => all.push({ date: r.operation_at, desc: `Возврат`, amount: Number(r.total_amount), positive: false }));
  (expD.data || []).forEach(e => all.push({ date: e.operation_at, desc: `${e.expense_categories?.name || 'Расход'}`, amount: Number(e.amount), positive: false }));
  
  all.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const list = $('moneyHistoryList');
  if (!list) return;
  
  list.innerHTML = all.length === 0 ? '<div class="list-empty">Нет операций</div>' : '';
  all.forEach(i => {
    const d = document.createElement('div');
    d.className = 'money-item';
    d.innerHTML = `<div class="money-item-left"><div class="money-item-date">${formatDate(i.date)}</div><div class="money-item-desc">${i.desc}</div></div><div class="money-item-amount ${i.positive ? 'positive' : 'negative'}">${i.positive ? '+' : '−'}${formatMoney(i.amount)}</div>`;
    list.appendChild(d);
  });
}

// IMPORT
function openImportModal() {
  $('importFile').value = '';
  $('importResults').innerHTML = '';
  openModal('importModal');
}

async function importProducts() {
  const file = $('importFile')?.files[0];
  if (!file) { showToast('Выберите файл', 'error'); return; }
  
  const res = $('importResults');
  res.innerHTML = '<div class="loading">Импорт...</div>';
  
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(1).filter(r => r.length > 0));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
    
    let added = 0, updated = 0, errors = 0;
    
    for (const row of data) {
      try {
        const type = (row[0] || '').toLowerCase().includes('услуга') ? 'service' : 'product';
        const name = row[1]?.toString().trim();
        if (!name) { errors++; continue; }
        
        const sku = row[2]?.toString().trim() || 'SKU-' + Date.now() + Math.random().toString(36).substr(2, 4);
        const qty = Number(row[3]) || 0;
        const pp = Number(row[4]) || 0;
        const sp = Number(row[5]) || 0;
        
        const { data: ex } = await state.db.from('products').select('id').eq('company_id', CONFIG.COMPANY_ID).or(`name.eq.${name},sku.eq.${sku}`).single();
        
        if (ex) {
          await state.db.from('products').update({ purchase_price: pp, sale_price: sp }).eq('id', ex.id);
          if (type === 'product' && qty > 0) {
            await state.db.from('stock_movements').insert({
              company_id: CONFIG.COMPANY_ID,
              product_id: ex.id,
              type: 'in',
              quantity: qty,
              price: pp,
              comment: 'Импорт',
              operation_at: new Date().toISOString()
            });
          }
          updated++;
        } else {
          const { data: np } = await state.db.from('products').insert({
            company_id: CONFIG.COMPANY_ID,
            name, sku, type,
            purchase_price: pp,
            sale_price: sp,
            unit: 'шт',
            active: true
          }).select().single();
          
          if (type === 'product' && qty > 0 && np) {
            await state.db.from('stock_movements').insert({
              company_id: CONFIG.COMPANY_ID,
              product_id: np.id,
              type: 'initial',
              quantity: qty,
              price: pp,
              comment: 'Импорт',
              operation_at: new Date().toISOString()
            });
          }
          added++;
        }
      } catch {
        errors++;
      }
    }
    
    res.innerHTML = `<div class="import-result success">✓ Добавлено: ${added}</div><div class="import-result info">↻ Обновлено: ${updated}</div>${errors > 0 ? `<div class="import-result error">✕ Ошибки: ${errors}</div>` : ''}`;
    await loadProducts();
    renderProductsList();
  } catch (e) {
    res.innerHTML = `<div class="import-result error">Ошибка: ${e.message}</div>`;
  }
}

// SCANNER
let scannerStream = null;

async function openScanner() {
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = $('scannerVideo');
    if (v) {
      v.srcObject = scannerStream;
      v.play();
    }
    $('scannerOverlay').classList.add('active');
  } catch {
    showToast('Нет камеры', 'error');
  }
}

function closeScanner() {
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
  }
  $('scannerOverlay').classList.remove('active');
}

// MODALS
function openModal(id) {
  const m = $(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = $(id);
  if (m) m.classList.remove('active');
}

// DELETE
function requestDelete(opId, opType) {
  $('deleteOperationId').value = opId;
  $('deleteOperationType').value = opType;
  $('adminPassword').value = '';
  openModal('adminPasswordModal');
}

async function confirmDelete() {
  const pw = $('adminPassword').value;
  const opId = $('deleteOperationId').value;
  const opType = $('deleteOperationType').value;
  
  if (pw !== CONFIG.ADMIN_PASSWORD) {
    showToast('Неверный пароль', 'error');
    return;
  }
  
  try {
    const table = { sale: 'sales', refund: 'refunds', movement: 'stock_movements' }[opType] || 'sales';
    await state.db.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', opId);
    showToast('Удалено', 'success');
    closeModal('adminPasswordModal');
    await loadProducts();
    loadMiniReport();
  } catch (e) {
    showToast('Ошибка', 'error');
  }
}

// INIT
window.addEventListener('DOMContentLoaded', initApp);

// EXPORTS
window.showSection = showSection;
window.setMode = setMode;
window.changePeriod = changePeriod;
window.submitOperation = submitOperation;
window.changeSaleQty = changeSaleQty;
window.changeSimpleQty = changeSimpleQty;
window.changeReturnQty = changeReturnQty;
window.setReceiveQty = setReceiveQty;
window.setReceiveCost = setReceiveCost;
window.removeReceiveBatch = removeReceiveBatch;
window.clearReturnSelection = clearReturnSelection;
window.openNewProduct = openNewProduct;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.filterProducts = filterProducts;
window.openNewSupplier = openNewSupplier;
window.saveSupplier = saveSupplier;
window.deleteSupplier = deleteSupplier;
window.filterSuppliers = filterSuppliers;
window.openNewClient = openNewClient;
window.saveClient = saveClient;
window.deleteClient = deleteClient;
window.filterClients = filterClients;
window.showClientHistory = showClientHistory;
window.showExpenseTab = showExpenseTab;
window.loadExpenses = loadExpenses;
window.openNewExpense = openNewExpense;
window.saveExpense = saveExpense;
window.openNewCategory = openNewCategory;
window.saveCategory = saveCategory;
window.renderCategories = renderCategories;
window.showReportTab = showReportTab;
window.loadReports = loadReports;
window.loadMoneyBalance = loadMoneyBalance;
window.loadMoneyHistory = loadMoneyHistory;
window.saveInitialBalance = saveInitialBalance;
window.openMoneyOperation = openMoneyOperation;
window.saveMoneyOperation = saveMoneyOperation;
window.openImportModal = openImportModal;
window.importProducts = importProducts;
window.openScanner = openScanner;
window.closeScanner = closeScanner;
window.openModal = openModal;
window.closeModal = closeModal;
window.requestDelete = requestDelete;
window.confirmDelete = confirmDelete;
