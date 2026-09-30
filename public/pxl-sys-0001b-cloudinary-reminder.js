'use strict';
(function(){
  const ID='pxl-cloudinary-monthly-reminder';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let pollTimer=null;
  function allowed(){try{return typeof currentUser!=='undefined'&&String(currentUser?.role||'').toLowerCase()==='superadmin'}catch(_){return false}}
  function remove(){document.getElementById(ID)?.remove()}
  function ensureCss(){
    if(document.getElementById(ID+'-css'))return;
    const s=document.createElement('style');s.id=ID+'-css';
    s.textContent='#'+ID+'{position:sticky;top:52px;z-index:99;background:#fff4d6;border-bottom:1px solid #e8c86b;padding:9px 16px;display:flex;gap:12px;align-items:center;justify-content:center;font-size:12px;color:#6d4b00;box-shadow:0 2px 8px rgba(0,0,0,.05)}#'+ID+' b{color:#4e3500}#'+ID+' .pxl-cb-actions{display:flex;gap:7px;align-items:center}#'+ID+' button{white-space:nowrap}@media(max-width:700px){#'+ID+'{top:52px;align-items:flex-start;flex-direction:column;padding:8px 10px}#'+ID+' .pxl-cb-actions{width:100%}}';
    document.head.appendChild(s);
  }
  async function apiCall(method,path,body){
    if(typeof api==='function')return api(method,path,body);
    throw new Error('API belum siap');
  }
  async function download(period,button){
    if(button){button.disabled=true;button.textContent='Menyiapkan download...'}
    try{
      const t=await apiCall('POST','/cloudinary-backup/monthly/'+encodeURIComponent(period)+'/download-token',{});
      const a=document.createElement('a');
      a.href='/api/cloudinary-backup/monthly/'+encodeURIComponent(period)+'/download?token='+encodeURIComponent(t.token);
      a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),3000);
      if(button)button.textContent='Download berjalan...';
      clearInterval(pollTimer);
      pollTimer=setInterval(async()=>{try{const d=await apiCall('GET','/cloudinary-backup/reminder');if(!d?.active){clearInterval(pollTimer);pollTimer=null;remove();if(window.loadSystemTools)window.loadSystemTools(true)}}catch(_){}},5000);
      setTimeout(()=>{if(button){button.disabled=false;button.textContent='Download Backup Monthly'}},30000);
    }catch(e){if(button){button.disabled=false;button.textContent='Download Backup Monthly'}alert(e.message||'Gagal memulai download backup.')}
  }
  async function refresh(){
    if(!allowed()){remove();return}
    try{
      const d=await apiCall('GET','/cloudinary-backup/reminder');
      if(!d?.active||!d.item){remove();return}
      ensureCss();let el=document.getElementById(ID);
      if(!el){el=document.createElement('div');el.id=ID;document.querySelector('.topbar')?.insertAdjacentElement('afterend',el)}
      if(!el)return;
      const x=d.item;
      el.innerHTML='<div>⚠️ <b>Backup foto monthly '+esc(x.period)+'</b> akan dihapus dari VPS dalam <b>'+esc(x.days_left)+' hari</b> ('+esc(x.expiry_date)+'). Segera simpan backup ke komputer lokal.</div><div class="pxl-cb-actions">'+(x.archive_ready?'<button type="button" class="btn sm primary" id="pxl-cb-download">⬇ Download Backup Monthly</button>':'<span class="st-chip warn">ARSIP SEDANG DISIAPKAN</span>')+'</div>';
      const b=el.querySelector('#pxl-cb-download');if(b)b.onclick=()=>download(x.period,b);
    }catch(_){}
  }
  setInterval(refresh,60000);
  setTimeout(refresh,1800);
  window.PXL_CLOUDINARY_BACKUP_REMINDER={refresh,download,revision:'PXL-SYS-0001B'};
})();
