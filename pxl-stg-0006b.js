'use strict';

/**
 * PXL-STG-0006B
 * Validasi backend Sales Order untuk Material/Barang dan Jasa/Pekerjaan.
 *
 * Material wajib memiliki inventory_item_id.
 * Jasa tidak membutuhkan inventory_item_id dan akan disimpan sebagai item_type=service.
 * Flow Material Request PXL-STG-0005 tidak diubah.
 */

const express = require('express');
const PATCH_KEY = Symbol.for('pxl.stg.0006b.sales-order-routes');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  installSalesOrderRoutePatch();
}

function installSalesOrderRoutePatch() {
  const originalPost = express.application.post;
  const originalPatch = express.application.patch;

  function validationError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  function numberValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeItems(rawItems) {
    const source = Array.isArray(rawItems) ? rawItems : [];
    const items = source.map((raw, index) => {
      const rawType = String(raw?.item_type || raw?.type || 'item').trim().toLowerCase();
      const itemType = ['service', 'jasa'].includes(rawType) ? 'service' : 'item';
      const name = String(raw?.name || raw?.item_name || '').trim();
      const qty = numberValue(raw?.qty);
      const unitPrice = numberValue(raw?.unit_price ?? raw?.price);
      const unit = String(raw?.unit || (itemType === 'service' ? 'jasa' : 'pcs')).trim();

      if (!name) throw validationError(`Nama ${itemType === 'service' ? 'jasa' : 'material'} pada baris ${index + 1} wajib diisi.`);
      if (qty <= 0) throw validationError(`Qty ${name} harus lebih dari 0.`);
      if (unitPrice < 0) throw validationError(`Harga satuan ${name} tidak boleh negatif.`);
      if (!unit) throw validationError(`Satuan ${name} wajib diisi.`);
      if (itemType === 'item' && !raw?.inventory_item_id) {
        throw validationError(`Material ${name} wajib dipilih dari Inventory.`);
      }

      return {
        ...raw,
        inventory_item_id: itemType === 'service' ? null : raw.inventory_item_id,
        name,
        item_name: name,
        item_type: itemType,
        qty,
        unit,
        unit_price: unitPrice,
        line_total: Number((qty * unitPrice).toFixed(2))
      };
    });

    if (!items.length) throw validationError('Minimal satu Material atau Jasa wajib ditambahkan.');
    return items;
  }

  function validateHeader(body) {
    if (!String(body?.customer_name || '').trim()) throw validationError('Customer wajib diisi.');
    if (!body?.sales_pic_user_id) throw validationError('Sales PIC wajib dipilih dari akun Sales.');
    if (!String(body?.project_name || '').trim()) throw validationError('Nama project wajib diisi.');
    if (!String(body?.address || body?.location || '').trim()) throw validationError('Alamat/lokasi pekerjaan wajib diisi.');
  }

  function preparePayload(body) {
    validateHeader(body);
    const items = normalizeItems(body?.items);
    const materialSubtotal = items
      .filter(item => item.item_type === 'item')
      .reduce((sum, item) => sum + item.line_total, 0);
    const serviceSubtotal = items
      .filter(item => item.item_type === 'service')
      .reduce((sum, item) => sum + item.line_total, 0);
    const total = Number((materialSubtotal + serviceSubtotal).toFixed(2));

    return {
      ...body,
      items,
      material_subtotal: Number(materialSubtotal.toFixed(2)),
      service_subtotal: Number(serviceSubtotal.toFixed(2)),
      quotation_total: total,
      total_amount: total,
      quotation_title: String(body?.quotation_title || body?.project_name || 'Penawaran').trim()
    };
  }

  function createSalesOrderHandler() {
    return async function pxlStg0006BCreateSalesOrder(req, res) {
      try {
        const db = require('./db');
        const payload = preparePayload(req.body || {});
        const saved = await db.insertSalesOrder({
          ...payload,
          status: 'draft',
          created_by: req.session?.user?.name || 'System'
        });
        return res.status(201).json(saved);
      } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.message });
      }
    };
  }

  function updateSalesOrderHandler() {
    return async function pxlStg0006BUpdateSalesOrder(req, res) {
      try {
        const db = require('./db');
        const salesOrders = await db.getSalesOrders();
        const oldRow = salesOrders.find(row => String(row.id) === String(req.params.id));
        if (!oldRow) return res.status(404).json({ error: 'SO tidak ditemukan.' });
        if (req.body?.delete === true) {
          return res.status(400).json({ error: 'Sales Order tidak dapat dihapus. Gunakan status void/cancelled.' });
        }
        if (String(oldRow.status || '').toLowerCase() !== 'draft') {
          return res.status(400).json({ error: 'Hanya SO Draft yang dapat diedit.' });
        }

        const payload = preparePayload({ ...oldRow, ...req.body });
        const history = [
          ...(Array.isArray(oldRow.history) ? oldRow.history : []),
          {
            at: new Date().toISOString(),
            by: req.session?.user?.name || 'System',
            action: 'update',
            status: oldRow.status || 'draft',
            revision: Number(oldRow.quotation_revision_no ?? oldRow.revision_no ?? 0) + 1
          }
        ];

        const saved = await db.updateSalesOrder(req.params.id, {
          ...req.body,
          ...payload,
          history,
          updated_by: req.session?.user?.name || 'System'
        });
        return res.json(saved);
      } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.message });
      }
    };
  }

  express.application.post = function pxlStg0006BPost(path, ...handlers) {
    if (path === '/api/sales-orders' && handlers.length) {
      handlers[handlers.length - 1] = createSalesOrderHandler();
    }
    return originalPost.call(this, path, ...handlers);
  };

  express.application.patch = function pxlStg0006BPatch(path, ...handlers) {
    if (path === '/api/sales-orders/:id' && handlers.length) {
      handlers[handlers.length - 1] = updateSalesOrderHandler();
    }
    return originalPatch.call(this, path, ...handlers);
  };
}
