/* PXL-URG-0028B — safe in-app shell for AI Report + Kanban.
 * Main PixelApps page/session stays alive; module opens in a same-origin iframe overlay.
 * Closing/Kembali only removes the overlay. No reload, no logout/relogin.
 * No database/API/business-flow changes.
 */
(function(){'use strict';
  let shell=null,frame=null,oldOverflow='';

  function closeShell(){
    if(!shell)return;
    try{frame.src='about:blank';}catch(_){}
    shell.remove(); shell=null; frame=null;
    document.documentElement.style.overflow=oldOverflow;
    document.body.style.overflow=oldOverflow;
  }

  function openShell(path,title){
    closeShell();
    oldOverflow=document.body.style.overflow||'';
    document.documentElement.style.overflow='hidden';
    document.body.style.overflow='hidden';

    shell=document.createElement('div');
    shell.id='pxlSafeModuleShell';
    shell.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#f7f6f3;display:flex;flex-direction:column;width:100%;height:100%;';

    const bar=document.createElement('div');
    bar.style.cssText='height:52px;min-height:52px;box-sizing:border-box;background:#fff;border-bottom:1px solid #ddd;display:flex;align-items:center;gap:10px;padding:7px 12px;font-family:Arial,sans-serif;';
    const back=document.createElement('button');
    back.type='button'; back.textContent='← Kembali';
    back.style.cssText='border:1px solid #ddd;background:#fff;border-radius:10px;padding:9px 13px;font-size:14px;cursor:pointer;';
    back.onclick=closeShell;
    const label=document.createElement('b'); label.textContent=title;
    bar.append(back,label);

    frame=document.createElement('iframe');
    frame.setAttribute('title',title);
    frame.style.cssText='border:0;width:100%;flex:1;min-height:0;background:#f7f6f3;';
    frame.src=path+(path.includes('?')?'&':'?')+'shell=1&v=PXL-URG-0028B';
    frame.addEventListener('load',function(){
      try{
        if(frame.contentWindow.location.pathname==='/ai-report.html'||frame.contentWindow.location.pathname==='/kanban.html'){
          frame.contentWindow.backToApp=closeShell;
          const innerTop=frame.contentDocument.querySelector('.top');
          if(innerTop)innerTop.style.display='none';
        }
      }catch(_){}
    });

    shell.append(bar,frame);
    document.body.appendChild(shell);
  }

  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&shell)closeShell();});
  document.addEventListener('click',function(e){
    const ai=e.target?.closest?.('[data-pxl-ai-report]');
    if(ai){e.preventDefault();e.stopImmediatePropagation();openShell('/ai-report.html','🤖 AI Report');return;}
    const kb=e.target?.closest?.('[data-k7-nav]');
    if(kb){e.preventDefault();e.stopImmediatePropagation();openShell('/kanban.html','🗓️ Kanban Teknisi');}
  },true);

  window.PXL_SAFE_MODULE_SHELL={close:closeShell,open:openShell,revision:'PXL-URG-0028B'};
})();
