/* PXL-URG-0008 — isolate AI Report + Kanban from main app navigation.
 * No database/API/business-flow changes. Prevents custom modules from hiding .app-content.
 */
(function(){'use strict';
  function go(path){
    try{window.location.assign(path);}catch(_){window.location.href=path;}
  }
  document.addEventListener('click',function(e){
    const ai=e.target?.closest?.('[data-pxl-ai-report]');
    if(ai){e.preventDefault();e.stopImmediatePropagation();go('/ai-report.html?v=PXL-URG-0008');return;}
    const kb=e.target?.closest?.('[data-k7-nav]');
    if(kb){e.preventDefault();e.stopImmediatePropagation();go('/kanban.html?v=PXL-URG-0008');}
  },true);
})();
