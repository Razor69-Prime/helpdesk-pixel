/* PXL-STG-0006N — generator utama PDF Penawaran customer tanpa status/revisi. */
(function () {
  'use strict';

  const NAVY = [18, 49, 88];
  const ORANGE = [231, 126, 50];
  const PEACH = [252, 232, 218];
  let revisionModal = null;
  let tableObserver = null;

  const n = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const idr = value => Math.round(n(value)).toLocaleString('id-ID');
  const rupiah = value => 'Rp ' + idr(value);
  const safeFile = value => String(value || 'quotation').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function dateId(value) {
    if (!value) return '-';
    const source = String(value).slice(0, 10);
    const parts = source.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : source;
  }

  function splitLines(items) {
    const material = [];
    const service = [];
    (Array.isArray(items) ? items : []).forEach(item => {
      const type = String(item?.item_type || item?.type || 'item').toLowerCase();
      if (type === 'service' || type === 'jasa') service.push(item);
      else material.push(item);
    });
    return { material, service };
  }

  function getSalesOrders() {
    try {
      return typeof D !== 'undefined' && Array.isArray(D?.sales_orders) ? D.sales_orders : [];
    } catch (_) {
      return [];
    }
  }

  function findSO(id) {
    return getSalesOrders().find(row => String(row.id) === String(id)) || null;
  }

  function notify(message) {
    try {
      if (typeof toast === 'function') return toast(message);
    } catch (_) {}
    window.alert(message);
  }

  async function ensureJsPDF() {
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    try {
      if (window.parent && window.parent !== window && window.parent.jspdf?.jsPDF) {
        return window.parent.jspdf.jsPDF;
      }
    } catch (_) {}

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-pxl-jspdf]');
      if (existing) {
        if (window.jspdf?.jsPDF) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.dataset.pxlJspdf = '1';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Library PDF gagal dimuat.'));
      document.head.appendChild(script);
    });

    if (!window.jspdf?.jsPDF) throw new Error('Library PDF belum tersedia.');
    return window.jspdf.jsPDF;
  }

  async function imageData(url) {
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (_) {
      return null;
    }
  }

  function drawHeader(doc, logo) {
    doc.setFillColor(...PEACH);
    doc.rect(10, 10, 190, 29, 'F');
    if (logo) {
      try { doc.addImage(logo, 'PNG', 14, 15, 58, 18); } catch (_) {}
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('PIXEL SOLUSINDO', 76, 27);
    doc.setFontSize(25);
    doc.text('QUOTATION', 196, 28, { align: 'right' });
    doc.setFillColor(...NAVY);
    doc.rect(10, 39, 126, 1.4, 'F');
    doc.setFillColor(...ORANGE);
    doc.rect(136, 39, 64, 1.4, 'F');
  }

  function ensurePage(doc, state, needed, logo) {
    if (state.y + needed <= 270) return;
    doc.addPage();
    drawHeader(doc, logo);
    state.y = 48;
  }

  function drawSection(doc, state, title, rows, logo) {
    ensurePage(doc, state, 18, logo);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, 10, state.y);
    state.y += 2;
    doc.setFillColor(...NAVY);
    doc.rect(10, state.y, 190, 1.1, 'F');
    state.y += 6;

    doc.setFontSize(8);
    doc.text('NO', 16, state.y, { align: 'center' });
    doc.text('DESCRIPTION', 66, state.y, { align: 'center' });
    doc.text('QTY', 119.5, state.y, { align: 'center' });
    doc.text('UNIT', 137.5, state.y, { align: 'center' });
    doc.text('PRICE', 151, state.y);
    doc.text('TOTAL', 179, state.y);
    state.y += 4;

    if (!rows.length) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 110);
      doc.text('-', 105, state.y + 3, { align: 'center' });
      state.y += 10;
      return;
    }

    rows.forEach((row, index) => {
      const description = String(row.name || row.item_name || row.description || '-');
      const descriptionLines = doc.splitTextToSize(description, 84);
      const rowHeight = Math.max(7, descriptionLines.length * 4 + 2);
      ensurePage(doc, state, rowHeight + 8, logo);

      doc.setDrawColor(224, 224, 224);
      doc.setLineWidth(0.15);
      doc.line(10, state.y + rowHeight, 200, state.y + rowHeight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(String(index + 1), 16, state.y + 4, { align: 'center' });
      doc.text(descriptionLines, 23, state.y + 4);
      doc.text(String(n(row.qty)), 119.5, state.y + 4, { align: 'center' });
      doc.text(String(row.unit || '-'), 137.5, state.y + 4, { align: 'center' });
      doc.text(`IDR ${idr(row.unit_price)}`, 151, state.y + 4);
      doc.text(`IDR ${idr(n(row.qty) * n(row.unit_price))}`, 179, state.y + 4);
      state.y += rowHeight;
    });
    state.y += 7;
  }

  async function exportQuotation(id) {
    const so = findSO(id);
    if (!so) return notify('Data Sales Order tidak ditemukan.');

    try {
      const JsPDF = await ensureJsPDF();
      const logo = await imageData('/pixel-solusindo-logo.png?v=PXL-STG-0019');
      const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const { material, service } = splitLines(so.items);
      const state = { y: 49 };

      drawHeader(doc, logo);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Customer:', 10, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const customerLines = doc.splitTextToSize(
        [so.customer_name, so.address || so.location, so.customer_phone].filter(Boolean).join('\n') || '-',
        86
      );
      doc.text(customerLines, 10, 56);

      const details = [
        ['Quotation No.', so.quotation_number || '-'],
        ['SO No.', so.so_number || '-'],
        ['Date', dateId(so.quotation_date || so.created_at)],
        ['Expired', dateId(so.quotation_valid_until)]
      ];
      details.forEach((entry, index) => {
        const y = 51 + index * 5.5;
        doc.setFontSize(8.5);
        doc.text(entry[0], 137, y);
        doc.text(String(entry[1]), 199, y, { align: 'right' });
      });

      state.y = Math.max(84, 58 + customerLines.length * 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(String(so.quotation_title || so.project_name || 'Penawaran'), 105, state.y, { align: 'center' });
      state.y += 13;

      drawSection(doc, state, 'A. ITEM DETAILS', material, logo);
      drawSection(doc, state, 'B. SERVICE DETAILS', service, logo);
      ensurePage(doc, state, 45, logo);

      doc.setFillColor(...NAVY);
      doc.rect(10, state.y, 190, 1.2, 'F');
      state.y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('Jika ada pertanyaan mengenai penawaran ini, silakan hubungi:', 10, state.y);
      doc.text('Marketing Pixel Solusindo (+62 877-3477-2999)', 10, state.y + 6);

      const materialSubtotal = n(so.material_subtotal ?? material.reduce((sum, item) => sum + n(item.qty) * n(item.unit_price), 0));
      const serviceSubtotal = n(so.service_subtotal ?? service.reduce((sum, item) => sum + n(item.qty) * n(item.unit_price), 0));
      [['ITEM PRICES', materialSubtotal], ['SERVICE PRICES', serviceSubtotal]].forEach((entry, index) => {
        const y = state.y + index * 7;
        doc.text(entry[0], 137, y);
        doc.text('IDR', 169, y);
        doc.text(idr(entry[1]), 181, y);
      });

      const grandY = state.y + 19;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('GRAND TOTAL', 137, grandY);
      doc.text('IDR', 169, grandY);
      doc.text(idr(so.quotation_total ?? so.total_amount ?? materialSubtotal + serviceSubtotal), 181, grandY);
      doc.setFillColor(...ORANGE);
      doc.rect(137, grandY + 3, 63, 1.7, 'F');

      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(125, 125, 125);
        doc.text(`${so.quotation_number || '-'} | ${so.so_number || '-'} | Hal ${page}/${pages}`, 105, 293, { align: 'center' });
      }

      doc.save(`Quotation_${safeFile(so.quotation_number)}_${safeFile(so.so_number)}.pdf`);
    } catch (error) {
      notify(error.message || 'Gagal membuat PDF penawaran.');
    }
  }

  function ensureRevisionModal() {
    if (revisionModal) return revisionModal;
    revisionModal = document.createElement('div');
    revisionModal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.46);z-index:1000;padding:20px;overflow:auto';
    revisionModal.innerHTML = '<div style="max-width:850px;margin:30px auto;background:#fff;border-radius:12px;padding:16px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><b style="font-size:17px">Riwayat Revisi Penawaran</b><div class="sub" id="pxlQuoteRevisionTitle"></div></div><button class="btn" id="pxlCloseQuoteRevision">Tutup</button></div><div id="pxlQuoteRevisionBody" style="margin-top:14px"></div></div>';
    document.body.appendChild(revisionModal);
    revisionModal.querySelector('#pxlCloseQuoteRevision').onclick = () => { revisionModal.style.display = 'none'; };
    revisionModal.addEventListener('click', event => {
      if (event.target === revisionModal) revisionModal.style.display = 'none';
    });
    return revisionModal;
  }

  async function showRevisions(id) {
    const modal = ensureRevisionModal();
    const body = modal.querySelector('#pxlQuoteRevisionBody');
    const title = modal.querySelector('#pxlQuoteRevisionTitle');
    modal.style.display = 'block';
    body.innerHTML = '<div class="empty-hint">Memuat riwayat...</div>';

    try {
      if (typeof api !== 'function') throw new Error('API Sales Order belum tersedia.');
      const result = await api('GET', `/api/sales-orders/${id}/quotation-revisions`);
      title.textContent = `${result.quotation_number || '-'} · ${result.so_number || '-'}`;
      const revisions = Array.isArray(result.revisions) ? result.revisions : [];
      body.innerHTML = revisions.length
        ? `<div class="table"><table><thead><tr><th>Revisi</th><th>Status</th><th>Tanggal</th><th>Material</th><th>Jasa</th><th>Total</th><th>Oleh</th></tr></thead><tbody>${revisions.map(row => `<tr><td><b>Rev ${n(row.revision_no)}</b></td><td>${escapeHtml(row.quotation_status || '-')}</td><td>${escapeHtml(dateId(row.created_at))}</td><td>${rupiah(row.material_subtotal)}</td><td>${rupiah(row.service_subtotal)}</td><td><b>${rupiah(row.grand_total)}</b></td><td>${escapeHtml(row.created_by || '-')}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty-hint">Belum ada snapshot revisi.</div>';
    } catch (error) {
      body.innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
    }
  }

  function salesOrderIdForRow(row, index) {
    const existing = row.querySelector('[data-id]');
    return existing?.dataset?.id || getSalesOrders()[index]?.id || '';
  }

  function ensureSingleQuotationActions() {
    const table = document.getElementById('soTable');
    if (!table) return;

    table.querySelectorAll('tbody tr').forEach((row, index) => {
      const actions = row.querySelector('.actions');
      if (!actions) return;
      const id = salesOrderIdForRow(row, index);
      if (!id) return;

      actions.querySelectorAll('[data-act="pdf"],[data-act="history"]').forEach(button => button.remove());

      const pdfButtons = Array.from(actions.querySelectorAll('[data-quote-pdf]'));
      pdfButtons.slice(1).forEach(button => button.remove());
      let pdf = pdfButtons[0];
      if (!pdf) {
        pdf = document.createElement('button');
        pdf.type = 'button';
        pdf.className = 'btn';
        pdf.dataset.quotePdf = id;
        actions.insertBefore(pdf, actions.firstChild);
      }
      pdf.onclick = event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        exportQuotation(id);
      };
      pdf.textContent = 'PDF Penawaran';

      const historyButtons = Array.from(actions.querySelectorAll('[data-quote-history]'));
      historyButtons.slice(1).forEach(button => button.remove());
      let history = historyButtons[0];
      if (!history) {
        history = document.createElement('button');
        history.type = 'button';
        history.className = 'btn';
        history.dataset.quoteHistory = id;
        pdf.insertAdjacentElement('afterend', history);
      }
      history.onclick = event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        showRevisions(id);
      };
      history.textContent = 'Riwayat';
    });
  }

  function observeTable() {
    const table = document.getElementById('soTable');
    if (!table) return;
    tableObserver?.disconnect();
    tableObserver = new MutationObserver(() => window.requestAnimationFrame(ensureSingleQuotationActions));
    tableObserver.observe(table, { childList: true, subtree: true });
  }

  try {
    if (typeof render === 'function') {
      const originalRender = render;
      render = function renderWithSingleQuotationActions() {
        originalRender();
        ensureSingleQuotationActions();
      };
    }
  } catch (_) {}

  window.downloadQuotationPDF = exportQuotation;
  window.showQuotationRevisions = showRevisions;

  function install() {
    ensureSingleQuotationActions();
    observeTable();
    window.setTimeout(ensureSingleQuotationActions, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
