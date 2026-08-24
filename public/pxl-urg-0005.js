/* PXL-URG-0005 — AI Report navigation safety patch.
 * Scope: UI navigation only. No API/database/business-flow changes.
 * Fixes blank content after leaving AI Report on desktop/mobile/PWA.
 */
(function(){'use strict';
  function aiPage(){return document.getElementById('pxlAiReportPage');}
  function restoreNative(){
    const host=document.querySelector('.app-content');
    if(!host)return;
    const page=aiPage();
    if(page){page.hidden=true;page.style.display='none';}
    [...host.children].forEach(function(node){
      if(node===page)return;
      if(Object.prototype.hasOwnProperty.call(node.dataset,'aiOldDisplay')){
        node.style.display=node.dataset.aiOldDisplay;
        delete node.dataset.aiOldDisplay;
      }
    });
  }
  function isAiControl(el){return !!el?.closest?.('[data-pxl-ai-report]');}
  function isNativeNav(el){
    if(!el?.closest)return false;
    return !!el.closest('.nav-btn,[data-tab],[data-page],[data-view],.top-nav button,.mobile-nav button,.sidebar button,.sidebar a');
  }
  // Capture before native handlers so stale AI inline display overrides cannot survive navigation.
  document.addEventListener('click',function(e){
    if(isAiControl(e.target))return;
    if(isNativeNav(e.target))restoreNative();
  },true);

  // Extra guard for navigation invoked programmatically via switchTab().
  function patchSwitchTab(){
    if(window.__PXL_URG_0005_SWITCHTAB__)return;
    if(typeof window.switchTab!=='function')return;
    const original=window.switchTab;
    window.switchTab=function(){restoreNative();return original.apply(this,arguments);};
    window.__PXL_URG_0005_SWITCHTAB__=true;
  }
  [0,250,750,1500,3000].forEach(ms=>setTimeout(patchSwitchTab,ms));
  window.__PXL_AI_RESTORE_NATIVE__=restoreNative;
})();
