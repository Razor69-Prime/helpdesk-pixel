/* PXL-WH-0001 — standalone Warehouse Monitoring interface. */
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit'}).format(new Date());
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let rows=[],inventory=[],selected=null,section='materials',month=localMonth(),date=localDate(),filter='',status='';
const root=()=>document.getElementById('pxl-warehouse-mr-root');
async function req(method,path,body){
 const headers={'Content-Type':'application/json'};
 const token=typeof readAppToken==='function'?readAppToken():'';
 if(token)headers.Authorization='Bearer '+token;
 const r=await fetch('/api/warehouse/'+path,{method,headers,credentials:'same-origin',cache:'no-store',body:body===undefined?undefined:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(d.error||'HTTP '+r.status);
 return d;
}
function style(){
 if(document.getElementById('pxl-wh-0001-style'))return;
 const node=document.createElement('style');node.id='pxl-wh-0001-style';node.textContent=
 '.wh-box{padding:15px;border:1px solid var(--border,#ddd);border-radius:12px;margin:12px 0;background:var(--surface,#fff)}'+
 '.wh-tabs,.wh-tools{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.wh-btn{padding:8px 12px;border:1px solid var(--border,#ccc);border-radius:8px;cursor:pointer;background:var(--surface,#fff);color:inherit}.wh-btn.active{background:#24476b;color:white}'+
 '.wh-input{padding:8px;border:1px solid var(--border,#ccc);border-radius:8px;max-width:100%;background:var(--surface,#fff);color:inherit}.wh-scroll{max-width:100%;overflow-x:auto}.wh-table{width:100%;border-collapse:collapse;font-size:12px}.wh-table td,.wh-table th{padding:9px;text-align:left;border-bottom:1px solid var(--border,#ddd)}.wh-muted{color:var(--muted,#64748b);font-size:12px}.wh-table th{white-space:nowrap}';
 document.head.appendChild(node);
}
const table=(headers,body)=>'<div class="wh-scroll"><table class="wh-table"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
const num=v=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:3}).format(Number(v)||0);
function render(){
 style();const el=root();if(!el)return;
 el.innerHTML='<div class="wh-box"><strong>📦 Warehouse Monitoring</strong><div class="wh-muted">Monitoring independen · SO / WO semua status · tanpa mutasi stok atau perubahan Close WO</div><div class="wh-tabs">'+
 [['materials','Material per SO / WO'],['daily','Daily Stock'],['monthly','Monthly OUT'],['verify','Stock Verification']].map(v=>'<button class="wh-btn '+(section===v[0]?'active':'')+'" data-section="'+v[0]+'">'+v[1]+'</button>').join('')+'</div></div><div id="wh-content"></div>';
 el.querySelectorAll('[data-section]').forEach(btn=>btn.onclick=()=>{section=btn.dataset.section;selected=null;render();});
 if(section==='materials')renderMaterials();
 else if(section==='daily')renderDaily();
 else if(section==='monthly')renderMonthly();
 else renderVerify();
}
function renderMaterials(){
 const host=root().querySelector('#wh-content');
 host.innerHTML='<div class="wh-box"><div class="wh-tools"><input class="wh-input" id="wh-search" placeholder="Cari WH, SO, WO, customer, teknisi..." value="'+esc(filter)+'"><select class="wh-input" id="wh-status"><option value="">Semua status</option>'+[...new Set(rows.flatMap(r=>[r.status,r.so_status,r.wo_status]).filter(Boolean))].sort().map(x=>'<option '+(x===status?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select><button class="wh-btn" id="wh-reload">Refresh</button></div><div class="wh-muted" id="wh-count"></div><div id="wh-table"></div></div><div id="wh-detail"></div>';
 host.querySelector('#wh-search').oninput=e=>{filter=e.target.value;fillTable();};
 host.querySelector('#wh-status').onchange=e=>{status=e.target.value;fillTable();};
 host.querySelector('#wh-reload').onclick=refresh;
 fillTable();if(selected)detail(selected.source_key);
}
function fillTable(){
 const host=root().querySelector('#wh-content');if(!host)return;
 const matches=rows.filter(r=>(!status||[r.status,r.so_status,r.wo_status].includes(status))&&[r.wh_number,r.so_number,r.wo_number,r.customer,r.job,r.so_status,r.wo_status,r.technicians.join(' ')].join(' ').toLowerCase().includes(filter.toLowerCase()));
 host.querySelector('#wh-count').textContent=matches.length+' pekerjaan • tanpa batas status maupun periode';
 host.querySelector('#wh-table').innerHTML=table(['Nomor WH','SO','WO','MR','Teknisi','Customer / Pekerjaan','Status','Tindakan'],matches.map(r=>'<tr><td><b>'+esc(r.wh_number)+'</b></td><td>'+esc(r.so_number||'-')+'</td><td>'+esc(r.wo_number||'-')+'</td><td>'+esc(r.mr_numbers.join(', ')||'-')+'</td><td>'+esc(r.technicians.join(', ')||'-')+'</td><td>'+esc(r.customer||'-')+'<div class="wh-muted">'+esc(r.job||'')+'</div></td><td>'+esc(r.status||'-')+'</td><td><button class="wh-btn" data-key="'+esc(r.source_key)+'">Detail</button></td></tr>').join('')||'<tr><td colspan="8">Belum ada pekerjaan.</td></tr>');
 host.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>detail(b.dataset.key));
}
function detail(key){
 const r=rows.find(x=>x.source_key===key);if(!r)return;selected=r;
 const el=root().querySelector('#wh-detail');if(!el)return;
 const combined=[...(r.items||[]),...(r.manual_items||[])];
 el.innerHTML='<div class="wh-box"><div class="wh-tools"><strong>'+esc(r.wh_number)+' — '+esc(r.job||r.customer||'Pekerjaan')+'</strong><button class="wh-btn" id="wh-close">Tutup</button></div><div class="wh-muted">SO: '+esc(r.so_number||'-')+' · WO: '+esc(r.wo_number||'-')+' · Teknisi: '+esc(r.technicians.join(', ')||'-')+'</div>'+
 table(['SKU / Barang','Qty Rencana','Satuan','Sumber','Qty Used','Qty Return'],combined.map(i=>'<tr><td>'+esc(i.sku||'')+' — '+esc(i.name)+'</td><td>'+num(i.qty)+'</td><td>'+esc(i.unit)+'</td><td>'+esc(i.source)+'</td><td>'+num(i.qty_used)+'</td><td>'+num(i.qty_returned)+'</td></tr>').join('')||'<tr><td colspan="6">Belum ada item. Tambahkan dari master Inventory.</td></tr>')+
 '<h4>Tambah Material Manual</h4><div class="wh-muted">Hanya menyimpan tambahan daftar monitoring, tidak mengubah SO, WO, MR maupun stok.</div><div class="wh-tools"><input class="wh-input" list="wh-items" id="wh-item" placeholder="Cari nama / SKU"><datalist id="wh-items">'+inventory.map(i=>'<option value="'+esc(i.sku||i.name)+'">'+esc(i.name)+'</option>').join('')+'</datalist><input class="wh-input" type="number" min=".001" step=".001" id="wh-qty" value="1" style="width:110px"><button class="wh-btn" id="wh-add">+ Tambah Item</button></div><div class="wh-tools"><button class="wh-btn" id="wh-save">Simpan Material Manual</button></div><p id="wh-msg" class="wh-muted"></p></div>';
 el.querySelector('#wh-close').onclick=()=>{selected=null;el.innerHTML='';};
 el.querySelector('#wh-add').onclick=()=>{
  const v=el.querySelector('#wh-item').value.trim().toLowerCase(),master=inventory.find(i=>String(i.sku||'').toLowerCase()===v||String(i.name||'').toLowerCase()===v),qty=Number(el.querySelector('#wh-qty').value);
  if(!master||!Number.isFinite(qty)||qty<=0){el.querySelector('#wh-msg').textContent='Pilih SKU dari master Inventory dan masukkan Qty valid.';return;}
  r.manual_items.push({inventory_item_id:master.id,name:master.name,sku:master.sku,unit:master.unit,qty,source:'MANUAL'});detail(key);
 };
 el.querySelector('#wh-save').onclick=async()=>{
  const msg=el.querySelector('#wh-msg');msg.textContent='Menyimpan...';
  try{await req('PATCH','monitor/'+r.wh_id,{manual_items:r.manual_items,note:r.note});msg.textContent='Tersimpan tanpa mutasi stok.';}
  catch(e){msg.textContent=e.message;}
 };
}
async function renderDaily(){
 const host=root().querySelector('#wh-content');
 host.innerHTML='<div class="wh-box"><strong>Daily Stock IN / OUT</strong><div class="wh-tools"><input type="date" class="wh-input" id="wh-date" value="'+esc(date)+'"><button class="wh-btn" id="wh-load">Tampilkan</button></div><div id="wh-result"></div></div>';
 host.querySelector('#wh-load').onclick=async()=>{date=host.querySelector('#wh-date').value;const dest=host.querySelector('#wh-result');dest.textContent='Memuat...';try{const d=await req('GET','stock-ledger?date='+encodeURIComponent(date));dest.innerHTML=(d.quality_warning?'<p class="wh-muted">Perhatian: sebagian saldo memerlukan rekonsiliasi.</p>':'')+table(['SKU / Barang','Beginning','IN','OUT','Ending','Status'],d.items.map(i=>'<tr><td>'+esc(i.sku)+' — '+esc(i.name)+'</td><td>'+num(i.opening)+'</td><td>'+num(i.incoming)+'</td><td>'+num(i.outgoing)+'</td><td>'+num(i.closing)+'</td><td>'+esc(i.quality)+'</td></tr>').join(''));}catch(e){dest.textContent=e.message;}};
}
async function renderMonthly(){
 const host=root().querySelector('#wh-content');
 host.innerHTML='<div class="wh-box"><strong>Rekap Mutasi Inventory Bulanan</strong><div class="wh-muted">OUT bukan otomatis penggunaan aktual teknisi.</div><div class="wh-tools"><input type="month" class="wh-input" id="wh-month" value="'+esc(month)+'"><button class="wh-btn" id="wh-load">Tampilkan</button></div><div id="wh-result"></div></div>';
 host.querySelector('#wh-load').onclick=async()=>{month=host.querySelector('#wh-month').value;const dest=host.querySelector('#wh-result');dest.textContent='Memuat...';try{const d=await req('GET','monthly-out?month='+encodeURIComponent(month));dest.innerHTML=table(['SKU / Material','Satuan','IN','OUT'],d.items.map(i=>'<tr><td>'+esc(i.sku||'')+' — '+esc(i.name)+'</td><td>'+esc(i.unit)+'</td><td>'+num(i.incoming)+'</td><td>'+num(i.outgoing)+'</td></tr>').join(''));}catch(e){dest.textContent=e.message;}};
}
function renderVerify(){
 const host=root().querySelector('#wh-content');
 host.innerHTML='<div class="wh-box"><strong>Stock Verification — Pemeriksaan Fisik</strong><p class="wh-muted">Snapshot saldo Inventory pada saat pemeriksaan. Selisih tidak otomatis melakukan adjustment.</p><div class="wh-tools"><input class="wh-input" id="wh-physical-sku" list="wh-physical-items" placeholder="Cari SKU / barang"><datalist id="wh-physical-items">'+inventory.map(i=>'<option value="'+esc(i.sku||i.name)+'">'+esc(i.name)+'</option>').join('')+'</datalist><input class="wh-input" type="number" min="0" step=".001" id="wh-physical-qty" placeholder="Jumlah fisik"><input class="wh-input" id="wh-physical-note" placeholder="Catatan opsional"><button class="wh-btn" id="wh-physical-save">Simpan Audit</button><button class="wh-btn" id="wh-physical-reload">Muat Riwayat</button></div><p class="wh-muted" id="wh-physical-msg"></p><div id="wh-physical-history"></div></div>';
 const msg=host.querySelector('#wh-physical-msg');
 const load=async()=>{try{const data=await req('GET','stock-checks');host.querySelector('#wh-physical-history').innerHTML=table(['Tanggal','SKU / Item','Saldo Sistem','Hitung Fisik','Selisih','Petugas','Catatan'],(data.rows||[]).map(i=>'<tr><td>'+esc(i.created_at)+'</td><td>'+esc(i.sku)+' — '+esc(i.item_name)+'</td><td>'+num(i.system_qty)+'</td><td>'+num(i.physical_qty)+'</td><td>'+num(Number(i.physical_qty)-Number(i.system_qty))+'</td><td>'+esc(i.actor_name)+'</td><td>'+esc(i.note)+'</td></tr>').join('')||'<tr><td colspan="7">Belum ada pemeriksaan.</td></tr>');}catch(e){msg.textContent=e.message;}};
 host.querySelector('#wh-physical-reload').onclick=load;
 host.querySelector('#wh-physical-save').onclick=async()=>{
  const v=host.querySelector('#wh-physical-sku').value.toLowerCase().trim(),master=inventory.find(i=>String(i.sku||'').toLowerCase()===v||String(i.name||'').toLowerCase()===v),qty=Number(host.querySelector('#wh-physical-qty').value),raw=host.querySelector('#wh-physical-qty').value;
  if(!master||!raw||!Number.isFinite(qty)||qty<0){msg.textContent='Pilih SKU aktif dan isi hasil hitung fisik valid.';return;}
  try{await req('POST','stock-checks',{inventory_item_id:master.id,physical_qty:qty,note:host.querySelector('#wh-physical-note').value});msg.textContent='Audit fisik tersimpan, saldo Inventory tetap.';await load();}catch(e){msg.textContent=e.message;}
 };
 load();
}

async function refresh(){
 const el=root();if(!el)return;el.textContent='Memuat Warehouse Monitoring...';
 try{const [data,options]=await Promise.all([req('GET','monitor'),req('GET','inventory-options')]);rows=data.rows||[];inventory=options.items||[];if(selected)selected=rows.find(r=>r.source_key===selected.source_key)||null;render();}
 catch(e){el.innerHTML='<div class="wh-box">Warehouse belum siap: '+esc(e.message)+' <button class="wh-btn" id="wh-try">Coba lagi</button></div>';el.querySelector('#wh-try').onclick=refresh;}
}
window.pxlWarehouseMr={refresh};
})();
