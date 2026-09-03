/* PXL-URG-0041B — Material Request mobile readability only. No flow/logic/database changes. */
(function(){
  'use strict';
  const REV='PXL-URG-0041B';
  if(window.PXL_URG_0041?.revision===REV)return;
  const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
  const MOBILE=()=>window.matchMedia('(max-width:700px)').matches;

  function headerMap(table){
    const th=[...table.querySelectorAll('thead th')];
    const names=th.map(x=>norm(x.textContent));
    const idx={
      no:names.findIndex(x=>x==='no'),
      item:names.findIndex(x=>x.includes('item / nama material')),
      ambil:names.findIndex(x=>x.includes('pengambilan')),
      pakai:names.findIndex(x=>x.includes('pemakaian')),
      kembali:names.findIndex(x=>x.includes('pengembalian')),
      sisa:names.findIndex(x=>x.includes('sisa material'))
    };
    return {th,names,idx};
  }
  function isMrTable(table){
    const m=headerMap(table).idx;
    return m.item>=0&&m.ambil>=0&&m.pakai>=0&&m.kembali>=0;
  }
  function setImp(el,prop,val){if(el)el.style.setProperty(prop,val,'important')}

  function applyWidths(table){
    if(!MOBILE())return;
    const {th,idx}=headerMap(table);
    const total=th.length;
    const widths=new Array(total).fill('11%');
    if(idx.no>=0)widths[idx.no]='6%';
    if(idx.item>=0)widths[idx.item]=idx.sisa>=0?'44%':'50%';
    if(idx.ambil>=0)widths[idx.ambil]=idx.sisa>=0?'12.5%':'14.5%';
    if(idx.pakai>=0)widths[idx.pakai]=idx.sisa>=0?'12.5%':'14.5%';
    if(idx.kembali>=0)widths[idx.kembali]=idx.sisa>=0?'12.5%':'14.5%';
    if(idx.sisa>=0)widths[idx.sisa]='12.5%';

    table.querySelectorAll('colgroup[data-pxl-mr-0041]').forEach(x=>x.remove());
    const cg=document.createElement('colgroup');cg.dataset.pxlMr0041='0041B';
    widths.forEach(w=>{const c=document.createElement('col');setImp(c,'width',w);cg.appendChild(c)});
    table.insertBefore(cg,table.firstChild);

    setImp(table,'table-layout','fixed');setImp(table,'width','100%');setImp(table,'max-width','100%');setImp(table,'min-width','0');
    const wrap=table.parentElement;
    if(wrap){wrap.classList.add('pxl-mr-0041b-wrap');setImp(wrap,'width','100%');setImp(wrap,'max-width','100%');setImp(wrap,'min-width','0');setImp(wrap,'overflow-x','hidden');}

    [...table.rows].forEach(row=>{
      [...row.cells].forEach((cell,i)=>{
        if(widths[i]){setImp(cell,'width',widths[i]);setImp(cell,'max-width',widths[i]);setImp(cell,'min-width','0');}
        setImp(cell,'box-sizing','border-box');
      });
    });

    if(idx.item>=0){
      table.querySelectorAll(`tr > *:nth-child(${idx.item+1})`).forEach(cell=>{
        setImp(cell,'white-space','normal');setImp(cell,'overflow','visible');setImp(cell,'word-break','normal');setImp(cell,'overflow-wrap','anywhere');
        cell.querySelectorAll('*').forEach(el=>{
          setImp(el,'max-width','100%');setImp(el,'min-width','0');setImp(el,'white-space','normal');setImp(el,'text-overflow','clip');
          if(['INPUT','SELECT','BUTTON'].includes(el.tagName))setImp(el,'width','100%');
        });
      });
    }
  }

  function mark(){
    document.querySelectorAll('table').forEach(table=>{
      if(!isMrTable(table))return;
      table.classList.add('pxl-mr-0041b-table');
      applyWidths(table);
    });
  }

  function css(){
    if(document.getElementById('pxl-mr-0041b-style'))return;
    const s=document.createElement('style');s.id='pxl-mr-0041b-style';
    s.textContent=`
@media(max-width:700px){
  .pxl-mr-0041b-wrap{overflow-x:hidden!important;width:100%!important;max-width:100%!important;min-width:0!important}
  table.pxl-mr-0041b-table{table-layout:fixed!important;width:100%!important;max-width:100%!important;min-width:0!important}
  table.pxl-mr-0041b-table th,table.pxl-mr-0041b-table td{padding:6px 3px!important;vertical-align:middle!important;min-width:0!important;box-sizing:border-box!important}
  table.pxl-mr-0041b-table th{font-size:8px!important;line-height:1.08!important;white-space:normal!important;overflow-wrap:anywhere!important;text-align:center!important;font-weight:700!important}
  table.pxl-mr-0041b-table td{font-size:10.5px!important;line-height:1.18!important}
  table.pxl-mr-0041b-table td:nth-child(1){text-align:center!important}
  table.pxl-mr-0041b-table td:nth-child(2){text-align:left!important;font-size:10.5px!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important}
  table.pxl-mr-0041b-table td:nth-child(2) *{max-width:100%!important;min-width:0!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important;text-overflow:clip!important}
  table.pxl-mr-0041b-table td:nth-child(2) input,
  table.pxl-mr-0041b-table td:nth-child(2) select,
  table.pxl-mr-0041b-table td:nth-child(2) button{width:100%!important;max-width:100%!important;min-width:0!important;font-size:10px!important;padding:5px 4px!important}
  table.pxl-mr-0041b-table td:nth-child(2) small,
  table.pxl-mr-0041b-table td:nth-child(2) .muted{font-size:8.5px!important;line-height:1.15!important}
  table.pxl-mr-0041b-table td:nth-child(n+3){text-align:center!important;font-size:10px!important;padding-left:1px!important;padding-right:1px!important}
  table.pxl-mr-0041b-table td:nth-child(n+3) input{width:100%!important;min-width:0!important;max-width:100%!important;padding:4px 1px!important;text-align:center!important;font-size:9.5px!important}
}
`;
    document.head.appendChild(s);
  }
  const obs=new MutationObserver(()=>requestAnimationFrame(mark));
  function init(){css();mark();obs.observe(document.body,{childList:true,subtree:true});[100,300,600,1000,1800,3000,5000].forEach(ms=>setTimeout(mark,ms));window.addEventListener('resize',mark);}
  window.PXL_URG_0041={revision:REV,refresh:mark};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
