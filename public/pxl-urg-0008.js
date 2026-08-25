/* PXL-URG-0028A — preserve PixelApps auth when opening AI Report + Kanban.
 * No database/API/business-flow changes.
 * Mirrors the existing safe token-normalization approach: keep the active token
 * available in both localStorage and sessionStorage before leaving index.html.
 */
(function(){'use strict';
  function activeToken(){
    try{
      return String(window.__pxlAuthToken||localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||'').trim();
    }catch(_){ return String(window.__pxlAuthToken||'').trim(); }
  }
  function preserveAuth(){
    const token=activeToken();
    if(!token) return false;
    try{ localStorage.setItem('pixel_token',token); }catch(_){}
    try{ sessionStorage.setItem('pixel_token',token); }catch(_){}
    window.__pxlAuthToken=token;
    return true;
  }
  function go(path){
    preserveAuth();
    try{window.location.assign(path);}catch(_){window.location.href=path;}
  }
  document.addEventListener('click',function(e){
    const ai=e.target?.closest?.('[data-pxl-ai-report]');
    if(ai){e.preventDefault();e.stopImmediatePropagation();go('/ai-report.html?v=PXL-URG-0028A');return;}
    const kb=e.target?.closest?.('[data-k7-nav]');
    if(kb){e.preventDefault();e.stopImmediatePropagation();go('/kanban.html?v=PXL-URG-0028A');}
  },true);
})();
