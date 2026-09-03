/* PXL-URG-0041A — Material Request mobile readability only. No flow/logic/database changes. */
(function(){
  'use strict';
  const REV='PXL-URG-0041A';
  if(window.PXL_URG_0041?.revision===REV)return;
  const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');

  function isMrTable(table){
    const headText=norm(table.querySelector('thead')?.textContent||'');
    return headText.includes('item / nama material')&&headText.includes('pengambilan')&&headText.includes('pemakaian')&&headText.includes('pengembalian');
  }
  function mark(){
    document.querySelectorAll('table').forEach(table=>{
      if(!isMrTable(table))return;
      table.classList.add('pxl-mr-0041a-table');
      table.style.setProperty('table-layout','fixed','important');
      table.style.setProperty('width','100%','important');
      table.style.setProperty('min-width','0','important');
      const wrap=table.parentElement;
      if(wrap){wrap.classList.add('pxl-mr-0041a-wrap');}
      let colgroup=table.querySelector('colgroup[data-pxl-mr-0041a]');
      if(!colgroup){
        colgroup=document.createElement('colgroup');colgroup.dataset.pxlMr0041a='1';
        ['6%','44%','12.5%','12.5%','12.5%','12.5%'].forEach(w=>{const c=document.createElement('col');c.style.width=w;colgroup.appendChild(c)});
        table.insertBefore(colgroup,table.firstChild);
      }
    });
  }
  function css(){
    if(document.getElementById('pxl-mr-0041a-style'))return;
    const s=document.createElement('style');s.id='pxl-mr-0041a-style';
    s.textContent=`
@media(max-width:700px){
  .pxl-mr-0041a-wrap{overflow-x:hidden!important;width:100%!important;max-width:100%!important}
  table.pxl-mr-0041a-table{table-layout:fixed!important;width:100%!important;min-width:0!important;max-width:100%!important}
  table.pxl-mr-0041a-table th,table.pxl-mr-0041a-table td{box-sizing:border-box!important;padding:6px 3px!important;vertical-align:middle!important;min-width:0!important;max-width:none!important}
  table.pxl-mr-0041a-table th{font-size:8.5px!important;line-height:1.08!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important;text-align:center!important;font-weight:700!important}
  table.pxl-mr-0041a-table td:nth-child(1){text-align:center!important;font-size:11px!important}
  table.pxl-mr-0041a-table th:nth-child(2),table.pxl-mr-0041a-table td:nth-child(2){text-align:left!important}
  table.pxl-mr-0041a-table td:nth-child(2){font-size:11.5px!important;line-height:1.2!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important}
  table.pxl-mr-0041a-table td:nth-child(2) *{box-sizing:border-box!important;max-width:100%!important;min-width:0!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important;text-overflow:clip!important;overflow:visible!important}
  table.pxl-mr-0041a-table td:nth-child(2) input,
  table.pxl-mr-0041a-table td:nth-child(2) select,
  table.pxl-mr-0041a-table td:nth-child(2) button{width:100%!important;max-width:100%!important;min-width:0!important;font-size:11px!important;padding:5px 6px!important}
  table.pxl-mr-0041a-table td:nth-child(2) small,
  table.pxl-mr-0041a-table td:nth-child(2) .muted{font-size:9px!important;line-height:1.15!important}
  table.pxl-mr-0041a-table th:nth-child(n+3),table.pxl-mr-0041a-table td:nth-child(n+3){text-align:center!important;font-size:10px!important;padding-left:2px!important;padding-right:2px!important}
  table.pxl-mr-0041a-table td:nth-child(n+3) input{width:100%!important;min-width:0!important;max-width:100%!important;padding:4px 2px!important;text-align:center!important;font-size:10px!important}
}
`;
    document.head.appendChild(s);
  }
  const obs=new MutationObserver(()=>mark());
  function init(){css();mark();obs.observe(document.body,{childList:true,subtree:true});[200,500,1000,1800,3000].forEach(ms=>setTimeout(mark,ms));}
  window.PXL_URG_0041={revision:REV,refresh:mark};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
