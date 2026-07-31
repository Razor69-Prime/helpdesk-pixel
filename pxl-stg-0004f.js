'use strict';

// PXL-STG-0004G aktif melalui modul 0004F agar config.js tidak perlu disentuh.
require('./pxl-stg-0004g');

const fs = require('fs');
const path = require('path');
const express = require('express');
const originalStatic = express.static;

express.static = function pxl0004fStatic(root, options) {
  const middleware = originalStatic(root, options);
  const indexPath = path.join(root, 'index.html');
  return function pxl0004fMiddleware(req, res, next) {
    if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html') && fs.existsSync(indexPath)) {
      try {
        let html = fs.readFileSync(indexPath, 'utf8');
        const tagD = '<script src="/pxl-stg-0004d.js?v=PXL-STG-0004D"></script>';
        const tagF = '<script src="/pxl-stg-0004f.js?v=PXL-STG-0004F"></script>';
        if (!html.includes('/pxl-stg-0004d.js')) html = html.replace('</body>', tagD + '\n</body>');
        if (!html.includes('/pxl-stg-0004f.js')) html = html.replace('</body>', tagF + '\n</body>');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.type('html').send(html);
      } catch (_) {
        return middleware(req, res, next);
      }
    }
    return middleware(req, res, next);
  };
};
