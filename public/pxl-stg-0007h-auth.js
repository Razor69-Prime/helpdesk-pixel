/* PXL-STG-0007H — gunakan JWT login existing untuk endpoint Kanban. */
(function(){
  'use strict';
  if (window.__pxlStg0007HAuthInstalled) return;
  window.__pxlStg0007HAuthInstalled = true;

  const originalFetch = window.fetch.bind(window);

  function isKanbanRequest(input) {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    return url.includes('/api/technician-kanban');
  }

  async function getToken() {
    try {
      if (typeof window.waitForAppToken === 'function') {
        const token = await window.waitForAppToken();
        if (token) return token;
      }
    } catch (_) {}

    const knownKeys = ['pxl_token','token','authToken','jwt_token'];
    for (const key of knownKeys) {
      try {
        const token = localStorage.getItem(key);
        if (token) return token;
      } catch (_) {}
    }
    return '';
  }

  window.fetch = async function pxlStg0007HFetch(input, init) {
    if (!isKanbanRequest(input)) return originalFetch(input, init);

    const token = await getToken();
    const headers = new Headers(init?.headers || (typeof input !== 'string' ? input?.headers : undefined) || {});
    if (token) {
      headers.set('Authorization', 'Bearer ' + token);
      headers.set('X-Auth-Token', token);
    }
    headers.set('Cache-Control', 'no-cache');

    const options = {
      ...(init || {}),
      headers,
      cache: 'no-store',
      credentials: 'same-origin'
    };
    return originalFetch(input, options);
  };
})();
