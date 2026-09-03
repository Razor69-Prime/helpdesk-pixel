/* PXL-URG-0041 — Material Request mobile readability only. No flow/logic/database changes. */
(function(){
  'use strict';
  if(window.PXL_URG_0041)return;
  const REV='PXL-URG-0041';
  const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
  function mark(){
    document.querySelectorAll('table').forEach(table=>{
      const heads=[...table.querySelectorAll('thead th')].map(th=>norm(th.textContent));
      if(!heads.length)return;
      const joined=heads.join('|');
      if(joined.includes('item / nama material')&&joined.includes('pengambilan')&&joined.includes('pemakaian')&&joined.includes('pengembalian')){
        table.classList.add('pxl-mr-0041-table');
      }
    });
  }
  function css(){
    if(document.getElementById('pxl-mr-0041-style'))return;
    const s=document.createElement('style');s.id='pxl-mr-0041-style';
    s.textContent=`
@media(max-width:700px){
  table.pxl-mr-0041-table{table-layout:fixed!important;width:100%!important;min-width:0!important}
  table.pxl-mr-0041-table th,table.pxl-mr-0041-table td{padding:7px 5px!important;vertical-align:middle!important;overflow:visible!important}
  table.pxl-mr-0041-table th{font-size:10px!important;line-height:1.15!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important;text-align:center!important}
  table.pxl-mr-0041-table th:nth-child(1),table.pxl-mr-0041-table td:nth-child(1){width:7%!important;text-align:center!important}
  table.pxl-mr-0041-table th:nth-child(2),table.pxl-mr-0041-table td:nth-child(2){width:48%!important;text-align:left!important}
  table.pxl-mr-0041-table th:nth-child(3),table.pxl-mr-0041-table td:nth-child(3),
  table.pxl-mr-0041-table th:nth-child(4),table.pxl-mr-0041-table td:nth-child(4),
  table.pxl-mr-0041-table th:nth-child(5),table.pxl-mr-0041-table td:nth-child(5){width:15%!important;text-align:center!important;font-size:12px!important}
  table.pxl-mr-0041-table td:nth-child(2){font-size:12px!important;line-height:1.25!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important}
  table.pxl-mr-0041-table td:nth-child(2) *{max-width:100%!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important;text-overflow:clip!important;overflow:visible!important}
  table.pxl-mr-0041-table td:nth-child(2) input,table.pxl-mr-0041-table td:nth-child(2) select{font-size:12px!important;padding:6px 7px!important;min-width:0!important;width:100%!important}
  table.pxl-mr-0041-table td:nth-child(2) small,
  table.pxl-mr-0041-table td:nth-child(2) .muted{font-size:10px!important;line-height:1.25!important}
}
`;
    document.head.appendChild(s);
  }
  const obs=new MutationObserver(mark);
  function init(){css();mark();obs.observe(document.body,{childList:true,subtree:true});[300,800,1600,3000].forEach(ms=>setTimeout(mark,ms));}
  window.PXL_URG_0041={revision:REV,refresh:mark};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
