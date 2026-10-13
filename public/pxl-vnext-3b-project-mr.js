/* PXL-VNEXT-3D1 — Project Material Request manual-item hotfix */
(function(){
  'use strict';
  const REV='PXL-VNEXT-3D1';
  const state={projectId:null,requestId:null,project:null,catalog:null,list:[],detail:null,editorItems:[],busy:false};
  const $=s=>document.querySelector(s);
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const user=()=>typeof currentUser!=='undefined'?(currentUser||{}):{};
  const role=()=>String(user().role||'').toLowerCase().replace(/[ _-]/g,'');
  const customs=()=>Array.isArray(user().custom_menus)?user().custom_menus:[];
  const editable=mr=>['draft','rejected'].includes(String(mr?.status||'').toLowerCase());
  const approvedLike=mr=>['approved','issued','final'].includes(String(mr?.status||'').toLowerCase());
  const statusLabels={draft:'Draft',submitted:'Diajukan',approved:'Approved',rejected:'Rejected',issued:'Approved (Legacy)',final:'Approved (Legacy)'};

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
      .pxl-v3b-mr-dialog{width:min(1180px,98vw);background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.25)}.pxl-v3b-mr-head{padding:16px 18px;border-bottom:1px solid var(--border);display:flex;gap:12px;justify-content:space-between}.pxl-v3b-mr-body{padding:18px}.pxl-v3b-mr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.pxl-v3b-mr-card{border:1px solid var(--border);border-radius:10px;padding:11px;background:var(--surface2)}.pxl-v3b-mr-label{font-size:9px;text-transform:uppercase;color:var(--muted);font-weight:800}.pxl-v3b-mr-value{font-size:13px;font-weight:800;margin-top:4px}.pxl-v3b-mr-muted{font-size:11px;color:var(--muted)}.pxl-v3b-mr-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}.pxl-v3b-mr-list{display:grid;gap:8px}.pxl-v3b-mr-row{border:1px solid var(--border);border-radius:10px;padding:11px;background:var(--surface);display:flex;gap:10px;justify-content:space-between;align-items:center}.pxl-v3b-mr-status{font-size:10px;border:1px solid var(--border);border-radius:99px;padding:3px 7px;font-weight:800}.pxl-v3b-mr-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:10px}.pxl-v3b-mr-table{width:100%;border-collapse:collapse;min-width:650px;font-size:11px}.pxl-v3b-mr-table th{background:var(--surface2);font-size:9px;text-transform:uppercase;color:var(--muted);padding:8px;text-align:left}.pxl-v3b-mr-table td{padding:8px;border-top:1px solid var(--border);vertical-align:top}.pxl-v3b-mr-error{background:var(--red-bg);color:var(--red);padding:9px;border-radius:8px;margin-bottom:10px}.pxl-v3b-mr-section{font-weight:800;font-size:13px;margin:16px 0 8px}.pxl-v3b-mr-actions{display:flex;gap:7px;flex-wrap:wrap}.pxl-v3b-search{position:relative}.pxl-v3b-search input{width:100%;box-sizing:border-box}.pxl-v3b-results{display:none;margin-top:4px;border:1px solid var(--border);border-radius:8px;background:var(--surface);max-height:220px;overflow:auto}.pxl-v3b-results.show{display:block}.pxl-v3b-result{display:block;width:100%;padding:8px 10px;border:0;border-bottom:1px solid var(--border);background:var(--surface);text-align:left;cursor:pointer;color:inherit}.pxl-v3b-result:last-child{border-bottom:0}.pxl-v3b-result:active{background:var(--surface2)}.pxl-v3b-selected{margin-top:4px;font-size:10px;color:var(--muted)}
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
    const canCreate=['technician','superadmin'].includes(role())||customs().includes('project_mr_create');
    body.innerHTML=projectHeader()+`<div class="pxl-v3b-mr-toolbar"><div><b>Daftar MR Project</b><div class="pxl-v3b-mr-muted">MR Project untuk material BOQ atau item manual pada Primary WO Project.</div></div><div class="pxl-v3b-mr-actions"><button class="btn sm" id="pxl-v3b-mr-refresh">↻ Refresh</button>${canCreate?'<button class="btn primary sm" id="pxl-v3b-mr-create">＋ Buat MR Project</button>':''}</div></div><div class="pxl-v3b-mr-list">${state.list.length?state.list.map(m=>`<div class="pxl-v3b-mr-row"><div><b>${h(m.mr_number||'MR Project')}</b><div class="pxl-v3b-mr-muted">${h(m.created_by||'-')} · ${h(String(m.created_at||'').slice(0,16).replace('T',' '))}</div></div><div class="pxl-v3b-mr-actions"><span class="pxl-v3b-mr-status">${h(statusLabels[m.status]||m.status||'-')}</span><button class="btn sm" data-v3b-mr-open="${h(m.id)}">Buka</button></div></div>`).join(''):'<div class="pxl-v3b-mr-card pxl-v3b-mr-muted">Belum ada MR Project.</div>'}</div>`;
    $('#pxl-v3b-mr-refresh').onclick=refresh;
    $('#pxl-v3b-mr-create')?.addEventListener('click',createMr);
    body.querySelectorAll('[data-v3b-mr-open]').forEach(b=>b.onclick=()=>open(state.projectId,b.dataset.v3bMrOpen));
  }

  const normalizeMaterialSearch=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
  function boqById(id){return (state.catalog?.boq_items||[]).find(x=>String(x.id)===String(id))||null}
  function filterBoqForQuery(query){
    const q=normalizeMaterialSearch(query),rows=state.catalog?.boq_items||[];
    if(!q)return rows.slice(0,20);
    const tokens=q.split(/\s+/).filter(Boolean);
    return rows.map(item=>{const text=normalizeMaterialSearch([item?.item_name,item?.unit].filter(Boolean).join(' ')),matched=tokens.reduce((n,t)=>n+(text.includes(t)?1:0),0),score=(text.includes(q)?100:0)+(matched*10);return {item,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(a.item?.item_name||'').localeCompare(String(b.item?.item_name||''),'id',{numeric:true})).slice(0,20).map(x=>x.item);
  }
  function boqSearchBox(item,index){
    const boq=boqById(item.project_boq_item_id),query=item.boq_search??boq?.item_name??item.item_name??'';
    const selectedText=boq?`BOQ: ${h(boq.item_name||'-')}`:'Cari lalu pilih material dari BOQ Project.';
    return `<div class="pxl-v3b-search"><input data-v3b-boq-search="${index}" autocomplete="off" value="${h(query)}" placeholder="Cari material BOQ Project..."><div class="pxl-v3b-results" data-v3b-boq-results="${index}"></div><div class="pxl-v3b-selected">${selectedText}</div></div>`;
  }
  function renderBoqSearchResults(index,query){
    const item=state.editorItems[index],box=document.querySelector(`[data-v3b-boq-results="${index}"]`);if(!item||!box)return;
    const matches=filterBoqForQuery(query);
    box.innerHTML=(item.project_boq_item_id?`<button type="button" class="pxl-v3b-result" data-v3b-reset-boq="${index}">↩ Ganti BOQ Project</button>`:'')+(matches.length?matches.map(i=>`<button type="button" class="pxl-v3b-result" data-v3b-boq-result="${h(i.id)}"><b>${h(i.item_name||'-')}</b><div class="pxl-v3b-mr-muted">BOQ Project${i.unit?` · ${h(i.unit)}`:''}</div></button>`).join(''):'<div class="pxl-v3b-mr-muted" style="padding:9px">Material BOQ tidak ditemukan.</div>');
    box.classList.add('show');
    box.querySelector('[data-v3b-reset-boq]')?.addEventListener('mousedown',e=>{e.preventDefault();resetBoqSearch(index)});
    box.querySelectorAll('[data-v3b-boq-result]').forEach(btn=>btn.onmousedown=e=>{e.preventDefault();selectBoqSearchResult(index,btn.dataset.v3bBoqResult)});
  }
  function selectBoqSearchResult(index,boqId){
    const item=state.editorItems[index],row=boqById(boqId);if(!item||!row)return;
    item.project_boq_item_id=row.id;item.item_name=row.item_name||null;item.unit=row.unit||null;item.boq_search=row.item_name||'';renderDetail();
  }
  function resetBoqSearch(index){
    const item=state.editorItems[index];if(!item)return;
    item.project_boq_item_id=null;item.item_name=null;item.unit=null;item.boq_search='';renderDetail();
    setTimeout(()=>document.querySelector(`[data-v3b-boq-search="${index}"]`)?.focus(),0);
  }

  function editorRow(item,index){
    const materialCell=item.source_type==='manual'
      ?`<div><input data-v3b-manual-name="${index}" value="${h(item.item_name||'')}" placeholder="Nama material manual"><input data-v3b-manual-unit="${index}" value="${h(item.unit||'')}" placeholder="Satuan (opsional)" style="margin-top:5px"><div class="pxl-v3b-selected">Manual · tidak menambah ledger Input Today sampai material memiliki BOQ Project.</div></div>`
      :boqSearchBox(item,index);
    return `<tr><td>${index+1}</td><td>${materialCell}</td><td><input type="number" min="0.01" step="0.01" data-v3b-qty="${index}" value="${h(item.qty_requested||'')}"></td><td><button class="btn danger sm" data-v3b-remove="${index}">Hapus</button></td></tr>`;
  }
  function readOnlyRows(items){
    return (items||[]).map((i,index)=>`<tr><td>${index+1}</td><td><b>${h(i.item_name_snapshot||i.item_name||'-')}</b><div class="pxl-v3b-mr-muted">${h(i.source_type==='boq'?'BOQ Project':i.source_type==='manual'?'Manual':'Legacy Material')} · ${h(i.unit_snapshot||i.unit||'')}</div></td><td><b>${h(i.qty_requested||0)}</b></td></tr>`).join('');
  }

  function canApprove(mr){return String(mr?.status||'')==='submitted'&&(['superadmin','manager','admin'].includes(role())||customs().includes('project_mr_approve'))}
  function renderApproval(mr){
    if(!canApprove(mr))return '';
    return `<div class="pxl-v3b-mr-section">Approval MR Project</div><div class="pxl-v3b-mr-card"><div class="pxl-v3b-mr-muted" style="margin-bottom:8px">Item dan Qty bersifat read-only. Jika perlu perubahan, Reject lalu pembuat MR mengedit dan submit ulang.</div><div class="pxl-v3b-mr-actions"><button class="btn green sm" id="pxl-v3b-approve">Approve</button><button class="btn danger sm" id="pxl-v3b-reject">Reject</button><input id="pxl-v3b-reject-reason" placeholder="Alasan reject (opsional)" style="max-width:320px"></div></div>`;
  }
  function renderAudit(mr){
    const movements=Array.isArray(mr?.movements)?mr.movements:[],history=Array.isArray(mr?.history)?mr.history:[];
    if(!movements.length&&!history.length)return '';
    const oldRows=movements.map(x=>`<div class="pxl-v3b-mr-row"><div><b>${h(String(x.movement_type||'').toUpperCase())}</b><div class="pxl-v3b-mr-muted">Qty ${h(x.qty||0)} · ${h(x.performed_by||'-')}</div></div><div class="pxl-v3b-mr-muted">${h(String(x.performed_at||'').slice(0,16).replace('T',' '))}</div></div>`).join('');
    const historyRows=history.map(x=>`<div class="pxl-v3b-mr-row"><div><b>${h(x.event_type||'-')}</b><div class="pxl-v3b-mr-muted">${h(x.from_status||'-')} → ${h(x.to_status||'-')} · ${h(x.actor||'-')}</div></div><div class="pxl-v3b-mr-muted">${h(String(x.created_at||'').slice(0,16).replace('T',' '))}</div></div>`).join('');
    return `<div class="pxl-v3b-mr-section">History MR Project</div><div class="pxl-v3b-mr-list">${oldRows}${historyRows}</div>`;
  }

  async function approveMr(){if(state.busy)return;state.busy=true;try{state.detail=await request('POST',`/project-material-requests/${encodeURIComponent(state.requestId)}/approve`,{});renderDetail()}catch(e){alert(e.message||'Approve MR Project gagal.')}finally{state.busy=false}}
  async function rejectMr(){if(state.busy)return;const reason=String($('#pxl-v3b-reject-reason')?.value||'').trim();state.busy=true;try{state.detail=await request('POST',`/project-material-requests/${encodeURIComponent(state.requestId)}/reject`,{reason});renderDetail()}catch(e){alert(e.message||'Reject MR Project gagal.')}finally{state.busy=false}}
  function bindReadOnly(){
    $('#pxl-v3b-approve')?.addEventListener('click',approveMr);
    $('#pxl-v3b-reject')?.addEventListener('click',rejectMr);
  }

  function renderDetail(){
    const body=$('#pxl-v3b-mr-body');if(!body)return;
    const mr=state.detail||{},isEditable=editable(mr),released=approvedLike(mr);
    const rejectNote=mr.status==='rejected'?`<div class="pxl-v3b-mr-error"><b>Rejected</b>${mr.reject_reason?`: ${h(mr.reject_reason)}`:' — tanpa catatan.'}</div>`:'';
    let content=projectHeader()+rejectNote+`<div class="pxl-v3b-mr-toolbar"><div><div class="pxl-v3b-mr-muted">Nomor MR Project</div><div style="font-size:17px;font-weight:800">${h(mr.mr_number||'—')}</div></div><div class="pxl-v3b-mr-actions"><span class="pxl-v3b-mr-status">${h(statusLabels[mr.status]||mr.status||'-')}</span><button class="btn sm" id="pxl-v3b-mr-back">← Daftar MR</button></div></div>`;
    if(isEditable){
      content+=`<div class="pxl-v3b-mr-section">Material Request</div><div class="pxl-v3b-mr-muted" style="margin-bottom:8px">Pilih material dari BOQ Project atau tambahkan item manual. Item manual tercatat di MR/approval, namun tidak menambah allowance ledger Input Today sebelum material tersebut memiliki BOQ Project.</div><div class="pxl-v3b-mr-table-wrap"><table class="pxl-v3b-mr-table"><thead><tr><th>No</th><th>Material</th><th>Qty Requested</th><th>Aksi</th></tr></thead><tbody>${state.editorItems.length?state.editorItems.map(editorRow).join(''):'<tr><td colspan="4" class="pxl-v3b-mr-muted">Belum ada item.</td></tr>'}</tbody></table></div><div class="pxl-v3b-mr-actions" style="margin-top:10px"><button class="btn sm" id="pxl-v3b-add-boq">＋ Tambah dari BOQ Project</button><button class="btn sm" id="pxl-v3b-add-manual">＋ Tambah Item Manual</button><button class="btn primary sm" id="pxl-v3b-save">Simpan</button><button class="btn green sm" id="pxl-v3b-submit">Simpan &amp; Ajukan MR Project</button></div>`;
    }else{
      const releasedInfo=released?'<div class="pxl-v3b-mr-card" style="margin-bottom:10px"><b>Material approved/released for Project</b><div class="pxl-v3b-mr-muted" style="margin-top:4px">Qty Approved sama dengan Qty Requested. Pemakaian real material dicatat melalui Project Report → Input Today.</div></div>':'';
      content+=`${releasedInfo}<div class="pxl-v3b-mr-section">Item — Read Only</div><div class="pxl-v3b-mr-table-wrap"><table class="pxl-v3b-mr-table"><thead><tr><th>No</th><th>Material</th><th>${released?'Qty Approved':'Qty Requested'}</th></tr></thead><tbody>${readOnlyRows(mr.items)||'<tr><td colspan="3">Belum ada item.</td></tr>'}</tbody></table></div>${renderApproval(mr)}${renderAudit(mr)}`;
    }
    body.innerHTML=content;
    $('#pxl-v3b-mr-back').onclick=()=>{state.requestId=null;state.detail=null;renderList()};
    if(isEditable)bindEditor();else bindReadOnly();
  }

  function bindEditor(){
    document.querySelectorAll('[data-v3b-boq-search]').forEach(input=>{const i=Number(input.dataset.v3bBoqSearch);input.onfocus=()=>renderBoqSearchResults(i,input.value);input.oninput=()=>{const item=state.editorItems[i];item.boq_search=input.value;if(item.project_boq_item_id){item.project_boq_item_id=null;item.item_name=null;item.unit=null}renderBoqSearchResults(i,input.value)};input.onblur=()=>setTimeout(()=>document.querySelector(`[data-v3b-boq-results="${i}"]`)?.classList.remove('show'),180)});
    document.querySelectorAll('[data-v3b-manual-name]').forEach(inp=>inp.oninput=()=>state.editorItems[Number(inp.dataset.v3bManualName)].item_name=inp.value);
    document.querySelectorAll('[data-v3b-manual-unit]').forEach(inp=>inp.oninput=()=>state.editorItems[Number(inp.dataset.v3bManualUnit)].unit=inp.value);
    document.querySelectorAll('[data-v3b-qty]').forEach(inp=>inp.oninput=()=>state.editorItems[Number(inp.dataset.v3bQty)].qty_requested=inp.value);
    document.querySelectorAll('[data-v3b-remove]').forEach(btn=>btn.onclick=()=>{state.editorItems.splice(Number(btn.dataset.v3bRemove),1);renderDetail()});
    $('#pxl-v3b-add-boq').onclick=()=>{state.editorItems.push({source_type:'boq',project_boq_item_id:null,boq_search:'',qty_requested:1,item_name:null,unit:null});renderDetail();setTimeout(()=>document.querySelector(`[data-v3b-boq-search="${state.editorItems.length-1}"]`)?.focus(),0)};
    $('#pxl-v3b-add-manual').onclick=()=>{state.editorItems.push({source_type:'manual',project_boq_item_id:null,qty_requested:1,item_name:'',unit:''});renderDetail();setTimeout(()=>document.querySelector(`[data-v3b-manual-name="${state.editorItems.length-1}"]`)?.focus(),0)};
    $('#pxl-v3b-save').onclick=()=>saveItems(false);
    $('#pxl-v3b-submit').onclick=()=>saveItems(true);
  }

  function validatedEditorItems(){
    if(!state.editorItems.length)throw new Error('Minimal satu item MR Project wajib diisi.');
    return state.editorItems.map((item,index)=>{
      const qty=Number(item.qty_requested);if(!Number.isFinite(qty)||qty<=0)throw new Error(`Qty item baris ${index+1} harus lebih dari 0.`);
      if(item.source_type==='manual'){
        const name=String(item.item_name||'').trim();if(!name)throw new Error(`Nama material manual baris ${index+1} wajib diisi.`);
        return {source_type:'manual',project_boq_item_id:null,item_name:name,unit:String(item.unit||'').trim()||null,qty_requested:qty,sort_order:index};
      }
      if(!item.project_boq_item_id)throw new Error(`Pilih BOQ Project pada baris ${index+1}.`);
      return {source_type:'boq',project_boq_item_id:item.project_boq_item_id,item_name:item.item_name||null,unit:item.unit||null,qty_requested:qty,sort_order:index};
    });
  }

  async function saveItems(andSubmit){
    if(state.busy)return;let items;
    try{items=validatedEditorItems()}catch(e){alert(e.message);return}
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
    state.requestId=String(requestId);state.detail=mr;
    state.editorItems=(mr.items||[]).map(i=>i.source_type==='boq'
      ?{source_type:'boq',project_boq_item_id:i.project_boq_item_id||null,boq_search:i.item_name_snapshot||'',item_name:i.item_name_snapshot||null,unit:i.unit_snapshot||null,qty_requested:Number(i.qty_requested)}
      :{source_type:'manual',project_boq_item_id:null,item_name:i.item_name_snapshot||'',unit:i.unit_snapshot||'',qty_requested:Number(i.qty_requested)});
    renderDetail();
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
