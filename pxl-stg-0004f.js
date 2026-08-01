'use strict';

// PXL-STG-0006A — fondasi backend quotation, jasa WO, dan Customer 360.
// Seluruh frontend dan flow Material Request PXL-STG-0005 tetap aktif tanpa perubahan.
require('./pxl-stg-0006a');
require('./pxl-stg-0005d');
require('./pxl-stg-0005i');

const fs = require('fs');
const path = require('path');
const express = require('express');
const originalStatic = express.static;

express.static = function pxl0006aStatic(root, options) {
  const middleware = originalStatic(root, options);
  const indexPath = path.join(root, 'index.html');
  const salesOrderPath = path.join(root, 'sales-order.html');

  return function pxl0006aMiddleware(req, res, next) {
    const isIndex = req.method === 'GET'
      && (req.path === '/' || req.path === '/index.html')
      && fs.existsSync(indexPath);
    const isSalesOrder = req.method === 'GET'
      && req.path === '/sales-order.html'
      && fs.existsSync(salesOrderPath);

    if (!isIndex && !isSalesOrder) return middleware(req, res, next);

    try {
      let html = fs.readFileSync(isIndex ? indexPath : salesOrderPath, 'utf8');

      if (isIndex) {
        const tags = [
          '<script src="/pxl-stg-0004d.js?v=PXL-STG-0004D"></script>',
          '<script src="/pxl-stg-0004f.js?v=PXL-STG-0005M"></script>',
          '<script src="/pxl-stg-0005d.js?v=PXL-STG-0005M"></script>',
          '<script src="/pxl-stg-0005i.js?v=PXL-STG-0005I"></script>',
          '<script src="/pxl-stg-0005k.js?v=PXL-STG-0005K"></script>',
          '<script src="/pxl-stg-0005l.js?v=PXL-STG-0005M"></script>'
        ];
        for (const tag of tags) {
          const src = tag.match(/src="([^"]+)/)?.[1];
          if (src && !html.includes(src.split('?')[0])) {
            html = html.replace('</body>', tag + '\n</body>');
          }
        }
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      return res.type('html').send(html);
    } catch (_) {
      return middleware(req, res, next);
    }
  };
};
