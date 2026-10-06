/* PXL-TICKET-PAGE-0001 — client-side ticket pagination, 25 cards per page. */
(function(){
  'use strict';
  const REV='PXL-TICKET-PAGE-0001', PAGE_SIZE=25;
  if(window.PXL_TICKET_PAGE?.revision===REV)return;

  let page=1, lastFilterKey='';
  let installed=false;

  function filterState(){
    return [
      document.getElementById('t-search')?.value||'',
      document.getElementById('t-status')?.value||'',
      document.getElementById('t-from')?.value||'',
      document.getElementById('t-to')?.value||''
    ].join('|');
  }

  function matchesFilters(t){
    const search=String(document.getElementById('t-search')?.value||'').toLowerCase();
    const status=String(document.getElementById('t-status')?.value||'');
    const text=[t?.wo_number,t?.project_name,t?.customer_name].map(v=>String(v||'').toLowerCase());
    return (!search||text.some(v=>v.includes(search)))&&(!status||String(t?.status||'')===status);
  }

  function allFiltered(){
    try{
      const source=(typeof allTickets!=='undefined'&&Array.isArray(allTickets))?allTickets:[];
      const ranged=typeof window.applyRange==='function'?window.applyRange(source,'t'):source;
      return ranged.filter(matchesFilters);
    }catch(_){return (typeof allTickets!=='undefined'&&Array.isArray(allTickets))?allTickets.slice():[];}
  }

  function pagerHtml(total,totalPages,start,end){
    if(total<=PAGE_SIZE)return `<div class="pxl-ticket-pagebar" style="font-size:11px;color:var(--muted);text-align:right;margin-top:8px">Menampilkan ${total} tiket</div>`;
    return `<div class="pxl-ticket-pagebar" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;padding:10px 0 2px;border-top:1px solid var(--border)">
      <div style="font-size:11px;color:var(--muted)">Menampilkan ${start+1}–${end} dari ${total} tiket</div>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn sm" ${page<=1?'disabled':''} data-pxl-ticket-page="${page-1}">← Sebelumnya</button>
        <span style="font-size:12px;color:var(--muted)">Halaman ${page} / ${totalPages}</span>
        <button class="btn sm" ${page>=totalPages?'disabled':''} data-pxl-ticket-page="${page+1}">Berikutnya →</button>
      </div>
    </div>`;
  }

  function bindPager(){
    document.querySelectorAll('[data-pxl-ticket-page]').forEach(btn=>{
      btn.onclick=()=>{
        const next=Math.max(1,Number(btn.dataset.pxlTicketPage)||1);
        if(next===page)return;
        page=next;
        window.renderTickets();
        document.getElementById('ticket-list')?.scrollIntoView({behavior:'smooth',block:'start'});
      };
    });
  }

  function install(){
    if(installed||typeof window.renderTickets!=='function')return false;
    const nativeRender=window.renderTickets;
    window.renderTickets=function(){
      const key=filterState();
      if(key!==lastFilterKey){page=1;lastFilterKey=key;}
      const full=(typeof allTickets!=='undefined'&&Array.isArray(allTickets))?allTickets:[];
      const filtered=allFiltered();
      const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
      page=Math.min(Math.max(1,page),totalPages);
      const start=(page-1)*PAGE_SIZE,end=Math.min(start+PAGE_SIZE,filtered.length);
      const visible=filtered.slice(start,end);
      try{
        allTickets=visible;
        nativeRender.apply(this,arguments);
      }finally{
        allTickets=full;
      }
      const host=document.getElementById('ticket-list');
      if(host&&filtered.length){host.querySelector('.pxl-ticket-pagebar')?.remove();host.insertAdjacentHTML('beforeend',pagerHtml(filtered.length,totalPages,start,end));bindPager();}
    };
    window.renderTickets.__pxlTicketPage=REV;
    window.PXL_TICKET_PAGE={revision:REV,pageSize:PAGE_SIZE,getPage:()=>page,setPage:n=>{page=Math.max(1,Number(n)||1);window.renderTickets();}};
    installed=true;
    try{window.renderTickets();}catch(_){}
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>=80)clearInterval(timer);},100);
  }
})();
