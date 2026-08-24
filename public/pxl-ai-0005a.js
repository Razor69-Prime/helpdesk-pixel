/* PXL-AI-0005A — Gemini Foundation UI health only. */
(function(){'use strict';
function token(){try{return String(window.__pxlAuthToken||localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||'').trim()}catch(_){return''}}
function headers(){const h={Accept:'application/json'},t=token();if(t){h.Authorization='Bearer '+t;h['X-Auth-Token']=t}return h}
async function check(){
  const page=document.getElementById('pxlAiReportPage');if(!page)return;
  const rows=[...page.querySelectorAll('span')];
  const label=rows.find(x=>String(x.textContent||'').trim()==='Gemini AI');
  const value=label?.nextElementSibling;if(!value)return;
  value.textContent='Memeriksa koneksi...';
  try{
    const r=await fetch('/api/ai/gemini/health',{headers:headers(),cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.connected){value.textContent='Connected — '+(d.model||'Gemini');value.style.color='#2e7d32';}
    else{value.textContent='Not Connected — '+(d.error||('HTTP '+r.status));value.style.color='#b26a00';}
  }catch(e){value.textContent='Not Connected — '+String(e.message||e);value.style.color='#b26a00';}
  const rev=rows.find(x=>String(x.textContent||'').trim()==='Revision')?.nextElementSibling;
  if(rev)rev.textContent='PXL-AI-0005A / PXL-URG-0004';
}
function watch(){const p=document.getElementById('pxlAiReportPage');if(p&&!p.hidden&&p.style.display!=='none')check();}
const obs=new MutationObserver(watch);
function init(){obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden']});[500,1500,3000].forEach(ms=>setTimeout(watch,ms));document.addEventListener('click',e=>{if(e.target.closest?.('[data-pxl-ai-report]'))setTimeout(check,100);},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
