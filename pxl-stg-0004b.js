'use strict';

// PXL-STG-0004B — Material Request teknisi, reminder stok, dan pengeluaran penuh.
// Dimuat sebelum server.js mendaftarkan route. Tidak berisi credential.
const express = require('express');
const originalGet = express.application.get;
const originalPost = express.application.post;

const text = value => String(value == null ? '' : value).trim();
const num = value => Number(value || 0);
const activeMr = status => !['cancelled', 'void'].includes(text(status).toLowerCase());

async function inventorySnapshot(db, rawItems) {
  const inventory = await db.getInventoryItems();
  return (Array.isArray(rawItems) ? rawItems : [])
    .filter(item => text(item.item_type || 'item') !== 'service')
    .map(item => {
      const inventoryItem = inventory.find(row => String(row.id) === String(item.inventory_item_id));
      const requested = num(item.qty_requested ?? item.qty);
      const available = num(inventoryItem?.stock);
      const shortage = Math.max(0, requested - available);
      return {
        ...item,
        inventory_item_id: item.inventory_item_id || null,
        name: text(item.name || item.item_name || inventoryItem?.name),
        qty: requested,
        qty_requested: requested,
        unit: text(item.unit || inventoryItem?.unit) || 'pcs',
        stock_available: available,
        stock_at_request: item.stock_at_request == null ? available : num(item.stock_at_request),
        qty_shortage: shortage,
        stock_status: available <= 0 ? 'empty' : shortage > 0 ? 'shortage' : 'enough'
      };
    });
}

async function locateCrmWo(db, so) {
  const rows = await db.getCrmWorkOrders();
  return rows.find(row =>
    (so.linked_crm_work_order_id && String(row.id) === String(so.linked_crm_work_order_id)) ||
    String(row.sales_order_id || '') === String(so.id) ||
    (so.linked_work_order_id && String(row.ticket_id || '') === String(so.linked_work_order_id))
  ) || null;
}

async function createOrOpenMr(req, res) {
  try {
    const db = require('./db');
    const soId = req.params.id || req.params.soId;
    const so = (await db.getSalesOrders()).find(row => String(row.id) === String(soId));
    if (!so) return res.status(404).json({ error: 'Sales Order tidak ditemukan.' });
    if (!so.linked_work_order_id) return res.status(400).json({ error: 'Buat Work Order terlebih dahulu.' });

    const crmWo = await locateCrmWo(db, so);
    if (!crmWo) return res.status(409).json({ error: 'CRM Work Order belum tersedia. Buka Work Order lalu muat ulang halaman.' });
    if (String(so.linked_crm_work_order_id || '') !== String(crmWo.id)) {
      await db.updateSalesOrder(so.id, { linked_crm_work_order_id: crmWo.id });
    }

    const existing = (await db.getCrmMaterialRequests()).find(row =>
      String(row.sales_order_id || '') === String(so.id) &&
      String(row.work_order_id || '') === String(crmWo.id) && activeMr(row.status)
    );
    if (existing) {
      const items = await inventorySnapshot(db, existing.items);
      const shortage = items.some(item => item.qty_shortage > 0);
      const desiredStatus = existing.status === 'issued' ? 'issued' : existing.status === 'verified_signed'
        ? (shortage ? 'waiting_stock' : 'verified_signed') : existing.status;
      const updated = await db.updateCrmMaterialRequest(existing.id, { items, status: desiredStatus });
      return res.json({ created: false, material_request: updated });
    }

    const items = await inventorySnapshot(db, so.items);
    if (!items.length) return res.status(400).json({ error: 'SO tidak memiliki item Inventory untuk Material Request.' });
    if (items.some(item => !item.inventory_item_id || item.qty_requested <= 0)) {
      return res.status(400).json({ error: 'Ada item SO yang belum terhubung ke Inventory atau quantity tidak valid.' });
    }

    const mr = await db.insertCrmMaterialRequest({
      sales_order_id: so.id,
      so_number: so.so_number,
      work_order_id: crmWo.id,
      wo_number: crmWo.wo_number || so.linked_wo_number,
      customer_name: so.customer_name,
      items,
      status: 'waiting_technician_verification',
      technician: null,
      created_by: req.session.user.name
    });

    if (items.some(item => item.qty_shortage > 0)) {
      const detail = items.filter(item => item.qty_shortage > 0)
        .map(item => `${item.name} kurang ${item.qty_shortage} ${item.unit}`).join(', ');
      for (const role of ['manager', 'admin']) {
        await db.insertNotification({ type: 'mr', text: `<b>Stok MR kurang</b> ${mr.mr_number || ''} — ${detail}`,
          target_role: role, ref_id: mr.id, created_by: req.session.user.name });
      }
    }
    return res.status(201).json({ created: true, material_request: mr });
  } catch (error) {
    return res.status(500).json({ error: text(error.message || error) });
  }
}

express.application.get = function pxl0004bGet(path, ...handlers) {
  if (path === '/api/crm/material-requests' && handlers.length) {
    handlers[handlers.length - 1] = async function materialRequestsForRole(req, res) {
      try {
        const db = require('./db');
        let rows = await db.getCrmMaterialRequests();
        if (text(req.session.user.role).toLowerCase() === 'technician') {
          const tickets = await db.getTickets(req.session.user.name, true);
          const ticketIds = new Set(tickets.map(row => String(row.id)));
          const crmWos = await db.getCrmWorkOrders();
          const allowedWoIds = new Set(crmWos.filter(row => ticketIds.has(String(row.ticket_id))).map(row => String(row.id)));
          rows = rows.filter(row => allowedWoIds.has(String(row.work_order_id)));
        }
        const enriched = [];
        for (const row of rows) enriched.push({ ...row, items: await inventorySnapshot(db, row.items) });
        return res.json(enriched);
      } catch (error) { return res.status(500).json({ error: text(error.message || error) }); }
    };
  }
  return originalGet.call(this, path, ...handlers);
};

express.application.post = function pxl0004bPost(path, ...handlers) {
  if ((path === '/api/sales-orders/:id/material-request' || path === '/api/crm/material-requests/from-so/:soId') && handlers.length) {
    handlers[handlers.length - 1] = createOrOpenMr;
  }

  if (path === '/api/crm/material-requests/:id/verify' && handlers.length) {
    handlers[handlers.length - 1] = async function verifyMaterialRequest(req, res) {
      try {
        const db = require('./db');
        const mr = (await db.getCrmMaterialRequests()).find(row => String(row.id) === String(req.params.id));
        if (!mr) return res.status(404).json({ error: 'Material Request tidak ditemukan.' });
        if (mr.status === 'issued') return res.status(409).json({ error: 'Material Request sudah dikeluarkan.' });
        if (!text(req.body.technician_signature)) return res.status(400).json({ error: 'Tanda tangan teknisi wajib diisi.' });

        if (text(req.session.user.role).toLowerCase() === 'technician') {
          const crmWo = (await db.getCrmWorkOrders()).find(row => String(row.id) === String(mr.work_order_id));
          const tickets = await db.getTickets(req.session.user.name, true);
          if (!crmWo || !tickets.some(ticket => String(ticket.id) === String(crmWo.ticket_id))) {
            return res.status(403).json({ error: 'MR ini bukan untuk Work Order yang ditugaskan kepada Anda.' });
          }
        }

        const items = await inventorySnapshot(db, req.body.items || mr.items);
        const shortage = items.some(item => item.qty_shortage > 0);
        const updated = await db.updateCrmMaterialRequest(mr.id, {
          status: shortage ? 'waiting_stock' : 'verified_signed',
          technician: req.session.user.name,
          technician_note: text(req.body.technician_note) || null,
          technician_signature: req.body.technician_signature,
          verified_at: new Date().toISOString(),
          verified_items: items,
          items
        });
        if (shortage) {
          const detail = items.filter(item => item.qty_shortage > 0)
            .map(item => `${item.name} kurang ${item.qty_shortage} ${item.unit}`).join(', ');
          for (const role of ['manager', 'admin']) await db.insertNotification({ type: 'mr',
            text: `<b>MR menunggu stok</b> ${mr.mr_number || ''} — ${detail}`, target_role: role,
            ref_id: mr.id, created_by: req.session.user.name });
        }
        return res.json(updated);
      } catch (error) { return res.status(500).json({ error: text(error.message || error) }); }
    };
  }

  if (path === '/api/crm/material-requests/:id/issue' && handlers.length) {
    const originalHandler = handlers[handlers.length - 1];
    handlers[handlers.length - 1] = async function guardedIssue(req, res) {
      try {
        const db = require('./db');
        const mr = (await db.getCrmMaterialRequests()).find(row => String(row.id) === String(req.params.id));
        if (!mr) return res.status(404).json({ error: 'Material Request tidak ditemukan.' });
        if (mr.status === 'issued') return res.status(409).json({ error: 'Material Request sudah pernah dikeluarkan.' });
        if (!mr.verified_at || !mr.technician_signature || !['verified_signed', 'waiting_stock'].includes(mr.status)) {
          return res.status(409).json({ error: 'Material Request harus diverifikasi dan ditandatangani teknisi terlebih dahulu.' });
        }
        const items = await inventorySnapshot(db, mr.verified_items || mr.items);
        const shortages = items.filter(item => item.qty_shortage > 0);
        if (shortages.length) {
          await db.updateCrmMaterialRequest(mr.id, { status: 'waiting_stock', items, verified_items: items });
          const detail = shortages.map(item => `${item.name}: tersedia ${item.stock_available}, diminta ${item.qty_requested}, kurang ${item.qty_shortage} ${item.unit}`).join('; ');
          return res.status(409).json({ error: `MR tetap tersimpan dan menunggu stok. ${detail}`, waiting_stock: true, items });
        }
        if (mr.status === 'waiting_stock') await db.updateCrmMaterialRequest(mr.id, { status: 'verified_signed', items, verified_items: items });
        req.body = { ...(req.body || {}), items };
        return originalHandler(req, res);
      } catch (error) { return res.status(500).json({ error: text(error.message || error) }); }
    };
  }
  return originalPost.call(this, path, ...handlers);
};
