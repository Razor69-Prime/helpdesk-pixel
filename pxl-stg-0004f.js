'use strict';

// PXL-STG-0005I menjadi konsolidator flow baru dan perbaikan update MR.
require('./pxl-stg-0005d');
require('./pxl-stg-0005i');

const fs = require('fs');
const path = require('path');
const express = require('express');
const originalStatic = express.static;

express.static = function pxl0005iStatic(root, options) {
  const middleware = originalStatic(root, options);
  const indexPath = path.join(root, 'index.html');
  const salesOrderPath = path.join(root, 'sales-order.html');
  return function pxl0005iMiddleware(req, res, next) {
    const isIndex = req.method === 'GET' && (req.path === '/' || req.path === '/index.html') && fs.existsSync(indexPath);
    const isSalesOrder = req.method === 'GET' && req.path === '/sales-order.html' && fs.existsSync(salesOrderPath);
    if (!isIndex && !isSalesOrder) return middleware(req, res, next);
    try {
      let html = fs.readFileSync(isIndex ? indexPath : salesOrderPath, 'utf8');
      if (isIndex) {
        const tags = [
          '<script src="/pxl-stg-0004d.js?v=PXL-STG-0004D"></script>',
          '<script src="/pxl-stg-0004f.js?v=PXL-STG-0005I"></script>',
          '<script src="/pxl-stg-0005d.js?v=PXL-STG-0005I"></script>',
          '<script src="/pxl-stg-0005i.js?v=PXL-STG-0005I"></script>'
        ];
        for (const tag of tags) {
          const src = tag.match(/src="([^"]+)/)?.[1];
          if (src && !html.includes(src.split('?')[0])) html = html.replace('</body>', tag + '\n</body>');
        }
      } else {
        html = html
          .replace(/<div class="section"><div class="toolbar"><div><b>Material Request Trial<\/b>[\s\S]*?<div id="mrTable" class="table"><\/div><\/div>/, '')
          .replace(/if\(a==='mr'\)[\s\S]*?await load\(\)\}catch\(e\)\{toast\(e\.message\)\}\}/, "await load()}catch(e){toast(e.message)}}")
          .replace(/if\(x\.linked_work_order_id\)a\+=`<button class="btn" data-act="mr"[\s\S]*?<\/button>`;/, '');
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      return res.type('html').send(html);
    } catch (_) {
      return middleware(req, res, next);
    }
  };
};
