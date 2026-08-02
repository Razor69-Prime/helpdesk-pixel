'use strict';

/** PXL-STG-0007S — batasi pemindahan tanggal berdasarkan status WO. */
const express = require('express');
const originalPatch = express.application.patch;

const norm = value => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const dateOnly = value => {
  const valueString = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(valueString) ? valueString : null;
};
const same = (left, right) => String(left ?? '') === String(right ?? '');
const allowedStatuses = new Set([
  'selesai', 'done', 'completed', 'closed',
  'assigned',
  'menunggu', 'waiting', 'pending'
]);

async function guardScheduleDateMove(req, res, next) {
  try {
    const requestedDate = dateOnly(req.body?.scheduled_date);
    if (!requestedDate) return next();

    const db = require('./db');
    const rows = await db.getTickets(null, true);
    const ticket = Array.isArray(rows)
      ? rows.find(row => same(row.id, req.params.ticketId))
      : null;
    if (!ticket) return next();

    const currentDate = dateOnly(ticket.worked_at) || dateOnly(ticket.scheduled_date);
    if (!currentDate || currentDate === requestedDate) return next();

    const status = norm(ticket.status);
    if (allowedStatuses.has(status)) return next();

    return res.status(409).json({
      error: 'Tanggal WO hanya dapat dipindahkan saat status Selesai, Assigned, atau Menunggu.',
      code: 'SCHEDULE_DATE_STATUS_LOCKED',
      current_status: ticket.status || null,
      current_date: currentDate,
      requested_date: requestedDate
    });
  } catch (error) {
    return res.status(500).json({
      error: String(error?.message || error),
      code: 'SCHEDULE_STATUS_GUARD_FAILED'
    });
  }
}

express.application.patch = function pxlStg0007sPatch(path, ...handlers) {
  if (path === '/api/technician-kanban/:ticketId/schedule') {
    return originalPatch.call(this, path, guardScheduleDateMove, ...handlers);
  }
  return originalPatch.call(this, path, ...handlers);
};
