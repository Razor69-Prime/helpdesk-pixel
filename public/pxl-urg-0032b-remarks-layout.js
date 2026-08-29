/* PXL-URG-0032E — Styling only: keep remarks output above meta and tidy WO controls on phone browser desktop-view. No add/edit/save/PDF logic changes. */
(function(){
  'use strict';
  const REV='PXL-URG-0032E';
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
    if(header){
      if(remarks.parentElement!==card || remarks.previousElementSibling!==header){
        header.insertAdjacentElement('afterend',remarks);
      }
    }
  }

  function isStandalone(){
    try{return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;}catch(_){return false;}
  }

  function isPhoneBrowserDesktopView(){
    if(isStandalone()) return false;
    const ua=String(navigator.userAgent||'');
    const mobileDevice=/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    return mobileDevice && window.innerWidth>700;
  }

  function ensureBrowserPhoneStyle(){
    const id='pxl-0032e-phone-browser-style';
    let style=document.getElementById(id);
    if(!isPhoneBrowserDesktopView()){
      if(style) style.remove();
      return;
    }
    if(style) return;
    style=document.createElement('style');
    style.id=id;
    style.textContent=`
      .ticket-item .ticket-header{
        display:flex!important;
        flex-direction:column!important;
        align-items:stretch!important;
        justify-content:flex-start!important;
        gap:8px!important;
        width:100%!important;
        min-width:0!important;
      }
      .ticket-item .ticket-header>div{
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
      }
      .ticket-item .ticket-header .status-select{
        display:block!important;
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
        margin:0!important;
      }
      .ticket-item .ticket-actions{
        display:flex!important;
        width:100%!important;
        max-width:100%!important;
        min-width:0!important;
        gap:5px!important;
        flex-wrap:nowrap!important;
        align-items:stretch!important;
        justify-content:stretch!important;
      }
      .ticket-item .ticket-actions .btn,
      .ticket-item .ticket-actions button,
      .ticket-item .ticket-actions a{
        flex:1 1 0!important;
        width:auto!important;
        min-width:0!important;
        max-width:none!important;
        min-height:34px!important;
        padding:5px 6px!important;
        margin:0!important;
        justify-content:center!important;
        text-align:center!important;
        font-size:10.5px!important;
        line-height:1.15!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        box-sizing:border-box!important;
      }
      .ticket-item .ticket-actions .pxl-native-remarks-btn{
        flex:1.25 1 0!important;
      }
      .ticket-item .ticket-wo,
      .ticket-item .ticket-tech,
      .ticket-item .ticket-project{
        position:static!important;
        max-width:100%!important;
        overflow-wrap:anywhere!important;
      }
      .ticket-item .ticket-meta{
        position:static!important;
        clear:both!important;
        width:100%!important;
      }
    `;
    document.head.appendChild(style);
  }

  function apply(){
    ensureBrowserPhoneStyle();
    document.querySelectorAll('.ticket-item').forEach(placeRemarks);
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

  window.PXL_URG_0032B={revision:REV,refresh:apply};
})();
