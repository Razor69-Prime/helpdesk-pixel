/* PXL-URG-0041C — Material Request mobile readability only. No flow/logic/database changes. */
(function(){
  'use strict';
  const REV='PXL-URG-0041C';
  if(window.PXL_URG_0041?.revision===REV)return;
  const MOBILE=()=>window.matchMedia('(max-width:700px)').matches;
  const setImp=(el,p,v)=>{if(el)el.style.setProperty(p,v,'important')};

  function enhanceRow(row){
    if(!row)return;
    const input=row.querySelector('.mr-name');
    if(!input||!input.readOnly)return;
    let display=row.querySelector('.pxl-mr-name-wrap');
    if(!display){
      display=document.createElement('div');
      display.className='pxl-mr-name-wrap';
      input.insertAdjacentElement('afterend',display);
      const sync=()=>{display.textContent=input.value||'-'};
      input.addEventListener('input',sync);
      input.addEventListener('change',sync);
      sync();
    }else display.textContent=input.value||'-';
  }

  function apply(){
    const table=document.getElementById('mr-items-table');
    if(!table)return;
    table.dataset.pxlMrLayout='0041C';
    if(MOBILE()){
      setImp(table,'table-layout','fixed');
      setImp(table,'width','100%');
      setImp(table,'max-width','100%');
      const widths=['7%','46%','13%','13%','13%','8%'];
      [...table.rows].forEach(row=>{
        [...row.cells].forEach((cell,i)=>{
          if(widths[i]){
            setImp(cell,'width',widths[i]);
            setImp(cell,'max-width',widths[i]);
            setImp(cell,'min-width','0');
          }
        });
      });
    }
    document.querySelectorAll('#mr-items-body tr').forEach(enhanceRow);
  }

  function installStyle(){
    if(document.getElementById('pxl-mr-0041c-style'))return;
    const s=document.createElement('style');
    s.id='pxl-mr-0041c-style';
    s.textContent=`
.pxl-mr-name-wrap{display:none}
@media(max-width:700px){
  #mr-items-table{table-layout:fixed!important;width:100%!important;max-width:100%!important;min-width:0!important;font-size:10px!important}
  #mr-items-table th,#mr-items-table td{box-sizing:border-box!important;min-width:0!important;padding:5px 2px!important;vertical-align:middle!important}
  #mr-items-table th{font-size:8.5px!important;line-height:1.12!important;white-space:normal!important;overflow-wrap:anywhere!important;text-align:center!important}
  #mr-items-table th:nth-child(1),#mr-items-table td:nth-child(1){width:7%!important;max-width:7%!important}
  #mr-items-table th:nth-child(2),#mr-items-table td:nth-child(2){width:46%!important;max-width:46%!important;text-align:left!important}
  #mr-items-table th:nth-child(3),#mr-items-table td:nth-child(3),
  #mr-items-table th:nth-child(4),#mr-items-table td:nth-child(4),
  #mr-items-table th:nth-child(5),#mr-items-table td:nth-child(5){width:13%!important;max-width:13%!important;text-align:center!important}
  #mr-items-table th:nth-child(6),#mr-items-table td:nth-child(6){width:8%!important;max-width:8%!important;text-align:center!important}
  #mr-items-table .mr-name[readonly]{display:none!important}
  #mr-items-table .pxl-mr-name-wrap{display:block!important;font-size:10.5px!important;font-weight:600!important;line-height:1.28!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important;color:var(--text)!important;padding:2px 2px 4px!important}
  #mr-items-table td:nth-child(2)>div:not(.pxl-mr-name-wrap){font-size:8.5px!important;line-height:1.2!important;white-space:normal!important;overflow-wrap:anywhere!important;padding:2px!important}
  #mr-items-table .mr-name:not([readonly]){font-size:10px!important;line-height:1.2!important;padding:4px 3px!important;min-width:0!important;width:100%!important}
  #mr-items-table .mr-qout,#mr-items-table .mr-quse,#mr-items-table .mr-qret{font-size:10px!important;padding:3px 1px!important;min-width:0!important;width:100%!important;text-align:center!important}
  #mr-items-table td:nth-child(6) .btn{font-size:9px!important;padding:3px!important;min-width:0!important}
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
    [100,300,700,1200,2200,4000].forEach(ms=>setTimeout(()=>{apply();observeRows()},ms));
    window.addEventListener('resize',apply);
  }
  window.PXL_URG_0041={revision:REV,refresh:apply};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
