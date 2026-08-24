/* PXL-URG-0006 — AI Report Native Navigation Bridge.
 * Scope: UI navigation only. No API/database/business-flow changes.
 * Keeps legacy AI Report content/data engine, but mounts it inside a native .tab-content wrapper.
 */
(function(){'use strict';
  const WRAP_ID='tab-ai_report';
  function host(){return document.querySelector('.app-content');}
  function page(){return document.getElementById('pxlAiReportPage');}
  function aiButton(){return document.querySelector('[data-pxl-ai-report]');}

  function clearLegacyLocks(){
    const h=host(); if(!h)return;
    [...h.children].forEach(function(n){
      if(Object.prototype.hasOwnProperty.call(n.dataset,'aiOldDisplay')){
        n.style.display=n.dataset.aiOldDisplay;
        delete n.dataset.aiOldDisplay;
      }
    });
  }

  function mountNative(){
    const h=host(),p=page(); if(!h||!p)return false;
    clearLegacyLocks();
    let wrap=document.getElementById(WRAP_ID);
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id=WRAP_ID;
      wrap.className='tab-content';
      h.appendChild(wrap);
    }
    if(p.parentElement!==wrap)wrap.appendChild(p);
    // Visibility is controlled by native .tab-content.active, never by legacy inline display.
    p.hidden=false;
    p.style.display='';
    return true;
  }

  function openNative(btn){
    if(!mountNative())return;
    const b=btn||aiButton();
    if(typeof window.switchTab==='function'&&b){
      window.switchTab('ai_report',b);
    }else if(typeof switchTab==='function'&&b){
      switchTab('ai_report',b);
    }
  }

  function bindButton(){
    const b=aiButton(); if(!b)return;
    b.onclick=function(e){if(e)e.preventDefault();openNative(b);};
  }

  // Capture-phase rebinding guarantees the legacy AI observer cannot restore its old open() handler just before a tap.
  document.addEventListener('click',function(e){
    const b=e.target?.closest?.('[data-pxl-ai-report]');
    if(!b)return;
    b.onclick=function(ev){if(ev)ev.preventDefault();openNative(b);};
  },true);

  // When another native/custom menu is opened, leave AI visibility entirely to the app's own navigation.
  // No wrapping/overriding of switchTab, Kanban, dashboard, or other handlers.
  const obs=new MutationObserver(function(){mountNative();bindButton();});
  function init(){
    mountNative();bindButton();
    obs.observe(document.body,{childList:true,subtree:true});
    [100,300,800,1600,3000].forEach(ms=>setTimeout(function(){mountNative();bindButton();},ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
