/* PXL-STG-0007M — drag & drop stabil untuk mouse dan PWA/Android. */
(function(){
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const pad=n=>String(n).padStart(2,'0');
  const token=()=>localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('pxl_token')||sessionStorage.getItem('token')||'';

  let drag=null;

  async function api(url,opt={}){
    const t=token();
    const r=await fetch(url,{
      credentials:'same-origin',cache:'no-store',...opt,
      headers:{'Content-Type':'application/json',...(t?{Authorization:`Bearer ${t}`,'X-Auth-Token':t}:{}),...(opt.headers||{})}
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||data.message||`HTTP ${r.status}`);
    return data;
  }

  function weekRange(){
    const date=$('#k7lDate')?.value;
    const base=date?new Date(date+'T00:00:00'):new Date();
    const offset=(base.getDay()+6)%7;
    base.setDate(base.getDate()-offset);
    const end=new Date(base);end.setDate(end.getDate()+6);
    const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    return {from:ymd(base),to:ymd(end)};
  }

  async function ticketById(id){
    const range=weekRange();
    const data=await api(`/api/technician-kanban?date_from=${range.from}&date_to=${range.to}`);
    return (data.tickets||[]).find(x=>String(x.id)===String(id));
  }

  async function saveTicket(id,changes){
    const t=await ticketById(id);
    if(!t) throw new Error('Work Order tidak ditemukan pada periode ini.');
    await api(`/api/technician-kanban/${encodeURIComponent(id)}/schedule`,{
      method:'PATCH',
      body:JSON.stringify({
        scheduled_date:changes.scheduled_date??t.scheduled_date,
        scheduled_start_time:changes.scheduled_start_time??t.scheduled_start_time,
        estimated_duration_minutes:changes.estimated_duration_minutes??t.estimated_duration_minutes??60,
        schedule_priority:t.schedule_priority||'normal',
        schedule_order:t.schedule_order||0,
        technicians:t.technicians||[],
        source:'calendar'
      })
    });
  }

  function targetSelector(type){
    if(type==='kanban') return '.k7k-day[data-date]';
    if(type==='week') return '.k7l-cell[data-week-date]';
    if(type==='day') return '.k7l-track';
    return '';
  }

  function clearTargets(){
    $$('.pxl-drag-target').forEach(el=>el.classList.remove('pxl-drag-target'));
  }

  function pointTarget(x,y,type){
    if(!drag) return null;
    drag.source.style.pointerEvents='none';
    const el=document.elementFromPoint(x,y)?.closest(targetSelector(type));
    drag.source.style.pointerEvents='';
    return el;
  }

  function createGhost(source,x,y){
    const rect=source.getBoundingClientRect();
    const ghost=source.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
    Object.assign(ghost.style,{
      position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,
      margin:'0',zIndex:'10002',pointerEvents:'none',opacity:'.88',transform:'scale(.98)',boxShadow:'0 12px 28px rgba(0,0,0,.22)'
    });
    document.body.appendChild(ghost);
    return {ghost,offsetX:x-rect.left,offsetY:y-rect.top};
  }

  function activate(e){
    if(!drag||drag.active) return;
    drag.active=true;
    const g=createGhost(drag.source,e.clientX,e.clientY);
    drag.ghost=g.ghost;drag.offsetX=g.offsetX;drag.offsetY=g.offsetY;
    drag.source.style.opacity='.35';
    document.body.classList.add('pxl-dragging');
  }

  function move(e){
    if(!drag) return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(!drag.active){
      if(Math.hypot(dx,dy)>10 && drag.pointerType!=='mouse') cancel();
      return;
    }
    e.preventDefault();
    drag.ghost.style.left=`${e.clientX-drag.offsetX}px`;
    drag.ghost.style.top=`${e.clientY-drag.offsetY}px`;
    clearTargets();
    const target=pointTarget(e.clientX,e.clientY,drag.type);
    if(target) target.classList.add('pxl-drag-target');
  }

  function cleanup(){
    if(!drag) return;
    clearTimeout(drag.timer);
    drag.ghost?.remove();
    drag.source.style.opacity='';
    clearTargets();
    document.body.classList.remove('pxl-dragging');
    drag=null;
  }

  function cancel(){cleanup();}

  async function finish(e){
    if(!drag) return;
    clearTimeout(drag.timer);
    if(!drag.active){cleanup();return;}
    e.preventDefault();
    const state={...drag};
    const target=pointTarget(e.clientX,e.clientY,state.type);
    cleanup();
    if(!target) return;

    try{
      if(state.type==='kanban'){
        const edit=state.source.querySelector('[data-edit]');
        edit?.click();
        setTimeout(()=>{const input=$('#k7kDate');if(input)input.value=target.dataset.date;},30);
        return;
      }
      if(state.type==='week'){
        await saveTicket(state.id,{scheduled_date:target.dataset.weekDate});
        document.dispatchEvent(new CustomEvent('pxl-kanban-schedule-updated'));
        $('#k7lScale')?.dispatchEvent(new Event('change',{bubbles:true}));
        return;
      }
      if(state.type==='day'){
        const rect=target.getBoundingClientRect();
        const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
        const mins=Math.round((8*60+ratio*(12*60))/15)*15;
        const time=`${pad(Math.floor(mins/60))}:${pad(mins%60)}`;
        await saveTicket(state.id,{scheduled_date:$('#k7lDate')?.value,scheduled_start_time:time});
        document.dispatchEvent(new CustomEvent('pxl-kanban-schedule-updated'));
        $('#k7lDate')?.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }catch(err){
      alert(err.message||String(err));
    }
  }

  function start(e,source,type){
    if(e.button!==undefined&&e.button!==0) return;
    if(e.target.closest('button,input,select,a')) return;
    e.stopImmediatePropagation();
    source.setAttribute('draggable','false');
    drag={source,type,id:source.dataset.id,startX:e.clientX,startY:e.clientY,pointerId:e.pointerId,pointerType:e.pointerType,active:false};
    const delay=e.pointerType==='mouse'?0:420;
    drag.timer=setTimeout(()=>activate(e),delay);
  }

  document.addEventListener('pointerdown',e=>{
    const kanban=e.target.closest('.k7k-card[data-id]');
    if(kanban){start(e,kanban,'kanban');return;}
    const bar=e.target.closest('.k7l-bar[data-id]');
    if(bar){start(e,bar,'day');return;}
    const chip=e.target.closest('.k7l-chip[data-id]');
    if(chip){start(e,chip,'week');}
  },true);
  document.addEventListener('pointermove',move,{capture:true,passive:false});
  document.addEventListener('pointerup',finish,true);
  document.addEventListener('pointercancel',cancel,true);

  function normalize(){
    $$('.k7k-card[draggable],.k7l-bar[draggable],.k7l-chip[draggable]').forEach(el=>el.setAttribute('draggable','false'));
  }

  const style=document.createElement('style');
  style.textContent=`
    body.pxl-dragging{user-select:none;-webkit-user-select:none;overscroll-behavior:none}
    .pxl-drag-target{outline:3px solid rgba(224,123,57,.75)!important;outline-offset:-3px;background-color:rgba(224,123,57,.08)!important}
    .k7k-card,.k7l-bar,.k7l-chip{touch-action:pan-x pan-y}
    body.pxl-dragging .k7k-card,body.pxl-dragging .k7l-bar,body.pxl-dragging .k7l-chip{touch-action:none}
  `;
  document.head.appendChild(style);
  new MutationObserver(normalize).observe(document.documentElement,{childList:true,subtree:true});
  normalize();
})();