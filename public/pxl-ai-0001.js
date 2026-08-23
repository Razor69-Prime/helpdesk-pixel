/* PXL-AI-0002B1 — AI Report safe health validation. Frontend/read-only only. */
(function(){
  'use strict';
  const PERM='ai_report_read';
  const LEGACY='ai_report';
  const $=(s,r=document)=>r.querySelector(s);

  function user(){try{return window.currentUser||currentUser||null;}catch(_){return window.currentUser||null;}}
  function role(){return String(user()?.role||'').trim().toLowerCase();}
  function menus(){const u=user()||{};const raw=u.custom_menus||u.menus||u.permissions||[];if(Array.isArray(raw))return raw.map(String);if(typeof raw==='string'){try{const x=JSON.parse(raw);return Array.isArray(x)?x.map(String):raw.split(',').map(v=>v.trim());}catch(_){return raw.split(',').map(v=>v.trim());}}return[];}
  function canView(){if(role()==='superadmin')return true;const p=new Set(menus());return p.has(PERM)||p.has(LEGACY)||p.has('ai_report_view');}

  function ensurePermissionCheckbox(){
    const box=$('#menu-checkboxes');if(!box||box.querySelector('[data-access="'+PERM+'"]'))return;
    const section=document.createElement('section');section.dataset.pxlAiPermission='1';section.style.marginBottom='12px';
    section.innerHTML='<b>AI & Management Intelligence</b><div style="margin-top:6px;border:1px solid var(--border);border-radius:8px;overflow:hidden"><div style="display:grid;grid-template-columns:1fr 100px 80px;gap:8px;align-items:center;padding:8px"><span>AI Report</span><label style="margin:0;text-transform:none"><input type="checkbox" data-access="ai_report_read"> Read Only</label><span style="font-size:11px;color:var(--muted)">Read-only</span></div></div>';
    box.appendChild(section);
    const checked=role()==='superadmin'||menus().some(v=>[PERM,LEGACY,'ai_report_view'].includes(v));
    section.querySelector('[data-access="'+PERM+'"]').checked=checked;
  }

  function authHeaders(){
    const h={'Accept':'application/json'};
    try{
      const token=String(window.__pxlAuthToken
        || localStorage.getItem('pixel_token')
        || sessionStorage.getItem('pixel_token')
        || localStorage.getItem('token')
        || localStorage.getItem('authToken')
        || localStorage.getItem('pxl_token')
        || sessionStorage.getItem('token')
        || '').trim();
      if(token){h.Authorization='Bearer '+token;h['X-Auth-Token']=token;}
    }catch(_){}
    return h;
  }
  async function safeHealth(){
    const el=$('#pxlAiHealth');if(!el)return;
    el.textContent='Memeriksa session existing...';
    try{
      const r=await fetch('/api/me',{method:'GET',headers:authHeaders(),cache:'no-store',credentials:'same-origin'});
      if(r.ok){el.textContent='PASS — session & routing existing normal';el.style.color='#2e7d32';return;}
      el.textContent='Tidak dapat diverifikasi ('+r.status+')';el.style.color='#b26a00';
    }catch(_){el.textContent='Tidak dapat diverifikasi';el.style.color='#b26a00';}
  }

  function ensurePage(){
    const host=$('.app-content');if(!host)return null;
    let page=$('#pxlAiReportPage');if(page)return page;
    page=document.createElement('section');page.id='pxlAiReportPage';page.hidden=true;page.style.display='none';
    page.innerHTML='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px"><div><h2 style="margin:0 0 4px">AI Report</h2><div style="color:var(--muted);font-size:12px">Read-Only Management Intelligence</div></div><span class="badge blue">READ ONLY</span></div><div class="card"><div class="card-title">Report</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px"><button class="btn" disabled>Daily Report</button><button class="btn" disabled>Weekly Report</button><button class="btn" disabled>Next Week Plan</button><button class="btn" disabled>Monthly Report</button></div><div style="margin-top:14px;font-size:12px;color:var(--muted)">Report Engine belum membaca database. Tahap ini hanya memvalidasi jalur existing yang sudah stabil.</div></div><div class="card"><div class="card-title">Status</div><div style="display:grid;grid-template-columns:160px 1fr;gap:8px;font-size:13px"><span>Mode</span><b>READ ONLY</b><span>Safe Health</span><b id="pxlAiHealth">Belum diperiksa</b><span>Database AI</span><span>Tidak diakses</span><span>Gemini AI</span><span>Belum aktif</span><span>Revision</span><span>PXL-AI-0002B1</span></div></div>';
    host.appendChild(page);return page;
  }
  function restore(){const host=$('.app-content');if(!host)return;[...host.children].forEach(n=>{if(n.id==='pxlAiReportPage'){n.hidden=true;n.style.display='none';}else if('aiOldDisplay' in n.dataset){n.style.display=n.dataset.aiOldDisplay;delete n.dataset.aiOldDisplay;}});}
  function open(){if(!canView())return;const page=ensurePage(),host=$('.app-content');if(!page||!host)return;[...host.children].forEach(n=>{if(n===page)return;if(!('aiOldDisplay' in n.dataset))n.dataset.aiOldDisplay=n.style.display||'';n.style.display='none';});page.hidden=false;page.style.display='block';safeHealth();}
  function ensureMenu(){
    const sidebar=$('.sidebar');if(!sidebar)return;
    let btn=$('[data-pxl-ai-report]',sidebar);
    if(!canView()){btn?.remove();return;}
    if(!btn){btn=document.createElement('button');btn.className='nav-btn';btn.dataset.pxlAiReport='1';btn.innerHTML='<span>🤖</span><span class="nav-label">AI Report</span>';sidebar.appendChild(btn);}
    btn.onclick=open;
    if(!window.__PXL_AI_RESTORE__){window.__PXL_AI_RESTORE__=true;sidebar.addEventListener('click',e=>{const nav=e.target.closest('.nav-btn,button,a');if(nav&&!nav.closest('[data-pxl-ai-report]'))restore();},true);}
  }
  function refresh(){ensurePermissionCheckbox();ensureMenu();}
  const obs=new MutationObserver(()=>refresh());
  function init(){ensurePage();refresh();obs.observe(document.body,{childList:true,subtree:true});setTimeout(refresh,300);setTimeout(refresh,1200);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
