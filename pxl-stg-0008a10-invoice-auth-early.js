'use strict';

/* PXL-STG-0008A10 — pasang JWT session bridge sebelum route Invoice V1 diregistrasikan. */
const express = require('express');
const jwt = require('jsonwebtoken');
const cfg = require('./config');
const PATCH_KEY = Symbol.for('pxl.stg.0008a10.invoice.auth.early');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  const methods = ['get', 'post', 'patch'];
  const original = Object.fromEntries(methods.map(method => [method, express.application[method]]));
  const originalUse = express.application.use;

  function ensure(app) {
    if (app.__pxl0008a10AuthInstalled) return;
    app.__pxl0008a10AuthInstalled = true;
    originalUse.call(app, (req, _res, next) => {
      if (req.session?.user) return next();
      const authHeader = String(req.headers.authorization || '');
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : String(req.headers['x-auth-token'] || '');
      if (!token) return next();
      try {
        const decoded = jwt.verify(token, cfg.SESSION_SECRET);
        const user = decoded?.user || decoded;
        req.session = req.session || {};
        req.session.user = user || null;
      } catch (_) {
        // Token invalid: middleware auth route akan mengembalikan Unauthorized.
      }
      next();
    });
  }

  for (const method of methods) {
    express.application[method] = function pxl0008a10EarlyAuth(path, ...handlers) {
      ensure(this);
      return original[method].call(this, path, ...handlers);
    };
  }
}
