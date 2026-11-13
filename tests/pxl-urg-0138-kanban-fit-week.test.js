'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('public/kanban.html');
const css=read('public/pxl-urg-0138-kanban-fit.css');

test('0138 attaches exactly one versioned stylesheet after the original Kanban rules',()=>{
  const src='/pxl-urg-0138-kanban-fit.css?v=PXL-URG-0138';
  assert.equal(html.split(src).length-1,1);
  assert.match(html,/<\/style><link rel="stylesheet" href="\/pxl-urg-0138-kanban-fit\.css\?v=PXL-URG-0138"><\/head>/);
  assert.match(html,/<div id="body">Memuat/);
  assert.match(html,/function renderKanban\(/);
  assert.match(html,/function openM\(id\)/);
  assert.match(html,/function saveM\(/);
  assert.match(html,/function renderWeek\(/);
  assert.match(html,/function renderDay\(/);
  const reportWA=read('public/pxl-urg-0025-kanban-wa-report.js');
  assert.match(reportWA,/Report WA/);
});

test('0138 fits seven days in desktop viewport without min-width columns or horizontal scroll',()=>{
  assert.match(css,/\.board\s*\{\s*display:grid;/);
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css,/\.board>.day\s*\{\s*box-sizing:border-box;\s*min-width:0;\s*max-width:none;\s*width:100%/);
  assert.match(css,/\.board\s*\{[^}]*overflow-x:visible/s);
  assert.match(css,/\.board\s*\{[^}]*max-width:100%/s);
  assert.match(css,/overflow-wrap:anywhere/);
  assert.doesNotMatch(css,/\.board\s*\{[^}]*overflow-x:auto/s);
  // At a 1855px iframe, the seven-column grid uses ~249px/day rather than >=290px/day.
  const viewport=1855,outerPadding=24,gaps=6*8;
  const dayWidth=(viewport-outerPadding-gaps)/7;
  assert.ok(dayWidth>200&&dayWidth<290);
});

test('0138 stacks Kanban columns on narrower screens instead of clipping days',()=>{
  assert.match(css,/@media\s*\(max-width:1199px\)\s*\{\s*\.board\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\s*\(max-width:699px\)\s*\{\s*\.board\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\s*\(max-width:479px\)\s*\{\s*\.board\{grid-template-columns:minmax\(0,1fr\)/);
  assert.doesNotMatch(css,/\.timeline-wrap|\.timeline-grid|\.week-grid|\.tl-bar/,'Timeline layout remains untouched');
  assert.doesNotMatch(css,/\.modal|\.dialog|\.field/,'Edit Jadwal modal remains untouched');
});

test('0138 preserves classic seven-day Kanban cards and Edit Jadwal handlers',()=>{
  const match=html.match(/function renderKanban\(\)\{[^\n]*\}/);
  assert.ok(match,'Original renderKanban function preserved');
  const output={innerHTML:''};
  const date=new Date(2026,10,9,12);
  const format=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const jsEscape=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const jobs=Array.from({length:7},(_,i)=>{
    const d=new Date(date);d.setDate(d.getDate()+i);
    return {id:'id-'+i,wo_number:'WO-2026-000'+(300+i),
      scheduled_date:format(d),project_name:'Pengecekan CCTV '+i,customer_name:'Customer '+i,
      technicians:[{id:'tech-1',name:'Teknisi A'}],status:'assigned',scheduled_start_time:'09:00',
      estimated_duration_minutes:60};
  });
  const context={
    body:output,week:date,tickets:jobs,techs:[{id:'tech-1',name:'Teknisi A'}],
    canEdit:true,esc:jsEscape,norm:s=>String(s).trim().toLowerCase(),
    add:(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;},
    ymd:format,leaveFor:()=>null,techKeys:t=>[t.id,t.name].map(x=>x.toLowerCase()),
    techName:t=>t.name,
    endTime:()=> '10:00',
    Date,
  };
  vm.runInNewContext(match[0]+';renderKanban()',context);
  assert.equal((output.innerHTML.match(/class="day /g)||[]).length,7);
  assert.equal((output.innerHTML.match(/Edit Jadwal/g)||[]).length,7);
  assert.ok(output.innerHTML.indexOf('Senin')<output.innerHTML.indexOf('Minggu'));
  assert.match(output.innerHTML,/Terisi/);
  assert.match(output.innerHTML,/Tidak ada teknisi kosong/);
  assert.match(output.innerHTML,/WO-2026-000300/);
  assert.match(output.innerHTML,/WO-2026-000306/);
});
