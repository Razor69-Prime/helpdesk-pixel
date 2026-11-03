/* PXL-URG-0119 — hydrate full PR only when Edit/PDF is requested. */
(()=>{
  'use strict';
  const REV='PXL-URG-0119';
  async function hydratePr(id){
    if(!id||typeof window.api!=='function')return null;
    const full=await window.api('GET','/purchase-requests/'+encodeURIComponent(id));
    try{
      if(typeof prData!=='undefined'&&Array.isArray(prData)){
        const index=prData.findIndex(row=>String(row.id)===String(id));
        if(index>=0)prData[index]=full;
      }
      if(typeof dashPRData!=='undefined'&&Array.isArray(dashPRData)){
        const index=dashPRData.findIndex(row=>String(row.id)===String(id));
        if(index>=0)dashPRData[index]=full;
      }
    }catch(_){}
    return full;
  }

  const oldEdit=window.editPR;
  if(typeof oldEdit==='function'&&!oldEdit.__pxl0119){
    window.editPR=async function(id){
      try{await hydratePr(id);}catch(e){console.warn(REV+' PR detail',e);}
      return oldEdit.apply(this,arguments);
    };
    window.editPR.__pxl0119=true;
  }

  const oldPdf=window.exportPRPDF;
  if(typeof oldPdf==='function'&&!oldPdf.__pxl0119){
    window.exportPRPDF=async function(id){
      try{await hydratePr(id);}catch(e){console.warn(REV+' PR PDF detail',e);}
      return oldPdf.apply(this,arguments);
    };
    window.exportPRPDF.__pxl0119=true;
  }

  window.PXL_URG_0119={revision:REV,hydratePr};
})();