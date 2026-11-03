'use strict';

// PXL-URG-0119 — PR compact list + lightweight Project Tracker summaries.
// No DB/schema changes and no mutation/business-flow changes.
const express=require('express');
const fs=require('fs');
const path=require('path');
const PATCH_KEY=Symbol.for('pxl.urg.0119.performance.api');
const STATIC_KEY=Symbol.for('pxl.urg.0119.performance.static');

function compactPrRows(rows){
  return require('./pxl-urg-0120-pr-project-live-fix').compactPrForLegacyRenderer(rows);
}

function buildLightProjectSummaries({projects=[],reports=[],legacyAchievements=[],items=[],itemAchievements=[],today=null}={}){
  const day=today||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const reportByProject=new Map((reports||[]).map(r=>[String(r.project_id),r]));
  const legacyByProject=new Map();
  for(const a of legacyAchievements||[]){const k=String(a.project_id||'');if(!legacyByProject.has(k))legacyByProject.set(k,[]);legacyByProject.get(k).push(a);}
  const achByItem=new Map();
  for(const a of itemAchievements||[]){const k=String(a.item_id||'');if(!achByItem.has(k))achByItem.set(k,[]);achByItem.get(k).push(a);}
  const itemsByProject=new Map();
  for(const item of items||[]){const k=String(item.project_id||'');if(!itemsByProject.has(k))itemsByProject.set(k,[]);itemsByProject.get(k).push(item);}

  return (projects||[]).map(project=>{
    const projectId=String(project.id||'');
    const detail=itemsByProject.get(projectId)||[];
    const calc=category=>{
      const list=detail.filter(i=>String(i.category||'').toLowerCase()===category);
      let boq=0,done=0,todayDone=0;
      for(const item of list){
        const q=Number(item.boq_qty)||0;
        const hist=achByItem.get(String(item.id))||[];
        const d=hist.reduce((n,a)=>n+(Number(a.achievement)||0),0);
        const td=hist.filter(a=>String(a.achievement_date||'').slice(0,10)===day).reduce((n,a)=>n+(Number(a.achievement)||0),0);
        boq+=q;done+=d;todayDone+=td;
      }
      return {count:list.length,boq,total_done:done,today_achievement:todayDone,remain:Math.max(boq-done,0),progress:boq>0?Math.min(100,Math.round(done/boq*10000)/100):0};
    };
    const material=calc('material'),jasa=calc('jasa');
    let totalBoq,totalDone;
    if(detail.length){totalBoq=material.boq+jasa.boq;totalDone=material.total_done+jasa.total_done;}
    else{
      totalBoq=Number(reportByProject.get(projectId)?.total_boq)||0;
      totalDone=(legacyByProject.get(projectId)||[]).reduce((n,a)=>n+(Number(a.achievement)||0),0);
    }
    const progress=totalBoq>0?Math.min(100,Math.round(totalDone/totalBoq*10000)/100):0;
    return {id:project.id,material_summary:material,jasa_summary:jasa,progress};
  });
}

function injectLoader(html){
  let out=String(html||'');
  try{out=require('./pxl-urg-0118-performance-api').injectPerformanceLoader(out);}catch(_){}
  const tag='<script src="/pxl-urg-0119-pr-project-performance.js?v=PXL-URG-0119"></script>';
  const fixTag='<script src="/pxl-urg-0120-pr-project-live-fix.js?v=PXL-URG-0120"></script>';
  if(!out.includes('/pxl-urg-0119-pr-project-performance.js'))out=out.replace('</body>',tag+'\n</body>');
  if(!out.includes('/pxl-urg-0120-pr-project-live-fix.js'))out=out.replace('</body>',fixTag+'\n</body>');
  return out;
}

if(!global[STATIC_KEY]){
  global[STATIC_KEY]=true;
  const priorStatic=express.static;
  express.static=function pxlUrg0119Static(root,options){
    const native=priorStatic(root,options);
    const isPublic=path.resolve(String(root||''))===path.resolve(__dirname,'public');
    if(!isPublic)return native;
    return function pxlUrg0119PublicStatic(req,res,next){
      const pathname=String(req.path||req.url||'').split('?')[0];
      if(pathname==='/'||pathname==='/index.html'){
        try{
          res.setHeader('Cache-Control','no-store, max-age=0');
          return res.type('html').send(injectLoader(fs.readFileSync(path.join(root,'index.html'),'utf8')));
        }catch(_){return native(req,res,next);}
      }
      return native(req,res,next);
    };
  };
}

if(!global[PATCH_KEY]){
  global[PATCH_KEY]=true;
  const priorGet=express.application.get;
  express.application.get=function pxlUrg0119Get(route,...handlers){
    const routeText=String(route||'');
    if(routeText==='/api/purchase-requests'&&handlers.length){
      const guards=handlers.slice(0,-1);
      return priorGet.call(this,route,...guards,async(req,res)=>{
        try{const db=require('./db');res.json(compactPrRows(await db.getPurchaseRequests()));}
        catch(e){res.status(500).json({error:e.message});}
      });
    }
    if(routeText==='/api/project-report-summaries'&&handlers.length){
      const guards=handlers.slice(0,-1);
      return priorGet.call(this,route,...guards,async(req,res)=>{
        try{
          const db=require('./db');
          const [projects,reports,legacyAchievements,items,itemAchievements]=await Promise.all([
            db.getProjects(),db.getProjectReports(),db.getProjectReportAchievements(),db.getProjectReportItems(),db.getProjectReportItemAchievements()
          ]);
          res.json(buildLightProjectSummaries({projects,reports,legacyAchievements,items,itemAchievements}));
        }catch(e){res.status(500).json({error:e.message});}
      });
    }
    return priorGet.call(this,route,...handlers);
  };
}

module.exports={compactPrRows,buildLightProjectSummaries,injectLoader};