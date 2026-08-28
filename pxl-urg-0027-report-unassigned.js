'use strict';

/**
 * PXL-URG-0027 — Input Laporan boleh dibuat tanpa assign teknisi.
 *
 * Scope:
 * - Hanya POST /api/tickets dari role yang memang boleh assign teknisi
 *   (admin, superadmin, manager, operator).
 * - Teknisi 1 dan Teknisi 2 menjadi opsional saat membuat laporan.
 * - Jika tidak ada teknisi dipilih, ticket disimpan dengan technicians=[] dan
 *   technician=null, bukan otomatis memakai nama akun pembuat.
 * - Flow teknisi biasa tetap self-assign seperti logic existing.
 * - Flow Assign/Ganti Teknisi existing tidak diubah.
 */
const express = require('express');
const db = require('./db');
const PATCH_KEY = Symbol.for('pxl.urg.0027.report.unassigned');
const SENTINEL = '__PXL_UNASSIGNED__';

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  install();
}

function install() {
  // Bersihkan sentinel tepat sebelum data ticket ditulis ke DB.
  if (!db.__pxlUrg0027InsertTicketWrapped && typeof db.insertTicket === 'function') {
    db.__pxlUrg0027InsertTicketWrapped = true;
    const originalInsertTicket = db.insertTicket;
    db.insertTicket = async function insertTicket0027(data) {
      const technicians = Array.isArray(data?.technicians) ? data.technicians : [];
      const unassigned = technicians.includes(SENTINEL) || data?.technician === SENTINEL;
      if (!unassigned) return originalInsertTicket.call(db, data);

      return originalInsertTicket.call(db, {
        ...data,
        technicians: [],
        technician: null
      });
    };
  }

  if (express.application.__pxlUrg0027PostWrapped) return;
  express.application.__pxlUrg0027PostWrapped = true;
  const originalPost = express.application.post;

  express.application.post = function pxlUrg0027Post(path, ...handlers) {
    if (path === '/api/tickets' && handlers.length) {
      const allowUnassignedReport = function allowUnassignedReport(req, _res, next) {
        const role = String(req.session?.user?.role || '').trim().toLowerCase();
        const canAssign = ['admin', 'superadmin', 'manager', 'operator'].includes(role);
        if (!canAssign) return next();

        const body = req.body || {};
        const raw = body.technicians ?? body.technician ?? body.assigned_to;
        const values = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
        if (body.assigned_to2 != null) values.push(body.assigned_to2);
        const hasTechnician = values.some(value => String(value || '').trim() !== '');

        // Server existing melakukan fallback ke nama pembuat bila array kosong.
        // Sentinel mencegah fallback tersebut, lalu dibersihkan sebelum insert DB.
        if (!hasTechnician) {
          body.assigned_to = SENTINEL;
          body.assigned_to2 = '';
        }
        req.body = body;
        next();
      };
      handlers.unshift(allowUnassignedReport);
    }
    return originalPost.call(this, path, ...handlers);
  };

  console.log('[PXL-URG-0027] Input Laporan supports unassigned Work Order.');
}
