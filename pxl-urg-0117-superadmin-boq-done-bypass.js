'use strict';

// PXL-URG-0117 — allow Superadmin to correct Detail BOQ below historical Total Done.
// Non-Superadmin keeps the existing server-side block unchanged.
// The bypass is request-scoped and consumed only for the first achievement lookup
// made by PATCH /api/project-report-items/:id, so other Project Report calculations
// continue to use the real achievement history.

const express = require('express');
const { AsyncLocalStorage } = require('node:async_hooks');

const PATCH_KEY = Symbol.for('pxl.urg.0117.superadmin.boq.done.bypass');
const DB_PATCH_KEY = Symbol.for('pxl.urg.0117.superadmin.boq.done.db');
const context = global[Symbol.for('pxl.urg.0117.superadmin.boq.done.context')] || new AsyncLocalStorage();
global[Symbol.for('pxl.urg.0117.superadmin.boq.done.context')] = context;

function normalizedRole(req){
  return String(req?.session?.user?.role || '').trim().toLowerCase().replace(/[ _-]/g,'');
}
function shouldBypass(req, route){
  return route === '/api/project-report-items/:id' &&
    normalizedRole(req) === 'superadmin' &&
    req?.body?.boq_qty !== undefined;
}

function ensureDbPatch(){
  if (global[DB_PATCH_KEY]) return;
  const db = require('./db');
  const originalGetAchievements = db.getProjectReportItemAchievements;
  if (typeof originalGetAchievements !== 'function') return;
  global[DB_PATCH_KEY] = true;
  db.getProjectReportItemAchievements = async function pxlUrg0117GetAchievements(itemId, ...args) {
    const store = context.getStore();
    if (store && store.consumeDoneBypass === true && String(store.itemId) === String(itemId)) {
      store.consumeDoneBypass = false;
      return [];
    }
    return originalGetAchievements.call(this, itemId, ...args);
  };
}


if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  const originalPatch = express.application.patch;
  express.application.patch = function pxlUrg0117Patch(route, ...handlers) {
    const routeText = String(route || '');
    if (routeText === '/api/project-report-items/:id') {
      ensureDbPatch();
      handlers = handlers.map(handler => {
        if (typeof handler !== 'function' || handler.name === 'requireProjectBoqAccess') return handler;
        return function superadminBoqDoneOverride(req, res, next) {
          if (!shouldBypass(req, routeText)) return handler(req, res, next);
          return context.run({ itemId:String(req.params?.id || ''), consumeDoneBypass:true }, () => handler(req, res, next));
        };
      });
    }
    return originalPatch.call(this, route, ...handlers);
  };
}

module.exports = { normalizedRole, shouldBypass };
