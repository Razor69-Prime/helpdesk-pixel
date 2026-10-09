/* PXL-VNEXT-3A — Project Detail Core. */
(function(){
  'use strict';
  const REV='PXL-VNEXT-3A';
  const PDF_DAYS_PER_PAGE=31;
  const DAY_MS=24*60*60*1000;
  const state={projectId:null,data:null,activeTab:'overview',woSearchSeq:0,ganttLoadedProjectId:null,ganttDefaults:[],ganttStages:[],ganttStartDate:''};
  const $=s=>document.querySelector(s);
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v)||0;
  const pct=v=>`${n(v).toFixed(1)}%`;
  const money=v=>Number(v||0).toLocaleString('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0});
  const user=()=>typeof currentUser!=='undefined'?(currentUser||{}):{};
  const role=()=>String(user().role||'').toLowerCase().replace(/[ _-]/g,'');
  const customs=()=>Array.isArray(user().custom_menus)?user().custom_menus:[];
  const hasPermission=id=>role()==='superadmin'||customs().includes(id);
  const canBoq=()=>['manager','superadmin'].includes(role())||customs().includes('project_boq_manage');

  function ensureStyle(){
    if($('#pxl-v3a-style'))return;
    const style=document.createElement('style');
    style.id='pxl-v3a-style';
    style.textContent=`
      .pxl-v3a-modal{display:none;position:fixed;inset:0;z-index:10040;background:rgba(15,23,42,.52);padding:24px;overflow:auto;align-items:flex-start;justify-content:center}.pxl-v3a-modal.show{display:flex}
      .pxl-v3a-dialog{width:min(1180px,97vw);background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.24);overflow:hidden}.pxl-v3a-head{padding:18px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pxl-v3a-title{font-size:19px;font-weight:800}.pxl-v3a-sub{font-size:11px;color:var(--muted);margin-top:4px}
      .pxl-v3a-tabs{padding:10px 20px;border-bottom:1px solid var(--border);display:flex;gap:7px;overflow:auto}.pxl-v3a-tab{border:1px solid var(--border);background:var(--surface);padding:7px 11px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap}.pxl-v3a-tab.active{background:var(--accent-light);color:var(--accent);border-color:var(--accent)}
      .pxl-v3a-body{padding:20px}.pxl-v3a-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.pxl-v3a-card{border:1px solid var(--border);border-radius:12px;background:var(--surface2);padding:13px}.pxl-v3a-label{font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}.pxl-v3a-value{font-size:15px;font-weight:800;margin-top:5px;word-break:break-word}.pxl-v3a-muted{font-size:11px;color:var(--muted);line-height:1.45}.pxl-v3a-section{font-size:14px;font-weight:800;margin:18px 0 9px}.pxl-v3a-progress{height:8px;border-radius:99px;background:var(--border);overflow:hidden;margin-top:7px}.pxl-v3a-progress>span{display:block;height:100%;background:var(--accent)}
      .pxl-v3a-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:10px}.pxl-v3a-table{border-collapse:collapse;width:100%;min-width:760px;font-size:11px}.pxl-v3a-table th{background:var(--surface2);color:var(--muted);font-size:9.5px;text-transform:uppercase;text-align:left;padding:9px}.pxl-v3a-table td{border-top:1px solid var(--border);padding:9px;vertical-align:top}.pxl-v3a-toolbar{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}.pxl-v3a-placeholder{padding:28px;text-align:center;border:1px dashed var(--border);border-radius:12px;color:var(--muted);background:var(--surface2)}.pxl-v3a-error{background:var(--red-bg);color:var(--red);padding:10px 12px;border-radius:8px;margin-bottom:12px}.pxl-v3a-gantt-row{display:grid;grid-template-columns:36px minmax(180px,1.4fr) 90px 110px 110px minmax(150px,1fr) 110px;gap:6px;align-items:center;padding:7px;border-top:1px solid var(--border)}.pxl-v3a-gantt-row.header{font-size:9px;text-transform:uppercase;color:var(--muted);font-weight:800;background:var(--surface2);border-top:none}.pxl-v3a-gantt-row input{padding:7px;font-size:11px}.pxl-v3a-gantt-scroll{overflow:auto;border:1px solid var(--border);border-radius:10px}.pxl-v3a-gantt-scroll>div{min-width:900px}.pxl-v3a-stage-actions{display:flex;gap:3px;justify-content:flex-end}.pxl-v3a-stage-actions .btn{padding:4px 6px}
      @media(max-width:800px){.pxl-v3a-modal{padding:8px}.pxl-v3a-body{padding:13px}.pxl-v3a-head{padding:14px}.pxl-v3a-tabs{padding:8px 13px}.pxl-v3a-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:480px){.pxl-v3a-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureShell(){
    ensureStyle();
    if($('#pxl-v3a-modal'))return;
    document.body.insertAdjacentHTML('beforeend',`
      <div class="pxl-v3a-modal" id="pxl-v3a-modal">
        <div class="pxl-v3a-dialog">
          <div class="pxl-v3a-head"><div><div class="pxl-v3a-title" id="pxl-v3a-title">Project Detail</div><div class="pxl-v3a-sub" id="pxl-v3a-sub">${REV}</div></div><button class="btn ghost sm" id="pxl-v3a-close">✕</button></div>
          <div class="pxl-v3a-tabs">
            <button class="pxl-v3a-tab" data-v3a-tab="overview">Overview</button>
            <button class="pxl-v3a-tab" data-v3a-tab="boq">BOQ &amp; Report</button>
            <button class="pxl-v3a-tab" data-v3a-tab="gantt">Gantt Chart</button>
            <button class="pxl-v3a-tab" data-v3a-tab="work-order">Work Order</button>
          </div>
          <div class="pxl-v3a-body" id="pxl-v3a-body"></div>
        </div>
      </div>`);
    $('#pxl-v3a-close').onclick=close;
    $('#pxl-v3a-modal').addEventListener('click',e=>{if(e.target.id==='pxl-v3a-modal')close()});
    document.querySelectorAll('[data-v3a-tab]').forEach(btn=>btn.onclick=()=>{state.activeTab=btn.dataset.v3aTab;render()});
  }

  function progressCard(label,value,sub){
    const p=Math.max(0,Math.min(100,n(value)));
    return `<div class="pxl-v3a-card"><div class="pxl-v3a-label">${h(label)}</div><div class="pxl-v3a-value">${pct(p)}</div><div class="pxl-v3a-progress"><span style="width:${p}%"></span></div>${sub?`<div class="pxl-v3a-muted" style="margin-top:5px">${h(sub)}</div>`:''}</div>`;
  }

  function planPeriod(plan){
    const stages=Array.isArray(plan?.stages)?plan.stages:[];
    if(!stages.length)return 'Belum ada Gantt Plan';
    return `${stages[0].planned_start||plan.start_date||'-'} — ${stages[stages.length-1].planned_end||'-'}`;
  }

  function renderOverview(){
    const {project={},report={},primary_work_order:wo,gantt_plan:plan}=state.data||{};
    const material=report?.material_summary||{},jasa=report?.jasa_summary||{};
    const woText=wo?.unavailable?'WO tidak tersedia':(wo?.wo_number||'Belum dihubungkan');
    return `
      <div class="pxl-v3a-grid">
        <div class="pxl-v3a-card"><div class="pxl-v3a-label">PIC</div><div class="pxl-v3a-value">${h(project.pic||'—')}</div></div>
        <div class="pxl-v3a-card"><div class="pxl-v3a-label">Prioritas / Status</div><div class="pxl-v3a-value">${h(project.prioritas||'P2')} · ${h(project.status||'—')}</div></div>
        <div class="pxl-v3a-card"><div class="pxl-v3a-label">Target</div><div class="pxl-v3a-value">${h(project.target_week||'—')}</div></div>
        <div class="pxl-v3a-card"><div class="pxl-v3a-label">Primary WO</div><div class="pxl-v3a-value">${h(woText)}</div>${wo?.status?`<div class="pxl-v3a-muted">${h(wo.status)}</div>`:''}</div>
        <div class="pxl-v3a-card"><div class="pxl-v3a-label">Est. HPP</div><div class="pxl-v3a-value">${project.harga_pokok?money(project.harga_pokok):'—'}</div></div>
        <div class="pxl-v3a-card"><div class="pxl-v3a-label">Est. Omzet</div><div class="pxl-v3a-value">${project.omset?money(project.omset):'—'}</div></div>
        <div class="pxl-v3a-card"><div class="pxl-v3a-label">Gantt Plan</div><div class="pxl-v3a-value" style="font-size:12px">${h(planPeriod(plan))}</div></div>
        <div class="pxl-v3a-card"><div class="pxl-v3a-label">Total BOQ</div><div class="pxl-v3a-value">${h(report?.total_boq??0)}</div><div class="pxl-v3a-muted">Done ${h(report?.total_done??0)} · Remain ${h(report?.remain??0)}</div></div>
      </div>
      <div class="pxl-v3a-section">Progress Project</div>
      <div class="pxl-v3a-grid">
        ${progressCard('Material',material.progress,`${material.total_done||0}/${material.boq||0}`)}
        ${progressCard('Jasa',jasa.progress,`${jasa.total_done||0}/${jasa.boq||0}`)}
        ${progressCard('Overall',report?.progress||0,`Today ${report?.today_achievement||0}`)}
      </div>
      <div class="pxl-v3a-section">Update Terakhir</div>
      <div class="pxl-v3a-grid">
        <div class="pxl-v3a-card" style="grid-column:span 2"><div class="pxl-v3a-label">Issue</div><div class="pxl-v3a-value" style="font-size:12px">${h(project.issue||'—')}</div></div>
        <div class="pxl-v3a-card" style="grid-column:span 2"><div class="pxl-v3a-label">Action Plan</div><div class="pxl-v3a-value" style="font-size:12px">${h(project.action_plan||'—')}</div></div>
      </div>`;
  }

  function boqTable(items,category,label){
    const rows=(items||[]).filter(i=>String(i.category||'').toLowerCase()===category);
    return `<div class="pxl-v3a-section">${h(label)} (${rows.length})</div><div class="pxl-v3a-table-wrap"><table class="pxl-v3a-table"><thead><tr><th>No</th><th>Item</th><th>BOQ</th><th>Done</th><th>Remain</th><th>Progress</th><th>Status</th></tr></thead><tbody>${rows.length?rows.map((i,idx)=>`<tr><td>${idx+1}</td><td><b>${h(i.item_name||'-')}</b><div class="pxl-v3a-muted">${h(i.unit||'')}</div></td><td>${h(i.boq_qty)}</td><td>${h(i.total_done)}</td><td>${h(i.remain)}</td><td>${pct(i.progress)}</td><td>${h(i.status||'-')}</td></tr>`).join(''):'<tr><td colspan="7" style="text-align:center;color:var(--muted)">Belum ada BOQ.</td></tr>'}</tbody></table></div>`;
  }

  function renderBoq(){
    const report=state.data?.report||{};
    const items=Array.isArray(report.items)?report.items:[];
    const manage=canBoq()?'<button class="btn primary sm" id="pxl-v3a-manage-boq">Kelola BOQ</button>':'';
    setTimeout(()=>{const b=$('#pxl-v3a-manage-boq');if(b)b.onclick=openBoqProject},0);
    return `<div class="pxl-v3a-toolbar"><div><b>BOQ &amp; Project Report</b><div class="pxl-v3a-muted">Data read-only dari Project Report existing.</div></div>${manage}</div>${boqTable(items,'material','Material')}${boqTable(items,'jasa','Jasa')}`;
  }

  function parseGanttDate(value){
    const raw=String(value||'').trim();
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if(!m)throw new Error('Project Start Date wajib menggunakan format YYYY-MM-DD.');
    const y=Number(m[1]),mon=Number(m[2]),d=Number(m[3]);
    const stamp=Date.UTC(y,mon-1,d);
    const date=new Date(stamp);
    if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mon-1||date.getUTCDate()!==d)throw new Error('Project Start Date tidak valid.');
    return stamp;
  }

  function formatGanttDate(stamp){
    const d=new Date(stamp);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }

  function calculateBrowserGantt(startDate,stages){
    let cursor=parseGanttDate(startDate);
    if(!Array.isArray(stages)||!stages.length)throw new Error('Minimal 1 tahap Gantt wajib tersedia.');
    if(stages.length>100)throw new Error('Maksimal 100 tahap Gantt.');
    return stages.map((stage,index)=>{
      const name=String(stage?.name||'').trim();
      const duration=Number(stage?.duration_days);
      if(!name)throw new Error(`Nama tahap ke-${index+1} wajib diisi.`);
      if(!Number.isInteger(duration)||duration<1||duration>3650)throw new Error(`Durasi ${name} harus bilangan bulat 1 sampai 3650 hari.`);
      const plannedStart=cursor;
      const plannedEnd=plannedStart+((duration-1)*DAY_MS);
      cursor=plannedEnd+DAY_MS;
      return {...stage,name,duration_days:duration,sort_order:index,planned_start:formatGanttDate(plannedStart),planned_end:formatGanttDate(plannedEnd)};
    });
  }

  function initGanttEditor(result){
    const plan=result?.plan||null;
    state.ganttDefaults=Array.isArray(result?.default_stages)?result.default_stages:[];
    state.data.gantt_plan=plan;
    state.ganttStartDate=plan?.start_date||'';
    state.ganttStages=plan?.stages?.length
      ?plan.stages.map(s=>({name:s.name||'',duration_days:Number(s.duration_days)||1,notes:s.notes||''}))
      :(!result.plan?state.ganttDefaults.map(name=>({name,duration_days:1,notes:''})):[]);
  }

  async function loadGanttForEditor(){
    if(!state.projectId)return;
    try{
      const result=await api('GET',`/projects/${encodeURIComponent(state.projectId)}/gantt-plan`);
      state.ganttLoadedProjectId=state.projectId;
      initGanttEditor(result||{});
      if(state.activeTab==='gantt')render();
    }catch(e){
      state.ganttLoadedProjectId=state.projectId;
      const body=$('#pxl-v3a-body');
      if(body&&state.activeTab==='gantt')body.innerHTML=`<div class="pxl-v3a-error">${h(e.message||'Gagal memuat Gantt Plan.')}</div>`;
    }
  }

  function renderGanttRows(calculated,canManage){
    return `<div class="pxl-v3a-gantt-scroll"><div><div class="pxl-v3a-gantt-row header"><div>No</div><div>Tahap</div><div>Durasi</div><div>Plan Start</div><div>Plan Finish</div><div>Catatan</div><div>Aksi</div></div>${state.ganttStages.map((stage,index)=>{
      const c=calculated?.[index]||{};
      return `<div class="pxl-v3a-gantt-row" data-v3a-stage-row="${index}"><div>${index+1}</div><div>${canManage?`<input data-v3a-stage-field="name" data-index="${index}" value="${h(stage.name)}" maxlength="160">`:`<b>${h(stage.name)}</b>`}</div><div>${canManage?`<input type="number" min="1" max="3650" step="1" data-v3a-stage-field="duration_days" data-index="${index}" value="${h(stage.duration_days)}">`:`${h(stage.duration_days)} hari`}</div><div data-v3a-stage-period="start" data-index="${index}">${h(c.planned_start||'—')}</div><div data-v3a-stage-period="end" data-index="${index}">${h(c.planned_end||'—')}</div><div>${canManage?`<input data-v3a-stage-field="notes" data-index="${index}" value="${h(stage.notes||'')}" maxlength="500">`:h(stage.notes||'—')}</div><div>${canManage?`<div class="pxl-v3a-stage-actions"><button class="btn sm" data-v3a-stage-up="${index}" title="Naik">↑</button><button class="btn sm" data-v3a-stage-down="${index}" title="Turun">↓</button><button class="btn danger sm" data-v3a-stage-remove="${index}" title="Hapus">✕</button></div>`:'—'}</div></div>`;
    }).join('')}</div></div>`;
  }

  function renderGantt(){
    if(state.ganttLoadedProjectId!==state.projectId){
      setTimeout(loadGanttForEditor,0);
      return '<div class="pxl-v3a-placeholder">Memuat Gantt Plan...</div>';
    }
    const plan=state.data?.gantt_plan;
    const canManage=hasPermission('project_gantt_manage');
    let calculated=[];
    let validation='';
    if(state.ganttStartDate&&state.ganttStages.length){
      try{calculated=calculateBrowserGantt(state.ganttStartDate,state.ganttStages)}catch(e){validation=e.message}
    }
    const toolbar=`<div class="pxl-v3a-toolbar"><div><b>Gantt Plan</b><div class="pxl-v3a-muted">Hari kalender termasuk Sabtu/Minggu. Tahap berjalan sequential satu-per-satu.</div></div><div style="display:flex;gap:7px;flex-wrap:wrap">${plan?.stages?.length?'<button class="btn blue sm" id="pxl-v3a-gantt-pdf">Download PDF</button>':''}${canManage?'<button class="btn primary sm" id="pxl-v3a-gantt-save">Simpan Gantt Plan</button>':''}</div></div>`;
    const start=canManage?`<div class="pxl-v3a-card" style="margin-bottom:10px;max-width:360px"><label>Project Start Date</label><input type="date" id="pxl-v3a-gantt-start" value="${h(state.ganttStartDate)}"><div class="pxl-v3a-muted" style="margin-top:5px">Mengubah tanggal/durasi otomatis menggeser tahap berikutnya.</div></div>`:`<div class="pxl-v3a-card" style="margin-bottom:10px;max-width:360px"><div class="pxl-v3a-label">Project Start Date</div><div class="pxl-v3a-value">${h(plan?.start_date||'—')}</div></div>`;
    const actions=canManage?`<div style="margin-top:10px"><button class="btn sm" id="pxl-v3a-gantt-add">＋ Tambah Tahap</button><span class="pxl-v3a-muted" style="margin-left:8px">${state.ganttStages.length}/100 tahap</span></div>`:'';
    const status=`<div id="pxl-v3a-gantt-status" class="${validation?'pxl-v3a-error':'pxl-v3a-muted'}" style="margin-top:10px">${validation?h(validation):(calculated.length?`Plan: ${h(calculated[0].planned_start)} — ${h(calculated[calculated.length-1].planned_end)} · ${calculated.length} tahap`:'Belum ada Gantt Plan.')}</div>`;
    setTimeout(bindGanttActions,0);
    return toolbar+start+renderGanttRows(calculated,canManage)+actions+status;
  }

  function bindGanttActions(){
    const canManage=hasPermission('project_gantt_manage');
    const pdf=$('#pxl-v3a-gantt-pdf');if(pdf)pdf.onclick=downloadGanttPdf;
    if(!canManage)return;
    const start=$('#pxl-v3a-gantt-start');if(start)start.onchange=()=>{state.ganttStartDate=start.value;updateGanttPreview()};
    document.querySelectorAll('[data-v3a-stage-field]').forEach(input=>input.oninput=()=>{
      const i=Number(input.dataset.index),field=input.dataset.v3aStageField;
      if(!state.ganttStages[i])return;
      state.ganttStages[i][field]=field==='duration_days'?Number(input.value):input.value;
      updateGanttPreview();
    });
    document.querySelectorAll('[data-v3a-stage-up]').forEach(b=>b.onclick=()=>moveGanttStage(Number(b.dataset.v3aStageUp),-1));
    document.querySelectorAll('[data-v3a-stage-down]').forEach(b=>b.onclick=()=>moveGanttStage(Number(b.dataset.v3aStageDown),1));
    document.querySelectorAll('[data-v3a-stage-remove]').forEach(b=>b.onclick=()=>removeGanttStage(Number(b.dataset.v3aStageRemove)));
    const add=$('#pxl-v3a-gantt-add');if(add)add.onclick=addGanttStage;
    const save=$('#pxl-v3a-gantt-save');if(save)save.onclick=saveGanttPlan;
  }

  function updateGanttPreview(){
    const status=$('#pxl-v3a-gantt-status');
    try{
      const calculated=calculateBrowserGantt(state.ganttStartDate,state.ganttStages);
      calculated.forEach((row,index)=>{
        const a=document.querySelector(`[data-v3a-stage-period="start"][data-index="${index}"]`);
        const b=document.querySelector(`[data-v3a-stage-period="end"][data-index="${index}"]`);
        if(a)a.textContent=row.planned_start;if(b)b.textContent=row.planned_end;
      });
      if(status){status.className='pxl-v3a-muted';status.textContent=`Plan: ${calculated[0].planned_start} — ${calculated[calculated.length-1].planned_end} · ${calculated.length} tahap`;}
      return calculated;
    }catch(e){
      document.querySelectorAll('[data-v3a-stage-period]').forEach(el=>el.textContent='—');
      if(status){status.className='pxl-v3a-error';status.textContent=e.message;}
      return null;
    }
  }

  function moveGanttStage(index,delta){
    const to=index+delta;
    if(index<0||to<0||index>=state.ganttStages.length||to>=state.ganttStages.length)return;
    [state.ganttStages[index],state.ganttStages[to]]=[state.ganttStages[to],state.ganttStages[index]];
    render();
  }

  function removeGanttStage(index){
    if(state.ganttStages.length<=1){alert('Gantt Plan minimal memiliki 1 tahap.');return;}
    state.ganttStages.splice(index,1);render();
  }

  function addGanttStage(){
    if(state.ganttStages.length>=100){alert('Maksimal 100 tahap Gantt.');return;}
    state.ganttStages.push({name:'Tahap Baru',duration_days:1,notes:''});render();
  }

  async function saveGanttPlan(){
    if(!hasPermission('project_gantt_manage'))return;
    if(!updateGanttPreview())return;
    const btn=$('#pxl-v3a-gantt-save');if(btn)btn.disabled=true;
    try{
      const result=await api('PUT',`/projects/${encodeURIComponent(state.projectId)}/gantt-plan`,{start_date:state.ganttStartDate,stages:state.ganttStages.map(s=>({name:String(s.name||'').trim(),duration_days:Number(s.duration_days),notes:String(s.notes||'').trim()}))});
      state.data.gantt_plan=result.plan;
      initGanttEditor(result||{});
      render();
    }catch(e){alert(e.message||'Gagal menyimpan Gantt Plan.');if(btn)btn.disabled=false;}
  }

  function downloadGanttPdf(){
    const plan=state.data?.gantt_plan;
    if(!plan?.stages?.length)return;
    const jsPDF=window.jspdf?.jsPDF;
    if(!jsPDF){alert('Library PDF belum tersedia. Muat ulang halaman dan coba kembali.');return;}
    const stages=plan.stages;
    const first=parseGanttDate(stages[0].planned_start);
    const last=parseGanttDate(stages[stages.length-1].planned_end);
    const totalDays=Math.floor((last-first)/DAY_MS)+1;
    const datePages=Math.ceil(totalDays/PDF_DAYS_PER_PAGE);
    const STAGES_PER_PDF_PAGE=18;
    const stagePages=Math.ceil(stages.length/STAGES_PER_PDF_PAGE);
    const totalPages=datePages*stagePages;
    const project=state.data?.project||{};
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const pageW=doc.internal.pageSize.getWidth();
    const margin=9,labelW=62,chartX=margin+labelW,chartW=pageW-margin-chartX,rowH=8,top=38;
    let pageNo=0;
    for(let datePage=0;datePage<datePages;datePage++){
      const pageStart=first+(datePage*PDF_DAYS_PER_PAGE*DAY_MS);
      const pageEnd=Math.min(last,pageStart+((PDF_DAYS_PER_PAGE-1)*DAY_MS));
      const daysThisPage=Math.floor((pageEnd-pageStart)/DAY_MS)+1;
      for(let stagePage=0;stagePage<stagePages;stagePage++){
        if(pageNo>0)doc.addPage();pageNo++;
        doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('PROJECT TIMELINE',margin,12);
        doc.setFontSize(10);doc.text(String(project.nama_project||'Project'),margin,18);
        doc.setFont('helvetica','normal');doc.setFontSize(8);
        doc.text(`Plan: ${stages[0].planned_start} - ${stages[stages.length-1].planned_end}`,margin,23);
        doc.text(`Generated: ${new Date().toLocaleString('id-ID')}`,margin,27);
        doc.text(`Page ${pageNo}/${totalPages}`,pageW-margin-22,12);
        doc.setFont('helvetica','bold');doc.text('Tahap',margin,34);
        const cellW=chartW/PDF_DAYS_PER_PAGE;
        for(let d=0;d<daysThisPage;d++){
          const stamp=pageStart+(d*DAY_MS),x=chartX+(d*cellW);
          const date=new Date(stamp);
          doc.setFontSize(6);doc.text(String(date.getUTCDate()),x+(cellW/2),34,{align:'center'});
          doc.line(x,35,x,top+(Math.min(STAGES_PER_PDF_PAGE,stages.length-(stagePage*STAGES_PER_PDF_PAGE))*rowH));
        }
        doc.line(chartX+(daysThisPage*cellW),35,chartX+(daysThisPage*cellW),top+(Math.min(STAGES_PER_PDF_PAGE,stages.length-(stagePage*STAGES_PER_PDF_PAGE))*rowH));
        const from=stagePage*STAGES_PER_PDF_PAGE,to=Math.min(stages.length,from+STAGES_PER_PDF_PAGE);
        for(let i=from;i<to;i++){
          const local=i-from,y=top+(local*rowH),stage=stages[i];
          doc.setFont('helvetica','normal');doc.setFontSize(7);
          const label=doc.splitTextToSize(String(stage.name||'-'),labelW-4);doc.text(label.slice(0,2),margin,y+4);
          doc.line(margin,y+rowH,pageW-margin,y+rowH);
          const s=parseGanttDate(stage.planned_start),e=parseGanttDate(stage.planned_end);
          const overlapStart=Math.max(s,pageStart),overlapEnd=Math.min(e,pageEnd);
          if(overlapStart<=overlapEnd){
            const startIndex=Math.floor((overlapStart-pageStart)/DAY_MS);
            const dayCount=Math.floor((overlapEnd-overlapStart)/DAY_MS)+1;
            const barX=chartX+(startIndex*cellW)+0.5,barW=Math.max(1,(dayCount*cellW)-1);
            doc.rect(barX,y+2,barW,4,'F');
          }
        }
      }
    }
    const safe=String(project.nama_project||'Project').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'Project';
    doc.save(`Gantt-${safe}.pdf`);
  }

  function renderWorkOrder(){
    const wo=state.data?.primary_work_order;
    const canManage=hasPermission('project_primary_wo_manage');
    const unavailable=wo?.unavailable===true;
    const hasWo=!!(wo&&(wo.wo_number||wo.ticket_id));
    const summary=hasWo?`
      <div class="pxl-v3a-card" style="margin-bottom:12px">
        <div class="pxl-v3a-toolbar"><div><div class="pxl-v3a-label">Primary WO</div><div class="pxl-v3a-value">${h(unavailable?'WO tidak tersedia':wo.wo_number||wo.ticket_id)}</div></div><div style="display:flex;gap:7px;flex-wrap:wrap">${wo?.wo_number?'<button class="btn blue sm" id="pxl-v3a-open-wo">Buka di Daftar WO</button>':''}${canManage?'<button class="btn danger sm" id="pxl-v3a-unlink-wo">Lepas Primary WO</button>':''}</div></div>
        ${unavailable?'<div class="pxl-v3a-error" style="margin:8px 0 0">WO tidak tersedia. Relasi tersimpan dan dapat dilepas oleh user berizin.</div>':`<div class="pxl-v3a-grid"><div><div class="pxl-v3a-label">Customer</div><div class="pxl-v3a-value" style="font-size:12px">${h(wo.customer_name||'—')}</div></div><div><div class="pxl-v3a-label">Project WO</div><div class="pxl-v3a-value" style="font-size:12px">${h(wo.project_name||'—')}</div></div><div><div class="pxl-v3a-label">Tipe</div><div class="pxl-v3a-value" style="font-size:12px">${h(wo.work_order_type||'—')}</div></div><div><div class="pxl-v3a-label">Status</div><div class="pxl-v3a-value" style="font-size:12px">${h(wo.status||'—')}</div></div></div>`}
      </div>`:'<div class="pxl-v3a-placeholder" style="margin-bottom:12px"><b>Belum ada Primary WO.</b><br><span class="pxl-v3a-muted">Project Phase 3A hanya menggunakan satu Primary WO.</span></div>';
    const manage=canManage?`
      <div class="pxl-v3a-card"><div class="pxl-v3a-toolbar"><div><b>${hasWo?'Pilih/Ganti Primary WO':'Pilih Primary WO'}</b><div class="pxl-v3a-muted">Cari WO existing berdasarkan nomor WO, customer, atau nama project.</div></div></div>
      <input id="pxl-v3a-wo-search" placeholder="Cari WO existing..." autocomplete="off">
      <div id="pxl-v3a-wo-results" style="margin-top:8px"></div></div>`:'';
    setTimeout(bindWorkOrderActions,0);
    return summary+manage;
  }

  function bindWorkOrderActions(){
    const wo=state.data?.primary_work_order;
    const openBtn=$('#pxl-v3a-open-wo');
    if(openBtn&&wo?.wo_number)openBtn.onclick=()=>openTicketInList(wo.wo_number);
    const unlinkBtn=$('#pxl-v3a-unlink-wo');
    if(unlinkBtn)unlinkBtn.onclick=unlinkPrimaryWorkOrder;
    const search=$('#pxl-v3a-wo-search');
    if(search){
      let timer=null;
      search.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>searchWoOptions(search.value),180)};
      searchWoOptions('');
    }
  }

  async function searchWoOptions(query){
    if(!hasPermission('project_primary_wo_manage')||!state.projectId)return;
    const results=$('#pxl-v3a-wo-results');
    if(!results)return;
    const seq=++state.woSearchSeq;
    results.innerHTML='<div class="pxl-v3a-muted">Mencari WO...</div>';
    try{
      const rows=await api('GET',`/projects/${encodeURIComponent(state.projectId)}/work-order-options?q=${encodeURIComponent(String(query||'').trim())}`);
      if(seq!==state.woSearchSeq||!$('#pxl-v3a-wo-results'))return;
      results.innerHTML=(rows||[]).length?(rows||[]).map(row=>`<div class="pxl-v3a-card" style="margin-bottom:6px;padding:9px"><div class="pxl-v3a-toolbar" style="margin:0"><div><b>${h(row.wo_number||row.id)}</b><div class="pxl-v3a-muted">${h(row.customer_name||'-')} · ${h(row.project_name||'-')} · ${h(row.work_order_type||'-')} · ${h(row.status||'-')}</div></div><button class="btn primary sm" data-v3a-link-wo="${h(row.id)}">Pilih</button></div></div>`).join(''):'<div class="pxl-v3a-muted">WO tidak ditemukan.</div>';
      results.querySelectorAll('[data-v3a-link-wo]').forEach(btn=>btn.onclick=()=>linkPrimaryWorkOrder(btn.dataset.v3aLinkWo));
    }catch(e){
      if(seq===state.woSearchSeq&&results)results.innerHTML=`<div class="pxl-v3a-error">${h(e.message||'Gagal mencari WO.')}</div>`;
    }
  }

  async function linkPrimaryWorkOrder(ticketId){
    if(!hasPermission('project_primary_wo_manage')||!ticketId)return;
    try{
      await api('PUT',`/projects/${encodeURIComponent(state.projectId)}/primary-work-order`,{ticket_id:ticketId});
      await refresh();
    }catch(e){ alert(e.message||'Gagal menghubungkan Primary WO.'); }
  }

  async function unlinkPrimaryWorkOrder(){
    if(!hasPermission('project_primary_wo_manage')||!state.projectId)return;
    if(!confirm('Lepas Primary WO dari project ini? WO tidak akan dihapus atau diubah.'))return;
    try{
      await api('DELETE',`/projects/${encodeURIComponent(state.projectId)}/primary-work-order`);
      await refresh();
    }catch(e){ alert(e.message||'Gagal melepas Primary WO.'); }
  }

  function openTicketInList(woNumber){
    if(!woNumber)return;
    close();
    const nav=document.querySelector('.nav-btn[data-tab-id="tickets"]');
    if(nav&&typeof switchTab==='function')switchTab('tickets',nav);
    const search=document.getElementById('t-search');
    if(search)search.value=woNumber;
    if(typeof resetTicketListPage==='function')resetTicketListPage();
  }

  function render(){
    if(!state.data)return;
    const project=state.data.project||{};
    $('#pxl-v3a-title').textContent=project.nama_project||'Project Detail';
    $('#pxl-v3a-sub').textContent=`${project.prioritas||'P2'} · ${project.status||'-'} · ${REV}`;
    document.querySelectorAll('[data-v3a-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.v3aTab===state.activeTab));
    const body=$('#pxl-v3a-body');
    body.innerHTML=state.activeTab==='overview'?renderOverview():state.activeTab==='boq'?renderBoq():state.activeTab==='gantt'?renderGantt():renderWorkOrder();
  }

  async function refresh(){
    if(!state.projectId)return;
    const body=$('#pxl-v3a-body');
    if(body)body.innerHTML='<div class="pxl-v3a-placeholder">Memuat Project Detail...</div>';
    try{
      state.data=await api('GET',`/projects/${encodeURIComponent(state.projectId)}/detail`);
      render();
    }catch(e){
      if(body)body.innerHTML=`<div class="pxl-v3a-error">${h(e.message||'Gagal memuat Project Detail.')}</div>`;
    }
  }

  async function open(projectId){
    if(!projectId)return;
    ensureShell();
    state.projectId=String(projectId);
    state.activeTab='overview';
    state.data=null;
    state.ganttLoadedProjectId=null;state.ganttDefaults=[];state.ganttStages=[];state.ganttStartDate='';
    $('#pxl-v3a-modal').classList.add('show');
    await refresh();
  }

  function close(){
    $('#pxl-v3a-modal')?.classList.remove('show');
  }

  async function openBoqProject(){
    if(!canBoq()||!state.projectId)return;
    close();
    if(window.pxlProjectReport?.openBoqProject) await window.pxlProjectReport.openBoqProject(state.projectId);
  }

  window.pxlProjectVnext3A={revision:REV,open:open,refresh:refresh,close:close,hasPermission};
})();
