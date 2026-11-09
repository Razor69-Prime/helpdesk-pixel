'use strict';
// PXL-RPT-0005: Operational reporting, GET-only. WO assignments are not hours worked.
const REPORTS=Object.freeze({
 'tech-active':{title:'Teknisi — Beban WO Aktif',kind:'active'},
 'tech-completion':{title:'Teknisi — Penyelesaian WO',kind:'completion'},
 'tech-schedule':{title:'Teknisi — Jadwal & WO Pending',kind:'schedule'},
 'project-status':{title:'Project — Status & PIC',kind:'project'},
 'project-boq':{title:'Project — Achievement Material/Jasa',kind:'boq'}
});
const CLOSED=new Set(['done','cancelled','canceled','void']);
const COMPLETED=new Set(['done']);
const norm=v=>String(v||'').trim(),qty=v=>Number.isFinite(Number(v))?Number(v):0;
function dates(from,to){if(from&&to&&from>to)throw Object.assign(new Error('Tanggal tidak valid'),{status:400});return {from,to};}
function day(v){return norm(v).slice(0,10);}
function match(date,from,to){const s=day(date);return !!s&&(!from||s>=from)&&(!to||s<=to);}
function technicianNames(ticket){const list=Array.isArray(ticket.technicians)?ticket.technicians.filter(x=>norm(x)&&norm(x)!=='Belum Ditugaskan'):[];return [...new Set((list.length?list:[ticket.technician]).map(norm).filter(x=>x&&x!=='Belum Ditugaskan'))];}
function wo(tickets,kind,from,to){
 const filtered=tickets.filter(t=>{
  const at=kind==='schedule'?(t.scheduled_date||t.created_at):t.created_at;
  return match(at,from,to);
 });
 if(kind==='schedule'){
  const rows=filtered.filter(t=>!CLOSED.has(norm(t.status).toLowerCase())).map(t=>({
   'Nomor WO':t.wo_number||'','Customer':t.customer_name||'','Teknisi':technicianNames(t).join(', ')||'Belum Ditugaskan',
   'Status':t.status||'','Jadwal':day(t.scheduled_date),'Estimasi (menit)':qty(t.estimated_duration_minutes),
   'Dibuat':day(t.created_at)
  })).sort((a,b)=>(a.Jadwal||'9999').localeCompare(b.Jadwal||'9999'));
  return {columns:['Nomor WO','Customer','Teknisi','Status','Jadwal','Estimasi (menit)','Dibuat'],rows,summary:{items:rows.length},note:'WO aktif pada periode berdasarkan jadwal (jika ada), tanpa menyimpulkan ketersediaan personel. Estimasi durasi bukan jam kerja aktual.'};
 }
 const agg=new Map(),unknown={name:'Belum Ditugaskan',assigned:0,done:0,active:0,cancelled:0};
 for(const t of filtered){
  const names=technicianNames(t),status=norm(t.status).toLowerCase();
  for(const name of names.length?names:[unknown.name]){
   if(!agg.has(name))agg.set(name,{name,assigned:0,done:0,active:0,cancelled:0});
   const a=agg.get(name);a.assigned++;
   if(COMPLETED.has(status))a.done++;
   else if(CLOSED.has(status))a.cancelled++;
   else a.active++;
  }
 }
 let values=[...agg.values()];
 values.sort((a,b)=>kind==='active'?b.active-a.active:b.done-a.done||b.assigned-a.assigned);
 const rows=values.map(x=>({'Teknisi':x.name,'Penugasan WO':x.assigned,'WO Aktif':x.active,'WO Selesai':x.done,'WO Dibatalkan':x.cancelled,'Persentase Selesai (%)':x.assigned?Number((x.done/x.assigned*100).toFixed(1)):0}));
 return {columns:['Teknisi','Penugasan WO','WO Aktif','WO Selesai','WO Dibatalkan','Persentase Selesai (%)'],rows,summary:{items:rows.length},note:'Dihitung per penugasan teknisi. Satu WO dengan dua teknisi dihitung untuk masing-masing teknisi, sehingga total penugasan bisa lebih besar dari jumlah WO unik. Persentase = WO selesai / semua penugasan dalam periode.'};
}
function projects(list,from,to){
 const rows=list.filter(p=>match(p.created_at,from,to)).map(p=>({'Nomor Project':p.project_number||'','Project':p.nama_project||'','PIC':p.pic||'Belum Diisi','Status':p.status||'','Prioritas':p.prioritas||'','Target Minggu':p.target_week||'','Dibuat':day(p.created_at)}));
 return {columns:['Nomor Project','Project','PIC','Status','Prioritas','Target Minggu','Dibuat'],rows,summary:{items:rows.length},note:'Sumber Project Tracker. Status adalah status operasional, bukan persentase progress pekerjaan.'};
}
function boq(projectList,items,achievements,from,to){
 const names=new Map(projectList.map(p=>[String(p.id),p.nama_project||p.project_number||String(p.id)]));
 const totals=new Map();
 for(const x of achievements){
  if(!match(x.achievement_date,from,to))continue;
  const key=String(x.item_id);totals.set(key,(totals.get(key)||0)+Math.max(0,qty(x.achievement)));
 }
 const rows=items.map(i=>({
  'Project':names.get(String(i.project_id))||String(i.project_id),
  'Kategori':i.category||'Lainnya','Item BOQ':i.item_name||'','Satuan':i.unit||'',
  'BOQ Qty':qty(i.boq_qty),'Achievement Periode':Number((totals.get(String(i.id))||0).toFixed(2))
 }));
 return {columns:['Project','Kategori','Item BOQ','Satuan','BOQ Qty','Achievement Periode'],rows,summary:{items:rows.length},note:'Achievement sesuai periode per item BOQ dan satuan masing-masing. Tidak menjumlahkan satuan yang berbeda dan tidak menyimpulkan persentase progress kumulatif.'};
}
async function getData(db,code,options={},deps={}){
 const spec=REPORTS[code];if(!spec)throw Object.assign(new Error('Laporan tidak dikenal'),{status:404});
 const {from,to}=dates(options.from,options.to);let data;
 if(spec.kind==='active'||spec.kind==='completion'||spec.kind==='schedule')data=wo(await (deps.tickets||(()=>db.getTickets(null,true)))(),spec.kind,from,to);
 else if(spec.kind==='project')data=projects(await (deps.projects||db.getProjects)(),from,to);
 else {
  const [p,i,a]=await Promise.all([(deps.projects||db.getProjects)(),(deps.items||db.getProjectReportItems)(),(deps.achievements||db.getProjectReportItemAchievements)()]);
  data=boq(p,i,a,from,to);
 }
 return {...data,code,title:spec.title,source:'Operational',readOnly:true,totalSource:data.rows.length,limit:5000};
}
module.exports={REPORTS,wo,projects,boq,getData};
