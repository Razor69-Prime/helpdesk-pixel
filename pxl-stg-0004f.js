'use strict';

// PXL-STG-0007G — Kanban mandiri tanpa mengubah Daftar Teknisi.
// Paket PXL-STG-0006A–0006N dan flow Material Request PXL-STG-0005 tetap aktif.
require('./pxl-stg-0006b');
require('./pxl-stg-0006c');
require('./pxl-stg-0006e');
require('./pxl-stg-0006f');
require('./pxl-stg-0006a');
require('./pxl-stg-0006d');
require('./pxl-stg-0005d');
require('./pxl-stg-0005i');
require('./pxl-stg-0007');
require('./pxl-stg-0007f');

const fs = require('fs');
const path = require('path');
const express = require('express');
const originalStatic = express.static;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeScript(html, base) {
  const pattern = new RegExp(`<script[^>]+src=["']${escapeRegex(base)}(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`, 'gi');
  return html.replace(pattern, '');
}

function replaceOrAppendScript(html, base, version) {
  const src = `${base}?v=${version}`;
  const pattern = new RegExp(escapeRegex(base) + '(?:\\?v=[^"\']+)?', 'g');
  if (html.includes(base)) return html.replace(pattern, src);
  return html.replace('</body>', `<script src="${src}"></script>\n</body>`);
}

function forceSalesOrderScriptOrder(html) {
  const bases = [
    '/pxl-stg-0006c-sales-order.js',
    '/pxl-stg-0006k-polish.js',
    '/pxl-stg-0006l-pdf-fix.js'
  ];
  for (const base of bases) html = removeScript(html, base);
  const ordered = [
    '<script src="/pxl-stg-0006c-sales-order.js?v=PXL-STG-0006N"></script>',
    '<script src="/pxl-stg-0006k-polish.js?v=PXL-STG-0006N"></script>',
    '<script src="/pxl-stg-0006l-pdf-fix.js?v=PXL-STG-0006N"></script>'
  ].join('\n');
  return html.replace('</body>', ordered + '\n</body>');
}

express.static = function pxl0007gStatic(root, options) {
  const middleware = originalStatic(root, options);
  const indexPath = path.join(root, 'index.html');
  const salesOrderPath = path.join(root, 'sales-order.html');
  const crmPath = path.join(root, 'crm.html');

  return function pxl0007gMiddleware(req, res, next) {
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
        html = removeScript(html, '/pxl-stg-0007f-fix.js');
        const tags = [
          '<script src="/pxl-stg-0004d.js?v=PXL-STG-0004D"></script>',
          '<script src="/pxl-stg-0004f.js?v=PXL-STG-0007G"></script>',
          '<script src="/pxl-stg-0005d.js?v=PXL-STG-0006J"></script>',
          '<script src="/pxl-stg-0005i.js?v=PXL-STG-0005I"></script>',
          '<script src="/pxl-stg-0005k.js?v=PXL-STG-0005K"></script>',
          '<script src="/pxl-stg-0005l.js?v=PXL-STG-0005M"></script>',
          '<script src="/pxl-stg-0006k-polish.js?v=PXL-STG-0006N"></script>',
          '<script src="/pxl-stg-0006l-pdf-fix.js?v=PXL-STG-0006N"></script>',
          '<script src="/pxl-stg-0007-kanban.js?v=PXL-STG-0007G"></script>'
        ];
        for (const tag of tags) {
          const src = tag.match(/src="([^"]+)/)?.[1];
          if (!src) continue;
          const base = src.split('?')[0];
          html = replaceOrAppendScript(html, base, src.split('?v=')[1] || 'PXL-STG-0007G');
        }
      }

      if (isSalesOrder) html = forceSalesOrderScriptOrder(html);
      if (isCrm) html = replaceOrAppendScript(html, '/pxl-stg-0006e-crm.js', 'PXL-STG-0006N');

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      return res.type('html').send(html);
    } catch (_) {
      return middleware(req, res, next);
    }
  };
};
