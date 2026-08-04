'use strict';

/* PXL-STG-0008A9 — rewrite query Invoice V1 agar kompatibel dengan tabel invoices legacy. */
const PATCH_KEY = Symbol.for('pxl.stg.0008a9.invoice.query.fix');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  const originalFetch = global.fetch;

  if (typeof originalFetch === 'function') {
    global.fetch = function pxl0008a9Fetch(resource, options) {
      let target = resource;
      if (typeof target === 'string') {
        target = rewrite(target);
      } else if (target && typeof target.url === 'string') {
        const nextUrl = rewrite(target.url);
        if (nextUrl !== target.url) target = new Request(nextUrl, target);
      }
      return originalFetch.call(this, target, options);
    };
  }
}

function rewrite(url) {
  if (!url.includes('/rest/v1/invoices?')) return url;
  return url.replace(
    'order=created_at.desc.nullslast,uploaded_at.desc',
    'order=updated_at.desc.nullslast,uploaded_at.desc.nullslast'
  );
}
