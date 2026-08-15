/* PXL-STG-0008A36 — Piutang responsif, action payment stabil, dan export PDF/Excel. */
(function(){
  'use strict';
  const KEY='pxl-stg-0008a25';
  let issued=[];
  let loaded=false;
  function activeRole(){
    const user=(typeof currentUser!=='undefined'&&currentUser)?currentUser:window.currentUser;
    const raw=user?.role||document.getElementById('user-pill')?.textContent?.match(/\(([^)]+)\)/)?.[1]||'';
    const normalized=String(raw).toLowerCase().replace(/[\s_-]/g,'');
    return normalized==='akunting'?'accounting':normalized;
  }
  const canAccount=()=>['accounting','admin','superadmin'].includes(activeRole());
  const canRead=()=>['accounting','admin','superadmin','manager'].includes(activeRole());
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
    return [...base,...issued.filter(x=>!ids.has(String(x.id||''))&&(String(x.source_type||'')!=='direct_sales'||String(x.payment_status||'')==='paid'))];
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
  function addResponsiveStyle(){
    if(document.getElementById('pxl-piutang-responsive-style'))return;
    const style=document.createElement('style');
    style.id='pxl-piutang-responsive-style';
    style.textContent=`
      .pxl-piutang-mobile{display:none}
      .pxl-piutang-desktop table{min-width:1080px}
      .pxl-piutang-desktop th{white-space:nowrap;background:var(--surface,#f8fafc);border-bottom:1px solid var(--border,#e5e7eb)}
      .pxl-piutang-desktop td{padding-top:12px;padding-bottom:12px;border-bottom:1px solid var(--border,#e5e7eb);vertical-align:top}
      .pxl-piutang-desktop tbody tr:hover td{background:rgba(224,123,57,.045)}
      .pxl-piutang-desktop th:last-child,.pxl-piutang-desktop td:last-child{position:sticky;right:0;background:var(--card,#fff);z-index:2;box-shadow:-8px 0 12px rgba(0,0,0,.05)}
      .pxl-piutang-desktop thead th:last-child{z-index:3}
      .pxl-piutang-toolbar{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:0 0 12px}
      @media(max-width:768px){
        .pxl-piutang-desktop{display:none}
        .pxl-piutang-mobile{display:grid;gap:12px}
        .pxl-piutang-card{background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:14px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.04);min-width:0}
        .pxl-piutang-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px}
        .pxl-piutang-card-number{font-size:15px;font-weight:800;overflow-wrap:anywhere}
        .pxl-piutang-card-date{font-size:11px;color:var(--muted,#6b7280);margin-top:3px}
        .pxl-piutang-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}
        .pxl-piutang-field{min-width:0}
        .pxl-piutang-field.wide{grid-column:1/-1}
        .pxl-piutang-label{font-size:10px;line-height:1.2;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#6b7280);margin-bottom:3px}
        .pxl-piutang-value{font-size:13px;line-height:1.35;overflow-wrap:anywhere}
        .pxl-piutang-balance{font-size:16px;font-weight:800;color:#b45309}
        .pxl-piutang-action{width:100%;min-height:44px;margin-top:14px;font-size:14px;font-weight:700}
      }
    `;
    document.head.appendChild(style);
  }
  function addTab(){
    if(tab())return;
    const el=document.createElement('div');el.id='tab-piutang-v1';el.className='tab-content';
    el.innerHTML='<div class="section-title">📋 Daftar Piutang</div><div class="section-sub">Invoice Terbit yang belum lunas. Omzet tetap tercatat saat invoice diterbitkan.</div><div id="pxl-piutang-content" style="margin-top:16px"></div>';
    document.getElementById('app-content')?.appendChild(el);
  }
  function addMenu(){
    if(!canRead()||document.querySelector('[data-tab-id="piutang"]'))return;
    const nav=document.getElementById('main-nav');if(!nav)return;
    let group=[...nav.querySelectorAll('.sidebar-group')].find(x=>/accounting/i.test(x.querySelector('.sidebar-group-toggle span')?.textContent||''));
    if(!group){
      group=document.createElement('div');
      group.className='sidebar-group';
      group.dataset.navGroup='accounting-piutang';
      group.innerHTML='<button type="button" class="sidebar-group-toggle" aria-expanded="true"><span>Accounting &amp; Piutang</span><span class="sidebar-group-arrow">▾</span></button><div class="sidebar-group-content"></div>';
      nav.appendChild(group);
    }
    const button=document.createElement('button');button.id='pxl-piutang-menu';button.type='button';button.className='nav-btn';button.dataset.tabId='piutang';button.innerHTML='💳 <span class="nav-label">Daftar Piutang</span>';
    button.onclick=()=>open(button);
    (group.querySelector('.sidebar-group-content')||group).appendChild(button);
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
    const rows=receivables.map(x=>{const wos=Array.isArray(x.work_order_numbers)&&x.work_order_numbers.length?x.work_order_numbers.join(', '):'-';return `<tr><td><b>${esc(x.invoice_number||x.temporary_number||'-')}</b><br><small>${date(x.invoice_date)}</small></td><td>${esc(x.customer_name_snapshot||'-')}<br><small>Sales: ${esc(x.sales_pic||'-')}</small></td><td><small>SO: ${esc(x.source_so_number||'-')}</small><br><small>WO: ${esc(wos)}</small></td><td>${date(x.due_date)}</td><td>${money(x.total_amount)}</td><td>${money(x.paid_amount)}</td><td><b>${money(x.balance_amount)}</b></td><td>${status(x)}</td>${canAccount()?`<td><button class="btn sm primary" data-pay="${esc(x.id)}">Catat Bayar</button></td>`:''}</tr>`;}).join('');
    const cards=receivables.map(x=>{const wos=Array.isArray(x.work_order_numbers)&&x.work_order_numbers.length?x.work_order_numbers.join(', '):'-';return `<article class="pxl-piutang-card"><div class="pxl-piutang-card-head"><div><div class="pxl-piutang-card-number">${esc(x.invoice_number||x.temporary_number||'-')}</div><div class="pxl-piutang-card-date">Tanggal Invoice: ${date(x.invoice_date)}</div></div>${status(x)}</div><div class="pxl-piutang-card-grid"><div class="pxl-piutang-field wide"><div class="pxl-piutang-label">Customer / Sales PIC</div><div class="pxl-piutang-value"><b>${esc(x.customer_name_snapshot||'-')}</b><br>Sales: ${esc(x.sales_pic||'-')}</div></div><div class="pxl-piutang-field wide"><div class="pxl-piutang-label">Referensi</div><div class="pxl-piutang-value">SO: ${esc(x.source_so_number||'-')}<br>WO: ${esc(wos)}</div></div><div class="pxl-piutang-field"><div class="pxl-piutang-label">Jatuh Tempo</div><div class="pxl-piutang-value">${date(x.due_date)}</div></div><div class="pxl-piutang-field"><div class="pxl-piutang-label">Total Invoice</div><div class="pxl-piutang-value">${money(x.total_amount)}</div></div><div class="pxl-piutang-field"><div class="pxl-piutang-label">Terbayar</div><div class="pxl-piutang-value">${money(x.paid_amount)}</div></div><div class="pxl-piutang-field"><div class="pxl-piutang-label">Sisa Piutang</div><div class="pxl-piutang-value pxl-piutang-balance">${money(x.balance_amount)}</div></div></div>${canAccount()?`<button class="btn primary pxl-piutang-action" data-pay="${esc(x.id)}">Catat Bayar</button>`:''}</article>`;}).join('');
    box.innerHTML=`<div class="metric-grid" style="margin-bottom:16px"><div class="metric"><div class="metric-label">Total Piutang</div><div class="metric-value">${money(total)}</div><div class="metric-sub">${receivables.length} invoice belum lunas</div></div><div class="metric"><div class="metric-label">Jatuh Tempo</div><div class="metric-value">${receivables.filter(x=>x.due_date&&new Date(x.due_date+'T23:59:59')<new Date()).length}</div><div class="metric-sub">perlu tindak lanjut</div></div></div><div class="pxl-piutang-toolbar"><button class="btn" id="pxl-piutang-pdf">Download PDF</button><button class="btn" id="pxl-piutang-excel">Download Excel</button></div><div class="table-wrap pxl-piutang-desktop"><table style="font-size:12px"><thead><tr><th>Invoice / Tanggal</th><th>Customer / Sales PIC</th><th>Referensi SO / WO</th><th>Jatuh Tempo</th><th>Total</th><th>Terbayar</th><th>Sisa Piutang</th><th>Status</th>${canAccount()?'<th>Aksi</th>':''}</tr></thead><tbody>${rows||`<tr><td colspan="${canAccount()?9:8}" style="text-align:center;padding:24px;color:var(--muted)">Tidak ada piutang terbuka.</td></tr>`}</tbody></table></div><div class="pxl-piutang-mobile">${cards||'<div class="no-data">Tidak ada piutang terbuka.</div>'}</div>`;
    box.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>payment(b.dataset.pay));
    document.getElementById('pxl-piutang-pdf')?.addEventListener('click',()=>exportPdf(receivables,total));
    document.getElementById('pxl-piutang-excel')?.addEventListener('click',()=>exportExcel(receivables));
  }
  function exportRows(rows){return rows.map((x,i)=>{const wos=Array.isArray(x.work_order_numbers)?x.work_order_numbers.join(', '):'';return {'No':i+1,'Nomor Invoice':x.invoice_number||x.temporary_number||'-','Tanggal Invoice':date(x.invoice_date),'Customer':x.customer_name_snapshot||'-','Sales PIC':x.sales_pic||'-','Nomor SO':x.source_so_number||'-','Nomor WO':wos||'-','Jatuh Tempo':date(x.due_date),'Total Invoice':Number(x.total_amount)||0,'Terbayar':Number(x.paid_amount)||0,'Sisa Piutang':Number(x.balance_amount)||0,'Status':Number(x.paid_amount)>0?'Sebagian':'Belum Lunas'};});}
  function exportExcel(rows){
    if(!window.XLSX){alert('Komponen Excel belum tersedia. Muat ulang halaman lalu coba lagi.');return;}
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(exportRows(rows));
    ws['!cols']=[5,24,15,24,18,20,24,15,16,16,16,14].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb,ws,'Daftar Piutang');XLSX.writeFile(wb,`daftar_piutang_${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  function exportPdf(rows,total){
    const jsPDF=window.jspdf?.jsPDF;if(!jsPDF){alert('Komponen PDF belum tersedia. Muat ulang halaman lalu coba lagi.');return;}
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),body=exportRows(rows).map(r=>[r['Nomor Invoice'],r['Tanggal Invoice'],r.Customer,r['Nomor SO'],r['Nomor WO'],r['Jatuh Tempo'],money(r['Total Invoice']),money(r.Terbayar),money(r['Sisa Piutang']),r.Status]);
    doc.setFontSize(16);doc.text('Daftar Piutang',14,15);doc.setFontSize(9);doc.text(`Dicetak ${new Date().toLocaleString('id-ID')}  |  Total sisa piutang: ${money(total)}`,14,21);
    doc.autoTable({startY:26,head:[['Invoice','Tanggal','Customer','SO','WO','Jatuh Tempo','Total','Terbayar','Sisa','Status']],body,styles:{fontSize:7,cellPadding:2},headStyles:{fillColor:[224,123,57]},columnStyles:{6:{halign:'right'},7:{halign:'right'},8:{halign:'right'}}});
    doc.save(`daftar_piutang_${new Date().toISOString().slice(0,10)}.pdf`);
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
  async function open(button){
    addTab();document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));tab()?.classList.add('active');document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));document.getElementById('pxl-piutang-menu')?.classList.add('active');
    (button||document.querySelector('[data-tab-id="piutang"]'))?.classList.add('active');
    const box=document.getElementById('pxl-piutang-content');if(box)box.innerHTML='<div class="no-data">Memuat piutang...</div>';
    try{await refreshIssued(true);render();}catch(e){if(box)box.innerHTML='<div class="alert error">'+esc(e.message)+'</div>';}
  }
  window.openPxlReceivables=open;
  function init(){addResponsiveStyle();addTab();addMenu();}
  window.addEventListener('load',init);new MutationObserver(init).observe(document.documentElement,{childList:true,subtree:true});
})();
