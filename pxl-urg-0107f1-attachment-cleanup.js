'use strict';

const ATTACH_EXPIRE_DAYS = 30;

function isExpiredLocalAttachment(inv, now = new Date()) {
  if (!inv || inv.file_deleted) return false;
  const fileUrl = String(inv.file_url || '');
  if (!fileUrl.startsWith('/uploads/')) return false;
  if (!inv.uploaded_at) return false;
  const uploadedAt = new Date(inv.uploaded_at);
  if (Number.isNaN(uploadedAt.getTime())) return false;
  const ageDays = (now - uploadedAt) / (1000 * 60 * 60 * 24);
  return ageDays >= ATTACH_EXPIRE_DAYS;
}

module.exports = { ATTACH_EXPIRE_DAYS, isExpiredLocalAttachment };
