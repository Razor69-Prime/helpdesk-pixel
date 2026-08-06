/* PXL-STG-0006E — Customer 360 detail UI. */
(function () {
  let renderSequence = 0;

  function num(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function money(value) {
    return 'Rp ' + Math.round(num(value)).toLocaleString('id-ID');
  }

  function dateTime(value) {
    if (!value) return '-';
    return String(value).replace('T', ' ').slice(0, 16);
  }

  function lineCount(items) {
    return Array.isArray(items) ? items.length : 0;
  }

  function addStyles() {
    if (document.getElementById('pxl0006eStyles')) return;
    const style = document.createElement('style');
    style.id = 'pxl0006eStyles';
    style.textContent = `
      .c360-stack{display:grid;gap:12px}.c360-scroll{overflow:auto}.c360-kv{display:grid;grid-template-columns:145px 1fr;gap:7px;font-size:13px}.c360-kv b{color:var(--muted)}
      .c360-type{display:inline-block;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700}.c360-type.item{background:#fff0e4;color:#9b541f}.c360-type.service{background:#e9f2ff;color:#245d9b}
      .c360-sync{background:#1f5f9d;color:#fff;border-color:#1f5f9d}
      @media(max-width:900px){.c360-kv{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureSyncButton() {
    const toolbar = document.querySelector('#customer360 .toolbar');
    if (!toolbar || document.getElementById('pxlC360SyncBtn')) return;
    const button = document.createElement('button');
    button.id = 'pxlC360SyncBtn';
    button.className = 'btn c360-sync';
    button.textContent = 'Sinkronkan Customer 360';
    button.onclick = async () => {
      const id = c360Select?.value;
      if (!id) return msg('Pilih customer terlebih dahulu.');
      button.disabled = true;
      try {
        const result = await api('POST', `/api/crm/customer-360/${id}/sync`, {});
        msg(`${result.synced || 0} transaksi disinkronkan.`);
        await renderCustomer360();
      } catch (error) {
        msg(error.message);
      } finally {
        button.disabled = false;
      }
    };
    toolbar.appendChild(button);
  }

  function customerHeader(customer, summary, payload) {
    const latestPrice = Array.isArray(payload.last_prices) ? payload.last_prices[0] : null;
    return `<div class="grid2">
      <div class="card">
        <h3 style="margin-top:0">${esc(customer.name)}</h3>
        <div class="c360-kv">
          <b>Tipe</b><span>${esc(customer.type || '-')}</span>
          <b>Sales PIC terakhir</b><span>${esc(summary.computed_last_sales_pic || customer.last_sales_pic || customer.sales_pic || '-')}</span>
          <b>WhatsApp</b><span>${esc(customer.phone || customer.normalized_phone || '-')}</span>
          <b>Alamat</b><span>${esc(customer.address || '-')}</span>
          <b>Project terakhir</b><span>${esc(summary.computed_last_project_name || customer.last_project_name || '-')}</span>
          <b>Lokasi terakhir</b><span>${esc(summary.computed_last_location || customer.last_location || '-')}</span>
          <b>Barang/jasa terakhir</b><span>${esc(latestPrice?.item_name || '-')}</span>
          <b>Harga terakhir</b><span><b>${latestPrice ? money(latestPrice.unit_price) : '-'}</b>${latestPrice ? ` / ${esc(latestPrice.unit || 'unit')}` : ''}</span>
        </div>
      </div>
      <div class="card">
        <b>Dokumen & Operasional Terkait</b>
        <div class="grid2" style="margin-top:12px">
          <div><span class="sub">Sales Order</span><div style="font-size:24px;font-weight:700">${payload.sales_orders.length}</div></div>
          <div><span class="sub">Work Order</span><div style="font-size:24px;font-weight:700">${payload.work_orders.length}</div></div>
          <div><span class="sub">Invoice</span><div style="font-size:24px;font-weight:700">${payload.invoices.length}</div></div>
          <div><span class="sub">Harga Terakhir</span><div style="font-size:24px;font-weight:700">${payload.last_prices.length}</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="btn" onclick="goParent('sales')">Buka Sales</button>
          <button class="btn" onclick="goParent('invoices')">Buka Invoice</button>
          <button class="btn wa" onclick="openCustomer360Whatsapp()">WhatsApp</button>
        </div>
      </div>
    </div>`;
  }

  function transactionTable(rows) {
    if (!rows.length) return '<div class="card empty">Belum ada Invoice Terbit atau Sales Order Approved untuk customer ini.</div>';
    return `<div class="card c360-scroll"><b>Riwayat Transaksi</b><table style="margin-top:10px"><thead><tr><th>Tanggal</th><th>Invoice</th><th>Sales Order</th><th>Project</th><th>Material</th><th>Jasa</th><th>Nominal</th></tr></thead><tbody>${rows.map(row => `<tr>
      <td>${esc(dateTime(row.transaction_at))}</td>
      <td><b>${esc(row.invoice_number || row.quotation_number || '-')}</b>${row.invoice_number ? '<div class="sub">Invoice Terbit</div>' : `<div class="sub">Quotation Rev ${num(row.quotation_revision_no)}</div>`}</td>
      <td>${esc(row.so_number || '-')}</td>
      <td>${esc(row.project_name || '-')}</td>
      <td>${lineCount(row.material_items)}</td>
      <td>${lineCount(row.service_items)}</td>
      <td><b>${money(row.grand_total)}</b></td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  function lastPriceTable(rows) {
    if (!rows.length) return '<div class="card empty">Belum ada histori harga terakhir.</div>';
    return `<div class="card c360-scroll"><b>Harga Terakhir Material & Jasa</b><table style="margin-top:10px"><thead><tr><th>Tipe</th><th>Nama</th><th>Qty</th><th>Satuan</th><th>Harga Terakhir</th><th>Quotation / SO</th><th>Tanggal</th></tr></thead><tbody>${rows.map(row => `<tr>
      <td><span class="c360-type ${row.item_type === 'service' ? 'service' : 'item'}">${row.item_type === 'service' ? 'JASA' : 'MATERIAL'}</span></td>
      <td><b>${esc(row.item_name || '-')}</b>${row.sku ? `<div class="sub">${esc(row.sku)}</div>` : ''}</td>
      <td>${num(row.qty)}</td>
      <td>${esc(row.unit || '-')}</td>
      <td><b>${money(row.unit_price)}</b></td>
      <td>${esc(row.quotation_number || '-')}<div class="sub">${esc(row.so_number || '-')}</div></td>
      <td>${esc(dateTime(row.transaction_at))}</td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  async function renderEnhancedCustomer360() {
    addStyles();
    ensureSyncButton();
    const selected = D.customers.find(row => row.id === c360Select.value) || D.customers[0];
    if (!selected) {
      c360Content.innerHTML = '<div class="card empty">Belum ada customer.</div>';
      wa360Btn.disabled = true;
      return;
    }

    const sequence = ++renderSequence;
    wa360Btn.disabled = !normalizePhone(selected.normalized_phone || selected.phone);
    c360Content.innerHTML = '<div class="card empty">Memuat Customer 360...</div>';

    try {
      const payload = await api('GET', `/api/crm/customer-360/${selected.id}`);
      if (sequence !== renderSequence) return;
      const customer = payload.customer || selected;
      const summary = payload.summary || customer;
      const transactionCount = num(summary.computed_transaction_count ?? customer.transaction_count ?? payload.transactions?.length);
      const lifetime = num(summary.computed_lifetime_value ?? customer.lifetime_value);
      const lastAt = summary.computed_last_transaction_at || customer.last_transaction_at;
      const lastAmount = num(summary.computed_last_transaction_amount ?? customer.last_transaction_amount);
      const lastTransaction = Array.isArray(payload.transactions) ? payload.transactions[0] : null;
      const lastPrice = Array.isArray(payload.last_prices) ? payload.last_prices[0] : null;

      c360Content.innerHTML = `<div class="c360-stack">
        <div class="grid4">
          <div class="card metric"><div class="label">Total Transaksi</div><b>${transactionCount}</b></div>
          <div class="card metric"><div class="label">Lifetime Value</div><b style="font-size:20px">${money(lifetime)}</b></div>
          <div class="card metric"><div class="label">Transaksi Terakhir</div><b style="font-size:18px">${esc(dateTime(lastAt))}</b></div>
          <div class="card metric"><div class="label">Nilai Terakhir</div><b style="font-size:20px">${money(lastAmount)}</b></div>
        </div>
        <div class="grid4">
          <div class="card metric"><div class="label">Nomor Transaksi Terakhir</div><b style="font-size:17px">${esc(lastTransaction?.invoice_number || lastTransaction?.so_number || '-')}</b></div>
          <div class="card metric"><div class="label">Barang/Jasa Terakhir</div><b style="font-size:17px">${esc(lastPrice?.item_name || '-')}</b></div>
          <div class="card metric"><div class="label">Harga Terakhir</div><b style="font-size:19px">${lastPrice ? money(lastPrice.unit_price) : '-'}</b></div>
          <div class="card metric"><div class="label">Tanggal Pembelian</div><b style="font-size:17px">${esc(dateTime(lastPrice?.transaction_at || lastAt))}</b></div>
        </div>
        ${customerHeader(customer, summary, payload)}
        ${transactionTable(Array.isArray(payload.transactions) ? payload.transactions : [])}
        ${lastPriceTable(Array.isArray(payload.last_prices) ? payload.last_prices : [])}
      </div>`;
    } catch (error) {
      if (sequence !== renderSequence) return;
      c360Content.innerHTML = `<div class="card notice">${esc(error.message)}</div>`;
    }
  }

  try {
    renderCustomer360 = renderEnhancedCustomer360;
  } catch (_) {
    window.renderCustomer360 = renderEnhancedCustomer360;
  }

  addStyles();
  ensureSyncButton();
  setTimeout(() => {
    try { renderEnhancedCustomer360(); } catch (_) {}
  }, 350);
})();
