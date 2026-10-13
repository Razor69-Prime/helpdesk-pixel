'use strict';

function normalizeRole(role){return String(role||'').toLowerCase().replace(/[ _-]/g,'');}
function normalizePhotoIds(photoIds){
  const out=[];const seen=new Set();
  for(const raw of Array.isArray(photoIds)?photoIds:[]){const id=String(raw||'').trim();if(!id||seen.has(id))continue;seen.add(id);out.push(id)}
  return out;
}
function validateProjectPhotoEvidence({itemId,photoIds,photos}){
  const ids=normalizePhotoIds(photoIds);
  if(!ids.length)return {ok:false,error:'Minimal 1 foto Project wajib dipilih.'};
  const byId=new Map((Array.isArray(photos)?photos:[]).map(p=>[String(p.id),p]));
  for(const id of ids){const p=byId.get(id);if(!p)return {ok:false,error:'Foto Project tidak ditemukan.'};if(p.deleted_at)return {ok:false,error:'Foto Project sudah dihapus.'};if(String(p.project_report_item_id)!==String(itemId))return {ok:false,error:'Foto Project harus berasal dari item BOQ yang sama.'}}
  return {ok:true,photoIds:ids};
}
function isProjectPhotoUploadRole(role){return ['technician','manager','admin','superadmin'].includes(normalizeRole(role));}
function isProjectPhotoDeleteRole(role){return ['admin','superadmin'].includes(normalizeRole(role));}
function safeProjectPhotoFilename(value){return String(value||'project-photo').trim().replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'project-photo';}

function projectPhotoDownloadFilename(photo={}){
  const raw=photo.original_filename||photo.generated_filename||photo.cloudinary_public_id||photo.id||'project-photo.jpg';
  const base=safeProjectPhotoFilename(String(raw).replace(/\.[^.]+$/,''));
  return base+'.jpg';
}
function projectPhotoZipFilename({projectNumber,itemId}={}){
  return safeProjectPhotoFilename(`${projectNumber||'PROJECT'}_${itemId||'ITEM'}_FOTO`)+'.zip';
}
function projectPhotoZipEntryName(photo={},index=0){
  const date=String(photo.evidence_time||photo.uploaded_at||'').slice(0,10)||'no-date';
  return `${String(index+1).padStart(3,'0')}_${safeProjectPhotoFilename(date)}_${projectPhotoDownloadFilename(photo)}`;
}

module.exports={normalizePhotoIds,validateProjectPhotoEvidence,isProjectPhotoUploadRole,isProjectPhotoDeleteRole,safeProjectPhotoFilename,projectPhotoDownloadFilename,projectPhotoZipFilename,projectPhotoZipEntryName};
