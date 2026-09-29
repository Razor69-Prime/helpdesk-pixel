'use strict';

function isMasterPackageMaterial(raw = {}) {
  return String(raw.source_type || '').toLowerCase() === 'master_package' ||
    !!raw.package_id ||
    !!raw.package_item_id;
}

function materialRequiresInventory(raw = {}) {
  const rawType = String(raw.item_type || raw.type || 'item').trim().toLowerCase();
  const service = rawType === 'service' || rawType === 'jasa';
  if (service) return false;
  if (raw.inventory_item_id) return false;
  return !isMasterPackageMaterial(raw);
}

module.exports = { isMasterPackageMaterial, materialRequiresInventory };
