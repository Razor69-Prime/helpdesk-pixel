/* PXL-STG-0007U — Custom Date, compact PWA, dan detail ringkas WO. */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const isPwa=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true||window.innerWidth<=700;
  let rendering=false,lastDate='',ticketMap=new Map();

  function token(){return localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('pxl_token')||sessionStorage.getItem('token')||'';}
  async function api(url){const t=token();const r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{...(t?{Authorization:`Bearer ${t}`,'X-Auth-Token':t}:{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||d.message||`HTTP ${r.status}`);return d;}
  function identity(t,i){const id=String(t?.id??'').trim();if(id)return`id:${id}`;const wo=String(t?.wo_number??'').trim();if(wo)return`wo:${wo}:${t?.scheduled_date||''}`;return`row:${i}:${t?.scheduled_date||''}`;}
  function techText(t){return (Array.isArray(t?.technicians)?t.technicians:[]).map(x=>typeof x==='object'?(x.name||x.username||x.id):x).filter(Boolean).join(', ')||'Belum ada teknisi';}

  function installStyle(){
    if($('#k7uStyle'))return;
    const st=document.createElement('style');st.id='k7uStyle';st.textContent=`
      #k7uCustom{display:grid;gap:9px}.k7u-card{border:1px solid #ddd8cf;border-radius:10px;background:#fff;padding:11px;cursor:pointer}.k7u-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.k7u-wo{font-weight:800}.k7u-time{font-size:12px;color:#8a5a2b}.k7u-project{font-size:13px;margin-top:5px}.k7u-meta{font-size:11px;color:#777;margin-top:4px}.k7u-empty{padding:24px;text-align:center;color:#888;border:1px dashed #d6d0c6;border-radius:10px}.k7u-count{font-size:12px;font-weight:700;margin-bottom:8px;color:#76502d}
      #k7uSheet{position:fixed;inset:0;z-index:10080;background:rgba(0,0,0,.34);display:flex;align-items:flex-end}#k7uSheet[hidden]{display:none}.k7u-sheet-card{width:100%;background:#fff;border-radius:18px 18px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -8px 28px rgba(0,0,0,.18)}.k7u-sheet-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}.k7u-sheet-head b{font-size:17px}.k7u-close{border:0;background:#f1eee8;border-radius:999px;width:34px;height:34px;font-size:20px}.k7u-detail{display:grid;grid-template-columns:105px 1fr;gap:9px 12px;font-size:13px}.k7u-detail span{color:#777}.k7u-detail strong{overflow-wrap:anywhere}
      .k7u-info{float:right;border:0;background:rgba(255,255,255,.72);border-radius:999px;width:22px;height:22px;line-height:20px;padding:0;margin-left:4px;font-weight:800;cursor:pointer}
      @media(max-width:700px){.k7l-week{grid-template-columns:118px repeat(7,96px)!important;min-width:790px!important}.k7l-cell{padding:6px!important;min-height:54px!important;font-size:10px!important}.k7l-cell.head{font-size:11px!important}.k7l-chip{padding:5px!important;font-size:9px!important;line-height:1.25!important;overflow:hidden;text-overflow:ellipsis}.k7l-week>.k7l-cell:nth-child(8n+1){position:sticky;left:0;z-index:4;background:#faf9f6}.k7l-wrap{scrollbar-width:thin}.k7u-scroll-hint{font-size:10px;color:#8a8176;text-align:right;margin:0 3px 5px}.k7l-grid{min-width:790px!important}}
    `;document.head.appendChild(st);
  }

  function ensureSheet(){
    let sheet=$('#k7uSheet');if(sheet)return sheet;
    sheet=document.createElement('div');sheet.id='k7uSheet';sheet.hidden=true;sheet.innerHTML='<div class="k7u-sheet-card"><div class="k7u-sheet-head"><b>Detail WO</b><button type="button" class="k7u-close" aria-label="Tutup">×</button></div><div class="k7u-detail"></div></div>';
    document.body.appendChild(sheet);sheet.addEventListener('click',e=>{if(e.target===sheet||e.target.closest('.k7u-close'))sheet.hidden=true;});return sheet;
  }
  function showDetail(t){
    if(!t)return;const sheet=ensureSheet(),box=$('.k7u-detail',sheet);box.innerHTML=`<span>Nomor WO</span><strong>${esc(t.wo_number||'-')}</strong><span>Nama project</span><strong>${esc(t.project_name||'-')}</strong><span>Customer</span><strong>${esc(t.customer_name||'-')}</strong><span>Status</span><strong>${esc(t.status||'-')}</strong>`;sheet.hidden=false;
  }

  async function renderCustom(force=false){
    if(rendering)return;const scale=$('#k7lScale');if(!scale||scale.value!=='custom')return;
    const date=$('#k7lDate')?.value||ymd(new Date());if(!force&&date===lastDate&&$('#k7uCustom'))return;
    rendering=true;lastDate=date;
    try{
      const data=await api(`/api/technician-kanban?date_from=${date}&date_to=${date}`);
      const rows=[],seen=new Set();(data.tickets||[]).filter(t=>t.scheduled_date===date).forEach((t,i)=>{const key=identity(t,i);if(seen.has(key))return;seen.add(key);rows.push(t);ticketMap.set(key,t);if(t.id)ticketMap.set(String(t.id),t);});
      rows.sort((a,b)=>String(a.scheduled_start_time||'99:99').localeCompare(String(b.scheduled_start_time||'99:99')));
      const body=$('#k7kBody');if(!body)return;
      body.innerHTML=`<div class="k7u-count">${rows.length} pekerjaan pada ${new Date(date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div><div id="k7uCustom">${rows.map((t,i)=>{const key=identity(t,i);return `<article class="k7u-card" data-k7u-key="${esc(key)}"><div class="k7u-top"><span class="k7u-wo">${esc(t.wo_number||'-')}</span><span class="k7u-time">${esc(t.scheduled_start_time||'-')}</span></div><div class="k7u-project">${esc(t.project_name||'-')}</div><div class="k7u-meta">${esc(techText(t))} · ${esc(t.status||'-')}</div></article>`;}).join('')||'<div class="k7u-empty">Tidak ada pekerjaan pada tanggal ini.</div>'}</div>`;
    }catch(e){const body=$('#k7kBody');if(body)body.innerHTML=`<div class="k7u-empty">${esc(e.message)}</div>`;}
    finally{rendering=false;}
  }

  function installCustomMode(){
    const scale=$('#k7lScale');if(!scale)return;
    const day=[...scale.options].find(o=>o.value==='day');if(day){day.value='custom';day.textContent='Custom Date';}
    if(scale.value==='day')scale.value='custom';
    const date=$('#k7lDate');if(date)date.style.display=scale.value==='custom'?'block':'none';
    if(!scale.dataset.k7uBound){scale.dataset.k7uBound='1';scale.addEventListener('change',()=>{const d=$('#k7lDate');if(d)d.style.display=scale.value==='custom'?'block':'none';lastDate='';if(scale.value==='custom')setTimeout(()=>renderCustom(true),0);});}
    if(date&&!date.dataset.k7uBound){date.dataset.k7uBound='1';date.addEventListener('change',()=>{lastDate='';if(scale.value==='custom')renderCustom(true);});}
    if(scale.value==='custom')renderCustom();
  }

  function decorateWeek(){
    if(!isPwa()||$('#k7lScale')?.value!=='week')return;
    const wrap=$('.k7l-wrap');if(wrap&&!wrap.previousElementSibling?.classList.contains('k7u-scroll-hint'))wrap.insertAdjacentHTML('beforebegin','<div class="k7u-scroll-hint">Geser ↔ untuk melihat tanggal lainnya</div>');
    $$('.k7l-chip').forEach(chip=>{if(chip.querySelector('.k7u-info'))return;const b=document.createElement('button');b.type='button';b.className='k7u-info';b.textContent='i';b.setAttribute('aria-label','Lihat detail WO');chip.appendChild(b);});
  }

  async function loadTicketForChip(chip){
    const id=String(chip.dataset.id||'');if(id&&ticketMap.has(id))return ticketMap.get(id);
    const range=$('#k7kRange')?.textContent||'',m=range.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}).*?(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(!m)return null;
    const from=`${m[3]}-${pad(m[2])}-${pad(m[1])}`,to=`${m[6]}-${pad(m[5])}-${pad(m[4])}`;const data=await api(`/api/technician-kanban?date_from=${from}&date_to=${to}`);(data.tickets||[]).forEach((t,i)=>{ticketMap.set(identity(t,i),t);if(t.id)ticketMap.set(String(t.id),t);});return ticketMap.get(id)||null;
  }

  document.addEventListener('click',async e=>{
    const card=e.target.closest('[data-k7u-key]');if(card){showDetail(ticketMap.get(card.dataset.k7uKey));return;}
    const info=e.target.closest('.k7u-info');if(info){e.preventDefault();e.stopImmediatePropagation();const chip=info.closest('.k7l-chip');showDetail(await loadTicketForChip(chip));}
  },true);

  function decorate(){installStyle();ensureSheet();installCustomMode();decorateWeek();}
  new MutationObserver(()=>setTimeout(decorate,0)).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',decorate);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
})();