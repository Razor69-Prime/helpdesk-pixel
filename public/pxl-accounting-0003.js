/* PXL-ACC-0003 — Annual Excel export + PixelApps-standard Accounting dashboard polish. */
(function(){
'use strict';
const REV='PXL-ACC-0003C';
const $=id=>document.getElementById(id);
function h(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const token=()=>{try{return String(window.__pxlAuthToken||localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||'').trim()}catch(_){return String(window.__pxlAuthToken||'').trim()}};
function installStyle(){
  if($('pxl-accounting-0003-style'))return;
  const s=document.createElement('style');s.id='pxl-accounting-0003-style';s.textContent=`
  #pxl-accounting-root .acc-dashboard-toolbar{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:12px}
  #pxl-accounting-root .acc-dashboard-toolbar>select,#pxl-accounting-root .acc-dashboard-toolbar>input{min-width:112px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 10px}
  #pxl-accounting-root .acc-dashboard-actions{display:flex;gap:7px;flex-wrap:wrap;margin-left:auto}
  #pxl-accounting-root .acc-dashboard-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:12px}
  #pxl-accounting-root .acc-kpi-card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px 14px 60px;min-width:0}
  #pxl-accounting-root .acc-kpi-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:34px;height:34px;border-radius:10px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:16px}
  #pxl-accounting-root .acc-kpi-card .acc-metric-label{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.06em;margin-bottom:6px}
  #pxl-accounting-root .acc-kpi-card .acc-metric-value{font-size:22px;font-weight:600;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #pxl-accounting-root .acc-finance-section{margin:0 0 12px}
  #pxl-accounting-root .acc-finance-title{font-size:12px;font-weight:700;color:var(--text);margin:0 0 8px}
  #pxl-accounting-root .acc-finance-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  #pxl-accounting-root .acc-finance-card{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;min-width:0}
  #pxl-accounting-root .acc-finance-icon{width:40px;height:40px;border-radius:12px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:18px;flex:0 0 auto}
  #pxl-accounting-root .acc-finance-copy{min-width:0}.acc-finance-label{font-size:11px;font-weight:600;color:var(--muted);margin-bottom:2px}.acc-finance-value{font-size:20px;font-weight:700;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.acc-finance-note{font-size:10px;color:var(--muted);margin-top:2px}
  #pxl-accounting-root .acc-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  #pxl-accounting-root .acc-chart-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;min-height:190px}
  #pxl-accounting-root .acc-chart-card .acc-chart-title{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.04em;margin-bottom:12px}
  #pxl-accounting-root .acc-chart-card .acc-bar-track{height:6px;background:var(--surface2)}
  #pxl-accounting-root .acc-chart-card .acc-bar-fill{background:var(--accent)}
  @media(max-width:1100px){#pxl-accounting-root .acc-dashboard-grid{grid-template-columns:repeat(3,minmax(0,1fr))}#pxl-accounting-root .acc-finance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:900px){#pxl-accounting-root .acc-chart-grid{grid-template-columns:1fr}}
  @media(max-width:700px){#pxl-accounting-root .acc-dashboard-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#pxl-accounting-root .acc-finance-grid{grid-template-columns:1fr}#pxl-accounting-root .acc-dashboard-actions{width:100%;margin-left:0}#pxl-accounting-root .acc-dashboard-actions .btn{flex:1}}
  `;document.head.appendChild(s);
}
function enhanceTransactions(){
  const txMonthly=$('acc-export');if(txMonthly&&!$('acc-export-year')){
    txMonthly.id='acc-export-month';txMonthly.textContent='⬇ Excel Bulan';txMonthly.onclick=()=>window.pxlAccountingExport?.(false);
    const txAnnual=document.createElement('button');txAnnual.className='btn';txAnnual.id='acc-export-year';txAnnual.textContent='⬇ Excel 1 Tahun';txAnnual.onclick=()=>window.pxlAccountingExport?.(true);txMonthly.insertAdjacentElement('afterend',txAnnual);
  }
}

function rupiah(v){return 'Rp '+Math.round(Number(v)||0).toLocaleString('id-ID')}
function financeCard(icon,label,value,count){return `<div class="acc-finance-card"><div class="acc-finance-icon">${h(icon)}</div><div class="acc-finance-copy"><div class="acc-finance-label">${h(label)}</div><div class="acc-finance-value">${rupiah(value)}</div><div class="acc-finance-note">${Number(count||0).toLocaleString('id-ID')} transaksi</div></div></div>`;}
function enhanceKpiCards(summary){
  const icons={Omzet:'💰',HPP:'📦',DPP:'🧾',PPN:'%',NET:'📈',Transaksi:'#'};
  summary.querySelectorAll('.acc-metric').forEach(card=>{card.classList.add('acc-kpi-card');if(card.querySelector('.acc-kpi-icon'))return;const label=card.querySelector('.acc-metric-label')?.textContent?.trim()||'';const icon=document.createElement('div');icon.className='acc-kpi-icon';icon.textContent=icons[label]||'•';card.prepend(icon);});
}
function enhanceFinanceCards(root){
  const st=window.pxlAccountingState||{},d=st.dashboard||{};
  const summary=root.querySelector('.acc-summary');if(!summary)return;
  const paid=Array.isArray(d.paid_breakdown)?d.paid_breakdown:[],payments=Array.isArray(d.payment_methods)?d.payment_methods:[];
  const signature=JSON.stringify({paid,payments});let wrap=$('acc-finance-cards');
  if(wrap&&wrap.dataset.signature===signature)return;
  if(!wrap){wrap=document.createElement('div');wrap.id='acc-finance-cards';wrap.className='acc-finance-section';summary.insertAdjacentElement('afterend',wrap);}
  wrap.dataset.signature=signature;
  const paidBy=Object.fromEntries(paid.map(x=>[x.name,x]));
  const paidHtml=financeCard('✓','PAID',paidBy.PAID?.value||0,paidBy.PAID?.count||0)+financeCard('!','UNPAID',paidBy.UNPAID?.value||0,paidBy.UNPAID?.count||0);
  const paymentHtml=payments.length?payments.map(x=>financeCard('💳',x.name||'-',x.value,x.count)).join(''):financeCard('💳','Metode Pembayaran',0,0);
  wrap.innerHTML=`<div class="acc-finance-title">Status Pembayaran</div><div class="acc-finance-grid">${paidHtml}</div><div class="acc-finance-title" style="margin-top:12px">Metode Pembayaran</div><div class="acc-finance-grid">${paymentHtml}</div>`;
}

function enhanceDashboard(){
  const root=$('pxl-accounting-root');if(!root)return;
  const sub=root.querySelector('.acc-sub');if(sub&&/PXL-ACC-0002/.test(sub.textContent||''))sub.textContent=(sub.textContent||'').replace('PXL-ACC-0002',REV);
  enhanceTransactions();
  const month=$('ad-month');if(!month)return;
  const toolbar=month.closest('.acc-toolbar');if(toolbar){toolbar.classList.add('acc-dashboard-toolbar');const spacer=toolbar.querySelector('.acc-spacer');if(spacer)spacer.remove();}
  const summary=root.querySelector('.acc-summary');if(summary){summary.classList.add('acc-dashboard-grid');enhanceKpiCards(summary);enhanceFinanceCards(root);}
  const charts=root.querySelector('.acc-charts');if(charts){charts.classList.add('acc-chart-grid');charts.querySelectorAll('.acc-chart').forEach(x=>x.classList.add('acc-chart-card'));}
  const monthly=$('ad-export');if(monthly&&!$('ad-export-year')){
    monthly.id='ad-export-month';monthly.textContent='⬇ Excel Bulan';
    let actions=toolbar?.querySelector('.acc-dashboard-actions');if(!actions){actions=document.createElement('div');actions.className='acc-dashboard-actions';toolbar?.appendChild(actions);}
    actions.appendChild(monthly);
    const annual=document.createElement('button');annual.className='btn primary';annual.id='ad-export-year';annual.textContent='⬇ Excel 1 Tahun';annual.onclick=()=>window.pxlAccountingExport?.(true);actions.appendChild(annual);
    monthly.onclick=()=>window.pxlAccountingExport?.(false);
  }
}
window.pxlAccountingExport=async function(annual=false){
  try{
    const auth=token();if(!auth)throw new Error('Token login tidak tersedia.');
    const st=window.pxlAccountingState||{};const year=Number(st.year)||new Date().getFullYear();const month=Number(st.month)||new Date().getMonth()+1;
    const context=st.outletScope==='all'?'scope=all':`outlet_id=${encodeURIComponent(st.activeOutletId||'')}`;
    const period=annual?`year=${encodeURIComponent(year)}&annual=1`:`year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;
    const r=await fetch(`/api/accounting/export?${period}&${context}`,{cache:'no-store',headers:{Authorization:'Bearer '+auth,'X-Auth-Token':auth,'Cache-Control':'no-cache'}});
    if(!r.ok){let msg='Export Excel gagal.';try{const j=await r.json();if(j?.error)msg=j.error}catch(_){}throw new Error(msg)}
    const blob=await r.blob(),dispo=r.headers.get('Content-Disposition')||'',m=dispo.match(/filename="?([^";]+)"?/i);
    const name=m?.[1]||`Accounting_${st.outletScope==='all'?'Semua_Outlet':'Outlet'}_${annual?year:`${year}-${String(month).padStart(2,'0')}`}.xlsx`;
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){alert(e.message||e);}
};
installStyle();enhanceDashboard();
const observer=new MutationObserver(()=>enhanceDashboard());observer.observe(document.documentElement,{subtree:true,childList:true});
window.pxlAccounting0003Enhance=enhanceDashboard;
})();
