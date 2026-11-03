/* PXL-URG-0121 — resilient PR live load; Project Tracker intentionally untouched. */
(()=>{
  'use strict';
  const REV='PXL-URG-0121';

  async function getToken(){
    try{if(typeof waitForAppToken==='function'){const t=await waitForAppToken();if(t)return t;}}catch(_){}
    for(const key of ['token','authToken','pxl_token']){
      const value=localStorage.getItem(key)||sessionStorage.getItem(key);
      if(value)return value;
    }
    return '';
  }

  async function fetchPr(){
    const token=await getToken();
    if(!token)throw new Error('Token login belum tersedia.');
    const response=await fetch('/api/purchase-requests?_pxl0121='+Date.now(),{
      method:'GET',cache:'no-store',
      headers:{Authorization:'Bearer '+token,'X-Auth-Token':token,'Cache-Control':'no-cache'}
    });
    if(!response.ok){
      let msg='HTTP '+response.status;
      try{const body=await response.json();msg=body.error||body.message||msg;}catch(_){}
      throw new Error(msg);
    }
    const rows=await response.json();
    if(!Array.isArray(rows))throw new Error('Format Purchase Request tidak valid.');
    return rows;
  }

  const oldLoad=window.loadPurchaseRequests;
  if(typeof oldLoad==='function'&&!oldLoad.__pxl0121){
    window.loadPurchaseRequests=async function(){
      try{
        const rows=await fetchPr();
        prData=rows;
        if(typeof renderPRList==='function')renderPRList();
        return rows;
      }catch(error){
        console.warn(REV+' PR load',error);
        if(Array.isArray(prData)&&prData.length){
          if(typeof renderPRList==='function')renderPRList();
          return prData;
        }
        return oldLoad.apply(this,arguments);
      }
    };
    window.loadPurchaseRequests.__pxl0121=true;
  }

  window.PXL_URG_0121={revision:REV,fetchPr};
})();