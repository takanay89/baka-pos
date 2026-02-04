 []; state.selectedSale = null;
    $("returnSearchInput").value = ""; $("returnResults").innerHTML = ""; if ($("commentInput")) $("commentInput").value = "";
    await loadProducts(); renderCart(); loadMiniReport();
  } catch (e) { console.error("Return:", e); showToast("Ошибка: " + e.message, "error"); }
}

async function submitWriteoff() {
  if (state.cart.length === 0) { showToast("Добавьте товары", "error"); return; }
  const comment = getComment() || "Списание";
  try {
    for (const i of state.cart) await state.db.from("stock_movements").insert({ company_id: CONFIG.COMPANY_ID, product_id: i.id, type: "writeoff", quantity: i.qty, price: i.purchase_price || 0, comment: comment, operation_at: new Date().toISOString() });
    showToast("Списание ✓", "success");
    state.cart = []; if ($("commentInput")) $("commentInput").value = "";
    await loadProducts(); renderCart(); loadMiniReport();
  } catch (e) { console.error("Writeoff:", e); showToast("Ошибка: " + e.message, "error"); }
}

async function submitSupplierReturn() {
  if (state.cart.length === 0) { showToast("Добавьте товары", "error"); return; }
  const supId = $("supplierSelect")?.value, comment = getComment() || "Возврат поставщику";
  try {
    for (const i of state.cart) await state.db.from("stock_movements").insert({ company_id: CONFIG.COMPANY_ID, product_id: i.id, supplier_id: supId || null, type: "supplier_return", quantity: i.qty, price: i.purchase_price || 0, comment: comment, operation_at: new Date().toISOString() });
    showToast("Возврат поставщику ✓", "success");
    state.cart = []; $("supplierSelect").value = ""; if ($("commentInput")) $("commentInput").value = "";
    await loadProducts(); renderCart(); loadMiniReport();
  } catch (e) { console.error("Supplier return:", e); showToast("Ошибка: " + e.message, "error"); }
}

// PRODUCTS
function filterProducts() { renderProductsList(); }
function renderProductsList() {
  const list = $("productsList"), q = ($("productSearchInput")?.value || "").trim().toLowerCase();
  if (!list) return;
  const filtered = q ? state.products.filter(p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)) || (p.barcode && p.barcode.includes(q))) : state.products;
  list.innerHTML = filtered.length === 0 ? '<div class="list-empty">Не найдено</div>' : "";
  filtered.forEach(p => {
    const d = document.createElement("div"); d.className = "list-item";
    d.innerHTML = `<div class="list-item-left"><div class="list-item-name">${p.name}</div><div class="list-item-meta">${p.type==='service'?'<span class="badge service">Услуга</span>':''}${p.sku||''}</div></div><div class="list-item-right"><div class="list-item-price">${formatMoney(p.sale_price)}</div><div class="list-item-stock">${p.type==='product'?'Ост: '+p.available_qty+' '+p.unit:''}</div></div>`;
    d.onclick = () => openEditProduct(p);
    list.appendChild(d);
  });
}

function openNewProduct(type='product') {
  $("productModalTitle").textContent = type === 'service' ? "Новая услуга" : "Новый товар";
  $("productId").value = ""; $("productName").value = ""; $("productSku").value = ""; $("productBarcode").value = "";
  $("productType").value = type; $("productUnit").value = "шт"; $("productPurchasePrice").value = ""; $("productSalePrice").value = ""; $("productQty").value = "0";
  $("productQtyGroup").style.display = type === 'product' ? "block" : "none";
  $("productStatusGroup").style.display = "none"; $("deleteProductBtn").style.display = "none";
  openModal("productModal");
}

function openEditProduct(p) {
  $("productModalTitle").textContent = "Редактировать";
  $("productId").value = p.id; $("productName").value = p.name; $("productSku").value = p.sku || ""; $("productBarcode").value = p.barcode || "";
  $("productType").value = p.type; $("productUnit").value = p.unit || "шт"; $("productPurchasePrice").value = p.purchase_price || ""; $("productSalePrice").value = p.sale_price || "";
  $("productQtyGroup").style.display = "none"; $("productStatusGroup").style.display = "block";
  $("productActive").value = p.active !== false ? "true" : "false"; $("deleteProductBtn").style.display = "block";
  openModal("productModal");
}

async function saveProduct() {
  const id = $("productId").value, name = $("productName").value.trim();
  let sku = $("productSku").value.trim() || 'SKU-' + Date.now();
  const barcode = $("productBarcode").value.trim(), type = $("productType").value, unit = $("productUnit").value;
  const pp = Number($("productPurchasePrice").value) || 0, sp = Number($("productSalePrice").value) || 0;
  if (!name) { showToast("Укажите название", "error"); return; }
  if (!sp) { showToast("Укажите цену", "error"); return; }
  try {
    if (id) {
      const active = $("productActive").value === "true";
      await state.db.from("products").update({ name, sku, type, unit, purchase_price: pp, sale_price: sp, barcode: barcode || null, active }).eq("id", id);
      showToast("Обновлено ✓", "success");
    } else {
      const qty = Number($("productQty").value) || 0;
      const { data } = await state.db.from("products").insert({ company_id: CONFIG.COMPANY_ID, name, sku, type, unit, purchase_price: pp, sale_price: sp, barcode: barcode || null, active: true }).select().single();
      if (type === 'product' && qty > 0 && data) await state.db.from("stock_movements").insert({ company_id: CONFIG.COMPANY_ID, product_id: data.id, type: "initial", quantity: qty, price: pp, comment: "Начальный остаток", operation_at: new Date().toISOString() });
      showToast("Создано ✓", "success");
    }
    closeModal("productModal"); await loadProducts(); renderProductsList();
  } catch (e) { console.error("Save product:", e); showToast("Ошибка: " + e.message, "error"); }
}

async function deleteProduct() {
  const id = $("productId").value; if (!id || !confirm("Удалить?")) return;
  try { await state.db.from("products").update({ active: false }).eq("id", id); showToast("Удалено", "success"); closeModal("productModal"); await loadProducts(); renderProductsList(); }
  catch (e) { showToast("Ошибка", "error"); }
}

// SUPPLIERS
function filterSuppliers() { renderSuppliersList(); }
function renderSuppliersList() {
  const list = $("suppliersList"), q = ($("supplierSearchInput")?.value || "").trim().toLowerCase();
  if (!list) return;
  const filtered = q ? state.suppliers.filter(s => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))) : state.suppliers;
  list.innerHTML = filtered.length === 0 ? '<div class="list-empty">Не найдено</div>' : "";
  filtered.forEach(s => {
    const d = document.createElement("div"); d.className = "list-item";
    d.innerHTML = `<div class="list-item-left"><div class="list-item-name">${s.name}</div><div class="list-item-meta">${s.phone||''}${s.active===false?' <span class="badge inactive">Архив</span>':''}</div></div>`;
    d.onclick = () => openEditSupplier(s);
    list.appendChild(d);
  });
}

function openNewSupplier() {
  $("supplierModalTitle").textContent = "Новый поставщик";
  $("supplierId").value = ""; $("supplierName").value = ""; $("supplierPhone").value = ""; $("supplierComment").value = "";
  $("supplierStatusGroup").style.display = "none"; $("deleteSupplierBtn").style.display = "none";
  openModal("supplierModal");
}

function openEditSupplier(s) {
  $("supplierModalTitle").textContent = "Редактировать";
  $("supplierId").value = s.id; $("supplierName").value = s.name; $("supplierPhone").value = s.phone || ""; $("supplierComment").value = s.comment || "";
  $("supplierStatusGroup").style.display = "block"; $("supplierActive").value = s.active !== false ? "true" : "false"; $("deleteSupplierBtn").style.display = "block";
  openModal("supplierModal");
}

async function saveSupplier() {
  const id = $("supplierId").value, name = $("supplierName").value.trim(), phone = $("supplierPhone").value.trim(), comment = $("supplierComment").value.trim();
  if (!name) { showToast("Укажите название", "error"); return; }
  try {
    if (id) { const active = $("supplierActive").value === "true"; await state.db.from("suppliers").update({ name, phone: phone || null, comment: comment || null, active }).eq("id", id); }
    else await state.db.from("suppliers").insert({ company_id: CONFIG.COMPANY_ID, name, phone: phone || null, comment: comment || null, active: true });
    showToast("Сохранено ✓", "success"); closeModal("supplierModal"); await loadSuppliers(); renderSuppliersList();
  } catch (e) { showToast("Ошибка", "error"); }
}

async function deleteSupplier() {
  const id = $("supplierId").value; if (!id || !confirm("Удалить?")) return;
  const { data } = await state.db.from("stock_movements").select("id").eq("supplier_id", id).limit(1);
  if (data && data.length > 0) { showToast("Есть операции, архивируем", "error"); $("supplierActive").value = "false"; return; }
  try { await state.db.from("suppliers").delete().eq("id", id); showToast("Удалено", "success"); closeModal("supplierModal"); await loadSuppliers(); renderSuppliersList(); }
  catch (e) { await state.db.from("suppliers").update({ active: false }).eq("id", id); showToast("Архивировано", "success"); closeModal("supplierModal"); await loadSuppliers(); renderSuppliersList(); }
}

// CLIENTS
function filterClients() { renderClientsList(); }
function renderClientsList() {
  const list = $("clientsList"), q = ($("clientSearchInput")?.value || "").trim().toLowerCase();
  if (!list) return;
  const filtered = q ? state.clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))) : state.clients;
  list.innerHTML = filtered.length === 0 ? '<div class="list-empty">Не найдено</div>' : "";
  filtered.forEach(c => {
    const d = document.createElement("div"); d.className = "list-item";
    d.innerHTML = `<div class="list-item-left"><div class="list-item-name">${c.name}</div><div class="list-item-meta">${c.phone||''}</div></div><div class="list-item-right"><button class="btn-small" onclick="event.stopPropagation();showClientHistory('${c.id}')">История</button></div>`;
    d.onclick = () => openEditClient(c);
    list.appendChild(d);
  });
}

function openNewClient() {
  $("clientModalTitle").textContent = "Новый клиент";
  $("clientId").value = ""; $("clientName").value = ""; $("clientPhone").value = ""; $("clientComment").value = "";
  $("deleteClientBtn").style.display = "none";
  openModal("clientModal");
}

function openEditClient(c) {
  $("clientModalTitle").textContent = "Редактировать";
  $("clientId").value = c.id; $("clientName").value = c.name; $("clientPhone").value = c.phone || ""; $("clientComment").value = c.comment || "";
  $("deleteClientBtn").style.display = "block";
  openModal("clientModal");
}

async function saveClient() {
  const id = $("clientId").value, name = $("clientName").value.trim(), phone = $("clientPhone").value.trim(), comment = $("clientComment").value.trim();
  if (!name) { showToast("Укажите имя", "error"); return; }
  try {
    if (id) await state.db.from("clients").update({ name, phone: phone || null, comment: comment || null }).eq("id", id);
    else await state.db.from("clients").insert({ company_id: CONFIG.COMPANY_ID, name, phone: phone || null, comment: comment || null });
    showToast("Сохранено ✓", "success"); closeModal("clientModal"); await loadClients(); renderClientsList();
  } catch (e) { showToast("Ошибка", "error"); }
}

async function deleteClient() {
  const id = $("clientId").value; if (!id || !confirm("Удалить?")) return;
  try { await state.db.from("clients").delete().eq("id", id); showToast("Удалено", "success"); closeModal("clientModal"); await loadClients(); renderClientsList(); }
  catch (e) { showToast("Ошибка", "error"); }
}

async function showClientHistory(clientId) {
  const c = state.clients.find(x => x.id === clientId); if (!c) return;
  $("clientHistoryTitle").textContent = `История: ${c.name}`;
  const { data } = await state.db.from("sales").select("*").eq("company_id", CONFIG.COMPANY_ID).eq("client", c.name).order("operation_at", { ascending: false }).limit(50);
  const content = $("clientHistoryContent");
  if (!data || data.length === 0) { content.innerHTML = '<div class="list-empty">Нет покупок</div>'; }
  else {
    let total = data.reduce((s, x) => s + Number(x.total_amount || 0), 0);
    content.innerHTML = `<div class="history-summary"><strong>Покупок:</strong> ${data.length} | <strong>На сумму:</strong> ${formatMoney(total)}</div>` +
      data.map(s => `<div class="history-item"><div>${formatDate(s.operation_at)}</div><div>${formatMoney(s.total_amount)}</div></div>`).join('');
  }
  openModal("clientHistoryModal");
}

// EXPENSES
function showExpenseTab(tab) {
  $$('#section-expenses .tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`#section-expenses .tabs .tab[onclick*="'${tab}'"]`)?.classList.add('active');
  $("expensesListCard").style.display = tab === 'list' ? "block" : "none";
  $("expenseCategoriesCard").style.display = tab === 'categories' ? "block" : "none";
  if (tab === 'list') loadExpenses(); else renderCategories();
}

async function loadExpenses() {
  const from = $("expenseDateFrom")?.value, to = $("expenseDateTo")?.value, cat = $("expenseCategoryFilter")?.value;
  if (!from || !to) return;
  let query = state.db.from("expenses").select("*, expense_categories(name, color)").eq("company_id", CONFIG.COMPANY_ID).gte("operation_at", from+"T00:00:00").lte("operation_at", to+"T23:59:59").order("operation_at", { ascending: false });
  if (cat) query = query.eq("category_id", cat);
  const { data } = await query;
  const list = $("expensesList");
  list.innerHTML = (!data || data.length === 0) ? '<div class="list-empty">Нет расходов</div>' : "";
  (data || []).forEach(e => {
    const d = document.createElement("div"); d.className = "expense-item";
    d.innerHTML = `<div class="expense-left"><span class="expense-category" style="background:${e.expense_categories?.color||'#666'}">${e.expense_categories?.name||'Без категории'}</span><div class="expense-desc">${e.description||'Расход'}</div><div class="expense-date">${formatDate(e.operation_at)}</div></div><div class="expense-amount">-${formatMoney(e.amount)}</div>`;
    list.appendChild(d);
  });
}

function openNewExpense() { $("expenseCategory").value = ""; $("expenseAmount").value = ""; $("expenseDescription").value = ""; $("expensePaymentMethod").value = "cash"; openModal("expenseModal"); }

async function saveExpense() {
  const cat = $("expenseCategory").value, amt = Number($("expenseAmount").value), desc = $("expenseDescription").value.trim(), pm = $("expensePaymentMethod").value;
  if (!cat) { showToast("Выберите категорию", "error"); return; }
  if (!amt || amt <= 0) { showToast("Укажите сумму", "error"); return; }
  try {
    await state.db.from("expenses").insert({ company_id: CONFIG.COMPANY_ID, category_id: cat, amount: amt, payment_method: pm, description: desc || null, operation_at: new Date().toISOString() });
    showToast("Расход добавлен ✓", "success"); closeModal("expenseModal"); loadExpenses();
  } catch (e) { showToast("Ошибка", "error"); }
}

function renderCategories() {
  const list = $("categoriesList"); if (!list) return;
  list.innerHTML = state.expenseCategories.length === 0 ? '<div class="list-empty">Нет категорий</div>' : "";
  state.expenseCategories.forEach(c => {
    const d = document.createElement("div"); d.className = "category-item";
    d.innerHTML = `<div class="category-color" style="background:${c.color}"></div><span class="category-name">${c.name}</span>`;
    list.appendChild(d);
  });
}

function openNewCategory() { $("categoryName").value = ""; $("categoryColor").value = "#ef4444"; openModal("categoryModal"); }

async function saveCategory() {
  const name = $("categoryName").value.trim(), color = $("categoryColor").value;
  if (!name) { showToast("Укажите название", "error"); return; }
  try {
    await state.db.from("expense_categories").insert({ company_id: CONFIG.COMPANY_ID, name, color });
    showToast("Создано ✓", "success"); closeModal("categoryModal"); await loadExpenseCategories(); renderCategories();
  } catch (e) { showToast("Ошибка", "error"); }
}

// REPORTS
function showReportTab(tab) {
  state.currentReportTab = tab;
  $$('#section-reports .tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`#section-reports .tabs .tab[onclick*="'${tab}'"]`)?.classList.add('active');
  loadReports();
}

async function loadReports() {
  const from = $("reportDateFrom")?.value, to = $("reportDateTo")?.value;
  if (!from || !to) return;
  const content = $("reportContent"); if (!content) return;
  try {
    const [salesD, expD, woD, refD] = await Promise.all([
      state.db.from("sales").select("*, sale_items(quantity, price, cost_price, products(name))").eq("company_id", CONFIG.COMPANY_ID).eq("status", "completed").is("deleted_at", null).gte("operation_at", from+"T00:00:00").lte("operation_at", to+"T23:59:59"),
      state.db.from("expenses").select("*, expense_categories(name)").eq("company_id", CONFIG.COMPANY_ID).gte("operation_at", from+"T00:00:00").lte("operation_at", to+"T23:59:59"),
      state.db.from("stock_movements").select("*").eq("company_id", CONFIG.COMPANY_ID).eq("type", "writeoff").is("deleted_at", null).gte("operation_at", from+"T00:00:00").lte("operation_at", to+"T23:59:59"),
      state.db.from("refunds").select("*").eq("company_id", CONFIG.COMPANY_ID).is("deleted_at", null).gte("operation_at", from+"T00:00:00").lte("operation_at", to+"T23:59:59")
    ]);
    const sales = salesD.data || [], expenses = expD.data || [], writeoffs = woD.data || [], refunds = refD.data || [];
    let revenue = 0, cost = 0, itemsSold = 0;
    sales.forEach(s => (s.sale_items || []).forEach(i => { const q = Number(i.quantity)||0, p = Number(i.price)||0, c = Number(i.cost_price)||0; revenue += p*q; cost += c*q; itemsSold += q; }));
    const grossProfit = revenue - cost;
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount||0), 0);
    const totalWriteoffs = writeoffs.reduce((s, w) => s + (Number(w.price||0)*Number(w.quantity||0)), 0);
    const totalRefunds = refunds.reduce((s, r) => s + Number(r.total_amount||0), 0);
    const netProfit = grossProfit - totalExpenses - totalWriteoffs;
    
    if (state.currentReportTab === 'summary') {
      content.innerHTML = `<div class="stats-grid"><div class="stat-card green"><div class="stat-label">Выручка</div><div class="stat-value">${formatMoney(revenue)}</div></div><div class="stat-card red"><div class="stat-label">Возвраты</div><div class="stat-value">-${formatMoney(totalRefunds)}</div></div><div class="stat-card orange"><div class="stat-label">Расходы</div><div class="stat-value">-${formatMoney(totalExpenses)}</div></div></div><div class="card"><div class="card-title">Динамика</div><canvas id="salesChart" height="200"></canvas></div><div class="stats-grid"><div class="stat-card blue"><div class="stat-label">Валовая прибыль</div><div class="stat-value">${formatMoney(grossProfit)}</div></div><div class="stat-card purple"><div class="stat-label">Чистая прибыль</div><div class="stat-value">${formatMoney(netProfit)}</div></div><div class="stat-card teal"><div class="stat-label">Продано</div><div class="stat-value">${itemsSold}</div></div></div>`;
      renderSalesChart(sales);
    } else if (state.currentReportTab === 'bydays') {
      const byDate = {}; sales.forEach(s => { const d = s.operation_at.split('T')[0]; if (!byDate[d]) byDate[d] = { count: 0, amount: 0 }; byDate[d].count++; byDate[d].amount += Number(s.total_amount||0); });
      const dates = Object.keys(byDate).sort().reverse();
      content.innerHTML = `<div class="card"><div class="card-title">По дням</div><table class="report-table"><thead><tr><th>Дата</th><th>Продаж</th><th>Сумма</th></tr></thead><tbody>${dates.map(d => `<tr><td>${new Date(d).toLocaleDateString("ru-RU")}</td><td>${byDate[d].count}</td><td>${formatMoney(byDate[d].amount)}</td></tr>`).join('')}</tbody></table></div>`;
    } else if (state.currentReportTab === 'byproducts') {
      const byProd = {}; sales.forEach(s => (s.sale_items||[]).forEach(i => { const n = i.products?.name||'?'; if (!byProd[n]) byProd[n] = { qty: 0, amount: 0 }; byProd[n].qty += Number(i.quantity)||0; byProd[n].amount += (Number(i.price)||0)*(Number(i.quantity)||0); }));
      const sorted = Object.entries(byProd).sort((a,b) => b[1].amount - a[1].amount);
      content.innerHTML = `<div class="card"><div class="card-title">ТОП товаров</div><table class="report-table"><thead><tr><th>#</th><th>Товар</th><th>Кол-во</th><th>Сумма</th></tr></thead><tbody>${sorted.slice(0,20).map(([n,d],i) => `<tr><td>${i+1}</td><td>${n}</td><td>${d.qty}</td><td>${formatMoney(d.amount)}</td></tr>`).join('')}</tbody></table></div>`;
    } else if (state.currentReportTab === 'money') {
      let cashIn = 0, cardIn = 0, cashOut = 0, cardOut = 0;
      sales.forEach(s => { const a = Number(s.total_amount)||0; if (s.payment_method === 'cash') cashIn += a; else cardIn += a; });
      refunds.forEach(r => { const a = Number(r.total_amount)||0; if (r.payment_method === 'cash') cashOut += a; else cardOut += a; });
      expenses.forEach(e => { const a = Number(e.amount)||0; if (e.payment_method === 'cash') cashOut += a; else cardOut += a; });
      content.innerHTML = `<div class="stats-grid"><div class="stat-card green"><div class="stat-label">Нал +</div><div class="stat-value">${formatMoney(cashIn)}</div></div><div class="stat-card blue"><div class="stat-label">Безнал +</div><div class="stat-value">${formatMoney(cardIn)}</div></div></div><div class="stats-grid"><div class="stat-card red"><div class="stat-label">Нал −</div><div class="stat-value">-${formatMoney(cashOut)}</div></div><div class="stat-card orange"><div class="stat-label">Безнал −</div><div class="stat-value">-${formatMoney(cardOut)}</div></div></div><div class="stats-grid"><div class="stat-card purple"><div class="stat-label">Итого нал</div><div class="stat-value">${formatMoney(cashIn-cashOut)}</div></div><div class="stat-card teal"><div class="stat-label">Итого безнал</div><div class="stat-value">${formatMoney(cardIn-cardOut)}</div></div></div>`;
    } else if (state.currentReportTab === 'pnl') {
      const byCat = {}; expenses.forEach(e => { const c = e.expense_categories?.name||'Прочие'; if (!byCat[c]) byCat[c] = 0; byCat[c] += Number(e.amount)||0; });
      content.innerHTML = `<div class="card"><div class="card-title">Прибыль и убытки</div><table class="report-table pnl-table"><tr class="pnl-row income"><td>Выручка</td><td class="pnl-amount">${formatMoney(revenue)}</td></tr><tr class="pnl-row"><td>− Себестоимость</td><td class="pnl-amount">-${formatMoney(cost)}</td></tr><tr class="pnl-row subtotal"><td><strong>= Валовая прибыль</strong></td><td class="pnl-amount"><strong>${formatMoney(grossProfit)}</strong></td></tr><tr class="pnl-row section-header"><td colspan="2">Расходы:</td></tr>${Object.entries(byCat).map(([c,a]) => `<tr class="pnl-row expense"><td>− ${c}</td><td class="pnl-amount">-${formatMoney(a)}</td></tr>`).join('')}<tr class="pnl-row expense"><td>− Списания</td><td class="pnl-amount">-${formatMoney(totalWriteoffs)}</td></tr><tr class="pnl-row total"><td><strong>= Чистая прибыль</strong></td><td class="pnl-amount ${netProfit>=0?'positive':'negative'}"><strong>${formatMoney(netProfit)}</strong></td></tr></table></div>`;
    } else if (state.currentReportTab === 'history') {
      const all = [...sales.map(s => ({ type: 'sale', date: s.operation_at, amount: s.total_amount })), ...expenses.map(e => ({ type: 'expense', date: e.operation_at, amount: -e.amount })), ...refunds.map(r => ({ type: 'refund', date: r.operation_at, amount: -r.total_amount })), ...writeoffs.map(w => ({ type: 'writeoff', date: w.operation_at, amount: 0 }))].sort((a,b) => new Date(b.date) - new Date(a.date));
      const labels = { sale: '💰 Продажа', expense: '💸 Расход', refund: '↩️ Возврат', writeoff: '📦 Списание' };
      content.innerHTML = `<div class="card"><div class="card-title">История</div><div class="history-list">${all.slice(0,100).map(o => `<div class="history-row ${o.type}"><div class="history-type">${labels[o.type]}</div><div class="history-date">${formatDate(o.date)}</div><div class="history-amount ${o.amount>=0?'positive':'negative'}">${o.amount!==0?(o.amount>=0?'+':'')+formatMoney(Math.abs(o.amount)):'—'}</div></div>`).join('')}</div></div>`;
    }
  } catch (e) { console.error("Reports:", e); }
}

function renderSalesChart(sales) {
  const canvas = $("salesChart"); if (!canvas) return;
  if (state.salesChart) state.salesChart.destroy();
  const daily = {}; sales.forEach(s => { const d = s.operation_at.split('T')[0]; if (!daily[d]) daily[d] = 0; daily[d] += Number(s.total_amount||0); });
  const labels = Object.keys(daily).sort();
  const data = labels.map(l => daily[l]);
  state.salesChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels: labels.map(l => new Date(l).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })), datasets: [{ label: 'Продажи', data, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
  });
}

// MONEY
async function loadMoneyBalance() {
  const [salesD, refD, expD, srD] = await Promise.all([
    state.db.from("sales").select("total_amount, payment_method").eq("company_id", CONFIG.COMPANY_ID).eq("status", "completed").is("deleted_at", null),
    state.db.from("refunds").select("total_amount, payment_method").eq("company_id", CONFIG.COMPANY_ID).is("deleted_at", null),
    state.db.from("expenses").select("amount, payment_method").eq("company_id", CONFIG.COMPANY_ID),
    state.db.from("stock_movements").select("quantity, price").eq("company_id", CONFIG.COMPANY_ID).eq("type", "supplier_return").is("deleted_at", null)
  ]);
  let cashBal = 0, cardBal = 0;
  (salesD.data||[]).forEach(s => { const a = Number(s.total_amount)||0; if (s.payment_method === 'cash') cashBal += a; else cardBal += a; });
  (refD.data||[]).forEach(r => { const a = Number(r.total_amount)||0; if (r.payment_method === 'cash') cashBal -= a; else cardBal -= a; });
  (expD.data||[]).forEach(e => { const a = Number(e.amount)||0; if (e.payment_method === 'cash') cashBal -= a; else cardBal -= a; });
  (srD.data||[]).forEach(sr => { cashBal += (Number(sr.price)||0)*(Number(sr.quantity)||0); });
  $("balanceCash").textContent = formatMoney(cashBal);
  $("balanceCard").textContent = formatMoney(cardBal);
  $("balanceTotal").textContent = formatMoney(cashBal + cardBal);
}

async function saveInitialBalance() { showToast("Баланс обновлён", "success"); loadMoneyBalance(); }

function openMoneyOperation(type) {
  $("moneyModalTitle").textContent = type === 'deposit' ? "Внесение" : "Изъятие";
  $("moneyOperationType").value = type; $("moneyAmount").value = ""; $("moneyPaymentMethod").value = "cash"; $("moneyComment").value = "";
  openModal("moneyModal");
}

async function saveMoneyOperation() {
  const type = $("moneyOperationType").value, amt = Number($("moneyAmount").value), pm = $("moneyPaymentMethod").value, comment = $("moneyComment").value.trim();
  if (!amt || amt <= 0) { showToast("Укажите сумму", "error"); return; }
  try {
    await state.db.from("money_movements").insert({ company_id: CONFIG.COMPANY_ID, type, amount: type === 'deposit' ? amt : -amt, payment_method: pm, comment: comment || null, operation_at: new Date().toISOString() });
    showToast(type === 'deposit' ? "Внесено ✓" : "Изъято ✓", "success"); closeModal("moneyModal"); loadMoneyBalance();
  } catch (e) { showToast("Ошибка", "error"); }
}

async function loadMoneyHistory() {
  const from = $("moneyDateFrom")?.value, to = $("moneyDateTo")?.value; if (!from || !to) return;
  const [salesD, refD, expD] = await Promise.all([
    state.db.from("sales").select("*").eq("company_id", CONFIG.COMPANY_ID).eq("status", "completed").is("deleted_at", null).gte("operation_at", from+"T00:00:00").lte("operation_at", to+"T23:59:59").order("operation_at", { ascending: false }),
    state.db.from("refunds").select("*").eq("company_id", CONFIG.COMPANY_ID).is("deleted_at", null).gte("operation_at", from+"T00:00:00").lte("operation_at", to+"T23:59:59").order("operation_at", { ascending: false }),
    state.db.from("expenses").select("*, expense_categories(name)").eq("company_id", CONFIG.COMPANY_ID).gte("operation_at", from+"T00:00:00").lte("operation_at", to+"T23:59:59").order("operation_at", { ascending: false })
  ]);
  const all = [];
  (salesD.data||[]).forEach(s => all.push({ date: s.operation_at, desc: `Продажа (${s.payment_method==='cash'?'Нал':'Безнал'})${s.comment?' | '+s.comment:''}`, amount: Number(s.total_amount), positive: true }));
  (refD.data||[]).forEach(r => all.push({ date: r.operation_at, desc: `Возврат`, amount: Number(r.total_amount), positive: false }));
  (expD.data||[]).forEach(e => all.push({ date: e.operation_at, desc: `${e.expense_categories?.name||'Расход'}`, amount: Number(e.amount), positive: false }));
  all.sort((a,b) => new Date(b.date) - new Date(a.date));
  const list = $("moneyHistoryList");
  list.innerHTML = all.length === 0 ? '<div class="list-empty">Нет операций</div>' : "";
  all.forEach(i => {
    const d = document.createElement("div"); d.className = "money-item";
    d.innerHTML = `<div class="money-item-left"><div class="money-item-date">${formatDate(i.date)}</div><div class="money-item-desc">${i.desc}</div></div><div class="money-item-amount ${i.positive?'positive':'negative'}">${i.positive?'+':'−'}${formatMoney(i.amount)}</div>`;
    list.appendChild(d);
  });
}

// IMPORT
function openImportModal() { $("importFile").value = ""; $("importResults").innerHTML = ""; openModal("importModal"); }

async function importProducts() {
  const file = $("importFile")?.files[0]; if (!file) { showToast("Выберите файл", "error"); return; }
  const res = $("importResults"); res.innerHTML = '<div class="loading">Импорт...</div>';
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => { try { const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }); resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(1).filter(r => r.length > 0)); } catch (err) { reject(err); } };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
    let added = 0, updated = 0, errors = 0;
    for (const row of data) {
      try {
        const type = (row[0]||'').toLowerCase().includes('услуга') ? 'service' : 'product';
        const name = row[1]?.toString().trim(); if (!name) { errors++; continue; }
        const sku = row[2]?.toString().trim() || 'SKU-'+Date.now()+Math.random().toString(36).substr(2,4);
        const qty = Number(row[3])||0, pp = Number(row[4])||0, sp = Number(row[5])||0;
        const { data: ex } = await state.db.from("products").select("id").eq("company_id", CONFIG.COMPANY_ID).or(`name.eq.${name},sku.eq.${sku}`).single();
        if (ex) { await state.db.from("products").update({ purchase_price: pp, sale_price: sp }).eq("id", ex.id); if (type === 'product' && qty > 0) await state.db.from("stock_movements").insert({ company_id: CONFIG.COMPANY_ID, product_id: ex.id, type: "in", quantity: qty, price: pp, comment: "Импорт", operation_at: new Date().toISOString() }); updated++; }
        else { const { data: np } = await state.db.from("products").insert({ company_id: CONFIG.COMPANY_ID, name, sku, type, purchase_price: pp, sale_price: sp, unit: "шт", active: true }).select().single(); if (type === 'product' && qty > 0 && np) await state.db.from("stock_movements").insert({ company_id: CONFIG.COMPANY_ID, product_id: np.id, type: "initial", quantity: qty, price: pp, comment: "Импорт", operation_at: new Date().toISOString() }); added++; }
      } catch { errors++; }
    }
    res.innerHTML = `<div class="import-result success">✓ Добавлено: ${added}</div><div class="import-result info">↻ Обновлено: ${updated}</div>${errors>0?`<div class="import-result error">✕ Ошибки: ${errors}</div>`:''}`;
    await loadProducts(); renderProductsList();
  } catch (e) { res.innerHTML = `<div class="import-result error">Ошибка: ${e.message}</div>`; }
}

// SCANNER
let scannerStream = null;
async function openScanner() {
  try { scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); const v = $("scannerVideo"); if (v) { v.srcObject = scannerStream; v.play(); } $("scannerOverlay").classList.add("active"); }
  catch { showToast("Нет камеры", "error"); }
}
function closeScanner() { if (scannerStream) { scannerStream.getTracks().forEach(t => t.stop()); scannerStream = null; } $("scannerOverlay").classList.remove("active"); }

// MODALS
function openModal(id) { const m = $(id); if (m) m.classList.add("active"); }
function closeModal(id) { const m = $(id); if (m) m.classList.remove("active"); }

// DELETE
function requestDelete(opId, opType) { $("deleteOperationId").value = opId; $("deleteOperationType").value = opType; $("adminPassword").value = ""; openModal("adminPasswordModal"); }
async function confirmDelete() {
  const pw = $("adminPassword").value, opId = $("deleteOperationId").value, opType = $("deleteOperationType").value;
  if (pw !== CONFIG.ADMIN_PASSWORD) { showToast("Неверный пароль", "error"); return; }
  try { const table = { sale: 'sales', refund: 'refunds', movement: 'stock_movements' }[opType] || 'sales'; await state.db.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", opId); showToast("Удалено", "success"); closeModal("adminPasswordModal"); await loadProducts(); loadMiniReport(); }
  catch (e) { showToast("Ошибка", "error"); }
}

// INIT
window.addEventListener('DOMContentLoaded', initApp);

// Exports
window.showSection = showSection; window.setMode = setMode; window.changePeriod = changePeriod; window.submitOperation = submitOperation;
window.changeSaleQty = changeSaleQty; window.changeSimpleQty = changeSimpleQty; window.changeReturnQty = changeReturnQty;
window.setReceiveQty = setReceiveQty; window.setReceiveCost = setReceiveCost; window.removeReceiveBatch = removeReceiveBatch; window.clearReturnSelection = clearReturnSelection;
window.openNewProduct = openNewProduct; window.saveProduct = saveProduct; window.deleteProduct = deleteProduct; window.filterProducts = filterProducts;
window.openNewSupplier = openNewSupplier; window.saveSupplier = saveSupplier; window.deleteSupplier = deleteSupplier; window.filterSuppliers = filterSuppliers;
window.openNewClient = openNewClient; window.saveClient = saveClient; window.deleteClient = deleteClient; window.filterClients = filterClients; window.showClientHistory = showClientHistory;
window.showExpenseTab = showExpenseTab; window.loadExpenses = loadExpenses; window.openNewExpense = openNewExpense; window.saveExpense = saveExpense;
window.openNewCategory = openNewCategory; window.saveCategory = saveCategory; window.renderCategories = renderCategories;
window.showReportTab = showReportTab; window.loadReports = loadReports;
window.loadMoneyBalance = loadMoneyBalance; window.loadMoneyHistory = loadMoneyHistory; window.saveInitialBalance = saveInitialBalance;
window.openMoneyOperation = openMoneyOperation; window.saveMoneyOperation = saveMoneyOperation;
window.openImportModal = openImportModal; window.importProducts = importProducts;
window.openScanner = openScanner; window.closeScanner = closeScanner;
window.openModal = openModal; window.closeModal = closeModal;
window.requestDelete = requestDelete; window.confirmDelete = confirmDelete;
