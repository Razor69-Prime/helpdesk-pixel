/* PXL-PROD-0022A/0022B — Sales Order Site Structure + Copy Site + Site Template */
(function(){
  'use strict';

  const REV='PXL-PROD-0022D';
  const $=id=>document.getElementById(id);
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const uid=()=> (crypto?.randomUUID?.() || ('site-'+Date.now()+'-'+Math.random().toString(16).slice(2)));
  const clone=v=>JSON.parse(JSON.stringify(v));
  function getOPT(){try{return typeof OPT!=='undefined'&&OPT?OPT:{sales_users:[],inventory_items:[]};}catch(_){return {sales_users:[],inventory_items:[]};}}
  function getD(){try{return typeof D!=='undefined'&&D?D:{sales_orders:[]};}catch(_){return {sales_orders:[]};}}
  let sites=[];
  let activeSiteId='';
  let templates=[];
  let installed=false;
  let mode='operational';
  let operationalItems=[];

  const base={
    collect: window.collect,
    reset: window.reset,
    editSO: window.editSO,
    updateTotals: window.updateTotals
  };

  function notify(msg){
    try{ if(typeof window.toast==='function') return window.toast(msg); }catch(_){ }
    alert(msg);
  }

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function isProjectMode(){ return mode==='project'; }

  function setMode(next,{fromEdit=false}={}){
    const target=next==='project'?'project':'operational';
    const previous=mode;

    if(previous==='operational' && target==='project' && !fromEdit){
      operationalItems=clone(readDomItems());
    }
    if(previous==='project' && target==='operational') captureActive();

    mode=target;
    const select=$('pxlSoMode');
    if(select) select.value=mode;

    if(isProjectMode()){
      if(!sites.length){
        sites=[blankSite('Site 01')];
        activeSiteId=sites[0].id;
      }
      if(!fromEdit && operationalItems.length && !(sites[0]?.items||[]).length){
        sites[0].items=clone(operationalItems);
      }
      if(!activeSiteId && sites[0]) activeSiteId=sites[0].id;
      writeActive();
    }else{
      if(fromEdit) operationalItems=clone(readDomItems());
      writeOperational();
      renderSiteBar();
      try{ base.updateTotals?.(); }catch(_){ }
    }
    syncModeUI();
  }

  function writeOperational(){
    if($('materialItems')) $('materialItems').innerHTML='';
    if($('serviceItems')) $('serviceItems').innerHTML='';
    const items=Array.isArray(operationalItems)?operationalItems:[];
    items.filter(x=>!['service','jasa'].includes(String(x.item_type||x.type||'item').toLowerCase())).forEach(x=>window.addMaterial?.(x));
    items.filter(x=>['service','jasa'].includes(String(x.item_type||x.type||'').toLowerCase())).forEach(x=>window.addService?.(x));
    if(!items.length) window.addMaterial?.();
    window.updateEmptyHints?.();
  }

  function syncModeUI(){
    const manager=$('pxlSiteManager');
    if(manager) manager.style.display=isProjectMode()?'block':'none';
    const badge=$('pxlSoModeNote');
    if(badge) badge.textContent=isProjectMode()
      ? 'Project: aktifkan Site, Copy Site, dan Template.'
      : 'Operasional: gunakan form SO sederhana seperti sebelumnya.';
    const materialTitle=document.querySelector('#materialItems')?.closest('.line-section')?.querySelector('.section-title');
    const serviceTitle=document.querySelector('#serviceItems')?.closest('.line-section')?.querySelector('.section-title');
    if(materialTitle) materialTitle.textContent=isProjectMode()?'A. Material / Barang — Site Aktif':'A. Material / Barang';
    if(serviceTitle) serviceTitle.textContent=isProjectMode()?'B. Jasa / Pekerjaan — Site Aktif':'B. Jasa / Pekerjaan';
  }

  function blankSite(name){
    return {id:uid(),name:name||`Site ${String(sites.length+1).padStart(2,'0')}`,items:[]};
  }

  function activeSite(){ return sites.find(x=>String(x.id)===String(activeSiteId)) || null; }

  function rowToMaterial(row){
    const id=row.dataset.inventoryId||'';
    const inventory=(getOPT().inventory_items||[]).find(x=>String(x.id)===String(id));
    const typed=row.querySelector('.item-search')?.value?.trim()||'';
    if(!typed && !inventory) return null;
    return {
      inventory_item_id: inventory?.id || id || null,
      name: inventory?.name || typed,
      item_name: inventory?.name || typed,
      sku: inventory?.sku || row.dataset.sku || null,
      qty: num(row.querySelector('.qty')?.value),
      unit: row.querySelector('.unit')?.value || inventory?.unit || 'pcs',
      unit_price: num(row.querySelector('.price')?.value),
      item_type:'item',
      stock_at_select: inventory?.stock ?? null,
      ppn_applied: row.dataset.ppnApplied==='1',
      ppn_rate: row.dataset.ppnApplied==='1' ? num(row.dataset.ppnRate) : 0,
      ppn_amount: row.dataset.ppnApplied==='1' ? (num(row.querySelector('.qty')?.value)*num(row.querySelector('.price')?.value)*num(row.dataset.ppnRate)/100) : 0
    };
  }

  function rowToService(row){
    const name=row.querySelector('.service-name')?.value?.trim()||'';
    if(!name) return null;
    return {
      inventory_item_id:null,
      name,
      item_name:name,
      qty:num(row.querySelector('.qty')?.value),
      unit:row.querySelector('.unit')?.value?.trim()||'jasa',
      unit_price:num(row.querySelector('.price')?.value),
      item_type:'service',
      ppn_applied: row.dataset.ppnApplied==='1',
      ppn_rate: row.dataset.ppnApplied==='1' ? num(row.dataset.ppnRate) : 0,
      ppn_amount: row.dataset.ppnApplied==='1' ? (num(row.querySelector('.qty')?.value)*num(row.querySelector('.price')?.value)*num(row.dataset.ppnRate)/100) : 0
    };
  }

  function readDomItems(){
    const out=[];
    document.querySelectorAll('.material-row').forEach(r=>{const x=rowToMaterial(r);if(x)out.push(x);});
    document.querySelectorAll('.service-row').forEach(r=>{const x=rowToService(r);if(x)out.push(x);});
    return out;
  }

  function captureActive(){
    const s=activeSite();
    if(s) s.items=readDomItems();
  }

  function writeActive(){
    const s=activeSite();
    if(!s) return;
    if($('materialItems')) $('materialItems').innerHTML='';
    if($('serviceItems')) $('serviceItems').innerHTML='';
    const items=Array.isArray(s.items)?s.items:[];
    items.filter(x=>!['service','jasa'].includes(String(x.item_type||x.type||'item').toLowerCase())).forEach(x=>window.addMaterial?.(x));
    items.filter(x=>['service','jasa'].includes(String(x.item_type||x.type||'').toLowerCase())).forEach(x=>window.addService?.(x));
    window.updateEmptyHints?.();
    renderSiteBar();
    updateProjectTotals();
  }

  function siteStats(site){
    const items=Array.isArray(site?.items)?site.items:[];
    const material=items.filter(x=>!['service','jasa'].includes(String(x.item_type||x.type||'item').toLowerCase()));
    const service=items.filter(x=>['service','jasa'].includes(String(x.item_type||x.type||'').toLowerCase()));
    const total=items.reduce((s,x)=>s+num(x.qty)*num(x.unit_price),0);
    return {material:material.length,service:service.length,total};
  }

  function renderSiteBar(){
    const tabs=$('pxlSiteTabs');
    if(!tabs) return;
    tabs.innerHTML=sites.map((s,i)=>{
      const st=siteStats(s);
      return `<button type="button" class="pxl-site-tab${String(s.id)===String(activeSiteId)?' active':''}" data-site="${esc(s.id)}"><b>${esc(s.name)}</b><small>${st.material} material · ${st.service} jasa</small></button>`;
    }).join('');
    tabs.querySelectorAll('[data-site]').forEach(btn=>btn.onclick=()=>switchSite(btn.dataset.site));
    const name=$('pxlActiveSiteName'); if(name) name.textContent=activeSite()?.name||'-';
  }

  function switchSite(id){
    if(String(id)===String(activeSiteId)) return;
    captureActive();
    activeSiteId=id;
    writeActive();
  }

  function addSite(){
    captureActive();
    const s=blankSite(`Site ${String(sites.length+1).padStart(2,'0')}`);
    sites.push(s); activeSiteId=s.id; writeActive();
  }

  function copySite(){
    captureActive();
    const src=activeSite(); if(!src) return;
    const defaultName=`Site ${String(sites.length+1).padStart(2,'0')}`;
    const name=(prompt('Nama site hasil copy:',defaultName)||'').trim();
    if(!name) return;
    const s={id:uid(),name,items:clone(src.items||[])};
    sites.push(s); activeSiteId=s.id; writeActive();
  }

  function renameSite(){
    captureActive();
    const s=activeSite(); if(!s) return;
    const name=(prompt('Nama site:',s.name)||'').trim();
    if(!name) return;
    s.name=name; renderSiteBar();
  }

  function deleteSite(){
    if(sites.length<=1) return notify('Minimal satu Site harus tersedia.');
    const s=activeSite(); if(!s) return;
    if(!confirm(`Hapus ${s.name}?`)) return;
    const idx=sites.findIndex(x=>x.id===s.id);
    sites.splice(idx,1);
    activeSiteId=(sites[Math.max(0,idx-1)]||sites[0]).id;
    writeActive();
  }

  function allItems(){
    captureActive();
    const out=[];
    sites.forEach((s,siteIndex)=>{
      (s.items||[]).forEach((x,itemIndex)=>out.push({
        ...clone(x),
        site_id:s.id,
        site_name:s.name,
        site_order:siteIndex+1,
        site_item_order:itemIndex+1
      }));
    });
    return out;
  }

  function validateSites(items){
    if(!sites.length) throw new Error('Tambahkan minimal satu Site.');
    for(const s of sites){
      if(!String(s.name||'').trim()) throw new Error('Nama Site wajib diisi.');
      if(!(s.items||[]).length) throw new Error(`${s.name} belum memiliki Material/Jasa.`);
    }
    for(const x of items){
      if(!x.name || num(x.qty)<=0) throw new Error(`Item pada ${x.site_name} belum lengkap atau Qty tidak valid.`);
      const service=['service','jasa'].includes(String(x.item_type||x.type||'item').toLowerCase());
      if(!service && !x.inventory_item_id) throw new Error(`Material “${x.name}” pada ${x.site_name} wajib dipilih dari Inventory.`);
    }
  }

  function collectPatched(){
    if(!isProjectMode()) return base.collect?.();
    const salesPic=$('salesPic');
    const sales=(getOPT().sales_users||[]).find(u=>String(u.id)===String(salesPic?.value||''));
    const items=allItems();
    validateSites(items);
    const materialSubtotal=items.filter(x=>!['service','jasa'].includes(String(x.item_type||x.type||'item').toLowerCase())).reduce((s,x)=>s+num(x.qty)*num(x.unit_price),0);
    const serviceSubtotal=items.filter(x=>['service','jasa'].includes(String(x.item_type||x.type||'').toLowerCase())).reduce((s,x)=>s+num(x.qty)*num(x.unit_price),0);
    const ppnTotal=items.reduce((s,x)=>s+(x.ppn_applied?num(x.qty)*num(x.unit_price)*num(x.ppn_rate)/100:0),0);
    return {
      customer_name:$('customer')?.value.trim()||'',
      customer_phone:$('phone')?.value.trim()||'',
      sales_pic_user_id:sales?.id||null,
      sales_pic:sales?.name||'',
      project_name:$('projectName')?.value.trim()||'',
      quotation_title:$('projectName')?.value.trim()||'',
      address:$('address')?.value.trim()||'',
      location:$('address')?.value.trim()||'',
      notes:$('notes')?.value.trim()||'',
      items,
      material_subtotal:materialSubtotal,
      service_subtotal:serviceSubtotal,
      quotation_total:materialSubtotal+serviceSubtotal+ppnTotal,
      total_amount:materialSubtotal+serviceSubtotal+ppnTotal
    };
  }

  function buildSitesFromItems(items){
    const map=new Map();
    (Array.isArray(items)?items:[]).forEach((x,idx)=>{
      const key=String(x.site_id||'legacy-site-1');
      if(!map.has(key)) map.set(key,{id:key==='legacy-site-1'?uid():key,name:x.site_name||'Site 01',order:num(x.site_order)||1,items:[]});
      const y={...clone(x)};
      delete y.site_id; delete y.site_name; delete y.site_order; delete y.site_item_order;
      map.get(key).items.push({...y,_order:num(x.site_item_order)||idx+1});
    });
    const result=[...map.values()].sort((a,b)=>a.order-b.order);
    result.forEach(s=>{s.items.sort((a,b)=>num(a._order)-num(b._order));s.items.forEach(x=>delete x._order);delete s.order;});
    return result.length?result:[blankSite('Site 01')];
  }

  function resetSites(){
    sites=[blankSite('Site 01')];
    activeSiteId=sites[0].id;
    const s=activeSite(); s.items=readDomItems();
    renderSiteBar(); updateProjectTotals();
  }

  function resetPatched(){
    base.reset?.();
    sites=[blankSite('Site 01')];
    activeSiteId=sites[0].id;
    mode='operational';
    operationalItems=clone(readDomItems());
    setTimeout(()=>{ renderSiteBar(); syncModeUI(); },0);
  }

  function editPatched(id){
    const so=(getD().sales_orders||[]).find(x=>String(x.id)===String(id));
    base.editSO?.(id);
    if(!so || so.status!=='draft') return;
    const projectItems=(Array.isArray(so.items)?so.items:[]).some(x=>x.site_id||x.site_name);
    if(projectItems){
      operationalItems=[];
      sites=buildSitesFromItems(so.items);
      activeSiteId=sites[0].id;
      setMode('project',{fromEdit:true});
      writeActive();
    }else{
      operationalItems=clone(readDomItems());
      sites=[blankSite('Site 01')];
      activeSiteId=sites[0].id;
      setMode('operational',{fromEdit:true});
    }
  }

  function updateProjectTotals(){
    if(!isProjectMode()) return base.updateTotals?.();
    try{ base.updateTotals?.(); }catch(_){ }
    const current=readDomItems();
    let mat=0,svc=0,ppn=0;
    sites.forEach(s=>{
      const rows=String(s.id)===String(activeSiteId)?current:(s.items||[]);
      rows.forEach(x=>{
        const t=num(x.qty)*num(x.unit_price);
        if(['service','jasa'].includes(String(x.item_type||x.type||'').toLowerCase())) svc+=t; else mat+=t;
        if(x.ppn_applied) ppn+=t*num(x.ppn_rate)/100;
      });
    });
    const rp=v=>'Rp '+Math.round(v).toLocaleString('id-ID');
    if($('materialSubtotal')) $('materialSubtotal').textContent=rp(mat);
    if($('serviceSubtotal')) $('serviceSubtotal').textContent=rp(svc);
    if($('ppnTotal')) $('ppnTotal').textContent=rp(ppn);
    if($('grandTotal')) $('grandTotal').textContent=rp(mat+svc+ppn);
    return {materialSubtotal:mat,serviceSubtotal:svc,ppnTotal:ppn,grandTotal:mat+svc+ppn};
  }

  async function loadTemplates(){
    try{
      if(typeof window.api!=='function') return;
      const data=await window.api('GET','/api/sales-orders/site-templates');
      templates=Array.isArray(data)?data:[];
      renderTemplateOptions();
    }catch(_){ templates=[]; renderTemplateOptions(); }
  }

  function renderTemplateOptions(){
    const sel=$('pxlSiteTemplateSelect'); if(!sel) return;
    sel.innerHTML='<option value="">Pilih template...</option>'+templates.map(t=>`<option value="${esc(t.id)}">${esc(t.template_name)}</option>`).join('');
  }

  async function saveTemplate(){
    captureActive();
    const s=activeSite(); if(!s) return;
    if(!(s.items||[]).length) return notify('Site belum memiliki item untuk disimpan sebagai template.');
    const name=(prompt('Nama template:',s.name)||'').trim(); if(!name) return;
    try{
      const row=await window.api('POST','/api/sales-orders/site-templates',{template_name:name,description:`Template dari ${s.name}`,items:s.items});
      templates.unshift(row); renderTemplateOptions(); notify('Template Site tersimpan.');
    }catch(e){notify(e.message||'Gagal menyimpan template.');}
  }

  function useTemplate(){
    captureActive();
    const id=$('pxlSiteTemplateSelect')?.value;
    const t=templates.find(x=>String(x.id)===String(id));
    if(!t) return notify('Pilih template terlebih dahulu.');
    const defaultName=`Site ${String(sites.length+1).padStart(2,'0')}`;
    const name=(prompt('Nama Site baru:',defaultName)||'').trim(); if(!name) return;
    const s={id:uid(),name,items:clone(Array.isArray(t.items)?t.items:[])};
    sites.push(s); activeSiteId=s.id; writeActive();
  }

  function installUI(){
    if($('pxlSiteManager')) return;
    const materialSection=$('materialItems')?.closest('.line-section');
    if(!materialSection) return;

    const modeBox=document.createElement('div');
    modeBox.id='pxlSoModeBox';
    modeBox.className='full pxl-so-mode-box';
    modeBox.innerHTML=`
      <div>
        <label>Jenis Sales Order</label>
        <select id="pxlSoMode">
          <option value="operational">Operasional</option>
          <option value="project">Project</option>
        </select>
      </div>
      <div class="sub" id="pxlSoModeNote">Operasional: gunakan form SO sederhana seperti sebelumnya.</div>`;
    materialSection.parentElement.insertBefore(modeBox,materialSection);

    const box=document.createElement('div');
    box.id='pxlSiteManager'; box.className='full pxl-site-manager';
    box.innerHTML=`
      <div class="pxl-site-head">
        <div><b>Project Site</b><div class="sub">${REV} — Kelola Site, Copy Site, dan Template Site.</div></div>
        <div class="pxl-site-actions">
          <button class="btn" type="button" id="pxlAddSite">+ Tambah Site</button>
          <button class="btn" type="button" id="pxlCopySite">Copy Site</button>
          <button class="btn" type="button" id="pxlRenameSite">Rename</button>
          <button class="btn bad" type="button" id="pxlDeleteSite">Hapus Site</button>
        </div>
      </div>
      <div id="pxlSiteTabs" class="pxl-site-tabs"></div>
      <div class="pxl-template-row">
        <div><b>Site aktif: <span id="pxlActiveSiteName">-</span></b></div>
        <select id="pxlSiteTemplateSelect"><option value="">Pilih template...</option></select>
        <button class="btn" type="button" id="pxlSaveTemplate">Simpan sebagai Template</button>
        <button class="btn service" type="button" id="pxlUseTemplate">Gunakan Template</button>
      </div>`;
    materialSection.parentElement.insertBefore(box,materialSection);

    const style=document.createElement('style');
    style.textContent=`
      .pxl-so-mode-box{display:grid;grid-template-columns:minmax(220px,320px) 1fr;gap:12px;align-items:end;border:1px solid #d9d5cb;border-radius:11px;padding:12px;background:#fff;margin-bottom:4px}
      .pxl-so-mode-box label{display:block;margin-bottom:5px}.pxl-so-mode-box .sub{padding-bottom:9px}
      .pxl-site-manager{border:1px solid #d9d5cb;border-radius:11px;padding:12px;background:#fffaf6;margin-bottom:4px}
      .pxl-site-head,.pxl-site-actions,.pxl-template-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between}
      .pxl-site-tabs{display:flex;gap:7px;overflow:auto;padding:10px 0 4px}
      .pxl-site-tab{min-width:150px;border:1px solid #ddd6cb;background:#fff;padding:9px 11px;border-radius:9px;text-align:left;cursor:pointer}
      .pxl-site-tab.active{border-color:#df7b3b;background:#fff1e6;box-shadow:inset 0 0 0 1px #df7b3b}
      .pxl-site-tab b,.pxl-site-tab small{display:block}.pxl-site-tab small{margin-top:3px;color:#756f66}
      .pxl-template-row{margin-top:8px;padding-top:9px;border-top:1px solid #eadfd3}.pxl-template-row select{width:auto;min-width:210px}
      @media(max-width:700px){.pxl-so-mode-box{grid-template-columns:1fr}.pxl-template-row>*{width:100%!important}.pxl-site-actions{width:100%}.pxl-site-actions .btn{flex:1}}
    `;
    document.head.appendChild(style);
    $('pxlSoMode').onchange=e=>setMode(e.target.value);
    $('pxlAddSite').onclick=addSite;
    $('pxlCopySite').onclick=copySite;
    $('pxlRenameSite').onclick=renameSite;
    $('pxlDeleteSite').onclick=deleteSite;
    $('pxlSaveTemplate').onclick=saveTemplate;
    $('pxlUseTemplate').onclick=useTemplate;
  }

  function install(){
    if(installed) return;
    if(typeof window.addMaterial!=='function' || typeof window.addService!=='function' || !$('materialItems')) return setTimeout(install,100);
    installed=true;
    window.collect=collectPatched;
    window.reset=resetPatched;
    window.editSO=editPatched;
    window.updateTotals=updateProjectTotals;
    installUI();
    sites=[blankSite('Site 01')];
    activeSiteId=sites[0].id;
    mode='operational';
    operationalItems=clone(readDomItems());
    renderSiteBar();
    syncModeUI();
    loadTemplates();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();
