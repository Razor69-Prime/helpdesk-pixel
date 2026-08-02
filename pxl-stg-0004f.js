'use strict';

// PXL-STG-0006L — perbaikan data PDF WO teknisi dan paksa PDF Penawaran customer terbaru.
// Paket PXL-STG-0006A–0006K dan flow Material Request PXL-STG-0005 tetap aktif.
require('./pxl-stg-0006b');
require('./pxl-stg-0006c');
require('./pxl-stg-0006e');
require('./pxl-stg-0006f');
require('./pxl-stg-0006a');
require('./pxl-stg-0006d');
require('./pxl-stg-0005d');
require('./pxl-stg-0005i');

const fs = require('fs');
const path = require('path');
const express = require('express');
const originalStatic = express.static;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

express.static = function pxl0006lStatic(root, options) {
  const middleware = originalStatic(root, options);
  const indexPath = path.join(root, 'index.html');
  const salesOrderPath = path.join(root, 'sales-order.html');
  const crmPath = path.join(root, 'crm.html');

  return function pxl0006lMiddleware(req, res, next) {
    const isIndex = req.method === 'GET'
      && (req.path === '/' || req.path === '/index.html')
      && fs.existsSync(indexPath);
    const isSalesOrder = req.method === 'GET'
      && req.path === '/sales-order.html'
      && fs.existsSync(salesOrderPath);
    const isCrm = req.method === 'GET'
      && req.path === '/crm.html'
      && fs.existsSync(crmPath);

    if (!isIndex && !isSalesOrder && !isCrm) return middleware(req, res, next);

    try {
      const sourcePath = isIndex ? indexPath : isSalesOrder ? salesOrderPath : crmPath;
      let html = fs.readFileSync(sourcePath, 'utf8');

      if (isIndex) {
        const tags = [
          '<script src="/pxl-stg-0004d.js?v=PXL-STG-0004D"></script>',
          '<script src="/pxl-stg-0004f.js?v=PXL-STG-0006L"></script>',
          '<script src="/pxl-stg-0005d.js?v=PXL-STG-0006J"></script>',
          '<script src="/pxl-stg-0005i.js?v=PXL-STG-0005I"></script>',
          '<script src="/pxl-stg-0005k.js?v=PXL-STG-0005K"></script>',
          '<script src="/pxl-stg-0005l.js?v=PXL-STG-0005M"></script>',
          '<script src="/pxl-stg-0006k-polish.js?v=PXL-STG-0006L"></script>',
          '<script src="/pxl-stg-0006l-pdf-fix.js?v=PXL-STG-0006L"></script>'
        ];
        for (const tag of tags) {
          const src = tag.match(/src="([^"]+)/)?.[1];
          if (!src) continue;
          const base = src.split('?')[0];
          if (html.includes(base)) {
            html = html.replace(
              new RegExp(escapeRegex(base) + '(?:\\?v=[^"\']+)?', 'g'),
              src
            );
          } else {
            html = html.replace('</body>', tag + '\n</body>');
          }
        }
      }

      const salesScripts = [
        ['/pxl-stg-0006c-sales-order.js', 'PXL-STG-0006L'],
        ['/pxl-stg-0006k-polish.js', 'PXL-STG-0006L'],
        ['/pxl-stg-0006l-pdf-fix.js', 'PXL-STG-0006L']
      ];
      if (isSalesOrder) {
        for (const [base, version] of salesScripts) {
          const src = `${base}?v=${version}`;
          if (html.includes(base)) {
            html = html.replace(new RegExp(escapeRegex(base) + '(?:\\?v=[^"\']+)?', 'g'), src);
          } else {
            html = html.replace('</body>', `<script src="${src}"></script>\n</body>`);
          }
        }
      }

      if (isCrm && !html.includes('/pxl-stg-0006e-crm.js')) {
        html = html.replace(
          '</body>',
          '<script src="/pxl-stg-0006e-crm.js?v=PXL-STG-0006L"></script>\n</body>'
        );
      } else if (isCrm) {
        html = html.replace(
          /\/pxl-stg-0006e-crm\.js\?v=[^"']+/g,
          '/pxl-stg-0006e-crm.js?v=PXL-STG-0006L'
        );
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      return res.type('html').send(html);
    } catch (_) {
      return middleware(req, res, next);
    }
  };
};
