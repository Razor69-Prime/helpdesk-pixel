/* PXL-URG-0002 — flow MR berbasis WO + Superadmin full access matrix + nav hard lock. */
(function(){
  'use strict';

  function currentRole(){try{return String(currentUser?.role||'').toLowerCase();}catch(_){return'';}}
  function assignedToMe(ticket){
    var name='';var id='';try{name=String(currentUser?.name||'').trim().toLowerCase();id=String(currentUser?.id||'');}catch(_){}
    var techs=Array.isArray(ticket?.technicians)?ticket.technicians:[];
    return techs.some(function(v){return String(v||'').trim().toLowerCase()===name||String(v||'')===id;})
      ||String(ticket?.technician||'').trim().toLowerCase()===name||String(ticket?.technician_id||'')===id;
  }

  function disableSalesOrderMR(){
    document.querySelectorAll('[data-act="mr"]').forEach(function(btn){btn.remove();});
    document.querySelectorAll('.section').forEach(function(section){
      if(/Material Request Trial/i.test(section.textContent||''))section.style.display='none';
    });
    var sub=document.querySelector('.toolbar .sub');
    if(sub&&/Material Request/i.test(sub.textContent||''))sub.textContent='Sales Order, approval, dan pembuatan Work Order.';
  }

  function addWarehouseRoleOptions(){
    document.querySelectorAll('select').forEach(function(select){
      var hasRole=[...select.options].some(function(o){return ['technician','admin','manager','sales','accounting'].includes(o.value);});
      if(!hasRole||[...select.options].some(function(o){return o.value==='warehouse';}))return;
      var option=document.createElement('option');option.value='warehouse';option.textContent='Gudang';
      var admin=[...select.options].find(function(o){return o.value==='admin';});
      select.insertBefore(option,admin||null);
    });
  }

  var accessGroups=[
    {label:'Operasional Teknisi',rows:[['report','Input Laporan'],['tickets','Daftar Tiket'],['materials','Material Request']]},
    {label:'Gudang',rows:[['inventory_view','Inventory'],['material_request_view','Material Request'],['material_request_edit','Persiapan / Pengembalian'],['material_request_issue','Pengeluaran Material']]},
    {label:'Sales & Proyek',rows:[['sales','Sales Dashboard'],['kunjungan','Kunjungan'],['projects','Project'],['crm','CRM'],['sales_order','Sales Order']]},
    {label:'Keuangan & Pengadaan',rows:[['invoice','Invoice'],['pr','Purchase Request'],['supplier','Supplier']]},
    {label:'Administrasi',rows:[['archive','Arsip'],['users','Manajemen Akun'],['actlog','Activity Log']]}
  ];
  var defaults={
    technician:['report_read','report_write','tickets_read','materials_read','materials_write','material_request_view','material_request_edit'],
    warehouse:['tickets_read','materials_read','materials_write','inventory_view_read','material_request_view','material_request_edit','material_request_issue'],
    sales:['sales_read','sales_write','kunjungan_read','kunjungan_write','projects_read','crm_read','crm_write','sales_order_read','sales_order_write','tickets_read'],
    accounting:['invoice_read','invoice_write','pr_read','pr_write','supplier_read','supplier_write','tickets_read'],
    manager:['dashboard_read','kpi_read','tickets_read','tickets_write','materials_read','materials_write','inventory_view_read','inventory_view_write','sales_read','projects_read','crm_read','sales_order_read','invoice_read','pr_read','supplier_read'],
    admin:['dashboard_read','dashboard_write','kpi_read','kpi_write','tickets_read','tickets_write','materials_read','materials_write','inventory_view_read','inventory_view_write','sales_read','sales_write','projects_read','projects_write','crm_read','crm_write','sales_order_read','sales_order_write','invoice_read','invoice_write','pr_read','pr_write','supplier_read','supplier_write','archive_read','users_read','users_write','actlog_read']
  };
  defaults.superadmin=['dashboard_read','dashboard_write','kpi_read','kpi_write'];
  accessGroups.forEach(function(group){group.rows.forEach(function(row){var id=row[0];if(/_(view|edit|issue)$/.test(id)){defaults.superadmin.push(id);}else{defaults.superadmin.push(id+'_read',id+'_write');}});});
  defaults.superadmin.push('ai_report_read');

  function renderAccessMatrix(role,selected){
    var box=document.getElementById('menu-checkboxes');if(!box)return;
    role=String(role||'').toLowerCase();
    var base=role==='superadmin'?defaults.superadmin:(Array.isArray(selected)&&selected.length?selected:(defaults[role]||[]));
    var selectedSet=new Set(base);
    box.innerHTML=accessGroups.map(function(group){
      return '<div style="margin-bottom:12px"><b style="font-size:12px">'+group.label+'</b><div style="margin-top:6px;border:1px solid var(--border);border-radius:8px;overflow:hidden">'+group.rows.map(function(row){
        var id=row[0],label=row[1];
        return '<div style="display:grid;grid-template-columns:1fr 90px 90px;align-items:center;gap:8px;padding:7px 9px;border-bottom:1px solid var(--border)"><span>'+label+'</span><label style="margin:0;text-transform:none"><input type="checkbox" data-access="'+id+'_read" '+(selectedSet.has(id+'_read')||selectedSet.has(id)?'checked':'')+'> Read Only</label><label style="margin:0;text-transform:none"><input type="checkbox" data-access="'+id+'_write" '+(selectedSet.has(id+'_write')?'checked':'')+'> Write</label></div>';
      }).join('')+'</div></div>';
    }).join('');
    box.querySelectorAll('[data-access$="_write"]').forEach(function(write){write.addEventListener('change',function(){if(write.checked){var read=box.querySelector('[data-access="'+write.dataset.access.replace(/_write$/,'_read')+'"]');if(read)read.checked=true;}});});
  }

  function installAccountHooks(){
    addWarehouseRoleOptions();
    var originalOpen=window.openEditUserModal;
    if(typeof originalOpen==='function')window.openEditUserModal=function(id){var result=originalOpen.apply(this,arguments);setTimeout(function(){addWarehouseRoleOptions();var u=Array.isArray(window.allUsers)?window.allUsers.find(function(x){return String(x.id)===String(id);}):null;var role=document.querySelector('#edit-user-modal select')?.value||u?.role||'technician';renderAccessMatrix(role,u?.custom_menus);},0);return result;};
    document.addEventListener('change',function(e){if(e.target&&e.target.tagName==='SELECT'&&e.target.closest('#edit-user-modal'))renderAccessMatrix(e.target.value,defaults[e.target.value]||[]);});
    document.addEventListener('click',function(e){var btn=e.target&&e.target.closest?e.target.closest('#edit-user-save, [onclick*="saveEditUser"]'):null;if(!btn)return;var roleSelect=document.querySelector('#edit-user-modal select');var editRole=String(roleSelect?.value||'').toLowerCase();var checks=editRole==='superadmin'?defaults.superadmin.slice():[...document.querySelectorAll('#menu-checkboxes [data-access]:checked')].map(function(x){return x.dataset.access;});var hidden=document.getElementById('pxl-access-v2');if(!hidden){hidden=document.createElement('input');hidden.type='hidden';hidden.id='pxl-access-v2';document.body.appendChild(hidden);}hidden.value=JSON.stringify(['access_v2'].concat(checks));try{var originalGet=window.getCheckedMenus;window.getCheckedMenus=function(){return ['access_v2'].concat(checks);};setTimeout(function(){if(originalGet)window.getCheckedMenus=originalGet;},500);}catch(_){}},true);
  }

  function installSuperadminNavGuard(){
    if(typeof window.buildNav!=='function'||window.buildNav.__pxlSuperadminFullAccess)return;
    var originalBuildNav=window.buildNav;
    window.buildNav=function(){
      var isSuper=false,oldOverride;
      try{
        isSuper=String(window.currentUser?.role||'').toLowerCase().replace(/[ _-]/g,'')==='superadmin';
        if(isSuper){oldOverride=window.currentUser.custom_menus_override;window.currentUser.custom_menus_override=false;}
      }catch(_){}
      try{return originalBuildNav.apply(this,arguments);}
      finally{try{if(isSuper)window.currentUser.custom_menus_override=oldOverride;}catch(_){}}
    };
    window.buildNav.__pxlSuperadminFullAccess=true;
    try{if(String(window.currentUser?.role||'').toLowerCase().replace(/[ _-]/g,'')==='superadmin')window.buildNav();}catch(_){}
  }

  function installMRFlow(){
    var originalShow=window.showMRForm;
    if(typeof originalShow==='function')window.showMRForm=function(editId){var result=originalShow.apply(this,arguments);if(!editId&&currentRole()==='technician')setTimeout(function(){var sel=document.getElementById('mr-wo');if(!sel)return;var allowed=[];try{allowed=(Array.isArray(allTickets)?allTickets:[]).filter(assignedToMe);}catch(_){}sel.innerHTML='<option value="">-- Pilih WO yang Ditugaskan --</option>';allowed.forEach(function(t){var o=document.createElement('option');o.value=t.id;o.dataset.wo=t.wo_number||'';o.dataset.project=t.project_name||t.description||'';o.textContent=(t.wo_number||t.id)+' — '+(t.project_name||t.customer_name||'');sel.appendChild(o);});sel.disabled=false;},0);return result;};
    window.onMRWOChange=async function(){var sel=document.getElementById('mr-wo');var opt=sel?.options[sel.selectedIndex];if(!opt?.value)return;document.getElementById('mr-project').value=opt.dataset.project||'';try{var data=await api('GET','/material-requests-form/work-order/'+encodeURIComponent(opt.value)+'/items');var body=document.getElementById('mr-items-body');body.innerHTML='';try{mrItemCount=0;}catch(_){}(data.items||[]).forEach(function(item){addMRItemRow(item,true);});if(!(data.items||[]).length)addMRItemRow(null,true);}catch(error){var err=document.getElementById('mr-form-error');err.textContent='Gagal mengambil item SO: '+error.message;err.style.display='block';}};
  }

  if(location.pathname.includes('sales-order')){disableSalesOrderMR();new MutationObserver(disableSalesOrderMR).observe(document.documentElement,{childList:true,subtree:true});return;}
  setTimeout(function(){installMRFlow();installAccountHooks();installSuperadminNavGuard();},0);
})();
