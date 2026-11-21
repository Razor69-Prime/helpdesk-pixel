'use strict';
// Warehouse permission keys remain inside user.custom_menus (no DB migration).
// Marker permits explicit denial even for legacy Warehouse roles.
const configured='warehouse_access_configured';
const permissions=['warehouse_view','warehouse_usage_write','warehouse_material_manage','warehouse_stock_verify'];
const legacyRoles=new Set(['manager','admin','warehouse','warehouseadmin']);
const norm=v=>String(v??'').toLowerCase().replace(/[\s_-]/g,'');
function can(user,permission='warehouse_view'){
 if(!user)return false;
 if(norm(user.role)==='superadmin')return true; // unconditional bypass, even custom override
 if(!permissions.includes(permission))return false;
 const menus=Array.isArray(user.custom_menus)?user.custom_menus:[];
 if(menus.includes(configured)){
  return menus.includes('warehouse_view')&&menus.includes(permission);
 }
 // Backward compatibility for accounts whose Warehouse permissions have never been configured.
 return legacyRoles.has(norm(user.role))|| (norm(user.role)!=='technician'&&norm(user.role)!=='technisi'&&menus.includes('material_return_verify'))||menus.includes(permission)&&menus.includes('warehouse_view');
}
function flags(user){return Object.fromEntries(permissions.map(id=>[id,can(user,id)]));}
module.exports={can,flags,configured,permissions};
