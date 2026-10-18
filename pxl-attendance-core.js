'use strict';

const TIMEZONE='Asia/Makassar';
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',weekday:'short'});
const dow={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
function witaParts(date=new Date()){
  const parts=Object.fromEntries(fmt.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {year:+parts.year,month:+parts.month,day:+parts.day,hour:+parts.hour,minute:+parts.minute,second:+parts.second,dayOfWeek:dow[parts.weekday]};
}
function workDateWita(date=new Date()){const p=witaParts(date);return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`}
function defaultAttendanceRules(){
  const rows=[];
  for(let d=1;d<=5;d++)rows.push({day_of_week:d,is_workday:true,check_in_time:'08:00',check_out_time:'16:30',timezone:TIMEZONE,overtime_stage1_minutes:120,overtime_stage2_minutes:240,is_active:true});
  rows.push({day_of_week:6,is_workday:true,check_in_time:'08:30',check_out_time:'13:00',timezone:TIMEZONE,overtime_stage1_minutes:120,overtime_stage2_minutes:240,is_active:true});
  rows.push({day_of_week:7,is_workday:false,check_in_time:null,check_out_time:null,timezone:TIMEZONE,overtime_stage1_minutes:120,overtime_stage2_minutes:240,is_active:true});
  return rows;
}
function resolveAttendanceRule(rules,date=new Date()){const d=witaParts(date).dayOfWeek;return (rules||[]).find(r=>Number(r.day_of_week)===d&&r.is_active!==false)||defaultAttendanceRules().find(r=>r.day_of_week===d)}
function mins(date){const p=witaParts(date);return p.hour*60+p.minute}
function hhmm(v){if(!v)return null;const [h,m]=String(v).slice(0,5).split(':').map(Number);return h*60+m}
function calculateCheckInStatus(rule,date=new Date()){
  if(!rule?.is_workday)return {status:'off_day'};
  const scheduled=hhmm(rule.check_in_time),actual=mins(date);
  return {status:actual<=scheduled?'on_time':'late',scheduled_minutes:scheduled,actual_minutes:actual};
}
function calculateCheckOutStatus(rule,date=new Date()){
  if(!rule?.is_workday)return {status:'off_day',overtime_stage:0,overtime_eligible_minutes:0};
  const scheduled=hhmm(rule.check_out_time),actual=mins(date),after=actual-scheduled;
  if(after<0)return {status:'early_checkout',overtime_stage:0,overtime_eligible_minutes:0,minutes_after_schedule:after};
  const s1=Number(rule.overtime_stage1_minutes??120),s2=Number(rule.overtime_stage2_minutes??240);
  if(after>=s2)return {status:'normal',overtime_stage:2,overtime_eligible_minutes:s2,minutes_after_schedule:after};
  if(after>=s1)return {status:'normal',overtime_stage:1,overtime_eligible_minutes:s1,minutes_after_schedule:after};
  return {status:'normal',overtime_stage:0,overtime_eligible_minutes:0,minutes_after_schedule:after};
}
module.exports={TIMEZONE,witaParts,workDateWita,defaultAttendanceRules,resolveAttendanceRule,calculateCheckInStatus,calculateCheckOutStatus};
