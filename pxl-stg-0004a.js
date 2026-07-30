'use strict';

// PXL-STG-0004A
// Route hardening loaded by config.js before server.js registers application routes.
// This module does not contain environment variables or credentials.

const express = require('express');
const originalPatch = express.application.patch;
const originalPost = express.application.post;

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items.map(item => ({
    inventory_item_id: cleanText(item.inventory_item_id) || null,
    name: cleanText(item.name || item.item_name),
    item_name: cleanText(item.item_name || item.name),
    qty: Number(item.qty || 0),
    unit: cleanText(item.unit) || 'pcs',
    unit_price: Number(item.unit_price || 0),
    item_type: cleanText(item.item_type) || 'item',
    stock_at_select: item.stock_at_select == null ? null : Number(item.stock_at_select)
  }));
}

function validateDraftPayload(body) {
  const customerName = cleanText(body.customer_name);
  const salesPicUserId = cleanText(body.sales_pic_user_id);
  const salesPic = cleanText(body.sales_pic);
  const projectName = cleanText(body.project_name);
  const address = cleanText(body.address || body.location);
  const items = normalizeItems(body.items);

  if (!customerName) throw new Error('Customer wajib diisi.');
  if (!salesPicUserId || !salesPic) throw new Error('Sales PIC wajib dipilih dari akun Sales.');
  if (!projectName) throw new Error('Nama project wajib diisi.');
  if (!address) throw new Error('Alamat/lokasi pekerjaan wajib diisi.');
  if (!items.length || items.some(item => !item.inventory_item_id || !item.name || !Number.isFinite(item.qty) || item.qty <= 0)) {
    throw new Error('Minimal satu item Inventory dengan quantity valid wajib dipilih.');
  }
  if (items.some(item => !Number.isFinite(item.unit_price) || item.unit_price < 0)) {
    throw new Error('Harga satuan item tidak valid.');
  }

  return {
    customer_name: customerName,
    customer_phone: cleanText(body.customer_phone) || null,
    sales_pic_user_id: salesPicUserId,
    sales_pic: salesPic,
    project_name: projectName,
    address,
    location: address,
    notes: cleanText(body.notes) || null,
    items,
    total_amount: items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
  };
}

async function findCrmWorkOrder(db, so) {
  const workOrders = await db.getCrmWorkOrders();
  return workOrders.find(row =>
    (so.linked_crm_work_order_id && String(row.id) === String(so.linked_crm_work_order_id)) ||
    String(row.sales_order_id || '') === String(so.id) ||
    (so.linked_work_order_id && String(row.ticket_id || '') === String(so.linked_work_order_id))
  ) || null;
}

async function createOrOpenMaterialRequest(req, res) {
  try {
    const db = require('./db');
    const salesOrders = await db.getSalesOrders();
    const so = salesOrders.find(row => String(row.id) === String(req.params.id || req.params.soId));
    if (!so) return res.status(404).json({ error: 'SO tidak ditemukan.' });
    if (!so.linked_work_order_id) return res.status(400).json({ error: 'Buat Work Order terlebih dahulu.' });

    const crmWorkOrder = await findCrmWorkOrder(db, so);
    if (!crmWorkOrder) {
      return res.status(409).json({
        error: 'CRM Work Order belum tersedia. Klik Buat/Buka Work Order terlebih dahulu, lalu muat ulang halaman.'
      });
    }

    if (String(so.linked_crm_work_order_id || '') !== String(crmWorkOrder.id)) {
      await db.updateSalesOrder(so.id, { linked_crm_work_order_id: crmWorkOrder.id });
    }

    const materialRequests = await db.getCrmMaterialRequests();
    let mr = materialRequests.find(row =>
      String(row.sales_order_id || '') === String(so.id) &&
      String(row.work_order_id || '') === String(crmWorkOrder.id) &&
      !['cancelled', 'void'].includes(String(row.status || '').toLowerCase())
    );

    let created = false;
    if (!mr) {
      const items = normalizeItems(so.items)
        .filter(item => item.item_type !== 'service')
        .map(item => ({
          inventory_item_id: item.inventory_item_id,
          name: item.item_name || item.name,
          qty: item.qty,
          unit: item.unit,
          stock_at_request: item.stock_at_select
        }));

      if (!items.length) return res.status(400).json({ error: 'SO tidak memiliki item Inventory untuk Material Request.' });
      if (items.some(item => !item.inventory_item_id || item.qty <= 0)) {
        return res.status(400).json({ error: 'Ada item SO yang belum terhubung ke Inventory atau quantity tidak valid.' });
      }

      mr = await db.insertCrmMaterialRequest({
        sales_order_id: so.id,
        so_number: so.so_number,
        work_order_id: crmWorkOrder.id,
        wo_number: crmWorkOrder.wo_number || so.linked_wo_number,
        customer_name: so.customer_name,
        items,
        technician: null,
        created_by: req.session.user.name
      });
      created = true;
    }

    return res.status(created ? 201 : 200).json({ created, material_request: mr });
  } catch (error) {
    const message = String(error.message || error);
    const status = /foreign key|23503/i.test(message) ? 409 : 500;
    return res.status(status).json({
      error: status === 409
        ? 'Relasi Work Order CRM tidak valid. Muat ulang SO dan klik Buat/Buka Work Order sebelum membuat MR.'
        : message
    });
  }
}

express.application.patch = function pxlPatch(path, ...handlers) {
  if (path === '/api/sales-orders/:id' && handlers.length) {
    handlers[handlers.length - 1] = async function protectedSalesOrderEdit(req, res) {
      try {
        const db = require('./db');
        const old = (await db.getSalesOrders()).find(row => String(row.id) === String(req.params.id));
        if (!old) return res.status(404).json({ error: 'SO tidak ditemukan.' });
        if (String(old.status || '').toLowerCase() !== 'draft') {
          return res.status(409).json({ error: 'Hanya Sales Order berstatus Draft yang dapat diedit.' });
        }

        const payload = validateDraftPayload(req.body || {});
        const history = [...(old.history || []), {
          at: new Date().toISOString(),
          by: req.session.user.name,
          action: 'update',
          from_status: old.status,
          status: 'draft'
        }];

        const updated = await db.updateSalesOrder(old.id, { ...payload, status: 'draft', history });
        return res.json(updated);
      } catch (error) {
        return res.status(400).json({ error: String(error.message || error) });
      }
    };
  }
  return originalPatch.call(this, path, ...handlers);
};

express.application.post = function pxlPost(path, ...handlers) {
  if ((path === '/api/sales-orders/:id/material-request' || path === '/api/crm/material-requests/from-so/:soId') && handlers.length) {
    handlers[handlers.length - 1] = createOrOpenMaterialRequest;
  }
  return originalPost.call(this, path, ...handlers);
};
