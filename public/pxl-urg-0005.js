/* PXL-URG-0005A — AI Report navigation safety patch.
 * Scope: UI navigation only. No API/database/business-flow changes.
 * AI Report owns content only while explicitly open; every other navigation releases it.
 */
(function(){'use strict';
  function page(){return document.getElementById('pxlAiReportPage');}
  function host(){return document.querySelector('.app-content');}
  function release(){
    const h=host(),p=page();
    if(!h)return;
    if(p){p.hidden=true;p.style.display='none';}
    [...h.children].forEach(function(n){
      if(n===p)return;
      if(Object.prototype.hasOwnProperty.call(n.dataset,'aiOldDisplay')){
        n.style.display=n.dataset.aiOldDisplay;
        delete n.dataset.aiOldDisplay;
      }
    });
    document.documentElement.removeAttribute('data-pxl-ai-open');
  }
  function isAi(el){return !!el?.closest?.('[data-pxl-ai-report]');}
  function nativeControl(el){
    if(!el?.closest)return null;
    return el.closest('.nav-btn,[data-tab],[data-page],[data-view],[onclick*="switchTab"],[onclick*="showTab"],.top-nav button,.mobile-nav button,.sidebar button,.sidebar a');
  }
  document.addEventListener('click',function(e){
    if(isAi(e.target))return;
    if(nativeControl(e.target))release();
  },true);
  // Do not wrap native navigation functions: Kanban and several mobile tabs replace/rebind them at runtime.
  // A capture-phase release is enough and avoids blocking their original handlers.
  window.__PXL_AI_RESTORE_NATIVE__=release;
})();
