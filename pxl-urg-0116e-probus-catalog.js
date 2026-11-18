'use strict';
// Official purchasable/searchable materials are active PROBUS pricelist items.
// Inventory and historical source rows must remain unchanged for existing SO/WO/MR.
const PREFIX='MANUAL:PROBUS:';
const isProbus=value=>String(value||'').startsWith(PREFIX);
const officialSku=value=>isProbus(value)?String(value).slice(PREFIX.length):'';
function selectOfficialCatalog({inventory=[],prices=[],maps=[]}){
  // Caller supplies only active price rows. Never infer official status from a product name.
  const byKey=new Map(prices.filter(p=>isProbus(p.source_key)&&p.is_active!==false).map(p=>[String(p.source_key),p]));
  const byInventory=new Map(maps.filter(m=>byKey.has(String(m.source_key))).map(m=>[String(m.inventory_item_id),m]));
  const officialInventory=inventory.filter(i=>byInventory.has(String(i.id)));
  const usedKeys=new Set(officialInventory.map(i=>String(byInventory.get(String(i.id)).source_key)));
  const officialUnmapped=prices.filter(p=>byKey.has(String(p.source_key))&&!usedKeys.has(String(p.source_key)));
  return {officialInventory,officialUnmapped,byInventory,byKey};
}
module.exports={PREFIX,isProbus,officialSku,selectOfficialCatalog};
