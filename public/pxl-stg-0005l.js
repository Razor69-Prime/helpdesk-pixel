/* PXL-STG-0005M — koreksi perhitungan Sisa Material pada PDF Material Request. */
(function () {
  'use strict';

  function numberValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function displayNumber(value) {
    const parsed = numberValue(value);
    return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(2)));
  }

  window.exportMRPDF = function exportMRPDF0005M(id) {
    let mr = null;
    try {
      mr = Array.isArray(mrData)
        ? mrData.find(item => String(item.id) === String(id))
        : null;
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
    const MR = 8;
    const CW = PW - ML - MR;
    let y = 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('FORM MATERIAL REQUEST', PW / 2, y + 5, { align: 'center' });
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(ML, y + 7, PW - MR, y + 7);
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
      doc.setTextColor(0, 0, 0);
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
      const x = ML + halfW + 2;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(label + ':', x, y + 4 + index * infoRowH);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), x + 22, y + 4 + index * infoRowH);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(x, y + 5.5 + index * infoRowH, PW - MR, y + 5.5 + index * infoRowH);
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
      doc.rect(ML, y, CW, TH, 'F');

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(ML, y, CW, TH, 'S');
      for (let index = 1; index < colX.length; index++) {
        doc.line(colX[index], y, colX[index], y + TH);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.3);
      doc.setTextColor(0, 0, 0);
      heads.forEach((head, index) => {
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
      doc.setFillColor(...(index % 2 === 0 ? [255, 255, 255] : [248, 248, 248]));
      doc.rect(ML, y, CW, ROW_H, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text(String(index + 1), colX[0] + colW[0] / 2, y + ROW_H - 1.5, { align: 'center' });

      if (item) {
        const qtyOut = numberValue(item.qty_out ?? item.qty);
        const qtyUse = numberValue(item.qty_use);
        const qtyReturn = numberValue(item.qty_return);
        const qtyRemaining = Math.max(0, Number((qtyOut - qtyUse).toFixed(2)));
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
      const x = ML + index * sigW;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text(label, x + sigW / 2, sigY, { align: 'center' });
      if (sigImages[index] && String(sigImages[index]).startsWith('data:')) {
        try {
          doc.addImage(sigImages[index], 'PNG', x + 8, sigY + 2, sigW - 16, 10);
        } catch (_) {}
      }
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(x + 4, sigY + 14, x + sigW - 4, sigY + 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(sigNames[index] || '', x + sigW / 2, sigY + 19, { align: 'center' });
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
})();
