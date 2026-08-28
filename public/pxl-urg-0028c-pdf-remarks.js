/* PXL-URG-0028C — Ensure technician remarks are present in Work Order PDF.
 * Loaded after the native PDF generator. Before exporting, fetch the latest ticket,
 * sync the fresh description into the in-memory ticket, then call the existing generator.
 */
(function(){
  'use strict';
  const REV='PXL-URG-0028C';

  function token(){
    return localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||'';
  }

  async function latestTicket(ticketId){
    const t=token();
    const response=await fetch('/api/tickets?remarks_pdf_v='+Date.now(),{
      cache:'no-store',
      headers:{
        'Cache-Control':'no-cache',
        ...(t?{Authorization:'Bearer '+t,'X-Auth-Token':t}:{})
      }
    });
    if(!response.ok) throw new Error('Gagal memuat data Work Order terbaru.');
    const rows=await response.json();
    return (Array.isArray(rows)?rows:[]).find(row=>String(row.id)===String(ticketId))||null;
  }

  function syncTicket(ticketId,fresh){
    if(!fresh)return;
    try{
      if(typeof allTickets!=='undefined'&&Array.isArray(allTickets)){
        const row=allTickets.find(x=>String(x.id)===String(ticketId));
        if(row) Object.assign(row,fresh);
      }
    }catch(_){ }
    try{
      if(typeof archivedTickets!=='undefined'&&Array.isArray(archivedTickets)){
        const row=archivedTickets.find(x=>String(x.id)===String(ticketId));
        if(row) Object.assign(row,fresh);
      }
    }catch(_){ }
  }

  function install(){
    const original=window.exportTicketPDF;
    if(typeof original!=='function'||original.__pxl0028c)return false;

    async function exportWithFreshRemarks(ticketId,source){
      try{
        const fresh=await latestTicket(ticketId);
        if(fresh) syncTicket(ticketId,fresh);
      }catch(error){
        console.warn('['+REV+'] fresh ticket sync failed:',error);
      }
      return original.call(this,ticketId,source);
    }
    exportWithFreshRemarks.__pxl0028c=true;
    exportWithFreshRemarks.__pxlOriginal=original;
    window.exportTicketPDF=exportWithFreshRemarks;
    return true;
  }

  let attempts=0;
  const timer=setInterval(function(){
    attempts++;
    if(install()||attempts>40)clearInterval(timer);
  },100);
  if(document.readyState!=='loading')install();
  else document.addEventListener('DOMContentLoaded',install,{once:true});
})();
