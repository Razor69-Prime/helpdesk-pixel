'use strict';

/* PXL-URG-0014 — Sales Order approval -> Work Order permission bridge. */
const express = require('express');
const PATCH_KEY = Symbol.for('pxl.urg.0014.sales-order-work-order-permission');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  installPatch();
}

function canCreateWorkOrder(req) {
  const user = req.session?.user || {};
  const role = String(user.role || '').toLowerCase();
  const custom = Array.isArray(user.custom_menus) ? user.custom_menus : [];
  if (role === 'superadmin') return true;
  return custom.includes('sales_order_create_wo') || custom.includes('sales_order_approve');
}

function requireCreateWorkOrder(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!canCreateWorkOrder(req)) {
    return res.status(403).json({ error: 'Anda tidak memiliki izin untuk membuat Work Order dari Sales Order.' });
  }
  next();
}

function installPatch() {
  const originalGet = express.application.get;
  const originalPost = express.application.post;

  express.application.get = function pxlUrg0014Get(path, ...handlers) {
    if (path === '/api/sales-orders/options' && handlers.length) {
      const originalHandler = handlers[handlers.length - 1];
      handlers[handlers.length - 1] = async function pxlUrg0014Options(req, res, next) {
        const originalJson = res.json.bind(res);
        res.json = function pxlUrg0014Json(payload) {
          if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            payload = { ...payload, can_issue: canCreateWorkOrder(req) };
          }
          return originalJson(payload);
        };
        return originalHandler(req, res, next);
      };
    }
    return originalGet.call(this, path, ...handlers);
  };

  express.application.post = function pxlUrg0014Post(path, ...handlers) {
    if (path === '/api/sales-orders/:id/work-order' && handlers.length >= 2) {
      handlers[0] = requireCreateWorkOrder;
    }
    return originalPost.call(this, path, ...handlers);
  };
}
