/* PXL-VNEXT-2D2 — Manual WO Survey reporting + mobile fast search + PROBUS badge + Survey → SO handoff. */
(function(){
  'use strict';
  let catalog=[];
  let catalogLoaded=false;
  let rowSeq=0;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function tickets(){try{return Array.isArray(allTickets)?allTickets:[]}catch(_){return[]}}
  function ticketById(id){return tickets().find(t=>String(t.id)===String(id))||null}
  function isManualSurvey(t){return !!t&&String(t.source_type||'manual').toLowerCase()==='manual'&&String(t.work_order_type||'')==='Survey'&&!t.sales_order_id&&!t.so_number}
  function canCreateSO(){
    try{
      const u=currentUser||{};
      const custom=Array.isArray(u.custom_menus)?u.custom_menus:[];
      if(u.custom_menus_override===true)return custom.includes('sales_order_create_wo');
      if(String(u.role||'').toLowerCase()==='superadmin')return true;
      return custom.includes('sales_order_create_wo');
    }catch(_){return false}
  }
  window.canCreateSalesOrderFromSurvey=canCreateSO;

  async function ensureCatalog(){
    if(catalogLoaded)return catalog;
    try{
      const data=await api('GET','/material-catalog');
      const rows=Array.isArray(data)?data:(data?.items||[]);
      catalog=rows.filter(x=>x?.inventory_available!==false).map(x=>({
        id:x.inventory_item_id||x.id||null,
        name:String(x.name||x.item_name||'').trim(),
        sku:String(x.sku||'').trim(),
        unit:String(x.unit||'pcs').trim()||'pcs',
        stock:Number(x.stock||0),
        barcode:String(x.barcode||'').trim(),
        product_number:String(x.product_number||'').trim(),
        source_key:String(x.source_key||'')
      })).filter(x=>x.id&&x.name);
    }catch(_){catalog=[]}
    catalogLoaded=true;
    return catalog;
  }

  function ensureModal(){
    let modal=document.getElementById('pxl-vnext-2c-survey-modal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='pxl-vnext-2c-survey-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100004;align-items:center;justify-content:center;padding:10px;overflow:auto;overflow-x:hidden';
    modal.innerHTML=`<style>
      #pxl-vnext-2c-survey-modal *{box-sizing:border-box}
      #pxl-vnext-2c-survey-modal .pxl2c-dialog{width:min(900px,100%);max-width:100%;max-height:94vh;overflow:auto;overflow-x:hidden;background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:14px;box-shadow:0 20px 55px rgba(0,0,0,.28)}
      #pxl-vnext-2c-survey-modal .pxl2c-body{padding:17px;display:grid;gap:14px;min-width:0}
      #pxl-vnext-2c-survey-modal input,#pxl-vnext-2c-survey-modal textarea{width:100%;max-width:100%;min-width:0}
      #pxl-vnext-2c-survey-modal textarea{min-height:82px;resize:vertical}
      #pxl-vnext-2c-survey-modal .pxl2c-narrative{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0}
      #pxl-vnext-2c-survey-modal .pxl2c-line-card{display:grid;gap:8px;min-width:0;padding:9px;border:1px solid var(--border,#ddd);border-radius:9px;background:var(--surface,#fff)}
      #pxl-vnext-2c-survey-modal .pxl2c-material-picker{position:relative;min-width:0}
      #pxl-vnext-2c-survey-modal .pxl2c-material-results{display:none;position:absolute;left:0;right:0;top:100%;z-index:8;max-height:220px;overflow:auto;background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,.14)}
      #pxl-vnext-2c-survey-modal .pxl2c-material-option{padding:9px 10px;border-bottom:1px solid var(--border,#eee);border-left:4px solid var(--accent,#e07b39);cursor:pointer;background:var(--surface,#fff)}
      #pxl-vnext-2c-survey-modal .pxl2c-material-option:last-child{border-bottom:0}
      #pxl-vnext-2c-survey-modal .pxl2c-material-option small{display:block;margin-top:2px;color:var(--muted,#777)}
      #pxl-vnext-2c-survey-modal .pxl2c-probus-badge{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;background:#e8f5e9;color:#2e7d32;font-size:9px;font-weight:800;line-height:1.2;vertical-align:1px}
      #pxl-vnext-2c-survey-modal .pxl2c-selected{font-size:10px;color:var(--green,#3b6d11);margin-top:4px;min-height:14px}
      #pxl-vnext-2c-survey-modal .pxl2c-row-compact{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:7px;align-items:end;min-width:0}
      #pxl-vnext-2c-survey-modal .pxl2c-remove{width:40px;height:38px;padding:0;align-self:end}
      #pxl-vnext-2c-survey-modal .pxl2c-section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:9px;flex-wrap:wrap}
      @media(max-width:640px){
        #pxl-vnext-2c-survey-modal{padding:6px}
        #pxl-vnext-2c-survey-modal .pxl2c-dialog{width:100%;max-height:97vh;border-radius:11px}
        #pxl-vnext-2c-survey-modal .pxl2c-body{padding:11px;gap:11px}
        #pxl-vnext-2c-survey-modal #pxl2c-survey-info{grid-template-columns:1fr!important}
        #pxl-vnext-2c-survey-modal .pxl2c-narrative{grid-template-columns:1fr}
        #pxl-vnext-2c-survey-modal .pxl2c-section{padding:10px!important}
        #pxl-vnext-2c-survey-modal .pxl2c-section-head .btn{flex:0 0 auto}
      }
    </style><div class="pxl2c-dialog">
      <div style="position:sticky;top:0;z-index:2;background:var(--surface,#fff);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;border-bottom:1px solid var(--border,#ddd)">
        <div style="min-width:0"><b style="font-size:16px">Laporan Hasil Survey</b><div id="pxl2c-survey-sub" style="font-size:11px;color:var(--muted);margin-top:3px;overflow-wrap:anywhere"></div></div>
        <button type="button" class="btn sm" data-close>✕ Tutup</button>
      </div>
      <div class="pxl2c-body">
        <div id="pxl2c-survey-info" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;min-width:0"></div>
        <div class="pxl2c-narrative">
          <div><label>Catatan Teknis</label><textarea id="pxl2c-technical" placeholder="Hasil pengecekan teknis..."></textarea></div>
          <div><label>Kendala / Catatan Tambahan</label><textarea id="pxl2c-constraints" placeholder="Kendala akses, jalur kabel, listrik, jaringan, dll..."></textarea></div>
        </div>
        <div class="pxl2c-section" style="border:1px solid var(--border);border-radius:10px;padding:12px;min-width:0">
          <div class="pxl2c-section-head"><div style="min-width:0"><b>Material Hasil Survey</b><div style="font-size:11px;color:var(--muted);line-height:1.4">Cari nama / SKU Inventory. Jika belum ada, material tetap boleh ditulis manual. Harga tidak ditampilkan.</div></div><button class="btn sm" type="button" id="pxl2c-add-material">+ Material</button></div>
          <div id="pxl2c-material-rows" style="display:grid;gap:8px;min-width:0"></div>
        </div>
        <div class="pxl2c-section" style="border:1px solid var(--border);border-radius:10px;padding:12px;min-width:0">
          <div class="pxl2c-section-head"><div style="min-width:0"><b>Jasa / Pekerjaan</b><div style="font-size:11px;color:var(--muted);line-height:1.4">Teknisi menentukan kebutuhan dan qty. Harga tetap ditentukan Sales.</div></div><button class="btn sm" type="button" id="pxl2c-add-service">+ Jasa</button></div>
          <div id="pxl2c-service-rows" style="display:grid;gap:8px;min-width:0"></div>
        </div>
        <div id="pxl2c-survey-error" style="display:none;background:var(--red-bg,#fee);color:var(--red,#a22);padding:10px;border-radius:8px"></div>
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
          <div style="font-size:11px;color:var(--muted);line-height:1.4">Dokumentasi foto tetap menggunakan tombol <b>📷 Foto</b> pada Work Order.</div>
          <button type="button" class="btn primary" id="pxl2c-survey-submit">💾 Simpan Hasil Survey</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick=()=>modal.style.display='none';
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none'});
    modal.querySelector('#pxl2c-add-material').onclick=()=>addMaterialRow();
    modal.querySelector('#pxl2c-add-service').onclick=()=>addServiceRow();
    modal.querySelector('#pxl2c-survey-submit').onclick=submitSurvey;
    return modal;
  }

  function infoCell(label,value,wide=false){return `<div style="${wide?'grid-column:1/-1;':''}min-width:0"><div style="font-size:10px;text-transform:uppercase;color:var(--muted)">${esc(label)}</div><div style="font-size:12px;margin-top:2px;overflow-wrap:anywhere">${value||'-'}</div></div>`}
  function makeRemoveButton(){const b=document.createElement('button');b.type='button';b.className='btn danger sm pxl2c-remove';b.textContent='✕';b.setAttribute('aria-label','Hapus baris');return b}

  function isProbusItem(item){return String(item?.source_key||'').startsWith('MANUAL:PROBUS:')}
  function probusBadge(item){return isProbusItem(item)?'<span class="pxl2c-probus-badge">PROBUS</span>':''}
  function catalogSearchText(x){return [x.name,x.sku,x.barcode,x.product_number].map(v=>String(v||'').toLowerCase()).join(' ')}
  function findCatalogMatches(value){
    const q=String(value||'').trim().toLowerCase();
    if(!q)return[];
    const exact=catalog.filter(x=>[x.name,x.sku,x.barcode,x.product_number].some(v=>String(v||'').trim().toLowerCase()===q));
    return (exact.length?exact:catalog.filter(x=>catalogSearchText(x).includes(q))).slice(0,12);
  }
  function matchCatalog(value){
    const q=String(value||'').trim().toLowerCase();
    if(!q)return null;
    return catalog.find(x=>x.name.toLowerCase()===q||x.sku.toLowerCase()===q||`${x.sku} · ${x.name}`.trim().toLowerCase()===q)||null;
  }
  function selectMaterial(row,item){
    if(!row||!item)return;
    row.dataset.inventoryId=String(item.id||'');
    const input=row.querySelector('.pxl2c-name'),unit=row.querySelector('.pxl2c-unit'),selected=row.querySelector('.pxl2c-selected'),results=row.querySelector('.pxl2c-material-results');
    if(input)input.value=item.name||'';
    if(unit)unit.value=item.unit||'pcs';
    if(selected)selected.innerHTML=`Dipilih: ${esc(item.sku||'-')} · Stok: ${Number(item.stock||0)} ${esc(item.unit||'pcs')} ${probusBadge(item)}`;
    if(results){results.style.display='none';results.innerHTML='';}
  }
  function renderMaterialSuggestions(row,value){
    const box=row?.querySelector('.pxl2c-material-results');if(!box)return;
    const q=String(value||'').trim();
    if(!q){box.style.display='none';box.innerHTML='';return;}
    const matches=findCatalogMatches(q);
    box.innerHTML=matches.length?matches.map((item,i)=>`<div class="pxl2c-material-option" data-catalog-index="${i}"><b>${esc(item.name)}${probusBadge(item)}</b><small>SKU: ${esc(item.sku||'-')} · Stok: ${Number(item.stock||0)} ${esc(item.unit||'pcs')}</small></div>`).join(''):'<div style="padding:10px;color:var(--muted);font-size:11px">Tidak ditemukan di Inventory. Nama tetap boleh diinput manual.</div>';
    box.style.display='block';
    box.querySelectorAll('[data-catalog-index]').forEach(el=>el.onmousedown=e=>{e.preventDefault();selectMaterial(row,matches[Number(el.dataset.catalogIndex)])});
  }
  function addMaterialRow(item={}){
    const box=document.getElementById('pxl2c-material-rows');if(!box)return;
    rowSeq++;
    const row=document.createElement('div');row.className='pxl2c-material-row pxl2c-line-card';row.dataset.inventoryId=item.inventory_item_id||'';
    const name=document.createElement('div');name.className='pxl2c-material-picker';name.innerHTML='<label>Nama Material</label><input class="pxl2c-name" autocomplete="off" placeholder="Cari nama / SKU atau input manual"><div class="pxl2c-material-results"></div><div class="pxl2c-selected"></div>';
    const ni=name.querySelector('input');ni.value=item.name||'';
    const compact=document.createElement('div');compact.className='pxl2c-row-compact';
    const qty=document.createElement('div');qty.innerHTML='<label>Qty</label><input class="pxl2c-qty" type="number" min="0.01" step="0.01">';qty.querySelector('input').value=item.qty||1;
    const unit=document.createElement('div');unit.innerHTML='<label>Satuan</label><input class="pxl2c-unit" placeholder="pcs">';unit.querySelector('input').value=item.unit||'pcs';
    const rem=makeRemoveButton();rem.onclick=()=>row.remove();compact.append(qty,unit,rem);
    const note=document.createElement('div');note.innerHTML='<label>Catatan</label><input class="pxl2c-note" placeholder="opsional">';note.querySelector('input').value=item.notes||'';
    row.append(name,compact,note);box.appendChild(row);
    const initial=catalog.find(x=>String(x.id)===String(item.inventory_item_id||''))||matchCatalog(item.name||'');
    if(initial&&item.inventory_item_id)selectMaterial(row,initial);
    ni.addEventListener('input',()=>{row.dataset.inventoryId='';const selected=row.querySelector('.pxl2c-selected');if(selected)selected.textContent='';renderMaterialSuggestions(row,ni.value)});
    ni.addEventListener('focus',()=>{if(ni.value)renderMaterialSuggestions(row,ni.value)});
    ni.addEventListener('blur',()=>setTimeout(()=>{
      const m=matchCatalog(ni.value);if(m)selectMaterial(row,m);else{row.dataset.inventoryId='';const selected=row.querySelector('.pxl2c-selected');if(selected)selected.textContent=ni.value?'Input manual · belum terhubung Inventory':'';const results=row.querySelector('.pxl2c-material-results');if(results)results.style.display='none';}
    },160));
  }
  function addServiceRow(item={}){
    const box=document.getElementById('pxl2c-service-rows');if(!box)return;
    const row=document.createElement('div');row.className='pxl2c-service-row pxl2c-line-card';
    const name=document.createElement('div');name.innerHTML='<label>Nama Jasa</label><input class="pxl2c-name" placeholder="Contoh: Instalasi kamera">';name.querySelector('input').value=item.name||'';
    const compact=document.createElement('div');compact.className='pxl2c-row-compact';
    const qty=document.createElement('div');qty.innerHTML='<label>Qty</label><input class="pxl2c-qty" type="number" min="0.01" step="0.01">';qty.querySelector('input').value=item.qty||1;
    const unit=document.createElement('div');unit.innerHTML='<label>Satuan</label><input class="pxl2c-unit" placeholder="titik">';unit.querySelector('input').value=item.unit||'titik';
    const rem=makeRemoveButton();rem.onclick=()=>row.remove();compact.append(qty,unit,rem);
    const note=document.createElement('div');note.innerHTML='<label>Catatan</label><input class="pxl2c-note" placeholder="opsional">';note.querySelector('input').value=item.notes||'';
    row.append(name,compact,note);box.appendChild(row);
  }

  function setReadOnly(modal,readonly){
    modal.querySelectorAll('textarea,input').forEach(el=>el.disabled=readonly);
    modal.querySelectorAll('#pxl2c-add-material,#pxl2c-add-service,.pxl2c-material-row .danger,.pxl2c-service-row .danger').forEach(el=>el.style.display=readonly?'none':'');
    modal.querySelectorAll('.pxl2c-material-results').forEach(el=>el.style.display='none');
    const submit=modal.querySelector('#pxl2c-survey-submit');submit.style.display=readonly?'none':'';
  }

  async function openSurvey(ticketId,forceReadOnly=false){
    const t=ticketById(ticketId);if(!isManualSurvey(t))return alert('Form Survey hanya tersedia untuk WO Manual bertipe Survey.');
    await ensureCatalog();
    const modal=ensureModal();modal.dataset.ticketId=String(ticketId);
    modal.querySelector('#pxl2c-survey-sub').textContent=`${t.wo_number||'-'} · ${t.survey_status==='so_created'?'SO Dibuat':t.survey_status==='ready_for_so'?'Siap Dibuat SO':'Belum Submit'}`;
    const map=t.google_maps_url?`<a href="${esc(t.google_maps_url)}" target="_blank" rel="noopener">📍 Buka Google Maps</a>`:'-';
    modal.querySelector('#pxl2c-survey-info').innerHTML=infoCell('No. WO',esc(t.wo_number))+infoCell('Teknisi',esc((t.technicians||[t.technician]).filter(Boolean).join(' & ')))+infoCell('Customer',esc(t.customer_name))+infoCell('No. WA',esc(t.customer_phone))+infoCell('Project',esc(t.project_name),true)+infoCell('Lokasi Google Maps',map,true);
    modal.querySelector('#pxl2c-technical').value=t.survey_technical_notes||'';
    modal.querySelector('#pxl2c-constraints').value=t.survey_constraints||'';
    modal.querySelector('#pxl2c-material-rows').innerHTML='';modal.querySelector('#pxl2c-service-rows').innerHTML='';
    (Array.isArray(t.survey_materials)&&t.survey_materials.length?t.survey_materials:[{}]).forEach(addMaterialRow);
    (Array.isArray(t.survey_services)&&t.survey_services.length?t.survey_services:[{}]).forEach(addServiceRow);
    modal.querySelector('#pxl2c-survey-error').style.display='none';
    const role=String(currentUser?.role||'').toLowerCase();
    const assigned=(t.technicians||[t.technician]).some(n=>String(n||'').trim().toLowerCase()===String(currentUser?.name||'').trim().toLowerCase());
    const readonly=forceReadOnly||t.survey_status==='so_created'||!(role==='superadmin'||(role==='technician'&&assigned));
    setReadOnly(modal,readonly);
    modal.style.display='flex';
  }
  window.openSurveyReportModal=openSurvey;

  function collectRows(selector,kind){
    return [...document.querySelectorAll(selector)].map(row=>{
      const name=row.querySelector('.pxl2c-name')?.value.trim()||'';
      const qty=Number(row.querySelector('.pxl2c-qty')?.value||0);
      const unit=row.querySelector('.pxl2c-unit')?.value.trim()||'pcs';
      const notes=row.querySelector('.pxl2c-note')?.value.trim()||null;
      if(!name&&!qty)return null;
      if(!name)throw new Error(`Nama ${kind} wajib diisi.`);
      if(!(qty>0))throw new Error(`Qty ${name} harus lebih dari 0.`);
      return {name,qty,unit,notes,...(kind==='material'?{inventory_item_id:row.dataset.inventoryId||null}:{})};
    }).filter(Boolean);
  }

  async function submitSurvey(){
    const modal=ensureModal(),ticketId=modal.dataset.ticketId,err=modal.querySelector('#pxl2c-survey-error'),btn=modal.querySelector('#pxl2c-survey-submit');
    err.style.display='none';
    try{
      const materials=collectRows('.pxl2c-material-row','material');
      const services=collectRows('.pxl2c-service-row','jasa');
      if(!materials.length&&!services.length)throw new Error('Minimal isi 1 Material atau Jasa hasil Survey.');
      btn.disabled=true;btn.textContent='Menyimpan...';
      const result=await api('POST',`/tickets/${ticketId}/survey-report`,{
        technical_notes:document.getElementById('pxl2c-technical').value.trim()||null,
        constraints:document.getElementById('pxl2c-constraints').value.trim()||null,
        materials,services
      });
      const idx=tickets().findIndex(t=>String(t.id)===String(ticketId));
      if(idx>=0&&result?.ticket)allTickets[idx]={...allTickets[idx],...result.ticket};
      modal.style.display='none';
      if(typeof renderTickets==='function')renderTickets();
      if(typeof renderSurveyResults==='function')renderSurveyResults();
    }catch(e){err.textContent=e.message||'Gagal menyimpan hasil Survey.';err.style.display='block'}
    finally{btn.disabled=false;btn.textContent='💾 Simpan Hasil Survey'}
  }

  async function cancelWO(ticketId){
    const t=ticketById(ticketId);if(!t)return;
    const reason=prompt(`Alasan membatalkan ${t.wo_number||'WO'}?\nNomor WO tetap tersimpan dan tidak dapat digunakan ulang.`);
    if(reason===null)return;
    if(!String(reason).trim())return alert('Alasan pembatalan wajib diisi.');
    try{
      const result=await api('POST',`/tickets/${ticketId}/cancel`,{reason:String(reason).trim()});
      const idx=tickets().findIndex(x=>String(x.id)===String(ticketId));if(idx>=0&&result?.ticket)allTickets[idx]={...allTickets[idx],...result.ticket};
      renderTickets();renderKPI?.();
    }catch(e){alert('Gagal cancel WO: '+e.message)}
  }
  window.cancelWorkOrder=cancelWO;

  function openSO(ticketId,existing=false){
    const t=ticketById(ticketId);if(!t)return;
    if(!canCreateSO()&&!existing)return alert('Anda tidak memiliki izin membuat Work Order / Sales Order dari Survey.');
    const frame=document.getElementById('sales-order-frame');if(!frame)return alert('Modul Sales Order tidak ditemukan.');
    const query=existing&&t.survey_sales_order_id?`focus_so_id=${encodeURIComponent(t.survey_sales_order_id)}`:`survey_ticket_id=${encodeURIComponent(ticketId)}`;
    frame.dataset.loaded='1';
    frame.addEventListener('load',()=>{try{sendModuleToken(frame)}catch(_){}},{once:true});
    frame.src=`/sales-order.html?v=PXL-VNEXT-2D1&${query}`;
    const nav=document.querySelector('[data-tab-id="sales-order-fallback"]');
    if(typeof switchTab==='function')switchTab('sales_order',nav||undefined);
  }
  window.openSalesOrderFromSurvey=id=>openSO(id,false);
  window.openExistingSalesOrderFromSurvey=id=>openSO(id,true);

  window.PXL_VNEXT_2C={isManualSurvey,canCreateSO,openSurvey,cancelWO,openSO};
})();
