'use strict';

/* PXL-URG-0021 — keep manual Sales Order materials out of Material Request. */
const express = require('express');
const PATCH_KEY = Symbol.for('pxl.urg.0021.manual-material-mr');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  installPatch();
}

function isInventoryMaterial(item) {
  const type = String(item?.item_type || item?.type || 'item').toLowerCase();
  const inventoryId = String(item?.inventory_item_id || '');
  return !['service', 'jasa'].includes(type)
    && item?.manual_material !== true
    && !inventoryId.startsWith('manual:')
    && Boolean(inventoryId);
}

function normalizedInventoryItems(so) {
  return (Array.isArray(so?.items) ? so.items : [])
    .filter(isInventoryMaterial)
    .map(item => ({
      inventory_item_id: item.inventory_item_id,
      name: item.item_name || item.name,
      qty: Number(item.qty || 0),
      unit: item.unit || 'pcs',
      stock_at_request: item.stock_at_select ?? null
    }));
}

function installPatch() {
  const originalPost = express.application.post;

  express.application.post = function pxlUrg0021Post(path, ...handlers) {
    if (path === '/api/sales-orders/:id/material-request' && handlers.length) {
      handlers[handlers.length - 1] = async function pxlUrg0021MaterialRequest(req, res) {
        try {
          const db = require('./db');
          const so = (await db.getSalesOrders()).find(row => String(row.id) === String(req.params.id));
          if (!so) return res.status(404).json({ error: 'SO tidak ditemukan' });
          if (!so.linked_work_order_id) return res.status(400).json({ error: 'Buat Work Order terlebih dahulu.' });

          const all = await db.getCrmMaterialRequests();
          let mr = all.find(row =>
            String(row.sales_order_id || '') === String(so.id)
            && String(row.work_order_id || '') === String(so.linked_work_order_id)
            && !['cancelled', 'void'].includes(String(row.status || '').toLowerCase())
          );
          let created = false;

          if (!mr) {
            const items = normalizedInventoryItems(so);
            if (!items.length) {
              return res.status(400).json({ error: 'SO tidak memiliki material Inventory untuk Material Request. Material manual tidak masuk Material Request.' });
            }
            mr = await db.insertCrmMaterialRequest({
              sales_order_id: so.id,
              so_number: so.so_number,
              work_order_id: so.linked_work_order_id,
              wo_number: so.linked_wo_number,
              customer_name: so.customer_name,
              items,
              technician: null,
              created_by: req.session?.user?.name || 'System'
            });
            created = true;
          }
          return res.status(created ? 201 : 200).json({ created, material_request: mr });
        } catch (error) {
          return res.status(500).json({ error: error.message });
        }
      };
    }

    if (path === '/api/crm/material-requests/from-so/:soId' && handlers.length) {
      handlers[handlers.length - 1] = async function pxlUrg0021CrmMaterialRequest(req, res) {
        try {
          const db = require('./db');
          const so = (await db.getSalesOrders()).find(row => String(row.id) === String(req.params.soId));
          if (!so) return res.status(404).json({ error: 'SO tidak ditemukan' });
          const items = normalizedInventoryItems(so);
          if (!items.length) return res.status(400).json({ error: 'SO tidak memiliki material Inventory. Material manual tidak masuk Material Request.' });
          const saved = await db.insertCrmMaterialRequest({
            sales_order_id: so.id,
            so_number: so.so_number,
            work_order_id: req.body.work_order_id || null,
            wo_number: req.body.wo_number || null,
            customer_name: so.customer_name,
            items,
            technician: req.body.technician || null,
            created_by: req.session?.user?.name || 'System'
          });
          return res.status(201).json(saved);
        } catch (error) {
          return res.status(500).json({ error: error.message });
        }
      };
    }

    return originalPost.call(this, path, ...handlers);
  };
}
