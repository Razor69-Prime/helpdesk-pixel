/* PXL-URG-0041D — Material Request mobile readability only. No flow/logic/database changes. */
(function(){
  'use strict';
  const REV='PXL-URG-0041D';
  if(window.PXL_URG_0041?.revision===REV)return;
  const MOBILE=()=>window.matchMedia('(max-width:900px)').matches;
  const setImp=(el,p,v)=>{if(el)el.style.setProperty(p,v,'important')};

  function enhanceRow(row){
    if(!row)return;
    const input=row.querySelector('.mr-name');
    if(!input)return;
    const cell=input.closest('td');
    if(!cell)return;

    if(input.readOnly){
      let display=row.querySelector('.pxl-mr-name-wrap');
      if(!display){
        display=document.createElement('div');
        display.className='pxl-mr-name-wrap';
        input.insertAdjacentElement('afterend',display);
      }
      display.textContent=input.value||'-';
      display.title=input.value||'';

      // Keep SKU as useful reference, remove Stock/unit text on mobile to free space.
      const meta=[...cell.children].find(el=>el.tagName==='DIV'&&!el.classList.contains('pxl-mr-name-wrap'));
      if(meta){
        const sku=String(row.dataset.sku||'').trim();
        meta.classList.add('pxl-mr-item-meta');
        meta.textContent=sku?`SKU: ${sku}`:'';
      }
    }
  }

  function apply(){
    const table=document.getElementById('mr-items-table');
    if(!table)return;
    table.dataset.pxlMrLayout='0041D';
    document.querySelectorAll('#mr-items-body tr').forEach(enhanceRow);
    if(!MOBILE())return;

    setImp(table,'table-layout','fixed');
    setImp(table,'width','100%');
    setImp(table,'max-width','100%');
    setImp(table,'min-width','0');

    // Directly override inline widths from the original renderer.
    const widths=['6%','48%','12%','12%','14%','8%'];
    [...table.rows].forEach(row=>{
      [...row.cells].forEach((cell,i)=>{
        if(!widths[i])return;
        setImp(cell,'width',widths[i]);
        setImp(cell,'max-width',widths[i]);
        setImp(cell,'min-width','0');
        setImp(cell,'box-sizing','border-box');
      });
    });
  }

  function installStyle(){
    document.getElementById('pxl-mr-0041b-style')?.remove();
    document.getElementById('pxl-mr-0041c-style')?.remove();
    if(document.getElementById('pxl-mr-0041d-style'))return;
    const s=document.createElement('style');
    s.id='pxl-mr-0041d-style';
    s.textContent=`
.pxl-mr-name-wrap{display:none}
@media(max-width:900px){
  #mr-items-table{table-layout:fixed!important;width:100%!important;max-width:100%!important;min-width:0!important;font-size:9px!important}
  #mr-items-table th,#mr-items-table td{box-sizing:border-box!important;min-width:0!important;padding:4px 1px!important;vertical-align:middle!important;overflow:hidden!important}
  #mr-items-table th{font-size:7.5px!important;line-height:1.08!important;white-space:normal!important;overflow-wrap:anywhere!important;text-align:center!important;font-weight:700!important}
  #mr-items-table th:nth-child(1),#mr-items-table td:nth-child(1){width:6%!important;max-width:6%!important}
  #mr-items-table th:nth-child(2),#mr-items-table td:nth-child(2){width:48%!important;max-width:48%!important;text-align:left!important;overflow:visible!important}
  #mr-items-table th:nth-child(3),#mr-items-table td:nth-child(3){width:12%!important;max-width:12%!important;text-align:center!important}
  #mr-items-table th:nth-child(4),#mr-items-table td:nth-child(4){width:12%!important;max-width:12%!important;text-align:center!important}
  #mr-items-table th:nth-child(5),#mr-items-table td:nth-child(5){width:14%!important;max-width:14%!important;text-align:center!important}
  #mr-items-table th:nth-child(6),#mr-items-table td:nth-child(6){width:8%!important;max-width:8%!important;text-align:center!important}

  #mr-items-table .mr-name[readonly]{display:none!important}
  #mr-items-table .pxl-mr-name-wrap{display:block!important;width:100%!important;max-width:100%!important;font-size:10px!important;font-weight:600!important;line-height:1.22!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important;color:var(--text)!important;padding:2px!important}
  #mr-items-table .pxl-mr-item-meta{display:block!important;width:100%!important;max-width:100%!important;font-size:7.5px!important;line-height:1.12!important;color:var(--muted)!important;white-space:normal!important;overflow-wrap:anywhere!important;padding:1px 2px!important}
  #mr-items-table .pxl-mr-item-meta:empty{display:none!important}
  #mr-items-table .mr-name:not([readonly]){font-size:9px!important;line-height:1.15!important;padding:3px 2px!important;min-width:0!important;width:100%!important}
  #mr-items-table .mr-qout,#mr-items-table .mr-quse,#mr-items-table .mr-qret{font-size:9px!important;padding:2px 0!important;min-width:0!important;width:100%!important;text-align:center!important}
  #mr-items-table td:nth-child(6) .btn{font-size:8px!important;padding:2px!important;min-width:0!important}
}
`;
    document.head.appendChild(s);
  }

  let bodyObs=null;
  function observeRows(){
    const body=document.getElementById('mr-items-body');
    if(!body||bodyObs)return;
    bodyObs=new MutationObserver(()=>requestAnimationFrame(apply));
    bodyObs.observe(body,{childList:true,subtree:true,attributes:true,attributeFilter:['value','readonly']});
  }
  function init(){
    installStyle();apply();observeRows();
    const rootObs=new MutationObserver(()=>{apply();observeRows()});
    rootObs.observe(document.body,{childList:true,subtree:true});
    [50,150,300,600,1000,1800,3000,5000].forEach(ms=>setTimeout(()=>{apply();observeRows()},ms));
    window.addEventListener('resize',apply);
  }
  window.PXL_URG_0041={revision:REV,refresh:apply};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
