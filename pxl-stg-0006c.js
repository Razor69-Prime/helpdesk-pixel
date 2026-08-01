'use strict';

/**
 * PXL-STG-0006C
 * Endpoint pembacaan snapshot revisi quotation.
 * PDF dibuat di browser agar Draft maupun Approved dapat diunduh tanpa membuat file permanen.
 */

const express = require('express');
const PATCH_KEY = Symbol.for('pxl.stg.0006c.quotation.routes');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  installQuotationRoutes();
}

function installQuotationRoutes() {
  const originalGet = express.application.get;
  let registered = false;

  express.application.get = function pxlStg0006CGet(path, ...handlers) {
    const result = originalGet.call(this, path, ...handlers);

    if (!registered && path === '/api/sales-orders/options' && handlers.length) {
      registered = true;
      const readGuard = handlers[0];

      originalGet.call(
        this,
        '/api/sales-orders/:id/quotation-revisions',
        readGuard,
        async function getQuotationRevisions(req, res) {
          try {
            const db = require('./db');
            const salesOrders = await db.getSalesOrders();
            const salesOrder = salesOrders.find(row => String(row.id) === String(req.params.id));
            if (!salesOrder) return res.status(404).json({ error: 'Sales Order tidak ditemukan.' });

            const rows = typeof db.getSalesOrderQuotationRevisions === 'function'
              ? await db.getSalesOrderQuotationRevisions(salesOrder.id)
              : [];

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return res.json({
              sales_order_id: salesOrder.id,
              so_number: salesOrder.so_number,
              quotation_number: salesOrder.quotation_number,
              current_revision: Number(salesOrder.quotation_revision_no ?? salesOrder.revision_no ?? 0),
              revisions: Array.isArray(rows) ? rows : []
            });
          } catch (error) {
            return res.status(500).json({ error: error.message });
          }
        }
      );
    }

    return result;
  };
}
