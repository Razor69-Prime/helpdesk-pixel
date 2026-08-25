/* PXL-URG-0027 — Kunjungan Sales duplicate customer alert.
   Read-only/non-blocking: checks existing sales visits after customer name + phone are filled.
   No merge, no database mutation, no submit blocking. */
(function(){
'use strict';
const REV='PXL-URG-0027';
let visitsCache=null,visitsAt=0,lastKey='',timer=null;
const TTL=120000;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normPhone(v){let p=String(v||'').replace(/\D/g,'');if(!p||/^0+$/.test(p)||p.length<8)return'';if(p.startsWith('62'))return p;if(p.startsWith('0'))return'62'+p.slice(1);if(p.startsWith('8'))return'62'+p;return p;}
function normName(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').replace(/\b(pt|cv|ud|toko|bapak|pak|ibu|bu)\b/g,' ').replace(/\s+/g,' ').trim();}
function token(){try{return localStorage.getItem('pixel_token')||localStorage.getItem('token')||localStorage.getItem('pxl_token')||'';}catch(_){return'';}}
async function loadVisits(){if(visitsCache&&Date.now()-visitsAt<TTL)return visitsCache;const h={},t=token();if(t)h.Authorization='Bearer '+t;const r=await fetch('/api/sales-visits',{headers:h,cache:'no-store'});if(!r.ok)throw new Error('Gagal membaca riwayat kunjungan');const d=await r.json();visitsCache=Array.isArray(d)?d:[];visitsAt=Date.now();return visitsCache;}
function candidates(){const inputs=[...document.querySelectorAll('input')];const name=inputs.find(x=>/customer|toko|perusahaan/i.test((x.id||'')+' '+(x.name||'')+' '+(x.placeholder||''))&&!/phone|telp|telepon|wa|whatsapp/i.test((x.id||'')+' '+(x.name||'')+' '+(x.placeholder||'')));const phone=inputs.find(x=>/phone|telp|telepon|whatsapp|no.?wa|nomor.?wa/i.test((x.id||'')+' '+(x.name||'')+' '+(x.placeholder||'')));return{name,phone};}
function ensureBox(phone){let box=document.getElementById('pxlVisitDuplicateAlert');if(box)return box;box=document.createElement('div');box.id='pxlVisitDuplicateAlert';box.style.cssText='display:none;margin-top:8px;padding:10px 12px;border:1px solid #e7a86e;background:#fff6ed;border-radius:9px;color:#6f3b12;font-size:12px;line-height:1.45';phone.insertAdjacentElement('afterend',box);return box;}
function dateOf(v){return String(v.updated_at||v.created_at||v.prospect_date||'').slice(0,10);}
function fmtDate(v){const s=dateOf(v);if(!s)return'-';const d=new Date(s+'T00:00:00');return isNaN(d)?s:d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});}
function render(box,matches,inputName,phone){if(!matches.length){box.style.display='none';box.innerHTML='';return;}matches.sort((a,b)=>dateOf(b).localeCompare(dateOf(a)));const latest=matches[0],names=[...new Set(matches.map(v=>String(v.customer_name||'').trim()).filter(Boolean))];const sameName=names.some(n=>normName(n)&&normName(n)===normName(inputName));box.innerHTML=`<b>⚠ Customer pernah dikunjungi</b><br>Nomor <b>${esc(phone)}</b> ditemukan pada riwayat Kunjungan Sales.<br><span style="color:#5d554d">Customer sebelumnya: <b>${esc(names.slice(0,3).join(' / ')||'-')}</b><br>Total kunjungan dengan nomor ini: <b>${matches.length}x</b><br>Last Visit: <b>${esc(fmtDate(latest))}</b>${latest.sales_pic?`<br>Sales terakhir: <b>${esc(latest.sales_pic)}</b>`:''}${sameName?'<br>Verifikasi: <b>Nama + nomor sama</b>':'<br>Verifikasi: <b>Nomor sama, cek nama customer</b>'}</span><br><small>Informasi saja — Anda tetap dapat melanjutkan input kunjungan.</small>`;box.style.display='block';}
async function check(){const{name,phone}=candidates();if(!name||!phone)return;const p=normPhone(phone.value),n=String(name.value||'').trim(),box=ensureBox(phone);if(!p||!n){box.style.display='none';lastKey='';return;}const key=normName(n)+'|'+p;if(key===lastKey)return;lastKey=key;try{const visits=await loadVisits();const matches=visits.filter(v=>normPhone(v.customer_phone)===p);render(box,matches,n,phone.value.trim());}catch(_){box.style.display='none';}}
function bind(){const{name,phone}=candidates();if(!name||!phone)return false;if(phone.dataset.pxlDup27)return true;phone.dataset.pxlDup27='1';const run=()=>{clearTimeout(timer);timer=setTimeout(check,250);};phone.addEventListener('blur',run);phone.addEventListener('change',run);name.addEventListener('blur',run);name.addEventListener('change',run);return true;}
function boot(){if(bind())return;const mo=new MutationObserver(()=>{if(bind())mo.disconnect();});mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),20000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.PXL_VISIT_DUPLICATE_ALERT={revision:REV,check};
})();
