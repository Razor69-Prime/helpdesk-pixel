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
 '.wh-input{padding:8px;border:1px solid var(--border,#ccc);border-radius:8px;max-width:100%;background:var(--surface,#fff);color:inherit}.wh-catalog{position:relative;min-width:min(100%,350px);flex:1}.wh-catalog-input{width:100%;box-sizing:border-box}.wh-catalog-results{position:absolute;top:100%;left:0;right:0;max-height:300px;overflow-y:auto;z-index:100;background:var(--surface,#fff);border:1px solid var(--border,#ccc);border-radius:8px;box-shadow:0 10px 28px #0002}.wh-catalog-option{display:block;width:100%;padding:10px 12px;text-align:left;border:0;border-bottom:1px solid var(--border,#eee);background:transparent;color:inherit;cursor:pointer}.wh-catalog-option:hover,.wh-catalog-option:focus{background:var(--surface-hover,#edf2f7)}.wh-catalog-name{display:block;font-weight:650}.wh-catalog-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--muted,#64748b);margin-top:3px}.wh-probus{display:inline-block;border-radius:99px;padding:2px 7px;background:#e8f5e9;color:#2e7d32;font-size:10px;font-weight:800}.wh-autofill-line{padding:9px 0;border-bottom:1px solid var(--border,#ddd)}.wh-scroll{max-width:100%;overflow-x:auto}.wh-table{width:100%;border-collapse:collapse;font-size:12px}.wh-table td,.wh-table th{padding:9px;text-align:left;border-bottom:1px solid var(--border,#ddd)}.wh-muted{color:var(--muted,#64748b);font-size:12px}.wh-table th{white-space:nowrap}';
 document.head.appendChild(node);
}
const table=(headers,body)=>'<div class="wh-scroll"><table class="wh-table"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
const num=v=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:3}).format(Number(v)||0);
const badge=()=>'<span class="wh-probus">PROBUS</span>';
const materialLabel=item=>'<span class="wh-catalog-name">'+esc(item.name||'-')+'</span><span class="wh-catalog-meta">'+esc(item.sku||'SKU belum dipetakan')+' '+(String(item.sku||'').startsWith('PX-')?badge():'')+'</span>';
// Custom results instead of native datalist: display material name ABOVE the PX SKU + badge.
function initCatalogPicker(host,inputId,resultId,onSelect){
 const input=host.querySelector('#'+inputId),result=host.querySelector('#'+resultId);
 let chosen=null;
 const search=()=>{
  const q=input.value.trim().toLocaleLowerCase('id-ID');
  chosen=null;
  if(!q){result.hidden=true;result.innerHTML='';return;}
  const matches=inventory.filter(item=>(item.name+' '+item.sku).toLocaleLowerCase('id-ID').includes(q)).slice(0,35);
  result.hidden=false;
  result.innerHTML=matches.map(item=>'<button type="button" class="wh-catalog-option" data-wh-sku="'+esc(item.sku)+'">'+materialLabel(item)+'</button>').join('')||'<div class="wh-muted" style="padding:10px">Tidak ditemukan di katalog PROBUS.</div>';
  result.querySelectorAll('[data-wh-sku]').forEach(button=>button.onclick=()=>{
   const item=inventory.find(i=>i.sku===button.dataset.whSku);
   if(!item)return;
   chosen=item;
   input.value=item.name;
   result.hidden=true;result.innerHTML='';
   onSelect?.(item);
  });
 };
 input.addEventListener('input',search);
 input.addEventListener('focus',()=>{if(!chosen&&input.value.trim())search();});
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape'){result.hidden=true;return;}
  if(event.key==='Enter'&&!result.hidden){
   const first=result.querySelector('[data-wh-sku]');
   if(first){event.preventDefault();first.click();}
  }
 });
 const hideOnOutsideClick=event=>{
  if(!input.isConnected){document.removeEventListener('pointerdown',hideOnOutsideClick);return;}
  if(event.target!==input&&!result.contains(event.target))result.hidden=true;
 };
 document.addEventListener('pointerdown',hideOnOutsideClick);
 return {getSelected:()=>chosen,select:item=>{chosen=item||null;input.value=item?.name||'';result.hidden=true;result.innerHTML='';onSelect?.(item||null);},clear:()=>{chosen=null;input.value='';result.hidden=true;result.innerHTML='';onSelect?.(null);}};
}

function render(){
 style();const el=root();if(!el)return;
 el.innerHTML='<div class="wh-box"><strong>📦 Warehouse Monitoring</strong><div class="wh-muted">Monitoring independen · SO / WO semua status · tanpa mutasi stok atau perubahan Close WO</div><div class="wh-tabs">'+
 [['materials','Material per SO / WO'],['usage','Daily Material Usage'],['daily','Daily Stock'],['monthly','Monthly OUT'],['verify','Stock Verification']].map(v=>'<button class="wh-btn '+(section===v[0]?'active':'')+'" data-section="'+v[0]+'">'+v[1]+'</button>').join('')+'</div></div><div id="wh-content"></div>';
 el.querySelectorAll('[data-section]').forEach(btn=>btn.onclick=()=>{section=btn.dataset.section;selected=null;render();});
 if(section==='materials')renderMaterials();
 else if(section==='usage')renderUsage();
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
 table(['SKU / Barang','Qty Rencana','Satuan','Sumber','Qty Used','Qty Return'],combined.map(i=>'<tr><td>'+esc(i.sku||'')+' — '+esc(i.name)+'</td><td>'+num(i.qty)+'</td><td>'+esc(i.unit)+'</td><td>'+esc(i.source)+'</td><td>'+num(i.qty_used)+'</td><td>'+num(i.qty_returned)+'</td></tr>').join('')||'<tr><td colspan="6">Belum ada item. Tambahkan dari katalog PROBUS PX.</td></tr>')+
 '<h4>Tambah Material Manual</h4><div class="wh-muted">Hanya menyimpan tambahan daftar monitoring, tidak mengubah SO, WO, MR maupun stok.</div><div class="wh-tools"><input class="wh-input" list="wh-items" id="wh-item" placeholder="Cari SKU PX / nama material"><datalist id="wh-items">'+inventory.map(i=>'<option value="'+esc(i.sku||i.name)+'">'+esc(i.name)+'</option>').join('')+'</datalist><input class="wh-input" type="number" min=".001" step=".001" id="wh-qty" value="1" style="width:110px"><button class="wh-btn" id="wh-add">+ Tambah Item</button></div><div class="wh-tools"><button class="wh-btn" id="wh-save">Simpan Material Manual</button></div><p id="wh-msg" class="wh-muted"></p></div>';
 el.querySelector('#wh-close').onclick=()=>{selected=null;el.innerHTML='';};
 el.querySelector('#wh-add').onclick=()=>{
  const v=el.querySelector('#wh-item').value.trim().toLowerCase(),master=inventory.find(i=>String(i.sku||'').toLowerCase()===v||String(i.name||'').toLowerCase()===v),qty=Number(el.querySelector('#wh-qty').value);
  if(!master||!Number.isFinite(qty)||qty<=0){el.querySelector('#wh-msg').textContent='Pilih SKU PX resmi dan masukkan Qty valid.';return;}
  r.manual_items.push({inventory_item_id:master.id,name:master.name,sku:master.sku,unit:master.unit,qty,source:'MANUAL'});detail(key);
 };
 el.querySelector('#wh-save').onclick=async()=>{
  const msg=el.querySelector('#wh-msg');msg.textContent='Menyimpan...';
  try{await req('PATCH','monitor/'+r.wh_id,{manual_items:r.manual_items,note:r.note});msg.textContent='Tersimpan tanpa mutasi stok.';}
  catch(e){msg.textContent=e.message;}
 };
}
async function renderUsage(){
 const host=root().querySelector('#wh-content');
 const work=rows.filter(r=>(r.wo_number||r.so_number)&&r.wh_id);
 host.innerHTML='<div class="wh-box"><strong>Input Pemakaian Material Harian (USED)</strong><p class="wh-muted">Pilih SO / WO dan material PROBUS. Item pekerjaan ditawarkan otomatis, tetapi USED baru tersimpan setelah Anda mengisi Qty dan mengklik Simpan.</p>'+
 '<div class="wh-tools"><input class="wh-input" type="date" id="wh-used-date" value="'+esc(date)+'" aria-label="Tanggal pemakaian">'+
 '<div class="wh-catalog wh-job-search"><input id="wh-used-wo" type="search" class="wh-input wh-catalog-input" autocomplete="off" placeholder="Cari nomor SO / WO, customer atau nama pekerjaan..." aria-label="Fast searching SO atau WO" aria-autocomplete="list" aria-expanded="false" aria-controls="wh-used-wo-results"><div id="wh-used-wo-results" class="wh-catalog-results" role="listbox" hidden></div></div></div>'+
 '<div id="wh-used-autofill" class="wh-muted" aria-live="polite">Pilih SO atau WO untuk melihat material terkait.</div>'+
 '<div class="wh-tools"><div class="wh-catalog"><input id="wh-used-item" class="wh-input wh-catalog-input" autocomplete="off" placeholder="Cari nama material atau SKU PX" aria-label="Pilih material PROBUS" aria-controls="wh-used-results"><div id="wh-used-results" class="wh-catalog-results" hidden></div></div>'+
 '<input id="wh-used-qty" class="wh-input" type="number" min=".001" step=".001" placeholder="Qty USED" style="width:130px">'+
 '<input id="wh-used-note" class="wh-input" placeholder="Keterangan opsional" maxlength="1000">'+
 '<button class="wh-btn" id="wh-used-save">Simpan Pemakaian</button></div><p class="wh-muted" id="wh-used-selected" aria-live="polite"></p><p class="wh-muted" id="wh-used-msg" role="status"></p>'+
 '<div class="wh-tools"><button class="wh-btn" id="wh-used-refresh">Lihat Pemakaian Harian</button></div><div id="wh-used-history"></div></div>';
 const msg=host.querySelector('#wh-used-msg');
 const selectedInfo=host.querySelector('#wh-used-selected');
 const picker=initCatalogPicker(host,'wh-used-item','wh-used-results',item=>{selectedInfo.innerHTML=item?'Dipilih: '+materialLabel(item):'';});
 const auto=host.querySelector('#wh-used-autofill');
 const sourcePicker=host.querySelector('#wh-used-wo');
 const jobResults=host.querySelector('#wh-used-wo-results');
 let selectedJob=null,activeOption=0;
 const jobLabel=r=>[r.so_number,r.wo_number].filter(Boolean).join(' / ')||r.wh_number;
 const jobSearchText=r=>[r.so_number,r.wo_number,r.wh_number,r.customer,r.job,r.status,r.so_status,r.wo_status].join(' ').toLocaleLowerCase('id-ID');
 const closeJobResults=()=>{jobResults.hidden=true;sourcePicker.setAttribute('aria-expanded','false');};
 const selectJob=r=>{
  selectedJob=r;
  sourcePicker.value=jobLabel(r)+' · '+(r.customer||r.job||'');
  closeJobResults();
  onJobSelected();
 };
 const showJobs=()=>{
  const search=sourcePicker.value.trim().toLocaleLowerCase('id-ID');
  const ranked=work.filter(r=>!search||jobSearchText(r).includes(search))
   .sort((a,b)=>{
    const ac=[a.so_number,a.wo_number,a.wh_number].some(v=>String(v||'').toLocaleLowerCase('id-ID').startsWith(search));
    const bc=[b.so_number,b.wo_number,b.wh_number].some(v=>String(v||'').toLocaleLowerCase('id-ID').startsWith(search));
    return Number(bc)-Number(ac);
   }).slice(0,35);
  activeOption=0;
  jobResults.innerHTML=ranked.map((r,i)=>'<button type="button" role="option" class="wh-catalog-option'+(i===activeOption?' wh-job-active':'')+'" data-wh-job-index="'+i+'" aria-selected="'+(i===activeOption)+'"><span class="wh-catalog-name">'+esc(jobLabel(r))+'</span><span class="wh-catalog-meta">'+esc(r.customer||r.job||'-')+' · '+esc(r.wh_number)+' · '+esc(r.status||'-')+'</span></button>').join('')||'<div class="wh-muted" style="padding:12px">SO / WO tidak ditemukan.</div>';
  jobResults.hidden=false;
  sourcePicker.setAttribute('aria-expanded','true');
  const options=[...jobResults.querySelectorAll('[data-wh-job-index]')];
  const choose=i=>{const selected=ranked[i];if(selected)selectJob(selected);};
  options.forEach((button,i)=>button.onclick=()=>choose(i));
  sourcePicker.onkeydown=event=>{
   if(event.key==='Escape'){closeJobResults();return;}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();
    if(!options.length)return;
    activeOption=(activeOption+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options.forEach((opt,i)=>{opt.classList.toggle('wh-job-active',i===activeOption);opt.setAttribute('aria-selected',String(i===activeOption));});
    options[activeOption].scrollIntoView({block:'nearest'});
   }
   if(event.key==='Enter'&&options.length){event.preventDefault();choose(activeOption);}
  };
 };
 sourcePicker.oninput=()=>{selectedJob=null;auto.textContent='Pilih pekerjaan dari hasil pencarian untuk autofill material.';picker.clear();msg.textContent='';showJobs();};
 sourcePicker.onfocus=showJobs;
 const hideJobOutside=event=>{
  if(!sourcePicker.isConnected){document.removeEventListener('pointerdown',hideJobOutside);return;}
  if(event.target!==sourcePicker&&!jobResults.contains(event.target))closeJobResults();
 };
 document.addEventListener('pointerdown',hideJobOutside);
 const onJobSelected=()=>{
  const record=selectedJob;
  picker.clear();msg.textContent='';
  if(!record){auto.textContent='Pilih SO atau WO untuk melihat material terkait.';return;}
  const matcher=window.PXL_WH_MATERIAL_MATCH;
  if(!matcher||typeof matcher.proposals!=='function'){
   auto.innerHTML='<p role="alert">Pencocokan material belum termuat. Muat ulang halaman untuk mengaktifkan autofill; material SO/WO tidak hilang.</p>';
   return;
  }
  const proposals=matcher.proposals(record,inventory);
  if(!proposals.length){auto.innerHTML='<p>Belum ada material pada SO/WO tersebut. Gunakan pencarian katalog PROBUS untuk input manual.</p>';return;}
  auto.innerHTML='<p><b>Material otomatis dari SO / WO / MR</b> — klik Gunakan untuk memilih SKU. Qty rencana bukan otomatis Qty USED.</p>'+
  proposals.map((p,i)=>'<div class="wh-autofill-line">'+
   (p.catalog_item?materialLabel(p.catalog_item):'<strong>'+esc(p.name||'Material historis')+'</strong><span class="wh-catalog-meta">Belum terpetakan ke SKU PROBUS · pilih SKU secara manual</span>')+
   '<span class="wh-muted">Rencana: '+num(p.planned_qty)+' '+esc(p.unit)+' · '+esc(p.source)+'</span> '+
   (p.catalog_item?'<button type="button" class="wh-btn" data-wh-proposal="'+i+'">Gunakan</button>':'')+'</div>').join('');
  auto.querySelectorAll('[data-wh-proposal]').forEach(button=>button.onclick=()=>{
   const p=proposals[Number(button.dataset.whProposal)];
   if(!p?.catalog_item)return;
   picker.select(p.catalog_item);
   host.querySelector('#wh-used-qty').focus();
  });
  const matched=proposals.filter(p=>p.catalog_item);
  if(proposals.length===1&&matched.length===1)picker.select(matched[0].catalog_item);
 };
 const load=async()=>{
  const dest=host.querySelector('#wh-used-history');dest.textContent='Memuat pemakaian...';
  try{const d=await req('GET','daily-usage?date='+encodeURIComponent(host.querySelector('#wh-used-date').value));
   dest.innerHTML=table(['Tanggal','No. WH','Material / SKU PX','USED','Satuan','Petugas','Keterangan'],(d.rows||[]).map(i=>'<tr><td>'+esc(i.usage_date)+'</td><td>'+esc((rows.find(r=>String(r.wh_id)===String(i.warehouse_id))||{}).wh_number||i.warehouse_id)+'</td><td>'+materialLabel(i)+'</td><td>'+num(i.qty_used)+'</td><td>'+esc(i.unit)+'</td><td>'+esc(i.actor_name)+'</td><td>'+esc(i.note)+'</td></tr>').join('')||'<tr><td colspan="7">Belum ada pemakaian pada tanggal ini.</td></tr>');}
  catch(e){dest.textContent=e.message;}
 };
 host.querySelector('#wh-used-refresh').onclick=load;
 host.querySelector('#wh-used-save').onclick=async()=>{
  const rec=selectedJob,key=rec?.source_key;
  const item=picker.getSelected(),raw=host.querySelector('#wh-used-qty').value,qty=Number(raw),usage_date=host.querySelector('#wh-used-date').value;
  if(!rec||!item||!raw||!Number.isFinite(qty)||qty<=0){msg.textContent='Pilih SO/WO dari hasil fast searching, pilih material PROBUS, lalu isi Qty USED.';return;}
  const btn=host.querySelector('#wh-used-save');btn.disabled=true;msg.textContent='Menyimpan...';
  try{await req('POST','daily-usage',{usage_date,warehouse_id:rec.wh_id,source_key:key,sku:item.sku,qty_used:qty,note:host.querySelector('#wh-used-note').value});msg.textContent='Pemakaian tersimpan, stok tidak berubah. Silakan pilih material berikutnya.';host.querySelector('#wh-used-qty').value='';await load();}
  catch(e){msg.textContent=e.message;}finally{btn.disabled=false;}
 };
 load();
}

async function renderDaily(){
 const host=root().querySelector('#wh-content');
 host.innerHTML='<div class="wh-box"><strong>Daily Stock IN / OUT</strong><p class="wh-muted">SKU resmi PX; saldo bermasalah akan ditandai untuk rekonsiliasi, tanpa mengubah stok.</p><div class="wh-tools"><input type="date" class="wh-input" id="wh-date" value="'+esc(date)+'"><button class="wh-btn" id="wh-load">Tampilkan</button></div><div id="wh-result"></div></div>';
 host.querySelector('#wh-load').onclick=async()=>{
  date=host.querySelector('#wh-date').value;const dest=host.querySelector('#wh-result');dest.textContent='Memuat...';
  try{const d=await req('GET','stock-ledger?date='+encodeURIComponent(date));dest.innerHTML=(d.quality_warning?'<p class="wh-muted">Perhatian: '+num(d.invalid_count||0)+' item dengan saldo tidak valid. Perlu rekonsiliasi; data saldo tidak diubah.</p>':'')+
   table(['SKU PX / Barang','Beginning','IN','OUT','Ending','Status'],(d.items||[]).map(i=>'<tr><td>'+esc(i.sku)+' — '+esc(i.name)+'</td><td>'+(i.opening==null?'-':num(i.opening))+'</td><td>'+(i.incoming==null?'-':num(i.incoming))+'</td><td>'+(i.outgoing==null?'-':num(i.outgoing))+'</td><td>'+(i.closing==null?'-':num(i.closing))+'</td><td>'+esc(i.quality==='invalid_balance'?'Perlu rekonsiliasi':i.quality==='verified'?'Sesuai':i.quality==='no_transaction_history'?'Tanpa riwayat':i.quality)+'</td></tr>').join('')||'<tr><td colspan="6">Belum ada material resmi yang terhubung ke Inventory.</td></tr>');}
  catch(e){dest.textContent=e.message;}
 };
}
async function renderMonthly(){
 const host=root().querySelector('#wh-content');
 host.innerHTML='<div class="wh-box"><strong>Rekap Inventory dan Pemakaian Bulanan</strong><div class="wh-muted">SKU resmi PX · OUT mutasi Inventory, USED dicatat dari pekerjaan harian.</div><div class="wh-tools"><input type="month" class="wh-input" id="wh-month" value="'+esc(month)+'"><button class="wh-btn" id="wh-load">Tampilkan</button></div><div id="wh-result"></div></div>';
 host.querySelector('#wh-load').onclick=async()=>{month=host.querySelector('#wh-month').value;const dest=host.querySelector('#wh-result');dest.textContent='Memuat...';try{const d=await req('GET','monthly-out?month='+encodeURIComponent(month));dest.innerHTML=table(['SKU PX / Material','Satuan','IN','OUT','USED'],(d.items||[]).map(i=>'<tr><td>'+esc(i.sku)+' — '+esc(i.name)+'</td><td>'+esc(i.unit)+'</td><td>'+num(i.incoming)+'</td><td>'+num(i.outgoing)+'</td><td>'+num(i.used)+'</td></tr>').join('')||'<tr><td colspan="5">Belum ada SKU PX resmi.</td></tr>');}catch(e){dest.textContent=e.message;}};
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
  try{await req('POST','stock-checks',{inventory_item_id:master.id,sku:master.sku,physical_qty:qty,note:host.querySelector('#wh-physical-note').value});msg.textContent='Audit fisik tersimpan, saldo Inventory tetap.';await load();}catch(e){msg.textContent=e.message;}
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
