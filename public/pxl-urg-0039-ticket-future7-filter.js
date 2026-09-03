/* PXL-URG-0039 — Add read-only "7 Hari Kedepan" period filter to Daftar Tiket. UI/filter only; no database/WO flow changes. */
(function(){
  'use strict';
  const REV='PXL-URG-0039';
  const TZ='Asia/Makassar';
  let timer=null;

  function dateOnly(v){
    const s=String(v||'').slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;
  }
  function witaDate(value){
    try{
      if(window.__pxlTimezone?.date) return window.__pxlTimezone.date(value);
    }catch(_){ }
    if(!value)return null;
    const raw=String(value);
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
    const d=new Date(value);if(Number.isNaN(d.getTime()))return null;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=t=>parts.find(p=>p.type===t)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function today(){
    try{if(window.__pxlTimezone?.today)return window.__pxlTimezone.today();}catch(_){ }
    return witaDate(new Date());
  }
  function addDays(date,n){
    const [y,m,d]=String(date).split('-').map(Number);
    const x=new Date(Date.UTC(y,m-1,d+n,12));
    return witaDate(x);
  }
  function ticketDate(ticket){
    try{if(window.__pxlTimezone?.ticketDate)return window.__pxlTimezone.ticketDate(ticket);}catch(_){ }
    return witaDate(ticket?.worked_at)||dateOnly(ticket?.scheduled_date)||witaDate(ticket?.created_at);
  }
  function currentPeriod(ctx){
    try{return String(periodState?.[ctx]||'all').toLowerCase();}catch(_){ }
    const from=document.getElementById(ctx+'-from');
    const row=from?.closest('.period-row');
    const active=row?.querySelector('.period-btn.active');
    return String(active?.dataset?.period||active?.textContent||'all').trim().toLowerCase();
  }

  function ensureApplyRangePatch(){
    let current=null;
    try{current=window.applyRange||applyRange;}catch(_){current=window.applyRange;}
    if(typeof current!=='function'||current.__pxl0039Future7)return;
    const previous=current;
    const patched=function(list,ctx){
      if(String(ctx)==='t'&&currentPeriod('t')==='future7'){
        const from=today(),to=addDays(from,7);
        return (Array.isArray(list)?list:[]).filter(ticket=>{
          const d=ticketDate(ticket);
          return !!d&&d>=from&&d<=to;
        });
      }
      return previous.apply(this,arguments);
    };
    patched.__pxl0039Future7=true;
    patched.__pxlPrevious=previous;
    try{applyRange=patched;}catch(_){ }
    window.applyRange=patched;
  }

  function activate(btn){
    if(typeof window.setPeriod==='function'){
      window.setPeriod('t','future7',btn);
      return;
    }
    try{periodState.t='future7';}catch(_){ }
    const row=btn.closest('.period-row');
    row?.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const from=document.getElementById('t-from'),to=document.getElementById('t-to');
    if(from)from.value='';if(to)to.value='';
    try{renderTickets();}catch(_){try{window.renderTickets?.();}catch(__){ }}
  }

  function installButton(){
    const from=document.getElementById('t-from');
    const row=from?.closest('.period-row');
    if(!row)return;
    let btn=row.querySelector('.pxl-0039-future7');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='period-btn pxl-0039-future7';
      btn.dataset.period='future7';
      btn.textContent='7 Hari Kedepan';
      btn.addEventListener('click',function(e){e.preventDefault();activate(btn);});
      const month=[...row.querySelectorAll('.period-btn')].find(b=>/bulan/i.test(String(b.textContent||'')));
      if(month)month.insertAdjacentElement('beforebegin',btn);else from.insertAdjacentElement('beforebegin',btn);
    }
  }

  function refresh(){ensureApplyRangePatch();installButton();}
  function schedule(){clearTimeout(timer);timer=setTimeout(refresh,60);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',refresh);
  setTimeout(refresh,0);setTimeout(refresh,300);setTimeout(refresh,1200);setInterval(refresh,3000);
  window.PXL_URG_0039={revision:REV,refresh};
})();
