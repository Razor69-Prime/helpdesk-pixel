/* PXL-SALES-BILL-0001 — manual billing follow-up for completed WO only. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const format=v=>v===null||v===undefined?'Belum diketahui':'Rp'+Number(v||0).toLocaleString('id-ID');
 let rows=[],readOnly=false,loading=false,selected='',search='',statusFilter='open';
 const labels={needs_review:'Perlu Verifikasi',pending_note:'Belum Konfirmasi Nota',noted:'Sudah Nota',no_revenue:'Tidak Beromzet'};
 const asDate=v=>v?new Date(v).toLocaleDateString('id-ID',{timeZone:'Asia/Makassar',day:'2-digit',month:'short',year:'numeric'}):'-';
 const asDateTime=v=>v?new Date(v).toLocaleString('id-ID',{timeZone:'Asia/Makassar',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'-';
 function badge(){const el=document.querySelector('[data-tab-id="sales_wo_reminder"] .nav-label');if(!el)return;const count=rows.filter(x=>['needs_review','pending_note'].includes(x.status)).length;el.textContent='Reminder Nota WO'+(count?' ('+count+')':'');}
 function style(){if($('pxl-sales-wo-style'))return;const sheet=document.createElement('style');sheet.id='pxl-sales-wo-style';sheet.textContent=`
 #pxl-sales-wo-billing-root{padding:17px;max-width:1600px;margin:auto;color:var(--text,#1f2937)}
 .swb-head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:15px}
 .swb-grid{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;margin-bottom:15px}
 .swb-card{background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:14px}
 .swb-card small{color:var(--muted,#667085)}.swb-card b{display:block;font-size:24px;margin-top:5px}
 .swb-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
 .swb-toolbar input,.swb-toolbar select,.swb-edit input,.swb-edit select,.swb-edit textarea{padding:9px;border:1px solid var(--border,#ddd);border-radius:7px;background:var(--surface,#fff);color:var(--text,#222);max-width:100%;font:inherit}
 .swb-scroll{max-width:100%;overflow-x:auto;border:1px solid var(--border,#ddd);border-radius:10px}
 .swb-table{width:100%;border-collapse:collapse;font-size:12px;min-width:850px}.swb-table td,.swb-table th{padding:10px 9px;border-bottom:1px solid var(--border,#e7e7e7);text-align:left;vertical-align:top}
 .swb-table th{background:var(--surface2,#f7f8fa)}.swb-table tr:last-child td{border-bottom:0}
 .swb-muted{color:var(--muted,#718096);font-size:11px}.swb-pill{display:inline-block;padding:4px 8px;border-radius:99px;background:var(--surface2,#f4f4f4);white-space:nowrap}
 .swb-btn{border:1px solid var(--border,#ddd);background:var(--surface,#fff);color:var(--text,#222);border-radius:7px;padding:7px 9px;cursor:pointer;font:inherit;font-size:12px}
 .swb-btn.primary{background:var(--primary,#e88932);border-color:transparent;color:#fff}.swb-btn:disabled{opacity:.5;cursor:default}
 .swb-edit{padding:15px;margin-top:12px;background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:10px}
 .swb-edit-grid{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr));gap:10px}.swb-edit label{display:block;font-size:11px;margin-bottom:4px}
 .swb-edit input,.swb-edit select,.swb-edit textarea{width:100%;box-sizing:border-box}.swb-hint{font-size:12px;color:var(--muted,#718096);margin-top:7px}
 @media(max-width:700px){.swb-grid{grid-template-columns:repeat(2,minmax(110px,1fr))}.swb-edit-grid{grid-template-columns:1fr}}
 `;document.head.appendChild(sheet)}
 const root=()=>$('pxl-sales-wo-billing-root');
 function init(){style();if(!root())return;root().innerHTML=`<div class="swb-head"><div><h2 style="margin:0">🔔 Reminder Nota Work Order</h2><div class="swb-hint">Monitoring WO selesai · nota manual dibuat di luar PixelApps · tidak memengaruhi closing WO</div></div><button class="swb-btn" id="swb-refresh">↻ Refresh</button></div><div id="swb-content">Memuat...</div>`;$('swb-refresh').onclick=load}
 function summary(){const pending=rows.filter(r=>r.status==='pending_note'),review=rows.filter(r=>r.status==='needs_review'),noted=rows.filter(r=>r.status==='noted');return {pending,review,noted,amount:pending.reduce((n,r)=>n+Number(r.revenue_amount||0),0)}}
 function draw(){const host=$('swb-content');if(!host)return;const sum=summary();const q=search.trim().toLowerCase();const visible=rows.filter(r=>{
  const match=!q||[r.wo_number,r.so_number,r.customer_name,r.project_name,r.sales_pic].join(' ').toLowerCase().includes(q);
  const status=statusFilter==='open'?['needs_review','pending_note'].includes(r.status):statusFilter==='all'||r.status===statusFilter;
  return match&&status;
 });
 host.innerHTML=`<div class="swb-grid"><div class="swb-card"><small>WO Selesai Termonitor</small><b>${rows.length}</b></div><div class="swb-card"><small>Belum Konfirmasi Nota</small><b>${sum.pending.length}</b></div><div class="swb-card"><small>Perlu Verifikasi Omzet</small><b>${sum.review.length}</b></div><div class="swb-card"><small>Nilai WO Belum Konfirmasi</small><b style="font-size:20px">${format(sum.amount)}</b></div></div>
 <div class="swb-toolbar"><input id="swb-search" placeholder="Cari nomor WO, customer, SO, Sales PIC" value="${esc(search)}" style="flex:1;min-width:200px"><select id="swb-filter"><option value="open">Belum Selesai (semua)</option><option value="pending_note">Belum Nota</option><option value="needs_review">Perlu Verifikasi</option><option value="noted">Sudah Nota</option><option value="no_revenue">Tidak Beromzet</option><option value="all">Semua Status</option></select></div>
 <div class="swb-hint" style="margin-bottom:7px">${visible.length} WO sesuai filter. Nominal bersifat indikasi omzet, bukan piutang resmi. Nota manual lama tidak terdeteksi otomatis; konfirmasikan statusnya.</div>
 <div class="swb-scroll"><table class="swb-table"><thead><tr><th>WO / Tanggal WO</th><th>Customer / Pekerjaan</th><th>Sales PIC</th><th>Omzet</th><th>Status Nota</th><th>Aksi</th></tr></thead><tbody>${visible.slice(0,120).map(r=>`<tr><td><b>${esc(r.wo_number)}</b><div class="swb-muted">${esc(asDate(r.work_date))}</div><div class="swb-muted">${esc(r.so_number||'Tanpa SO')}</div></td><td>${esc(r.customer_name)}<div class="swb-muted">${esc(r.project_name)}</div></td><td>${esc(r.sales_pic||'Belum ada PIC')}</td><td>${format(r.revenue_amount)}</td><td><span class="swb-pill">${esc(labels[r.status]||r.status)}</span>${r.note_number?'<div class="swb-muted">Nota '+esc(r.note_number)+'</div>':''}${r.updated_at?'<div class="swb-muted">'+esc(r.updated_by||'')+' · '+esc(asDate(r.updated_at))+'</div>':''}</td><td><button class="swb-btn" data-edit="${esc(r.wo_id)}" ${readOnly?'disabled':''}>Tindak Lanjut</button><button class="swb-btn" data-history="${esc(r.wo_id)}">Riwayat</button></td></tr>`).join('')||'<tr><td colspan="6">Tidak ada WO yang sesuai filter.</td></tr>'}</tbody></table></div>${visible.length>120?'<div class="swb-hint">Menampilkan 120 pertama; gunakan pencarian untuk WO lainnya.</div>':''}<div id="swb-edit-host"></div>`;
 $('swb-filter').value=statusFilter;$('swb-filter').onchange=e=>{statusFilter=e.target.value;draw()};$('swb-search').oninput=e=>{search=e.target.value;const start=e.target.selectionStart;draw();$('swb-search')?.focus();$('swb-search')?.setSelectionRange(start,start)};
 host.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit));host.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>history(b.dataset.history));
 }
 function edit(id){const r=rows.find(x=>String(x.wo_id)===String(id));if(!r)return;selected=id;const box=$('swb-edit-host');box.innerHTML=`<div class="swb-edit"><div class="swb-head"><b>Tindak Lanjut ${esc(r.wo_number)} — ${esc(r.customer_name)}</b><button class="swb-btn" id="swb-close">Tutup</button></div><div class="swb-edit-grid"><div><label>Status Nota</label><select id="swb-status"><option value="needs_review">Perlu Verifikasi</option><option value="pending_note">Beromzet · Belum Nota</option><option value="noted">Nota Manual Sudah Dibuat</option><option value="no_revenue">Tidak Beromzet</option></select></div><div><label>Nilai Omzet (Rp)</label><input id="swb-amount" type="number" step="0.01" min="0" value="${Number(r.revenue_amount||0)}"></div><div><label>Tanggal Nota Manual</label><input id="swb-date" type="date" value="${esc(r.note_date||'')}"></div><div><label>Nomor Nota (opsional)</label><input id="swb-number" maxlength="120" value="${esc(r.note_number)}"></div><div style="grid-column:span 2"><label>Catatan / Alasan Tidak Beromzet</label><input id="swb-reason" maxlength="500" value="${esc(r.reason)}" placeholder="Wajib untuk Tidak Beromzet"></div></div><div class="swb-hint">Mengubah reminder tidak membuat invoice, tidak mengurangi stok, dan tidak mengubah status WO.</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><span id="swb-error" style="color:#b91c1c"></span><button id="swb-save" class="swb-btn primary">Simpan Konfirmasi</button></div></div>`;
 $('swb-status').value=r.status;$('swb-close').onclick=()=>box.replaceChildren();$('swb-save').onclick=save;box.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 async function save(){const current=rows.find(r=>r.wo_id===selected);if(!current)return;const data={status:$('swb-status').value,revenue_amount:$('swb-amount').value,note_date:$('swb-date').value||null,note_number:$('swb-number').value,reason:$('swb-reason').value};const btn=$('swb-save');btn.disabled=true;try{
  if(data.status==='noted'&&!data.note_date)throw Error('Tanggal nota manual wajib diisi');
  if(data.status==='no_revenue'&&!data.reason.trim())throw Error('Alasan tidak beromzet wajib diisi');
  await window.api('POST','/sales-wo-reminder/'+encodeURIComponent(selected),data);selected='';await load();
 }catch(e){const target=$('swb-error');if(target)target.textContent=e.message||'Gagal menyimpan';}finally{if(btn.isConnected)btn.disabled=false}}
 async function history(id){const r=rows.find(x=>x.wo_id===id);if(!r)return;const box=$('swb-edit-host');box.innerHTML='<div class="swb-edit">Memuat riwayat...</div>';try{const data=await window.api('GET','/sales-wo-reminder/'+encodeURIComponent(id)+'/history');box.innerHTML='<div class="swb-edit"><b>Riwayat '+esc(r.wo_number)+'</b><button class="swb-btn" id="swb-close">Tutup</button>'+(data.length?data.map(x=>'<p class="swb-hint">'+esc(asDateTime(x.created_at))+' · '+esc(x.actor)+' · '+esc(labels[x.status]||x.status)+' · '+format(x.revenue_amount)+' · '+esc(x.note_number||x.reason||'')+'</p>').join(''):'<p>Belum ada konfirmasi manual.</p>')+'</div>';$('swb-close').onclick=()=>box.replaceChildren();}catch(e){box.textContent='Gagal memuat riwayat: '+e.message}box.scrollIntoView({behavior:'smooth',block:'nearest'})}
 async function load(){if(loading||!root())return;loading=true; if(!$('swb-content'))init();const host=$('swb-content');if(host)host.textContent='Memuat WO selesai...';try{const data=await window.api('GET','/sales-wo-reminder');rows=Array.isArray(data.rows)?data.rows:[];readOnly=!!data.read_only;badge();draw()}catch(e){if(host)host.textContent='Gagal memuat reminder: '+e.message}finally{loading=false}}
 window.PXL_SALES_BILL_0001={load,init};
 document.addEventListener('DOMContentLoaded',init);
 setTimeout(init,0);
})();
