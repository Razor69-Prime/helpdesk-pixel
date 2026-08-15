/* PXL-PROD-0022C — PDF Penawaran Project per Site + branding CV. Cipta Kreasitama */
(function () {
  'use strict';

  const REV = 'PXL-PROD-0022C';
  const NAVY = [18, 49, 88];
  const ORANGE = [231, 126, 50];
  const SITE_GRAY = [224, 224, 224];
  let installed = false;
  let operationalDownload = null;

  const n = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const idr = value => Math.round(n(value)).toLocaleString('id-ID');
  const safeFile = value => String(value || 'quotation').replace(/[^a-zA-Z0-9_-]+/g, '_');

  function dateId(value) {
    if (!value) return '-';
    const source = String(value).slice(0, 10);
    const parts = source.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : source;
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

  function isProjectSO(so) {
    return (Array.isArray(so?.items) ? so.items : []).some(item => item?.site_id || item?.site_name);
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
      if (window.parent && window.parent !== window && window.parent.jspdf?.jsPDF) return window.parent.jspdf.jsPDF;
    } catch (_) {}

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-pxl-project-jspdf]');
      if (existing) {
        if (window.jspdf?.jsPDF) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.dataset.pxlProjectJspdf = '1';
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

  function groupSites(items) {
    const map = new Map();
    (Array.isArray(items) ? items : []).forEach((item, index) => {
      const id = String(item.site_id || `site-${item.site_order || 1}`);
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: item.site_name || `Site ${String(item.site_order || 1).padStart(2, '0')}`,
          order: n(item.site_order) || 1,
          rows: []
        });
      }
      map.get(id).rows.push({ ...item, _order: n(item.site_item_order) || index + 1 });
    });
    const sites = [...map.values()].sort((a, b) => a.order - b.order);
    sites.forEach(site => site.rows.sort((a, b) => a._order - b._order));
    return sites;
  }

  function drawProjectHeader(doc, logo) {
    doc.setFillColor(255,255,255);
    doc.rect(10,9,190,31,'F');
    if (logo) {
      try { doc.addImage(logo,'PNG',13,12,48,24,undefined,'FAST'); } catch (_) {}
    }
    doc.setTextColor(0,0,0);
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.text('CV. CIPTA KREASITAMA',69,25);
    doc.setFontSize(23);
    doc.text('QUOTATION',198,27,{align:'right'});
    doc.setFillColor(...NAVY);
    doc.rect(10,40,126,1.4,'F');
    doc.setFillColor(...ORANGE);
    doc.rect(136,40,64,1.4,'F');
  }

  function drawColumnHeader(doc, state) {
    doc.setFont('helvetica','bold');
    doc.setFontSize(8);
    doc.setTextColor(0,0,0);
    doc.text('NO',16,state.y,{align:'center'});
    doc.text('DESCRIPTION',66,state.y,{align:'center'});
    doc.text('QTY',119.5,state.y,{align:'center'});
    doc.text('UNIT',135.5,state.y,{align:'center'});
    doc.text('PRICE',153,state.y);
    doc.text('TOTAL',183,state.y);
    state.y += 4;
    doc.setDrawColor(218,218,218);
    doc.setLineWidth(0.2);
    doc.line(10,state.y,200,state.y);
    state.y += 3;
  }

  function ensurePage(doc, state, needed, logo) {
    if (state.y + needed <= 276) return;
    doc.addPage();
    drawProjectHeader(doc, logo);
    state.y = 49;
    drawColumnHeader(doc, state);
  }

  function drawSite(doc, state, site, logo) {
    ensurePage(doc,state,14,logo);
    doc.setFillColor(...SITE_GRAY);
    doc.rect(23,state.y,88,6.5,'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(8);
    doc.setTextColor(0,0,0);
    doc.text(String(site.name || 'Site'),27,state.y+4.4);
    state.y += 8;

    (site.rows || []).forEach((row,index) => {
      const description = String(row.name || row.item_name || row.description || '-');
      const descriptionLines = doc.splitTextToSize(description,78);
      const rowHeight = Math.max(6.5,descriptionLines.length*3.5+2);
      ensurePage(doc,state,rowHeight+2,logo);

      doc.setFont('helvetica','normal');
      doc.setFontSize(7.5);
      doc.setTextColor(0,0,0);
      doc.text(String(index+1),16,state.y+4,{align:'center'});
      doc.text(descriptionLines,23,state.y+4);
      doc.text(String(n(row.qty)),119.5,state.y+4,{align:'center'});
      doc.text(String(row.unit || '-'),135.5,state.y+4,{align:'center'});
      doc.text(`IDR ${idr(row.unit_price)}`,153,state.y+4);
      doc.text(`IDR ${idr(n(row.qty)*n(row.unit_price))}`,183,state.y+4);

      doc.setDrawColor(232,232,232);
      doc.setLineWidth(0.15);
      doc.line(10,state.y+rowHeight,200,state.y+rowHeight);
      state.y += rowHeight;
    });
    state.y += 5;
  }

  async function exportProjectQuotation(id) {
    const so = findSO(id);
    if (!so) return notify('Data Sales Order tidak ditemukan.');

    try {
      const JsPDF = await ensureJsPDF();
      const logo = await imageData('/ck-logo.png?v=' + REV);
      const doc = new JsPDF({orientation:'portrait',unit:'mm',format:'a4'});
      const sites = groupSites(so.items);
      const state = {y:49};

      drawProjectHeader(doc,logo);

      doc.setTextColor(0,0,0);
      doc.setFont('helvetica','bold');
      doc.setFontSize(8);
      doc.text('Customer:',10,50);
      doc.setFont('helvetica','normal');
      doc.setFontSize(9);

      const customerLines = doc.splitTextToSize(
        [so.customer_name, so.address || so.location].filter(Boolean).join('\n') || '-',
        86
      );
      doc.text(customerLines,10,56);

      const details = [
        ['Quotation No.',so.quotation_number || '-'],
        ['SO No.',so.so_number || '-'],
        ['Date',dateId(so.quotation_date || so.created_at)],
        ['Expired',dateId(so.quotation_valid_until)]
      ];
      details.forEach((entry,index) => {
        const y = 51 + index*5.5;
        doc.setFontSize(8.5);
        doc.text(entry[0],137,y);
        doc.text(String(entry[1]),199,y,{align:'right'});
      });

      state.y = Math.max(82,58+customerLines.length*4);
      doc.setFont('helvetica','bold');
      doc.setFontSize(12);
      doc.text(String(so.quotation_title || so.project_name || 'Penawaran Project'),105,state.y,{align:'center'});
      state.y += 11;

      drawColumnHeader(doc,state);
      sites.forEach(site => drawSite(doc,state,site,logo));

      ensurePage(doc,state,24,logo);
      const calculatedGrand = (Array.isArray(so.items) ? so.items : [])
        .reduce((sum,row) => sum + n(row.qty)*n(row.unit_price),0);

      doc.setDrawColor(18,49,88);
      doc.setLineWidth(0.8);
      doc.line(137,state.y,200,state.y);
      state.y += 7;
      doc.setFont('helvetica','bold');
      doc.setFontSize(9.5);
      doc.text('GRAND TOTAL',137,state.y);
      doc.text('IDR',169,state.y);
      doc.text(idr(so.quotation_total ?? so.total_amount ?? calculatedGrand),199,state.y,{align:'right'});
      doc.setFillColor(...ORANGE);
      doc.rect(137,state.y+3,63,1.7,'F');

      const pages = doc.getNumberOfPages();
      for (let page=1; page<=pages; page+=1) {
        doc.setPage(page);
        doc.setFont('helvetica','normal');
        doc.setFontSize(6.5);
        doc.setTextColor(125,125,125);
        doc.text(`${so.quotation_number || '-'} | ${so.so_number || '-'} | Hal ${page}/${pages}`,105,293,{align:'center'});
      }

      doc.save(`Quotation_Project_${safeFile(so.quotation_number)}_${safeFile(so.so_number)}.pdf`);
    } catch (error) {
      notify(error.message || 'Gagal membuat PDF penawaran Project.');
    }
  }

  function install() {
    if (installed) return;
    if (typeof window.downloadQuotationPDF !== 'function') return window.setTimeout(install,100);
    installed = true;
    operationalDownload = window.downloadQuotationPDF;

    window.downloadQuotationPDF = function projectAwareQuotationDownload(id) {
      const so = findSO(id);
      if (so && isProjectSO(so)) return exportProjectQuotation(id);
      return operationalDownload(id);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',install,{once:true});
  } else {
    install();
  }
})();
