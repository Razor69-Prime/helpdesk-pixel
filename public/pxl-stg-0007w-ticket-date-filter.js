/* PXL-STG-0007W — satu zona waktu Asia/Makassar untuk Daftar Tiket. */
(function(){
  'use strict';
  const TZ='Asia/Makassar';
  const pad=n=>String(n).padStart(2,'0');
  const dateOnly=v=>{const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;};
  function witaDate(value){
    if(!value)return null;
    const raw=String(value);
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
    const d=new Date(value);if(Number.isNaN(d.getTime()))return null;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=type=>parts.find(p=>p.type===type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function witaNowDate(){return witaDate(new Date());}
  function ticketDate(t){return witaDate(t?.worked_at)||dateOnly(t?.scheduled_date)||witaDate(t?.created_at);}
  function addDays(date,n){const [y,m,d]=date.split('-').map(Number);const x=new Date(Date.UTC(y,m-1,d+n,12));return witaDate(x);}

  function canonicalRange(ctx){
    const from=dateOnly(document.getElementById(ctx+'-from')?.value);
    const to=dateOnly(document.getElementById(ctx+'-to')?.value);
    if(from||to)return{from,to};
    const today=witaNowDate();
    let period='all';
    try{period=String(periodState?.[ctx]||'all');}catch(_){
      const active=document.querySelector(`#${ctx}-period .period-btn.active, [data-period-context="${ctx}"] .period-btn.active`);
      period=String(active?.dataset?.period||active?.textContent||'all').toLowerCase();
    }
    if(period==='today'||period.includes('hari ini'))return{from:today,to:today};
    if(period==='week'||period.includes('7 hari'))return{from:addDays(today,-7),to:today};
    if(period==='month'||period.includes('bulan'))return{from:`${today.slice(0,7)}-01`,to:today};
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
  window.__pxlTimezone={name:TZ,date:witaDate,today:witaNowDate,ticketDate,canonicalRange};
})();
