/* PXL-DM-0003 — Dashboard Digital Marketing snapshot tab; reuses existing read-only API. */
(function(){
'use strict';
const rootId='dash-sec-digital-marketing';
const buttonId='dsub-digital-marketing';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role=()=>{
  try{
    const u=(typeof currentUser!=='undefined'&&currentUser)?currentUser:(window.currentUser||{});
    return String(u.role||'').toLowerCase().replace(/[ _-]/g,'');
  }catch(_){return '';}
};
const authToken=()=>String(window.__pxlAuthToken||localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('pxl_token')||sessionStorage.getItem('token')||'').trim();
const number=value=>Number(value||0).toLocaleString('id-ID',{maximumFractionDigits:2});
const money=value=>'Rp '+Number(value||0).toLocaleString('id-ID',{maximumFractionDigits:0});
const percent=value=>number(value)+'%';
function card(label,value,sub){
  return '<div class="pxl-dm-dash-card"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong>'+(sub?'<span>'+esc(sub)+'</span>':'')+'</div>';
}
function details(row){
  const summary=row?.summary||{},ads=summary.meta_ads||{},prospect=summary.prospect||{},website=summary.website||{},target=summary.target_summary||{};
  const cards=[
    card('Ad Spend',money(ads.spend),'Meta Ads'),
    card('Deal Revenue',money(ads.deal_revenue),'Omzet deal dari iklan'),
    card('Cash In',money(ads.cash_in),'Pembayaran diterima'),
    card('ROAS',number(ads.roas)+'x','Return on ad spend'),
    card('Prospect',number(prospect.total_prospek),'Total prospect'),
    card('Deal',number(prospect.total_deal),'Prospect berhasil deal'),
    card('CTR',percent(ads.ctr),'Meta Ads'),
    card('Klik WhatsApp',number(website.click_to_whatsapp?.value),'Website')
  ].join('');
  const cats=summary.categories||{},comparisons=summary.comparison||{};
  const categoryRows=[['TikTok',cats.tiktok,comparisons.tiktok],['Instagram',cats.instagram,comparisons.instagram],['Meta Ads',cats.ads,comparisons.ads],['Website',cats.website,comparisons.website]]
    .flatMap(([title,cat,cmp])=>Object.entries(cat?.metrics||{}).map(([key,metric])=>{
      const previous=cmp?.metrics?.[key]?.previous_formatted??'-';
      return '<tr><td>'+esc(title)+'</td><td>'+esc(metric.label||key)+'</td><td>'+esc(metric.formatted_value??metric.value??'-')+'</td><td>'+esc(previous)+'</td></tr>';
    })).join('');
  const targets=(summary.target_achievement||[]).map(item=>
    '<tr><td>'+esc(item.category||'-')+'</td><td>'+esc(item.label||'-')+'</td><td>'+esc(item.actual_formatted??'-')+'</td><td>'+esc(item.target_formatted??'-')+'</td><td>'+esc(item.progress??'-')+'%</td></tr>').join('');
  return '<div class="pxl-dm-dash-kpis">'+cards+'</div>'
    +'<div class="pxl-dm-dash-block"><h3>KPI Digital Marketing · '+esc(row?.period||'-')+'</h3><div class="pxl-dm-dash-scroll"><table><thead><tr><th>Kanal</th><th>Metrik</th><th>Aktual</th><th>Bulan Lalu</th></tr></thead><tbody>'+(categoryRows||'<tr><td colspan="4">Belum ada data KPI.</td></tr>')+'</tbody></table></div></div>'
    +'<div class="pxl-dm-dash-block"><h3>Pencapaian Target</h3><p>Target tercapai: '+esc(target.achieved??0)+' / '+esc(target.total??0)+' ('+percent(target.achievement_rate)+')</p><div class="pxl-dm-dash-scroll"><table><thead><tr><th>Kanal</th><th>Target KPI</th><th>Aktual</th><th>Target</th><th>Progress</th></tr></thead><tbody>'+(targets||'<tr><td colspan="5">Belum ada target.</td></tr>')+'</tbody></table></div></div>';
}
function addStyles(){
  if(document.getElementById('pxlDmDashStyle'))return;
  const style=document.createElement('style');style.id='pxlDmDashStyle';
  style.textContent='#'+rootId+'{padding:4px 0 20px}#'+rootId+' .pxl-dm-dash-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px}#'+rootId+' .pxl-dm-dash-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}#'+rootId+' .pxl-dm-dash-card{background:white;border:1px solid #e3e9f1;border-radius:12px;padding:14px;min-width:0}#'+rootId+' .pxl-dm-dash-card small,#'+rootId+' .pxl-dm-dash-card span{display:block;color:#64748b;font-size:11px}#'+rootId+' .pxl-dm-dash-card strong{display:block;font-size:20px;margin:7px 0;color:#152542;overflow-wrap:anywhere}#'+rootId+' .pxl-dm-dash-block{background:white;border:1px solid #e3e9f1;border-radius:12px;padding:14px;margin-top:14px}#'+rootId+' .pxl-dm-dash-block h3{font-size:14px;margin:0 0 10px}#'+rootId+' .pxl-dm-dash-block p{font-size:12px;color:#64748b}#'+rootId+' .pxl-dm-dash-scroll{overflow:auto}#'+rootId+' table{width:100%;border-collapse:collapse;min-width:530px;font-size:12px}#'+rootId+' th,#'+rootId+' td{text-align:left;padding:8px;border-bottom:1px solid #edf0f5}#'+rootId+' th{background:#f8fafc;color:#41546f}#'+rootId+' .pxl-dm-dash-actions{display:flex;gap:8px;flex-wrap:wrap}#'+rootId+' .pxl-dm-dash-actions button,#'+rootId+' .pxl-dm-dash-actions select{padding:8px 12px;border:1px solid #dce3ec;border-radius:9px;background:white;color:#263c5c;font:inherit}';
  document.head.appendChild(style);
}
async function load(panel){
  if(role()!=='superadmin'){panel.replaceChildren();panel.style.display='none';return;}
  const body=panel.querySelector('[data-dm-dashboard-body]');
  if(!body)return;
  body.textContent='Memuat snapshot Digital Marketing...';
  try{
    const token=authToken();
    if(!token)throw new Error('Sesi login tidak ditemukan.');
    const response=await fetch('/api/digital-marketing/snapshots',{method:'GET',cache:'no-store',headers:{Authorization:'Bearer '+token,'X-Auth-Token':token}});
    const result=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(result?.error||'HTTP '+response.status);
    const rows=Array.isArray(result)?result:[];
    const select=panel.querySelector('[data-dm-period]');
    select.innerHTML=rows.map(row=>'<option value="'+esc(row.period)+'">'+esc(row.period)+' · '+esc(row.status||'')+'</option>').join('');
    select.style.display=rows.length?'':'none';
    const display=()=>{const item=rows.find(row=>row.period===select.value)||rows[0];body.innerHTML=item?details(item):'<div class="pxl-dm-dash-block">Belum ada snapshot Digital Marketing. Gunakan modul lengkap untuk melakukan pull data.</div>';};
    select.onchange=display;display();
  }catch(error){
    body.textContent='Gagal memuat snapshot Digital Marketing: '+String(error.message||error);
  }
}
function ensureTab(){
  if(role()!=='superadmin')return false;
  const crm=document.getElementById('dsub-crm'),project=document.getElementById('dsub-project'),crmPanel=document.getElementById('dash-sec-crm');
  if(!crm||!project||!crmPanel||!crm.parentNode||!crmPanel.parentNode)return false;
  if(document.getElementById(buttonId))return true;
  addStyles();
  const panel=document.createElement('div');panel.id=rootId;panel.style.display='none';
  panel.innerHTML='<div class="pxl-dm-dash-head"><div><h2 style="font-size:19px;margin:0 0 4px">📣 Digital Marketing</h2><div style="font-size:12px;color:#65738a">Snapshot Marketing Apps · STRICT READ ONLY · Akses Superadmin</div></div><div class="pxl-dm-dash-actions"><select data-dm-period aria-label="Periode Digital Marketing"></select><button type="button" data-dm-refresh>🔄 Refresh</button><button type="button" data-dm-open>📣 Buka Modul Lengkap</button></div></div><div data-dm-dashboard-body>Memuat data...</div>';
  crmPanel.parentNode.insertBefore(panel,crmPanel.nextSibling);
  const button=document.createElement('button');button.type='button';button.className='dash-sub-btn';button.id=buttonId;button.textContent='📣 Digital Marketing';
  crm.parentNode.insertBefore(button,project);
  button.addEventListener('click',()=>{
    if(role()!=='superadmin')return;
    if(typeof window.switchDashSub==='function')window.switchDashSub('digital-marketing',button);
    panel.style.display='';
    load(panel);
  });
  crm.parentNode.addEventListener('click',event=>{
    const other=event.target?.closest?.('.dash-sub-btn');
    if(other&&other!==button)panel.style.display='none';
  },true);
  panel.querySelector('[data-dm-refresh]').addEventListener('click',()=>load(panel));
  panel.querySelector('[data-dm-open]').addEventListener('click',()=>{
    if(role()!=='superadmin')return;
    const existing=document.querySelector('.sidebar [data-pxl-dm]');
    if(existing)existing.click();
    else panel.querySelector('[data-dm-dashboard-body]').textContent='Menu Digital Marketing lengkap belum dimuat. Buka menu Digital Marketing pada sidebar.';
  });
  return true;
}
function start(){
  let tries=0;
  if(ensureTab())return;
  const timer=setInterval(()=>{tries++;if(ensureTab()||tries>=45)clearInterval(timer)},1200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
