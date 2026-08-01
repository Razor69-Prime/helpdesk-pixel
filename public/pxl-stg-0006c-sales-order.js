/* PXL-STG-0006C — PDF Quotation dan riwayat revisi pada Sales Order. */
(function () {
  const NAVY = [18, 49, 88];
  const ORANGE = [231, 126, 50];
  const PEACH = [252, 232, 218];
  let revisionModal = null;

  function n(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function idr(value) {
    return Math.round(n(value)).toLocaleString('id-ID');
  }

  function dateId(value) {
    if (!value) return '-';
    const source = String(value).slice(0, 10);
    const parts = source.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return source;
  }

  function safeFile(value) {
    return String(value || 'quotation').replace(/[^a-zA-Z0-9_-]+/g, '_');
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

  function findSO(id) {
    try {
      return Array.isArray(D?.sales_orders)
        ? D.sales_orders.find(row => String(row.id) === String(id))
        : null;
    } catch (_) {
      return null;
    }
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

  function text(doc, value, x, y, options) {
    doc.text(String(value ?? ''), x, y, options || {});
  }

  function drawHeader(doc, logo) {
    doc.setFillColor(...PEACH);
    doc.rect(10, 10, 190, 29, 'F');

    if (logo) {
      try { doc.addImage(logo, 'PNG', 14, 13, 23, 23); } catch (_) {}
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    text(doc, 'PIXEL SOLUSINDO', 43, 27);
    doc.setFontSize(25);
    text(doc, 'QUOTATION', 196, 28, { align: 'right' });

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
    text(doc, title, 10, state.y);
    state.y += 2;
    doc.setFillColor(...NAVY);
    doc.rect(10, state.y, 190, 1.1, 'F');
    state.y += 6;

    const x = [10, 22, 111, 128, 147, 174, 200];
    const headers = ['NO', 'DESCRIPTION', 'QTY', 'UNIT', 'PRICE', 'TOTAL'];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    headers.forEach((head, index) => {
      const left = x[index];
      const right = x[index + 1];
      text(doc, head, (left + right) / 2, state.y, { align: 'center' });
    });
    state.y += 4;

    const source = rows.length ? rows : [];
    if (!source.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      text(doc, '-', 105, state.y + 3, { align: 'center' });
      state.y += 7;
      return;
    }

    source.forEach((row, index) => {
      const description = String(row.name || row.item_name || row.description || '-');
      const descLines = doc.splitTextToSize(description, 84);
      const rowHeight = Math.max(6, descLines.length * 4 + 1);
      ensurePage(doc, state, rowHeight + 8, logo);

      doc.setDrawColor(224, 224, 224);
      doc.setLineWidth(0.15);
      doc.line(10, state.y + rowHeight, 200, state.y + rowHeight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      text(doc, index + 1, 16, state.y + 4, { align: 'center' });
      doc.text(descLines, 23, state.y + 4);
      text(doc, n(row.qty), 119.5, state.y + 4, { align: 'center' });
      text(doc, row.unit || '-', 137.5, state.y + 4, { align: 'center' });
      text(doc, `IDR ${idr(row.unit_price)}`, 173, state.y + 4, { align: 'right' });
      text(doc, `IDR ${idr(n(row.qty) * n(row.unit_price))}`, 199, state.y + 4, { align: 'right' });
      state.y += rowHeight;
    });

    state.y += 7;
  }

  async function exportQuotation(id) {
    const so = findSO(id);
    if (!so) return toast('Data Sales Order tidak ditemukan.');

    try {
      const JsPDF = await ensureJsPDF();
      const logo = await imageData('/icons/icon-192.png');
      const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const { material, service } = splitLines(so.items);
      const state = { y: 49 };

      drawHeader(doc, logo);

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      text(doc, 'Customer:', 10, 50);
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
        ['Revision', `Rev ${n(so.quotation_revision_no ?? so.revision_no)}`],
        ['Date', dateId(so.quotation_date || so.created_at)],
        ['Expired', dateId(so.quotation_valid_until)],
        ['Status', String(so.quotation_status || so.status || 'draft').toUpperCase()]
      ];
      details.forEach((entry, index) => {
        const yy = 51 + index * 5.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        text(doc, entry[0], 137, yy);
        text(doc, entry[1], 199, yy, { align: 'right' });
      });

      state.y = Math.max(91, 58 + customerLines.length * 4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      text(doc, so.quotation_title || so.project_name || 'Penawaran', 105, state.y, { align: 'center' });
      state.y += 13;

      drawSection(doc, state, 'A. ITEM DETAILS', material, logo);
      drawSection(doc, state, 'B. SERVICE DETAILS', service, logo);
      ensurePage(doc, state, 43, logo);

      doc.setFillColor(...NAVY);
      doc.rect(10, state.y, 190, 1.2, 'F');
      state.y += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      text(doc, 'If you have any questions concerning this quotation, use the following contact information:', 10, state.y);
      text(doc, 'Marketing Pixel Solusindo (+62 877-3477-2999)', 10, state.y + 6);

      const totals = [
        ['ITEM PRICES', so.material_subtotal ?? material.reduce((sum, item) => sum + n(item.qty) * n(item.unit_price), 0)],
        ['SERVICE PRICES', so.service_subtotal ?? service.reduce((sum, item) => sum + n(item.qty) * n(item.unit_price), 0)]
      ];
      totals.forEach((entry, index) => {
        const yy = state.y + index * 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        text(doc, entry[0], 137, yy);
        text(doc, 'IDR', 169, yy);
        text(doc, idr(entry[1]), 199, yy, { align: 'right' });
      });

      const grandY = state.y + 19;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      text(doc, 'GRAND TOTAL', 137, grandY);
      text(doc, 'IDR', 169, grandY);
      text(doc, idr(so.quotation_total ?? so.total_amount), 199, grandY, { align: 'right' });
      doc.setFillColor(...ORANGE);
      doc.rect(137, grandY + 3, 63, 1.7, 'F');

      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(125, 125, 125);
        text(
          doc,
          `${so.quotation_number || '-'} | ${so.so_number || '-'} | Rev ${n(so.quotation_revision_no ?? so.revision_no)} | Hal ${page}/${pages}`,
          105,
          293,
          { align: 'center' }
        );
      }

      doc.save(`Quotation_${safeFile(so.quotation_number)}_${safeFile(so.so_number)}_Rev${n(so.quotation_revision_no ?? so.revision_no)}.pdf`);
    } catch (error) {
      toast(error.message || 'Gagal membuat PDF penawaran.');
    }
  }

  function ensureRevisionModal() {
    if (revisionModal) return revisionModal;
    revisionModal = document.createElement('div');
    revisionModal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.46);z-index:1000;padding:20px;overflow:auto';
    revisionModal.innerHTML = '<div style="max-width:850px;margin:30px auto;background:#fff;border-radius:12px;padding:16px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><b style="font-size:17px">Riwayat Revisi Penawaran</b><div class="sub" id="pxlQuoteRevisionTitle"></div></div><button class="btn" id="pxlCloseQuoteRevision">Tutup</button></div><div id="pxlQuoteRevisionBody" style="margin-top:14px"></div></div>';
    document.body.appendChild(revisionModal);
    revisionModal.querySelector('#pxlCloseQuoteRevision').onclick = () => { revisionModal.style.display = 'none'; };
    revisionModal.addEventListener('click', event => { if (event.target === revisionModal) revisionModal.style.display = 'none'; });
    return revisionModal;
  }

  async function showRevisions(id) {
    const modal = ensureRevisionModal();
    const body = modal.querySelector('#pxlQuoteRevisionBody');
    const title = modal.querySelector('#pxlQuoteRevisionTitle');
    modal.style.display = 'block';
    body.innerHTML = '<div class="empty-hint">Memuat riwayat...</div>';
    try {
      const result = await api('GET', `/api/sales-orders/${id}/quotation-revisions`);
      title.textContent = `${result.quotation_number || '-'} · ${result.so_number || '-'}`;
      const revisions = Array.isArray(result.revisions) ? result.revisions : [];
      body.innerHTML = revisions.length
        ? `<div class="table"><table><thead><tr><th>Revisi</th><th>Status</th><th>Tanggal</th><th>Material</th><th>Jasa</th><th>Total</th><th>Oleh</th></tr></thead><tbody>${revisions.map(row => `<tr><td><b>Rev ${n(row.revision_no)}</b></td><td>${esc(row.quotation_status || '-')}</td><td>${esc(dateId(row.created_at))}</td><td>${rp(row.material_subtotal)}</td><td>${rp(row.service_subtotal)}</td><td><b>${rp(row.grand_total)}</b></td><td>${esc(row.created_by || '-')}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty-hint">Belum ada snapshot revisi.</div>';
    } catch (error) {
      body.innerHTML = `<div class="notice">${esc(error.message)}</div>`;
    }
  }

  function enhanceQuotationActions() {
    const rows = Array.isArray(D?.sales_orders) ? D.sales_orders : [];
    const rowElements = byId('soTable')?.querySelectorAll('tbody tr') || [];
    rowElements.forEach((tr, index) => {
      const so = rows[index];
      if (!so) return;
      const actions = tr.querySelector('.actions');
      if (!actions || actions.querySelector('[data-quote-pdf]')) return;

      const pdf = document.createElement('button');
      pdf.className = 'btn';
      pdf.type = 'button';
      pdf.dataset.quotePdf = so.id;
      pdf.textContent = 'PDF Penawaran';
      pdf.addEventListener('click', () => exportQuotation(so.id));
      actions.appendChild(pdf);

      const history = document.createElement('button');
      history.className = 'btn';
      history.type = 'button';
      history.dataset.quoteHistory = so.id;
      history.textContent = 'Riwayat';
      history.addEventListener('click', () => showRevisions(so.id));
      actions.appendChild(history);
    });
  }

  try {
    const originalRender = render;
    render = function renderWithQuotationPdf() {
      originalRender();
      enhanceQuotationActions();
    };
  } catch (_) {}

  window.downloadQuotationPDF = exportQuotation;
  window.showQuotationRevisions = showRevisions;
  setTimeout(enhanceQuotationActions, 250);
})();
