(function(){
  "use strict";

  const $ = id => document.getElementById(id);
  const setVal = (id, val) => { const el = $(id); if(el) el.value = val !== undefined ? val : ''; };
  const getVal = id => { const el = $(id); return el ? el.value : ''; };

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

  let invoices = [], customers = [], expense_records = [];
  let editingId = null, lineItemSeq = 0, generateReturnScreen = 'screen-home';
  let settings = { seller:{}, tax:{ iinRate:"", vsaoiRate:"", expensePct:"" }, expenses: [] };

  async function loadAll(){
    try {
      const res = await fetch('/api/data');
      const d = await res.json();
      invoices = d.invoices || [];
      customers = d.customers || [];
      expense_records = d.expense_records || [];
      if(d.settings) settings = d.settings;
    } catch(e) {
      console.error("Nevarēja ielādēt datus no servera", e);
    }
  }
  
  async function saveAll(){
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoices, customers, expense_records, settings })
      });
    } catch(e) {
      console.error("Nevarēja saglabāt datus serverī", e);
    }
  }

  function fmt(n, currency){
    const val = isFinite(n) ? n : 0;
    const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
    return symbol + val.toFixed(2);
  }
  const uid = () => 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  const todayISO = () => { const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  const num = v => isFinite(parseFloat(v)) ? parseFloat(v) : 0;
  const escapeHtml = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const escapeAttr = s => String(s == null ? '' : s).replace(/"/g,'&quot;');

  async function autoGenerateExpenses() {
    let addedNew = false;
    const now = new Date();
    (settings.expenses || []).forEach(ex => {
      if(!ex.id) ex.id = uid(); 
      if(!ex.start) return;
      const pts = ex.start.split('-');
      let d = new Date(pts[0], pts[1]-1, pts[2]); 
      while (d <= now) {
        const dStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        const exists = expense_records.find(r => (r.sub_id === ex.id || r.name === ex.name) && r.date === dStr);
        if (!exists) {
          expense_records.push({ id: uid(), sub_id: ex.id, name: ex.name, amount: ex.amount, date: dStr, verified: false });
          addedNew = true;
        }
        d.setMonth(d.getMonth() + 1); 
      }
    });
    if (addedNew) await saveAll();
  }

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    $(id).classList.add('active');
    if(id==='screen-dashboard') renderDashboard();
    if(id==='screen-list') renderList();
    if(id==='screen-settings') fillSettingsForm();
    if(id==='screen-home') renderHomePreview();
  }

  $('q-settings').addEventListener('click', ()=>showScreen('screen-settings'));
  $('q-dashboard').addEventListener('click', ()=>showScreen('screen-dashboard'));
  $('q-list').addEventListener('click', ()=>showScreen('screen-list'));
  $('q-generate').addEventListener('click', ()=>{
    generateReturnScreen = 'screen-home';
    $('generate-title').textContent = 'Rēķinu izrakstīšana';
    resetForm(); showScreen('screen-generate');
  });
  document.querySelectorAll('.back').forEach(b=>{
    if(b.id === 'generate-back') return;
    b.addEventListener('click', ()=>showScreen(b.dataset.target));
  });
  $('generate-back').addEventListener('click', ()=>showScreen(generateReturnScreen));

  function populateCustomerSelect() {
    const sel = $('f-customer-select');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Izvēlēties no saglabātajiem klientiem --</option>' +
      customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  if($('f-customer-select')) {
    $('f-customer-select').addEventListener('change', (e) => {
      const c = customers.find(x => x.id === e.target.value);
      if(c) {
        setVal('f-customer-name', c.name); setVal('f-customer-address', c.address);
        setVal('f-customer-country', c.country); setVal('f-customer-vat', c.vat_no);
      }
    });
  }

  if($('btn-save-customer')) {
    $('btn-save-customer').addEventListener('click', async () => {
      const name = getVal('f-customer-name').trim();
      if(!name) return alert('Lūdzu ievadiet klienta nosaukumu, lai to saglabātu.');
      const newCust = { id: uid(), name, address: getVal('f-customer-address'), country: getVal('f-customer-country'), vat_no: getVal('f-customer-vat') };
      const idx = customers.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
      if(idx > -1) customers[idx] = { ...newCust, id: customers[idx].id }; else customers.push(newCust);
      await saveAll(); populateCustomerSelect();
      $('f-customer-select').value = idx > -1 ? customers[idx].id : newCust.id;
      alert('Klienta dati saglabāti!');
    });
  }

  if($('f-language')) {
    $('f-language').addEventListener('change', (e) => {
      document.querySelectorAll('.li-unit').forEach(inp => {
        if (e.target.value === 'en' && inp.value === 'gab.') inp.value = 'pcs';
        else if (e.target.value === 'lv' && inp.value === 'pcs') inp.value = 'gab.';
      });
    });
  }

  function addLineItem(data = { description:'', unit: getVal('f-language')==='en'?'pcs':'gab.', qty:1, unitPrice:0 }){
    const row = document.createElement('div');
    row.className = 'lineitem-row'; row.dataset.id = 'li_' + (lineItemSeq++);
    row.innerHTML = `
      <div><span class="eyebrow">Apraksts</span><input type="text" class="li-desc" value="${escapeAttr(data.description)}"></div>
      <div><span class="eyebrow">Vienība</span><input type="text" class="li-unit" value="${escapeAttr(data.unit)}"></div>
      <div><span class="eyebrow">Daudz.</span><input type="number" class="li-qty" min="0" step="0.01" value="${data.qty}"></div>
      <div><span class="eyebrow">Cena</span><input type="number" class="li-price" min="0" step="0.01" value="${data.unitPrice}"></div>
      <div><span class="eyebrow">Summa</span><input type="text" class="li-total" value="${fmt(data.qty*data.unitPrice,'EUR')}" disabled></div>
      <div><button class="ghost li-remove" type="button" title="Dzēst pozīciju">✕</button></div>`;
    $('lineitems-wrap').appendChild(row);
    row.querySelectorAll('.li-qty, .li-price').forEach(inp => inp.addEventListener('input', ()=>{ recalcLineItem(row); recalcTotals(); }));
    row.querySelector('.li-remove').addEventListener('click', ()=>{ row.remove(); recalcTotals(); });
    recalcLineItem(row);
  }
  
  function recalcLineItem(row){
    const qty = num(row.querySelector('.li-qty').value), price = num(row.querySelector('.li-price').value);
    row.querySelector('.li-total').value = fmt(qty*price, getVal('f-currency'));
  }
  
  function getLineItems(){
    return Array.from(document.querySelectorAll('#lineitems-wrap .lineitem-row')).map(row => {
      const qty = num(row.querySelector('.li-qty').value), price = num(row.querySelector('.li-price').value);
      return { description: row.querySelector('.li-desc').value, unit: row.querySelector('.li-unit').value, qty, unitPrice: price, total: qty*price };
    });
  }
  
  if($('btn-add-item')) $('btn-add-item').addEventListener('click', ()=>addLineItem());
  
  if($('f-vat-type')) {
    $('f-vat-type').addEventListener('change', ()=>{ $('vat-type-help').textContent = vatHelp[$('f-vat-type').value] || ""; recalcTotals(); });
    if(!$('f-show-vat-mode')) {
      const wrap = document.createElement('div'); wrap.style.marginTop = '6px';
      wrap.innerHTML = `<label style="font-size:12.5px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--black);"><input type="checkbox" id="f-show-vat-mode" checked style="width:auto; height:auto; margin:0; border:none; accent-color:var(--black);"> Rādīt PVN režīmu izdrukā</label>`;
      $('f-vat-type').parentNode.appendChild(wrap);
    }
  }
  if($('f-currency')) $('f-currency').addEventListener('change', recalcTotals);

  function recalcTotals(){
    const curr = getVal('f-currency'), items = getLineItems(), subtotal = items.reduce((s,i)=>s+i.total,0);
    const vatType = getVal('f-vat-type'), vatAmount = vatType === 'STANDARD_21' ? subtotal * 0.21 : 0;
    if($('f-subtotal')) $('f-subtotal').textContent = fmt(subtotal, curr);
    if($('f-vat-amount')) $('f-vat-amount').textContent = fmt(vatAmount, curr);
    if($('f-total')) $('f-total').textContent = fmt(subtotal + vatAmount, curr);
  }

  function suggestInvoiceNumber(){
    const now = new Date(), year = now.getFullYear(), month = String(now.getMonth() + 1).padStart(2, '0');
    let maxN = invoices.reduce((max, inv) => {
      const m = /INV-(\d{4})(?:-\d{2})?-(\d+)/.exec(inv.invoice_number || '');
      return (m && parseInt(m[1],10) === year) ? Math.max(max, parseInt(m[2],10)) : max;
    }, 0);
    return `INV-${year}-${month}-${String(maxN+1).padStart(3,'0')}`;
  }

  function resetForm(){
    editingId = null; populateCustomerSelect();
    if($('f-invoice-number')) {
      setVal('f-invoice-number', suggestInvoiceNumber());
      setVal('f-language', 'lv'); setVal('f-currency', 'EUR'); setVal('f-issue-date', todayISO()); setVal('f-due-date', '');
      setVal('f-customer-select', ''); setVal('f-customer-name', ''); setVal('f-customer-address', ''); setVal('f-customer-country', ''); setVal('f-customer-vat', '');
      setVal('f-vat-type', 'STANDARD_21'); setVal('f-payment-ref', '');
      if($('f-show-vat-mode')) $('f-show-vat-mode').checked = true;
      $('lineitems-wrap').innerHTML = ''; addLineItem();

      const sv = settings.seller || {};
      setVal('f-seller-name', sv.name); setVal('f-seller-reg', sv.regNo); setVal('f-seller-vat', sv.vatNo);
      setVal('f-seller-address', sv.address); setVal('f-seller-email', sv.email); setVal('f-seller-phone', sv.phone);
      setVal('f-seller-iban', sv.iban); setVal('f-seller-bic', sv.bic); setVal('f-seller-bank', sv.bank);
      $('vat-type-help').textContent = vatHelp.STANDARD_21; recalcTotals();
    }
  }
  if($('btn-reset-form')) $('btn-reset-form').addEventListener('click', resetForm);

  function buildInvoiceFromForm(){
    const items = getLineItems().filter(i=>i.description.trim() !== '' || i.qty || i.unitPrice);
    if(items.length === 0 || !getVal('f-invoice-number').trim()) return null;

    const sub = items.reduce((s,i)=>s+i.total,0), vt = getVal('f-vat-type'), va = vt === 'STANDARD_21' ? sub*0.21 : 0;
    const existing = invoices.find(i=>i.id===editingId) || {};

    return {
      id: editingId || uid(), invoice_number: getVal('f-invoice-number'), language: getVal('f-language'),
      show_vat_mode: $('f-show-vat-mode') ? $('f-show-vat-mode').checked : true, issue_date: getVal('f-issue-date'), due_date: getVal('f-due-date'), currency: getVal('f-currency'),
      seller: { name: getVal('f-seller-name'), regNo: getVal('f-seller-reg'), vatNo: getVal('f-seller-vat'), address: getVal('f-seller-address'), email: getVal('f-seller-email'), phone: getVal('f-seller-phone'), bank: getVal('f-seller-bank')||'Swedbank', bic: getVal('f-seller-bic'), iban: getVal('f-seller-iban') },
      customer: { name: getVal('f-customer-name'), address: getVal('f-customer-address'), country: getVal('f-customer-country'), vat_no: getVal('f-customer-vat') },
      line_items: items, vat_type: vt, vat_rate: vt==='STANDARD_21'?21:0, subtotal: sub, vat_amount: va, total: sub+va,
      payment_reference: getVal('f-payment-ref'), status: existing.status || 'unpaid', created_at: existing.created_at || new Date().toISOString()
    };
  }

  async function persistInvoice(invoice){
    const idx = invoices.findIndex(i=>i.id === invoice.id);
    if(idx > -1) invoices[idx] = invoice; else invoices.push(invoice);
    await saveAll(); renderList();
  }

  const handleSave = async (downloadPdf = false) => {
    const inv = buildInvoiceFromForm();
    if(!inv) return alert('Pievienojiet vismaz vienu pozīciju un rēķina numuru.');
    await persistInvoice(inv);
    if(downloadPdf) downloadInvoicePDF(inv);
    showScreen(generateReturnScreen);
  };
  
  if($('btn-save-only')) $('btn-save-only').addEventListener('click', () => handleSave(false));
  if($('btn-save-invoice')) $('btn-save-invoice').addEventListener('click', () => handleSave(true));

  function renderList(){
    const tbody = document.querySelector('#invoice-table tbody');
    if(!tbody) return; tbody.innerHTML = '';
    $('list-empty').style.display = invoices.length === 0 ? 'block' : 'none';
    
    invoices.slice().sort((a,b)=> (b.issue_date||'').localeCompare(a.issue_date||'')).forEach(inv=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(inv.invoice_number)}</td><td>${escapeHtml(inv.issue_date||'')}</td><td>${escapeHtml(inv.customer.name||'—')}</td>
        <td>${escapeHtml(VAT_LABELS[inv.vat_type]||inv.vat_type)}</td><td class="align-r value">${fmt(inv.total, inv.currency)}</td>
        <td class="align-c"><div class="status-toggle ${inv.status==='paid'?'paid':'unpaid'}" data-id="${inv.id}">${inv.status==='paid'?'Samaksāts':'Nesamaksāts'}</div></td>
        <td class="row-actions"><button class="ghost btn-edit" data-id="${inv.id}">Labot</button><button class="ghost btn-pdf" data-id="${inv.id}">PDF</button><button class="danger btn-delete" data-id="${inv.id}">Dzēst</button></td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-edit').forEach(b=>b.addEventListener('click', ()=>editInvoice(b.dataset.id)));
    tbody.querySelectorAll('.btn-pdf').forEach(b=>b.addEventListener('click', ()=>downloadInvoicePDF(invoices.find(i=>i.id===b.dataset.id))));
    tbody.querySelectorAll('.btn-delete').forEach(b=>b.addEventListener('click', ()=>deleteInvoice(b.dataset.id)));
    tbody.querySelectorAll('.status-toggle').forEach(el => el.addEventListener('click', async () => {
      const inv = invoices.find(i => i.id === el.dataset.id);
      if (inv) { inv.status = inv.status === 'paid' ? 'unpaid' : 'paid'; await saveAll(); renderList(); renderDashboard(); renderHomePreview(); }
    }));
  }

  function editInvoice(id){
    const inv = invoices.find(i=>i.id===id); if(!inv) return;
    editingId = id; generateReturnScreen = 'screen-list'; $('generate-title').textContent = 'Rēķina labošana';
    populateCustomerSelect(); 
    
    ['language','currency','issue_date','due_date','payment_reference'].forEach(k => setVal('f-'+k.replace('_','-'), inv[k]));
    setVal('f-invoice-number', inv.invoice_number);
    setVal('f-seller-name', inv.seller.name); setVal('f-seller-reg', inv.seller.regNo); setVal('f-seller-vat', inv.seller.vatNo);
    setVal('f-seller-address', inv.seller.address); setVal('f-seller-email', inv.seller.email); setVal('f-seller-phone', inv.seller.phone);
    setVal('f-seller-iban', inv.seller.iban); setVal('f-seller-bic', inv.seller.bic); setVal('f-seller-bank', inv.seller.bank);
    setVal('f-customer-name', inv.customer.name); setVal('f-customer-address', inv.customer.address); setVal('f-customer-country', inv.customer.country); setVal('f-customer-vat', inv.customer.vat_no);
    setVal('f-vat-type', inv.vat_type);
    if($('f-show-vat-mode')) $('f-show-vat-mode').checked = inv.show_vat_mode !== false;
    $('vat-type-help').textContent = vatHelp[inv.vat_type] || '';
    
    $('lineitems-wrap').innerHTML = '';
    inv.line_items.forEach(li => addLineItem({description: li.description, unit: li.unit || (inv.language === 'en' ? 'pcs' : 'gab.'), qty: li.qty, unitPrice: li.unitPrice}));
    recalcTotals(); showScreen('screen-generate');
  }

  async function deleteInvoice(id){
    if(!confirm('Vai tiešām dzēst šo rēķinu?')) return;
    invoices = invoices.filter(i=>i.id!==id); await saveAll(); renderList(); renderHomePreview();
  }

  function computeStats(){
    const gross = invoices.reduce((s,i)=>s+i.total,0), net = invoices.reduce((s,i)=>s+i.subtotal,0);
    return { count: invoices.length, gross, net, unpaid: invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+i.total,0) };
  }

  // --- FAILA AUGŠUPIELĀDE ---
  window.triggerExpenseUpload = function(expenseId, expenseName, targetDate) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pdf';
    inp.onchange = async (e) => {
      try {
          const file = e.target.files[0];
          if(!file) return;

          const rec = expense_records.find(r => (r.sub_id === expenseId || r.name === expenseName) && r.date.startsWith(targetDate));
          if (!rec) {
              alert(`Kļūda: Mēnesis nav atrasts sistēmā!`);
              return;
          }

          const btn = document.getElementById(`btn-upload-${rec.id}`);
          const origText = btn ? btn.innerText : 'Augšupielādēt PDF';
          if (btn) btn.innerText = "Pārbauda...";

          const formData = new FormData();
          formData.append('invoice', file);
          formData.append('expenseName', expenseName);
          formData.append('targetDate', targetDate);

          const res = await fetch('/api/upload-expense', { method: 'POST', body: formData });
          
          if(res.ok) {
              const data = await res.json();
              rec.verified = true;
              rec.fileName = data.fileName;
              rec.validationMethod = data.validationMethod; // Saglabājam validācijas veidu ("nosaukuma" vai "satura")
              
              await saveAll();
              renderDashboard();
          } else {
              const errText = await res.text();
              alert(`Neizdevās apstiprināt: ${errText}`);
              if (btn) btn.innerText = origText;
          }
      } catch(err) {
          console.error("Upload fail:", err);
          alert('Sistēmas kļūda! Pārliecinies, ka serveris ir palaists.');
          const rec = expense_records.find(r => (r.sub_id === expenseId || r.name === expenseName) && r.date.startsWith(targetDate));
          if (rec) {
              const btn = document.getElementById(`btn-upload-${rec.id}`);
              if (btn) btn.innerText = 'Augšupielādēt PDF';
          }
      }
    };
    inp.click();
  };

  function renderExpensesList() {
    if (!$('expenses-list')) return;
    let html = '';
    (settings.expenses || []).forEach((ex, i) => {
      const records = expense_records.filter(r => r.sub_id === ex.id || r.name === ex.name).sort((a,b) => a.date.localeCompare(b.date));
      
      let recordsHtml = records.map(r => {
        const targetDate = r.date.slice(0,7);
        const isVerified = r.verified;
        
        const [y, m] = targetDate.split('-');
        const monthName = new Date(y, parseInt(m)-1, 1).toLocaleString('lv-LV', {month: 'long'});
        const displayDate = monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' ' + y;

        const btnHtml = isVerified 
            ? `<div class="status-toggle paid" style="cursor:default;" title="Fails atrodas mapē: invoices/${ex.name.toLowerCase()}">Ir glabātuvē</div>` 
            : `<div id="btn-upload-${r.id}" class="status-toggle pending" onclick="window.triggerExpenseUpload('${ex.id}', '${escapeAttr(ex.name)}', '${targetDate}')">Augšupielādēt PDF</div>`;

        // Zaļais validācijas teksts (ja ir reāli apstiprināts un sistēma atceras "kā")
        const validText = (isVerified && r.validationMethod) 
            ? `<span style="color:#0c7b39; font-size:11.5px; margin-left:12px; font-weight:500;">✓ Validēts pēc faila ${r.validationMethod}</span>` 
            : '';

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-top:1px solid var(--gray-line);">
                <div style="display:flex; align-items:center;">
                    <span style="font-size:13px; color:var(--gray-label);">${displayDate}</span>
                    ${validText}
                </div>
                ${btnHtml}
            </div>`;
      }).join('');

      html += `
        <div style="background:var(--gray-soft); padding:16px 20px; margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:${recordsHtml ? '12px' : '0'};">
                <span style="font-size:14px;"><strong>${escapeHtml(ex.name)}</strong> — ${fmt(ex.amount, 'EUR')}/mēn. <span style="color:var(--gray-label); font-weight:400; font-size:13px;">(no ${escapeHtml(ex.start)})</span></span>
                <button type="button" onclick="window.removeExpense(${i})" style="padding:0; font-size:12.5px; background:transparent; border:none; text-decoration:underline; cursor:pointer; color:var(--red); outline:none;">Dzēst izdevumu</button>
            </div>
            ${recordsHtml}
        </div>`;
    });
    $('expenses-list').innerHTML = html;
  }

  function renderDashboard(){
    if(!$('stat-count')) return;
    const s = computeStats();
    $('stat-count').textContent = s.count; $('stat-total-gross').textContent = fmt(s.gross,'EUR');
    $('stat-total-net').textContent = fmt(s.net,'EUR'); $('stat-unpaid').textContent = fmt(s.unpaid,'EUR');

    const byType = {};
    invoices.forEach(inv=>{ byType[inv.vat_type] = byType[inv.vat_type] || {count:0, net:0}; byType[inv.vat_type].count++; byType[inv.vat_type].net += inv.subtotal; });
    const tbody = document.querySelector('#vat-breakdown-table tbody');
    if(tbody) tbody.innerHTML = Object.keys(VAT_LABELS).map(k => byType[k] ? `<tr><td>${VAT_LABELS[k]}</td><td class="align-r">${byType[k].count}</td><td class="align-r">${fmt(byType[k].net,'EUR')}</td></tr>` : '').join('');

    const t = settings.tax || {}, expensePct = num(t.expensePct) / 100;
    const base = Math.max(0, s.net * (1 - expensePct));
    const taxTotal = (base * (num(t.iinRate)/100)) + (base * (num(t.vsaoiRate)/100));

    const totalFixedExp = expense_records.reduce((sum, r) => sum + r.amount, 0);

    if($('tax-base')) $('tax-base').textContent = fmt(base,'EUR');
    if($('tax-iin-amount')) $('tax-iin-amount').textContent = fmt(base * (num(t.iinRate)/100),'EUR');
    if($('tax-vsaoi-amount')) $('tax-vsaoi-amount').textContent = fmt(base * (num(t.vsaoiRate)/100),'EUR');
    if($('tax-total-amount')) $('tax-total-amount').textContent = fmt(taxTotal,'EUR');
    if($('tax-expenses-amount')) $('tax-expenses-amount').textContent = fmt(totalFixedExp,'EUR');
    
    if($('tax-net-income')) {
      $('tax-net-income').textContent = fmt(taxTotal - totalFixedExp,'EUR');
    }

    renderExpensesList();
  }

  function renderHomePreview(){
    const s = computeStats();
    if($('home-dashboard-preview')) {
        const t = settings.tax || {}, expensePct = num(t.expensePct) / 100;
        const base = Math.max(0, s.net * (1 - expensePct));
        const taxTotal = (base * (num(t.iinRate)/100)) + (base * (num(t.vsaoiRate)/100));
        
        const expArr = Array.isArray(expense_records) ? expense_records : [];
        const totalFixedExp = expArr.reduce((sum, r) => sum + r.amount, 0);
        const expectedReserve = taxTotal - totalFixedExp;

        $('home-dashboard-preview').innerHTML = `<div class="quad-big">${fmt(s.gross,'EUR')}</div><span class="quad-sub">Izrakstīts kopā · ${s.count} rēķini</span><div class="bar thin"></div><span class="quad-sub">Ieņēmumi bez PVN: ${fmt(s.net,'EUR')}</span>`;
    }
    if($('home-list-preview')) {
        $('home-list-preview').innerHTML = invoices.length === 0 ? `<span class="quad-sub">Vēl nav neviena rēķina</span>` : 
          invoices.slice().sort((a,b)=>(b.issue_date||'').localeCompare(a.issue_date||'')).slice(0,4).map(inv=>`<div class="quad-preview-row"><span>${escapeHtml(inv.invoice_number)} · ${escapeHtml(inv.customer.name||'—')}</span><span>${fmt(inv.total, inv.currency)}</span></div>`).join('');
    }
  }

  if($('btn-save-settings')) {
    $('btn-save-settings').addEventListener('click', async ()=>{
      settings.seller = { name: getVal('s-seller-name'), regNo: getVal('s-seller-reg'), vatNo: getVal('s-seller-vat'), email: getVal('s-seller-email'), phone: getVal('s-seller-phone'), address: getVal('s-seller-address'), iban: getVal('s-seller-iban'), bic: getVal('s-seller-bic'), bank: getVal('s-seller-bank') };
      settings.tax = { iinRate: getVal('s-tax-iin'), vsaoiRate: getVal('s-tax-vsaoi'), expensePct: getVal('s-tax-expense') };
      await saveAll(); alert('Iestatījumi saglabāti.');
    });
  }

  window.removeExpense = async function(i) { 
    const removed = settings.expenses.splice(i, 1)[0]; 
    expense_records = expense_records.filter(r => r.sub_id !== removed.id && r.name !== removed.name);
    await saveAll(); 
    renderDashboard(); 
    renderHomePreview();
  };

  if($('btn-add-exp')) {
    $('btn-add-exp').addEventListener('click', async () => {
      const name = getVal('s-exp-name').trim(), amt = num(getVal('s-exp-amt')), start = getVal('s-exp-start');
      if(name && amt > 0 && start) {
        settings.expenses = settings.expenses || [];
        settings.expenses.push({ id: uid(), name, amount: amt, start });
        await saveAll();
        await autoGenerateExpenses(); 
        setVal('s-exp-name',''); setVal('s-exp-amt',''); setVal('s-exp-start','');
        renderDashboard(); renderHomePreview();
      } else alert('Lūdzu aizpildiet visus izdevuma laukus (Nosaukums, Summa un Sākuma datums).');
    });
  }

  function fillSettingsForm(){
    const sv = settings.seller || {}, t = settings.tax || {};
    if($('s-seller-name')) {
      setVal('s-seller-name', sv.name); setVal('s-seller-reg', sv.regNo); setVal('s-seller-vat', sv.vatNo);
      setVal('s-seller-address', sv.address); setVal('s-seller-email', sv.email); setVal('s-seller-phone', sv.phone);
      setVal('s-seller-iban', sv.iban); setVal('s-seller-bic', sv.bic); setVal('s-seller-bank', sv.bank);
      setVal('s-tax-iin', t.iinRate); setVal('s-tax-vsaoi', t.vsaoiRate); setVal('s-tax-expense', t.expensePct);
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

  // --- PDF ĢENERĒŠANA AR STRIKTO 8 KOLONNU REŽĢI ---
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
        },
        vatNotes: VAT_NOTES
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
      inv.seller.regNo ? `<div class="lbl">${t.regNo}</div><div>${escapeHtml(inv.seller.regNo)}</div>` : '', 
      inv.seller.vatNo ? `<div class="lbl">${t.vatNo}</div><div>${escapeHtml(inv.seller.vatNo)}</div>` : '', 
      inv.seller.address ? `<div class="lbl">${t.address}</div><div>${escapeHtml(inv.seller.address)}</div>` : '', 
    ].join(''); 

    const bankName = inv.seller.bank || (inv.seller.bic && inv.seller.bic.includes('HABA') ? 'Swedbank' : ''); 
    const swiftCode = inv.seller.bic || ''; 

    const sellerFinRows = [ 
      bankName ? `<div class="lbl">${t.bank}</div><div>${escapeHtml(bankName)}</div>` : '', 
      swiftCode ? `<div class="lbl">${t.swift}</div><div>${escapeHtml(swiftCode)}</div>` : '', 
      inv.seller.iban ? `<div class="lbl">${t.account}</div><div>${escapeHtml(inv.seller.iban)}</div>` : '', 
    ].join(''); 

    const customerContactRows = [ 
      inv.customer.vat_no ? `<div class="lbl">${t.vatNo}</div><div>${escapeHtml(inv.customer.vat_no)}</div>` : '', 
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

  (async function init(){ 
    await loadAll(); 
    await autoGenerateExpenses(); 
    fillSettingsForm(); 
    resetForm(); 
    renderHomePreview(); 
  })();

  if($('btn-export-json')) { 
    $('btn-export-json').addEventListener('click', () => { 
      const dataToExport = { invoices: invoices, customers: customers, settings: settings, expense_records: expense_records }; 
      const dataStr = JSON.stringify(dataToExport, null, 2); 
      const blob = new Blob([dataStr], { type: "application/json" }); 
      const url = URL.createObjectURL(blob); 
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `rekinu_sistemas_dati_backup_${todayISO()}.json`; 
      document.body.appendChild(a); 
      a.click(); 
      document.body.removeChild(a); 
      URL.revokeObjectURL(url); 
    }); 
  }

  if($('btn-import-json')) { 
    $('btn-import-json').addEventListener('click', () => { 
      $('file-import-json').click(); 
    }); 
  }

  if($('file-import-json')) { 
    $('file-import-json').addEventListener('change', (e) => { 
      const file = e.target.files[0]; 
      if (!file) return; 

      const reader = new FileReader(); 
      reader.onload = async (event) => { 
        try { 
          const d = JSON.parse(event.target.result); 
          if(d.invoices) invoices = d.invoices;
          if(d.customers) customers = d.customers;
          if(d.settings) { 
            settings.seller = d.settings.seller || settings.seller;
            settings.tax = d.settings.tax || settings.tax;
            settings.expenses = d.settings.expenses || settings.expenses || [];
          }
          if(d.expense_records) {
            expense_records = d.expense_records;
          }
          await saveAll(); 
          await autoGenerateExpenses(); 
          fillSettingsForm(); renderHomePreview(); renderList(); populateCustomerSelect(); 
          alert('Backup veiksmīgi ielādēts!'); 
        } catch (err) { 
          alert('Kļūda importējot datus. Pārbaudi JSON failu!'); 
        } 
        e.target.value = ''; 
      }; 
      reader.readAsText(file); 
    }); 
  }
})();