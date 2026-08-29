/* PXL-URG-0031A — Purchase Request presentation only. Numbering/calculation logic unchanged. */
(function(){
  'use strict';
  const REV='PXL-URG-0031A';
  const LOGO='/pixel-solusindo-logo.png';
  let logoData=null;

  function preloadLogo(){
    try{
      const img=new Image();
      img.onload=()=>{
        try{
          const c=document.createElement('canvas');
          c.width=img.naturalWidth||img.width;
          c.height=img.naturalHeight||img.height;
          c.getContext('2d').drawImage(img,0,0);
          logoData=c.toDataURL('image/png');
        }catch(_){}
      };
      img.src=LOGO+'?v='+REV;
    }catch(_){}
  }

  function lockPrOutlet(){
    const el=document.getElementById('pr-outlet');
    if(!el) return;
    const lukluk=[...el.options].find(o=>/pixel\s*lukluk/i.test(String(o.textContent||o.value||'')));
    if(lukluk) el.value=lukluk.value;
    el.disabled=true;
    el.setAttribute('aria-disabled','true');
    // Pilihan outlet tidak lagi ditampilkan di form. Nilai internal tetap Lukluk
    // agar numbering existing PR Lukluk tidak berubah.
    const group=el.closest('.form-group');
    if(group) group.style.display='none';
  }

  function patchShowPrForm(){
    if(typeof window.showPRForm!=='function'||window.showPRForm.__pxl0031a) return;
    const old=window.showPRForm;
    window.showPRForm=function(){
      const out=old.apply(this,arguments);
      lockPrOutlet();
      setTimeout(lockPrOutlet,0);
      return out;
    };
    window.showPRForm.__pxl0031a=true;
  }

  function installPdfPatch(){
    const jsPDF=window.jspdf?.jsPDF;
    if(!jsPDF?.API||jsPDF.API.__pxlUrg0031a) return;
    jsPDF.API.__pxlUrg0031a=true;
    const oldText=jsPDF.API.text;
    jsPDF.API.text=function(text){
      let value=Array.isArray(text)?text.join(' '):String(text??'');
      const upper=value.trim().toUpperCase();

      if(upper==='PIXEL SOLUSINDO'){
        this.__pxlPrHeaderCandidate0031a=true;
        if(logoData){
          try{
            const x=Number(arguments[1])||15;
            const y=Number(arguments[2])||15;
            this.addImage(logoData,'PNG',x,y-5,34,9,undefined,'FAST');
            return this;
          }catch(_){}
        }
        // Jika logo belum selesai dimuat, jangan cetak teks branding lama.
        return this;
      }

      if(this.__pxlPrHeaderCandidate0031a&&(upper==='PIXEL BUDUK'||upper==='PIXEL LUKLUK')) return this;

      if(upper==='PURCHASE REQUEST') this.__pxlPrPdf0031a=true;

      if(this.__pxlPrPdf0031a){
        if(upper==='PURCHASING & ACCOUNTING') arguments[0]='Accounting';
        else if(/\|\s*PIXEL\s+(BUDUK|LUKLUK)\s*\|/i.test(value)){
          arguments[0]=value.replace(/\|\s*PIXEL\s+(BUDUK|LUKLUK)\s*\|/i,'|');
        }
      }
      return oldText.apply(this,arguments);
    };
  }

  function install(){
    installPdfPatch();
    patchShowPrForm();
    lockPrOutlet();
    setTimeout(()=>{installPdfPatch();patchShowPrForm();lockPrOutlet();},300);
    setTimeout(()=>{installPdfPatch();patchShowPrForm();lockPrOutlet();},1200);
  }

  preloadLogo();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  const obs=new MutationObserver(()=>lockPrOutlet());
  try{obs.observe(document.documentElement,{childList:true,subtree:true});}catch(_){}

  window.PXL_URG_0031={revision:REV};
})();
