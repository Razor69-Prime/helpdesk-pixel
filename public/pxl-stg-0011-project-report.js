/* PXL-STG-0011 — Project Tracker > Project Report Detail BOQ. STAGING ONLY. */
(function(){
  'use strict';
  const REV='PXL-STG-0011';
  let rows=[], activeProjectId=null;
  const $=s=>document.querySelector(s);
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v)||0;
  const fmt=v=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(n(v));
  const pct=v=>`${n(v).toFixed(1)}%`;
  const localDate=()=>{const d=new Date(),p=x=>String(x).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
  const canDelete=()=>['superadmin','manager','admin'].includes(String((typeof currentUser!=='undefined'&&currentUser?.role)||'').toLowerCase());
  const current=()=>rows.find(r=>String(r.id)===String(activeProjectId));

  function style(){
    if($('#pxl-pr11-style'))return;
    const s=document.createElement('style');s.id='pxl-pr11-style';s.textContent=`
      .pxl-pr-subnav{display:flex;gap:8px;margin:-4px 0 14px;flex-wrap:wrap}.pxl-pr-subnav .btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
      #pxl-project-report{display:none}.pr11-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin-bottom:12px}.pr11-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px}.pr11-label{font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.06em}.pr11-value{font-size:22px;font-weight:800;margin-top:5px}.pr11-muted{font-size:11px;color:var(--muted)}
      .pr11-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.pr11-toolbar input{flex:1;min-width:220px}.pr11-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface)}.pr11-table{width:100%;border-collapse:collapse;min-width:1100px;font-size:12px}.pr11-table th{background:var(--surface2);padding:10px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase}.pr11-table td{padding:10px;border-top:1px solid var(--border);vertical-align:middle}.pr11-num{font-weight:700}.pr11-project{font-weight:800}.pr11-progress{height:7px;background:var(--surface2);border-radius:99px;overflow:hidden;min-width:95px}.pr11-progress span{display:block;height:100%;background:var(--accent);border-radius:99px}.pr11-progress.material span{background:#3b82f6}.pr11-progress.jasa span{background:#16a34a}
      .pr11-badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px}.pr11-badge{font-size:10px;border:1px solid var(--border);border-radius:99px;padding:2px 7px;background:var(--surface2)}.pr11-badge.mat{color:#2563eb}.pr11-badge.jasa{color:#15803d}.pr11-empty{text-align:center;padding:22px;color:var(--muted)}
      .pr11-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10020;align-items:flex-start;justify-content:center;padding:40px 20px;overflow:auto}.pr11-modal.show{display:flex}.pr11-dialog{width:min(1180px,96vw);background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25)}.pr11-dialog-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pr11-title{font-size:18px;font-weight:800}.pr11-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.pr11-summary>div{border:1px solid var(--border);border-radius:10px;padding:10px}.pr11-summary b{font-size:16px}.pr11-section-title{font-size:14px;font-weight:800;margin:18px 0 8px;display:flex;justify-content:space-between;align-items:center}.pr11-form{display:grid;grid-template-columns:120px 1fr 90px 100px 1fr 120px auto;gap:7px;align-items:end;padding:10px;background:var(--surface2);border-radius:10px}.pr11-form label{font-size:10px;color:var(--muted);display:block;margin-bottom:4px}.pr11-form input,.pr11-form select{width:100%}.pr11-detail{width:100%;border-collapse:collapse;font-size:11px;min-width:1050px}.pr11-detail th{background:var(--surface2);padding:8px;text-align:left;color:var(--muted);font-size:10px}.pr11-detail td{padding:8px;border-top:1px solid var(--border);vertical-align:middle}.pr11-today{width:72px!important;min-width:72px}.pr11-status{font-size:10px;border-radius:99px;padding:3px 7px;display:inline-block;border:1px solid var(--border)}.pr11-status.done{color:#15803d}.pr11-status.progress{color:#b45309}.pr11-status.not{color:var(--muted)}.pr11-error{display:none;background:#fee2e2;color:#991b1b;padding:8px 10px;border-radius:8px;margin:10px 0;font-size:11px}.pr11-history{margin-top:8px;padding:8px;border-radius:8px;background:var(--surface2)}.pr11-history-row{display:grid;grid-template-columns:100px 70px 1fr auto;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border)}.pr11-history-row:last-child{border:0}
      .proj-report-mini{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px}.proj-report-pill{font-size:9.5px;border:1px solid var(--border);border-radius:99px;padding:2px 6px;background:var(--surface2);font-weight:700}.proj-report-pill.mat{color:#2563eb}.proj-report-pill.jasa{color:#15803d}
      @media(max-width:800px){.pr11-grid,.pr11-summary{grid-template-columns:1fr 1fr}.pr11-form{grid-template-columns:1fr 1fr}.pr11-form>div:nth-child(2),.pr11-form>div:nth-child(5){grid-column:span 2}}
    `;document.head.appendChild(s);
  }

  function build(){
    style();
    const top=$('#tab-projects > div:first-child'); if(!top||$('#pxl-pr11-subnav'))return;
    const sub=document.createElement('div');sub.id='pxl-pr11-subnav';sub.className='pxl-pr-subnav';sub.innerHTML=`<button class="btn sm active" id="pr11-tab-tracker">📁 Project Tracker</button><button class="btn sm" id="pr11-tab-report">📊 Project Report</button>`;
    top.insertAdjacentElement('afterend',sub);
    const sec=document.createElement('div');sec.id='pxl-project-report';sec.innerHTML=`
      <div class="pr11-grid">
        <div class="pr11-card"><div class="pr11-label">TOTAL PROJECT</div><div class="pr11-value" id="pr11-total-project">0</div></div>
        <div class="pr11-card"><div class="pr11-label">TOTAL BOQ</div><div class="pr11-value" id="pr11-total-boq">0</div></div>
        <div class="pr11-card"><div class="pr11-label">TOTAL DONE</div><div class="pr11-value" id="pr11-total-done">0</div></div>
        <div class="pr11-card"><div class="pr11-label">OVERALL PROGRESS</div><div class="pr11-value" id="pr11-progress">0%</div></div>
      </div>
      <div class="pr11-card">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><div style="font-size:16px;font-weight:800">📊 Project Report</div><div class="pr11-muted">BOQ dihitung dari detail Material + Jasa. Achievement diinput per item.</div></div><span class="pr11-badge">${REV}</span></div>
        <div class="pr11-toolbar"><input id="pr11-search" placeholder="Cari project atau PIC..."><button class="btn sm" id="pr11-refresh">↻ Refresh</button></div>
        <div class="pr11-table-wrap"><table class="pr11-table"><thead><tr><th>Project</th><th>Total BOQ</th><th>Today</th><th>Total Done</th><th>Remain</th><th>Material</th><th>Jasa</th><th>Overall</th><th>Aksi</th></tr></thead><tbody id="pr11-body"></tbody></table></div>
      </div>`;
    sub.insertAdjacentElement('afterend',sec);
    document.body.insertAdjacentHTML('beforeend',`<div class="pr11-modal" id="pr11-modal"><div class="pr11-dialog">
      <div class="pr11-dialog-head"><div><div class="pr11-title" id="pr11-modal-title">Detail BOQ</div><div class="pr11-muted" id="pr11-modal-sub"></div></div><button class="btn ghost sm" id="pr11-close">✕</button></div>
      <div id="pr11-error" class="pr11-error"></div>
      <div class="pr11-summary"><div><div class="pr11-label">MATERIAL</div><b id="pr11-sum-mat">0%</b><div class="pr11-muted" id="pr11-sum-mat-sub"></div></div><div><div class="pr11-label">JASA</div><b id="pr11-sum-jasa">0%</b><div class="pr11-muted" id="pr11-sum-jasa-sub"></div></div><div><div class="pr11-label">PROJECT</div><b id="pr11-sum-all">0%</b><div class="pr11-muted" id="pr11-sum-all-sub"></div></div></div>
      <div class="pr11-section-title"><span>Tambah Detail BOQ</span></div>
      <div class="pr11-form">
        <div><label>Kategori</label><select id="pr11-cat"><option value="material">Material</option><option value="jasa">Jasa</option></select></div>
        <div><label>Nama Item / Jasa</label><input id="pr11-name" placeholder="Nama item atau pekerjaan"></div>
        <div><label>BOQ</label><input id="pr11-boq" type="number" min="0.01" step="0.01"></div>
        <div><label>Satuan</label><input id="pr11-unit" placeholder="unit/titik/m"></div>
        <div><label>Catatan</label><input id="pr11-notes" placeholder="Opsional"></div>
        <div><label>Status Override</label><select id="pr11-status"><option value="">Otomatis</option><option>Not Started</option><option>On Progress</option><option>Done</option></select></div>
        <button class="btn primary" id="pr11-add-item">+ Tambah</button>
      </div>
      <div id="pr11-detail-wrap"></div>
    </div></div>`);
    $('#pr11-tab-tracker').onclick=()=>show('tracker'); $('#pr11-tab-report').onclick=()=>show('report');
    $('#pr11-refresh').onclick=load; $('#pr11-search').oninput=render; $('#pr11-close').onclick=close;
    $('#pr11-modal').onclick=e=>{if(e.target.id==='pr11-modal')close()}; $('#pr11-add-item').onclick=addItem;
  }

  function show(which){
    const report=which==='report';
    $('#pr11-tab-tracker')?.classList.toggle('active',!report); $('#pr11-tab-report')?.classList.toggle('active',report);
    const list=$('#proj-list-section'),form=$('#proj-form-section'),sec=$('#pxl-project-report');
    if(sec)sec.style.display=report?'block':'none'; if(list)list.style.display=report?'none':'block'; if(form)form.style.display='none';
    if(report)load();
  }
  async function load(){
    const body=$('#pr11-body');if(body)body.innerHTML='<tr><td colspan="9" class="pr11-empty">Memuat Project Report...</td></tr>';
    try{rows=await api('GET','/project-reports');render();syncTracker();}
    catch(e){if(body)body.innerHTML=`<tr><td colspan="9" class="pr11-empty">Gagal memuat: ${h(e.message)}</td></tr>`;}
  }
  function filtered(){const q=String($('#pr11-search')?.value||'').toLowerCase().trim();return !q?rows:rows.filter(r=>String(r.nama_project||'').toLowerCase().includes(q)||String(r.pic||'').toLowerCase().includes(q));}
  function bar(value,kind=''){return `<div class="pr11-progress ${kind}"><span style="width:${Math.min(100,n(value))}%"></span></div><div class="pr11-muted">${pct(value)}</div>`}
  function render(){
    const list=filtered(),totalBoq=rows.reduce((s,r)=>s+n(r.total_boq),0),totalDone=rows.reduce((s,r)=>s+n(r.total_done),0),overall=totalBoq?totalDone/totalBoq*100:0;
    if($('#pr11-total-project'))$('#pr11-total-project').textContent=rows.length;if($('#pr11-total-boq'))$('#pr11-total-boq').textContent=fmt(totalBoq);if($('#pr11-total-done'))$('#pr11-total-done').textContent=fmt(totalDone);if($('#pr11-progress'))$('#pr11-progress').textContent=pct(overall);
    const body=$('#pr11-body');if(!body)return;if(!list.length){body.innerHTML='<tr><td colspan="9" class="pr11-empty">Belum ada project.</td></tr>';return;}
    body.innerHTML=list.map(r=>`<tr><td><div class="pr11-project">${h(r.nama_project||'-')}</div><div class="pr11-muted">PIC: ${h(r.pic||'-')} · ${(r.items||[]).length} detail</div></td><td class="pr11-num">${fmt(r.total_boq)}</td><td class="pr11-num">${fmt(r.today_achievement)}</td><td class="pr11-num">${fmt(r.total_done)}</td><td class="pr11-num">${fmt(r.remain)}</td><td>${bar(r.material_summary?.progress,'material')}<div class="pr11-muted">${fmt(r.material_summary?.total_done)}/${fmt(r.material_summary?.boq)}</div></td><td>${bar(r.jasa_summary?.progress,'jasa')}<div class="pr11-muted">${fmt(r.jasa_summary?.total_done)}/${fmt(r.jasa_summary?.boq)}</div></td><td>${bar(r.progress)}</td><td><button class="btn sm" data-pr11-open="${h(r.id)}">Detail BOQ</button></td></tr>`).join('');
    body.querySelectorAll('[data-pr11-open]').forEach(b=>b.onclick=()=>open(b.dataset.pr11Open));
  }
  function syncTracker(){
    window.pxlProjectReportSummaries={};rows.forEach(r=>window.pxlProjectReportSummaries[String(r.id)]={material:r.material_summary||{},jasa:r.jasa_summary||{},progress:r.progress||0});
    if(typeof renderProjectList==='function')renderProjectList();
  }
  function error(msg){const e=$('#pr11-error');if(!e)return;e.textContent=msg||'';e.style.display=msg?'block':'none'}
  function open(id){activeProjectId=id;const r=current();if(!r)return;$('#pr11-modal-title').textContent=r.nama_project||'Detail BOQ';$('#pr11-modal-sub').textContent=`Total BOQ ${fmt(r.total_boq)} · Done ${fmt(r.total_done)} · Remain ${fmt(r.remain)}`;error('');renderDetail();$('#pr11-modal').classList.add('show')}
  function close(){$('#pr11-modal')?.classList.remove('show');activeProjectId=null}
  function summaryText(s){return `${fmt(s?.total_done)}/${fmt(s?.boq)} · Remain ${fmt(s?.remain)}`}
  function statusClass(st){return st==='Done'?'done':st==='On Progress'?'progress':'not'}
  function renderDetail(){
    const r=current();if(!r)return;
    $('#pr11-sum-mat').textContent=pct(r.material_summary?.progress);$('#pr11-sum-mat-sub').textContent=summaryText(r.material_summary);
    $('#pr11-sum-jasa').textContent=pct(r.jasa_summary?.progress);$('#pr11-sum-jasa-sub').textContent=summaryText(r.jasa_summary);
    $('#pr11-sum-all').textContent=pct(r.progress);$('#pr11-sum-all-sub').textContent=`${fmt(r.total_done)}/${fmt(r.total_boq)} · Remain ${fmt(r.remain)}`;
    const wrap=$('#pr11-detail-wrap'),items=r.items||[];
    const group=(cat,label)=>{const list=items.filter(i=>String(i.category).toLowerCase()===cat);return `<div class="pr11-section-title"><span>${label} <span class="pr11-muted">(${list.length})</span></span></div><div class="pr11-table-wrap"><table class="pr11-detail"><thead><tr><th>No</th><th>Nama</th><th>BOQ</th><th>Today</th><th>Total Done</th><th>Remain</th><th>Progress</th><th>Status</th><th>Input Today</th><th>Aksi</th></tr></thead><tbody>${list.length?list.map((i,idx)=>itemRow(i,idx)).join(''):`<tr><td colspan="10" class="pr11-empty">Belum ada ${label.toLowerCase()}.</td></tr>`}</tbody></table></div>`};
    wrap.innerHTML=group('material','Material')+group('jasa','Jasa'); bindDetail();
  }
  function itemRow(i,idx){
    const today=(i.achievements||[]).filter(a=>String(a.achievement_date).slice(0,10)===localDate()).reduce((s,a)=>s+n(a.achievement),0);
    return `<tr><td>${idx+1}</td><td><b>${h(i.item_name)}</b>${i.unit?`<div class="pr11-muted">Satuan: ${h(i.unit)}</div>`:''}${i.notes?`<div class="pr11-muted">${h(i.notes)}</div>`:''}<div id="pr11-hist-${h(i.id)}"></div></td><td class="pr11-num">${fmt(i.boq_qty)}</td><td class="pr11-num">${fmt(today)}</td><td class="pr11-num">${fmt(i.total_done)}</td><td class="pr11-num">${fmt(i.remain)}</td><td>${bar(i.progress,i.category==='material'?'material':'jasa')}</td><td><span class="pr11-status ${statusClass(i.status)}">${h(i.status)}</span></td><td><div style="display:flex;gap:4px"><input class="pr11-today" type="number" min="0.01" step="0.01" id="pr11-ach-${h(i.id)}" placeholder="0"><button class="btn primary sm" data-pr11-ach="${h(i.id)}">+</button></div></td><td style="white-space:nowrap"><button class="btn ghost sm" data-pr11-history="${h(i.id)}">History</button> <button class="btn ghost sm" data-pr11-edit="${h(i.id)}">Edit</button>${canDelete()?` <button class="btn ghost sm" data-pr11-del="${h(i.id)}">Hapus</button>`:''}</td></tr>`
  }
  function bindDetail(){
    document.querySelectorAll('[data-pr11-ach]').forEach(b=>b.onclick=()=>addAchievement(b.dataset.pr11Ach));
    document.querySelectorAll('[data-pr11-history]').forEach(b=>b.onclick=()=>toggleHistory(b.dataset.pr11History));
    document.querySelectorAll('[data-pr11-edit]').forEach(b=>b.onclick=()=>editItem(b.dataset.pr11Edit));
    document.querySelectorAll('[data-pr11-del]').forEach(b=>b.onclick=()=>deleteItem(b.dataset.pr11Del));
  }
  async function addItem(){
    const r=current();if(!r)return;const payload={category:$('#pr11-cat').value,item_name:$('#pr11-name').value.trim(),boq_qty:Number($('#pr11-boq').value),unit:$('#pr11-unit').value.trim(),notes:$('#pr11-notes').value.trim(),status_override:$('#pr11-status').value};
    if(!payload.item_name){error('Nama item/jasa wajib diisi.');return}if(!Number.isFinite(payload.boq_qty)||payload.boq_qty<=0){error('BOQ wajib lebih dari 0.');return}error('');
    try{const u=await api('POST',`/project-reports/${encodeURIComponent(r.id)}/items`,payload);replace(u);$('#pr11-name').value='';$('#pr11-boq').value='';$('#pr11-unit').value='';$('#pr11-notes').value='';$('#pr11-status').value='';render();renderDetail();syncTracker();}
    catch(e){error(e.message||'Gagal menambah detail BOQ.')}
  }
  async function addAchievement(id){
    const r=current(),input=$(`#pr11-ach-${CSS.escape(String(id))}`),value=Number(input?.value);if(!r)return;if(!Number.isFinite(value)||value<=0){error('Achievement wajib lebih dari 0.');return}error('');
    try{const u=await api('POST',`/project-report-items/${encodeURIComponent(id)}/achievements`,{achievement:value,achievement_date:localDate()});replace(u);render();renderDetail();syncTracker();}
    catch(e){error(e.message||'Gagal menambah achievement.')}
  }
  function toggleHistory(id){
    const r=current(),item=(r?.items||[]).find(i=>String(i.id)===String(id)),box=$(`#pr11-hist-${CSS.escape(String(id))}`);if(!item||!box)return;if(box.innerHTML){box.innerHTML='';return}
    const hist=[...(item.achievements||[])].sort((a,b)=>String(b.achievement_date).localeCompare(String(a.achievement_date)));
    box.innerHTML=`<div class="pr11-history">${hist.length?hist.map(a=>`<div class="pr11-history-row"><b>${h(String(a.achievement_date).slice(0,10))}</b><span>+${fmt(a.achievement)}</span><span>${h(a.notes||'-')} <span class="pr11-muted">oleh ${h(a.created_by||'-')}</span></span><span><button class="btn ghost sm" data-pr11-editach="${h(a.id)}">Edit</button>${canDelete()?` <button class="btn ghost sm" data-pr11-delach="${h(a.id)}">Hapus</button>`:''}</span></div>`).join(''):'Belum ada history.'}</div>`;
    box.querySelectorAll('[data-pr11-editach]').forEach(b=>b.onclick=()=>editAchievement(b.dataset.pr11Editach));box.querySelectorAll('[data-pr11-delach]').forEach(b=>b.onclick=()=>deleteAchievement(b.dataset.pr11Delach));
  }
  async function editItem(id){
    const r=current(),i=(r?.items||[]).find(x=>String(x.id)===String(id));if(!i)return;
    const name=prompt('Nama item / jasa:',i.item_name);if(name===null)return;const boqRaw=prompt('BOQ:',String(i.boq_qty));if(boqRaw===null)return;const boq=Number(boqRaw);if(!name.trim()||!Number.isFinite(boq)||boq<=0){alert('Nama dan BOQ tidak valid.');return}
    const notes=prompt('Catatan:',i.notes||'');if(notes===null)return;const status=prompt('Status override (kosong=otomatis / Not Started / On Progress / Done):',i.status_override||'');if(status===null)return;
    try{const u=await api('PATCH',`/project-report-items/${encodeURIComponent(id)}`,{item_name:name.trim(),boq_qty:boq,notes,status_override:status.trim()});replace(u);render();renderDetail();syncTracker();}catch(e){alert('Gagal edit: '+(e.message||'Unknown error'))}
  }
  async function deleteItem(id){if(!confirm('Hapus detail BOQ ini? Seluruh history achievement item juga akan terhapus.'))return;try{await api('DELETE',`/project-report-items/${encodeURIComponent(id)}`);await load();activeProjectId=activeProjectId||null;if(current())renderDetail()}catch(e){alert('Gagal menghapus: '+(e.message||'Unknown error'))}}
  async function editAchievement(id){
    const r=current();let a=null;for(const i of (r?.items||[])){a=(i.achievements||[]).find(x=>String(x.id)===String(id));if(a)break}if(!a)return;const v=prompt('Achievement:',String(a.achievement));if(v===null)return;const num=Number(v);if(!Number.isFinite(num)||num<=0){alert('Achievement tidak valid.');return}const notes=prompt('Catatan:',a.notes||'');if(notes===null)return;
    try{const u=await api('PATCH',`/project-report-item-achievements/${encodeURIComponent(id)}`,{achievement:num,notes});replace(u);render();renderDetail();syncTracker();}catch(e){alert('Gagal edit: '+(e.message||'Unknown error'))}
  }
  async function deleteAchievement(id){if(!confirm('Hapus achievement ini? Progress akan dihitung ulang.'))return;try{await api('DELETE',`/project-report-item-achievements/${encodeURIComponent(id)}`);await load();if(current())renderDetail()}catch(e){alert('Gagal menghapus: '+(e.message||'Unknown error'))}}
  function replace(u){const i=rows.findIndex(r=>String(r.id)===String(u.id));if(i>=0)rows[i]=u;else rows.push(u)}
  function init(){build();setTimeout(load,600)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.pxlProjectReport={revision:REV,open:()=>show('report'),refresh:load};
})();
