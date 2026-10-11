/* PXL-VNEXT-3B — Project Material Request */
(function(){
  'use strict';
  const REV='PXL-VNEXT-3B';
  const state={projectId:null,requestId:null,project:null,catalog:null,list:[],detail:null,editorItems:[],busy:false,pendingMovement:null};
  const $=s=>document.querySelector(s);
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const user=()=>typeof currentUser!=='undefined'?(currentUser||{}):{};
  const role=()=>String(user().role||'').toLowerCase().replace(/[ _-]/g,'');
  const customs=()=>Array.isArray(user().custom_menus)?user().custom_menus:[];
  const editable=mr=>['draft','rejected'].includes(String(mr?.status||'').toLowerCase());
  const statusLabels={draft:'Draft',submitted:'Diajukan',approved:'Approved',rejected:'Rejected',issued:'Diambil',final:'Final'};

  async function request(method,path,body){
    const token=localStorage.getItem('pixel_token')||'';
    const response=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
    let data={};try{data=await response.json();}catch(_){data={};}
    if(!response.ok)throw new Error(data.error||'Permintaan MR Project gagal.');
    return data;
  }

  function ensureStyle(){
    if($('#pxl-v3b-mr-style'))return;
    const s=document.createElement('style');s.id='pxl-v3b-mr-style';s.textContent=`
      .pxl-v3b-mr-modal{display:none;position:fixed;inset:0;z-index:10070;background:rgba(15,23,42,.55);padding:20px;overflow:auto;align-items:flex-start;justify-content:center}.pxl-v3b-mr-modal.show{display:flex}
      .pxl-v3b-mr-dialog{width:min(1180px,98vw);background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.25)}.pxl-v3b-mr-head{padding:16px 18px;border-bottom:1px solid var(--border);display:flex;gap:12px;justify-content:space-between}.pxl-v3b-mr-body{padding:18px}.pxl-v3b-mr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.pxl-v3b-mr-card{border:1px solid var(--border);border-radius:10px;padding:11px;background:var(--surface2)}.pxl-v3b-mr-label{font-size:9px;text-transform:uppercase;color:var(--muted);font-weight:800}.pxl-v3b-mr-value{font-size:13px;font-weight:800;margin-top:4px}.pxl-v3b-mr-muted{font-size:11px;color:var(--muted)}.pxl-v3b-mr-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}.pxl-v3b-mr-list{display:grid;gap:8px}.pxl-v3b-mr-row{border:1px solid var(--border);border-radius:10px;padding:11px;background:var(--surface);display:flex;gap:10px;justify-content:space-between;align-items:center}.pxl-v3b-mr-status{font-size:10px;border:1px solid var(--border);border-radius:99px;padding:3px 7px;font-weight:800}.pxl-v3b-mr-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:10px}.pxl-v3b-mr-table{width:100%;border-collapse:collapse;min-width:800px;font-size:11px}.pxl-v3b-mr-table th{background:var(--surface2);font-size:9px;text-transform:uppercase;color:var(--muted);padding:8px;text-align:left}.pxl-v3b-mr-table td{padding:8px;border-top:1px solid var(--border);vertical-align:top}.pxl-v3b-mr-error{background:var(--red-bg);color:var(--red);padding:9px;border-radius:8px;margin-bottom:10px}.pxl-v3b-mr-section{font-weight:800;font-size:13px;margin:16px 0 8px}.pxl-v3b-mr-actions{display:flex;gap:7px;flex-wrap:wrap}.pxl-v3b-mr-extra{background:var(--accent-light)}
      @media(max-width:700px){.pxl-v3b-mr-modal{padding:7px}.pxl-v3b-mr-body{padding:12px}.pxl-v3b-mr-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function ensureShell(){
    ensureStyle();if($('#pxl-v3b-mr-modal'))return;
    document.body.insertAdjacentHTML('beforeend',`<div class="pxl-v3b-mr-modal" id="pxl-v3b-mr-modal"><div class="pxl-v3b-mr-dialog"><div class="pxl-v3b-mr-head"><div><div style="font-size:18px;font-weight:800">Material Request Project</div><div class="pxl-v3b-mr-muted" id="pxl-v3b-mr-sub">${REV}</div></div><button class="btn ghost sm" id="pxl-v3b-mr-close">✕</button></div><div class="pxl-v3b-mr-body" id="pxl-v3b-mr-body"></div></div></div>`);
    $('#pxl-v3b-mr-close').onclick=close;
    $('#pxl-v3b-mr-modal').onclick=e=>{if(e.target.id==='pxl-v3b-mr-modal')close()};
  }

  function projectHeader(){
    const p=state.project||{};
    return `<div class="pxl-v3b-mr-grid" style="margin-bottom:12px"><div class="pxl-v3b-mr-card"><div class="pxl-v3b-mr-label">Project Number</div><div class="pxl-v3b-mr-value">${h(p.project_number||'—')}</div></div><div class="pxl-v3b-mr-card"><div class="pxl-v3b-mr-label">Project Name</div><div class="pxl-v3b-mr-value">${h(p.nama_project||'—')}</div></div><div class="pxl-v3b-mr-card"><div class="pxl-v3b-mr-label">PIC</div><div class="pxl-v3b-mr-value">${h(p.pic||'—')}</div></div></div>`;
  }

  function renderList(){
    const body=$('#pxl-v3b-mr-body');if(!body)return;
    const canCreate=role()==='technician';
    body.innerHTML=projectHeader()+`<div class="pxl-v3b-mr-toolbar"><div><b>Daftar MR Project</b><div class="pxl-v3b-mr-muted">Nomor MR dibuat server dan tidak dapat diedit manual.</div></div><div class="pxl-v3b-mr-actions"><button class="btn sm" id="pxl-v3b-mr-refresh">↻ Refresh</button>${canCreate?'<button class="btn primary sm" id="pxl-v3b-mr-create">＋ Buat MR Project</button>':''}</div></div><div class="pxl-v3b-mr-list">${state.list.length?state.list.map(m=>`<div class="pxl-v3b-mr-row"><div><b>${h(m.mr_number||'MR Project')}</b><div class="pxl-v3b-mr-muted">${h(m.created_by||'-')} · ${h(String(m.created_at||'').slice(0,16).replace('T',' '))}</div></div><div class="pxl-v3b-mr-actions"><span class="pxl-v3b-mr-status">${h(statusLabels[m.status]||m.status||'-')}</span><button class="btn sm" data-v3b-mr-open="${h(m.id)}">Buka</button></div></div>`).join(''):'<div class="pxl-v3b-mr-card pxl-v3b-mr-muted">Belum ada MR Project.</div>'}</div>`;
    $('#pxl-v3b-mr-refresh').onclick=refresh;
    $('#pxl-v3b-mr-create')?.addEventListener('click',createMr);
    body.querySelectorAll('[data-v3b-mr-open]').forEach(b=>b.onclick=()=>open(state.projectId,b.dataset.v3bMrOpen));
  }

  function boqOptions(){return (state.catalog?.boq_items||[]).map(i=>`<option value="${h(i.id)}">${h(i.item_name||'-')} · BOQ ${h(i.boq_qty||0)} ${h(i.unit||'')}</option>`).join('')}
  function inventoryOptions(){return (state.catalog?.inventory_items||[]).map(i=>`<option value="${h(i.id)}">${h(i.name||'-')} · stok ${h(i.stock||0)} ${h(i.unit||'')}</option>`).join('')}

  function editorRow(item,index){
    const extra=item.source_type==='inventory_extra';
    return `<tr class="${extra?'pxl-v3b-mr-extra':''}"><td>${index+1}</td><td>${extra?`<select data-v3b-inv="${index}"><option value="">Pilih Inventory...</option>${inventoryOptions()}</select><div class="pxl-v3b-mr-muted">Material di luar BOQ</div>`:`<select data-v3b-boq="${index}"><option value="">Pilih BOQ Project...</option>${boqOptions()}</select><div class="pxl-v3b-mr-muted" style="margin:4px 0">BOQ Project</div><select data-v3b-boq-inv="${index}"><option value="">Mapping Inventory...</option>${inventoryOptions()}</select><div class="pxl-v3b-mr-muted">Mapping Inventory</div>`}</td><td><input type="number" min="0.01" step="0.01" data-v3b-qty="${index}" value="${h(item.qty_requested||'')}"></td><td>${extra?`<input data-v3b-reason="${index}" value="${h(item.additional_reason||'')}" placeholder="Alasan wajib">`:'—'}</td><td><button class="btn danger sm" data-v3b-remove="${index}">Hapus</button></td></tr>`;
  }

  function readOnlyRows(items){
    return (items||[]).map((i,index)=>`<tr><td>${index+1}</td><td><b>${h(i.item_name_snapshot||i.item_name||'-')}</b><div class="pxl-v3b-mr-muted">${h(i.source_type==='inventory_extra'?'Di luar BOQ':'BOQ Project')} · ${h(i.unit_snapshot||i.unit||'')}</div>${i.additional_reason?`<div class="pxl-v3b-mr-muted">Alasan: ${h(i.additional_reason)}</div>`:''}</td><td>${h(i.qty_requested||0)}</td><td>${h(i.qty_taken||0)}</td><td>${h(i.qty_returned||0)}</td><td>${h(i.qty_used||0)}</td><td>${h(i.qty_outstanding||0)}</td></tr>`).join('');
  }


  function hasLegacyPermission(permission){
    if(role()==='superadmin')return true;
    const defaults={material_request_view:['technician','warehouse'],material_request_edit:['technician','warehouse'],material_request_issue:['warehouse']};
    return (defaults[permission]||[]).includes(role())||customs().includes(permission);
  }
  function isOwner(mr){return String(mr?.created_by_user_id||'')===String(user()?.id||'')}
  function canApprove(mr){return String(mr?.status||'')==='submitted'&&['manager','admin'].includes(role())}
  function canTake(mr){const status=String(mr?.status||'');return (status==='approved'||status==='issued')&&hasLegacyPermission('material_request_issue')}
  function canReturnUse(mr){return String(mr?.status||'')==='issued'&&(isOwner(mr)||hasLegacyPermission('material_request_edit'))}
  function canFinalize(mr){const items=Array.isArray(mr?.items)?mr.items:[];return String(mr?.status||'')==='issued'&&items.length>0&&items.every(i=>Number(i.qty_outstanding||0)===0)&&canReturnUse(mr)}

  function renderApproval(mr){
    if(!canApprove(mr))return '';
    return `<div class="pxl-v3b-mr-section">Approval Manager / Admin</div><div class="pxl-v3b-mr-card"><div class="pxl-v3b-mr-muted" style="margin-bottom:8px">Item dan Qty bersifat read-only. Jika perlu perubahan, Reject lalu Teknisi mengedit dan submit ulang.</div><div class="pxl-v3b-mr-actions"><button class="btn green sm" id="pxl-v3b-approve">Approve</button><button class="btn danger sm" id="pxl-v3b-reject">Reject</button><input id="pxl-v3b-reject-reason" placeholder="Alasan reject (opsional)" style="max-width:320px"></div></div>`;
  }

  function movementButtons(mr,item,index){
    const out=Number(item.qty_outstanding||0);
    const actions=[];
    if(canTake(mr))actions.push(`<button class="btn blue sm" data-v3b-move="take" data-item="${h(item.id)}" data-index="${index}">Take</button>`);
    if(canReturnUse(mr)&&out>0){actions.push(`<button class="btn sm" data-v3b-move="return" data-item="${h(item.id)}" data-index="${index}">Return</button>`);actions.push(`<button class="btn sm" data-v3b-move="use" data-item="${h(item.id)}" data-index="${index}">Use</button>`)}
    return actions.join(' ');
  }

  function renderLifecycle(mr){
    const status=String(mr?.status||'');
    if(status!=='approved'&&status!=='issued')return '';
    const items=Array.isArray(mr.items)?mr.items:[];
    const rows=items.map((i,index)=>`<tr><td>${index+1}</td><td><b>${h(i.item_name_snapshot||'-')}</b><div class="pxl-v3b-mr-muted">${h(i.unit_snapshot||'')}</div></td><td>${h(i.qty_requested||0)}</td><td>${h(i.qty_taken||0)}</td><td>${h(i.qty_returned||0)}</td><td>${h(i.qty_used||0)}</td><td><b>${h(i.qty_outstanding||0)}</b></td><td><input type="number" min="0.01" step="0.01" data-v3b-move-qty="${index}" placeholder="Qty" style="width:80px" ${(!canTake(mr)&&!canReturnUse(mr))?'disabled':''}><div class="pxl-v3b-mr-actions" style="margin-top:5px">${movementButtons(mr,i,index)}</div></td></tr>`).join('');
    const finalButton=canFinalize(mr)?'<button class="btn green sm" id="pxl-v3b-finalize">Final MR Project</button>':'';
    return `<div class="pxl-v3b-mr-section">Material Lifecycle</div><div class="pxl-v3b-mr-table-wrap"><table class="pxl-v3b-mr-table"><thead><tr><th>No</th><th>Material</th><th>Requested</th><th>Taken</th><th>Returned</th><th>Used</th><th>Outstanding</th><th>Aksi</th></tr></thead><tbody>${rows||'<tr><td colspan="8">Belum ada item.</td></tr>'}</tbody></table></div><div class="pxl-v3b-mr-actions" style="margin-top:10px">${finalButton}</div>`;
  }

  function renderAudit(mr){
    const movements=Array.isArray(mr?.movements)?mr.movements:[],history=Array.isArray(mr?.history)?mr.history:[];
    if(!movements.length&&!history.length)return '';
    const hRows=history.map(x=>`<div class="pxl-v3b-mr-row"><div><b>${h(x.event_type||'-')}</b><div class="pxl-v3b-mr-muted">${h(x.from_status||'-')} → ${h(x.to_status||'-')} · ${h(x.actor||'-')}</div></div><div class="pxl-v3b-mr-muted">${h(String(x.created_at||'').slice(0,16).replace('T',' '))}</div></div>`).join('');
    const mRows=movements.map(x=>`<div class="pxl-v3b-mr-row"><div><b>${h(String(x.movement_type||'').toUpperCase())}</b><div class="pxl-v3b-mr-muted">Qty ${h(x.qty||0)} · ${h(x.performed_by||'-')}</div></div><div class="pxl-v3b-mr-muted">${h(String(x.performed_at||'').slice(0,16).replace('T',' '))}</div></div>`).join('');
    return `<div class="pxl-v3b-mr-section">History & Movement Ledger</div><div class="pxl-v3b-mr-list">${mRows}${hRows}</div>`;
  }

  async function approveMr(){if(state.busy)return;state.busy=true;try{state.detail=await request('POST',`/project-material-requests/${encodeURIComponent(state.requestId)}/approve`,{});renderDetail()}catch(e){alert(e.message||'Approve MR Project gagal.')}finally{state.busy=false}}
  async function rejectMr(){if(state.busy)return;const reason=String($('#pxl-v3b-reject-reason')?.value||'').trim();state.busy=true;try{state.detail=await request('POST',`/project-material-requests/${encodeURIComponent(state.requestId)}/reject`,{reason});renderDetail()}catch(e){alert(e.message||'Reject MR Project gagal.')}finally{state.busy=false}}

  async function applyMovement(type,itemId,index,button){
    if(state.busy)return;
    const qty=Number(document.querySelector(`[data-v3b-move-qty="${index}"]`)?.value);
    if(!Number.isFinite(qty)||qty<=0){alert('Qty movement harus lebih dari 0.');return}
    const signature=`${state.requestId}:${type}:${itemId}:${qty}`;
    const idempotencyKey=state.pendingMovement?.signature===signature?state.pendingMovement.key:crypto.randomUUID();
    state.pendingMovement={signature,key:idempotencyKey};state.busy=true;if(button)button.disabled=true;
    try{
      const result=await request('POST',`/project-material-requests/${encodeURIComponent(state.requestId)}/movements`,{movement_type:type,items:[{item_id:itemId,qty}],idempotency_key:idempotencyKey});
      if(result?.material_request)state.detail=result.material_request;else await loadDetail(state.requestId);
      state.pendingMovement=null;renderDetail();
    }catch(e){alert(e.message||'Movement MR Project gagal.');if(button)button.disabled=false}
    finally{state.busy=false}
  }
  async function finalizeMr(){if(state.busy)return;state.busy=true;try{state.detail=await request('POST',`/project-material-requests/${encodeURIComponent(state.requestId)}/finalize`,{});renderDetail()}catch(e){alert(e.message||'Finalisasi MR Project gagal.')}finally{state.busy=false}}

  function bindLifecycle(mr){
    $('#pxl-v3b-approve')?.addEventListener('click',approveMr);$('#pxl-v3b-reject')?.addEventListener('click',rejectMr);$('#pxl-v3b-finalize')?.addEventListener('click',finalizeMr);
    document.querySelectorAll('[data-v3b-move]').forEach(btn=>btn.onclick=()=>applyMovement(btn.dataset.v3bMove,btn.dataset.item,Number(btn.dataset.index),btn));
  }

  function renderDetail(){
    const body=$('#pxl-v3b-mr-body');if(!body)return;
    const mr=state.detail||{},isEditable=editable(mr);
    const rejectNote=mr.status==='rejected'?`<div class="pxl-v3b-mr-error"><b>Rejected</b>${mr.reject_reason?`: ${h(mr.reject_reason)}`:' — tanpa catatan.'}</div>`:'';
    let content=projectHeader()+rejectNote+`<div class="pxl-v3b-mr-toolbar"><div><div class="pxl-v3b-mr-muted">Nomor MR Project</div><div style="font-size:17px;font-weight:800">${h(mr.mr_number||'—')}</div></div><div class="pxl-v3b-mr-actions"><span class="pxl-v3b-mr-status">${h(statusLabels[mr.status]||mr.status||'-')}</span><button class="btn sm" id="pxl-v3b-mr-back">← Daftar MR</button></div></div>`;
    if(isEditable){
      content+=`<div class="pxl-v3b-mr-section">Material Request</div><div class="pxl-v3b-mr-muted" style="margin-bottom:8px">Pilih material dari BOQ Project terlebih dahulu. Material di luar BOQ harus dipilih dari Inventory dan wajib memiliki Alasan.</div><div class="pxl-v3b-mr-table-wrap"><table class="pxl-v3b-mr-table"><thead><tr><th>No</th><th>Material</th><th>Qty Requested</th><th>Alasan</th><th>Aksi</th></tr></thead><tbody>${state.editorItems.length?state.editorItems.map(editorRow).join(''):'<tr><td colspan="5" class="pxl-v3b-mr-muted">Belum ada item.</td></tr>'}</tbody></table></div><div class="pxl-v3b-mr-actions" style="margin-top:10px"><button class="btn sm" id="pxl-v3b-add-boq">＋ Tambah dari BOQ Project</button><button class="btn sm" id="pxl-v3b-add-extra">＋ Tambah Material di Luar BOQ</button><button class="btn primary sm" id="pxl-v3b-save">Simpan</button><button class="btn green sm" id="pxl-v3b-submit">Simpan &amp; Ajukan MR Project</button></div>`;
    }else{
      content+=`<div class="pxl-v3b-mr-section">Item — Read Only</div><div class="pxl-v3b-mr-table-wrap"><table class="pxl-v3b-mr-table"><thead><tr><th>No</th><th>Material</th><th>Requested</th><th>Taken</th><th>Returned</th><th>Used</th><th>Outstanding</th></tr></thead><tbody>${readOnlyRows(mr.items)||'<tr><td colspan="7">Belum ada item.</td></tr>'}</tbody></table></div>${renderApproval(mr)}${renderLifecycle(mr)}${renderAudit(mr)}`;
    }
    body.innerHTML=content;
    $('#pxl-v3b-mr-back').onclick=()=>{state.requestId=null;state.detail=null;renderList()};
    if(isEditable)bindEditor();else bindLifecycle(mr);
  }

  function bindEditor(){
    document.querySelectorAll('[data-v3b-boq]').forEach(sel=>{const i=Number(sel.dataset.v3bBoq);sel.value=state.editorItems[i]?.project_boq_item_id||'';sel.onchange=()=>{state.editorItems[i].project_boq_item_id=sel.value||null;const row=(state.catalog?.boq_items||[]).find(x=>String(x.id)===String(sel.value));state.editorItems[i].inventory_item_id=row?.inventory_item_id||null;state.editorItems[i].item_name=row?.item_name||null;state.editorItems[i].unit=row?.unit||null;renderDetail();}});
    document.querySelectorAll('[data-v3b-boq-inv]').forEach(sel=>{const i=Number(sel.dataset.v3bBoqInv);sel.value=state.editorItems[i]?.inventory_item_id||'';sel.onchange=()=>{state.editorItems[i].inventory_item_id=sel.value||null;const row=(state.catalog?.inventory_items||[]).find(x=>String(x.id)===String(sel.value));state.editorItems[i].sku=row?.sku||null;if(!state.editorItems[i].unit)state.editorItems[i].unit=row?.unit||null;}});
    document.querySelectorAll('[data-v3b-inv]').forEach(sel=>{const i=Number(sel.dataset.v3bInv);sel.value=state.editorItems[i]?.inventory_item_id||'';sel.onchange=()=>{state.editorItems[i].inventory_item_id=sel.value||null;const row=(state.catalog?.inventory_items||[]).find(x=>String(x.id)===String(sel.value));state.editorItems[i].item_name=row?.name||null;state.editorItems[i].sku=row?.sku||null;state.editorItems[i].unit=row?.unit||null;}});
    document.querySelectorAll('[data-v3b-qty]').forEach(inp=>inp.oninput=()=>state.editorItems[Number(inp.dataset.v3bQty)].qty_requested=inp.value);
    document.querySelectorAll('[data-v3b-reason]').forEach(inp=>inp.oninput=()=>state.editorItems[Number(inp.dataset.v3bReason)].additional_reason=inp.value);
    document.querySelectorAll('[data-v3b-remove]').forEach(btn=>btn.onclick=()=>{state.editorItems.splice(Number(btn.dataset.v3bRemove),1);renderDetail()});
    $('#pxl-v3b-add-boq').onclick=()=>{state.editorItems.push({source_type:'boq',project_boq_item_id:null,inventory_item_id:null,qty_requested:1,additional_reason:null});renderDetail()};
    $('#pxl-v3b-add-extra').onclick=()=>{state.editorItems.push({source_type:'inventory_extra',inventory_item_id:null,qty_requested:1,additional_reason:''});renderDetail()};
    $('#pxl-v3b-save').onclick=()=>saveItems(false);
    $('#pxl-v3b-submit').onclick=()=>saveItems(true);
  }

  function validatedEditorItems(requireInventory=false){
    if(!state.editorItems.length)throw new Error('Minimal satu item MR Project wajib diisi.');
    return state.editorItems.map((item,index)=>{
      const qty=Number(item.qty_requested);if(!Number.isFinite(qty)||qty<=0)throw new Error(`Qty item baris ${index+1} harus lebih dari 0.`);
      if(item.source_type==='boq'&&!item.project_boq_item_id)throw new Error(`Pilih BOQ Project pada baris ${index+1}.`);
      if(requireInventory&&item.source_type==='boq'&&!item.inventory_item_id)throw new Error(`Mapping Inventory untuk BOQ baris ${index+1} wajib dipilih sebelum diajukan.`);
      if(item.source_type==='inventory_extra'&&!item.inventory_item_id)throw new Error(`Pilih Inventory pada baris ${index+1}.`);
      if(item.source_type==='inventory_extra'&&!String(item.additional_reason||'').trim())throw new Error(`Alasan material di luar BOQ baris ${index+1} wajib diisi.`);
      return {...item,qty_requested:qty,additional_reason:item.source_type==='inventory_extra'?String(item.additional_reason).trim():null};
    });
  }

  async function saveItems(andSubmit){
    if(state.busy)return;let items;
    try{items=validatedEditorItems(andSubmit)}catch(e){alert(e.message);return}
    state.busy=true;
    try{
      await request('PUT',`/project-material-requests/${encodeURIComponent(state.requestId)}/items`,{items});
      if(andSubmit)await request('POST',`/project-material-requests/${encodeURIComponent(state.requestId)}/submit`,{});
      await loadDetail(state.requestId);
    }catch(e){alert(e.message||'Gagal menyimpan MR Project.')}finally{state.busy=false}
  }

  async function createMr(){
    if(state.busy)return;state.busy=true;
    try{const created=await request('POST',`/projects/${encodeURIComponent(state.projectId)}/material-requests`,{});await open(state.projectId,created.id);}catch(e){alert(e.message||'Gagal membuat MR Project.')}finally{state.busy=false}
  }

  async function loadCatalog(){
    state.catalog=await request('GET',`/projects/${encodeURIComponent(state.projectId)}/material-request-catalog`);
    state.project=state.catalog.project||state.project;
  }
  async function loadDetail(requestId){
    const [mr]=await Promise.all([request('GET',`/project-material-requests/${encodeURIComponent(requestId)}`),state.catalog?Promise.resolve():loadCatalog()]);
    state.requestId=String(requestId);state.detail=mr;state.editorItems=(mr.items||[]).map(i=>({source_type:i.source_type,project_boq_item_id:i.project_boq_item_id||null,inventory_item_id:i.inventory_item_id||null,item_name:i.item_name_snapshot||null,sku:i.sku_snapshot||null,unit:i.unit_snapshot||null,qty_requested:Number(i.qty_requested),additional_reason:i.additional_reason||''}));renderDetail();
  }

  async function refresh(){
    if(!state.projectId)return;
    const body=$('#pxl-v3b-mr-body');if(body)body.innerHTML='<div class="pxl-v3b-mr-card pxl-v3b-mr-muted">Memuat MR Project...</div>';
    try{
      const [catalog,list]=await Promise.all([request('GET',`/projects/${encodeURIComponent(state.projectId)}/material-request-catalog`),request('GET',`/projects/${encodeURIComponent(state.projectId)}/material-requests`)]);
      state.catalog=catalog;state.project=catalog.project||null;state.list=Array.isArray(list)?list:[];
      if(state.requestId)await loadDetail(state.requestId);else renderList();
    }catch(e){if(body)body.innerHTML=`<div class="pxl-v3b-mr-error">${h(e.message||'Gagal memuat MR Project.')}</div>`}
  }

  async function open(projectId,requestId){
    if(!projectId)return false;ensureShell();state.projectId=String(projectId);state.requestId=requestId?String(requestId):null;state.detail=null;state.catalog=null;state.project=null;state.list=[];state.editorItems=[];$('#pxl-v3b-mr-modal').classList.add('show');await refresh();return true;
  }
  function close(){$('#pxl-v3b-mr-modal')?.classList.remove('show')}
  window.pxlProjectMr={revision:REV,open:open,refresh:refresh,close:close};
})();
