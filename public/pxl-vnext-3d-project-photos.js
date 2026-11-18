(function(){
  'use strict';
  const REV='PXL-URG-0115';
  const MAX_DIM=1920;
  const JPEG_QUALITY=0.88;
  let ctxState=null;
  // Limit photo proxy requests. A large project can contain hundreds of photos.
  const MAX_PARALLEL_PHOTOS=4;
  let photoObserver=null,photoQueue=[],photoInFlight=0;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function apiCall(method,path,body){return window.api(method,path,body);}
  // PXL-URG-0116F — retry only idempotent gallery GETs when gateway briefly fails.
  const temporaryGatewayError=e=>/\b(502|503|504)\b|bad gateway|gateway timeout|service unavailable|upstream/i.test(String(e?.message||e));
  const politePhotoError=e=>temporaryGatewayError(e)?'Server foto sementara tidak merespons (502/503/504). Silakan klik Muat Ulang Foto. Data foto tidak dihapus.':String(e?.message||'Gagal memuat foto.').slice(0,240);
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function galleryGet(path){
    for(let attempt=0;attempt<3;attempt++){
      try{return await apiCall('GET',path)}
      catch(e){if(!temporaryGatewayError(e)||attempt===2)throw e;await delay(attempt===0?350:850)}
    }
  }
  async function photoFetch(url,headers){
    for(let attempt=0;attempt<3;attempt++){
      try{
        const r=await fetch(url,{cache:'no-store',headers});
        if(![502,503,504].includes(r.status)||attempt===2)return r;
      }catch(e){if(attempt===2)throw e;}
      await delay(attempt===0?350:850);
    }
  }

  function authToken(){return String(window.__pxlAuthToken||localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||'').trim()}
  function downloadName(response,fallback){const raw=response.headers.get('content-disposition')||'';const m=raw.match(/filename="?([^";]+)"?/i);return (m&&m[1])||fallback}
  async function downloadWithAuth(url,fallbackName){
    const token=authToken();if(!token)throw new Error('Token login belum tersedia. Refresh lalu login kembali.');
    const response=await photoFetch(url,{Authorization:'Bearer '+token,'X-Auth-Token':token});
    if(!response.ok){let msg='Download foto gagal.';try{const data=await response.json();msg=data.error||msg}catch(_){}throw new Error(politePhotoError(response.status>=500?new Error('HTTP '+response.status):new Error(msg)))}
    const blob=await response.blob(),objectUrl=URL.createObjectURL(blob),a=document.createElement('a');a.href=objectUrl;a.download=downloadName(response,fallbackName);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);
  }
  async function projectPhotoBlobUrl(photoId){
    const state=ctxState;if(!state)throw new Error('Galeri foto belum siap.');
    const key=String(photoId||'');
    if(state.photoObjectUrls?.has(key))return state.photoObjectUrls.get(key);
    const token=authToken();if(!token)throw new Error('Token login belum tersedia. Refresh lalu login kembali.');
    const response=await photoFetch(`/api/project-report-item-photos/${encodeURIComponent(photoId)}/download`,{Authorization:'Bearer '+token,'X-Auth-Token':token});
    if(!response.ok){let msg='Foto gagal dimuat.';try{const data=await response.json();msg=data.error||msg}catch(_){}throw new Error(politePhotoError(response.status>=500?new Error('HTTP '+response.status):new Error(msg)))}
    const blob=await response.blob(),objectUrl=URL.createObjectURL(blob);
    if(ctxState!==state){URL.revokeObjectURL(objectUrl);return null}
    state.photoObjectUrls.set(key,objectUrl);return objectUrl;
  }
  function approvedCloudinaryUrl(photo){
    try{
      const url=new URL(String(photo?.secure_url||''));
      return url.protocol==='https:'&&url.hostname==='res.cloudinary.com'&&url.pathname.includes('/image/upload/')?url.href:null;
    }catch(_){return null}
  }
  // Render a vetted Cloudinary URL as an image instead of piping the entire
  // original photograph through Node/Nginx for every thumbnail.
  // Keep the authenticated proxy as a fallback for legacy photos.
  function loadPhotoImage(img,photoId,state){
    const photo=[...(state.photos||[]),...(state.projectPhotos||[])].find(x=>String(x.id)===String(photoId));
    const direct=approvedCloudinaryUrl(photo);
    const tryImage=url=>new Promise((resolve,reject)=>{
      if(state!==ctxState||!img.isConnected)return resolve(null);
      let finished=false;
      const finish=(ok)=>{if(finished)return;finished=true;img.onload=null;img.onerror=null;ok?resolve(url):reject(new Error('Foto tidak dapat ditampilkan.'))};
      img.onload=()=>finish(true);img.onerror=()=>finish(false);
      img.src=url;
    });
    if(direct){
      return tryImage(direct).catch(async()=>{
        if(state!==ctxState||!img.isConnected)return null;
        const fallback=await projectPhotoBlobUrl(photoId);
        return fallback?tryImage(fallback):null;
      });
    }
    return projectPhotoBlobUrl(photoId).then(url=>url?tryImage(url):null);
  }
  function pumpPhotoQueue(){
    while(photoInFlight<MAX_PARALLEL_PHOTOS&&photoQueue.length){
      const job=photoQueue.shift();if(job.state!==ctxState||!job.img.isConnected)continue;
      photoInFlight++;
      loadPhotoImage(job.img,job.photoId,job.state).then(url=>{
        if(!url||job.state!==ctxState||!job.img.isConnected)return;
        const link=job.img.closest('[data-p3d-photo-link]');if(link)link.href=url;
      }).catch(e=>{
        if(job.state!==ctxState||!job.img.isConnected)return;
        job.img.alt='Foto gagal dimuat';
        const el=document.getElementById('pxl3d-error');if(el)el.textContent=politePhotoError(e);
      }).finally(()=>{photoInFlight--;pumpPhotoQueue()});
    }
  }
  function watchPhotoThumbnails(box){
    photoObserver?.disconnect();photoObserver=null;photoQueue=[];
    const images=[...box.querySelectorAll('[data-p3d-photo-id],[data-p3d-project-photo]')];
    const enqueue=img=>{
      if(img.dataset.pxlQueued==='1')return;
      img.dataset.pxlQueued='1';
      photoQueue.push({state:ctxState,img,photoId:img.dataset.p3dPhotoId||img.dataset.p3dProjectPhoto});
      pumpPhotoQueue();
    };
    // Only photos entering the viewport are downloaded. Legacy browsers use
    // the same bounded queue so they never issue hundreds of requests at once.
    if(typeof IntersectionObserver==='function'){
      photoObserver=new IntersectionObserver(entries=>{
        for(const entry of entries)if(entry.isIntersecting){photoObserver?.unobserve(entry.target);enqueue(entry.target)}
      },{rootMargin:'180px'});
      images.forEach(img=>photoObserver.observe(img));
    }else images.forEach(enqueue);
  }
  function showPreview(blob){const img=document.getElementById('pxl3d-preview');if(!img)return;if(ctxState?.previewUrl)URL.revokeObjectURL(ctxState.previewUrl);ctxState.previewUrl=URL.createObjectURL(blob);img.src=ctxState.previewUrl;img.style.display='block'}
  function ensureStyle(){if(document.getElementById('pxl3d-photo-style'))return;const s=document.createElement('style');s.id='pxl3d-photo-style';s.textContent='.p3d-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:11050;display:flex;align-items:center;justify-content:center;padding:14px}.p3d-box{width:min(980px,100%);max-height:94vh;overflow:auto;background:var(--surface,#fff);border-radius:16px;padding:16px}.p3d-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.p3d-actions{display:flex;gap:8px;flex-wrap:wrap}.p3d-drop{border:1px dashed var(--border,#ddd);border-radius:12px;padding:12px;margin-top:12px}.p3d-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:12px}.p3d-card{border:1px solid var(--border,#ddd);border-radius:12px;overflow:hidden;background:var(--surface,#fff)}.p3d-card img{width:100%;height:125px;object-fit:cover;display:block}.p3d-meta{padding:8px;font-size:11px}.p3d-selected{outline:2px solid var(--accent,#f47f42)}.p3d-status{font-size:12px;color:var(--muted,#777);margin-top:8px}.p3d-error{font-size:12px;color:#b42318;margin-top:8px}.p3d-preview{max-width:100%;max-height:280px;border-radius:10px;margin-top:8px}.p3d-section-title{font-size:12px;font-weight:700;margin-top:14px;color:var(--text,#111827)}';document.head.appendChild(s)}
  function close(){photoObserver?.disconnect();photoObserver=null;photoQueue=[];if(ctxState?.previewUrl)URL.revokeObjectURL(ctxState.previewUrl);if(ctxState?.photoObjectUrls)for(const url of ctxState.photoObjectUrls.values())URL.revokeObjectURL(url);document.getElementById('pxl3d-photo-modal')?.remove();ctxState=null}
  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Gambar gagal dibaca.'));img.src=src})}
  async function imageFromFile(file){const url=URL.createObjectURL(file);try{return await loadImage(url)}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}}
  async function renderPlainImage(file){
    const img=await imageFromFile(file);const ratio=Math.min(1,MAX_DIM/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));const w=Math.max(1,Math.round((img.naturalWidth||img.width)*ratio)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*ratio));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.drawImage(img,0,0,w,h);
    return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Foto gagal diproses.')),'image/jpeg',JPEG_QUALITY));
  }
  async function processAndUpload(file,source){
    const status=document.getElementById('pxl3d-status');const err=document.getElementById('pxl3d-error');err.textContent='';status.textContent=`Memproses foto ${file.name}...`;const evidenceTime=new Date().toISOString();const blob=await renderPlainImage(file);showPreview(blob);status.textContent=`Foto siap · upload ${file.name}...`;
    const sig=await apiCall('POST',`/project-report-items/${encodeURIComponent(ctxState.item.id)}/photos/signature`,{});const fd=new FormData();fd.append('file',blob,file.name.replace(/\.[^.]+$/,'.jpg'));fd.append('api_key',sig.api_key);fd.append('timestamp',String(sig.timestamp));fd.append('public_id',sig.public_id);fd.append('signature',sig.signature);status.textContent=`Upload ${file.name}...`;const r=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloud_name)}/image/upload`,{method:'POST',body:fd});const cloud=await r.json();if(!r.ok)throw new Error(cloud?.error?.message||'Upload Cloudinary gagal.');
    const semantics=source==='camera'?'documentation':'upload';const saved=await apiCall('POST',`/project-report-items/${encodeURIComponent(ctxState.item.id)}/photos`,{secure_url:cloud.secure_url,cloudinary_public_id:cloud.public_id,original_filename:file.name,generated_filename:sig.generated_filename,source_type:source,latitude:null,longitude:null,address_text:'GPS dinonaktifkan',location_label:null,evidence_time:evidenceTime,time_semantics:semantics});ctxState.selected.add(String(saved.id));emitSelection();return saved;
  }
  async function uploadFiles(source,input){const files=Array.from(input.files||[]);if(!files.length)return;const failures=[];for(const file of files){try{await processAndUpload(file,source)}catch(e){failures.push(`${file.name}: ${e.message}`)}}input.value='';document.getElementById('pxl3d-error').textContent=failures.join(' | ');document.getElementById('pxl3d-status').textContent=failures.length?`Selesai dengan ${failures.length} foto gagal.`:'Upload selesai.';await loadGallery()}
  function emitSelection(){const ids=[...ctxState.selected];ctxState.onSelectionChange?.(ids)}
  async function togglePhoto(id,checked){if(checked)ctxState.selected.add(String(id));else ctxState.selected.delete(String(id));emitSelection();renderGallery(ctxState.photos,ctxState.projectPhotos)}
  async function deletePhoto(id){if(!confirm('Hapus foto Project ini? History achievement tetap dipertahankan.'))return;await apiCall('DELETE',`/project-report-items/${encodeURIComponent(ctxState.item.id)}/photos/${encodeURIComponent(id)}`);ctxState.selected.delete(String(id));emitSelection();await loadGallery()}
  function renderGallery(rows,projectRows){
    ctxState.photos=Array.isArray(rows)?rows:[];ctxState.projectPhotos=Array.isArray(projectRows)?projectRows:[];
    const box=document.getElementById('pxl3d-gallery');if(!box)return;
    const photoRole=String(ctxState.user?.role||'').toLowerCase().replace(/[ _-]/g,''),canDelete=['admin','superadmin'].includes(photoRole),canSelect=['technician','superadmin'].includes(photoRole);
    const itemHtml=ctxState.photos.length?'<div class="p3d-section-title">Foto Item Ini</div><div class="p3d-grid">'+ctxState.photos.map(p=>{const selected=ctxState.selected.has(String(p.id));const dt=new Date(p.evidence_time||p.uploaded_at).toLocaleString('id-ID');return `<div class="p3d-card ${selected?'p3d-selected':''}"><a data-p3d-photo-link="${esc(p.id)}" target="_blank" rel="noopener"><img data-p3d-photo-id="${esc(p.id)}" alt="Foto Project" loading="lazy"></a><div class="p3d-meta">${canSelect?`<label><input type="checkbox" data-p3d-select="${esc(p.id)}" ${selected?'checked':''}> Gunakan untuk Input Today</label>`:'<div class="p3d-status">Dokumentasi item</div>'}<div>${esc(p.source_type)} · ${esc(dt)}</div><div>${esc(p.location_label||p.address_text||'Alamat tidak tersedia')}</div><div>Bukti: ${Number(p.evidence_count||0)} achievement</div><div class="p3d-actions" style="margin-top:6px"><button class="btn sm" data-p3d-download="${esc(p.id)}">⬇ Download</button>${canDelete?`<button class="btn danger sm" data-p3d-delete="${esc(p.id)}">Hapus</button>`:''}</div></div></div>`}).join('')+'</div>':'<div class="p3d-section-title">Foto Item Ini</div><div class="p3d-status">Belum ada foto untuk item ini.</div>';
    const otherProjectPhotos=ctxState.projectPhotos.filter(p=>String(p.project_report_item_id)!==String(ctxState.item.id));
    const projectHtml=otherProjectPhotos.length?`<div class="p3d-section-title">Dokumentasi Project (${otherProjectPhotos.length})</div><div class="p3d-status">Foto dari item BOQ lain di project ini. Hanya untuk dilihat/download dari modal ini.</div><div class="p3d-grid">`+otherProjectPhotos.map(p=>{const dt=new Date(p.evidence_time||p.uploaded_at).toLocaleString('id-ID');return `<div class="p3d-card"><a data-p3d-photo-link="${esc(p.id)}" target="_blank" rel="noopener"><img data-p3d-project-photo="${esc(p.id)}" alt="Foto Project" loading="lazy"></a><div class="p3d-meta"><div><b>${esc(p.item_name||'Item Project')}</b></div><div>${esc(p.source_type)} · ${esc(dt)}</div><div>${esc(p.location_label||p.address_text||'Alamat tidak tersedia')}</div><div class="p3d-actions" style="margin-top:6px"><button class="btn sm" data-p3d-download="${esc(p.id)}">⬇ Download</button></div></div></div>`}).join('')+'</div>':'<div class="p3d-section-title">Dokumentasi Project</div><div class="p3d-status">Belum ada foto lain pada project ini.</div>';
    box.innerHTML=itemHtml+projectHtml;
    watchPhotoThumbnails(box);
    box.querySelectorAll('[data-p3d-select]').forEach(el=>el.onchange=()=>togglePhoto(el.dataset.p3dSelect,el.checked));
    box.querySelectorAll('[data-p3d-download]').forEach(el=>el.onclick=async()=>{try{await downloadWithAuth(`/api/project-report-item-photos/${encodeURIComponent(el.dataset.p3dDownload)}/download`,'project-photo.jpg')}catch(e){document.getElementById('pxl3d-error').textContent=e.message}});
    box.querySelectorAll('[data-p3d-delete]').forEach(el=>el.onclick=()=>deletePhoto(el.dataset.p3dDelete));
  }

  async function loadGallery(){
    const state=ctxState;if(!state)return;
    const err=document.getElementById('pxl3d-error');
    if(err)err.textContent='';
    const stamp=Date.now();
    const [itemResult,projectResult]=await Promise.allSettled([
      galleryGet(`/project-report-items/${encodeURIComponent(state.item.id)}/photos?v=${stamp}`),
      galleryGet(`/projects/${encodeURIComponent(state.project.id)}/photos?v=${stamp}`)
    ]);
    if(ctxState!==state)return;
    const itemOk=itemResult.status==='fulfilled',projectOk=projectResult.status==='fulfilled';
    if(itemOk||projectOk){
      renderGallery(itemOk?itemResult.value:state.photos,projectOk?projectResult.value:state.projectPhotos);
    }else if(!state.photos.length&&!state.projectPhotos.length){
      const host=document.getElementById('pxl3d-gallery');
      if(host)host.innerHTML='<div class="p3d-status">Galeri belum dapat dimuat. Foto yang tersimpan tetap aman.</div><button class="btn sm" id="pxl3d-retry-gallery">↻ Muat Ulang Foto</button>';
    }
    const failures=[itemResult,projectResult].filter(x=>x.status==='rejected');
    if(failures.length&&err)err.textContent=politePhotoError(failures[0].reason);
    const retry=document.getElementById('pxl3d-retry-gallery');
    if(retry)retry.onclick=loadGallery;
  }
  function open({project,item,user,selectedPhotoIds,onSelectionChange}){ensureStyle();close();ctxState={project,item,user,selected:new Set((selectedPhotoIds||[]).map(String)),onSelectionChange,photos:[],projectPhotos:[],previewUrl:null,photoObjectUrls:new Map()};const modal=document.createElement('div');modal.id='pxl3d-photo-modal';modal.className='p3d-modal';modal.innerHTML=`<div class="p3d-box"><div class="p3d-head"><div><b>📷 Foto Item Project</b><div class="p3d-status">Project ID: ${esc(project.project_number||project.id)} · ${esc(item.item_name||item.category||'Item')}</div></div><button class="btn sm" id="pxl3d-close">✕</button></div><div class="p3d-drop"><div class="p3d-actions"><label class="btn sm primary">📷 Kamera<input id="pxl3d-camera" type="file" accept="image/*" capture="environment" style="display:none"></label><label class="btn sm">🖼️ Galeri<input id="pxl3d-gallery-input" type="file" accept="image/*" multiple style="display:none"></label><button class="btn sm" data-p3d-download-all>⬇ Download Semua Foto</button></div><img id="pxl3d-preview" class="p3d-preview" alt="Preview foto" style="display:none"><div class="p3d-status" id="pxl3d-status">Foto akan diunggah tanpa watermark dan tanpa GPS.</div><div class="p3d-error" id="pxl3d-error"></div></div><div id="pxl3d-gallery"><div class="p3d-status">Memuat gallery...</div></div></div>`;document.body.appendChild(modal);modal.onclick=e=>{if(e.target===modal)close()};document.getElementById('pxl3d-close').onclick=close;document.getElementById('pxl3d-camera').onchange=e=>uploadFiles('camera',e.target);document.getElementById('pxl3d-gallery-input').onchange=e=>uploadFiles('gallery',e.target);document.querySelector('[data-p3d-download-all]').onclick=async()=>{try{await downloadWithAuth(`/api/project-report-items/${encodeURIComponent(item.id)}/photos/download-all`,`${project.project_number||project.id}-photos.zip`)}catch(e){document.getElementById('pxl3d-error').textContent=e.message}};loadGallery()}
  window.PXLProjectPhotos={open,close,revision:'PXL-URG-0116G'};
})();
