/* PXL-STG-0005K — kolom Sisa Material pada PDF MR dan filter status daftar MR. */
(function () {
  'use strict';

  const STATUS_LABELS = {
    draft: 'Draft',
    requested: 'Diajukan',
    pending: 'Menunggu',
    prepared: 'Disiapkan',
    ready: 'Siap Diambil',
    taken: 'Diambil',
    issued: 'Dikeluarkan',
    partial: 'Sebagian',
    returned: 'Dikembalikan',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    canceled: 'Dibatalkan',
    void: 'Void'
  };

  function normalizeStatus(value) {
    return String(value || 'draft').trim().toLowerCase();
  }

  function statusLabel(value) {
    const key = normalizeStatus(value);
    if (STATUS_LABELS[key]) return STATUS_LABELS[key];
    return key
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function getAllMaterialRequests() {
    const rows = [];
    try {
      if (Array.isArray(mrData)) rows.push(...mrData);
    } catch (_) {}
    try {
      if (Array.isArray(materialRequestsData)) rows.push(...materialRequestsData);
    } catch (_) {}
    return rows;
  }

  function ensureStatusFilter() {
    const dateFilter = document.getElementById('mat-filter-date');
    if (!dateFilter || !dateFilter.parentElement) return null;

    let select = document.getElementById('mat-filter-status');
    if (!select) {
      select = document.createElement('select');
      select.id = 'mat-filter-status';
      select.style.cssText = 'flex:0;min-width:150px';
      select.setAttribute('aria-label', 'Filter status Material Request');
      select.addEventListener('change', () => {
        if (typeof window.renderMRList === 'function') window.renderMRList();
        else if (typeof window.renderMaterialRequests === 'function') window.renderMaterialRequests();
      });
      dateFilter.insertAdjacentElement('afterend', select);
    }

    const currentValue = select.value;
    const statuses = new Set(['draft', 'taken', 'returned']);
    getAllMaterialRequests().forEach(item => statuses.add(normalizeStatus(item?.status)));

    const ordered = [...statuses].filter(Boolean).sort((a, b) => {
      const preferred = ['draft', 'requested', 'pending', 'prepared', 'ready', 'taken', 'issued', 'partial', 'returned', 'completed', 'cancelled', 'canceled', 'void'];
      const ai = preferred.indexOf(a);
      const bi = preferred.indexOf(b);
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return statusLabel(a).localeCompare(statusLabel(b), 'id');
    });

    select.innerHTML = '<option value="">Semua Status</option>'
      + ordered.map(status => `<option value="${status}">${statusLabel(status)}</option>`).join('');
    select.value = ordered.includes(currentValue) ? currentValue : '';
    return select;
  }

  let filterDepth = 0;
  function renderWithStatusFilter(renderFn, context, args) {
    ensureStatusFilter();
    const selected = document.getElementById('mat-filter-status')?.value || '';
    if (!selected || filterDepth > 0) return renderFn.apply(context, args);

    let originalMR;
    let originalLegacy;
    let canRestoreMR = false;
    let canRestoreLegacy = false;

    try {
      filterDepth++;
      try {
        originalMR = mrData;
        mrData = Array.isArray(originalMR)
          ? originalMR.filter(item => normalizeStatus(item?.status) === selected)
          : originalMR;
        canRestoreMR = true;
      } catch (_) {}

      try {
        originalLegacy = materialRequestsData;
        materialRequestsData = Array.isArray(originalLegacy)
          ? originalLegacy.filter(item => normalizeStatus(item?.status) === selected)
          : originalLegacy;
        canRestoreLegacy = true;
      } catch (_) {}

      return renderFn.apply(context, args);
    } finally {
      if (canRestoreMR) {
        try { mrData = originalMR; } catch (_) {}
      }
      if (canRestoreLegacy) {
        try { materialRequestsData = originalLegacy; } catch (_) {}
      }
      filterDepth--;
    }
  }

  const originalRenderMRList = typeof window.renderMRList === 'function' ? window.renderMRList : null;
  if (originalRenderMRList) {
    window.renderMRList = function () {
      return renderWithStatusFilter(originalRenderMRList, this, arguments);
    };
  }

  const originalRenderMaterialRequests = typeof window.renderMaterialRequests === 'function'
    ? window.renderMaterialRequests
    : null;
  if (originalRenderMaterialRequests) {
    window.renderMaterialRequests = function () {
      return renderWithStatusFilter(originalRenderMaterialRequests, this, arguments);
    };
  }

  function numberValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function displayNumber(value) {
    const parsed = numberValue(value);
    return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(2)));
  }

  window.exportMRPDF = function exportMRPDF0005K(id) {
    let mr = null;
    try {
      mr = Array.isArray(mrData) ? mrData.find(item => String(item.id) === String(id)) : null;
    } catch (_) {}
    if (!mr) {
      alert('Data tidak ditemukan.');
      return;
    }
    if (!window.jspdf?.jsPDF) {
      alert('Library PDF belum tersedia. Silakan refresh halaman.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
    const PW = 210;
    const PH = 148;
    const ML = 8;
    const MR2 = 8;
    const CW = PW - ML - MR2;
    let y = 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('FORM MATERIAL REQUEST', PW / 2, y + 5, { align: 'center' });
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(ML, y + 7, PW - MR2, y + 7);
    y += 10;

    const halfW = CW / 2;
    const infoLeft = [
      ['No. WO', mr.wo_number || '-'],
      ['Pekerjaan', mr.project_name || '-']
    ];
    const infoRight = [
      ['Teknisi', mr.technician || '-'],
      ['Tgl Membawa', mr.date_out || '-'],
      ['Tgl Kembali', mr.date_return || '-']
    ];
    const infoRowH = 6;

    infoLeft.forEach(([label, value], index) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(label + ':', ML, y + 4 + index * infoRowH);
      doc.setFont('helvetica', 'normal');
      const truncated = doc.splitTextToSize(String(value), halfW - 24)[0];
      doc.text(truncated, ML + 24, y + 4 + index * infoRowH);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(ML, y + 5.5 + index * infoRowH, ML + halfW - 2, y + 5.5 + index * infoRowH);
    });

    infoRight.forEach(([label, value], index) => {
      const rx = ML + halfW + 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(label + ':', rx, y + 4 + index * infoRowH);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), rx + 22, y + 4 + index * infoRowH);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(rx, y + 5.5 + index * infoRowH, PW - MR2, y + 5.5 + index * infoRowH);
    });
    y += Math.max(infoLeft.length, infoRight.length) * infoRowH + 4;

    const colW = [8, 70, 26, 26, 26, 38];
    const colX = [ML];
    colW.forEach((width, index) => {
      if (index > 0) colX.push(colX[index - 1] + colW[index - 1]);
    });
    const heads = ['NO', 'ITEM', 'PENGAMBILAN', 'PEMAKAIAN', 'PENGEMBALIAN', 'SISA MATERIAL'];
    const TH = 6;

    function drawTableHeader() {
      doc.setFillColor(180, 180, 180);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.3);
      doc.setTextColor(0, 0, 0);
      heads.forEach((head, index) => {
        doc.rect(colX[index], y, colW[index], TH, 'F');
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(colX[index], y, colW[index], TH, 'S');
        doc.text(head, colX[index] + colW[index] / 2, y + 4.15, { align: 'center' });
      });
      y += TH;
    }

    drawTableHeader();

    const items = Array.isArray(mr.items) ? mr.items : [];
    const totalRows = Math.max(items.length, 10);
    const ROW_H = 5.5;
    const availableHeight = PH - y - 28;
    const rowsPerPage = Math.max(1, Math.floor(availableHeight / ROW_H));

    for (let index = 0; index < totalRows; index++) {
      if (index > 0 && index % rowsPerPage === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(130, 130, 130);
        doc.text(`${mr.wo_number || ''} | Hal ${doc.getNumberOfPages()}`, PW / 2, PH - 4, { align: 'center' });
        doc.addPage();
        y = 8;
        drawTableHeader();
      }

      const item = items[index] || null;
      const background = index % 2 === 0 ? [255, 255, 255] : [248, 248, 248];
      doc.setFillColor(...background);
      doc.rect(ML, y, CW, ROW_H, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text(String(index + 1), colX[0] + colW[0] / 2, y + ROW_H - 1.5, { align: 'center' });

      if (item) {
        const qtyOut = numberValue(item.qty_out ?? item.qty);
        const qtyUse = numberValue(item.qty_use);
        const qtyReturn = numberValue(item.qty_return);
        const qtyRemaining = Math.max(0, Number((qtyOut - qtyUse - qtyReturn).toFixed(2)));
        const nameLines = doc.splitTextToSize(String(item.name || item.item_name || ''), colW[1] - 2);
        doc.text(nameLines[0] || '', colX[1] + 1.5, y + ROW_H - 1.5);
        doc.text(displayNumber(qtyOut), colX[2] + colW[2] / 2, y + ROW_H - 1.5, { align: 'center' });
        doc.text(displayNumber(qtyUse), colX[3] + colW[3] / 2, y + ROW_H - 1.5, { align: 'center' });
        doc.text(displayNumber(qtyReturn), colX[4] + colW[4] / 2, y + ROW_H - 1.5, { align: 'center' });
        doc.text(displayNumber(qtyRemaining), colX[5] + colW[5] / 2, y + ROW_H - 1.5, { align: 'center' });
      }

      colX.forEach((x, cellIndex) => {
        doc.setDrawColor(160, 160, 160);
        doc.setLineWidth(0.15);
        doc.rect(x, y, colW[cellIndex], ROW_H, 'S');
      });
      y += ROW_H;
    }
    y += 4;

    const sigW = CW / 3;
    const sigLabels = ['PIC MATERIAL REQUEST', 'MATERIAL PREPARED', 'TEKNISI'];
    const sigNames = [
      mr.requester_signed_by || mr.created_by || '-',
      mr.prepared_by || '',
      mr.technician_signed_by || mr.technician || '-'
    ];
    const sigImages = [
      mr.requester_signature || null,
      mr.prepared_signature || null,
      mr.technician_signature || null
    ];
    const sigY = Math.max(y, PH - 30);

    sigLabels.forEach((label, index) => {
      const sx = ML + index * sigW;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text(label, sx + sigW / 2, sigY, { align: 'center' });
      if (sigImages[index] && String(sigImages[index]).startsWith('data:')) {
        try {
          doc.addImage(sigImages[index], 'PNG', sx + 8, sigY + 2, sigW - 16, 10);
        } catch (_) {}
      }
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(sx + 4, sigY + 14, sx + sigW - 4, sigY + 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(sigNames[index] || '', sx + sigW / 2, sigY + 19, { align: 'center' });
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page++) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(130, 130, 130);
      doc.text(
        `${mr.wo_number || ''} | ${mr.technician || ''} | Dicetak: ${new Date().toLocaleString('id-ID')} | Hal ${page}/${totalPages}`,
        PW / 2,
        PH - 2,
        { align: 'center' }
      );
    }

    const fileName = String(mr.wo_number || String(mr.id || '').slice(0, 8))
      .replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`MR_${fileName}.pdf`);
  };

  function initialize() {
    ensureStatusFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
