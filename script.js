(function(){
  "use strict";

  const VAT_NOTES = {
    STANDARD_21: "",
    REVERSE_CHARGE: "VAT 0% – Reverse charge.\nVAT to be accounted for by the customer.\nArticle 196 of Council Directive 2006/112/EC.",
    ZERO_RATE: "VAT 0% – Zero-rated supply.",
    EXEMPT: "Exempt from VAT."
  };
  const VAT_LABELS = {
    STANDARD_21: "Standarta 21%",
    REVERSE_CHARGE: "Apgrieztā PVN maksāšana (ES B2B)",
    ZERO_RATE: "0% likme",
    EXEMPT: "Atbrīvots no PVN"
  };
  const vatHelp = {
    STANDARD_21: "Piemēro standarta 21% PVN likmi Latvijā.",
    REVERSE_CHARGE: "ES B2B piegādēm — PVN 0%, klients pats uzrāda PVN saskaņā ar Padomes Direktīvas 2006/112/EK 196. pantu.",
    ZERO_RATE: "0% likme (piem. eksports ārpus ES).",
    EXEMPT: "Darījums ir atbrīvots no PVN."
  };

  let invoices = [];
  let customers = [];
  let settings = { seller:{}, tax:{ iinRate:"", vsaoiRate:"", expensePct:"" } };
  let editingId = null;
  let lineItemSeq = 0;
  let generateReturnScreen = 'screen-home';

  const store = (window.storage) ? window.storage : {
    async get(key){
      const raw = localStorage.getItem(key);
      if(raw === null) throw new Error('not found');
      return { key, value: raw };
    },
    async set(key, value){ localStorage.setItem(key, value); return { key, value }; }
  };

  async function loadAll(){
    try{ const r = await store.get('invoices', false); invoices = r && r.value ? JSON.parse(r.value) : []; }
    catch(e){ invoices = []; }
    try{ const r = await store.get('customers', false); customers = r && r.value ? JSON.parse(r.value) : []; }
    catch(e){ customers = []; }
    try{ const r = await store.get('settings', false); settings = r && r.value ? JSON.parse(r.value) : settings; }
    catch(e){ /* keep defaults */ }
  }
  
  async function saveInvoices(){
    try{ await store.set('invoices', JSON.stringify(invoices), false); } catch(e){ console.error(e); }
  }
  async function saveCustomers(){
    try{ await store.set('customers', JSON.stringify(customers), false); } catch(e){ console.error(e); }
  }
  async function saveSettings(){
    try{ await store.set('settings', JSON.stringify(settings), false); } catch(e){ console.error(e); }
  }

  function fmt(n, currency){
    const val = isFinite(n) ? n : 0;
    const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
    return symbol + val.toFixed(2);
  }
  function uid(){ return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2,8); }
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function num(v){ const n = parseFloat(v); return isFinite(n) ? n : 0; }
  function escapeHtml(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escapeAttr(s){ return String(s == null ? '' : s).replace(/"/g,'&quot;'); }

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id==='screen-dashboard') renderDashboard();
    if(id==='screen-list') renderList();
    if(id==='screen-settings') fillSettingsForm();
    if(id==='screen-home') renderHomePreview();
  }

  document.getElementById('q-settings').addEventListener('click', ()=>showScreen('screen-settings'));
  document.getElementById('q-dashboard').addEventListener('click', ()=>showScreen('screen-dashboard'));
  document.getElementById('q-list').addEventListener('click', ()=>showScreen('screen-list'));
  document.getElementById('q-generate').addEventListener('click', ()=>{
    generateReturnScreen = 'screen-home';
    document.getElementById('generate-title').textContent = 'Rēķinu izrakstīšana';
    resetForm();
    showScreen('screen-generate');
  });
  document.querySelectorAll('.back').forEach(b=>{
    if(b.id === 'generate-back') return;
    b.addEventListener('click', ()=>showScreen(b.dataset.target));
  });
  document.getElementById('generate-back').addEventListener('click', ()=>showScreen(generateReturnScreen));

  // --- Klientu sistēmas funkcionalitāte ---
  function populateCustomerSelect() {
    const sel = document.getElementById('f-customer-select');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Izvēlēties no saglabātajiem klientiem --</option>' +
      customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  if(document.getElementById('f-customer-select')) {
    document.getElementById('f-customer-select').addEventListener('change', (e) => {
      const c = customers.find(x => x.id === e.target.value);
      if(c) {
        document.getElementById('f-customer-name').value = c.name || '';
        document.getElementById('f-customer-address').value = c.address || '';
        document.getElementById('f-customer-country').value = c.country || '';
        document.getElementById('f-customer-vat').value = c.vat_no || '';
      }
    });
  }

  if(document.getElementById('btn-save-customer')) {
    document.getElementById('btn-save-customer').addEventListener('click', async () => {
      const name = document.getElementById('f-customer-name').value.trim();
      if(!name) { alert('Lūdzu ievadiet klienta nosaukumu, lai to saglabātu.'); return; }
      
      const newCust = {
        id: uid(),
        name,
        address: document.getElementById('f-customer-address').value,
        country: document.getElementById('f-customer-country').value,
        vat_no: document.getElementById('f-customer-vat').value
      };
      
      const idx = customers.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
      if(idx > -1) {
        customers[idx] = { ...newCust, id: customers[idx].id }; 
      } else {
        customers.push(newCust);
      }
      
      await saveCustomers();
      populateCustomerSelect();
      document.getElementById('f-customer-select').value = idx > -1 ? customers[idx].id : newCust.id;
      alert('Klienta dati saglabāti!');
    });
  }

  // --- Valodas un rēķina pozīciju loģika ---
  if(document.getElementById('f-language')) {
    document.getElementById('f-language').addEventListener('change', (e) => {
      const lang = e.target.value;
      const unitInputs = document.querySelectorAll('.li-unit');
      unitInputs.forEach(inp => {
        if (lang === 'en' && inp.value === 'gab.') inp.value = 'pcs';
        else if (lang === 'lv' && inp.value === 'pcs') inp.value = 'gab.';
      });
    });
  }

  function addLineItem(data){
    let defaultUnit = 'gab.';
    const langSelect = document.getElementById('f-language');
    if (langSelect && langSelect.value === 'en') {
      defaultUnit = 'pcs';
    }

    data = data || { description:'', unit: defaultUnit, qty:1, unitPrice:0 };
    const id = 'li_' + (lineItemSeq++);
    const wrap = document.getElementById('lineitems-wrap');
    const row = document.createElement('div');
    row.className = 'lineitem-row';
    row.dataset.id = id;
    row.innerHTML = `
      <div><span class="eyebrow">Apraksts</span><input type="text" class="li-desc" value="${escapeAttr(data.description)}"></div>
      <div><span class="eyebrow">Vienība</span><input type="text" class="li-unit" value="${escapeAttr(data.unit)}"></div>
      <div><span class="eyebrow">Daudz.</span><input type="number" class="li-qty" min="0" step="0.01" value="${data.qty}"></div>
      <div><span class="eyebrow">Cena</span><input type="number" class="li-price" min="0" step="0.01" value="${data.unitPrice}"></div>
      <div><span class="eyebrow">Summa</span><input type="text" class="li-total" value="${fmt(data.qty*data.unitPrice,'EUR')}" disabled></div>
      <div><button class="ghost li-remove" type="button" title="Dzēst pozīciju">✕</button></div>
    `;
    wrap.appendChild(row);
    row.querySelectorAll('.li-qty, .li-price').forEach(inp=>{
      inp.addEventListener('input', ()=>{ recalcLineItem(row); recalcTotals(); });
    });
    row.querySelector('.li-remove').addEventListener('click', ()=>{ row.remove(); recalcTotals(); });
    recalcLineItem(row);
  }
  
  function recalcLineItem(row){
    const qty = num(row.querySelector('.li-qty').value);
    const price = num(row.querySelector('.li-price').value);
    row.querySelector('.li-total').value = fmt(qty*price, document.getElementById('f-currency').value);
  }
  
  function getLineItems(){
    return Array.from(document.querySelectorAll('#lineitems-wrap .lineitem-row')).map(row=>{
      const qty = num(row.querySelector('.li-qty').value);
      const price = num(row.querySelector('.li-price').value);
      return {
        description: row.querySelector('.li-desc').value,
        unit: row.querySelector('.li-unit').value,
        qty, unitPrice: price, total: qty*price
      };
    });
  }
  
  if(document.getElementById('btn-add-item')) {
    document.getElementById('btn-add-item').addEventListener('click', ()=>addLineItem());
  }
  
  if(document.getElementById('f-vat-type')) {
    const vatTypeEl = document.getElementById('f-vat-type');
    vatTypeEl.addEventListener('change', ()=>{
      document.getElementById('vat-type-help').textContent = vatHelp[vatTypeEl.value] || "";
      recalcTotals();
    });

    if(!document.getElementById('f-show-vat-mode')) {
      const wrap = document.createElement('div');
      wrap.style.marginTop = '6px';
      wrap.innerHTML = `
        <label style="font-size:12.5px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--black);">
          <input type="checkbox" id="f-show-vat-mode" checked style="width:auto; height:auto; margin:0; border:none; accent-color:var(--black);"> 
          Rādīt PVN režīmu izdrukā
        </label>
      `;
      vatTypeEl.parentNode.appendChild(wrap);
    }
  }
  
  if(document.getElementById('f-currency')) {
    document.getElementById('f-currency').addEventListener('change', recalcTotals);
  }

  function recalcTotals(){
    const currency = document.getElementById('f-currency').value;
    const items = getLineItems();
    const subtotal = items.reduce((s,i)=>s+i.total,0);
    const vatType = document.getElementById('f-vat-type').value;
    let vatAmount = 0;
    if(vatType === 'STANDARD_21') vatAmount = subtotal * 0.21;
    const total = subtotal + vatAmount;

    document.getElementById('f-subtotal').textContent = fmt(subtotal, currency);
    document.getElementById('f-vat-amount').textContent = fmt(vatAmount, currency);
    document.getElementById('f-total').textContent = fmt(total, currency);

    const noteBox = document.getElementById('f-vat-note');
    if (noteBox) {
      const note = VAT_NOTES[vatType];
      if(note){
        noteBox.style.display = 'block';
        noteBox.innerHTML = note.split('\n').map(l=>escapeHtml(l)).join('<br>');
      } else {
        noteBox.style.display = 'none';
      }
    }
  }

  function suggestInvoiceNumber(){
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    let maxN = 0;
    invoices.forEach(inv => {
      const m = /INV-(\d{4})(?:-\d{2})?-(\d+)/.exec(inv.invoice_number || '');
      if(m && parseInt(m[1],10) === year) maxN = Math.max(maxN, parseInt(m[2],10));
    });
    
    return `INV-${year}-${month}-${String(maxN+1).padStart(3,'0')}`;
  }

  function resetForm(){
    editingId = null;
    populateCustomerSelect(); 
    
    if(document.getElementById('f-invoice-number')) {
      document.getElementById('f-invoice-number').value = suggestInvoiceNumber();
      document.getElementById('f-language').value = 'lv';
      document.getElementById('f-currency').value = 'EUR';
      document.getElementById('f-issue-date').value = todayISO();
      document.getElementById('f-due-date').value = '';
      
      document.getElementById('f-customer-select').value = '';
      document.getElementById('f-customer-name').value = '';
      document.getElementById('f-customer-address').value = '';
      document.getElementById('f-customer-country').value = '';
      document.getElementById('f-customer-vat').value = '';
      document.getElementById('f-vat-type').value = 'STANDARD_21';
      if(document.getElementById('f-show-vat-mode')) document.getElementById('f-show-vat-mode').checked = true;
      document.getElementById('f-payment-ref').value = '';
      document.getElementById('lineitems-wrap').innerHTML = '';
      addLineItem();

      const sv = settings.seller || {};
      document.getElementById('f-seller-name').value = sv.name || '';
      document.getElementById('f-seller-reg').value = sv.regNo || '';
      document.getElementById('f-seller-vat').value = sv.vatNo || '';
      document.getElementById('f-seller-address').value = sv.address || '';
      document.getElementById('f-seller-email').value = sv.email || '';
      document.getElementById('f-seller-phone').value = sv.phone || '';
      document.getElementById('f-seller-iban').value = sv.iban || '';
      document.getElementById('f-seller-bic').value = sv.bic || '';
      if(document.getElementById('f-seller-bank')) {
        document.getElementById('f-seller-bank').value = sv.bank || '';
      }

      document.getElementById('vat-type-help').textContent = vatHelp.STANDARD_21;
      recalcTotals();
    }
  }
  
  if(document.getElementById('btn-reset-form')) {
    document.getElementById('btn-reset-form').addEventListener('click', ()=>resetForm());
  }

  function buildInvoiceFromForm(){
    const currency = document.getElementById('f-currency').value;
    const items = getLineItems().filter(i=>i.description.trim() !== '' || i.qty || i.unitPrice);
    if(items.length === 0) return null;
    const invoiceNumber = document.getElementById('f-invoice-number').value.trim();
    if(!invoiceNumber) return null;

    const subtotal = items.reduce((s,i)=>s+i.total,0);
    const vatType = document.getElementById('f-vat-type').value;
    const vatRate = vatType === 'STANDARD_21' ? 21 : 0;
    const vatAmount = vatType === 'STANDARD_21' ? subtotal*0.21 : 0;
    const total = subtotal + vatAmount;
    const existing = invoices.find(i=>i.id===editingId) || {};

    return {
      id: editingId || uid(),
      invoice_number: invoiceNumber,
      language: document.getElementById('f-language').value,
      show_vat_mode: document.getElementById('f-show-vat-mode') ? document.getElementById('f-show-vat-mode').checked : true,
      issue_date: document.getElementById('f-issue-date').value,
      due_date: document.getElementById('f-due-date').value,
      currency,
      seller: {
        name: document.getElementById('f-seller-name').value,
        regNo: document.getElementById('f-seller-reg') ? document.getElementById('f-seller-reg').value : '',
        vatNo: document.getElementById('f-seller-vat').value,
        address: document.getElementById('f-seller-address').value,
        email: document.getElementById('f-seller-email').value,
        phone: document.getElementById('f-seller-phone').value,
        bank: document.getElementById('f-seller-bank') ? document.getElementById('f-seller-bank').value : 'Swedbank',
        bic: document.getElementById('f-seller-bic').value,
        iban: document.getElementById('f-seller-iban').value
      },
      customer: {
        name: document.getElementById('f-customer-name').value,
        address: document.getElementById('f-customer-address').value,
        country: document.getElementById('f-customer-country').value,
        vat_no: document.getElementById('f-customer-vat').value
      },
      line_items: items,
      vat_type: vatType, vat_rate: vatRate,
      subtotal, vat_amount: vatAmount, total,
      payment_reference: document.getElementById('f-payment-ref').value,
      status: existing.status || 'unpaid',
      created_at: existing.created_at || new Date().toISOString()
    };
  }

  async function persistInvoice(invoice){
    const idx = invoices.findIndex(i=>i.id === invoice.id);
    if(idx > -1) invoices[idx] = invoice; else invoices.push(invoice);
    await saveInvoices();
    renderList();
  }

  if(document.getElementById('btn-save-only')) {
    document.getElementById('btn-save-only').addEventListener('click', async ()=>{
      const invoice = buildInvoiceFromForm();
      if(!invoice){ alert('Pievienojiet vismaz vienu pozīciju un rēķina numuru.'); return; }
      await persistInvoice(invoice);
      showScreen(generateReturnScreen);
    });
  }

  if(document.getElementById('btn-save-invoice')) {
    document.getElementById('btn-save-invoice').addEventListener('click', async ()=>{
      const invoice = buildInvoiceFromForm();
      if(!invoice){ alert('Pievienojiet vismaz vienu pozīciju un rēķina numuru.'); return; }
      await persistInvoice(invoice);
      downloadInvoicePDF(invoice);
      showScreen(generateReturnScreen);
    });
  }

  function renderList(){
    const tbody = document.querySelector('#invoice-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const empty = document.getElementById('list-empty');
    if(invoices.length === 0){ empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    
    invoices.slice().sort((a,b)=> (b.issue_date||'').localeCompare(a.issue_date||'')).forEach(inv=>{
      const tr = document.createElement('tr');
      const statusLabel = inv.status === 'paid' ? 'Samaksāts' : 'Nesamaksāts';
      const statusClass = inv.status === 'paid' ? 'paid' : 'unpaid';

      tr.innerHTML = `
        <td>${escapeHtml(inv.invoice_number)}</td>
        <td>${escapeHtml(inv.issue_date||'')}</td>
        <td>${escapeHtml(inv.customer.name||'—')}</td>
        <td>${escapeHtml(VAT_LABELS[inv.vat_type]||inv.vat_type)}</td>
        <td class="align-r value">${fmt(inv.total, inv.currency)}</td>
        <td class="align-c">
          <div class="status-toggle ${statusClass}" data-id="${inv.id}">${statusLabel}</div>
        </td>
        <td class="row-actions">
          <button class="ghost btn-edit" data-id="${inv.id}">Labot</button>
          <button class="ghost btn-pdf" data-id="${inv.id}">PDF</button>
          <button class="danger btn-delete" data-id="${inv.id}">Dzēst</button>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-edit').forEach(b=>b.addEventListener('click', ()=>editInvoice(b.dataset.id)));
    tbody.querySelectorAll('.btn-pdf').forEach(b=>b.addEventListener('click', ()=>{
      const inv = invoices.find(i=>i.id===b.dataset.id);
      if(inv) downloadInvoicePDF(inv);
    }));
    tbody.querySelectorAll('.btn-delete').forEach(b=>b.addEventListener('click', ()=>deleteInvoice(b.dataset.id)));
    
    tbody.querySelectorAll('.status-toggle').forEach(el => {
      el.addEventListener('click', async () => {
        const inv = invoices.find(i => i.id === el.dataset.id);
        if (inv) {
          inv.status = inv.status === 'paid' ? 'unpaid' : 'paid';
          await saveInvoices();
          renderList();
          renderDashboard(); 
          renderHomePreview();
        }
      });
    });
  }

  function editInvoice(id){
    const inv = invoices.find(i=>i.id===id);
    if(!inv) return;
    editingId = id;
    generateReturnScreen = 'screen-list';
    document.getElementById('generate-title').textContent = 'Rēķina labošana';
    
    populateCustomerSelect(); 
    
    document.getElementById('f-invoice-number').value = inv.invoice_number;
    document.getElementById('f-language').value = inv.language || 'lv';
    document.getElementById('f-currency').value = inv.currency;
    document.getElementById('f-issue-date').value = inv.issue_date;
    document.getElementById('f-due-date').value = inv.due_date;
    document.getElementById('f-seller-name').value = inv.seller.name;
    if(document.getElementById('f-seller-reg')) document.getElementById('f-seller-reg').value = inv.seller.regNo || '';
    document.getElementById('f-seller-vat').value = inv.seller.vatNo;
    document.getElementById('f-seller-address').value = inv.seller.address;
    document.getElementById('f-seller-email').value = inv.seller.email;
    document.getElementById('f-seller-phone').value = inv.seller.phone;
    document.getElementById('f-seller-iban').value = inv.seller.iban;
    document.getElementById('f-seller-bic').value = inv.seller.bic;
    if(document.getElementById('f-seller-bank')) {
      document.getElementById('f-seller-bank').value = inv.seller.bank || '';
    }
    
    document.getElementById('f-customer-name').value = inv.customer.name;
    document.getElementById('f-customer-address').value = inv.customer.address;
    document.getElementById('f-customer-country').value = inv.customer.country;
    document.getElementById('f-customer-vat').value = inv.customer.vat_no;
    
    document.getElementById('f-vat-type').value = inv.vat_type;
    if(document.getElementById('f-show-vat-mode')) {
      document.getElementById('f-show-vat-mode').checked = inv.show_vat_mode !== false;
    }
    document.getElementById('f-payment-ref').value = inv.payment_reference;
    document.getElementById('vat-type-help').textContent = vatHelp[inv.vat_type] || '';

    document.getElementById('lineitems-wrap').innerHTML = '';
    
    const fallbackUnit = inv.language === 'en' ? 'pcs' : 'gab.';
    inv.line_items.forEach(li => addLineItem({description: li.description, unit: li.unit || fallbackUnit, qty: li.qty, unitPrice: li.unitPrice}));
    
    recalcTotals();
    showScreen('screen-generate');
  }

  async function deleteInvoice(id){
    if(!confirm('Vai tiešām dzēst šo rēķinu?')) return;
    invoices = invoices.filter(i=>i.id!==id);
    await saveInvoices();
    renderList();
    renderHomePreview();
  }

  function computeStats(){
    const gross = invoices.reduce((s,i)=>s+i.total,0);
    const net = invoices.reduce((s,i)=>s+i.subtotal,0);
    const unpaid = invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+i.total,0);
    return { count: invoices.length, gross, net, unpaid };
  }

  function renderDashboard(){
    if(!document.getElementById('stat-count')) return;
    const s = computeStats();
    document.getElementById('stat-count').textContent = s.count;
    document.getElementById('stat-total-gross').textContent = fmt(s.gross,'EUR');
    document.getElementById('stat-total-net').textContent = fmt(s.net,'EUR');
    document.getElementById('stat-unpaid').textContent = fmt(s.unpaid,'EUR');

    const byType = {};
    invoices.forEach(inv=>{
      byType[inv.vat_type] = byType[inv.vat_type] || {count:0, net:0};
      byType[inv.vat_type].count++;
      byType[inv.vat_type].net += inv.subtotal;
    });
    const tbody = document.querySelector('#vat-breakdown-table tbody');
    if(tbody) {
      tbody.innerHTML = '';
      Object.keys(VAT_LABELS).forEach(key=>{
        const d = byType[key];
        if(!d) return;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${VAT_LABELS[key]}</td><td class="align-r">${d.count}</td><td class="align-r">${fmt(d.net,'EUR')}</td>`;
        tbody.appendChild(tr);
      });
    }

    const t = settings.tax || {};
    const expensePct = num(t.expensePct) / 100;
    const base = Math.max(0, s.net * (1 - expensePct));
    const iinAmount = base * (num(t.iinRate)/100);
    const vsaoiAmount = base * (num(t.vsaoiRate)/100);
    const taxTotal = iinAmount + vsaoiAmount; 

    document.getElementById('tax-base').textContent = fmt(base,'EUR');
    document.getElementById('tax-iin-amount').textContent = fmt(iinAmount,'EUR');
    document.getElementById('tax-vsaoi-amount').textContent = fmt(vsaoiAmount,'EUR');
    if(document.getElementById('tax-total-amount')) {
      document.getElementById('tax-total-amount').textContent = fmt(taxTotal,'EUR');
    }
    document.getElementById('tax-net-income').textContent = fmt(s.net - taxTotal,'EUR');
  }

  function renderHomePreview(){
    const s = computeStats();
    if(document.getElementById('home-dashboard-preview')) {
        const t = settings.tax || {};
        const expensePct = num(t.expensePct) / 100;
        const base = Math.max(0, s.net * (1 - expensePct));
        const taxTotal = (base * (num(t.iinRate)/100)) + (base * (num(t.vsaoiRate)/100));

        document.getElementById('home-dashboard-preview').innerHTML = `
        <div class="quad-big">${fmt(s.gross,'EUR')}</div>
        <span class="quad-sub">Izrakstīts kopā · ${s.count} rēķini</span>
        <div class="bar thin"></div>
        <span class="quad-sub">Ieņēmumi bez PVN: ${fmt(s.net,'EUR')} · Jāatlicina nodokļiem: ${fmt(taxTotal,'EUR')}</span>
        `;
    }
    const listPrev = document.getElementById('home-list-preview');
    if(listPrev) {
        if(invoices.length === 0){
        listPrev.innerHTML = `<span class="quad-sub">Vēl nav neviena rēķina</span>`;
        } else {
        const recent = invoices.slice().sort((a,b)=>(b.issue_date||'').localeCompare(a.issue_date||'')).slice(0,4);
        listPrev.innerHTML = recent.map(inv=>`
            <div class="quad-preview-row"><span>${escapeHtml(inv.invoice_number)} · ${escapeHtml(inv.customer.name||'—')}</span><span>${fmt(inv.total, inv.currency)}</span></div>
        `).join('');
        }
    }
  }

  if(document.getElementById('btn-save-settings')) {
    document.getElementById('btn-save-settings').addEventListener('click', async ()=>{
      settings.seller = {
        name: document.getElementById('s-seller-name').value,
        regNo: document.getElementById('s-seller-reg').value,
        vatNo: document.getElementById('s-seller-vat').value,
        email: document.getElementById('s-seller-email').value,
        phone: document.getElementById('s-seller-phone').value,
        address: document.getElementById('s-seller-address').value,
        iban: document.getElementById('s-seller-iban').value,
        bic: document.getElementById('s-seller-bic').value,
        bank: document.getElementById('s-seller-bank') ? document.getElementById('s-seller-bank').value : ''
      };
      settings.tax = {
        iinRate: document.getElementById('s-tax-iin').value,
        vsaoiRate: document.getElementById('s-tax-vsaoi').value,
        expensePct: document.getElementById('s-tax-expense').value
      };
      await saveSettings();
      alert('Iestatījumi saglabāti.');
    });
  }

  function fillSettingsForm(){
    const sv = settings.seller || {};
    if(document.getElementById('s-seller-name')) {
        document.getElementById('s-seller-name').value = sv.name || '';
        document.getElementById('s-seller-reg').value = sv.regNo || '';
        document.getElementById('s-seller-vat').value = sv.vatNo || '';
        document.getElementById('s-seller-email').value = sv.email || '';
        document.getElementById('s-seller-phone').value = sv.phone || '';
        document.getElementById('s-seller-address').value = sv.address || '';
        document.getElementById('s-seller-iban').value = sv.iban || '';
        document.getElementById('s-seller-bic').value = sv.bic || '';
        if(document.getElementById('s-seller-bank')) {
          document.getElementById('s-seller-bank').value = sv.bank || '';
        }
        const t = settings.tax || {};
        document.getElementById('s-tax-iin').value = t.iinRate || '';
        document.getElementById('s-tax-vsaoi').value = t.vsaoiRate || '';
        document.getElementById('s-tax-expense').value = t.expensePct || '';
    }
  }

  function amountBreakdownLV(amount){
    const euros = Math.floor(amount + 1e-9);
    const cents = Math.round((amount - euros) * 100);
    const centWord = (cents === 1) ? 'cents' : 'centi';
    return `${euros} euro ${cents} ${centWord}`;
  }
  
  function amountBreakdownEN(amount){
    const euros = Math.floor(amount + 1e-9);
    const cents = Math.round((amount - euros) * 100);
    return `${euros} euros ${cents} cents`;
  }

  // =========================================================================
  // PDF ĢENERĒŠANA — STRICT 8-COLUMN MODULAR GRID + OCR FRIENDLY DATE
  // =========================================================================

  function downloadInvoicePDF(inv) {
    const btn = document.querySelector(`.btn-pdf[data-id="${inv.id}"]`);
    const origText = btn ? btn.innerText : '';
    if (btn) btn.innerText = 'Sagatavo...';

    const lang = inv.language === 'en' ? 'en' : 'lv';

    const t = {
      lv: {
        invoiceNo: "Rēķins Nr.", issueDate: "Rēķina datums", supplier: "Piegādātājs", customer: "Saņēmējs",
        regNo: "Reģ.Nr.", vatNo: "PVN Reģ.Nr.", address: "Adrese", bank: "Banka", swift: "SWIFT/BIC",
        account: "Konts", country: "Valsts", payment: "Apmaksa", transfer: "Pārskaitījums",
        no: "Nr.", desc: "Nosaukums", unit: "Mērv.", qty: "Daudz.", price: "Cena", sum: "Summa",
        vatMode: "PVN režīms", total: "Kopā", amountDue: "Summa apmaksai",
        words: "Summa vārdiem:", dueDate: "Apmaksas termiņš:", prepBy: "Rēķinu sagatavoja:",
        footer: "Rēķins sagatavots elektroniski, derīgs bez paraksta",
        monthsLoc: ['janvārī','februārī','martā','aprīlī','maijā','jūnijā','jūlijā','augustā','septembrī','oktobrī','novembrī','decembrī'],
        monthsNom: ['janvāris','februāris','marts','aprīlis','maijs','jūnijs','jūlijs','augusts','septembris','oktobris','novembris','decembris'],
        vatLabels: VAT_LABELS,
        vatNotes: {
          STANDARD_21: "",
          REVERSE_CHARGE: "ES B2B piegādēm — PVN 0%, klients pats uzrāda PVN saskaņā ar Padomes Direktīvas 2006/112/EK 196. pantu.",
          ZERO_RATE: "PVN 0% – Zero-rated supply.",
          EXEMPT: "Atbrīvots no PVN."
        }
      },
      en: {
        invoiceNo: "Invoice No.", issueDate: "Invoice Date", supplier: "Supplier", customer: "Customer",
        regNo: "Reg. No.", vatNo: "VAT No.", address: "Address", bank: "Bank", swift: "SWIFT/BIC",
        account: "Account", country: "Country", payment: "Payment", transfer: "Bank transfer",
        no: "No.", desc: "Description", unit: "Unit", qty: "Qty", price: "Price", sum: "Total",
        vatMode: "VAT Mode", total: "Subtotal", amountDue: "Total Due",
        words: "Amount in words:", dueDate: "Due Date:", prepBy: "Prepared by:",
        footer: "This document is prepared electronically and is valid without signature.",
        monthsLoc: ['January','February','March','April','May','June','July','August','September','October','November','December'],
        monthsNom: ['January','February','March','April','May','June','July','August','September','October','November','December'],
        vatLabels: {
          STANDARD_21: "Standard 21%",
          REVERSE_CHARGE: "Reverse charge (EU B2B)",
          ZERO_RATE: "0% rate",
          EXEMPT: "Exempt from VAT"
        }
      }
    }[lang];

    function parseDate(s) {
      if (!s) return null;
      const [y, m, d] = s.split('-');
      return new Date(+y, +m - 1, +d);
    }

    const issueDateObj = parseDate(inv.issue_date);
    let fullIssueDate = '';
    if(issueDateObj) {
      if(lang === 'lv') {
        fullIssueDate = issueDateObj.getFullYear() + '. gada ' + issueDateObj.getDate() + '. ' + t.monthsLoc[issueDateObj.getMonth()];
      } else {
        fullIssueDate = t.monthsLoc[issueDateObj.getMonth()] + ' ' + issueDateObj.getDate() + ', ' + issueDateObj.getFullYear();
      }
    }

    const dueDateObj = parseDate(inv.due_date);
    let termLine1 = '—', termLine2 = '';
    if(dueDateObj) {
      if(lang === 'lv') {
        termLine1 = dueDateObj.getFullYear() + '. gada';
        termLine2 = dueDateObj.getDate() + '. ' + t.monthsNom[dueDateObj.getMonth()];
      } else {
        termLine1 = t.monthsNom[dueDateObj.getMonth()] + ' ' + dueDateObj.getDate() + ',';
        termLine2 = dueDateObj.getFullYear().toString();
      }
    }

    const fmtL = n => {
      const locale = lang === 'en' ? 'en-US' : 'lv-LV';
      return (isFinite(n) ? n : 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const itemsHtml = (inv.line_items || []).map((li, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="desc">${escapeHtml(li.description || '')}</td>
        <td class="unit">${escapeHtml(li.unit || '')}</td>
        <td class="qty">${li.qty}</td>
        <td class="price">${fmtL(li.unitPrice)}</td>
        <td class="sum">${fmtL(li.total)}</td>
      </tr>`).join('');

    let vatNoteHtml = '';
    const activeVatNotes = lang === 'lv' ? t.vatNotes : VAT_NOTES;
    if(activeVatNotes[inv.vat_type]) {
        vatNoteHtml = activeVatNotes[inv.vat_type].split('\n').map(l => escapeHtml(l)).join('<br>');
    }

    let vatNoteBlock = '';
    if(vatNoteHtml) {
      vatNoteBlock += `<div class="vat-note">${vatNoteHtml}</div>`;
    }
    if(inv.show_vat_mode !== false) {
      vatNoteBlock += `
        <div class="vat-mode-line">
          <span class="lbl">${t.vatMode}:</span>
          <span>${escapeHtml(t.vatLabels[inv.vat_type] || inv.vat_type)}</span>
        </div>`;
    }

    const sellerContactRows = [
      inv.seller.regNo   ? `<div class="lbl">${t.regNo}</div><div>${escapeHtml(inv.seller.regNo)}</div>` : '',
      inv.seller.vatNo   ? `<div class="lbl">${t.vatNo}</div><div>${escapeHtml(inv.seller.vatNo)}</div>`   : '',
      inv.seller.address ? `<div class="lbl">${t.address}</div><div>${escapeHtml(inv.seller.address)}</div>` : '',
    ].join('');

    const bankName = inv.seller.bank || (inv.seller.bic && inv.seller.bic.includes('HABA') ? 'Swedbank' : '');
    const swiftCode = inv.seller.bic || '';

    const sellerFinRows = [
      bankName  ? `<div class="lbl">${t.bank}</div><div>${escapeHtml(bankName)}</div>` : '',
      swiftCode ? `<div class="lbl">${t.swift}</div><div>${escapeHtml(swiftCode)}</div>` : '',
      inv.seller.iban ? `<div class="lbl">${t.account}</div><div>${escapeHtml(inv.seller.iban)}</div>` : '',
    ].join('');

    const customerContactRows = [
      inv.customer.vat_no  ? `<div class="lbl">${t.vatNo}</div><div>${escapeHtml(inv.customer.vat_no)}</div>` : '',
      inv.customer.address ? `<div class="lbl">${t.address}</div><div>${escapeHtml(inv.customer.address)}</div>` : '',
      inv.customer.country ? `<div class="lbl">${t.country}</div><div>${escapeHtml(inv.customer.country)}</div>` : '',
    ].join('');

    const customerFinRows = [
      `<div class="lbl">${t.payment}</div><div>${t.transfer}</div>`
    ].join('');

    const amountInWords = lang === 'en' ? amountBreakdownEN(inv.total) : amountBreakdownLV(inv.total);

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="UTF-8">
<link rel="stylesheet" href="https://use.typekit.net/wpe8ozi.css">
<style>
  @media print { @page { margin: 0; size: A4 portrait; } }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { background: #fff; font-family: 'helvetica-neue-lt-pro', Arial, sans-serif; font-size: 13px; color: #1a1a1a; -webkit-font-smoothing: antialiased; }

  .page { width: 210mm; min-height: 297mm; padding: 24mm 18mm; position: relative; }
  
  .top { display: flex; width: 100%; align-items: flex-start; margin-bottom: 14px; }
  .top-left { width: 50%; text-align: left; }
  .top-right { width: 50%; text-align: left; }
  .meta-label { font-size: 12px; color: #767676; margin-bottom: 2px; display: block; }
  .meta-val { font-size: 18px; font-weight: 600; line-height: 1.2; }
  
  .bar { height: 6px; background: #1a1a1a; width: 100%; margin-bottom: 20px; }

  .parties { display: flex; width: 100%; }
  .party-left { width: 50%; }
  .party-right { width: 50%; }
  .party-label { font-size: 12px; color: #767676; margin-bottom: 3px; }
  .party-name { font-size: 14px; font-weight: 600; margin-bottom: 7px; }
  
  .party-left .pgrid, .fin-left .pgrid { display: grid; grid-template-columns: 25% 75%; row-gap: 5px; font-size: 12px; line-height: 1.45; }
  .party-right .pgrid, .fin-right .pgrid { display: grid; grid-template-columns: 25% 75%; row-gap: 5px; font-size: 12px; line-height: 1.45; }
  .pgrid .lbl { color: #767676; }

  .fin-wrap { display: flex; width: 100%; margin-top: 24px; }
  .fin-left { width: 50%; }
  .fin-right { width: 50%; }

  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead th { font-size: 12px; font-weight: 400; color: #767676; padding: 0 0 8px 0; border-bottom: 1px solid #d9d9d9; text-align: left; }
  
  th.num { width: 12.5%; text-align: left; }
  th.desc { width: 37.5%; text-align: left; }
  th.unit { width: 12.5%; text-align: left; }
  th.qty { width: 12.5%; text-align: left; }
  th.price { width: 12.5%; text-align: left; }
  th.sum { width: 12.5%; text-align: left; }

  tbody td { font-size: 12px; padding: 10px 0; border-bottom: 1px solid #d9d9d9; vertical-align: top; word-break: break-word; text-align: left; }
  td.num { color: #767676; }
  td.desc { padding-right: 20px; }
  td.sum { font-weight: 400; }

  .totals { margin-top: 2px; page-break-inside: avoid; margin-left: 50%; width: 50%; }
  .totals-row { display: grid; grid-template-columns: 50% 25% 25%; font-size: 12px; padding: 9px 0; border-bottom: 1px solid #d9d9d9; text-align: left; }
  .totals-row .lbl-cell { grid-column: 1 / span 2; }
  .totals-row .val-cell { grid-column: 3; }
  .totals-row.grand { font-size: 14px; font-weight: 700; border-bottom: none; padding-top: 11px; }

  .words { font-size: 12px; margin-top: 14px; margin-left: 50%; width: 50%; padding: 0; text-align: left; }
  .words .lbl { color: #767676; margin-right: 5px; }
  
  .vat-note { font-size: 11px; color: #767676; border: 1px solid #d9d9d9; padding: 10px 12px; margin-top: 16px; margin-left: 50%; width: 50%; }
  
  .vat-mode-line { font-size: 12px; color: #1a1a1a; font-weight: 500; margin-top: 8px; margin-left: 50%; width: 50%; text-align: left; }
  .vat-mode-line .lbl { color: #767676; font-weight: 400; margin-right: 4px; }

  .footer-wrap { position: absolute; left: 18mm; right: 18mm; bottom: 22mm; display: flex; }
  .footer-left { width: 50%; }
  .footer-right { width: 50%; font-size: 12px; text-align: left; }
  
  .fgrid { display: grid; grid-template-columns: 25% 75%; row-gap: 16px; align-items: start; }
  .fgrid .lbl { color: #767676; line-height: 1.3; font-size: 12px; }
  .fgrid .val-block { line-height: 1.3; font-size: 13px; font-weight: 500; text-align: left; }
  
  .footnote { position: absolute; bottom: 10mm; left: 50%; right: 18mm; font-size: 10px; color: #767676; border-top: 1px solid #d9d9d9; padding-top: 6px; text-align: left; }
</style>
</head><body>
<div class="page">
  <div class="top">
    <div class="top-left"><span class="meta-label">${t.invoiceNo}</span><div class="meta-val">${escapeHtml(inv.invoice_number)}</div></div>
    <div class="top-right"><span class="meta-label">${t.issueDate}</span><div class="meta-val">${escapeHtml(fullIssueDate)}</div></div>
  </div>
  
  <div class="bar"></div>
  
  <!-- Kontaktinformācija -->
  <div class="parties">
    <div class="party-left">
      <div class="party-label">${t.supplier}</div><div class="party-name">${escapeHtml(inv.seller.name || '')}</div>
      <div class="pgrid">${sellerContactRows}</div>
    </div>
    <div class="party-right">
      <div class="party-label">${t.customer}</div><div class="party-name">${escapeHtml(inv.customer.name || '')}</div>
      <div class="pgrid">${customerContactRows}</div>
    </div>
  </div>
  
  <!-- Finanšu datu sekcija -->
  <div class="fin-wrap">
    <div class="fin-left">
      <div class="pgrid">${sellerFinRows}</div>
    </div>
    <div class="fin-right">
      <div class="pgrid">${customerFinRows}</div>
    </div>
  </div>
  
  <div class="bar" style="margin-top: 20px;"></div>
  
  <table>
    <thead>
      <tr>
        <th class="num">${t.no}</th>
        <th class="desc">${t.desc}</th>
        <th class="unit">${t.unit}</th>
        <th class="qty">${t.qty}</th>
        <th class="price">${t.price}</th>
        <th class="sum">${t.sum}</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  
  <div class="totals">
    <div class="totals-row"><div class="lbl-cell">${t.total}</div><div class="val-cell">${fmtL(inv.subtotal)}</div></div>
    ${inv.vat_rate > 0 ? `<div class="totals-row"><div class="lbl-cell">PVN ${inv.vat_rate}%</div><div class="val-cell">${fmtL(inv.vat_amount)}</div></div>` : ''}
    <div class="totals-row grand"><div class="lbl-cell">${t.amountDue}</div><div class="val-cell">${fmtL(inv.total)}</div></div>
  </div>
  
  <div class="words"><span class="lbl">${t.words}</span><span>${escapeHtml(amountInWords)}</span></div>
  
  ${vatNoteBlock}
  
  <div class="footer-wrap">
    <div class="footer-left"></div>
    <div class="footer-right">
      <div class="fgrid">
        <div class="lbl">${t.dueDate}</div>
        <div class="val-block">${escapeHtml(termLine1)} ${escapeHtml(termLine2)}</div>
        
        ${inv.seller.name ? `
          <div class="lbl">${t.prepBy}</div>
          <div class="val-block">${escapeHtml(inv.seller.name)}</div>
        ` : ''}
      </div>
    </div>
  </div>
  <div class="footnote">${t.footer}</div>
</div>
</body></html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      
      document.body.removeChild(iframe);
      if (btn) btn.innerText = origText;
    }, 1000);
  }

  // --- Inicializācija un JSON datu vadība ---
  (async function init(){
    await loadAll();
    fillSettingsForm();
    resetForm();
    renderHomePreview();
  })();

  if(document.getElementById('btn-export-json')) {
    document.getElementById('btn-export-json').addEventListener('click', () => {
      const dataToExport = { invoices: invoices, customers: customers, settings: settings };
      const dataStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rekinu_sistemas_dati_${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if(document.getElementById('btn-import-json')) {
    document.getElementById('btn-import-json').addEventListener('click', () => {
      document.getElementById('file-import-json').click();
    });
  }

  if(document.getElementById('file-import-json')) {
    document.getElementById('file-import-json').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          if (importedData.invoices && Array.isArray(importedData.invoices)) {
            invoices = importedData.invoices;
            await saveInvoices();
          }
          if (importedData.customers && Array.isArray(importedData.customers)) {
            customers = importedData.customers;
            await saveCustomers();
          }
          if (importedData.settings) {
            settings = importedData.settings;
            await saveSettings();
          }
          fillSettingsForm();
          renderHomePreview();
          renderList(); 
          populateCustomerSelect(); 
          alert('Dati veiksmīgi importēti! Visi rēķini, klienti un iestatījumi ir atjaunoti.');
        } catch (err) {
          console.error('Kļūda importējot:', err);
          alert('Neizdevās importēt datus. Lūdzu, pārbaudiet, vai izvēlējāties pareizo JSON failu.');
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
  }
})();