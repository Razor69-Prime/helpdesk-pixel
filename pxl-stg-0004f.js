'use strict';

require('./pxl-stg-0005a');
require('./pxl-stg-0004g');

const fs = require('fs');
const path = require('path');
const express = require('express');
const originalStatic = express.static;

const salesOrderMrRemoval = `<script>
(function(){
  function removeDeprecatedMR(){
    document.querySelectorAll('[data-act="mr"]').forEach(function(button){button.remove();});
    document.querySelectorAll('.section').forEach(function(section){
      if(/Material Request Trial/i.test(section.textContent||''))section.remove();
    });
    document.querySelectorAll('.toolbar .sub').forEach(function(sub){
      if(/Material Request/i.test(sub.textContent||''))sub.textContent='Sales Order, approval, dan pembuatan Work Order.';
    });
  }
  removeDeprecatedMR();
  document.addEventListener('DOMContentLoaded',removeDeprecatedMR);
  new MutationObserver(removeDeprecatedMR).observe(document.documentElement,{childList:true,subtree:true});
})();
</script>`;

express.static = function pxl0004fStatic(root, options) {
  const middleware = originalStatic(root, options);
  const indexPath = path.join(root, 'index.html');
  const salesOrderPath = path.join(root, 'sales-order.html');
  return function pxl0004fMiddleware(req, res, next) {
    const isIndex = req.method === 'GET' && (req.path === '/' || req.path === '/index.html') && fs.existsSync(indexPath);
    const isSalesOrder = req.method === 'GET' && req.path === '/sales-order.html' && fs.existsSync(salesOrderPath);
    if (isIndex || isSalesOrder) {
      try {
        let html = fs.readFileSync(isIndex ? indexPath : salesOrderPath, 'utf8');
        const tags = isIndex
          ? [
              '<script src="/pxl-stg-0004d.js?v=PXL-STG-0004D"></script>',
              '<script src="/pxl-stg-0004f.js?v=PXL-STG-0004F"></script>',
              '<script src="/pxl-stg-0005a.js?v=PXL-STG-0005B"></script>'
            ]
          : [
              '<script src="/pxl-stg-0005a.js?v=PXL-STG-0005B"></script>',
              salesOrderMrRemoval
            ];
        for (const tag of tags) {
          const src = tag.match(/src="([^"]+)/)?.[1];
          if (src) {
            if (!html.includes(src.split('?')[0])) html = html.replace('</body>', tag + '\n</body>');
          } else if (!html.includes('function removeDeprecatedMR()')) {
            html = html.replace('</body>', tag + '\n</body>');
          }
        }
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        return res.type('html').send(html);
      } catch (_) {
        return middleware(req, res, next);
      }
    }
    return middleware(req, res, next);
  };
};
