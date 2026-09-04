'use strict';
/* PXL-URG-0044 — Master Pricelist change detection + permanent last-successful-sync metadata.
 * Isolated from Pricing Calculator, Inventory, Sales Order and Purchase Request.
 * Google Sheet remains read-only; frontend sends normalized read results to this API.
 */
const crypto=require('crypto');

module.exports=function installMasterPricelistCache(app,{requireAuth}){
  const role=v=>String(v||'').trim().toLowerCase().replace(/[ _-]/g,'');
  const text=v=>String(v??'').trim();
  const allowedTabs=new Set(['CCTV','NETWORKING','ACCESSORIES']);
  const isSuper=req=>role(req.session?.user?.role)==='superadmin';
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

  app.get('/api/master-pricelist/cache',requireAuth,async(req,res)=>{
    if(!isSuper(req))return res.status(403).json({error:'Akses hanya untuk Superadmin.'});
    try{
      const [items,syncs]=await Promise.all([
        sb('GET','/master_pricelist_items?is_active=eq.true&select=source_key,category,brand,item_name,price,source_cell,last_synced_at,last_synced_by&order=category.asc,brand.asc,item_name.asc'),
        sb('GET','/master_pricelist_syncs?select=id,synced_at,synced_by,item_count,changed_count,price_changed_count,added_count,removed_count,renamed_count,brand_changed_count&order=synced_at.desc&limit=1')
      ]);
      res.json({items:Array.isArray(items)?items:[],last_sync:Array.isArray(syncs)&&syncs.length?syncs[0]:null});
    }catch(e){apiError(res,e)}
  });

  app.get('/api/master-pricelist/history',requireAuth,async(req,res)=>{
    if(!isSuper(req))return res.status(403).json({error:'Akses hanya untuk Superadmin.'});
    try{
      const limit=Math.min(250,Math.max(1,Number(req.query.limit)||100));
      const rows=await sb('GET','/master_pricelist_price_history?select=id,source_key,category,brand,item_name,old_price,new_price,changed_at,changed_by&order=changed_at.desc&limit='+limit);
      res.json({history:Array.isArray(rows)?rows:[]});
    }catch(e){apiError(res,e)}
  });

  app.get('/api/master-pricelist/changes',requireAuth,async(req,res)=>{
    if(!isSuper(req))return res.status(403).json({error:'Akses hanya untuk Superadmin.'});
    try{
      const limit=Math.min(300,Math.max(1,Number(req.query.limit)||150));
      const rows=await sb('GET','/master_pricelist_change_log?select=id,sync_id,change_type,source_key,category,item_name_before,item_name_after,brand_before,brand_after,price_before,price_after,changed_at,changed_by&order=changed_at.desc&limit='+limit);
      res.json({changes:Array.isArray(rows)?rows:[]});
    }catch(e){apiError(res,e)}
  });

  app.post('/api/master-pricelist/sync',requireAuth,async(req,res)=>{
    if(!isSuper(req))return res.status(403).json({error:'Akses hanya untuk Superadmin.'});
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
