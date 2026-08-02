/* PXL-STG-0007R — samakan WO harian/mingguan, Hari Ini lokal, dan label PWA terbaca. */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const pad=n=>String(n).padStart(2,'0');
  const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>ymd(new Date());
  let decorating=false,lastKey='';

  function token(){return localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('pxl_token')||sessionStorage.getItem('token')||'';}
  async function api(url){const t=token();const r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{...(t?{Authorization:`Bearer ${t}`,'X-Auth-Token':t}:{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||d.message||`HTTP ${r.status}`);return d;}
  function minutes(v){const [h,m]=String(v||'08:00').slice(0,5).split(':').map(Number);return (Number.isFinite(h)?h:8)*60+(Number.isFinite(m)?m:0);}
  function selectedDate(){return $('#k7lDate')?.value||today();}
  function isDailyTimeline(){return $('[data-k7l-mode="timeline"]')?.classList.contains('active')&&($('#k7lScale')?.value||'day')==='day'&&!!$('.k7l-grid');}

  function installStyle(){if($('#k7rStyle'))return;const st=document.createElement('style');st.id='k7rStyle';st.textContent=`
    .k7l-bar{min-width:132px!important;height:auto!important;min-height:46px!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.25!important;padding:6px 8px!important;z-index:2}
    .k7l-bar .k7r-wo{font-weight:700;display:block;white-space:nowrap}.k7l-bar .k7r-time{display:block;font-size:10px;white-space:nowrap;margin-top:2px}
    .k7r-unmapped .k7l-track{min-height:66px}.k7r-today{outline:3px solid #e67e22!important;outline-offset:-3px;background:rgba(230,126,34,.06)!important}
    #k7rTodayInfo{font-size:12px;font-weight:700;color:#9a4d13;margin:2px 0 8px}
    @media(max-width:600px){.k7l-grid{min-width:1050px!important}.k7l-headrow,.k7l-row{grid-template-columns:210px 1fr!important}.k7l-label{position:sticky;left:0;z-index:5}.k7l-bar{min-width:150px!important;font-size:11px!important}}
  `;document.head.appendChild(st);}

  function improveLabels(){
    $$('.k7l-bar').forEach(bar=>{if(bar.dataset.k7rLabel)return;bar.dataset.k7rLabel='1';const raw=(bar.textContent||'').trim();const title=(bar.getAttribute('title')||'').trim();const time=(title.match(/\b\d{2}:\d{2}\b/)||raw.match(/\b\d{2}:\d{2}\b/)||[])[0]||'-';const wo=(title.replace(/\b\d{2}:\d{2}\b.*/,'').trim()||raw.split('·')[0].trim()||'WO');bar.innerHTML=`<span class="k7r-wo">${esc(wo)}</span><span class="k7r-time">${esc(time)}</span>`;bar.title=`${wo} · ${time}`;});
  }

  async function ensureDailyCompleteness(){
    if(!isDailyTimeline()||decorating)return;
    const date=selectedDate(),key=`${date}:${$$('.k7l-bar').map(x=>x.dataset.id).join(',')}`;
    if(key===lastKey)return;lastKey=key;decorating=true;
    try{
      const data=await api(`/api/technician-kanban?date_from=${date}&date_to=${date}`);
      const unique=[...new Map((data.tickets||[]).filter(t=>t.scheduled_date===date).map(t=>[String(t.id),t])).values()];
      const seen=new Set();
      $$('.k7l-bar').forEach(el=>{const id=String(el.dataset.id||'');if(!id)return;if(seen.has(id))el.remove();else seen.add(id);});
      const missing=unique.filter(t=>!seen.has(String(t.id)));
      $('.k7r-unmapped')?.remove();
      if(missing.length){
        const grid=$('.k7l-grid');if(!grid)return;
        const start=8*60,span=12*60;
        const bars=missing.map((t,i)=>{const s=Math.max(start,minutes(t.scheduled_start_time)),left=(s-start)/span*100,dur=Number(t.estimated_duration_minutes||60),width=Math.max(3,Math.min(100-left,dur/span*100));return `<div class="k7l-bar" data-id="${esc(t.id)}" style="left:${left}%;width:${width}%;top:${8+i*54}px" title="${esc(t.wo_number||'WO')} ${esc(t.scheduled_start_time||'-')}"><span class="k7r-wo">${esc(t.wo_number||'WO')}</span><span class="k7r-time">${esc(t.scheduled_start_time||'-')}</span></div>`;}).join('');
        const row=document.createElement('div');row.className='k7l-row k7r-unmapped';row.innerHTML=`<div class="k7l-label">Belum Terpetakan</div><div class="k7l-track" style="min-height:${Math.max(66,missing.length*54+12)}px">${bars}</div>`;grid.appendChild(row);
      }
      improveLabels();
    }catch(_){/* tampilan existing tetap dipakai jika request gagal */}
    finally{decorating=false;}
  }

  function markToday(){
    const d=today();
    $$('.k7r-today').forEach(n=>n.classList.remove('k7r-today'));
    $$(`[data-date="${d}"],[data-week-date="${d}"]`).forEach(n=>n.classList.add('k7r-today'));
    const range=$('#k7kRange');if(range){let info=$('#k7rTodayInfo');if(!info){info=document.createElement('div');info.id='k7rTodayInfo';range.insertAdjacentElement('afterend',info);}info.textContent=`Hari ini: ${new Date(d+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}`;}
  }

  function bindToday(){const b=$('#k7kToday');if(!b||b.dataset.k7rBound)return;b.dataset.k7rBound='1';b.addEventListener('click',()=>{const d=today();setTimeout(()=>{if($('#k7lDate')){$('#k7lDate').value=d;$('#k7lDate').dispatchEvent(new Event('change'));}markToday();const target=$(`[data-date="${d}"],[data-week-date="${d}"]`);target?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});lastKey='';ensureDailyCompleteness();},180);},true);}

  function decorate(){installStyle();bindToday();improveLabels();markToday();ensureDailyCompleteness();}
  new MutationObserver(()=>setTimeout(decorate,0)).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
})();