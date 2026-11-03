/* PXL-URG-0126 — ensure native Kanban page is visible after its existing nav click handler runs. */
(function(){
  'use strict';
  document.addEventListener('click',function(event){
    const nav=event.target?.closest?.('[data-k7-nav]');
    if(!nav)return;
    const page=document.getElementById('pxlKanbanPage');
    if(!page)return;
    page.hidden=false;
    page.style.display='block';
  });
})();
