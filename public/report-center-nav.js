/* PXL-RPT-0001 — show shortcut only after server verifies Superadmin. */
(()=>{'use strict';if(window.__pxlRptNav)return;window.__pxlRptNav=true;let verified=false;
async function verify(){try{const r=await fetch('/api/report-center/catalog',{credentials:'same-origin',cache:'no-store'});verified=r.ok;if(!verified)document.getElementById('pxl-rpt-entry')?.remove();else mount();}catch(_){verified=false;document.getElementById('pxl-rpt-entry')?.remove();}}
function mount(){if(!verified||document.getElementById('pxl-rpt-entry'))return;const app=document.getElementById('app');if(!app||(!app.classList.contains('show')&&getComputedStyle(app).display==='none'))return;const a=document.createElement('a');a.id='pxl-rpt-entry';a.href='/report-center.html';a.textContent='▤ Report Center';a.style.cssText='position:fixed;right:16px;bottom:18px;z-index:80;background:#0b376a;color:white;text-decoration:none;font:600 13px Inter,Arial,sans-serif;border-radius:10px;padding:11px 15px;box-shadow:0 4px 14px #0002';document.body.appendChild(a);}
setInterval(()=>{if(verified)mount();},4000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)verify();});setTimeout(verify,1200);
})();
