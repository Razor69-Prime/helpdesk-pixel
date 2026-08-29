/* PXL-URG-0032B — Layout/styling only for WO remarks. No add/edit/save/PDF logic changes. */
(function(){
  'use strict';
  const REV='PXL-URG-0032B';
  let timer=null;

  function styleRemarks(el){
    if(!el) return;
    el.style.display='block';
    el.style.width='100%';
    el.style.maxWidth='100%';
    el.style.boxSizing='border-box';
    el.style.margin='8px 0 6px';
    el.style.padding='7px 10px';
    el.style.borderLeft='3px solid #D97706';
    el.style.background='var(--amber-bg,#FAEEDA)';
    el.style.color='var(--amber,#854F0B)';
    el.style.fontSize='11px';
    el.style.lineHeight='1.45';
    el.style.borderRadius='0 7px 7px 0';
    el.style.whiteSpace='pre-wrap';
    el.style.overflowWrap='anywhere';
    el.style.wordBreak='break-word';
    el.style.clear='both';
    el.style.gridColumn='1 / -1';
    el.style.position='static';
    el.style.float='none';
  }

  function placeRemarks(card){
    if(!card) return;
    const remarks=card.querySelector('.pxl-native-remarks-inline');
    if(!remarks) return;
    styleRemarks(remarks);

    const actions=card.querySelector('.ticket-actions');
    if(actions){
      if(remarks.previousElementSibling!==actions){
        actions.insertAdjacentElement('afterend',remarks);
      }
      return;
    }

    const status=card.querySelector('.ticket-status,.ticket-meta,.ticket-footer');
    if(status && remarks.nextElementSibling!==status){
      status.insertAdjacentElement('beforebegin',remarks);
    }
  }

  function apply(){
    document.querySelectorAll('.ticket-item').forEach(placeRemarks);
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(apply,60);
  }

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('DOMContentLoaded',apply);
  setTimeout(apply,0);
  setTimeout(apply,250);
  setTimeout(apply,1000);

  window.PXL_URG_0032B={revision:REV,refresh:apply};
})();
