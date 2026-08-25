'use strict';

// PXL-URG-0011 — server-side guard untuk urutan WO dan Material Request.
// Material Request bersifat kondisional: WO tanpa kebutuhan/pengambilan material
// tetap dapat diselesaikan. Jika MR ada, material wajib sudah diambil.
// Pengembalian material tetap dilakukan setelah pekerjaan selesai.
// Superadmin memiliki full override untuk penyelesaian WO tanpa signature/MR guard.

const express = require('express');
const originalPost = express.application.post;
const originalPatch = express.application.patch;

const norm = value => String(value == null ? '' : value).trim().toLowerCase();
const same = (a, b) => String(a == null ? '' : a) === String(b == null ? '' : b);
const isDoneStatus = value => ['done', 'selesai', 'completed', 'closed', 'finished'].includes(norm(value));
const isMaterialTaken = value => ['taken', 'diambil', 'issued', 'returned', 'dikembalikan'].includes(norm(value));
const isSuperadmin = req => norm(req.session?.user?.role) === 'superadmin';

async function materialRequestsForTicket(ticketId) {
  const db = require('./db');
  const [legacy, crmRequests, crmWorkOrders] = await Promise.all([
    db.getMRForms(),
    typeof db.getCrmMaterialRequests === 'function' ? db.getCrmMaterialRequests() : [],
    typeof db.getCrmWorkOrders === 'function' ? db.getCrmWorkOrders() : []
  ]);
  const workOrderIds = new Set((crmWorkOrders || [])
    .filter(row => same(row.ticket_id, ticketId))
    .map(row => String(row.id)));
  return [
    ...(legacy || []).filter(row => same(row.ticket_id, ticketId)),
    ...(crmRequests || []).filter(row => workOrderIds.has(String(row.work_order_id)))
  ];
}

async function requireMaterialTaken(req, res, next) {
  try {
    const rows = await materialRequestsForTicket(req.params.id);
    // Tidak semua pekerjaan membutuhkan material. Tanpa MR, WO dapat langsung
    // diselesaikan selama tanda tangan teknisi dan customer sudah lengkap.
    if (!rows.length) return next();
    const notTaken = rows.filter(row => !isMaterialTaken(row.status));
    if (notTaken.length) {
      return res.status(409).json({
        error: 'WO belum dapat diselesaikan. Material Request harus sudah diproses dan material sudah diambil.'
      });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
}

function requireCompletionSignatures(req, res, next) {
  if (!String(req.body?.tech_signature || '').trim()) {
    return res.status(409).json({ error: 'WO belum dapat diselesaikan. Tanda tangan teknisi wajib diisi.' });
  }
  if (!String(req.body?.customer_signature || '').trim()) {
    return res.status(409).json({ error: 'WO belum dapat diselesaikan. Tanda tangan customer wajib diisi.' });
  }
  return next();
}

express.application.post = function pxl0008a30Post(path, ...handlers) {
  if (path === '/api/tickets/:id/stage' && handlers.length) {
    const guard = (req, res, next) => {
      if (norm(req.body?.stage) !== 'selesai') return next();
      if (isSuperadmin(req)) return next();
      return requireCompletionSignatures(req, res, () => requireMaterialTaken(req, res, next));
    };
    handlers.splice(Math.max(0, handlers.length - 1), 0, guard);
  }
  return originalPost.call(this, path, ...handlers);
};

express.application.patch = function pxl0008a30Patch(path, ...handlers) {
  if (path === '/api/tickets/:id' && handlers.length) {
    const guard = (req, res, next) => {
      if (!isDoneStatus(req.body?.status)) return next();
      if (isSuperadmin(req)) return next();
      return requireCompletionSignatures(req, res, () => requireMaterialTaken(req, res, next));
    };
    handlers.splice(Math.max(0, handlers.length - 1), 0, guard);
  }
  return originalPatch.call(this, path, ...handlers);
};
