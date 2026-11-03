'use strict';

// PXL-URG-0130 — Manager/Superadmin may reschedule non-cancelled WO.
const norm=value=>String(value??'').trim().toLowerCase().replace(/[\s-]+/g,'_');
const LEGACY_ALLOWED_STATUSES=new Set(['assigned','menunggu','waiting','pending']);
const PRIVILEGED_ROLES=new Set(['manager','superadmin']);

function canMoveScheduleDate({role,status}={}){
  const normalizedStatus=norm(status);
  if(normalizedStatus==='cancelled') return false;
  if(PRIVILEGED_ROLES.has(norm(role))) return true;
  return LEGACY_ALLOWED_STATUSES.has(normalizedStatus);
}

module.exports={canMoveScheduleDate,LEGACY_ALLOWED_STATUSES,PRIVILEGED_ROLES};
