/* PXL-URG-0142: one-day Superadmin visual verification; no API calls or data writes. */
(function(){
  'use strict';
  const TEST_DATE='2026-11-14';
  const KEY='pxl-urg-0142-reminder-test-shown';
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let attempts=0;
  function check(){
    if(today()!==TEST_DATE||sessionStorage.getItem(KEY))return true;
    const user=window.currentUser||(typeof currentUser!=='undefined'?currentUser:null);
    if(String(user?.role||'').toLowerCase()!=='superadmin')return false;
    const host=document.querySelector('#app .topbar .topbar-right');
    if(!host)return false;
    if(host.querySelector('.svc-toast'))return false;
    const t=document.createElement('div');
    t.className='svc-toast'; t.setAttribute('role','status');
    t.setAttribute('data-pxl-0142-test','1');
    t.innerHTML='<div>🔧 <b>Service Reminder — TEST</b><div>Simulasi popup hari ini (14 Nov 2026). Tidak mengubah data.</div></div><button class="btn sm" id="svc-toast-open" type="button">Lihat</button>';
    host.prepend(t);
    sessionStorage.setItem(KEY,'1');
    requestAnimationFrame(()=>t.classList.add('show'));
    const close=()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)};
    t.querySelector('#svc-toast-open').addEventListener('click',()=>{
      close(); const b=document.querySelector('[data-tab-id="service_center"]');
      if(b&&typeof switchTab==='function')switchTab('service_center',b);
      else if(b)b.click();
    });
    setTimeout(close,15000);
    return true;
  }
  if(check())return;
  const interval=setInterval(()=>{if(check()||++attempts>=180)clearInterval(interval)},2000);
})();
