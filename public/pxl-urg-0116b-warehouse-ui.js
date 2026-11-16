/* PXL-URG-0116B — internal warehouse inspection; never modifies stock or WO status. */
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roles=new Set(['superadmin','admin','manager','warehouseadmin']);
const allowed=()=>{
 const user=typeof currentUser!=='undefined'?currentUser:window.currentUser;
 const role=String(user?.role||'').toLowerCase().replace(/[\s_-]/g,'');
 if(['technician','technisi'].includes(role))return false;
 return roles.has(role)||(Array.isArray(user?.custom_menus)&&user.custom_menus.includes('material_return_verify'));
};
const root=()=>document.getElementById('pxl-warehouse-mr-root');
let rows=[],audit=[],selected=null,filter='pending',ledgerDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function style(){if(document.getElementById('pxl-warehouse-mr-css'))return;
 const el=document.createElement('style');el.id='pxl-warehouse-mr-css';el.textContent=`
 #pxl-warehouse-mr-root{font-size:13px;color:var(--text,#26313d)}
 .wmr-panel{background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:12px;padding:15px;margin-bottom:12px}
 .wmr-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.wmr-title{font-weight:750;font-size:17px}
 .wmr-sub{font-size:12px;color:var(--muted,#64748b);margin-top:5px}
 .wmr-table{width:100%;border-collapse:collapse;font-size:12px}.wmr-table th,.wmr-table td{text-align:left;border-bottom:1px solid var(--border,#eee);padding:10px 8px;vertical-align:top}
 .wmr-scroll{overflow-x:auto}.wmr-pill{display:inline-block;border-radius:20px;padding:3px 8px;font-size:11px;background:#fff1cb;color:#7c5100}
 .wmr-detail{display:grid;grid-template-columns:1fr 1fr;gap:12px}.wmr-detail label{font-size:12px;display:block;margin:8px 0 3px}.wmr-detail input,.wmr-detail select,.wmr-detail textarea{width:100%;padding:9px;border:1px solid var(--border,#ccc);border-radius:8px;box-sizing:border-box}
 .wmr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.wmr-btn{padding:8px 11px;border-radius:8px;border:1px solid var(--border,#ccc);background:#fff;color:#222;cursor:pointer}.wmr-btn.primary{background:#243c57;color:#fff}.wmr-btn:disabled{opacity:.5;cursor:not-allowed}
 @media(max-width:650px){.wmr-detail{grid-template-columns:1fr}.wmr-table{min-width:620px}}
 `;document.head.appendChild(el);
}
function itemsHtml(items){if(!items.length)return '<div class="wmr-sub">Detail item belum tersedia pada MR ini.</div>';
 return '<div class="wmr-scroll"><table class="wmr-table"><thead><tr><th>Material</th><th>Quantity Request</th><th>Used</th><th>Return</th></tr></thead><tbody>'+items.map(x=>'<tr><td>'+esc(x.name||x.item_name||x.material_name||x.description||x.product_name||'-')+'</td><td>'+esc(x.qty_out??x.qty??x.quantity??'-')+'</td><td>'+esc(x.qty_use??x.qty_used??'-')+'</td><td>'+esc(x.qty_return??x.qty_returned??'-')+'</td></tr>').join('')+'</tbody></table></div>';
}
function historyHtml(source,id){const list=audit.filter(a=>a.source===source&&String(a.mr_id)===String(id));if(!list.length)return '<p class="wmr-sub">Belum ada catatan pemeriksaan.</p>';
 return '<div class="wmr-scroll"><table class="wmr-table"><thead><tr><th>Waktu</th><th>Petugas</th><th>Hasil</th><th>Qty</th><th>Catatan</th></tr></thead><tbody>'+list.map(a=>'<tr><td>'+esc(a.created_at?new Date(a.created_at).toLocaleString('id-ID'):'-')+'</td><td>'+esc(a.actor_name)+'</td><td>'+esc(a.outcome==='checked'?'Sudah diperiksa':'Ada selisih')+'</td><td>'+esc(a.quantity_checked)+'</td><td>'+esc(a.note)+'</td></tr>').join('')+'</tbody></table></div>';
}
function render(){const el=root();if(!el||!allowed())return;style();const shown=filter==='all'?rows:rows.filter(r=>r.wo_status==='done'||['completed','closed','selesai','finished'].includes(String(r.wo_status||'').toLowerCase()));
 el.innerHTML='<div class="wmr-panel"><div class="wmr-head"><div><div class="wmr-title">📋 Verifikasi MR Gudang</div><div class="wmr-sub">Monitoring internal · MR tidak menghalangi closing WO · pemeriksaan belum mengubah stok.</div></div><div class="wmr-actions"><button class="wmr-btn" id="wmr-filter">'+(filter==='pending'?'Lihat Semua WO':'WO Selesai Saja')+'</button><button class="wmr-btn" id="wmr-refresh">Refresh</button></div></div><div class="wmr-sub">'+shown.length+' MR belum selesai · '+audit.length+' catatan pemeriksaan terakhir</div></div>'+
 '<div class="wmr-panel wmr-scroll"><table class="wmr-table"><thead><tr><th>Work Order</th><th>MR</th><th>Status MR</th><th>Status Gudang</th><th>Tindakan</th></tr></thead><tbody>'+(shown.map((r,i)=>'<tr><td>'+esc(r.wo_number||r.ticket_id)+'<div class="wmr-sub">'+esc(r.wo_status||'-')+'</div></td><td>'+esc(r.source.toUpperCase())+' / '+esc(r.mr_id)+'</td><td>'+esc(r.status)+'</td><td><span class="wmr-pill">'+esc(r.warehouse_status)+'</span></td><td><button class="wmr-btn" data-wmr-row="'+i+'">Detail</button></td></tr>').join('')||'<tr><td colspan="5">Tidak ada MR pending untuk filter ini.</td></tr>')+'</tbody></table></div>'+
 '<div id="wmr-detail-host"></div><div class="wmr-panel" id="wmr-ledger-host"><b>Stock IN / OUT Harian</b><div class="wmr-sub">Pilih tanggal untuk melihat transaksi dari Inventory existing.</div></div>';
 renderLedgerControls();
 el.querySelector('#wmr-refresh').onclick=refresh;el.querySelector('#wmr-filter').onclick=()=>{filter=filter==='pending'?'all':'pending';selected=null;render();};
 el.querySelectorAll('[data-wmr-row]').forEach(btn=>btn.onclick=()=>detail(shown[Number(btn.dataset.wmrRow)]));if(selected){const latest=rows.find(r=>r.source===selected.source&&String(r.mr_id)===String(selected.mr_id));if(latest)detail(latest);}
}
function detail(r){selected=r;const el=root()?.querySelector('#wmr-detail-host');if(!el)return;
 el.innerHTML='<div class="wmr-panel"><div class="wmr-head"><div><b>Detail MR '+esc(r.mr_id)+'</b><div class="wmr-sub">WO: '+esc(r.wo_number||r.ticket_id)+' · '+esc(r.status)+'</div></div><button class="wmr-btn" id="wmr-close">Tutup Detail</button></div>'+itemsHtml(r.items||[])+
 '<div class="wmr-detail"><div><label>Hasil Pemeriksaan</label><select id="wmr-outcome"><option value="checked">Pemeriksaan Fisik Dicatat</option><option value="discrepancy">Ada Selisih / Kendala</option></select><label>Jumlah yang diperiksa</label><input id="wmr-qty" type="number" min="0" max="1000000" step="0.001" value="0"></div><div><label>Catatan (wajib)</label><textarea id="wmr-note" rows="4" maxlength="1000" placeholder="Kondisi fisik, selisih, dan tindak lanjut..."></textarea></div></div><p class="wmr-sub">Tombol ini hanya menyimpan audit pemeriksaan. Stok dan status MR tidak diubah.</p><div class="wmr-actions"><button class="wmr-btn primary" id="wmr-submit">Simpan Catatan Pemeriksaan</button></div><p id="wmr-msg" class="wmr-sub" role="status"></p><h4>Riwayat Pemeriksaan</h4>'+historyHtml(r.source,r.mr_id)+'</div>';
 el.querySelector('#wmr-close').onclick=()=>{selected=null;el.innerHTML='';};el.querySelector('#wmr-submit').onclick=submit;
}
async function request(method,path,body){const headers={'Content-Type':'application/json'};const token=typeof readAppToken==='function'?readAppToken():'';if(token)headers.Authorization='Bearer '+token;
 const resp=await fetch('/api'+path,{method,credentials:'same-origin',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await resp.json().catch(()=>({}));if(!resp.ok)throw Error(data.error||'HTTP '+resp.status);return data;
}
async function submit(){if(!selected||!allowed())return;const el=root(),btn=el.querySelector('#wmr-submit'),msg=el.querySelector('#wmr-msg');const note=el.querySelector('#wmr-note').value.trim();const qty=Number(el.querySelector('#wmr-qty').value);
 if(!note){msg.textContent='Catatan wajib diisi.';return;}if(!Number.isFinite(qty)||qty<0||qty>1000000){msg.textContent='Quantity tidak valid.';return;}
 btn.disabled=true;msg.textContent='Menyimpan pemeriksaan...';try{await request('POST','/warehouse/mr-review/'+encodeURIComponent(selected.source)+'/'+encodeURIComponent(selected.mr_id)+'/inspection',{outcome:el.querySelector('#wmr-outcome').value,quantity_checked:qty,note});await refresh();const status=root()?.querySelector('#wmr-detail-host #wmr-msg');if(status)status.textContent='Pemeriksaan berhasil dicatat. Tidak ada mutasi stok.';}catch(e){msg.textContent=e.message;btn.disabled=false;}
}
function renderLedgerControls(){
 const el=root()?.querySelector('#wmr-ledger-host');if(!el)return;
 el.innerHTML='<div class="wmr-head"><div><b>📦 Stock IN / OUT Harian</b><div class="wmr-sub">Saldo berdasarkan transaksi Inventory · WITA · hanya baca</div></div><div class="wmr-actions"><input aria-label="Tanggal stok" id="wmr-stock-date" type="date" value="'+esc(ledgerDate)+'"><button class="wmr-btn primary" id="wmr-stock-load">Tampilkan</button></div></div><div id="wmr-stock-result" class="wmr-sub">Klik Tampilkan untuk memuat laporan.</div>';
 el.querySelector('#wmr-stock-load').onclick=()=>{ledgerDate=el.querySelector('#wmr-stock-date').value;loadStockLedger();};
}
async function loadStockLedger(){
 const el=root()?.querySelector('#wmr-stock-result');if(!el||!allowed())return;
 el.textContent='Memuat riwayat stok '+ledgerDate+'...';
 try{
  const data=await request('GET','/warehouse/stock-ledger?date='+encodeURIComponent(ledgerDate));
  const format=n=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:3}).format(Number(n)||0);
  const items=data.items||[],rows=data.transactions||[];
  el.innerHTML='<p><b>'+esc(data.date)+'</b> · '+rows.length+' transaksi · '+items.length+' item</p>'+
  (data.quality_warning?'<p class="wmr-pill">Perhatian: sebagian stok tidak mempunyai riwayat lengkap atau terdapat ketidaksesuaian saldo. Periksa kolom Status.</p>':'')+
  '<div class="wmr-scroll"><table class="wmr-table"><thead><tr><th>Item</th><th>Stok Awal</th><th>IN</th><th>OUT</th><th>Stok Akhir</th><th>Status</th></tr></thead><tbody>'+
  (items.map(i=>'<tr><td>'+esc(i.name)+'<div class="wmr-sub">'+esc(i.sku)+' · '+esc(i.unit)+'</div></td><td>'+format(i.opening)+'</td><td>'+format(i.incoming)+'</td><td>'+format(i.outgoing)+'</td><td><b>'+format(i.closing)+'</b></td><td>'+esc(i.quality==='verified'?'Sesuai':i.quality==='no_transaction_history'?'Tanpa riwayat':'Perlu rekonsiliasi')+'</td></tr>').join('')||'<tr><td colspan="6">Tidak ada item aktif.</td></tr>')+'</tbody></table></div>'+
  '<h4>Riwayat Transaksi '+esc(data.date)+'</h4><div class="wmr-scroll"><table class="wmr-table"><thead><tr><th>Jam (WITA)</th><th>Material</th><th>Jenis</th><th>IN</th><th>OUT</th><th>Saldo</th><th>Referensi / Petugas</th></tr></thead><tbody>'+
  (rows.map(t=>'<tr><td>'+esc(new Date(t.created_at).toLocaleTimeString('id-ID',{timeZone:'Asia/Makassar',hour:'2-digit',minute:'2-digit'}))+'</td><td>'+esc(t.item_name)+'</td><td>'+esc(t.transaction_type)+'</td><td>'+format(Math.max(0,t.qty))+'</td><td>'+format(Math.max(0,-t.qty))+'</td><td>'+format(t.balance_after)+'</td><td>'+esc(t.reference)+'<div class="wmr-sub">'+esc(t.created_by)+'</div></td></tr>').join('')||'<tr><td colspan="7">Tidak ada transaksi pada tanggal ini.</td></tr>')+'</tbody></table></div>';
 }catch(e){el.textContent='Gagal memuat ledger: '+e.message;}
}
async function refresh(){const el=root();if(!el||!allowed())return;el.textContent='Memuat daftar MR gudang...';try{const result=await request('GET','/warehouse/mr-review');rows=result.rows||[];audit=result.audit||[];render();}catch(e){el.textContent='Gagal memuat verifikasi MR: '+e.message;}}
window.pxlWarehouseMr={refresh};
})();
