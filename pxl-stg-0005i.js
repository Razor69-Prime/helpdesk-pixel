'use strict';

// PXL-STG-0005I — pertahankan relasi WO lama saat update pemakaian/pengembalian MR.
const express = require('express');
const originalPatch = express.application.patch;

function same(a, b) {
  return String(a == null ? '' : a) === String(b == null ? '' : b);
}

async function preserveExistingWorkOrder(req, res, next) {
  if (req.body?.ticket_id) return next();
  try {
    const db = require('./db');
    const rows = await db.getMRForms();
    const existing = (rows || []).find(row => same(row.id, req.params.id));
    if (existing?.ticket_id) req.body.ticket_id = existing.ticket_id;
    if (!req.body?.wo_number && existing?.wo_number) req.body.wo_number = existing.wo_number;
  } catch (_) {
    // CRM MR ditangani handler integrasi existing; jangan memblokir update bila bukan legacy MR.
  }
  next();
}

express.application.patch = function pxl0005iPatch(path, ...handlers) {
  if (path === '/api/material-requests-form/:id' && handlers.length) {
    handlers.splice(Math.max(0, handlers.length - 1), 0, preserveExistingWorkOrder);
  }
  return originalPatch.call(this, path, ...handlers);
};
