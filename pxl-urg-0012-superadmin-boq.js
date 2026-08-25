'use strict';

// PXL-URG-0012 — Superadmin harus selalu memiliki full access ke Input Total BOQ.
// Patch ini hanya membungkus middleware requireProjectBoqAccess pada saat route
// Project BOQ didaftarkan. Role selain superadmin tetap menggunakan validasi existing.

const express = require('express');
const PATCH_KEY = Symbol.for('pxl.urg.0012.superadmin.boq');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  ['put','post','patch','delete'].forEach(method => {
    const original = express.application[method];
    if (typeof original !== 'function') return;
    express.application[method] = function pxlUrg0012ProjectBoq(path, ...handlers) {
      const route = String(path || '');
      const isBoqRoute =
        route === '/api/project-reports/:projectId/boq' ||
        route === '/api/project-reports/:projectId/items' ||
        route === '/api/project-reports/:projectId/items/import' ||
        route === '/api/project-report-items/:id';

      if (isBoqRoute) {
        handlers = handlers.map(handler => {
          if (typeof handler !== 'function' || handler.name !== 'requireProjectBoqAccess') return handler;
          return function superadminProjectBoqAccess(req, res, next) {
            const role = String(req.session?.user?.role || '').trim().toLowerCase().replace(/[ _-]/g, '');
            if (role === 'superadmin') return next();
            return handler(req, res, next);
          };
        });
      }
      return original.call(this, path, ...handlers);
    };
  });
}
