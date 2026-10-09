'use strict';

const DEFAULT_PROJECT_GANTT_STAGES=Object.freeze([
  'Preparation',
  'Order Barang',
  'Tanam Tiang',
  'Instalasi Perangkat',
  'Konfigurasi',
  'Testing / Commissioning',
  'Serah Terima'
]);

const DAY_MS=24*60*60*1000;

function parseDateOnly(value){
  const raw=String(value||'').trim();
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if(!match) throw new Error('Tanggal mulai Project tidak valid. Gunakan format YYYY-MM-DD.');
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const stamp=Date.UTC(year,month-1,day);
  const date=new Date(stamp);
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day){
    throw new Error('Tanggal mulai Project tidak valid.');
  }
  return stamp;
}

function formatDateOnly(stamp){
  const date=new Date(stamp);
  const y=date.getUTCFullYear();
  const m=String(date.getUTCMonth()+1).padStart(2,'0');
  const d=String(date.getUTCDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function buildSequentialGanttPlan(startDate,stages){
  const startStamp=parseDateOnly(startDate);
  if(!Array.isArray(stages)||!stages.length) throw new Error('Gantt Plan minimal memiliki 1 tahap.');
  if(stages.length>100) throw new Error('Gantt Plan maksimal 100 tahap.');

  let cursor=startStamp;
  return stages.map((stage,index)=>{
    const name=String(stage?.name||'').trim();
    const duration=Number(stage?.duration_days??stage?.duration);
    if(!name) throw new Error(`Nama tahap ke-${index+1} wajib diisi.`);
    if(!Number.isInteger(duration)||duration<1||duration>3650){
      throw new Error(`Durasi tahap ${name} harus bilangan bulat 1 sampai 3650 hari.`);
    }
    const plannedStart=cursor;
    const plannedEnd=plannedStart+((duration-1)*DAY_MS);
    cursor=plannedEnd+DAY_MS;
    return {
      name,
      duration_days:duration,
      notes:String(stage?.notes||'').trim(),
      sort_order:index,
      planned_start:formatDateOnly(plannedStart),
      planned_end:formatDateOnly(plannedEnd)
    };
  });
}

module.exports={DEFAULT_PROJECT_GANTT_STAGES,buildSequentialGanttPlan,parseDateOnly,formatDateOnly};
