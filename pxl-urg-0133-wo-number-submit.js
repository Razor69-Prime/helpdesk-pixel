'use strict';
// PXL-URG-0133 — recover WO number during Submit using the existing live-ticket generator.
// Only transforms the main app HTML; does not mutate WO data or business endpoints.
const BEFORE="async function saveReport(){\n  const wo=document.getElementById('f-wo').value.trim();";
const AFTER="async function saveReport(){\n  const wo=(await window.PXL_URG_0010?.ensure?.())||document.getElementById('f-wo').value.trim();";
const MESSAGE_BEFORE="if(!wo){showAlert('error','Nomor WO wajib diisi.');return;}";
const MESSAGE_AFTER="if(!wo){showAlert('error','Nomor WO belum berhasil dibuat otomatis. Periksa koneksi lalu coba lagi.');return;}";
const SUBMIT_BEFORE="const saved=await api('POST','/tickets',payload);";
const SUBMIT_AFTER="let saved;try{saved=await api('POST','/tickets',payload);}catch(error){if(!/Nomor WO sudah pernah digunakan/i.test(String(error?.message||'')))throw error;const current=await window.PXL_URG_0010?.ensure?.();if(!current||current===payload.wo_number)throw error;payload.wo_number=current;saved=await api('POST','/tickets',payload);}";
const RESET_BEFORE="showAlert('success'); clearForm(); renderKPI(); renderTickets();";
const RESET_AFTER="showAlert('success'); clearForm(); setTimeout(()=>window.PXL_URG_0010?.refresh?.(),0); renderKPI(); renderTickets();";
function patchWoSubmitNumber(html){
  let source=String(html||'');
  if(source.includes(AFTER))return source;
  if(!source.includes(BEFORE)||!source.includes(MESSAGE_BEFORE)||!source.includes(SUBMIT_BEFORE)||!source.includes(RESET_BEFORE))throw Error('PXL-URG-0133: legacy WO submit signature changed; abort safe patch.');
  return source.replace(BEFORE,AFTER).replace(MESSAGE_BEFORE,MESSAGE_AFTER).replace(SUBMIT_BEFORE,SUBMIT_AFTER).replace(RESET_BEFORE,RESET_AFTER);
}
module.exports={patchWoSubmitNumber,BEFORE,AFTER};
