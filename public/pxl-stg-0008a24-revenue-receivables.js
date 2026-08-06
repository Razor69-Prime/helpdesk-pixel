/* PXL-STG-0008A24 — Invoice V1 Terbit sebagai omzet, realisasi Sales PIC, dan Piutang. */
(function(){
  'use strict';
  const KEY='pxl-stg-0008a24';
  let issued=[];
  let loaded=false;
  const canAccount=()=>['accounting','admin','superadmin'].includes(String(window.currentUser?.role||'').toLowerCase());
  const canRead=()=>['accounting','admin','superadmin','manager'].includes(String(window.currentUser?.role||'').toLowerCase());
  const headers=()=>{const token=localStorage.getItem('pixel_token')||'';return {'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>typeof window.fmtFull==='function'?window.fmtFull(Number(v)||0):'Rp '+Number(v||0).toLocaleString('id-ID');
  const date=v=>v?new Date(v).toLocaleDateString('id-ID'):'—';
  async function request(path,options={}){
    const r=await fetch(path,{...options,headers:{...headers(),...(options.headers||{})},cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Gagal memuat data Invoice.');
    return data;
  }
  function normalize(row){
    return {...row,
      total_amount:Number(row.total_amount)||0,
      paid_amount:Number(row.paid_amount)||0,
      balance_amount:row.balance_amount==null?Number(row.total_amount)||0:Number(row.balance_amount),
      sales_pic:row.sales_pic_snapshot||row.sales_pic||'',
      uploaded_at:row.issued_at||row.invoice_date,
      ticket_date:row.invoice_date,
      invoice_source:'invoice_v1'
    };
  }
  async function refreshIssued(force=false){
    if(loaded&&!force)return issued;
    const rows=await request('/api/invoice-v1?status=issued');
    // Invoice sudah lunas/terbayar sebagian juga omzet, sehingga ambil seluruh status terbit sekaligus.
    const all=await request('/api/invoice-v1');
    issued=(Array.isArray(all)?all:rows).filter(x=>['issued','partially_paid','paid'].includes(String(x.invoice_status||''))).map(normalize);
    loaded=true;return issued;
  }
  const oldBuild=window.buildInvoiceFlat;
  window.buildInvoiceFlat=function(){
    const base=typeof oldBuild==='function'?oldBuild.call(this):[];
    const ids=new Set(base.map(x=>String(x.id||'')));
    return [...base,...issued.filter(x=>!ids.has(String(x.id||'')))];
  };
  const oldDashboard=window.loadDashboard;
  window.loadDashboard=async function(){
    try{await refreshIssued(true);}catch(e){console.error(KEY,e);}
    const result=await oldDashboard.apply(this,arguments);
    refreshDashboardRevenue();
    return result;
  };
  const oldSales=window.loadSalesDashboard;
  window.loadSalesDashboard=async function(){
    try{await refreshIssued(true);}catch(e){console.error(KEY,e);}
    return oldSales.apply(this,arguments);
  };
  function dashboardInvoices(){
    if(typeof window.getDashInvoices==='function')return window.getDashInvoices();
    const range=typeof window.getDashRange==='function'?window.getDashRange():{from:null,to:null};
    return (typeof window.buildInvoiceFlat==='function'?window.buildInvoiceFlat():issued).filter(inv=>{
      const d=new Date(inv.invoice_date||inv.issued_at);
      return !(range.from&&d<range.from)&&!(range.to&&d>range.to);
    });
  }
  function refreshDashboardRevenue(){
    const rows=dashboardInvoices();
    const total=rows.reduce((s,x)=>s+Number(x.total_amount||0),0);
    const byPic={};rows.forEach(x=>{const pic=x.sales_pic||'(Tidak ada)';byPic[pic]=(byPic[pic]||0)+Number(x.total_amount||0);});
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
    set('dm-invoice-total',money(total));set('dm-invoice-count',rows.length+' invoice');set('dm-realisasi-total',money(total));
    const target=typeof window.getDashTargetSummary==='function'?Number(window.getDashTargetSummary().totalTarget||0):0;
    const achievement=target>0?Math.round(total/target*100):null;
    set('dm-target-total',target?money(target):'Rp 0');set('dm-achievement',achievement===null?'—':achievement+'%');
    const sub=document.getElementById('dm-achievement-sub');if(sub)sub.textContent=achievement===null?'Target belum diset':(achievement>=100?'🎉 Target tercapai':`${money(target-total)} lagi`);
    const sales=document.getElementById('dash-sales-chart');const entries=Object.entries(byPic).sort((a,b)=>b[1]-a[1]);
    if(sales){const max=Math.max(1,...entries.map(([,v])=>v));sales.innerHTML=entries.length?`<div class="dash-bar-list">${entries.map(([pic,val])=>`<div class="dash-bar-row"><div class="dash-bar-label" title="${esc(pic)}">👤 ${esc(pic)}</div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Math.round(val/max*100)}%;background:var(--teal)"></div></div><div class="dash-bar-val" style="font-size:11px">${money(val)}</div></div>`).join('')}</div>`:'<div class="no-data">📭 Belum ada invoice Terbit dengan Sales PIC</div>';}
    const targetChart=document.getElementById('dash-target-chart');
    if(targetChart&&entries.length){const targetMap=typeof window.getDashTargetSummary==='function'?window.getDashTargetSummary().targetMap||{}:{};const pics=[...new Set([...entries.map(([p])=>p),...Object.keys(targetMap)])];const max=Math.max(1,...pics.map(p=>Math.max(byPic[p]||0,Number(targetMap[p]||0))));targetChart.innerHTML=`<div class="dash-bar-list" style="gap:12px">${pics.map(p=>{const real=byPic[p]||0,tar=Number(targetMap[p]||0),pct=tar?Math.round(real/tar*100):null;return `<div><div style="display:flex;justify-content:space-between;font-size:12px"><b>👤 ${esc(p)}</b><b>${pct===null?'—':pct+'%'}</b></div><div class="dash-bar-bg" style="margin:4px 0"><div class="dash-bar-fill" style="width:${Math.round(real/max*100)}%;background:var(--teal)"></div></div><small>Realisasi ${money(real)} · Target ${tar?money(tar):'—'}</small></div>`;}).join('')}</div>`;}
  }
  function tab(){return document.getElementById('tab-piutang-v1');}
  function addTab(){
    if(tab())return;
    const el=document.createElement('div');el.id='tab-piutang-v1';el.className='tab-content';
    el.innerHTML='<div class="section-title">📋 Daftar Piutang</div><div class="section-sub">Invoice Terbit yang belum lunas. Omzet tetap tercatat saat invoice diterbitkan.</div><div id="pxl-piutang-content" style="margin-top:16px"></div>';
    document.getElementById('app-content')?.appendChild(el);
  }
  function addMenu(){
    if(!canRead()||document.getElementById('pxl-piutang-menu'))return;
    const nav=document.getElementById('main-nav');if(!nav)return;
    let group=[...nav.querySelectorAll('.sidebar-group')].find(x=>/keuangan/i.test(x.textContent||''));
    const button=document.createElement('button');button.id='pxl-piutang-menu';button.type='button';button.className='nav-btn';button.dataset.tabId='piutang-v1';button.innerHTML='💳 <span class="nav-label">Daftar Piutang</span>';
    button.onclick=()=>open();
    (group?.querySelector('.sidebar-group-content')||nav).appendChild(button);
  }
  function status(row){
    if(Number(row.balance_amount)<=0.0001)return '<span class="status-badge done">Lunas</span>';
    if(Number(row.paid_amount)>0)return '<span class="status-badge pending">Sebagian</span>';
    const overdue=row.due_date&&new Date(row.due_date+'T23:59:59')<new Date();
    return overdue?'<span class="status-badge" style="background:#fee2e2;color:#b91c1c">Jatuh Tempo</span>':'<span class="status-badge assigned">Belum Lunas</span>';
  }
  function render(){
    const box=document.getElementById('pxl-piutang-content');if(!box)return;
    const receivables=issued.filter(x=>Number(x.balance_amount)>0.0001);
    const total=receivables.reduce((s,x)=>s+Number(x.balance_amount||0),0);
    box.innerHTML=`<div class="metric-grid" style="margin-bottom:16px"><div class="metric"><div class="metric-label">Total Piutang</div><div class="metric-value">${money(total)}</div><div class="metric-sub">${receivables.length} invoice belum lunas</div></div><div class="metric"><div class="metric-label">Jatuh Tempo</div><div class="metric-value">${receivables.filter(x=>x.due_date&&new Date(x.due_date+'T23:59:59')<new Date()).length}</div><div class="metric-sub">perlu tindak lanjut</div></div></div><div class="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer / Sales PIC</th><th>Jatuh Tempo</th><th>Total</th><th>Terbayar</th><th>Sisa Piutang</th><th>Status</th>${canAccount()?'<th>Aksi</th>':''}</tr></thead><tbody>${receivables.map(x=>`<tr><td><b>${esc(x.invoice_number||x.temporary_number||'-')}</b><br><small>${date(x.invoice_date)}</small></td><td>${esc(x.customer_name_snapshot||'-')}<br><small>Sales: ${esc(x.sales_pic||'-')}</small></td><td>${date(x.due_date)}</td><td>${money(x.total_amount)}</td><td>${money(x.paid_amount)}</td><td><b>${money(x.balance_amount)}</b></td><td>${status(x)}</td>${canAccount()?`<td><button class="btn sm primary" data-pay="${esc(x.id)}">Catat Bayar</button></td>`:''}</tr>`).join('')||`<tr><td colspan="${canAccount()?8:7}" style="text-align:center;padding:24px;color:var(--muted)">Tidak ada piutang terbuka.</td></tr>`}</tbody></table></div>`;
    box.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>payment(b.dataset.pay));
  }
  async function payment(id){
    const inv=issued.find(x=>String(x.id)===String(id));if(!inv)return;
    const raw=prompt(`Nominal pembayaran untuk ${inv.invoice_number||'Invoice'} (sisa ${money(inv.balance_amount)}):`,String(Math.round(inv.balance_amount)));
    if(raw===null)return;
    const amount=Number(String(raw).replace(/[^0-9.,-]/g,'').replace(/,/g,''));
    if(!Number.isFinite(amount)||amount<=0){alert('Nominal pembayaran tidak valid.');return;}
    const note=prompt('Catatan pembayaran (opsional):','')||'';
    try{await request(`/api/invoice-v1/${encodeURIComponent(id)}/payment`,{method:'POST',body:JSON.stringify({paid_amount:amount,note})});await refreshIssued(true);render();if(typeof window.loadDashboard==='function')window.loadDashboard();if(typeof window.loadSalesDashboard==='function')window.loadSalesDashboard();alert('Pembayaran berhasil dicatat.');}catch(e){alert(e.message);}
  }
  async function open(){
    addTab();document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));tab()?.classList.add('active');document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));document.getElementById('pxl-piutang-menu')?.classList.add('active');
    const box=document.getElementById('pxl-piutang-content');if(box)box.innerHTML='<div class="no-data">Memuat piutang...</div>';
    try{await refreshIssued(true);render();}catch(e){if(box)box.innerHTML='<div class="alert error">'+esc(e.message)+'</div>';}
  }
  function init(){addTab();addMenu();}
  window.addEventListener('load',init);new MutationObserver(init).observe(document.documentElement,{childList:true,subtree:true});
})();
