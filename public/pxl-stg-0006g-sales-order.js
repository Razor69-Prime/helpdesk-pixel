/* PXL-STG-0006G — stabilisasi tombol Submit dan Unduh PDF Sales Order. */
(function () {
  'use strict';

  const REVISION = 'PXL-STG-0006G';
  let submitObserver = null;
  let tableObserver = null;
  let normalizingSubmit = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function showMessage(message) {
    try {
      if (typeof toast === 'function') return toast(message);
    } catch (_) {}
    window.alert(message);
  }

  function installStyles() {
    if (byId('pxlStg0006GStyle')) return;
    const style = document.createElement('style');
    style.id = 'pxlStg0006GStyle';
    style.textContent = `
      #pxlSoBottomActions {
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
        margin-top:14px;
        padding-top:14px;
        border-top:1px solid var(--line,#e4e1d8);
      }
      #pxlSoBottomActions #saveBtn {
        min-width:150px;
        padding:11px 18px;
      }
      #pxlSoBottomActions #resetBtn {
        min-width:100px;
        padding:11px 16px;
      }
      .pxl-quote-pdf-btn {
        border-color:#2563a8 !important;
        color:#174f85 !important;
        background:#f3f8ff !important;
      }
      @media(max-width:560px) {
        #pxlSoBottomActions {
          display:grid;
          grid-template-columns:1fr 1fr;
        }
        #pxlSoBottomActions .btn {
          width:100%;
          min-width:0 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isEditMode() {
    const title = String(byId('formTitle')?.textContent || '').trim().toLowerCase();
    const current = String(byId('saveBtn')?.textContent || '').trim().toLowerCase();
    return title.startsWith('edit ') || current.includes('perubahan');
  }

  function normalizeSubmitLabel() {
    const save = byId('saveBtn');
    if (!save || normalizingSubmit) return;
    const expected = isEditMode() ? 'Submit Perubahan' : 'Submit';
    if (save.textContent === expected) return;
    normalizingSubmit = true;
    save.textContent = expected;
    normalizingSubmit = false;
  }

  function ensureBottomActions() {
    const save = byId('saveBtn');
    const reset = byId('resetBtn');
    if (!save || !reset) return;

    const card = save.closest('.card.section') || save.closest('.card');
    if (!card) return;

    let actionBar = byId('pxlSoBottomActions');
    if (!actionBar) {
      actionBar = document.createElement('div');
      actionBar.id = 'pxlSoBottomActions';
      actionBar.setAttribute('aria-label', 'Aksi form Sales Order');

      const flowNote = card.querySelector('.flow-note');
      if (flowNote) flowNote.insertAdjacentElement('afterend', actionBar);
      else card.appendChild(actionBar);
    }

    reset.type = 'button';
    save.type = 'button';
    actionBar.appendChild(reset);
    actionBar.appendChild(save);
    normalizeSubmitLabel();

    const previousActions = card.querySelector('.toolbar .actions');
    if (previousActions && previousActions !== actionBar && !previousActions.children.length) {
      previousActions.remove();
    }
  }

  function monitorSubmitLabel() {
    const save = byId('saveBtn');
    if (!save) return;
    submitObserver?.disconnect();
    submitObserver = new MutationObserver(normalizeSubmitLabel);
    submitObserver.observe(save, { childList: true, characterData: true, subtree: true });
  }

  function getSalesOrderId(row, index) {
    const existingAction = row.querySelector('[data-id]');
    if (existingAction?.dataset?.id) return existingAction.dataset.id;

    try {
      if (typeof D !== 'undefined' && Array.isArray(D?.sales_orders)) {
        return D.sales_orders[index]?.id || '';
      }
    } catch (_) {}
    return '';
  }

  function downloadPdf(id) {
    if (!id) return showMessage('ID Sales Order tidak ditemukan. Silakan refresh halaman.');
    if (typeof window.downloadQuotationPDF !== 'function') {
      return showMessage('Generator PDF belum termuat. Silakan hard refresh halaman Sales Order.');
    }
    window.downloadQuotationPDF(id);
  }

  function openHistory(id) {
    if (!id) return showMessage('ID Sales Order tidak ditemukan. Silakan refresh halaman.');
    if (typeof window.showQuotationRevisions !== 'function') {
      return showMessage('Riwayat quotation belum termuat. Silakan hard refresh halaman Sales Order.');
    }
    window.showQuotationRevisions(id);
  }

  function ensureQuotationActions() {
    const table = byId('soTable');
    if (!table) return;

    table.querySelectorAll('tbody tr').forEach((row, index) => {
      const actions = row.querySelector('.actions');
      if (!actions) return;
      const salesOrderId = getSalesOrderId(row, index);
      if (!salesOrderId) return;

      if (actions.children.length === 0 && actions.textContent.trim() === '-') {
        actions.textContent = '';
      }

      let pdfButton = actions.querySelector('[data-quote-pdf]');
      if (!pdfButton) {
        pdfButton = document.createElement('button');
        pdfButton.type = 'button';
        pdfButton.className = 'btn pxl-quote-pdf-btn';
        pdfButton.dataset.quotePdf = salesOrderId;
        pdfButton.addEventListener('click', () => downloadPdf(salesOrderId));
        actions.appendChild(pdfButton);
      }
      pdfButton.textContent = 'Unduh PDF';
      pdfButton.title = 'Unduh PDF Penawaran';
      pdfButton.classList.add('pxl-quote-pdf-btn');

      let historyButton = actions.querySelector('[data-quote-history]');
      if (!historyButton) {
        historyButton = document.createElement('button');
        historyButton.type = 'button';
        historyButton.className = 'btn';
        historyButton.dataset.quoteHistory = salesOrderId;
        historyButton.textContent = 'Riwayat';
        historyButton.addEventListener('click', () => openHistory(salesOrderId));
        actions.appendChild(historyButton);
      }
    });
  }

  function monitorSalesOrderTable() {
    const table = byId('soTable');
    if (!table) return;
    tableObserver?.disconnect();
    tableObserver = new MutationObserver(() => {
      window.requestAnimationFrame(ensureQuotationActions);
    });
    tableObserver.observe(table, { childList: true, subtree: true });
    ensureQuotationActions();
  }

  function updateRevisionLabel() {
    const headerSub = document.querySelector('.wrap > .toolbar .sub');
    if (headerSub) {
      headerSub.textContent = `${REVISION} — Form SO Material/Jasa, Submit di bagian akhir, PDF Penawaran.`;
    }
  }

  function install() {
    installStyles();
    ensureBottomActions();
    monitorSubmitLabel();
    monitorSalesOrderTable();
    updateRevisionLabel();

    window.setTimeout(() => {
      ensureBottomActions();
      normalizeSubmitLabel();
      ensureQuotationActions();
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
