const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'../..');
const {materialRequiresInventory}=require(path.join(root,'pxl-urg-0107f2-so-package-validation'));
const validator=fs.readFileSync(path.join(root,'pxl-stg-0006b.js'),'utf8');

assert.equal(materialRequiresInventory({item_type:'item',name:'Material Kabel Listrik 2 Meter'}),true);
assert.equal(materialRequiresInventory({item_type:'item',name:'Material Kabel Listrik 2 Meter',source_type:'master_package',package_id:'pkg-1'}),false);
assert.equal(materialRequiresInventory({item_type:'item',name:'Material Kabel Listrik 2 Meter',package_id:'pkg-1'}),false);
assert.equal(materialRequiresInventory({item_type:'service',name:'Jasa Instalasi'}),false);
assert.equal(materialRequiresInventory({item_type:'item',inventory_item_id:'inv-1'}),false);
assert(validator.includes("materialRequiresInventory(raw)"));
console.log('PASS PXL-URG-0107F2');
