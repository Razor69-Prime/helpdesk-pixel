/* PXL-URG-0027A — Kunjungan Sales duplicate customer alert fix.
   Exact binding to PixelApps Kunjungan fields: #kv-customer-name + #kv-phone.
   Phone match is HIGH alert and remains informational/non-blocking. */
(function(){
'use strict';
const REV='PXL-URG-0027A';
let visitsCache=null,visitsAt=0,timer=null,seq=0;
const TTL=30000;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normPhone(v){let p=String(v||'').replace(/\D/g,'');if(!p||/^0+$/.test(p)||p.length<8)return'';if(p.startsWith('0062'))p=p.slice(2);if(p.startsWith('62'))return p;if(p.startsWith('0'))return'62'+p.slice(1);if(p.startsWith('8'))return'62'+p;return p;}
function normName(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').replace(/\b(pt|cv|ud|toko|bapak|pak|ibu|bu)\b/g,' ').replace(/\s+/g,' ').trim();}
function token(){try{return localStorage.getItem('pixel_token')||localStorage.getItem('token')||localStorage.getItem('pxl_token')||'';}catch(_){return'';}}
async function loadVisits(force=false){if(!force&&visitsCache&&Date.now()-visitsAt<TTL)return visitsCache;const h={},t=token();if(t)h.Authorization='Bearer '+t;const r=await fetch('/api/sales-visits',{headers:h,cache:'no-store'});let d=[];try{d=await r.json();}catch(_){}if(!r.ok)throw new Error(d?.error||'Gagal membaca riwayat kunjungan');visitsCache=Array.isArray(d)?d:[];visitsAt=Date.now();return visitsCache;}
function fields(){return{name:document.getElementById('kv-customer-name'),phone:document.getElementById('kv-phone')};}
function ensureBox(phone){let box=document.getElementById('pxlVisitDuplicateAlert');if(box&&box.parentElement!==phone.parentElement){box.remove();box=null;}if(box)return box;box=document.createElement('div');box.id='pxlVisitDuplicateAlert';box.setAttribute('role','alert');box.style.cssText='display:none;margin-top:8px;padding:12px 14px;border:2px solid #dc2626;background:#fff1f2;border-radius:9px;color:#991b1b;font-size:12px;line-height:1.5';phone.insertAdjacentElement('afterend',box);return box;}
function dateOf(v){return String(v.updated_at||v.created_at||v.prospect_date||'').slice(0,10);}
function fmtDate(v){const s=dateOf(v);if(!s)return'-';const d=new Date(s+'T00:00:00');return isNaN(d)?s:d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});}
function render(box,matches,inputName,shownPhone){if(!matches.length){box.style.display='none';box.innerHTML='';return;}matches=[...matches].sort((a,b)=>dateOf(b).localeCompare(dateOf(a)));const latest=matches[0],names=[...new Set(matches.map(v=>String(v.customer_name||'').trim()).filter(Boolean))];const sameName=names.some(n=>normName(n)&&normName(n)===normName(inputName));box.innerHTML=`<div style="font-size:13px;font-weight:800;margin-bottom:4px">⚠ HIGH — NOMOR CUSTOMER SUDAH ADA</div><div>Nomor <b>${esc(shownPhone)}</b> ditemukan pada database Kunjungan Sales.</div><div style="margin-top:5px;color:#7f1d1d">Customer sebelumnya: <b>${esc(names.slice(0,4).join(' / ')||'-')}</b><br>Total kunjungan: <b>${matches.length}x</b><br>Last Visit: <b>${esc(fmtDate(latest))}</b>${latest.sales_pic?`<br>Sales terakhir: <b>${esc(latest.sales_pic)}</b>`:''}<br>${sameName?'Verifikasi: <b>Nama + nomor sama</b>':'Verifikasi: <b>Nomor sama — cek nama customer</b>'}</div><div style="margin-top:5px;font-size:11px">Informasi saja. Input kunjungan tetap dapat dilanjutkan.</div>`;box.style.display='block';}
async function check(force=false){const{name,phone}=fields();if(!name||!phone)return;const p=normPhone(phone.value),n=String(name.value||'').trim(),box=ensureBox(phone);if(!p){box.style.display='none';box.innerHTML='';return;}const mySeq=++seq;try{const visits=await loadVisits(force);if(mySeq!==seq)return;const matches=visits.filter(v=>normPhone(v.customer_phone)===p);render(box,matches,n,phone.value.trim());}catch(e){box.style.display='block';box.style.borderColor='#d97706';box.style.background='#fffbeb';box.style.color='#92400e';box.textContent='Pengecekan duplikasi belum berhasil: '+String(e.message||e);}}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>check(false),350);}
function bind(){const{name,phone}=fields();if(!name||!phone)return false;if(phone.dataset.pxlDup27a)return true;phone.dataset.pxlDup27a='1';phone.addEventListener('input',schedule);phone.addEventListener('change',()=>check(true));phone.addEventListener('blur',()=>check(true));name.addEventListener('input',schedule);name.addEventListener('change',schedule);return true;}
function boot(){if(bind())return;const mo=new MutationObserver(()=>{if(bind())mo.disconnect();});mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),30000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.PXL_VISIT_DUPLICATE_ALERT={revision:REV,check:()=>check(true)};
})();
