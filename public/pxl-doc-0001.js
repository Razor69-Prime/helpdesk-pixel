/* PXL-DOC-0001 — standalone read-only Project photo PDF composer. */
(()=>{
'use strict';
const PERMS=['project_documentation_view','project_documentation_export','project_documentation_manage'];
const state={projects:[],photos:[],selected:new Set(),project:null,notes:new Map()};
const root=()=>document.getElementById('pxl-doc-root');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role=()=>String(currentUser?.role||'').toLowerCase().replace(/[ _-]/g,'');
const can=p=>role()==='superadmin'||(Array.isArray(currentUser?.custom_menus)&&window.currentUser.custom_menus.includes(p));
const canRead=()=>can(PERMS[0]);
const canExport=()=>canRead()&&can(PERMS[1]);
const canManage=()=>canRead()&&can(PERMS[2]);
async function read(path){
 const data=await api('GET',path);
 return data;
}
function err(e){if(root())root().querySelector('#pxl-doc-message').textContent=e?.message||String(e);}
async function open(){
 if(!canRead()){if(root())root().innerHTML='<p>Akses Dokumentasi Project tidak diizinkan.</p>';return;}
 root().innerHTML='<div class="proj-card" style="padding:22px"><h2>Dokumentasi Project</h2><p id="pxl-doc-message" style="color:var(--muted);margin:10px 0">Memuat daftar project…</p><div id="pxl-doc-body"></div></div>';
 try{
  state.projects=await read('/project-documentation/projects');
  root().querySelector('#pxl-doc-message').textContent='Pilih project untuk menyusun laporan dokumentasi foto.';
  root().querySelector('#pxl-doc-body').innerHTML='<label>Project <select id="pxl-doc-project" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px"><option value="">— Pilih project —</option>'+state.projects.map(p=>'<option value="'+esc(p.id)+'">'+esc((p.project_number||'')+' — '+(p.nama_project||p.name||'Project'))+'</option>').join('')+'</select></label><div id="pxl-doc-gallery" style="margin-top:18px"></div>';
  root().querySelector('#pxl-doc-project').addEventListener('change',e=>loadProject(e.target.value));
 }catch(e){err(e);}
}
async function loadProject(id){
 state.project=state.projects.find(x=>String(x.id)===String(id))||null;
 state.photos=[];state.selected.clear();state.notes.clear();
 const target=root().querySelector('#pxl-doc-gallery');
 if(!id){target.innerHTML='';return;}
 target.textContent='Memuat foto Project Tracker…';
 try{
  const rows=await read('/project-documentation/projects/'+encodeURIComponent(id)+'/photos');
  state.photos=Array.isArray(rows)?rows:[];
  render();
 }catch(e){target.textContent='Gagal memuat dokumentasi: '+e.message;}
}
function render(){
 const target=root().querySelector('#pxl-doc-gallery');
 if(!state.photos.length){target.innerHTML='<p>Belum tersedia foto aktif pada project ini.</p>';return;}
 const allowed=canManage();
 target.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px"><b>'+state.photos.length+' foto Project Tracker</b><label>Layout <select id="pxl-doc-count"><option value="4">4 foto/halaman</option><option value="6">6 foto/halaman</option></select></label><button type="button" class="btn ghost sm" id="pxl-doc-all">Pilih semua</button><button type="button" class="btn primary" id="pxl-doc-pdf" '+(!canExport()?'disabled':'')+'>Download PDF</button></div><p style="font-size:12px;color:var(--muted);margin-bottom:12px">Keterangan hanya berlaku pada PDF, tidak mengubah foto atau BOQ existing. Before/After opsional.</p><div id="pxl-doc-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:14px"></div>';
 const grid=root().querySelector('#pxl-doc-grid');
 grid.innerHTML=state.photos.map((p,i)=>'<article style="border:1px solid var(--border);border-radius:10px;padding:10px;background:white"><label style="display:flex;gap:8px;align-items:center;margin-bottom:7px"><input type="checkbox" data-doc-check="'+i+'"> <strong>'+esc(p.item_name||'Item Project')+'</strong></label><img alt="Dokumentasi Project" loading="lazy" src="'+esc(p.image_url||'')+'" style="width:100%;aspect-ratio:4/3;object-fit:contain;background:#f3f4f6;border-radius:6px"><label style="font-size:12px;display:block;margin:8px 0">Site (opsional)<input data-doc-site="'+i+'" placeholder="Nama site" '+(!allowed?'disabled':'')+' style="width:100%;padding:7px;border:1px solid #ddd;border-radius:6px"></label><label style="font-size:12px;display:block;margin-bottom:8px">Keterangan pekerjaan<textarea data-doc-note="'+i+'" rows="2" '+(!allowed?'disabled':'')+' style="width:100%;padding:7px;border:1px solid #ddd;border-radius:6px" placeholder="Keterangan singkat dan jelas">'+'</textarea></label><div style="display:flex;gap:6px;margin:6px 0"><button type="button" class="btn ghost sm" '+(!allowed?'disabled':'')+' data-doc-up="'+i+'">↑</button><button type="button" class="btn ghost sm" '+(!allowed?'disabled':'')+' data-doc-down="'+i+'">↓</button></div><label style="font-size:12px">Kategori <select data-doc-category="'+i+'" '+(!allowed?'disabled':'')+'><option value="">Umum</option><option>Before</option><option>Progress</option><option>After</option></select></label></article>').join('');
 grid.querySelectorAll('[data-doc-check]').forEach(el=>{el.checked=state.selected.has(String(state.photos[Number(el.dataset.docCheck)].id));});
 grid.querySelectorAll('[data-doc-note]').forEach(el=>{const n=state.notes.get(String(state.photos[Number(el.dataset.docNote)].id));if(n){el.value=n.note;grid.querySelector('[data-doc-site=\"'+el.dataset.docNote+'\"]').value=n.site;grid.querySelector('[data-doc-category=\"'+el.dataset.docNote+'\"]').value=n.category;}});
 grid.querySelectorAll('[data-doc-check]').forEach(el=>el.addEventListener('change',()=>{const i=+el.dataset.docCheck;const key=String(state.photos[i].id);el.checked?state.selected.add(key):state.selected.delete(key);}));
 grid.querySelectorAll('[data-doc-up],[data-doc-down]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.docUp??el.dataset.docDown);const j=i+(el.dataset.docUp!==undefined?-1:1);if(j<0||j>=state.photos.length)return;grid.querySelectorAll('[data-doc-note]').forEach(field=>{const p=state.photos[Number(field.dataset.docNote)];state.notes.set(String(p.id),{note:field.value,site:grid.querySelector('[data-doc-site=\"'+field.dataset.docNote+'\"]')?.value||'',category:grid.querySelector('[data-doc-category=\"'+field.dataset.docNote+'\"]')?.value||''});});[state.photos[i],state.photos[j]]=[state.photos[j],state.photos[i]];render();});
 root().querySelector('#pxl-doc-all').onclick=()=>{const all=state.selected.size!==state.photos.length;state.selected=new Set(all?state.photos.map(p=>String(p.id)):[]);grid.querySelectorAll('[data-doc-check]').forEach(el=>el.checked=all);};
 root().querySelector('#pxl-doc-pdf').onclick=exportPdf;
}
function wrap(doc,txt,x,y,width,lineHeight,maxLines){
 const lines=doc.splitTextToSize(String(txt||''),width).slice(0,maxLines);
 lines.forEach((line,i)=>doc.text(line,x,y+i*lineHeight));
}
async function imgData(url){
 const token=await waitForAppToken();
 const r=await fetch(url,{credentials:'same-origin',headers:{Authorization:'Bearer '+token,'X-Auth-Token':token}});
 if(!r.ok)throw new Error('Foto gagal diambil (HTTP '+r.status+').');
 const blob=await r.blob();
 const object=URL.createObjectURL(blob);
 try{
  const image=new Image();image.crossOrigin='anonymous';
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=object;});
  const canvas=document.createElement('canvas');const scale=Math.min(1,1200/Math.max(image.width,image.height));
  canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  return {data:canvas.toDataURL('image/jpeg',0.82),w:canvas.width,h:canvas.height};
 }finally{URL.revokeObjectURL(object);}
}
async function exportPdf(){
 if(!canExport())return;
 const selected=state.photos.map((p,i)=>({...p,index:i})).filter(p=>state.selected.has(String(p.id)));
 if(!selected.length){alert('Pilih minimal satu foto.');return;}
 if(!window.jspdf?.jsPDF){alert('Library PDF tidak tersedia.');return;}
 const btn=root().querySelector('#pxl-doc-pdf');btn.disabled=true;btn.textContent='Membuat PDF…';
 try{
  const doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const perPage=Number(root().querySelector('#pxl-doc-count').value)===6?6:4;
  const margin=12,gap=7,colW=(210-margin*2-gap)/2,headerH=39,footer=10;
  const rows=perPage/2,cellH=(297-headerH-footer-8)/rows,photoH=cellH-(perPage===6?25:32);
  for(let i=0;i<selected.length;i++){
   if(i>0&&i%perPage===0)doc.addPage();
   const p=selected[i],n=i%perPage;
   if(n===0){
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('PIXEL SOLUSINDO',105,14,{align:'center'});
    doc.setFontSize(11);doc.text('LAPORAN DOKUMENTASI PROJECT',105,21,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(8);
    wrap(doc,(state.project?.project_number||'')+' | '+(state.project?.nama_project||state.project?.name||''),margin,29,186,4,2);
    doc.setDrawColor(180);doc.line(margin,37,198,37);
   }
   const x=margin+(n%2)*(colW+gap), y=headerH+Math.floor(n/2)*cellH;
   doc.setDrawColor(210);doc.rect(x,y,colW,cellH-3);
   try{
    const img=await imgData('/api/project-documentation/photos/'+encodeURIComponent(p.id)+'/image');
    const ratio=Math.min((colW-4)/img.w,(photoH-4)/img.h);
    const w=img.w*ratio,h=img.h*ratio;
    doc.addImage(img.data,'JPEG',x+(colW-w)/2,y+2+(photoH-4-h)/2,w,h);
   }catch(e){throw new Error('Foto '+(i+1)+' tidak dapat dimuat: '+e.message);}
   const ix=p.index;
   const val=sel=>root().querySelector('['+sel+'="'+ix+'"]')?.value||'';
   const site=canManage()?val('data-doc-site'):'';
   const note=canManage()?val('data-doc-note'):'';
   const cat=canManage()?val('data-doc-category'):'';
   doc.setFont('helvetica','bold');doc.setFontSize(perPage===6?8:9);
   wrap(doc,p.item_name||'Pekerjaan Project',x+3,y+photoH+2,colW-6,3.8,2);
   doc.setFont('helvetica','normal');doc.setFontSize(perPage===6?7:8);
   const detail=[site?'Site: '+site:'',cat?'Kategori: '+cat:'',note].filter(Boolean).join(' | ');
   wrap(doc,detail,x+3,y+photoH+(perPage===6?10:12),colW-6,3.4,perPage===6?3:5);
   doc.setFontSize(7);doc.text('Halaman '+doc.internal.getCurrentPageInfo().pageNumber,198,290,{align:'right'});
  }
  const filename='Dokumentasi_'+String(state.project?.project_number||'Project').replace(/[^A-Za-z0-9_-]/g,'_')+'.pdf';
  doc.save(filename);
 }catch(e){alert('Gagal membuat PDF: '+e.message);}
 finally{btn.disabled=false;btn.textContent='Download PDF';}
}
window.pxlProjectDocumentation={open,canRead};
})();