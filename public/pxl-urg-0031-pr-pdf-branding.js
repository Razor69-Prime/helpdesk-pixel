/* PXL-URG-0031B — PR PDF branding + response optimization. Numbering/calculation unchanged. */
(function(){
  'use strict';
  const REV='PXL-URG-0031B';
  const LOGO='/pixel-solusindo-logo.png';
  const LOGO_ALIAS='PXL_PR_LOGO_0031B';
  let logoData=null;

  function preloadLogo(){
    try{
      const img=new Image();
      img.decoding='async';
      img.onload=()=>{
        try{
          // Downscale once. Avoid feeding the original large logo to jsPDF on every page.
          const maxW=420;
          const ratio=Math.min(1,maxW/Math.max(1,img.naturalWidth||img.width));
          const w=Math.max(1,Math.round((img.naturalWidth||img.width)*ratio));
          const h=Math.max(1,Math.round((img.naturalHeight||img.height)*ratio));
          const c=document.createElement('canvas');
          c.width=w;c.height=h;
          c.getContext('2d',{alpha:true}).drawImage(img,0,0,w,h);
          logoData=c.toDataURL('image/png');
        }catch(e){console.warn(REV+' logo cache',e);}
      };
      img.src=LOGO;
    }catch(_){}
  }

  function lockPrOutlet(){
    const el=document.getElementById('pr-outlet');
    if(!el) return;
    const lukluk=[...el.options].find(o=>/pixel\s*lukluk/i.test(String(o.textContent||o.value||'')));
    if(lukluk) el.value=lukluk.value;
    el.disabled=true;
    el.setAttribute('aria-disabled','true');
    const group=el.closest('.form-group');
    if(group) group.style.display='none';
  }

  function patchShowPrForm(){
    if(typeof window.showPRForm!=='function'||window.showPRForm.__pxl0031b) return;
    const old=window.showPRForm;
    window.showPRForm=function(){
      const out=old.apply(this,arguments);
      lockPrOutlet();
      return out;
    };
    window.showPRForm.__pxl0031b=true;
  }

  function installPdfPatch(){
    const jsPDF=window.jspdf?.jsPDF;
    if(!jsPDF?.API||jsPDF.API.__pxlUrg0031b) return;
    jsPDF.API.__pxlUrg0031b=true;
    const oldText=jsPDF.API.text;
    jsPDF.API.text=function(text){
      // Fast path: most PDF text never needs PR branding logic.
      if(typeof text!=='string') return oldText.apply(this,arguments);
      const raw=text.trim();
      const upper=raw.toUpperCase();

      if(upper==='PIXEL SOLUSINDO'){
        this.__pxlPrHeader0031b=true;
        if(logoData){
          try{
            const x=Number(arguments[1])||15;
            const y=Number(arguments[2])||15;
            // Alias lets jsPDF reuse the already encoded logo on subsequent pages.
            this.addImage(logoData,'PNG',x,y-5,34,9,LOGO_ALIAS,'FAST');
          }catch(e){console.warn(REV+' add logo',e);}
        }
        return this;
      }

      if(this.__pxlPrHeader0031b&&(upper==='PIXEL BUDUK'||upper==='PIXEL LUKLUK')) return this;
      if(upper==='PURCHASE REQUEST') this.__pxlPrPdf0031b=true;

      if(this.__pxlPrPdf0031b){
        if(upper==='PURCHASING & ACCOUNTING') arguments[0]='Accounting';
        else if(raw.includes('| Pixel Buduk |')||raw.includes('| Pixel Lukluk |')){
          arguments[0]=raw.replace(/\|\s*Pixel\s+(Buduk|Lukluk)\s*\|/i,'|');
        }
      }
      return oldText.apply(this,arguments);
    };
  }

  function install(){
    installPdfPatch();
    patchShowPrForm();
    lockPrOutlet();
    setTimeout(()=>{installPdfPatch();patchShowPrForm();lockPrOutlet();},350);
  }

  // No global MutationObserver: it caused unnecessary work while the app/PDF was rendering.
  preloadLogo();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.PXL_URG_0031={revision:REV};
})();
