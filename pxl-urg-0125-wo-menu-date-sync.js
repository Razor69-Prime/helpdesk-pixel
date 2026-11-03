'use strict';
// PXL-URG-0125 — restore WO date edit + Kanban/Timeline integration on served HTML.
function addScript(html,src){
  const out=String(html||'');
  const base=src.split('?')[0];
  if(out.includes(base)) return out;
  return out.replace('</body>',`<script src="${src}"></script>\n</body>`);
}
function patchWoMenuDateSync(html){
  let src=String(html||'');
  if(!src.includes('const dateEditBtn=canEditWoDate')){
    const anchor="    // GPS: admin lihat GPS\n    const gpsMeta=isAdmin&&hasGPS?gpsLink(t.last_lat,t.last_lng):'';";
    const insert=anchor+"\n    // PXL-URG-0125 — edit tanggal WO via canonical Kanban schedule endpoint.\n    const canEditWoDate=['manager','superadmin'].includes(String(currentUser.role||'').toLowerCase());\n    const dateEditBtn=canEditWoDate?`<button type=\"button\" class=\"pxl-0125-date-btn\" title=\"Edit Tanggal WO\" onclick=\"pxlEditWoSchedule('${t.id}')\" style=\"border:0;background:transparent;padding:1px 4px;margin-left:2px;cursor:pointer;font-size:11px\">✏️</button>`:'';";
    if(src.includes(anchor)) src=src.replace(anchor,insert);
    src=src.replace('<span>🕐 ${dt}</span>','<span>🕐 ${dt}${dateEditBtn}</span>');
  }
  src=addScript(src,'/pxl-stg-0007h-auth.js?v=PXL-URG-0125');
  src=addScript(src,'/pxl-stg-0007j-layout.js?v=PXL-URG-0127');
  src=addScript(src,'/pxl-stg-0007l-timeline.js?v=PXL-URG-0125');
  src=addScript(src,'/pxl-urg-0125-wo-date-sync.js?v=PXL-URG-0125');
  src=addScript(src,'/pxl-urg-0126-kanban-unhide.js?v=PXL-URG-0126');
  return src;
}
module.exports={patchWoMenuDateSync};
