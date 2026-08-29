/* PXL-URG-0032G — Styling/DOM placement only: force WO controls into their own row on browser desktop layout. No add/edit/save/PDF/database logic changes. */
(function(){
  'use strict';
  const REV='PXL-URG-0032G';
  let timer=null;

  function styleRemarks(el){
    if(!el) return;
    el.style.display='block';
    el.style.width='100%';
    el.style.maxWidth='100%';
    el.style.minWidth='0';
    el.style.boxSizing='border-box';
    el.style.margin='7px 0 6px';
    el.style.padding='7px 10px';
    el.style.borderLeft='3px solid #D97706';
    el.style.background='var(--amber-bg,#FAEEDA)';
    el.style.color='var(--amber,#854F0B)';
    el.style.fontSize='11px';
    el.style.lineHeight='1.45';
    el.style.borderRadius='0 7px 7px 0';
    el.style.whiteSpace='pre-wrap';
    el.style.overflowWrap='break-word';
    el.style.wordBreak='normal';
    el.style.clear='both';
    el.style.position='static';
    el.style.float='none';
    el.style.flex='0 0 100%';
    el.style.alignSelf='stretch';
    el.style.gridColumn='1 / -1';
  }

  function directMeta(card){
    if(!card) return null;
    for(const child of card.children){
      if(child.classList?.contains('ticket-meta')) return child;
    }
    return card.querySelector('.ticket-meta');
  }

  function placeRemarks(card){
    if(!card) return;
    const remarks=card.querySelector('.pxl-native-remarks-inline');
    if(!remarks) return;
    styleRemarks(remarks);
    const meta=directMeta(card);
    if(meta){
      if(remarks.parentElement!==card || remarks.nextElementSibling!==meta){
        card.insertBefore(remarks,meta);
      }
      return;
    }
    const header=card.querySelector('.ticket-header');
    if(header && (remarks.parentElement!==card || remarks.previousElementSibling!==header)){
      header.insertAdjacentElement('afterend',remarks);
    }
  }

  function isStandalone(){
    try{return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;}catch(_){return false;}
  }

  function browserDesktopLayoutActive(){
    if(isStandalone()) return false;
    const sidebar=document.querySelector('.sidebar');
    if(!sidebar) return false;
    try{
      const s=getComputedStyle(sidebar);
      return s.display!=='none' && s.visibility!=='hidden' && sidebar.getClientRects().length>0 && sidebar.getBoundingClientRect().width>=150;
    }catch(_){return false;}
  }

  function ensureBrowserDesktopStyle(){
    const id='pxl-0032g-browser-desktop-style';
    let style=document.getElementById(id);
    ['pxl-0032e-phone-browser-style','pxl-0032f-phone-browser-style'].forEach(oldId=>document.getElementById(oldId)?.remove());
    if(!browserDesktopLayoutActive()){
      if(style) style.remove();
      return false;
    }
    if(!style){
      style=document.createElement('style');
      style.id=id;
      style.textContent=`
        .ticket-item .ticket-header{
          display:block!important;
          width:100%!important;
          min-width:0!important;
          margin-bottom:6px!important;
        }
        .ticket-item .ticket-header>div{
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
        }
        .ticket-item .ticket-wo,
        .ticket-item .ticket-tech,
        .ticket-item .ticket-project{
          position:static!important;
          display:block!important;
          max-width:100%!important;
          overflow-wrap:anywhere!important;
        }
        .ticket-item .status-select{
          display:block!important;
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
          height:32px!important;
          margin:6px 0!important;
          padding:3px 9px!important;
          box-sizing:border-box!important;
          position:static!important;
          float:none!important;
        }
        .ticket-item .ticket-actions.pxl-0032g-controls{
          display:grid!important;
          grid-template-columns:repeat(6,minmax(0,1fr))!important;
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
          gap:4px!important;
          margin:6px 0 7px!important;
          align-items:stretch!important;
          justify-content:stretch!important;
          position:static!important;
          float:none!important;
          clear:both!important;
        }
        .ticket-item .ticket-actions.pxl-0032g-controls .btn,
        .ticket-item .ticket-actions.pxl-0032g-controls button,
        .ticket-item .ticket-actions.pxl-0032g-controls a{
          display:flex!important;
          width:100%!important;
          min-width:0!important;
          max-width:100%!important;
          height:32px!important;
          min-height:32px!important;
          padding:3px 4px!important;
          margin:0!important;
          align-items:center!important;
          justify-content:center!important;
          text-align:center!important;
          font-size:9.5px!important;
          line-height:1!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
          box-sizing:border-box!important;
          position:static!important;
          float:none!important;
        }
        .ticket-item .ticket-actions.pxl-0032g-controls .pxl-native-remarks-btn{
          font-size:9px!important;
        }
        .ticket-item .ticket-meta,
        .ticket-item .pxl-native-remarks-inline{
          position:static!important;
          clear:both!important;
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
        }
      `;
      document.head.appendChild(style);
    }
    return true;
  }

  function placeControls(card){
    if(!card || !browserDesktopLayoutActive()) return;
    const header=card.querySelector('.ticket-header');
    const actions=card.querySelector('.ticket-actions');
    if(!header || !actions) return;
    actions.classList.add('pxl-0032g-controls');

    // Keep controls out of the header columns entirely. Moving an existing node
    // preserves all native click handlers and data attributes; no logic is changed.
    if(actions.parentElement!==card){
      header.insertAdjacentElement('afterend',actions);
    }else if(actions.previousElementSibling!==header){
      header.insertAdjacentElement('afterend',actions);
    }
  }

  function apply(){
    const active=ensureBrowserDesktopStyle();
    document.querySelectorAll('.ticket-item').forEach(card=>{
      if(active) placeControls(card);
      placeRemarks(card);
    });
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(apply,60);
  }

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  document.addEventListener('DOMContentLoaded',apply);
  setTimeout(apply,0);
  setTimeout(apply,250);
  setTimeout(apply,1000);
  setInterval(apply,5000);

  window.PXL_URG_0032B={revision:REV,refresh:apply};
})();
