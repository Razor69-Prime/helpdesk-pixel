'use strict';

function isFieldAddition(value){
  return value===true||String(value||'').toLowerCase()==='true';
}

function assessMaterialRequestStock(items,inventoryItems){
  const requested=Array.isArray(items)?items:[];
  if(!requested.length){
    return {ok:false,pendingWarehouse:false,canIssue:false,pendingItemIds:[],error:'Material Request tidak memiliki item Inventory.'};
  }

  const inventoryById=new Map((Array.isArray(inventoryItems)?inventoryItems:[]).map(row=>[String(row.id),row]));
  const pendingItemIds=[];

  for(const item of requested){
    const id=String(item?.inventory_item_id||'').trim();
    const qty=Number(item?.qty_out??item?.qty??0);
    if(!id||!Number.isFinite(qty)||qty<=0){
      return {ok:false,pendingWarehouse:false,canIssue:false,pendingItemIds:[],error:'Ada item Material Request yang belum terhubung ke Inventory atau quantity tidak valid.'};
    }

    const inventory=inventoryById.get(id);
    if(!inventory||inventory.is_active===false){
      return {ok:false,pendingWarehouse:false,canIssue:false,pendingItemIds:[],error:'Item Inventory tidak ditemukan atau sudah tidak aktif.'};
    }

    const stock=Number(inventory.stock)||0;
    if(stock<qty){
      if(isFieldAddition(item.field_addition)){
        pendingItemIds.push(id);
        continue;
      }
      const name=inventory.name||item.name||'Item Inventory';
      const unit=inventory.unit||item.unit||'pcs';
      return {
        ok:false,
        pendingWarehouse:false,
        canIssue:false,
        pendingItemIds:[],
        error:`Stok ${name} tidak cukup. Tersedia ${stock.toFixed(2)} ${unit}, diminta ${qty.toFixed(2)} ${unit}.`
      };
    }
  }

  return {
    ok:true,
    pendingWarehouse:pendingItemIds.length>0,
    canIssue:pendingItemIds.length===0,
    pendingItemIds
  };
}

module.exports={assessMaterialRequestStock};
