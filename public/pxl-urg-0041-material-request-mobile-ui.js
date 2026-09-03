/* PXL-URG-0041E — Material Request mobile readability + stability fix. No flow/logic/database changes. */
(function(){
  'use strict';
  const REV='PXL-URG-0041E';
  if(window.PXL_URG_0041?.revision===REV)return;
  const MOBILE=()=>window.matchMedia('(max-width:900px)').matches;
  const setImp=(el,p,v)=>{if(el)el.style.setProperty(p,v,'important')};
  let rafPending=false;
  let bodyObs=null;

  function enhanceRow(row){
    if(!row)return;
    const input=row.querySelector('.mr-name');
    if(!input||!input.readOnly)return;
    const cell=input.closest('td');
    if(!cell)return;

    let display=row.querySelector('.pxl-mr-name-wrap');
    if(!display){
      display=document.createElement('div');
      display.className='pxl-mr-name-wrap';
      input.insertAdjacentElement('afterend',display);
    }
    const nextName=input.value||'-';
    if(display.textContent!==nextName)display.textContent=nextName;
    if(display.title!==(input.value||''))display.title=input.value||'';

    const meta=[...cell.children].find(el=>el.tagName==='DIV'&&!el.classList.contains('pxl-mr-name-wrap'));
    if(meta){
      const sku=String(row.dataset.sku||'').trim();
      const nextMeta=sku?`SKU: ${sku}`:'';
      meta.classList.add('pxl-mr-item-meta');
      if(meta.textContent!==nextMeta)meta.textContent=nextMeta;
    }
  }

  function apply(){
    rafPending=false;
    const table=document.getElementById('mr-items-table');
    if(!table)return;
    table.dataset.pxlMrLayout='0041E';
    document.querySelectorAll('#mr-items-body tr').forEach(enhanceRow);
    if(!MOBILE())return;

    setImp(table,'table-layout','fixed');
    setImp(table,'width','100%');
    setImp(table,'max-width','100%');
    setImp(table,'min-width','0');

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

  function scheduleApply(){
    if(rafPending)return;
    rafPending=true;
    requestAnimationFrame(apply);
  }

  function installStyle(){
    ['pxl-mr-0041b-style','pxl-mr-0041c-style','pxl-mr-0041d-style'].forEach(id=>document.getElementById(id)?.remove());
    if(document.getElementById('pxl-mr-0041e-style'))return;
    const s=document.createElement('style');
    s.id='pxl-mr-0041e-style';
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

  function observeRows(){
    const body=document.getElementById('mr-items-body');
    if(!body)return;
    if(bodyObs){bodyObs.disconnect();bodyObs=null;}
    bodyObs=new MutationObserver(scheduleApply);
    // Observe only row add/remove. Do not observe subtree/attributes to avoid render loops.
    bodyObs.observe(body,{childList:true,subtree:false});
  }

  function init(){
    installStyle();
    apply();
    observeRows();
    [100,300,700,1400,2800].forEach(ms=>setTimeout(()=>{apply();observeRows()},ms));
    window.addEventListener('resize',scheduleApply,{passive:true});
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#mr-items-table,.mr-card,.material-request,.section'))setTimeout(scheduleApply,0);
    },true);
  }

  window.PXL_URG_0041={revision:REV,refresh:apply};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
