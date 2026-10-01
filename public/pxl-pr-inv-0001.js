/* PXL-PR-INV-0001 — Purchase Request Inventory fast search + pending Inventory reminder.
 * UI/data-metadata enhancement only. Existing PR approval, PDF, supplier and totals remain unchanged.
 */
(function(){
  'use strict';
  const REV='PXL-PR-INV-0001A';
  let catalog=[],loading=null,loadedAt=0;
  const MAX_AGE=5*60*1000;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const money=v=>'Rp '+Number(v||0).toLocaleString('id-ID');

  function addStyle(){
    if(document.getElementById('pxl-pr-inv-0001-style'))return;
    const st=document.createElement('style');st.id='pxl-pr-inv-0001-style';
    st.textContent=`
      #pr-items-body td.pr-inv-cell{position:relative;overflow:visible}
      .pr-inv-results{display:none;position:fixed;z-index:10000;max-height:270px;overflow:auto;background:#fff;border:1px solid var(--border,#ddd);border-radius:9px;box-shadow:0 12px 28px rgba(0,0,0,.18);text-align:left}
      .pr-inv-results.open{display:block}
      .pr-inv-opt{padding:8px 9px;border-bottom:1px solid #eee;cursor:pointer;line-height:1.3}
      .pr-inv-opt:last-child{border-bottom:0}.pr-inv-opt:hover{filter:brightness(.985)}
      .pr-inv-opt b{display:block;font-size:11.5px;color:var(--text,#222);overflow-wrap:anywhere}
      .pr-inv-opt small{display:block;font-size:10px;margin-top:2px;color:var(--muted,#777);overflow-wrap:anywhere}
      .pr-inv-opt.hpp-ready{background:#eef7e7;border-left:4px solid #7aaa45}
      .pr-inv-opt.hpp-missing{background:#fff6dc;border-left:4px solid #d1a12b}
      .pr-inv-opt.manual{background:#f7f7f8;border-left:4px solid #9299a1}
      .pr-inv-meta{font-size:9.5px;line-height:1.35;margin-top:3px;color:var(--muted,#777);overflow-wrap:anywhere}
      .pr-inv-meta.linked{color:#3b6d11}.pr-inv-meta.missing{color:#8a5a00}.pr-inv-meta.manual{color:#8a5a00}
      .pr-desc.pr-inv-linked{background:#f5faef!important}.pr-desc.pr-inv-missing{background:#fffaf0!important}.pr-desc.pr-inv-manual{background:#fff!important}
      .pr-inv-reminder{display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding:2px 7px;border-radius:99px;background:#fff1d6;color:#8a5a00;font-size:10px;font-weight:700}
      @media(max-width:760px){.pr-inv-results{left:10px!important;right:10px!important;width:auto!important;top:auto!important;bottom:12px!important;max-height:44vh;border-radius:12px}.pr-inv-opt{padding:11px}.pr-inv-opt b{font-size:13px}.pr-inv-opt small{font-size:11px}}
    `;
    document.head.appendChild(st);
  }

  async function loadCatalog(force=false){
    if(!force&&catalog.length&&Date.now()-loadedAt<MAX_AGE)return catalog;
    if(loading)return loading;
    loading=(async()=>{
      try{
        if(typeof window.api!=='function')throw new Error('API helper belum siap');
        const d=await window.api('GET','/material-catalog');
        catalog=(Array.isArray(d?.items)?d.items:[]).filter(x=>x&&x.inventory_available!==false&&x.inventory_item_id);
        loadedAt=Date.now();
      }catch(e){console.warn('['+REV+'] catalog',e?.message||e);catalog=[]}
      finally{loading=null}
      return catalog;
    })();
    return loading;
  }

  function score(item,q){
    const nq=norm(q); if(!nq)return 0;
    const name=norm(item.name),sku=norm(item.sku),pn=norm(item.product_number),bc=norm(item.barcode),cat=norm(item.category+' '+item.subcategory);
    if(name===nq||sku===nq||pn===nq||bc===nq)return 100;
    if(name.startsWith(nq)||sku.startsWith(nq)||pn.startsWith(nq))return 85;
    if(name.includes(nq)||sku.includes(nq)||pn.includes(nq)||bc.includes(nq))return 70;
    const words=nq.split(/\s+/).filter(Boolean);
    const hay=[name,sku,pn,bc,cat].join(' ');
    if(words.length&&words.every(w=>hay.includes(w)))return 55;
    return 0;
  }
  function matches(q){
    return catalog.map(x=>({x,s:score(x,q)})).filter(v=>v.s>0)
      .sort((a,b)=>b.s-a.s||(b.x.hpp_mapped?1:0)-(a.x.hpp_mapped?1:0)||String(a.x.name||'').localeCompare(String(b.x.name||''),'id',{numeric:true}))
      .slice(0,12).map(v=>v.x);
  }

  function rowMeta(row){
    let meta=row.querySelector('.pr-inv-meta');
    if(!meta){meta=document.createElement('div');meta.className='pr-inv-meta';row.querySelector('.pr-desc')?.insertAdjacentElement('afterend',meta)}
    return meta;
  }
  function setVisual(row,type,text){
    const input=row.querySelector('.pr-desc'),meta=rowMeta(row);
    input?.classList.remove('pr-inv-linked','pr-inv-missing','pr-inv-manual');
    meta.className='pr-inv-meta '+type;
    if(type==='linked')input?.classList.add('pr-inv-linked');
    else if(type==='missing')input?.classList.add('pr-inv-missing');
    else if(type==='manual')input?.classList.add('pr-inv-manual');
    meta.textContent=text||'';
  }
  function clearSelection(row,manual=true){
    delete row.dataset.inventoryItemId;delete row.dataset.inventorySku;delete row.dataset.catalogId;delete row.dataset.sourceKey;delete row.dataset.priceSource;
    if(manual&&row.querySelector('.pr-desc')?.value.trim())setVisual(row,'manual','⚠ Item manual · akan menjadi reminder registrasi Inventory');
    else setVisual(row,'','');
  }
  function selectInventory(row,item){
    if(!row||!item)return;
    const desc=row.querySelector('.pr-desc'),unit=row.querySelector('.pr-unit'),price=row.querySelector('.pr-price'),stock=row.querySelector('.pr-stock');
    if(desc)desc.value=item.name||'';
    if(unit)unit.value=item.unit||'Pcs';
    if(stock)stock.value=item.stock==null?'':String(item.stock);
    if(price)price.value=item.hpp!=null&&Number.isFinite(Number(item.hpp))?Number(item.hpp):0;
    row.dataset.inventoryItemId=String(item.inventory_item_id||'');
    row.dataset.inventorySku=String(item.sku||'');
    row.dataset.catalogId=String(item.id||'');
    row.dataset.sourceKey=String(item.source_key||'');
    row.dataset.priceSource=item.hpp_mapped?'master_pricelist':'none';
    const priceText=item.hpp_mapped?(' · HPP terakhir '+money(item.hpp)):' · belum ada harga';
    const stockText='stok '+Number(item.stock||0)+' '+String(item.unit||'pcs');
    setVisual(row,item.hpp_mapped?'linked':'missing','✓ Inventory Asset · '+(item.sku||'-')+' · '+stockText+priceText);
    row.querySelector('.pr-inv-results')?.classList.remove('open');
    if(typeof window.updatePRTotal==='function')window.updatePRTotal();
  }
  function chooseManual(row,q){
    const input=row.querySelector('.pr-desc');if(input)input.value=q||input.value;
    clearSelection(row,true);row.querySelector('.pr-inv-results')?.classList.remove('open');
  }
  function placeResults(row){
    const input=row?.querySelector('.pr-desc'),box=row?.querySelector('.pr-inv-results');
    if(!input||!box)return;
    if(window.matchMedia('(max-width:760px)').matches)return;
    const r=input.getBoundingClientRect();
    box.style.left=Math.max(8,r.left)+'px';
    box.style.top=(r.bottom+4)+'px';
    box.style.width=Math.max(320,r.width)+'px';
    box.style.right='auto';
    box.style.bottom='auto';
  }
  function renderResults(row,q){
    const box=row.querySelector('.pr-inv-results');if(!box)return;
    const value=String(q||'').trim();
    if(!value){box.classList.remove('open');box.innerHTML='';return}
    placeResults(row);
    const found=matches(value);
    box.innerHTML=found.map(x=>{
      const cls=x.hpp_mapped?'hpp-ready':'hpp-missing';
      const info=(x.sku||'-')+' · stok '+Number(x.stock||0)+' '+esc(x.unit||'pcs')+' · '+(x.hpp_mapped?('HPP '+money(x.hpp)):'belum ada harga');
      return '<div class="pr-inv-opt '+cls+'" data-inventory-id="'+esc(x.inventory_item_id)+'"><b>'+esc(x.name||'-')+'</b><small>'+info+'</small></div>';
    }).join('')+
    '<div class="pr-inv-opt manual" data-manual="1"><b>＋ Gunakan sebagai item manual</b><small>'+esc(value)+' · belum terdaftar di Inventory, akan ditandai sebagai reminder</small></div>';
    box.classList.add('open');
    box.querySelectorAll('[data-inventory-id]').forEach(el=>el.addEventListener('mousedown',e=>{e.preventDefault();selectInventory(row,catalog.find(x=>String(x.inventory_item_id)===String(el.dataset.inventoryId)))}));
    box.querySelector('[data-manual]')?.addEventListener('mousedown',e=>{e.preventDefault();chooseManual(row,value)});
  }
  function refreshExisting(row,item){
    if(item?.inventory_item_id){
      row.dataset.inventoryItemId=String(item.inventory_item_id);
      row.dataset.inventorySku=String(item.inventory_sku||item.sku||'');
      row.dataset.sourceKey=String(item.source_key||'');
      row.dataset.priceSource=String(item.price_source||'');
      const current=catalog.find(x=>String(x.inventory_item_id)===String(item.inventory_item_id));
      if(current){
        const priceText=current.hpp_mapped?(' · HPP saat ini '+money(current.hpp)):' · belum ada harga';
        setVisual(row,current.hpp_mapped?'linked':'missing','✓ Inventory Asset · '+(current.sku||'-')+' · stok '+Number(current.stock||0)+' '+String(current.unit||'pcs')+priceText);
      }else setVisual(row,'linked','✓ Terhubung Inventory Asset');
    }else if(item?.inventory_status==='pending_registration'||item?.item_source==='manual'||row.querySelector('.pr-desc')?.value.trim()){
      setVisual(row,'manual','⚠ Item manual · reminder registrasi Inventory');
    }
  }
  function decorateRow(row,item=null){
    if(!row||row.dataset.pxlPrInv==='1')return;
    row.dataset.pxlPrInv='1';
    const input=row.querySelector('.pr-desc');if(!input)return;
    const td=input.closest('td');td?.classList.add('pr-inv-cell');
    const box=document.createElement('div');box.className='pr-inv-results';td?.appendChild(box);
    rowMeta(row);
    input.setAttribute('autocomplete','off');
    input.placeholder='Cari Inventory / SKU / product number, atau ketik manual...';
    input.addEventListener('focus',()=>{
      const q=input.value;
      const box=row.querySelector('.pr-inv-results');
      if(box&&q.trim()){box.innerHTML='<div class="pr-inv-opt"><small>Memuat Inventory...</small></div>';placeResults(row);box.classList.add('open');}
      loadCatalog().then(()=>renderResults(row,input.value));
    });
    input.addEventListener('input',()=>{
      const selected=row.dataset.inventoryItemId;
      if(selected){
        const current=catalog.find(x=>String(x.inventory_item_id)===String(selected));
        if(!current||norm(current.name)!==norm(input.value))clearSelection(row,true);
      }else if(input.value.trim())setVisual(row,'manual','⚠ Item manual · akan menjadi reminder registrasi Inventory');
      else setVisual(row,'','');
      const q=input.value;
      const box=row.querySelector('.pr-inv-results');
      if(box&&q.trim()&&!catalog.length){box.innerHTML='<div class="pr-inv-opt"><small>Memuat Inventory...</small></div>';placeResults(row);box.classList.add('open');}
      loadCatalog().then(()=>renderResults(row,input.value));
    });
    input.addEventListener('blur',()=>setTimeout(()=>box.classList.remove('open'),180));
    refreshExisting(row,item);
  }
  function decorateAll(){
    document.querySelectorAll('#pr-items-body tr').forEach(row=>decorateRow(row,null));
  }

  function install(){
    addStyle();
    if(typeof window.addPRItem==='function'&&!window.addPRItem.__pxlPrInv){
      const native=window.addPRItem;
      window.addPRItem=function(item=null){
        const out=native.apply(this,arguments);
        const rows=document.querySelectorAll('#pr-items-body tr'),row=rows[rows.length-1];
        decorateRow(row,item);
        loadCatalog().then(()=>refreshExisting(row,item));
        return out;
      };
      window.addPRItem.__pxlPrInv=true;
    }
    if(typeof window.showPRForm==='function'&&!window.showPRForm.__pxlPrInv){
      const native=window.showPRForm;
      window.showPRForm=function(){
        const out=native.apply(this,arguments);
        loadCatalog().then(()=>decorateAll());
        decorateAll();
        return out;
      };
      window.showPRForm.__pxlPrInv=true;
    }
    if(typeof window.getPRItems==='function'&&!window.getPRItems.__pxlPrInv){
      const native=window.getPRItems;
      window.getPRItems=function(){
        const items=native.apply(this,arguments);
        const rows=[...document.querySelectorAll('#pr-items-body tr')];
        return items.map((it,i)=>{
          const row=rows[i],inventoryId=row?.dataset.inventoryItemId||null;
          return {...it,
            inventory_item_id:inventoryId,
            inventory_sku:row?.dataset.inventorySku||null,
            item_source:inventoryId?'inventory':'manual',
            inventory_status:inventoryId?'linked':'pending_registration',
            source_key:row?.dataset.sourceKey||null,
            price_source:row?.dataset.priceSource||(inventoryId?'none':'manual'),
            inventory_stock_snapshot:row?.querySelector('.pr-stock')?.value?.trim()||''
          };
        });
      };
      window.getPRItems.__pxlPrInv=true;
    }
    decorateAll();
    loadCatalog();
  }

  document.addEventListener('click',e=>{if(!e.target.closest('.pr-inv-cell'))document.querySelectorAll('.pr-inv-results.open').forEach(x=>x.classList.remove('open'))},true);
  document.addEventListener('DOMContentLoaded',install);
  setTimeout(install,0);setTimeout(install,500);setTimeout(install,1500);
  window.PXL_PR_INV_0001={revision:REV,refresh:install,reloadCatalog:()=>loadCatalog(true)};
})();