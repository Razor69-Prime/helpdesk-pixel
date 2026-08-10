/* PXL-STG-0010 — Project Tracker > Project Report. STAGING ONLY. */
(function(){
  'use strict';
  const REV='PXL-STG-0010';
  let rows=[];
  let activeProjectId=null;
  const $=s=>document.querySelector(s);
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v)||0;
  const fmt=v=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(n(v));
  const localDate=()=>{
    const d=new Date(), pad=x=>String(x).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };
  function canDelete(){
    const role=String((typeof currentUser!=='undefined'&&currentUser?.role)||'').toLowerCase();
    return ['superadmin','manager','admin'].includes(role);
  }
  function style(){
    if($('#pxl-pr-style'))return;
    const s=document.createElement('style');s.id='pxl-pr-style';s.textContent=`
      .pxl-pr-subnav{display:flex;gap:8px;margin:-4px 0 14px;flex-wrap:wrap}.pxl-pr-subnav .btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
      #pxl-project-report{display:none}.pr10-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin-bottom:12px}.pr10-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px}.pr10-label{font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.06em}.pr10-value{font-size:22px;font-weight:800;margin-top:5px}.pr10-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.pr10-toolbar input{flex:1;min-width:220px}.pr10-table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface)}.pr10-table{width:100%;border-collapse:collapse;min-width:930px;font-size:12px}.pr10-table th{background:var(--surface2);color:var(--muted);text-align:left;padding:10px;border-bottom:1px solid var(--border);white-space:nowrap}.pr10-table td{padding:11px 10px;border-bottom:1px solid var(--border);vertical-align:middle}.pr10-table tr:last-child td{border-bottom:0}.pr10-project{font-weight:700}.pr10-muted{font-size:11px;color:var(--muted);margin-top:2px}.pr10-progress{width:150px;height:8px;border-radius:99px;overflow:hidden;background:var(--surface2);margin-bottom:4px}.pr10-progress>span{display:block;height:100%;background:var(--accent);border-radius:99px}.pr10-num{font-variant-numeric:tabular-nums;font-weight:700}.pr10-complete{color:#15803D}.pr10-remain{color:#B45309}.pr10-actions{display:flex;gap:5px;flex-wrap:wrap}.pr10-empty{padding:28px;text-align:center;color:var(--muted)}
      .pr10-modal{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:10050;display:none;align-items:center;justify-content:center;padding:16px}.pr10-modal.show{display:flex}.pr10-dialog{background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:680px;width:100%;max-height:88vh;overflow:auto;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.25)}.pr10-dialog-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}.pr10-dialog-title{font-weight:800;font-size:16px}.pr10-form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pr10-history{margin-top:16px;border-top:1px solid var(--border);padding-top:12px}.pr10-hrow{display:grid;grid-template-columns:110px 90px 1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px dashed var(--border);font-size:12px}.pr10-hrow:last-child{border-bottom:0}.pr10-error{display:none;color:#B91C1C;background:#FEE2E2;border-radius:8px;padding:9px;margin:8px 0;font-size:12px}.pr10-badge{display:inline-block;padding:3px 8px;border-radius:99px;font-size:10px;font-weight:700;background:var(--surface2);color:var(--muted)}
      @media(max-width:760px){.pr10-grid{grid-template-columns:1fr 1fr}.pr10-form-row{grid-template-columns:1fr}.pr10-hrow{grid-template-columns:90px 70px 1fr}.pr10-hrow .pr10-h-actions{grid-column:1/-1}.pr10-progress{width:110px}}
    `;document.head.appendChild(s);
  }
  function build(){
    const tab=$('#tab-projects'); if(!tab||$('#pxl-project-report'))return;
    style();
    const top=tab.firstElementChild;
    const sub=document.createElement('div');sub.className='pxl-pr-subnav';sub.innerHTML=`<button class="btn sm active" id="pr10-tab-tracker">📁 Project Tracker</button><button class="btn sm" id="pr10-tab-report">📊 Project Report</button>`;
    top.insertAdjacentElement('afterend',sub);
    const sec=document.createElement('div');sec.id='pxl-project-report';sec.innerHTML=`
      <div class="pr10-grid">
        <div class="pr10-card"><div class="pr10-label">TOTAL PROJECT</div><div class="pr10-value" id="pr10-total-project">0</div></div>
        <div class="pr10-card"><div class="pr10-label">TOTAL BOQ</div><div class="pr10-value" id="pr10-total-boq">0</div></div>
        <div class="pr10-card"><div class="pr10-label">TOTAL DONE</div><div class="pr10-value" id="pr10-total-done">0</div></div>
        <div class="pr10-card"><div class="pr10-label">OVERALL PROGRESS</div><div class="pr10-value" id="pr10-progress">0%</div></div>
      </div>
      <div class="pr10-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div><div style="font-size:16px;font-weight:800">📊 Project Report</div><div class="pr10-muted">Total BOQ → Today Achievement → Total Done → Remain. Project otomatis mengikuti Project Tracker.</div></div><span class="pr10-badge">${REV}</span></div>
        <div class="pr10-toolbar"><input id="pr10-search" placeholder="Cari project atau PIC..."><button class="btn sm" id="pr10-refresh">↻ Refresh</button></div>
        <div class="pr10-table-wrap"><table class="pr10-table"><thead><tr><th>Project</th><th>Total BOQ</th><th>Today Achievement</th><th>Total Done</th><th>Remain</th><th>Progress</th><th>Aksi</th></tr></thead><tbody id="pr10-body"></tbody></table></div>
      </div>`;
    sub.insertAdjacentElement('afterend',sec);
    document.body.insertAdjacentHTML('beforeend',`<div class="pr10-modal" id="pr10-modal"><div class="pr10-dialog"><div class="pr10-dialog-head"><div><div class="pr10-dialog-title" id="pr10-modal-title">Project Report</div><div class="pr10-muted" id="pr10-modal-sub"></div></div><button class="btn ghost sm" id="pr10-close">✕</button></div><div id="pr10-error" class="pr10-error"></div><div class="pr10-form-row"><div class="form-group"><label>Total BOQ</label><input id="pr10-boq" type="number" min="0.01" step="0.01" placeholder="Total item + jasa"></div><div class="form-group"><label>Tanggal Achievement</label><input id="pr10-date" type="date"></div></div><div class="pr10-form-row"><div class="form-group"><label>Today Achievement</label><input id="pr10-ach" type="number" min="0.01" step="0.01" placeholder="Pencapaian hari ini"></div><div class="form-group"><label>Catatan</label><input id="pr10-notes" placeholder="Opsional"></div></div><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" id="pr10-save-boq">Simpan BOQ</button><button class="btn primary" id="pr10-add-ach">+ Tambah Achievement</button></div><div class="pr10-history"><div style="font-weight:800;margin-bottom:6px">History Achievement</div><div id="pr10-history"></div></div></div></div>`);
    $('#pr10-tab-tracker').onclick=()=>show('tracker'); $('#pr10-tab-report').onclick=()=>show('report');
    $('#pr10-refresh').onclick=load; $('#pr10-search').oninput=render;
    $('#pr10-close').onclick=close; $('#pr10-modal').onclick=e=>{if(e.target.id==='pr10-modal')close()};
    $('#pr10-save-boq').onclick=saveBoq; $('#pr10-add-ach').onclick=addAchievement;
  }
  function show(which){
    const report=which==='report';
    $('#pr10-tab-tracker')?.classList.toggle('active',!report); $('#pr10-tab-report')?.classList.toggle('active',report);
    const list=$('#proj-list-section'), form=$('#proj-form-section'), sec=$('#pxl-project-report');
    if(sec) sec.style.display=report?'block':'none';
    if(list) list.style.display=report?'none':'block';
    if(form) form.style.display='none';
    if(report) load();
  }
  async function load(){
    const body=$('#pr10-body'); if(body)body.innerHTML='<tr><td colspan="7" class="pr10-empty">Memuat Project Report...</td></tr>';
    try{ rows=await api('GET','/project-reports'); render(); }
    catch(e){ if(body)body.innerHTML=`<tr><td colspan="7" class="pr10-empty">Gagal memuat: ${h(e.message)}</td></tr>`; }
  }
  function filtered(){const q=String($('#pr10-search')?.value||'').toLowerCase().trim();return !q?rows:rows.filter(r=>String(r.nama_project||'').toLowerCase().includes(q)||String(r.pic||'').toLowerCase().includes(q));}
  function render(){
    const list=filtered(), totalBoq=rows.reduce((s,r)=>s+n(r.total_boq),0), totalDone=rows.reduce((s,r)=>s+n(r.total_done),0), overall=totalBoq?Math.min(100,totalDone/totalBoq*100):0;
    if($('#pr10-total-project'))$('#pr10-total-project').textContent=rows.length; if($('#pr10-total-boq'))$('#pr10-total-boq').textContent=fmt(totalBoq); if($('#pr10-total-done'))$('#pr10-total-done').textContent=fmt(totalDone); if($('#pr10-progress'))$('#pr10-progress').textContent=`${overall.toFixed(1)}%`;
    const body=$('#pr10-body'); if(!body)return;
    if(!list.length){body.innerHTML='<tr><td colspan="7" class="pr10-empty">Belum ada project.</td></tr>';return;}
    body.innerHTML=list.map(r=>`<tr><td><div class="pr10-project">${h(r.nama_project||'-')}</div><div class="pr10-muted">PIC: ${h(r.pic||'-')} · ${h(r.status||'-')}</div></td><td class="pr10-num">${r.total_boq?fmt(r.total_boq):'<span class="pr10-muted">Belum diisi</span>'}</td><td class="pr10-num">${fmt(r.today_achievement)}</td><td class="pr10-num pr10-complete">${fmt(r.total_done)}</td><td class="pr10-num pr10-remain">${fmt(r.remain)}</td><td><div class="pr10-progress"><span style="width:${Math.min(100,n(r.progress))}%"></span></div><span class="pr10-muted">${n(r.progress).toFixed(1)}%</span></td><td><div class="pr10-actions"><button class="btn sm" data-pr10-open="${h(r.id)}">Detail / Input</button></div></td></tr>`).join('');
    body.querySelectorAll('[data-pr10-open]').forEach(b=>b.onclick=()=>open(b.dataset.pr10Open));
  }
  function current(){return rows.find(r=>String(r.id)===String(activeProjectId));}
  function open(id){activeProjectId=id; const r=current(); if(!r)return; $('#pr10-modal-title').textContent=r.nama_project||'Project Report'; $('#pr10-modal-sub').textContent=`Total Done ${fmt(r.total_done)} · Remain ${fmt(r.remain)} · Progress ${n(r.progress).toFixed(1)}%`; $('#pr10-boq').value=r.total_boq||''; $('#pr10-date').value=localDate(); $('#pr10-ach').value=''; $('#pr10-notes').value=''; error(''); history(r); $('#pr10-modal').classList.add('show');}
  function close(){$('#pr10-modal')?.classList.remove('show');activeProjectId=null;}
  function error(msg){const e=$('#pr10-error');if(!e)return;e.textContent=msg||'';e.style.display=msg?'block':'none';}
  function history(r){
    const box=$('#pr10-history');if(!box)return; const hist=[...(r.achievements||[])].sort((a,b)=>String(b.achievement_date).localeCompare(String(a.achievement_date))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
    box.innerHTML=hist.length?hist.map(a=>`<div class="pr10-hrow"><div><b>${h(String(a.achievement_date||'').slice(0,10))}</b></div><div class="pr10-num">+${fmt(a.achievement)}</div><div><div>${h(a.notes||'-')}</div><div class="pr10-muted">oleh ${h(a.created_by||'-')}</div></div><div class="pr10-h-actions"><button class="btn ghost sm" data-pr10-edit="${h(a.id)}">Edit</button>${canDelete()?` <button class="btn ghost sm" data-pr10-del="${h(a.id)}">Hapus</button>`:''}</div></div>`).join(''):'<div class="pr10-empty">Belum ada history achievement.</div>';
    box.querySelectorAll('[data-pr10-edit]').forEach(b=>b.onclick=()=>editAchievement(b.dataset.pr10Edit)); box.querySelectorAll('[data-pr10-del]').forEach(b=>b.onclick=()=>deleteAchievement(b.dataset.pr10Del));
  }
  async function saveBoq(){
    const r=current(), value=Number($('#pr10-boq').value); if(!r)return; if(!Number.isFinite(value)||value<=0){error('Total BOQ wajib lebih dari 0.');return;} error('');
    try{const updated=await api('PUT',`/project-reports/${encodeURIComponent(r.id)}/boq`,{total_boq:value}); replace(updated); render(); open(r.id);}
    catch(e){error(e.message||'Gagal menyimpan BOQ.');}
  }
  async function addAchievement(){
    const r=current(), value=Number($('#pr10-ach').value), date=$('#pr10-date').value||localDate(), notes=$('#pr10-notes').value.trim(); if(!r)return; if(!Number.isFinite(value)||value<=0){error('Today Achievement wajib lebih dari 0.');return;} error('');
    try{const updated=await api('POST',`/project-reports/${encodeURIComponent(r.id)}/achievements`,{achievement:value,achievement_date:date,notes}); replace(updated); render(); open(r.id);}
    catch(e){error(e.message||'Gagal menambah achievement.');}
  }
  async function editAchievement(id){
    const r=current(), a=(r?.achievements||[]).find(x=>String(x.id)===String(id)); if(!a)return;
    const value=prompt('Achievement:',String(a.achievement)); if(value===null)return; const num=Number(value); if(!Number.isFinite(num)||num<=0){alert('Achievement wajib lebih dari 0.');return;}
    const notes=prompt('Catatan:',a.notes||''); if(notes===null)return;
    try{const updated=await api('PATCH',`/project-report-achievements/${encodeURIComponent(id)}`,{achievement:num,notes}); replace(updated); render(); open(r.id);}
    catch(e){alert('Gagal edit: '+(e.message||'Unknown error'));}
  }
  async function deleteAchievement(id){
    const r=current(); if(!r||!confirm('Hapus history achievement ini? Total Done akan dihitung ulang.'))return;
    try{await api('DELETE',`/project-report-achievements/${encodeURIComponent(id)}`); await load(); open(r.id);}
    catch(e){alert('Gagal menghapus: '+(e.message||'Unknown error'));}
  }
  function replace(updated){const i=rows.findIndex(r=>String(r.id)===String(updated.id));if(i>=0)rows[i]=updated;else rows.push(updated);}
  function init(){build();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.pxlProjectReport={revision:REV,open:()=>show('report'),refresh:load};
})();
