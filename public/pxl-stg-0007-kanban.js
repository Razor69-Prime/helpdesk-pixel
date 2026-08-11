/* PXL-STG-0007G — halaman Kanban mandiri; tidak mengubah Daftar Teknisi. */
(function(){
  'use strict';
  const state={tickets:[],technicians:[],canEdit:false,weekStart:null,view:'kanban',snapshot:new Map(),open:false};
  const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const pad=n=>String(n).padStart(2,'0');
  const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const monday=d=>{const x=new Date(d),day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x;};
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
  const techLabel=x=>typeof x==='object'?(x.name||x.username||x.email||x.id):x;
  const contentHost=()=>qs('.app-content')||qs('#app-content');
  const endTime=t=>{if(!t.scheduled_start_time)return'-';const[h,m]=t.scheduled_start_time.split(':').map(Number),v=h*60+m+Number(t.estimated_duration_minutes||60);return`${pad(Math.floor(v/60)%24)}:${pad(v%60)}`;};
  async function api(url,opt={}){const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request gagal');return d;}

  function closeKanban(){
    if(!state.open)return;
    const page=qs('#pxlKanbanPage');
    if(page){page.hidden=true;page.style.display='none';}
    state.snapshot.forEach((display,node)=>{if(node&&node.isConnected)node.style.display=display;});
    state.snapshot.clear();state.open=false;
    qsa('[data-k7-nav]').forEach(b=>b.classList.remove('active'));
  }

  async function openKanban(e){
    e?.preventDefault();e?.stopPropagation();
    const host=contentHost();if(!host)return;
    let page=host.querySelector('#pxlKanbanPage')||document.getElementById('pxlKanbanPage');
    if(!page){install();page=host.querySelector('#pxlKanbanPage')||document.getElementById('pxlKanbanPage');}
    if(!page)return;
    if(!state.open){
      state.snapshot.clear();
      [...host.children].forEach(node=>{if(node===page)return;state.snapshot.set(node,node.style.display);node.style.display='none';});
    }
    state.open=true;page.hidden=false;page.style.display='block';
    qsa('.sidebar .nav-btn').forEach(b=>b.classList.remove('active'));
    qsa('[data-k7-nav]').forEach(b=>b.classList.add('active'));
    try{await load(page);}catch(err){const body=qs('#k7Body');if(body)body.innerHTML=`<div class="alert error show">${esc(err.message)}</div>`;else console.error('[PXL-STG-0020A] Kanban body belum tersedia',err);}
  }

  function install(){
    const host=contentHost();if(!host)return;
    let page=qs('#pxlKanbanPage');
    if(!page){
      page=document.createElement('section');page.id='pxlKanbanPage';page.hidden=true;page.style.display='none';
      page.innerHTML=`<style>
      #pxlKanbanPage{width:100%;padding:0}.k7-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.k7-head h2{margin-right:auto}.k7-tabs{display:flex;gap:6px}.k7-board{display:flex;gap:10px;overflow-x:auto;padding-bottom:12px}.k7-col{min-width:270px;max-width:310px;background:var(--surface2,#f3f2ef);border:1px solid var(--border,#ddd8cf);border-radius:10px;padding:9px}.k7-col-head{display:flex;justify-content:space-between;font-weight:700;margin-bottom:8px}.k7-drop{min-height:120px}.k7-card{background:var(--surface,#fff);border:1px solid var(--border,#dedad2);border-radius:8px;padding:9px;margin-bottom:7px}.k7-card[draggable="true"]{cursor:grab}.k7-card.dragging{opacity:.45}.k7-wo{font-weight:700}.k7-meta{font-size:11px;color:var(--muted,#6f6b64);margin-top:3px}.k7-priority-urgent{border-left:4px solid #a32d2d}.k7-priority-high{border-left:4px solid #e07b39}.k7-late{color:#a32d2d;font-weight:700}.k7-capacity{display:grid;grid-template-columns:repeat(7,minmax(190px,1fr));gap:8px;overflow-x:auto}.k7-day,.k7-kpi-card{border:1px solid var(--border,#ddd8cf);border-radius:9px;padding:11px;background:var(--surface,#fff)}.k7-free{font-size:11px;color:#3b6d11;margin-top:5px}.k7-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px}.k7-edit{margin-top:7px}.k7-edit .btn{padding:4px 7px;font-size:10px}@media(max-width:600px){.k7-board{scroll-snap-type:x mandatory}.k7-col{min-width:86vw;scroll-snap-align:start}}
      </style><div class="k7-head"><h2>Kanban & Jadwal Teknisi</h2><button class="btn" id="k7Prev">‹ Minggu</button><button class="btn" id="k7Today">Hari Ini</button><button class="btn" id="k7Next">Minggu ›</button><div class="k7-tabs"><button class="btn" data-k7view="kanban">Kanban</button><button class="btn" data-k7view="calendar">Jadwal</button><button class="btn" data-k7view="kpi">KPI</button></div></div><div id="k7Range" class="sub" style="margin-bottom:10px"></div><div id="k7Body"></div>`;
      host.appendChild(page);bindPage();
    }
    installMenu();bindOtherMenus();
  }

  function installMenu(){
    const sidebar=qs('.sidebar');if(!sidebar)return;
    qsa('[data-k7-nav]').forEach((b,i)=>{if(i>0)b.remove();});
    let b=qs('[data-k7-nav]');
    if(!b){b=document.createElement('button');b.type='button';b.className='nav-btn';b.dataset.k7Nav='1';b.innerHTML='<span>🗓️</span><span class="nav-label">Kanban Teknisi</span>';sidebar.appendChild(b);}
    b.onclick=openKanban;
  }

  function bindOtherMenus(){
    qsa('.sidebar .nav-btn:not([data-k7-nav])').forEach(b=>{if(b.dataset.k7gBound)return;b.dataset.k7gBound='1';b.addEventListener('click',closeKanban,true);});
  }

  function bindPage(){
    qs('#k7Prev').onclick=()=>{state.weekStart=addDays(state.weekStart,-7);load();};
    qs('#k7Next').onclick=()=>{state.weekStart=addDays(state.weekStart,7);load();};
    qs('#k7Today').onclick=()=>{state.weekStart=monday(new Date());load();};
    qsa('[data-k7view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.k7view;render();});
  }

  async function load(pageArg){
    const page=pageArg||document.getElementById('pxlKanbanPage');if(!page)throw new Error('Halaman Kanban belum siap.');
    const range=page.querySelector('#k7Range');if(!range)throw new Error('Komponen rentang Kanban belum siap.');
    state.weekStart=state.weekStart||monday(new Date());const end=addDays(state.weekStart,6);
    range.textContent=`${state.weekStart.toLocaleDateString('id-ID')} – ${end.toLocaleDateString('id-ID')}`;
    const d=await api(`/api/technician-kanban?date_from=${ymd(state.weekStart)}&date_to=${ymd(end)}`);
    state.tickets=d.tickets||[];state.technicians=d.technicians||[];state.canEdit=!!d.can_edit;render();
  }

  function card(t){const tech=(t.technicians||[]).map(techLabel).filter(Boolean).join(', ')||'Belum ada teknisi';return`<article class="k7-card k7-priority-${esc(t.schedule_priority)}" draggable="${state.canEdit}" data-id="${esc(t.id)}"><div class="k7-wo">${esc(t.wo_number||'-')}</div><div>${esc(t.project_name||'-')}</div><div class="k7-meta">${esc(t.customer_name||'-')} · ${esc(t.location||'-')}</div><div class="k7-meta">👷 ${esc(tech)}</div><div class="k7-meta">🕒 ${esc(t.scheduled_start_time||'-')}–${esc(endTime(t))} · ${esc(t.estimated_duration_minutes)} menit</div><div class="k7-meta">Status: ${esc(t.status||'-')}${t.is_late?' · <span class="k7-late">Terlambat</span>':''}${t.mr_status?` · MR ${esc(t.mr_status)}`:''}</div>${state.canEdit?`<div class="k7-edit"><button class="btn" data-k7-edit="${esc(t.id)}">Edit Jadwal</button></div>`:''}</article>`;}
  function renderKanban(){const days=[...Array(7)].map((_,i)=>addDays(state.weekStart,i));return`<div class="k7-board">${days.map(d=>{const date=ymd(d),rows=state.tickets.filter(t=>t.scheduled_date===date).sort((a,b)=>(a.schedule_order||0)-(b.schedule_order||0));return`<div class="k7-col"><div class="k7-col-head"><span>${d.toLocaleDateString('id-ID',{weekday:'short',day:'2-digit',month:'short'})}</span><span>${rows.length}</span></div><div class="k7-drop" data-date="${date}">${rows.map(card).join('')}</div></div>`;}).join('')}<div class="k7-col"><div class="k7-col-head"><span>Belum Dijadwalkan</span><span>${state.tickets.filter(t=>!t.scheduled_date).length}</span></div><div class="k7-drop" data-date="">${state.tickets.filter(t=>!t.scheduled_date).map(card).join('')}</div></div></div>`;}
  function capacity(date){const used=new Set();state.tickets.filter(t=>t.scheduled_date===date).forEach(t=>(t.technicians||[]).forEach(x=>{const v=typeof x==='object'?(x.id||x.name):x;if(v)used.add(String(v));}));const free=state.technicians.filter(x=>!used.has(String(x.id))&&!used.has(String(x.name)));return{used,free};}
  function renderCalendar(){return`<div class="k7-capacity">${[...Array(7)].map((_,i)=>{const d=addDays(state.weekStart,i),date=ymd(d),cap=capacity(date),rows=state.tickets.filter(t=>t.scheduled_date===date).sort((a,b)=>String(a.scheduled_start_time||'').localeCompare(String(b.scheduled_start_time||'')));return`<div class="k7-day"><b>${d.toLocaleDateString('id-ID',{weekday:'long',day:'2-digit'})}</b><div class="k7-meta">Terisi ${cap.used.size}/${state.technicians.length} · Sisa ${cap.free.length}</div><div class="k7-free">${cap.free.length?'Kosong: '+cap.free.map(x=>esc(x.name)).join(', '):'Tidak ada teknisi kosong'}</div><hr>${rows.map(t=>`<div class="k7-meta"><b>${esc(t.scheduled_start_time||'-')}</b> ${esc(t.wo_number)} · ${esc((t.technicians||[]).map(techLabel).join(', ')||'-')}</div>`).join('')}</div>`;}).join('')}</div>`;}
  async function renderKpi(){qs('#k7Body').innerHTML='Memuat KPI...';const end=addDays(state.weekStart,6),d=await api(`/api/technician-kanban-kpi?date_from=${ymd(state.weekStart)}&date_to=${ymd(end)}`);qs('#k7Body').innerHTML=`<div class="k7-kpi">${(d.kpi||[]).map(k=>`<div class="k7-kpi-card"><b>${esc(k.technician)}</b><div class="k7-meta">WO ${k.total} · Selesai ${k.done} · Berjalan ${k.running}</div><div class="k7-meta">Menunggu ${k.waiting} · Terlambat ${k.late}</div><div class="k7-meta">Completion ${k.completion_rate}% · Beban ${k.capacity_hours} jam</div></div>`).join('')||'Belum ada data KPI.'}</div>`;}
  function render(){if(state.view==='kpi'){renderKpi();return;}qs('#k7Body').innerHTML=state.view==='calendar'?renderCalendar():renderKanban();bindDrag();qsa('[data-k7-edit]').forEach(b=>b.onclick=()=>editSchedule(b.dataset.k7Edit));}
  async function save(t,patch){await api(`/api/technician-kanban/${encodeURIComponent(t.id)}/schedule`,{method:'PATCH',body:JSON.stringify({...patch,source:'kanban'})});await load();}
  async function editSchedule(id){const t=state.tickets.find(x=>String(x.id)===String(id));if(!t)return;const date=prompt('Tanggal kerja (YYYY-MM-DD)',t.scheduled_date||ymd(new Date()));if(date===null)return;const time=prompt('Jam mulai (HH:MM)',t.scheduled_start_time||'08:00');if(time===null)return;const duration=prompt('Estimasi durasi (menit)',String(t.estimated_duration_minutes||60));if(duration===null)return;const priority=prompt('Prioritas: low / normal / high / urgent',t.schedule_priority||'normal');if(priority===null)return;await save(t,{scheduled_date:date,scheduled_start_time:time,estimated_duration_minutes:Number(duration)||60,schedule_priority:priority,schedule_order:t.schedule_order,technicians:t.technicians});}
  function bindDrag(){if(!state.canEdit)return;qsa('#pxlKanbanPage .k7-card').forEach(c=>{c.ondragstart=()=>c.classList.add('dragging');c.ondragend=()=>c.classList.remove('dragging');});qsa('#pxlKanbanPage .k7-drop').forEach(z=>{z.ondragover=e=>e.preventDefault();z.ondrop=async e=>{e.preventDefault();const c=qs('#pxlKanbanPage .k7-card.dragging');if(!c)return;const t=state.tickets.find(x=>String(x.id)===c.dataset.id),date=z.dataset.date||null;const time=prompt('Jam mulai (HH:MM)',t.scheduled_start_time||'08:00');if(time===null)return;await save(t,{scheduled_date:date,scheduled_start_time:time,estimated_duration_minutes:t.estimated_duration_minutes,schedule_priority:t.schedule_priority,schedule_order:z.children.length,technicians:t.technicians});};});}

  const observer=new MutationObserver(()=>{installMenu();bindOtherMenus();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{install();observer.observe(document.body,{childList:true,subtree:true});},{once:true});else{install();observer.observe(document.body,{childList:true,subtree:true});}
})();
