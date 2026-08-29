/* PXL-URG-0032C — Layout/styling only: remarks output sits above status/date meta. No add/edit/save/PDF logic changes. */
(function(){
  'use strict';
  const REV='PXL-URG-0032C';
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

    // Final target for PWA, browser mobile view and desktop:
    // remarks is a direct child of the ticket card immediately ABOVE
    // the status/date/duration row (.ticket-meta). This prevents it from
    // inheriting the narrow left/right columns inside .ticket-header.
    const meta=directMeta(card);
    if(meta){
      if(remarks.parentElement!==card || remarks.nextElementSibling!==meta){
        card.insertBefore(remarks,meta);
      }
      return;
    }

    // Defensive fallback only when a renderer has no ticket-meta yet.
    // Keep the output outside ticket-header/action columns.
    const header=card.querySelector('.ticket-header');
    if(header){
      if(remarks.parentElement!==card || remarks.previousElementSibling!==header){
        header.insertAdjacentElement('afterend',remarks);
      }
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
