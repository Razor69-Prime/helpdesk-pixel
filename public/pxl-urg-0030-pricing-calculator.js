/* PXL-URG-0030 — Isolated Sales Order pricing calculator. No API, DB, PPN, PDF, Inventory, WO, MR, or Invoice changes. */
(function(){
  'use strict';

  const REV='PXL-URG-0030';
  let activeRow=null;
  let modal=null;

  const n=v=>{const x=Number(String(v??'').replace(/[^0-9.,-]/g,'').replace(',','.'));return Number.isFinite(x)?x:0;};
  const rp=v=>'Rp '+Math.round(n(v)).toLocaleString('id-ID');

  function calc(){
    const hpp=Math.max(0,n(modal?.querySelector('#pxlPriceHpp')?.value));
    const upPct=Math.max(0,n(modal?.querySelector('#pxlPriceUp')?.value));
    const feePct=Math.max(0,n(modal?.querySelector('#pxlPriceFee')?.value));
    const ppnPct=Math.max(0,n(modal?.querySelector('#pxlPricePpn')?.value));
    const up=hpp*upPct/100;
    const feeBase=hpp+up;
    const fee=feeBase*feePct/100;
    const exPpn=feeBase+fee;
    const ppn=exPpn*ppnPct/100;
    const final=exPpn+ppn;
    const net=exPpn-hpp;
    const effective=hpp>0?(net/hpp)*100:0;
    return {hpp,upPct,up,feePct,feeBase,fee,exPpn,ppnPct,ppn,final,net,effective};
  }

  function render(){
    if(!modal)return;
    const x=calc();
    const set=(id,value)=>{const el=modal.querySelector(id);if(el)el.textContent=value;};
    set('#pxlPriceUpNominal',rp(x.up));
    set('#pxlPriceFeeBase',rp(x.feeBase));
    set('#pxlPriceFeeNominal',rp(x.fee));
    set('#pxlPriceExPpn',rp(x.exPpn));
    set('#pxlPricePpnNominal',rp(x.ppn));
    set('#pxlPriceFinal',rp(x.final));
    set('#pxlPriceNet',rp(x.net));
    set('#pxlPriceEffective',x.effective.toLocaleString('id-ID',{maximumFractionDigits:2})+'%');
  }

  function ensureModal(){
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='pxlPricingModal';
    modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:2000;padding:14px;overflow:auto';
    modal.innerHTML=`<div style="max-width:620px;margin:28px auto;background:#fff;border-radius:12px;padding:16px;box-shadow:0 14px 40px rgba(0,0,0,.22)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px"><div><b style="font-size:17px">Kalkulator Harga</b><div id="pxlPriceItem" style="font-size:11px;color:#756f66;margin-top:3px"></div></div><button type="button" class="btn" id="pxlPriceClose">Tutup</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
        <div><label>HPP</label><input id="pxlPriceHpp" inputmode="numeric" value="0"></div>
        <div><label>Up Harga (%)</label><input id="pxlPriceUp" type="number" min="0" step="0.01" value="20"></div>
        <div><label>Fee (%)</label><input id="pxlPriceFee" type="number" min="0" step="0.01" value="10"></div>
        <div><label>PPN Simulasi (%)</label><input id="pxlPricePpn" type="number" min="0" step="0.01" value="11"></div>
      </div>
      <div style="margin-top:13px;border:1px solid #e4e1d8;border-radius:10px;overflow:hidden;font-size:12px">
        <div style="padding:9px 11px;background:#faf8f3;font-weight:700">Breakdown Internal</div>
        <div class="pxl-price-row"><span>Up Harga Nominal</span><b id="pxlPriceUpNominal">Rp 0</b></div>
        <div class="pxl-price-row"><span>Dasar Fee (HPP + Up)</span><b id="pxlPriceFeeBase">Rp 0</b></div>
        <div class="pxl-price-row"><span>Fee Nominal</span><b id="pxlPriceFeeNominal">Rp 0</b></div>
        <div class="pxl-price-row"><span>Harga Ex PPN / DPP</span><b id="pxlPriceExPpn">Rp 0</b></div>
        <div class="pxl-price-row"><span>PPN Simulasi</span><b id="pxlPricePpnNominal">Rp 0</b></div>
        <div class="pxl-price-row" style="background:#fff7ef"><span>Harga Final Simulasi</span><b id="pxlPriceFinal">Rp 0</b></div>
        <div class="pxl-price-row"><span>NET Internal (DPP - HPP)</span><b id="pxlPriceNet">Rp 0</b></div>
        <div class="pxl-price-row"><span>Markup Efektif terhadap HPP</span><b id="pxlPriceEffective">0%</b></div>
      </div>
      <div style="font-size:11px;color:#756f66;margin-top:10px;line-height:1.45">Tombol “Gunakan Harga” hanya memasukkan <b>Harga Ex PPN / DPP</b> ke Harga Satuan. PPN tetap mengikuti checkbox/rate PPN Sales Order yang sudah ada.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button type="button" class="btn" id="pxlPriceCancel">Batal</button><button type="button" class="btn primary" id="pxlPriceUse">Gunakan Harga</button></div>
    </div>`;
    const style=document.createElement('style');
    style.id='pxlPricingStyles';
    style.textContent=`.pxl-price-row{display:flex;justify-content:space-between;gap:14px;padding:8px 11px;border-top:1px solid #eee}.pxl-price-calc{margin-top:5px;padding:5px 7px!important;font-size:10px!important;width:100%}@media(max-width:560px){#pxlPricingModal>div>div:nth-child(2){grid-template-columns:1fr!important}}`;
    document.head.appendChild(style);
    document.body.appendChild(modal);
    modal.querySelectorAll('input').forEach(el=>el.addEventListener('input',render));
    const close=()=>{modal.style.display='none';activeRow=null;};
    modal.querySelector('#pxlPriceClose').onclick=close;
    modal.querySelector('#pxlPriceCancel').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    modal.querySelector('#pxlPriceUse').onclick=()=>{
      const price=activeRow?.querySelector('.price');
      if(!price)return close();
      const x=calc();
      price.value=String(Math.round(x.exPpn));
      price.dispatchEvent(new Event('input',{bubbles:true}));
      price.dispatchEvent(new Event('change',{bubbles:true}));
      close();
    };
    return modal;
  }

  function rowName(row){
    return row?.querySelector('.item-search,.service-name')?.value?.trim() || 'Item / Jasa';
  }

  function open(row){
    if(!row)return;
    activeRow=row;
    const m=ensureModal();
    m.querySelector('#pxlPriceItem').textContent=rowName(row);
    m.querySelector('#pxlPriceHpp').value='0';
    m.querySelector('#pxlPriceUp').value='20';
    m.querySelector('#pxlPriceFee').value='10';
    m.querySelector('#pxlPricePpn').value='11';
    render();
    m.style.display='block';
    setTimeout(()=>m.querySelector('#pxlPriceHpp')?.focus(),0);
  }

  function decorate(row){
    if(!row||row.querySelector('.pxl-price-calc'))return;
    const price=row.querySelector('.price');
    if(!price)return;
    const host=price.parentElement;
    if(!host)return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='btn pxl-price-calc';
    btn.textContent='🧮 Hitung Harga';
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open(row);});
    host.appendChild(btn);
  }

  function scan(){document.querySelectorAll('.material-row,.service-row').forEach(decorate);}

  function watch(id){
    const box=document.getElementById(id);
    if(!box||box.dataset.pxlPricingWatch==='1')return;
    box.dataset.pxlPricingWatch='1';
    new MutationObserver(()=>scan()).observe(box,{childList:true});
  }

  function install(){
    scan();
    watch('materialItems');
    watch('serviceItems');
    document.addEventListener('focusin',e=>{const row=e.target?.closest?.('.material-row,.service-row');if(row)decorate(row);});
    window.PXL_URG_0030={revision:REV,calculate:(hpp,upPct,feePct,ppnPct)=>{
      const up=n(hpp)*n(upPct)/100,feeBase=n(hpp)+up,fee=feeBase*n(feePct)/100,exPpn=feeBase+fee,ppn=exPpn*n(ppnPct)/100;
      return {hpp:n(hpp),up,feeBase,fee,exPpn,ppn,final:exPpn+ppn,net:exPpn-n(hpp)};
    }};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
