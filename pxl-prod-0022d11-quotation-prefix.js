'use strict';

/**
 * PXL-PROD-0022D11 — Split quotation numbering for NEW Sales Orders only.
 *
 * Rules:
 * - Project / CK identity      => QTNCK-xxxxx
 * - Operational / Pixel       => QTNPXL-xxxxx
 * - SO numbering is untouched.
 * - Existing quotation/SO numbers are never rewritten.
 * - Each quotation prefix advances independently from the highest existing
 *   number with the same prefix.
 */
const PATCH_KEY = Symbol.for('pxl.prod.0022d11.quotation.prefix');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  process.nextTick(installQuotationPrefixSplit);
}

function installQuotationPrefixSplit() {
  const db = require('./db');
  if (!db || db.__pxlProd0022D11Installed) return;

  Object.defineProperty(db, '__pxlProd0022D11Installed', {
    value: true,
    enumerable: false,
    configurable: false
  });

  const originalInsertSalesOrder = db.insertSalesOrder;
  if (typeof originalInsertSalesOrder !== 'function') return;

  function isProjectSalesOrder(data) {
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.some(item =>
      item?.site_id != null
      || String(item?.site_name || '').trim() !== ''
      || item?.site_order != null
      || item?.site_item_order != null
    );
  }

  function getPrefix(data) {
    return isProjectSalesOrder(data) ? 'QTNCK' : 'QTNPXL';
  }

  async function nextQuotationNumber(prefix) {
    const rows = await db.getSalesOrders();
    const pattern = new RegExp('^' + prefix + '-(\\d+)$', 'i');
    let max = 0;

    (Array.isArray(rows) ? rows : []).forEach(row => {
      const match = String(row?.quotation_number || '').trim().match(pattern);
      if (!match) return;
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > max) max = value;
    });

    return `${prefix}-${String(max + 1).padStart(5, '0')}`;
  }

  function isDuplicateQuotationError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('quotation_number')
      && (message.includes('duplicate') || message.includes('unique') || message.includes('already exists'));
  }

  db.insertSalesOrder = async function insertSalesOrder0022D11(data) {
    // Respect an explicitly supplied quotation number. This protects imports,
    // restores, and all existing edit/update flows.
    if (String(data?.quotation_number || '').trim()) {
      return originalInsertSalesOrder.call(db, data);
    }

    const prefix = getPrefix(data);
    let lastError = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const quotationNumber = await nextQuotationNumber(prefix);
      try {
        return await originalInsertSalesOrder.call(db, {
          ...data,
          quotation_number: quotationNumber
        });
      } catch (error) {
        lastError = error;
        if (!isDuplicateQuotationError(error)) throw error;
      }
    }

    throw lastError || new Error('Gagal membuat nomor quotation baru.');
  };

  console.log('[PXL-PROD-0022D11] quotation prefix split active: Project=QTNCK, Operational=QTNPXL');
}
