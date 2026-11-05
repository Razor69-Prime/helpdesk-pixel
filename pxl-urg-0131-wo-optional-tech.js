'use strict';
// PXL-URG-0131 — restore optional technician selection for manual WO creation.
// Operates on the served HTML only; never mutates index.html or business data.
const LABEL_BEFORE='Teknisi 1 (wajib)...';
const LABEL_AFTER='Teknisi 1 (opsional)...';
const REQUIRED_GUARD="if(canAssign&&!tech1){showAlert('error','Wajib memilih minimal 1 teknisi.');return;}";

function patchWoOptionalTechnician(html){
  const src=String(html||'');
  return src.replaceAll(LABEL_BEFORE,LABEL_AFTER).replace(REQUIRED_GUARD,'');
}

module.exports={patchWoOptionalTechnician,LABEL_BEFORE,LABEL_AFTER,REQUIRED_GUARD};
