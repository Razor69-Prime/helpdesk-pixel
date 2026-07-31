'use strict';

// PXL-STG-0004E
// Memberikan akses baca Inventory terbatas untuk pencarian Material Request teknisi.
// Tidak membuka akses tambah, edit, hapus, penyesuaian stok, atau menu Inventory.

const express = require('express');
const originalGet = express.application.get;

function safeNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function sanitizeItem(item) {
  return {
    id: item.id || item.inventory_item_id || item.item_id || null,
    name: item.name || item.item_name || item.product_name || '',
    sku: item.sku || item.no_sku || item.sku_number || item.product_code || null,
    barcode: item.barcode || item.barcode_value || item.ean || null,
    product_number: item.product_number || item.part_number || item.model || null,
    unit: item.unit || item.satuan || 'pcs',
    stock: safeNumber(item.stock, item.qty, item.quantity, item.current_stock, item.available_stock, item.stock_available)
  };
}

async function technicianInventoryLookup(req, res) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
    }

    const db = require('./db');
    if (typeof db.getInventoryItems !== 'function') {
      return res.status(500).json({ error: 'Adapter Inventory tidak tersedia.' });
    }

    const rows = await db.getInventoryItems();
    return res.json((Array.isArray(rows) ? rows : []).map(sanitizeItem).filter(item => item.id && item.name));
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
}

function runHandlers(handlers, req, res, index = 0) {
  if (index >= handlers.length || res.headersSent) return;
  const handler = handlers[index];
  let nextCalled = false;
  const next = error => {
    if (nextCalled || res.headersSent) return;
    nextCalled = true;
    if (error) return res.status(500).json({ error: String(error.message || error) });
    return runHandlers(handlers, req, res, index + 1);
  };
  try {
    const result = handler(req, res, next);
    if (result && typeof result.catch === 'function') {
      result.catch(error => {
        if (!res.headersSent) res.status(500).json({ error: String(error.message || error) });
      });
    }
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: String(error.message || error) });
  }
}

express.application.get = function pxl0004eGet(path, ...handlers) {
  if (path === '/api/inventory/items' && handlers.length) {
    const originalHandlers = [...handlers];
    handlers = [function inventoryAccessBridge(req, res) {
      const role = String(req.session?.user?.role || '').toLowerCase();
      if (role === 'technician') return technicianInventoryLookup(req, res);
      return runHandlers(originalHandlers, req, res);
    }];
  }
  return originalGet.call(this, path, ...handlers);
};
