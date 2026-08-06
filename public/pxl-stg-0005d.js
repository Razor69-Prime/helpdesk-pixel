/* PXL-STG-0006J — sinkronisasi material terbaru SO ke MR Draft dan checklist akun. */
(function(){
  'use strict';

  function authHeaders(){
    const token=localStorage.getItem('pixel_token')||'';
    return {'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};
  }
  async function getJSON(url,timeoutMs=10000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{headers:authHeaders(),cache:'no-store',signal:controller.signal});
      let data={};try{data=await response.json();}catch(_){data={};}
      if(!response.ok)throw new Error(data.error||'Gagal mengambil data.');
      return data;
    }catch(error){
      if(error?.name==='AbortError')throw new Error('Waktu permintaan habis. Silakan buka ulang form.');
      throw error;
    }finally{
      clearTimeout(timer);
    }
  }
  function showError(message){
    const el=document.getElementById('mr-form-error');
    if(!el)return;
    el.textContent=message||'';
    el.style.display=message?'block':'none';
  }
  function showInventoryStatus(message){
    const el=document.getElementById('mr-inventory-status');
    if(el&&message)el.textContent=message;
  }
  function normalized(value){return String(value==null?'':value).trim().toLowerCase();}
  function assignmentValues(value){
    if(value==null)return[];
    if(typeof value==='object')return[value.id,value.user_id,value.technician_id,value.name,value.username,value.email].filter(Boolean).map(normalized);
    return[normalized(value)];
  }
  function assignedLocally(ticket,user){
    if(!ticket||!user)return false;
    const identities=new Set([user.id,user.name,user.username,user.email].filter(Boolean).map(normalized));
    const candidates=[];
    (Array.isArray(ticket.technicians)?ticket.technicians:[]).forEach(value=>candidates.push(...assignmentValues(value)));
    [ticket.technician,ticket.technician_id,ticket.technician_1,ticket.technician_1_id,ticket.technician_2,ticket.technician_2_id,ticket.assigned_to,ticket.assigned_to_id]
      .forEach(value=>candidates.push(...assignmentValues(value)));
    return candidates.some(value=>identities.has(value));
  }
  function activeMRForm(){
    const section=document.getElementById('mr-form-section');
    return !!section&&section.style.display!=='none';
  }
  function canSyncSalesOrderItems(){
    if(!activeMRForm())return false;
    const submitText=normalized(document.getElementById('mr-submit-btn')?.textContent);
    return !submitText.includes('update pemakaian')&&!submitText.includes('pengembalian');
  }
  function localAssignedWorkOrders(){
    try{
      const user=currentUser;
      const tickets=Array.isArray(allTickets)?allTickets:[];
      return tickets.filter(ticket=>{
        const status=normalized(ticket?.status);
        const active=!ticket?.archived&&!['done','completed','cancelled','canceled','void','closed'].includes(status);
        return active&&assignedLocally(ticket,user);
      }).map(ticket=>({
        id:ticket.id,
        wo_number:ticket.wo_number||null,
        project_name:ticket.project_name||ticket.project||ticket.description||'',
        customer_name:ticket.customer_name||ticket.customer||''
      }));
    }catch(_){return[];}
  }
  function renderWorkOrders(select,workOrders){
    select.innerHTML='<option value="">-- Pilih WO yang Ditugaskan --</option>';
    workOrders.forEach(ticket=>{
      const option=document.createElement('option');
      option.value=ticket.id;
      option.dataset.wo=ticket.wo_number||'';
      option.dataset.project=ticket.project_name||'';
      option.textContent=(ticket.wo_number||ticket.id)+' — '+(ticket.project_name||ticket.customer_name||'Tanpa nama project');
      select.appendChild(option);
    });
    select.disabled=false;
  }
  async function populateAssignedWO(){
    const select=document.getElementById('mr-wo');
    if(!select)return;
    select.disabled=false;
    select.innerHTML='<option value="">Memuat WO yang ditugaskan...</option>';
    showError('');
    try{
      const data=await getJSON('/api/material-requests-form/assigned-work-orders');
      if(!Array.isArray(data.work_orders))throw new Error('Respons daftar Work Order tidak valid.');
      if(!select.isConnected)return;
      renderWorkOrders(select,data.work_orders);
      if(!data.work_orders.length)showError('Belum ada Work Order aktif yang ditugaskan kepada akun teknisi ini.');
    }catch(error){
      if(!select.isConnected)return;
      const fallback=localAssignedWorkOrders();
      renderWorkOrders(select,fallback);
      if(fallback.length){
        showError('Daftar WO backend gagal dimuat. Data assignment lokal sementara digunakan.');
      }else{
        showError('Gagal mengambil daftar WO: '+String(error.message||error));
      }
    }
  }
  function existingInventoryIds(body){
    return new Set([...body.querySelectorAll('tr')]
      .map(row=>String(row.dataset.inventoryId||'').trim())
      .filter(Boolean));
  }
  function removeBlankRows(body){
    body.querySelectorAll('tr').forEach(row=>{
      const inventoryId=String(row.dataset.inventoryId||'').trim();
      const name=String(row.querySelector('.mr-name')?.value||'').trim();
      if(!inventoryId&&!name)row.remove();
    });
  }
  function resetMRItemCounter(){
    try{mrItemCount=0;}catch(_){}
  }
  async function syncSelectedWOItems(options={}){
    const replace=options.replace===true;
    const silent=options.silent===true;
    const select=document.getElementById('mr-wo');
    const option=select?.options?.[select.selectedIndex];
    if(!option?.value)return {added:0,skipped:true};
    if(!replace&&!canSyncSalesOrderItems())return {added:0,skipped:true};

    const project=document.getElementById('mr-project');
    if(project&&option.dataset.project)project.value=option.dataset.project;
    if(!silent)showError('');

    const data=await getJSON('/api/material-requests-form/work-order/'+encodeURIComponent(option.value)+'/items');
    if(!Array.isArray(data.items))throw new Error('Respons item Sales Order tidak valid.');
    const body=document.getElementById('mr-items-body');
    if(!body)return {added:0,skipped:true};

    if(replace){
      body.innerHTML='';
      resetMRItemCounter();
    }

    removeBlankRows(body);
    const existing=existingInventoryIds(body);
    let added=0;
    data.items.forEach(item=>{
      const inventoryId=String(item?.inventory_item_id||item?.item_id||'').trim();
      if(!inventoryId||existing.has(inventoryId))return;
      if(typeof addMRItemRow==='function'){
        addMRItemRow(item,true);
        existing.add(inventoryId);
        added++;
      }
    });

    if(replace&&!body.querySelector('tr')){
      if(typeof addMRItemRow==='function')addMRItemRow(null,true);
      if(!silent)showError('Sales Order tidak memiliki item Inventory yang dapat dimasukkan ke MR.');
    }else if(added>0){
      showError('');
      showInventoryStatus('✅ '+added+' material terbaru dari Sales Order ditambahkan otomatis.');
    }else if(replace&&!silent){
      showInventoryStatus('Material Sales Order sudah dimuat lengkap.');
    }

    return {added,items:data.items,sales_order_id:data.sales_order_id||null};
  }
  async function loadItemsFromSelectedWO(event){
    if(event){event.preventDefault();event.stopImmediatePropagation();}
    try{
      return await syncSelectedWOItems({replace:true,silent:false});
    }catch(error){
      const body=document.getElementById('mr-items-body');
      if(body){body.innerHTML='';resetMRItemCounter();}
      showError('Gagal mengambil item SO: '+String(error.message||error));
      return {added:0,error};
    }
  }
  async function syncEditedDraft(){
    if(!canSyncSalesOrderItems())return;
    try{
      await syncSelectedWOItems({replace:false,silent:true});
    }catch(error){
      showError('Gagal menyinkronkan material terbaru SO: '+String(error.message||error));
    }
  }
  document.addEventListener('change',function(event){
    if(event.target?.id==='mr-wo')void loadItemsFromSelectedWO(event);
  },true);
  window.onMRWOChange=loadItemsFromSelectedWO;

  const originalShowMRForm=window.showMRForm;
  if(typeof originalShowMRForm==='function'){
    window.showMRForm=function(editId){
      const result=originalShowMRForm.apply(this,arguments);
      if(!editId){
        setTimeout(()=>{void populateAssignedWO();},0);
      }else{
        setTimeout(()=>{void syncEditedDraft();},120);
      }
      return result;
    };
  }

  const GROUPS=[
    ['Operasional Teknisi',[['report','Input Laporan'],['tickets','Daftar Tiket'],['materials','Material Request']]],
    ['Gudang',[['inventory_view','Inventory'],['material_request_view','Material Request'],['material_request_edit','Persiapan / Pengembalian'],['material_request_issue','Pengeluaran Material']]],
    ['Sales & Proyek',[['sales','Sales Dashboard'],['kunjungan','Kunjungan'],['projects','Project'],['crm','CRM'],['sales_order','Sales Order']]],
    ['Accounting & Piutang',[['invoice','Invoice']]],
    ['Keuangan & Pengadaan',[['pr','Purchase Request'],['supplier','Supplier']]],
    ['Administrasi',[['archive','Arsip'],['users','Manajemen Akun'],['actlog','Activity Log']]]
  ];
  const DEFAULTS={
    technician:['report_read','report_write','tickets_read','materials_read','materials_write','material_request_view','material_request_edit'],
    warehouse:['tickets_read','materials_read','materials_write','inventory_view_read','material_request_view','material_request_edit','material_request_issue'],
    sales:['sales_read','sales_write','kunjungan_read','kunjungan_write','projects_read','crm_read','crm_write','sales_order_read','sales_order_write','tickets_read'],
    accounting:['invoice_read','invoice_write','pr_read','pr_write','supplier_read','supplier_write','tickets_read'],
    manager:['dashboard_read','kpi_read','tickets_read','tickets_write','materials_read','materials_write','inventory_view_read','sales_read','projects_read','crm_read','sales_order_read','invoice_read','pr_read','supplier_read'],
    admin:['dashboard_read','dashboard_write','kpi_read','kpi_write','tickets_read','tickets_write','materials_read','materials_write','inventory_view_read','inventory_view_write','sales_read','sales_write','projects_read','projects_write','crm_read','crm_write','sales_order_read','sales_order_write','invoice_read','invoice_write','pr_read','pr_write','supplier_read','supplier_write','archive_read','users_read','users_write','actlog_read']
  };
  function addWarehouseOption(){
    document.querySelectorAll('select').forEach(select=>{
      const values=[...select.options].map(o=>o.value);
      if(!values.includes('technician')||values.includes('warehouse'))return;
      const option=document.createElement('option');option.value='warehouse';option.textContent='Gudang';
      const admin=[...select.options].find(o=>o.value==='admin');select.insertBefore(option,admin||null);
    });
  }
  function selectedPermissions(){return [...document.querySelectorAll('#menu-checkboxes [data-access]:checked')].map(el=>el.dataset.access);}
  function renderPermissions(role,stored){
    const box=document.getElementById('menu-checkboxes');if(!box)return;
    const source=Array.isArray(stored)&&stored.some(v=>/_read$|_write$/.test(v))?stored:(DEFAULTS[role]||[]);
    const checked=new Set(source);
    box.innerHTML=GROUPS.map(([label,rows])=>'<section style="margin-bottom:12px"><b>'+label+'</b><div style="margin-top:6px;border:1px solid var(--border);border-radius:8px;overflow:hidden">'+rows.map(([id,name])=>'<div style="display:grid;grid-template-columns:1fr 100px 80px;gap:8px;align-items:center;padding:8px;border-bottom:1px solid var(--border)"><span>'+name+'</span><label style="margin:0;text-transform:none"><input type="checkbox" data-access="'+id+'_read" '+(checked.has(id+'_read')||checked.has(id)?'checked':'')+'> Read Only</label><label style="margin:0;text-transform:none"><input type="checkbox" data-access="'+id+'_write" '+(checked.has(id+'_write')?'checked':'')+'> Write</label></div>').join('')+'</div></section>').join('');
    box.querySelectorAll('[data-access$="_write"]').forEach(write=>write.addEventListener('change',()=>{if(write.checked){const read=box.querySelector('[data-access="'+write.dataset.access.replace('_write','_read')+'"]');if(read)read.checked=true;}}));
  }
  function legacyMenus(perms){return [...new Set(perms.map(v=>v.replace(/_(read|write)$/,'')).filter(Boolean))];}
  function installGetCheckedMenus(){
    window.getCheckedMenus=function(){const perms=selectedPermissions();return ['access_v2',...perms,...legacyMenus(perms)];};
  }
  function enhanceAccountModal(){
    addWarehouseOption();
    const modal=document.getElementById('edit-user-modal');
    if(!modal||modal.style.display==='none')return;
    const roleSelect=[...modal.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='technician'));
    const role=roleSelect?.value||'technician';
    const existing=[...document.querySelectorAll('#menu-checkboxes [data-menu]:checked')].map(x=>x.dataset.menu);
    if(!document.querySelector('#menu-checkboxes [data-access]'))renderPermissions(role,existing);
    installGetCheckedMenus();
  }
  document.addEventListener('change',function(event){
    if(event.target?.tagName==='SELECT'&&event.target.closest('#edit-user-modal')&&[...event.target.options].some(o=>o.value==='technician'))renderPermissions(event.target.value,DEFAULTS[event.target.value]||[]);
  });
  document.addEventListener('click',function(event){
    const trigger=event.target?.closest?.('[onclick*="openEditUserModal"], [onclick*="openUser"], #user-table-body button');
    if(trigger)setTimeout(enhanceAccountModal,0);
  });
  const accountObserver=new MutationObserver(enhanceAccountModal);
  document.addEventListener('DOMContentLoaded',()=>{
    addWarehouseOption();installGetCheckedMenus();
    const modal=document.getElementById('edit-user-modal');
    if(modal)accountObserver.observe(modal,{attributes:true,attributeFilter:['style','class']});
  });
})();
