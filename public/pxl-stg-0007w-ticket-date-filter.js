/* PXL-STG-0007W — samakan filter tanggal Daftar Tiket dengan Kanban/Custom Date. */
(function(){
  'use strict';
  const pad=n=>String(n).padStart(2,'0');
  const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dateOnly=v=>{const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;};
  const ticketDate=t=>dateOnly(t?.worked_at)||dateOnly(t?.scheduled_date)||dateOnly(t?.created_at);
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};

  function canonicalRange(ctx){
    const fromEl=document.getElementById(ctx+'-from');
    const toEl=document.getElementById(ctx+'-to');
    const from=dateOnly(fromEl?.value);
    const to=dateOnly(toEl?.value);
    if(from||to)return{from,to};

    const now=new Date();
    const today=ymd(now);
    let period='all';
    try{period=String(periodState?.[ctx]||'all');}catch(_){
      const active=document.querySelector(`#${ctx}-period .period-btn.active, [data-period-context="${ctx}"] .period-btn.active`);
      period=String(active?.dataset?.period||active?.textContent||'all').toLowerCase();
    }
    if(period==='today'||period.includes('hari ini'))return{from:today,to:today};
    if(period==='week'||period.includes('7 hari'))return{from:ymd(addDays(now,-7)),to:today};
    if(period==='month'||period.includes('bulan'))return{from:`${now.getFullYear()}-${pad(now.getMonth()+1)}-01`,to:today};
    return{from:null,to:null};
  }

  function patchedApplyRange(list,ctx){
    const {from,to}=canonicalRange(ctx);
    if(!from&&!to)return list;
    return (Array.isArray(list)?list:[]).filter(ticket=>{
      const date=ticketDate(ticket);
      if(!date)return false;
      return !(from&&date<from)&&!(to&&date>to);
    });
  }

  try{applyRange=patchedApplyRange;}catch(_){window.applyRange=patchedApplyRange;}
  window.__pxlStg0007w={ticketDate,canonicalRange};
})();
