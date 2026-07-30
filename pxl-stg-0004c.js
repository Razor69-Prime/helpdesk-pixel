'use strict';

// PXL-STG-0004C
// Menyatukan CRM Material Request dari Sales Order dengan menu Form Material Request.
// Tidak mengubah schema dan tidak menyentuh production data.

const express = require('express');
const originalGet = express.application.get;
const originalPatch = express.application.patch;

function same(a, b) {
  return String(a == null ? '' : a) === String(b == null ? '' : b);
}

function technicianAssigned(ticket, user) {
  if (!ticket || !user) return false;
  const name = String(user.name || '').trim().toLowerCase();
  const id = String(user.id || '');
  const technicians = Array.isArray(ticket.technicians) ? ticket.technicians : [];
  return technicians.some(value => String(value || '').trim().toLowerCase() === name || String(value || '') === id)
    || String(ticket.technician || '').trim().toLowerCase() === name
    || String(ticket.technician_id || '') === id;
}

function stockStatus(items) {
  const rows = Array.isArray(items) ? items : [];
  const hasShortage = rows.some(item => Number(item.qty_shortage || 0) > 0 || ['shortage', 'empty'].includes(String(item.stock_status || '')));
  return hasShortage ? 'waiting_stock' : 'verified_signed';
}

function toLegacyForm(mr, crmWo, ticket) {
  const issued = String(mr.status || '') === 'issued';
  const verified = ['verified_signed', 'waiting_stock', 'issued'].includes(String(mr.status || ''));
  return {
    ...mr,
    id: mr.id,
    crm_material_request: true,
    source_type: 'sales_order',
    source_label: 'Sales Order',
    ticket_id: crmWo?.ticket_id || ticket?.id || null,
    wo_number: mr.wo_number || crmWo?.wo_number || ticket?.wo_number || null,
    project_name: ticket?.project_name || ticket?.description || `Material dari ${mr.so_number || 'Sales Order'}`,
    technician: mr.technician || (Array.isArray(ticket?.technicians) ? ticket.technicians.join(' & ') : ticket?.technician) || null,
    date_out: mr.created_at ? String(mr.created_at).slice(0, 10) : null,
    date_return: mr.verified_at ? String(mr.verified_at).slice(0, 10) : null,
    // UI existing memakai taken untuk membuka tahap tanda tangan teknisi.
    status: verified ? 'returned' : 'taken',
    crm_status: mr.status,
    items: (mr.items || []).map(item => ({
      inventory_item_id: item.inventory_item_id || null,
      name: item.name || item.item_name || 'Item',
      unit: item.unit || 'pcs',
      qty_out: Number(item.qty_requested ?? item.qty ?? 0),
      qty_use: verified ? Number(item.qty_requested ?? item.qty ?? 0) : 0,
      qty_return: 0,
      qty_requested: Number(item.qty_requested ?? item.qty ?? 0),
      stock_available: Number(item.stock_available ?? item.stock_at_request ?? 0),
      qty_shortage: Number(item.qty_shortage || 0),
      stock_status: item.stock_status || (Number(item.qty_shortage || 0) > 0 ? 'shortage' : 'enough')
    })),
    requester_signature: mr.requester_signature || null,
    requester_signed_by: mr.created_by || null,
    technician_signature: mr.technician_signature || null,
    technician_signed_by: mr.technician || null,
    technician_note: mr.technician_note || null,
    issued,
    created_at: mr.created_at
  };
}

async function getIntegratedMaterialRequests(req, res) {
  try {
    const db = require('./db');
    const [legacy, crmMrs, crmWos, tickets] = await Promise.all([
      db.getMRForms(),
      db.getCrmMaterialRequests(),
      db.getCrmWorkOrders(),
      db.getTickets(null, true)
    ]);

    const role = String(req.session.user.role || '').toLowerCase();
    const crmRows = (crmMrs || []).map(mr => {
      const crmWo = (crmWos || []).find(wo => same(wo.id, mr.work_order_id));
      const ticket = (tickets || []).find(row => same(row.id, crmWo?.ticket_id));
      return { mr, crmWo, ticket };
    }).filter(({ ticket }) => role !== 'technician' || technicianAssigned(ticket, req.session.user))
      .map(({ mr, crmWo, ticket }) => toLegacyForm(mr, crmWo, ticket));

    const legacyRows = role === 'technician'
      ? (legacy || []).filter(row => {
          const ticket = (tickets || []).find(ticket => same(ticket.id, row.ticket_id));
          return technicianAssigned(ticket, req.session.user) || String(row.technician || '').trim().toLowerCase() === String(req.session.user.name || '').trim().toLowerCase();
        })
      : (legacy || []);

    res.json([...crmRows, ...legacyRows]);
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
}

async function verifyIntegratedMaterialRequest(req, res, legacyHandler) {
  try {
    const db = require('./db');
    const crmRows = await db.getCrmMaterialRequests();
    const mr = (crmRows || []).find(row => same(row.id, req.params.id));
    if (!mr) return legacyHandler(req, res);

    const signature = req.body.technician_signature;
    if (!signature) return res.status(400).json({ error: 'Tanda tangan teknisi wajib diisi.' });
    if (String(mr.status || '') === 'issued') return res.status(409).json({ error: 'Material Request sudah dikeluarkan gudang.' });

    const verifiedItems = (req.body.items || []).map(item => ({
      inventory_item_id: item.inventory_item_id || null,
      name: item.name || 'Item',
      unit: item.unit || 'pcs',
      qty_requested: Number(item.qty_requested ?? item.qty_out ?? 0),
      qty_verified: Number(item.qty_use ?? item.qty_requested ?? item.qty_out ?? 0),
      qty_return: Number(item.qty_return || 0),
      stock_available: Number(item.stock_available || 0),
      qty_shortage: Number(item.qty_shortage || 0),
      stock_status: item.stock_status || (Number(item.qty_shortage || 0) > 0 ? 'shortage' : 'enough')
    }));

    const status = stockStatus((mr.items || []).length ? mr.items : verifiedItems);
    const updated = await db.updateCrmMaterialRequest(mr.id, {
      status,
      technician: req.session.user.name,
      technician_note: req.body.technician_note || req.body.notes || null,
      technician_signature: signature,
      verified_at: new Date().toISOString(),
      verified_items: verifiedItems
    });

    const crmWo = (await db.getCrmWorkOrders()).find(wo => same(wo.id, updated.work_order_id));
    const ticket = (await db.getTickets(null, true)).find(row => same(row.id, crmWo?.ticket_id));
    res.json(toLegacyForm(updated, crmWo, ticket));
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
}

express.application.get = function pxl0004cGet(path, ...handlers) {
  if (path === '/api/material-requests-form' && handlers.length) {
    handlers[handlers.length - 1] = getIntegratedMaterialRequests;
  }
  return originalGet.call(this, path, ...handlers);
};

express.application.patch = function pxl0004cPatch(path, ...handlers) {
  if (path === '/api/material-requests-form/:id' && handlers.length) {
    const legacyHandler = handlers[handlers.length - 1];
    handlers[handlers.length - 1] = (req, res) => verifyIntegratedMaterialRequest(req, res, legacyHandler);
  }
  return originalPatch.call(this, path, ...handlers);
};
