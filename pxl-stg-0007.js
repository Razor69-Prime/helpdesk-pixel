'use strict';

/** PXL-STG-0007W — Kanban, jadwal, kapasitas, KPI, sinkronisasi tanggal, dan zona WITA. */
const express = require('express');
const crypto = require('crypto');
let fetchFn = global.fetch;
if (!fetchFn) { try { fetchFn = require('node-fetch'); } catch (_) {} }
const getCfg=()=>require('./config');
const getDb=()=>require('./db');

const originalUse = express.application.use;
const originalGet = express.application.get;
const originalPatch = express.application.patch;
const ADMIN = new Set(['admin','manager','superadmin']);
const VIEW = new Set(['admin','manager','superadmin','sales','technician','teknisi','warehouse','gudang']);
const WITA='Asia/Makassar';
const norm=v=>String(v??'').trim().toLowerCase();
const same=(a,b)=>String(a??'')===String(b??'');
const role=req=>norm(req.session?.user?.role);
const dateOnly=v=>{const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;};
const timeOnly=v=>{const s=String(v||'').slice(0,5);return /^\d{2}:\d{2}$/.test(s)?`${s}:00`:null;};
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
function witaParts(value){
  if(!value)return null;
  const raw=String(value);
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return{date:raw,hour:0,minute:0,second:0};
  const d=new Date(value);if(Number.isNaN(d.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:WITA,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d);
  const get=type=>parts.find(p=>p.type===type)?.value;
  return{date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour')||0),minute:Number(get('minute')||0),second:Number(get('second')||0)};
}
const witaDate=v=>witaParts(v)?.date||null;
const sharedDate=t=>witaDate(t?.worked_at)||dateOnly(t?.scheduled_date);
function preserveWorkedTime(workedAt,newDate){
  const p=witaParts(workedAt);if(!p||!newDate)return null;
  const [y,m,d]=newDate.split('-').map(Number);
  if(!y||!m||!d)return null;
  return new Date(Date.UTC(y,m-1,d,p.hour-8,p.minute,p.second)).toISOString();
}
function assignmentValues(v){if(v==null)return[];if(typeof v==='object')return[v.id,v.user_id,v.technician_id,v.name,v.username].filter(Boolean).map(norm);return[norm(v)];}
function assigned(t,u){const ids=new Set([u?.id,u?.name,u?.username].filter(Boolean).map(norm));const vals=[];(Array.isArray(t?.technicians)?t.technicians:[]).forEach(v=>vals.push(...assignmentValues(v)));[t?.technician,t?.technician_id,t?.technician_1,t?.technician_1_id,t?.technician_2,t?.technician_2_id,t?.assigned_to,t?.assigned_to_id].forEach(v=>vals.push(...assignmentValues(v)));return vals.some(v=>ids.has(v));}
function technicians(t){const arr=Array.isArray(t?.technicians)?t.technicians:[];return arr.length?arr:[t?.technician_1||t?.technician,t?.technician_2].filter(Boolean);}
function techKeys(value){
  if(value==null)return[];
  if(typeof value==='object')return[value.id,value.user_id,value.technician_id,value.name,value.username].filter(Boolean).map(norm);
  return[norm(value)];
}
function leaveCovers(leave,date){return Boolean(date&&leave?.status==='approved'&&dateOnly(leave.start_date)&&dateOnly(leave.end_date)&&date>=dateOnly(leave.start_date)&&date<=dateOnly(leave.end_date));}
async function approvedLeaves(from,to){
  const db=getDb();
  if(typeof db.getLeaveRequests!=='function')return[];
  const rows=await db.getLeaveRequests();
  return (Array.isArray(rows)?rows:[]).filter(x=>x.status==='approved'&&dateOnly(x.start_date)&&dateOnly(x.end_date)&&(!from||dateOnly(x.end_date)>=from)&&(!to||dateOnly(x.start_date)<=to));
}
function leaveForTechnician(leaves,date,technician){
  const keys=new Set(techKeys(technician));
  return leaves.find(x=>leaveCovers(x,date)&&[x.applicant_user_id,x.applicant_name].filter(Boolean).map(norm).some(v=>keys.has(v)))||null;
}
function publicLeave(x){return{request_id:x.id||null,request_number:x.request_number||null,user_id:x.applicant_user_id||null,technician:x.applicant_name||null,start_date:dateOnly(x.start_date),end_date:dateOnly(x.end_date),leave_type:x.leave_type||null};}
function closed(t){return ['done','completed','closed','cancelled','canceled','void'].includes(norm(t?.status))||t?.archived===true;}
function serialize(t){const date=sharedDate(t);const start=date&&t.scheduled_start_time?`${date}T${String(t.scheduled_start_time).slice(0,8)}+08:00`:null;return{id:t.id,wo_number:t.wo_number||null,project_name:t.project_name||t.project||'',customer_name:t.customer_name||t.customer||'',location:t.location||t.address||'',status:t.status||'assigned',technicians:technicians(t),scheduled_date:date,scheduled_start_time:t.scheduled_start_time?String(t.scheduled_start_time).slice(0,5):null,estimated_duration_minutes:num(t.estimated_duration_minutes,60),schedule_priority:t.schedule_priority||'normal',schedule_order:num(t.schedule_order,0),schedule_notes:t.schedule_notes||'',is_late:Boolean(!closed(t)&&start&&new Date(start).getTime()<Date.now()),mr_status:t.material_request_status||t.mr_status||null};}
function sbHeaders(){const cfg=getCfg(),key=process.env.SUPABASE_SERVICE_ROLE_KEY||cfg.SUPABASE_KEY;return{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'};}
async function sb(method,path,body){const cfg=getCfg();if(!fetchFn||!cfg.SUPABASE_URL)return null;const r=await fetchFn(`${cfg.SUPABASE_URL}/rest/v1${path}`,{method,headers:sbHeaders(),body:body==null?undefined:JSON.stringify(body)});if(!r.ok)throw new Error(await r.text());const txt=await r.text();return txt?JSON.parse(txt):null;}
async function users(){
  const db=getDb();
  const candidates=['getUsers','getAllUsers','listUsers'];
  for(const name of candidates){
    if(typeof db[name]!=='function') continue;
    try{const rows=await db[name]();if(Array.isArray(rows))return rows;}catch(_){}
  }
  return [];
}
const techName=u=>u.name||u.full_name||u.username||String(u.id);
async function history(ticket,patch,user,source,note){return sb('POST','/technician_schedule_history',{id:crypto.randomUUID(),ticket_id:ticket.id,old_scheduled_date:sharedDate(ticket),new_scheduled_date:dateOnly(patch.scheduled_date??sharedDate(ticket)),old_start_time:timeOnly(ticket.scheduled_start_time),new_start_time:timeOnly(patch.scheduled_start_time??ticket.scheduled_start_time),old_duration_minutes:num(ticket.estimated_duration_minutes,60),new_duration_minutes:num(patch.estimated_duration_minutes??ticket.estimated_duration_minutes,60),old_technicians:technicians(ticket),new_technicians:Array.isArray(patch.technicians)?patch.technicians:technicians(ticket),old_priority:ticket.schedule_priority||'normal',new_priority:patch.schedule_priority??ticket.schedule_priority??'normal',old_schedule_order:num(ticket.schedule_order,0),new_schedule_order:num(patch.schedule_order??ticket.schedule_order,0),source,changed_by:user?.id||null,changed_by_name:user?.name||user?.username||null,change_note:note||null});}
async function list(req,res){try{const db=getDb(),u=req.session?.user;if(!u||!VIEW.has(role(req)))return res.status(401).json({error:'Unauthorized'});let rows=await db.getTickets(null,true);if(['technician','teknisi'].includes(role(req)))rows=rows.filter(t=>assigned(t,u));const from=dateOnly(req.query.date_from),to=dateOnly(req.query.date_to);if(from)rows=rows.filter(t=>!sharedDate(t)||sharedDate(t)>=from);if(to)rows=rows.filter(t=>!sharedDate(t)||sharedDate(t)<=to);const techs=(await users()).filter(x=>['technician','teknisi'].includes(norm(x.role))&&x.is_active!==false),leaves=await approvedLeaves(from,to);const serialized=rows.map(serialize).map(t=>{const conflicts=technicians(t).map(x=>leaveForTechnician(leaves,t.scheduled_date,x)).filter(Boolean);return{...t,leave_conflicts:[...new Map(conflicts.map(x=>[x.id,x])).values()].map(publicLeave)};});res.json({source:'PXL-STG-0009A8',timezone:WITA,can_edit:ADMIN.has(role(req)),tickets:serialized,technicians:techs.map(x=>({id:x.id,name:techName(x),username:x.username||null})),technician_leaves:leaves.map(publicLeave)});}catch(e){res.status(500).json({error:String(e.message||e)});}}
async function update(req,res){try{const db=getDb(),u=req.session?.user;if(!u)return res.status(401).json({error:'Unauthorized'});if(!ADMIN.has(role(req)))return res.status(403).json({error:'Hanya Manager/Admin/Superadmin yang dapat mengubah jadwal.'});const rows=await db.getTickets(null,true),ticket=rows.find(t=>same(t.id,req.params.ticketId));if(!ticket)return res.status(404).json({error:'Work Order tidak ditemukan.'});const b=req.body||{},source=['kanban','calendar','ticket_list'].includes(norm(b.source))?norm(b.source):'kanban';const patch={scheduled_date:dateOnly(b.scheduled_date),scheduled_start_time:timeOnly(b.scheduled_start_time),estimated_duration_minutes:Math.max(1,Math.min(1440,num(b.estimated_duration_minutes,60))),schedule_priority:['low','normal','high','urgent'].includes(norm(b.schedule_priority))?norm(b.schedule_priority):'normal',schedule_order:num(b.schedule_order,0),schedule_notes:String(b.schedule_notes||'').slice(0,1000)||null,schedule_source:source,schedule_updated_at:new Date().toISOString(),schedule_updated_by:u.id||null};if(Array.isArray(b.technicians))patch.technicians=b.technicians.filter(Boolean).slice(0,2);
  const proposedTechs=Array.isArray(patch.technicians)?patch.technicians:technicians(ticket),scheduleChanged=patch.scheduled_date!==sharedDate(ticket)||JSON.stringify(proposedTechs)!==JSON.stringify(technicians(ticket));
  const leaves=patch.scheduled_date?await approvedLeaves(patch.scheduled_date,patch.scheduled_date):[],conflicts=proposedTechs.map(x=>leaveForTechnician(leaves,patch.scheduled_date,x)).filter(Boolean);
  if(scheduleChanged&&conflicts.length&&b.force_leave_assignment!==true)return res.status(409).json({error:`Teknisi ${[...new Set(conflicts.map(x=>x.applicant_name))].join(', ')} sedang cuti pada ${patch.scheduled_date}. Assignment diblokir.`,code:'TECHNICIAN_ON_APPROVED_LEAVE',can_force:true,scheduled_date:patch.scheduled_date,conflicts:[...new Map(conflicts.map(x=>[x.id,x])).values()].map(publicLeave)});
  const workedAt=preserveWorkedTime(ticket.worked_at,patch.scheduled_date);if(workedAt)patch.worked_at=workedAt;await history(ticket,patch,u,source,b.change_note||(conflicts.length&&b.force_leave_assignment?'Paksa assign teknisi yang sedang cuti':null));const updated=await db.updateTicket(ticket.id,patch);const out=serialize(updated);res.json({source:'PXL-STG-0009A8',timezone:WITA,ticket:{...out,leave_conflicts:conflicts.map(publicLeave)},warning:conflicts.length?'Teknisi sedang cuti; jadwal disimpan melalui Paksa Assign.':null});}catch(e){res.status(400).json({error:String(e.message||e)});}}
async function getHistory(req,res){try{if(!req.session?.user)return res.status(401).json({error:'Unauthorized'});const rows=await sb('GET',`/technician_schedule_history?ticket_id=eq.${encodeURIComponent(req.params.ticketId)}&order=created_at.desc`);res.json({history:Array.isArray(rows)?rows:[]});}catch(e){res.status(500).json({error:String(e.message||e)});}}
async function kpi(req,res){try{const db=getDb(),u=req.session?.user;if(!u||!VIEW.has(role(req)))return res.status(401).json({error:'Unauthorized'});let rows=await db.getTickets(null,true);if(['technician','teknisi'].includes(role(req)))rows=rows.filter(t=>assigned(t,u));const from=dateOnly(req.query.date_from),to=dateOnly(req.query.date_to);if(from)rows=rows.filter(t=>sharedDate(t)>=from);if(to)rows=rows.filter(t=>sharedDate(t)<=to);const map=new Map();for(const t of rows){for(const x of technicians(t)){const key=typeof x==='object'?String(x.id||x.name||''):String(x);if(!key)continue;const r=map.get(key)||{technician:key,total:0,done:0,running:0,waiting:0,late:0,minutes:0};r.total++;const s=norm(t.status);if(['done','completed','closed'].includes(s))r.done++;else if(['ongoing','in_progress','progress'].includes(s))r.running++;else if(['pending','waiting','menunggu'].includes(s))r.waiting++;if(serialize(t).is_late)r.late++;r.minutes+=num(t.estimated_duration_minutes,60);map.set(key,r);}}res.json({source:'PXL-STG-0007W',timezone:WITA,kpi:[...map.values()].map(r=>({...r,completion_rate:r.total?Math.round(r.done/r.total*100):0,capacity_hours:Math.round(r.minutes/6)/10}))});}catch(e){res.status(500).json({error:String(e.message||e)});}}
function register(app){if(app.__pxlStg0007Routes)return;app.__pxlStg0007Routes=true;originalGet.call(app,'/api/technician-kanban',list);originalPatch.call(app,'/api/technician-kanban/:ticketId/schedule',update);originalGet.call(app,'/api/technician-kanban/:ticketId/history',getHistory);originalGet.call(app,'/api/technician-kanban-kpi',kpi);}
express.application.use=function pxlStg0007Use(...args){const result=originalUse.apply(this,args);if(!this.__pxlStg0007Routes){const src=args.filter(v=>typeof v==='function').map(v=>Function.prototype.toString.call(v)).join('\n');if(src.includes('req.session')&&src.includes('_setUser'))register(this);}return result;};
