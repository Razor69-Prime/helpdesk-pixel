'use strict';
// PXL-URG-0123 — server-side WO Detail button patch. No browser observer/polling.
function patchWoDetail(html){
  let src=String(html||'');
  if(src.includes('PXL-URG-0123 — native Detail button')) return src;

  const photoAnchor=`    const photoBtn=canUploadWoPhoto\n      ?\`<button class="btn blue sm" style="padding:4px 9px;font-size:11px" title="Upload dan lihat dokumentasi foto WO" onclick="openWoPhotoModal('\${t.id}')">📷 Foto</button>\`:'';\n\n    // ── Job Stage buttons (teknisi saja) ──\n`;
  const photoInsert=`    const photoBtn=canUploadWoPhoto\n      ?\`<button class="btn blue sm" style="padding:4px 9px;font-size:11px" title="Upload dan lihat dokumentasi foto WO" onclick="openWoPhotoModal('\${t.id}')">📷 Foto</button>\`:'';\n    // PXL-URG-0123 — native Detail button; lazy-load modal only when clicked.\n    const detailBtn=\`<button class="btn sm" style="padding:4px 9px;font-size:11px" title="Lihat Detail Work Order" onclick="(function(id){if(window.PXL_URG_0038?.open){window.PXL_URG_0038.open(id);return;}let s=[...document.scripts].find(x=>String(x.src||'').includes('pxl-urg-0038-ticket-detail-modal.js'));if(!s){s=document.createElement('script');s.src='/pxl-urg-0038-ticket-detail-modal.js?v=PXL-URG-0123';document.head.appendChild(s);}s.addEventListener('load',()=>window.PXL_URG_0038?.open?.(id),{once:true});})('\${t.id}')">🔎 Detail</button>\`;\n\n    // ── Job Stage buttons (teknisi saja) ──\n`;
  if(!src.includes(photoAnchor)) return src;
  src=src.replace(photoAnchor,photoInsert);

  const actionAnchor=`          \${photoBtn}\n          \${surveyResultBtn}\n`;
  const actionInsert=`          \${photoBtn}\n          \${detailBtn}\n          \${surveyResultBtn}\n`;
  if(!src.includes(actionAnchor)) return String(html||'');
  return src.replace(actionAnchor,actionInsert);
}
module.exports={patchWoDetail};
