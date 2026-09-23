'use strict';
/* PXL-URG-0077 — Service Center Initial Module */
(function(){
  const CONTACT_CC='+62 811-3961-8857', CONTACT_TECH='+62 812-2682-4787';
  const STATUS={received:'Diterima',diagnosis:'Diagnosa',waiting_approval:'Menunggu Persetujuan Customer',waiting_part:'Menunggu Sparepart',in_progress:'Dalam Pengerjaan',testing:'Testing',completed:'Selesai',ready_pickup:'Siap Diambil',picked_up:'Sudah Diambil',cancelled:'Batal'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const idr=v=>v==null||v===''?'-':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const d=v=>v?new Date(v).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'-';
  const cu=()=>typeof currentUser!=='undefined'?currentUser:null;
  const role=()=>String(cu()?.role||'').toLowerCase();
  const perms=()=>new Set([...(cu()?.custom_menus||[]),...(cu()?.pr_roles||[]),...(cu()?.extra_roles||[])]);
  const has=p=>role()==='superadmin'||perms().has(p)||({
    manager:['service_view_all','service_create','service_assign','service_update','service_photo','service_cost','service_close','service_report'],
    admin:['service_view_all','service_create','service_assign','service_update','service_photo','service_cost','service_close','service_report'],
    operator:['service_view_all','service_create','service_assign','service_update','service_photo'],
    technician:['service_update','service_photo']
  }[role()]||[]).includes(p);
  let rows=[],techs=[],activeFilter='all';

  function css(){
    if(document.getElementById('pxl-urg-0077-css'))return;
    const st=document.createElement('style');st.id='pxl-urg-0077-css';st.textContent=
    '.svc-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.svc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}.svc-tab{border:1px solid var(--border);background:var(--surface);padding:7px 11px;border-radius:9px;font-size:12px;cursor:pointer}.svc-tab.active{background:var(--accent-light);border-color:#efb181;color:var(--accent);font-weight:700}.svc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.svc-stat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px}.svc-stat b{display:block;font-size:20px}.svc-stat span{font-size:11px;color:var(--muted)}.svc-table-wrap{overflow:auto;background:var(--surface);border:1px solid var(--border);border-radius:12px}.svc-table{width:100%;border-collapse:collapse;min-width:980px}.svc-table th,.svc-table td{padding:10px 12px;border-bottom:1px solid var(--border);font-size:12px;text-align:left}.svc-table th{font-size:10px;text-transform:uppercase;color:var(--muted)}.svc-badge{display:inline-block;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:800;background:var(--surface2)}.svc-rem-h1{background:#e8f2ff;color:#245b9e}.svc-rem-today{background:#fff3c4;color:#7b5b00}.svc-rem-overdue{background:#ffe6cc;color:#a14b00}.svc-rem-priority{background:#fde1df;color:#b42318}.svc-modal{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:500;display:flex;align-items:center;justify-content:center;padding:18px}.svc-box{background:var(--surface);width:min(920px,100%);max-height:92vh;overflow:auto;border-radius:16px;padding:18px}.svc-actions{display:flex;gap:8px;flex-wrap:wrap}.svc-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.svc-kv{padding:9px 0;border-bottom:1px solid var(--border)}.svc-kv span{display:block;font-size:10px;color:var(--muted);text-transform:uppercase}.svc-kv b{font-size:12px}.svc-toast{position:fixed;top:8px;left:50%;transform:translateX(-50%) translateY(-14px);z-index:1200;min-width:300px;max-width:680px;background:#fff7da;border:1px solid #ead28a;border-radius:10px;padding:9px 12px;box-shadow:0 8px 28px rgba(0,0,0,.14);display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:12px;opacity:0;transition:.25s}.svc-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}.svc-photo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.svc-photo-grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:9px;border:1px solid var(--border)}@media(max-width:800px){.svc-grid{grid-template-columns:1fr 1fr}.svc-detail-grid{grid-template-columns:1fr}.svc-photo-grid{grid-template-columns:repeat(2,1fr)}}';
    document.head.appendChild(st);
  }
  function root(){return document.getElementById('service-center-root')}
  function reminderBadge(r){if(!r)return'';return '<span class="svc-badge svc-rem-'+esc(r.key)+'">'+esc(r.label)+(r.days>0?' +'+r.days+' hari':'')+'</span>'}
  function filters(){
    return [
      ['all','Semua Service'],
      ['mine','Service Saya'],
      ['overdue','Overdue'],
      ['ready','Siap Diambil'],
      ['history','History']
    ].filter(x=>x[0]!=='all'||has('service_view_all'));
  }
  function filtered(){
    return rows.filter(r=>{
      if(activeFilter==='mine')return String(r.technician_user_id||'')===String(cu()?.id||'')||String(r.technician_name||'')===String(cu()?.name||'');
      if(activeFilter==='overdue')return ['overdue','priority'].includes(r.reminder?.key);
      if(activeFilter==='ready')return r.status==='ready_pickup';
      if(activeFilter==='history')return ['picked_up','cancelled'].includes(r.status)||r.is_archived===true;
      return !r.is_archived;
    });
  }
  function render(){
    css();const el=root();if(!el)return;
    const visible=filtered();
    const stats={active:rows.filter(x=>!x.is_archived).length,overdue:rows.filter(x=>['overdue','priority'].includes(x.reminder?.key)).length,priority:rows.filter(x=>x.reminder?.key==='priority').length,ready:rows.filter(x=>x.status==='ready_pickup').length};
    el.innerHTML='<div class="svc-head"><div><div style="font-size:18px;font-weight:700">🔧 Service Center</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Penerimaan dan monitoring service komputer, laptop, printer.</div></div><div class="svc-actions">'+(has('service_create')?'<button class="btn primary sm" onclick="pxlServiceCenter.openIntake()">+ Penerimaan Service</button>':'')+'<button class="btn sm" onclick="pxlServiceCenter.refresh()">↻ Refresh</button></div></div>'+
    '<div class="svc-grid"><div class="svc-stat"><b>'+stats.active+'</b><span>Service Aktif</span></div><div class="svc-stat"><b>'+stats.overdue+'</b><span>Overdue H+2</span></div><div class="svc-stat"><b>'+stats.priority+'</b><span>Prioritas > H+5</span></div><div class="svc-stat"><b>'+stats.ready+'</b><span>Siap Diambil</span></div></div>'+
    '<div class="svc-tabs">'+filters().map(x=>'<button class="svc-tab '+(activeFilter===x[0]?'active':'')+'" onclick="pxlServiceCenter.setFilter(\''+x[0]+'\')">'+x[1]+'</button>').join('')+'</div>'+
    '<div class="svc-table-wrap"><table class="svc-table"><thead><tr><th>No Service</th><th>Customer</th><th>Perangkat</th><th>Teknisi</th><th>Status</th><th>Estimasi</th><th>Reminder</th><th>Aksi</th></tr></thead><tbody>'+
    (visible.length?visible.map(r=>'<tr><td><b>'+esc(r.service_number)+'</b></td><td>'+esc(r.customer_name)+'<br><a href="https://wa.me/'+waNum(r.customer_phone)+'" target="_blank">'+esc(r.customer_phone)+'</a></td><td>'+esc([r.device_type,r.brand,r.model].filter(Boolean).join(' '))+'</td><td>'+esc(r.technician_name||'-')+'</td><td><span class="svc-badge">'+esc(STATUS[r.status]||r.status)+'</span></td><td>'+esc(d(r.estimated_done_date))+'</td><td>'+reminderBadge(r.reminder)+'</td><td><button class="btn sm" onclick="pxlServiceCenter.openDetail(\''+r.id+'\')">Buka</button></td></tr>').join(''):'<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:25px">Belum ada data service.</td></tr>')+
    '</tbody></table></div>';
  }
  async function refresh(){rows=await api('GET','/service-orders');render()}
  function waNum(v){let s=String(v||'').replace(/\D/g,'');if(s.startsWith('0'))s='62'+s.slice(1);return s}
  async function getTechs(){if(!has('service_create')&&!has('service_assign'))return[];try{techs=await api('GET','/service-center/technicians')}catch(_){techs=[]}return techs}
  function modal(html){const m=document.createElement('div');m.className='svc-modal';m.id='svc-modal';m.innerHTML='<div class="svc-box">'+html+'</div>';document.body.appendChild(m)}
  function close(){document.getElementById('svc-modal')?.remove()}
  async function openIntake(){
    await getTechs();
    modal('<div style="display:flex;justify-content:space-between;align-items:center"><div><b>Penerimaan Service</b><div style="font-size:11px;color:var(--muted)">PXL-URG-0077</div></div><button class="btn sm" onclick="pxlServiceCenter.close()">✕</button></div><div class="form-row" style="margin-top:16px"><div class="form-group"><label>Nama Customer</label><input id="svc-name"></div><div class="form-group"><label>No. WhatsApp</label><input id="svc-phone" placeholder="08..."></div></div><div class="form-row"><div class="form-group"><label>Jenis Perangkat</label><select id="svc-type"><option>Laptop</option><option>Komputer</option><option>Printer</option><option>Lainnya</option></select></div><div class="form-group"><label>Teknisi In Charge</label><select id="svc-tech"><option value="">Belum ditentukan</option>'+techs.map(t=>'<option value="'+esc(t.id)+'" data-name="'+esc(t.name)+'">'+esc(t.name)+'</option>').join('')+'</select></div></div><div class="form-row"><div class="form-group"><label>Brand</label><input id="svc-brand"></div><div class="form-group"><label>Model</label><input id="svc-model"></div></div><div class="form-row"><div class="form-group"><label>Serial Number</label><input id="svc-serial"></div><div class="form-group"><label>Estimasi Selesai</label><input id="svc-due" type="date"></div></div><div class="form-group"><label>Keluhan Customer</label><textarea id="svc-complaint" rows="3"></textarea></div><div class="form-group"><label>Kondisi Awal</label><textarea id="svc-condition" rows="2"></textarea></div><div class="form-group"><label>Kelengkapan</label><input id="svc-accessories" placeholder="Charger, tas, adaptor..."></div><div class="form-group"><label>Foto Penerimaan</label><input id="svc-files" type="file" accept="image/*" multiple><div style="font-size:11px;color:var(--muted)">Foto akan masuk ke Cloudinary dengan pola yang sama seperti foto WO.</div></div><div class="svc-actions" style="justify-content:flex-end"><button class="btn" onclick="pxlServiceCenter.close()">Batal</button><button class="btn primary" onclick="pxlServiceCenter.saveIntake()">Simpan & Buat Tanda Terima</button></div>');
  }
  async function uploadPhoto(serviceId,file,type='intake'){
    const sig=await api('POST','/service-orders/'+serviceId+'/photos/signature',{});
    const fd=new FormData();fd.append('file',file);fd.append('api_key',sig.api_key);fd.append('timestamp',sig.timestamp);fd.append('public_id',sig.public_id);fd.append('signature',sig.signature);
    const r=await fetch('https://api.cloudinary.com/v1_1/'+encodeURIComponent(sig.cloud_name)+'/image/upload',{method:'POST',body:fd});const c=await r.json();if(!r.ok)throw new Error(c.error?.message||'Upload foto gagal.');
    return api('POST','/service-orders/'+serviceId+'/photos',{secure_url:c.secure_url,cloudinary_public_id:c.public_id,original_filename:file.name,generated_filename:sig.generated_filename,photo_type:type,visible_to_customer:true});
  }
  async function saveIntake(){
    const sel=document.getElementById('svc-tech'),opt=sel.options[sel.selectedIndex];
    const payload={customer_name:document.getElementById('svc-name').value.trim(),customer_phone:document.getElementById('svc-phone').value.trim(),device_type:document.getElementById('svc-type').value,technician_user_id:sel.value||null,technician_name:opt?.dataset?.name||null,brand:document.getElementById('svc-brand').value.trim(),model:document.getElementById('svc-model').value.trim(),serial_number:document.getElementById('svc-serial').value.trim(),estimated_done_date:document.getElementById('svc-due').value||null,complaint:document.getElementById('svc-complaint').value.trim(),initial_condition:document.getElementById('svc-condition').value.trim(),accessories:document.getElementById('svc-accessories').value.split(',').map(x=>x.trim()).filter(Boolean)};
    const created=await api('POST','/service-orders',payload);
    const files=[...document.getElementById('svc-files').files];
    for(const file of files)await uploadPhoto(created.id,file,'intake');
    close();await refresh();await openDetail(created.id,true);
  }
  function waTemplate(r){
    const track=location.origin+'/service/track/'+r.tracking_token;
    return 'Halo Bapak/Ibu '+(r.customer_name||'')+',\n\nKami dari Pixel Solusindo ingin menginformasikan terkait service Anda.\n\nNo. Service: '+r.service_number+'\nPerangkat: '+[r.device_type,r.brand,r.model].filter(Boolean).join(' ')+'\nStatus: '+(STATUS[r.status]||r.status)+'\nEstimasi Selesai: '+d(r.estimated_done_date)+'\n\nUpdate:\n'+(r.customer_update||'Perangkat telah kami terima dan sedang diproses.')+'\n\nTracking service:\n'+track+'\n\nKontak:\nCustomer Care: '+CONTACT_CC+'\nTeknisi In Charge: '+(r.technician_name||'-')+'\nKontak Teknisi: '+CONTACT_TECH+'\n\nJika ada pertanyaan, silakan balas pesan ini.\n\nTerima kasih.\nPixel Solusindo';
  }
  function receipt(r){
    const track=location.origin+'/service/track/'+r.tracking_token;
    const w=window.open('','_blank','width=760,height=900');if(!w)return;
    w.document.write('<!doctype html><html><head><title>'+esc(r.service_number)+'</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#222}.head{text-align:center;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:18px}table{width:100%;border-collapse:collapse}td{padding:7px;border-bottom:1px solid #ddd;font-size:13px}td:first-child{width:190px;color:#666}.box{border:1px solid #bbb;padding:12px;margin-top:14px;font-size:12px}.foot{margin-top:25px;font-size:11px;color:#666}</style></head><body><div class="head"><h2>PIXEL SOLUSINDO</h2><b>TANDA TERIMA SERVICE</b></div><table><tr><td>No. Service</td><td><b>'+esc(r.service_number)+'</b></td></tr><tr><td>Tanggal Masuk</td><td>'+esc(d(r.received_at))+'</td></tr><tr><td>Customer</td><td>'+esc(r.customer_name)+'</td></tr><tr><td>No. WhatsApp</td><td>'+esc(r.customer_phone)+'</td></tr><tr><td>Perangkat</td><td>'+esc([r.device_type,r.brand,r.model].filter(Boolean).join(' '))+'</td></tr><tr><td>Serial Number</td><td>'+esc(r.serial_number||'-')+'</td></tr><tr><td>Keluhan</td><td>'+esc(r.complaint||'-')+'</td></tr><tr><td>Kondisi Awal</td><td>'+esc(r.initial_condition||'-')+'</td></tr><tr><td>Kelengkapan</td><td>'+esc((r.accessories||[]).join(', ')||'-')+'</td></tr><tr><td>Estimasi Selesai</td><td>'+esc(d(r.estimated_done_date))+'</td></tr><tr><td>Teknisi In Charge</td><td>'+esc(r.technician_name||'-')+'</td></tr></table><div class="box"><b>Tracking Service</b><br>'+esc(track)+'<div id="qr" style="margin-top:10px"></div></div><div class="box"><b>Kontak</b><br>Customer Care: '+CONTACT_CC+'<br>Teknisi: '+CONTACT_TECH+'</div><div class="foot">Estimasi dapat berubah setelah proses diagnosa dan konfirmasi customer.</div><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script><script>new QRCode(document.getElementById("qr"),{text:'+JSON.stringify(track)+',width:110,height:110});setTimeout(()=>window.print(),500);<\/script></body></html>');w.document.close();
  }
  async function openDetail(id,printAfter){
    const r=await api('GET','/service-orders/'+id);
    const photos=(r.photos||[]).map(p=>'<a href="'+esc(p.secure_url||p.image_url)+'" target="_blank"><img src="'+esc(p.secure_url||p.image_url)+'"></a>').join('');
    modal('<div style="display:flex;justify-content:space-between;gap:12px"><div><b>'+esc(r.service_number)+'</b><div style="font-size:11px;color:var(--muted)">'+esc(r.customer_name)+' · '+esc([r.device_type,r.brand,r.model].filter(Boolean).join(' '))+'</div></div><button class="btn sm" onclick="pxlServiceCenter.close()">✕</button></div><div class="svc-detail-grid" style="margin-top:14px"><div><div class="svc-kv"><span>Customer / WhatsApp</span><b>'+esc(r.customer_name)+' · <a target="_blank" href="https://wa.me/'+waNum(r.customer_phone)+'">'+esc(r.customer_phone)+'</a></b></div><div class="svc-kv"><span>Keluhan</span><b>'+esc(r.complaint||'-')+'</b></div><div class="svc-kv"><span>Kondisi Awal</span><b>'+esc(r.initial_condition||'-')+'</b></div><div class="svc-kv"><span>Kelengkapan</span><b>'+esc((r.accessories||[]).join(', ')||'-')+'</b></div></div><div><div class="svc-kv"><span>Status</span><b>'+esc(STATUS[r.status]||r.status)+'</b></div><div class="svc-kv"><span>Estimasi</span><b>'+esc(d(r.estimated_done_date))+'</b></div><div class="svc-kv"><span>Teknisi</span><b>'+esc(r.technician_name||'-')+'</b></div><div class="svc-kv"><span>Biaya</span><b>'+esc(idr(r.final_cost||r.estimated_cost))+'</b></div></div></div><div class="svc-actions" style="margin:14px 0"><button class="btn sm" onclick="pxlServiceCenter.printReceipt(\''+r.id+'\')">🖨 Tanda Terima</button><button class="btn sm" onclick="pxlServiceCenter.sendWA(\''+r.id+'\')">📲 WhatsApp</button><button class="btn sm" onclick="navigator.clipboard.writeText(location.origin+\'/service/track/'+r.tracking_token+'\')">🔗 Copy Tracking</button></div><div class="card" style="padding:14px"><b>Update Service</b><div class="form-row" style="margin-top:10px"><div class="form-group"><label>Status</label><select id="svc-up-status">'+Object.entries(STATUS).map(([k,v])=>'<option value="'+k+'" '+(r.status===k?'selected':'')+'>'+v+'</option>').join('')+'</select></div><div class="form-group"><label>Estimasi Selesai</label><input id="svc-up-due" type="date" value="'+esc(r.estimated_done_date||'')+'"></div></div><div class="form-group"><label>Update untuk Customer</label><textarea id="svc-up-note" rows="2">'+esc(r.customer_update||'')+'</textarea></div><div class="form-group"><label>Catatan Timeline</label><input id="svc-up-timeline" placeholder="Contoh: Diagnosa selesai, menunggu persetujuan"></div><button class="btn primary sm" onclick="pxlServiceCenter.saveUpdate(\''+r.id+'\')">Simpan Update</button></div><div class="card" style="padding:14px"><b>Foto Service</b><div class="svc-photo-grid" style="margin-top:10px">'+(photos||'<div style="font-size:11px;color:var(--muted)">Belum ada foto.</div>')+'</div><div class="form-row" style="margin-top:12px"><div class="form-group"><label>Jenis Foto</label><select id="svc-photo-type"><option value="intake">Penerimaan</option><option value="progress">Progress</option><option value="completed">Selesai</option><option value="handover">Penyerahan</option></select></div><div class="form-group"><label>Upload Foto</label><input id="svc-photo-file" type="file" accept="image/*"></div></div><button class="btn sm" onclick="pxlServiceCenter.uploadDetailPhoto(\''+r.id+'\')">Upload Foto</button></div>');
    if(printAfter)setTimeout(()=>receipt(r),300);
  }
  async function saveUpdate(id){await api('PATCH','/service-orders/'+id,{status:document.getElementById('svc-up-status').value,estimated_done_date:document.getElementById('svc-up-due').value||null,customer_update:document.getElementById('svc-up-note').value.trim(),timeline_note:document.getElementById('svc-up-timeline').value.trim(),customer_visible:true});close();await refresh();openDetail(id)}
  async function uploadDetailPhoto(id){const f=document.getElementById('svc-photo-file').files[0];if(!f)return alert('Pilih foto terlebih dahulu.');await uploadPhoto(id,f,document.getElementById('svc-photo-type').value);close();openDetail(id)}
  async function printReceipt(id){const r=await api('GET','/service-orders/'+id);receipt(r)}
  async function sendWA(id){const r=await api('GET','/service-orders/'+id);window.open('https://wa.me/'+waNum(r.customer_phone)+'?text='+encodeURIComponent(waTemplate(r)),'_blank')}
  async function showReminder(){
    if(sessionStorage.getItem('pxl-service-reminder-shown'))return;
    try{
      const x=await api('GET','/service-center/reminders');if(!x.total)return;
      sessionStorage.setItem('pxl-service-reminder-shown','1');
      const t=document.createElement('div');t.className='svc-toast';t.innerHTML='<div>🔧 <b>Service Reminder</b> · '+x.total+' perlu perhatian'+(x.counts.priority?' · '+x.counts.priority+' prioritas':'')+'</div><button class="btn sm" id="svc-toast-open">Lihat</button>';document.body.appendChild(t);setTimeout(()=>t.classList.add('show'),80);t.querySelector('#svc-toast-open').onclick=()=>{t.remove();const b=document.querySelector('[data-tab-id="service_center"]');if(b)switchTab('service_center',b);activeFilter='overdue';refresh()};setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},5500);
    }catch(_){}
  }
  window.pxlServiceCenter={refresh,render,setFilter:f=>{activeFilter=f;render()},openIntake,saveIntake,openDetail,close,saveUpdate,uploadDetailPhoto,printReceipt,sendWA,showReminder};
})();