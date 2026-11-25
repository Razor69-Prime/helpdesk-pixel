/* PXL-URG-0144 — PR edit reads authoritative item detail before rendering.
 * Existing PR lines are never inferred from summary/aggregated list objects.
 */
(()=>{
  'use strict';
  const REV='PXL-URG-0144';
  let editing=false;
  const rows=()=>[...document.querySelectorAll('#pr-items-body tr')];
  const value=v=>String(v??'');
  const expectedName=item=>value(item?.desc??item?.item_name??item?.name).trim();
  const validDetail=(entry,id)=>entry&&String(entry.id)===String(id)&&Array.isArray(entry.items)&&entry.items.length>0&&entry.items.every(x=>x&&expectedName(x)&&Number.isFinite(Number(x.qty))&&Number.isFinite(Number(x.price||0)));
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function assign(row,item){
    const fields={'.pr-desc':expectedName(item),'.pr-qty':item.qty??1,'.pr-unit':item.unit||'Pcs','.pr-price':item.price??0,'.pr-stock':item.stock??'','.pr-ket':item.ket??''};
    for(const [selector,content] of Object.entries(fields)){
      const input=row.querySelector(selector);if(input)input.value=value(content);
    }
    const supplier=row.querySelector('.pr-supplier');
    if(supplier&&item.supplier_id&&[...supplier.options].some(option=>String(option.value)===String(item.supplier_id)))supplier.value=String(item.supplier_id);
    // Preserve inventory/probus links from the saved PR, including historical
    // items that are no longer offered by fast search.
    if(item.inventory_item_id){
      row.dataset.inventoryItemId=value(item.inventory_item_id);
      row.dataset.inventorySku=value(item.inventory_sku||item.sku);
      row.dataset.sourceKey=value(item.source_key);
      row.dataset.priceSource=value(item.price_source);
    }else{
      delete row.dataset.inventoryItemId;
      delete row.dataset.inventorySku;
      delete row.dataset.sourceKey;
      delete row.dataset.priceSource;
    }
  }
  function equivalent(row,item){
    if(!row)return false;
    const name=row.querySelector('.pr-desc')?.value?.trim();
    const qty=Number(row.querySelector('.pr-qty')?.value);
    const price=Number(row.querySelector('.pr-price')?.value);
    return name===expectedName(item)&&qty===Number(item.qty)&&price===Number(item.price||0);
  }
  function replaceCached(entry){
    try{if(typeof prData!=='undefined'&&Array.isArray(prData)){
      const index=prData.findIndex(x=>String(x.id)===String(entry.id));
      if(index>=0)prData[index]=entry;else prData.unshift(entry);
    }}catch(_){}
  }
  async function loadFull(id){
    if(typeof window.api!=='function')throw Error('Layanan PR belum siap.');
    const data=await window.api('GET','/purchase-requests/'+encodeURIComponent(id));
    if(!validDetail(data,id))throw Error('Detail PR tidak lengkap. Form edit tidak dibuka agar daftar item tetap aman.');
    return data;
  }
  async function renderFull(entry){
    replaceCached(entry);
    if(typeof window.showPRForm!=='function')throw Error('Form Purchase Request belum siap.');
    await Promise.resolve(window.showPRForm(entry.id));
    // Re-check after async supplier preload; do not accept a merged summary row.
    let lineRows=rows();
    if(lineRows.length!==entry.items.length){
      // One more tick for legacy async plugins before repairing the form.
      await wait(60);
      lineRows=rows();
    }
    if(lineRows.length!==entry.items.length){
      const body=document.getElementById('pr-items-body');
      if(!body||typeof window.addPRItem!=='function')throw Error('Jumlah baris PR tidak sesuai dan tidak dapat dipulihkan.');
      body.replaceChildren();
      if(typeof prItemCount!=='undefined')prItemCount=0;
      for(const item of entry.items)window.addPRItem(item);
      lineRows=rows();
    }
    if(lineRows.length!==entry.items.length)throw Error('Jumlah baris PR tidak sesuai dengan database.');
    for(let i=0;i<entry.items.length;i++)assign(lineRows[i],entry.items[i]);
    if(!lineRows.every((row,i)=>equivalent(row,entry.items[i])))throw Error('Verifikasi isi item PR gagal.');
    if(typeof window.updatePRTotal==='function')window.updatePRTotal();
    return entry;
  }
  async function safeEdit(id){
    if(editing)return;
    editing=true;
    try{
      const entry=await loadFull(id);
      await renderFull(entry);
    }catch(e){
      console.warn(REV+' edit prevented',e?.message||e);
      if(typeof window.cancelPRForm==='function')window.cancelPRForm();
      alert('Tidak dapat membuka edit PR: '+(e?.message||e)+'\nData tersimpan tidak diubah.');
    }finally{editing=false;}
  }
  function validateOnSave(){
    const editingExisting=typeof prEditId!=='undefined'&&!!prEditId;
    if(!editingExisting)return true;
    const all=rows();
    if(!all.length||all.some(r=>!r.querySelector('.pr-desc')?.value?.trim()||Number(r.querySelector('.pr-qty')?.value)<=0)){
      alert('Ada baris PR kosong atau quantity tidak valid. Simpan dibatalkan agar item existing tidak hilang.');
      return false;
    }
    return true;
  }
  function install(){
    if(typeof window.editPR==='function'&&!window.editPR.__pxl0144){
      window.editPR=safeEdit;
      window.editPR.__pxl0144=true;
    }
    if(typeof window.submitPR==='function'&&!window.submitPR.__pxl0144){
      const previous=window.submitPR;
      window.submitPR=function(){if(!validateOnSave())return;return previous.apply(this,arguments)};
      window.submitPR.__pxl0144=true;
    }
  }
  document.addEventListener('DOMContentLoaded',install);
  setTimeout(install,0);
  setTimeout(install,700);
  window.PXL_URG_0144={revision:REV,validDetail,assign,equivalent,renderFull,safeEdit,install};
})();
