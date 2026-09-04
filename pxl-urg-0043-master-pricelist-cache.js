'use strict';
/* PXL-URG-0049 — Master Pricelist permission + safe bulk auto-mapping.
 * Inventory is read-only from this module; mapping is stored separately. PR remains unconnected.
 * Google Sheet remains read-only; frontend sends normalized read results to this API.
 */
const crypto=require('crypto');

module.exports=function installMasterPricelistCache(app,{requireAuth}){
  const role=v=>String(v||'').trim().toLowerCase().replace(/[ _-]/g,'');
  const text=v=>String(v??'').trim();
  const allowedTabs=new Set(['CCTV','NETWORKING','ACCESSORIES']);
  const isSuper=req=>role(req.session?.user?.role)==='superadmin';
  function permissionSet(req){
    const u=req.session?.user||{};
    return new Set(Array.isArray(u.custom_menus)?u.custom_menus.map(String):[]);
  }
  function canRead(req){
    if(isSuper(req))return true;
    const p=permissionSet(req);
    return p.has('master_pricelist_read')||p.has('master_pricelist_write')||p.has('master_pricelist');
  }
  function canWrite(req){
    if(isSuper(req))return true;
    const p=permissionSet(req);
    return p.has('master_pricelist_write');
  }
  const now=()=>new Date().toISOString();

  function cfg(){
    const c=require('./config');
    return {
      url:String(c.SUPABASE_URL||'').replace(/\/$/,''),
      key:process.env.SUPABASE_SERVICE_ROLE_KEY||''
    };
  }
  function headers(extra={}){
    const c=cfg();
    return {
      apikey:c.key,
      Authorization:'Bearer '+c.key,
      'Content-Type':'application/json',
      Prefer:'return=representation',
      ...extra
    };
  }
  async function sb(method,path,body,extraHeaders){
    const c=cfg();
    if(!c.url||!c.key)throw new Error('SUPABASE_SERVICE_ROLE_KEY belum tersedia untuk Master Pricelist cache.');
    const f=global.fetch||require('node-fetch');
    const opt={method,headers:headers(extraHeaders)};
    if(body!==undefined&&body!==null)opt.body=JSON.stringify(body);
    const r=await f(c.url+'/rest/v1'+path,opt);
    const raw=await r.text();
    let data=null;try{data=raw?JSON.parse(raw):null}catch(_){data=raw}
    if(!r.ok){
      const msg=typeof data==='string'?data:(data?.message||data?.error||raw||('HTTP '+r.status));
      const e=new Error(msg);e.status=r.status;throw e;
    }
    return data;
  }
  function schemaMissing(e){
    return /master_pricelist_|PGRST205|42P01|relation .* does not exist|schema cache/i.test(String(e?.message||e));
  }
  function apiError(res,e){
    if(schemaMissing(e))return res.status(503).json({error:'Schema Master Pricelist cache belum dipasang.',code:'MASTER_PRICELIST_SCHEMA_MISSING'});
    return res.status(e?.status||500).json({error:String(e?.message||e)});
  }
  function cleanItem(raw){
    const category=text(raw?.category).toUpperCase();
    const name=text(raw?.name||raw?.item_name);
    const brand=text(raw?.brand)||'LAINNYA';
    const source=text(raw?.source||raw?.source_cell);
    const price=Number(raw?.price);
    if(!allowedTabs.has(category)||!name||!source||!Number.isFinite(price)||price<0)return null;
    return {
      source_key:category+'|'+source.toUpperCase(),
      category,brand,item_name:name,price:Math.round(price),
      source_cell:source
    };
  }
  function userName(req){return text(req.session?.user?.name||req.session?.user?.username||req.session?.user?.id)||'Superadmin';}

  function normalizeName(v){
    return text(v).toUpperCase()
      .replace(/[^A-Z0-9]+/g,' ')
      .replace(/\b(CAMERA|KAMERA|CCTV|IP CAMERA|ANALOG|OUTDOOR|INDOOR|PCS|UNIT)\b/g,' ')
      .replace(/\s+/g,' ').trim();
  }
  function catalogRoleAllowed(req){ return canRead(req); }
  async function inventoryRows(){
    const db=require('./db');
    if(typeof db.getInventoryItems!=='function')throw new Error('Adapter Inventory tidak tersedia.');
    const rows=await db.getInventoryItems();
    return Array.isArray(rows)?rows.filter(x=>x&&x.is_active!==false):[];
  }

  const AUTO_GENERIC=new Set(['CAMERA','KAMERA','CCTV','IP','ANALOG','OUTDOOR','INDOOR','WIRELESS','WIRELES','ROUTER','SWITCH','HUB','POE','NVR','DVR','XVR','ADAPTOR','ADAPTER','KABEL','CABLE','MICRO','SD','HDD','PCS','UNIT','PORT','FULL','COLOR','SOUND','AUDIO','NEW','PRODUCT']);
  const AUTO_GENERIC_MODEL=/^(?:[1-9]\d?MP|[248]K|\d+(?:GB|TB|CH|PORT|V|A|W|M|MM|INCH))$/;
  function autoWords(v){
    return normalizeName(v).split(' ').filter(x=>x&&x.length>1&&!AUTO_GENERIC.has(x)&&!AUTO_GENERIC_MODEL.test(x));
  }
  function autoModels(v){
    const raw=text(v).toUpperCase();
    const matches=raw.match(/[A-Z0-9]+(?:[-_\/][A-Z0-9]+)+|[A-Z]+\d+[A-Z0-9]*|\d+[A-Z]+[A-Z0-9]*/g)||[];
    return [...new Set(matches.map(x=>x.replace(/[^A-Z0-9]/g,'')).filter(x=>x.length>=3&&!AUTO_GENERIC_MODEL.test(x)))];
  }
  function brandMatchesInventory(invName,brand){
    const b=text(brand).toUpperCase();
    if(!b||b==='LAINNYA')return false;
    return normalizeName(invName).includes(b.replace(/[^A-Z0-9]+/g,' '));
  }
  function scoreAutoPair(inv,price){
    const a=normalizeName(inv.name),b=normalizeName(price.item_name);
    if(!a||!b)return {score:0,reason:''};
    if(a===b)return {score:100,reason:'Nama persis'};
    const am=autoModels(inv.name),bm=autoModels(price.item_name);
    const sharedModels=am.filter(x=>bm.includes(x));
    if(sharedModels.length){
      const brandOk=brandMatchesInventory(inv.name,price.brand);
      return {score:brandOk?99:97,reason:'Model '+sharedModels[0]+(brandOk?' + brand':'')};
    }
    const aw=autoWords(inv.name),bw=autoWords(price.item_name);
    const aset=new Set(aw),bset=new Set(bw);
    const common=[...aset].filter(x=>bset.has(x));
    const min=Math.min(aset.size,bset.size);
    const coverage=min?common.length/min:0;
    const compactA=aw.join(' '),compactB=bw.join(' ');
    if(compactA&&compactB&&(compactA.includes(compactB)||compactB.includes(compactA))&&Math.min(compactA.length,compactB.length)>=5){
      return {score:brandMatchesInventory(inv.name,price.brand)?96:94,reason:'Nama utama sama'};
    }
    if(coverage>=0.8&&common.length>=2)return {score:91,reason:'Kemiripan nama tinggi'};
    if(coverage>=0.6&&common.length>=2)return {score:82,reason:'Kemiripan nama'};
    return {score:0,reason:''};
  }
  async function autoMapAnalysis(){
    const [inventory,priceRows,mapRows]=await Promise.all([
      inventoryRows(),
      sb('GET','/master_pricelist_items?is_active=eq.true&select=source_key,category,brand,item_name,price,source_cell'),
      sb('GET','/master_pricelist_inventory_map?select=inventory_item_id,source_key')
    ]);
    const prices=Array.isArray(priceRows)?priceRows:[];
    const maps=Array.isArray(mapRows)?mapRows:[];
    const mappedInventory=new Set(maps.filter(x=>x.source_key).map(x=>String(x.inventory_item_id)));
    const usedSources=new Set(maps.map(x=>x.source_key).filter(Boolean).map(String));
    const available=prices.filter(p=>!usedSources.has(String(p.source_key)));
    const safe=[],review=[],unmatched=[];
    for(const inv of inventory){
      if(mappedInventory.has(String(inv.id)))continue;
      const ranked=available.map(p=>({p,...scoreAutoPair(inv,p)})).filter(x=>x.score>0).sort((x,y)=>y.score-x.score);
      const best=ranked[0],second=ranked[1];
      if(!best){unmatched.push({inventory_item_id:inv.id,sku:inv.sku||null,inventory_name:inv.name||''});continue}
      const row={
        inventory_item_id:inv.id,sku:inv.sku||null,inventory_name:inv.name||'',
        source_key:best.p.source_key,pricelist_name:best.p.item_name,brand:best.p.brand||null,
        price:Number(best.p.price||0),score:best.score,reason:best.reason,
        second_score:second?.score||0,second_name:second?.p?.item_name||null
      };
      if(best.score>=96&&(!second||best.score-second.score>=5))safe.push(row);
      else if(best.score>=82)review.push(row);
      else unmatched.push({inventory_item_id:inv.id,sku:inv.sku||null,inventory_name:inv.name||''});
    }
    // A source price may be suggested for only one safe mapping.
    const bySource=new Map();
    safe.forEach(x=>{const arr=bySource.get(x.source_key)||[];arr.push(x);bySource.set(x.source_key,arr)});
    const finalSafe=[],demoted=[];
    safe.forEach(x=>{
      if((bySource.get(x.source_key)||[]).length===1)finalSafe.push(x);
      else demoted.push({...x,reason:x.reason+' · kandidat sumber ganda'});
    });
    review.push(...demoted);
    return {safe:finalSafe,review,unmatched,already_mapped:mappedInventory.size,total_inventory:inventory.length,total_pricelist:prices.length};
  }


  app.get('/api/master-pricelist/catalog',requireAuth,async(req,res)=>{
    if(!canRead(req))return res.status(403).json({error:'Anda tidak memiliki permission Master Pricelist.'});
    try{
      const [inventory,priceRows,mapRows]=await Promise.all([
        inventoryRows(),
        sb('GET','/master_pricelist_items?is_active=eq.true&select=source_key,category,brand,item_name,price,source_cell'),
        sb('GET','/master_pricelist_inventory_map?select=inventory_item_id,inventory_sku,inventory_name,source_key,mapping_status,mapped_at,mapped_by')
      ]);
      const prices=Array.isArray(priceRows)?priceRows:[];
      const maps=Array.isArray(mapRows)?mapRows:[];
      const priceByKey=new Map(prices.map(x=>[String(x.source_key),x]));
      const mapByInventory=new Map(maps.map(x=>[String(x.inventory_item_id),x]));
      const usedSources=new Set(maps.map(x=>x.source_key).filter(Boolean).map(String));

      const catalog=inventory.map(inv=>{
        const map=mapByInventory.get(String(inv.id))||null;
        let price=map?.source_key?priceByKey.get(String(map.source_key))||null:null;
        let suggestion=null;
        if(!price){
          const key=normalizeName(inv.name);
          const candidates=prices.filter(p=>normalizeName(p.item_name)===key);
          if(candidates.length===1&&!usedSources.has(String(candidates[0].source_key)))suggestion=candidates[0];
        }
        return {
          inventory_item_id:inv.id,
          sku:inv.sku||null,
          inventory_name:inv.name||'',
          inventory_category:inv.category||null,
          unit:inv.unit||'pcs',
          stock:Number(inv.stock||0),
          mapping_status:price?'mapped':(map?.mapping_status||'unmapped'),
          source_key:price?.source_key||map?.source_key||null,
          pricelist_name:price?.item_name||null,
          brand:price?.brand||null,
          price:price?Number(price.price||0):null,
          source_cell:price?.source_cell||null,
          suggested_source_key:suggestion?.source_key||null,
          suggested_name:suggestion?.item_name||null,
          suggested_brand:suggestion?.brand||null,
          suggested_price:suggestion?Number(suggestion.price||0):null
        };
      });

      const mappedSources=new Set(catalog.map(x=>x.source_key).filter(Boolean).map(String));
      const pricelistOnly=prices.filter(p=>!mappedSources.has(String(p.source_key))).map(p=>({
        inventory_item_id:null,sku:null,inventory_name:null,inventory_category:null,unit:null,stock:null,
        mapping_status:'pricelist_only',source_key:p.source_key,pricelist_name:p.item_name,
        brand:p.brand||null,price:Number(p.price||0),source_cell:p.source_cell||null
      }));
      res.json({catalog,pricelist_only:pricelistOnly});
    }catch(e){apiError(res,e)}
  });


  app.get('/api/master-pricelist/auto-map-preview',requireAuth,async(req,res)=>{
    if(!canWrite(req))return res.status(403).json({error:'Anda tidak memiliki permission Write Master Pricelist.'});
    try{res.json(await autoMapAnalysis())}catch(e){apiError(res,e)}
  });

  app.post('/api/master-pricelist/auto-map-safe',requireAuth,async(req,res)=>{
    if(!canWrite(req))return res.status(403).json({error:'Anda tidak memiliki permission Write Master Pricelist.'});
    try{
      const analysis=await autoMapAnalysis();
      const safe=Array.isArray(analysis.safe)?analysis.safe:[];
      if(!safe.length)return res.json({ok:true,mapped:0,skipped:0});
      const stamp=now(),actor=userName(req);
      let mapped=0,skipped=0;
      for(const x of safe){
        const payload={
          inventory_item_id:x.inventory_item_id,inventory_sku:x.sku||null,inventory_name:x.inventory_name||'',
          source_key:x.source_key,mapping_status:'manual',mapped_at:stamp,mapped_by:actor,updated_at:stamp
        };
        try{
          await sb('POST','/master_pricelist_inventory_map?on_conflict=inventory_item_id',payload,{Prefer:'resolution=merge-duplicates,return=minimal'});
          mapped++;
        }catch(e){
          if(/duplicate|unique|23505/i.test(String(e?.message||e))){skipped++;continue}
          throw e;
        }
      }
      res.json({ok:true,mapped,skipped,remaining_review:analysis.review.length,remaining_unmatched:analysis.unmatched.length});
    }catch(e){apiError(res,e)}
  });

  app.post('/api/master-pricelist/map',requireAuth,async(req,res)=>{
    if(!canWrite(req))return res.status(403).json({error:'Anda tidak memiliki permission Write Master Pricelist.'});
    try{
      const inventoryItemId=text(req.body?.inventory_item_id);
      const sourceKey=text(req.body?.source_key);
      if(!inventoryItemId)return res.status(400).json({error:'Inventory item wajib dipilih.'});
      const inventory=await inventoryRows();
      const inv=inventory.find(x=>String(x.id)===inventoryItemId);
      if(!inv)return res.status(404).json({error:'Item Inventory tidak ditemukan.'});
      if(sourceKey){
        const rows=await sb('GET','/master_pricelist_items?source_key=eq.'+encodeURIComponent(sourceKey)+'&is_active=eq.true&select=source_key,item_name,price&limit=1');
        if(!Array.isArray(rows)||!rows.length)return res.status(404).json({error:'Item Master Pricelist tidak ditemukan.'});
      }
      const stamp=now(),actor=userName(req);
      const payload={
        inventory_item_id:inv.id,inventory_sku:inv.sku||null,inventory_name:inv.name||'',
        source_key:sourceKey||null,mapping_status:sourceKey?'manual':'unmapped',
        mapped_at:sourceKey?stamp:null,mapped_by:sourceKey?actor:null,updated_at:stamp
      };
      await sb('POST','/master_pricelist_inventory_map?on_conflict=inventory_item_id',payload,{
        Prefer:'resolution=merge-duplicates,return=minimal'
      });
      res.json({ok:true,...payload});
    }catch(e){apiError(res,e)}
  });

  app.get('/api/master-pricelist/cache',requireAuth,async(req,res)=>{
    if(!canRead(req))return res.status(403).json({error:'Anda tidak memiliki permission Master Pricelist.'});
    try{
      const [items,syncs]=await Promise.all([
        sb('GET','/master_pricelist_items?is_active=eq.true&select=source_key,category,brand,item_name,price,source_cell,last_synced_at,last_synced_by&order=category.asc,brand.asc,item_name.asc'),
        sb('GET','/master_pricelist_syncs?select=id,synced_at,synced_by,item_count,changed_count,price_changed_count,added_count,removed_count,renamed_count,brand_changed_count&order=synced_at.desc&limit=1')
      ]);
      res.json({items:Array.isArray(items)?items:[],last_sync:Array.isArray(syncs)&&syncs.length?syncs[0]:null});
    }catch(e){apiError(res,e)}
  });

  app.get('/api/master-pricelist/history',requireAuth,async(req,res)=>{
    if(!canRead(req))return res.status(403).json({error:'Anda tidak memiliki permission Master Pricelist.'});
    try{
      const limit=Math.min(250,Math.max(1,Number(req.query.limit)||100));
      const rows=await sb('GET','/master_pricelist_price_history?select=id,source_key,category,brand,item_name,old_price,new_price,changed_at,changed_by&order=changed_at.desc&limit='+limit);
      res.json({history:Array.isArray(rows)?rows:[]});
    }catch(e){apiError(res,e)}
  });

  app.get('/api/master-pricelist/changes',requireAuth,async(req,res)=>{
    if(!canRead(req))return res.status(403).json({error:'Anda tidak memiliki permission Master Pricelist.'});
    try{
      const limit=Math.min(300,Math.max(1,Number(req.query.limit)||150));
      const rows=await sb('GET','/master_pricelist_change_log?select=id,sync_id,change_type,source_key,category,item_name_before,item_name_after,brand_before,brand_after,price_before,price_after,changed_at,changed_by&order=changed_at.desc&limit='+limit);
      res.json({changes:Array.isArray(rows)?rows:[]});
    }catch(e){apiError(res,e)}
  });

  app.post('/api/master-pricelist/sync',requireAuth,async(req,res)=>{
    if(!canWrite(req))return res.status(403).json({error:'Anda tidak memiliki permission Write Master Pricelist.'});
    try{
      const input=Array.isArray(req.body?.items)?req.body.items:[];
      if(!input.length)return res.status(400).json({error:'Data sinkron kosong.'});
      if(input.length>5000)return res.status(400).json({error:'Maksimum 5000 item per sinkronisasi.'});

      const byKey=new Map();
      input.map(cleanItem).filter(Boolean).forEach(item=>byKey.set(item.source_key,item));
      const items=[...byKey.values()];
      if(!items.length)return res.status(400).json({error:'Tidak ada item valid untuk disimpan.'});

      // Pricelist is small enough to read the current cache once. This avoids fragile
      // PostgREST IN escaping for source-cell keys and keeps change detection deterministic.
      const existingRows=await sb('GET','/master_pricelist_items?select=source_key,category,brand,item_name,price,source_cell,is_active');
      const existing=Array.isArray(existingRows)?existingRows:[];
      const oldMap=new Map(existing.map(x=>[String(x.source_key),x]));
      const newMap=new Map(items.map(x=>[String(x.source_key),x]));

      const added=items.filter(x=>!oldMap.has(x.source_key));
      const removed=existing.filter(x=>x.is_active!==false&&!newMap.has(String(x.source_key)));
      const priceChanged=items.filter(x=>{
        const old=oldMap.get(x.source_key);
        return old&&Number(old.price)!==Number(x.price);
      });
      const renamed=items.filter(x=>{
        const old=oldMap.get(x.source_key);
        return old&&text(old.item_name)!==text(x.item_name);
      });
      const brandChanged=items.filter(x=>{
        const old=oldMap.get(x.source_key);
        return old&&text(old.brand)!==text(x.brand);
      });

      const syncId=crypto.randomUUID();
      const stamp=now(),actor=userName(req);
      const changedKeys=new Set([
        ...priceChanged.map(x=>x.source_key),
        ...renamed.map(x=>x.source_key),
        ...brandChanged.map(x=>x.source_key)
      ]);
      const changedCount=added.length+removed.length+changedKeys.size;

      await sb('POST','/master_pricelist_syncs',{
        id:syncId,synced_at:stamp,synced_by:actor,item_count:items.length,changed_count:changedCount,
        price_changed_count:priceChanged.length,added_count:added.length,removed_count:removed.length,
        renamed_count:renamed.length,brand_changed_count:brandChanged.length
      });

      if(priceChanged.length){
        await sb('POST','/master_pricelist_price_history',priceChanged.map(x=>{
          const old=oldMap.get(x.source_key);
          return {
            id:crypto.randomUUID(),sync_id:syncId,source_key:x.source_key,
            category:x.category,brand:x.brand,item_name:x.item_name,
            old_price:Number(old.price)||0,new_price:x.price,changed_at:stamp,changed_by:actor
          };
        }));
      }

      const changeRows=[];
      added.forEach(x=>changeRows.push({
        id:crypto.randomUUID(),sync_id:syncId,change_type:'added',source_key:x.source_key,category:x.category,
        item_name_before:null,item_name_after:x.item_name,brand_before:null,brand_after:x.brand,
        price_before:null,price_after:x.price,changed_at:stamp,changed_by:actor
      }));
      removed.forEach(old=>changeRows.push({
        id:crypto.randomUUID(),sync_id:syncId,change_type:'removed',source_key:old.source_key,category:old.category,
        item_name_before:old.item_name,item_name_after:null,brand_before:old.brand,brand_after:null,
        price_before:Number(old.price)||0,price_after:null,changed_at:stamp,changed_by:actor
      }));
      items.forEach(x=>{
        const old=oldMap.get(x.source_key);
        if(!old)return;
        if(text(old.item_name)!==text(x.item_name))changeRows.push({
          id:crypto.randomUUID(),sync_id:syncId,change_type:'renamed',source_key:x.source_key,category:x.category,
          item_name_before:old.item_name,item_name_after:x.item_name,brand_before:old.brand,brand_after:x.brand,
          price_before:Number(old.price)||0,price_after:x.price,changed_at:stamp,changed_by:actor
        });
        if(text(old.brand)!==text(x.brand))changeRows.push({
          id:crypto.randomUUID(),sync_id:syncId,change_type:'brand_changed',source_key:x.source_key,category:x.category,
          item_name_before:old.item_name,item_name_after:x.item_name,brand_before:old.brand,brand_after:x.brand,
          price_before:Number(old.price)||0,price_after:x.price,changed_at:stamp,changed_by:actor
        });
        if(Number(old.price)!==Number(x.price))changeRows.push({
          id:crypto.randomUUID(),sync_id:syncId,change_type:'price_changed',source_key:x.source_key,category:x.category,
          item_name_before:old.item_name,item_name_after:x.item_name,brand_before:old.brand,brand_after:x.brand,
          price_before:Number(old.price)||0,price_after:x.price,changed_at:stamp,changed_by:actor
        });
      });
      for(let i=0;i<changeRows.length;i+=150){
        await sb('POST','/master_pricelist_change_log',changeRows.slice(i,i+150),{Prefer:'return=minimal'});
      }

      if(removed.length){
        const removedKeys=removed.map(x=>x.source_key);
        for(let i=0;i<removedKeys.length;i+=100){
          const chunk=removedKeys.slice(i,i+100);
          for(const key of chunk){
            await sb('PATCH','/master_pricelist_items?source_key=eq.'+encodeURIComponent(key),{
              is_active:false,last_synced_at:stamp,last_synced_by:actor
            },{Prefer:'return=minimal'});
          }
        }
      }

      const upserts=items.map(x=>({
        ...x,is_active:true,last_synced_at:stamp,last_synced_by:actor,
        first_synced_at:oldMap.has(x.source_key)?undefined:stamp
      })).map(x=>Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined)));

      for(let i=0;i<upserts.length;i+=150){
        await sb('POST','/master_pricelist_items?on_conflict=source_key',upserts.slice(i,i+150),{
          Prefer:'resolution=merge-duplicates,return=minimal'
        });
      }
      res.json({
        ok:true,sync_id:syncId,item_count:items.length,changed_count:changedCount,
        price_changed_count:priceChanged.length,added_count:added.length,removed_count:removed.length,
        renamed_count:renamed.length,brand_changed_count:brandChanged.length,
        synced_at:stamp,synced_by:actor
      });
    }catch(e){apiError(res,e)}
  });
};
