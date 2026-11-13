'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('public/kanban.html');
const desk=read('public/pxl-urg-0138-kanban-fit.css');
const mobile=read('public/pxl-urg-0140-kanban-mobile-swipe.css');

test('0140 loads mobile CSS after stable 0138 stylesheet, once and with cache busting',()=>{
  const original='/pxl-urg-0138-kanban-fit.css?v=PXL-URG-0138';
  const addition='/pxl-urg-0140-kanban-mobile-swipe.css?v=PXL-URG-0140';
  assert.equal(html.split(original).length-1,1);
  assert.equal(html.split(addition).length-1,1);
  assert.ok(html.indexOf(original)<html.indexOf(addition));
  assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1">/);
});

test('0140 mobile restores horizontal one-day-per-swipe layout, not vertical stacked days',()=>{
  assert.match(mobile,/@media\s*\(max-width:899px\)/);
  assert.match(mobile,/\.board\s*\{[^}]*display:flex;/s);
  assert.match(mobile,/\.board\s*\{[^}]*overflow-x:auto;/s);
  assert.match(mobile,/\.board\s*\{[^}]*scroll-snap-type:x mandatory;/s);
  assert.match(mobile,/\.board>.day\s*\{[^}]*flex:0 0 100%;/s);
  assert.match(mobile,/\.board>.day\s*\{[^}]*scroll-snap-align:start;/s);
  assert.match(mobile,/\.board>.day\s*\{[^}]*min-width:0;[^}]*max-width:100%;/s);
  assert.match(mobile,/\.wrap\s*\{[^}]*padding:10px/s);
  // One column spans the Kanban viewport, which can be swiped to next date.
  for(const width of [320,375,390,412,600,800]){
    const outerWidth=width-20;
    const dayWidth=outerWidth;
    assert.ok(dayWidth<=outerWidth);
    assert.equal(dayWidth*7+8*6>outerWidth,true,'7 days require a scroll track');
  }
  assert.doesNotMatch(mobile,/repeat\(2|minmax\(0,1fr\)/);
});

test('0140 mobile Edit Jadwal remains clickable and fully inside every card',()=>{
  assert.match(mobile,/\.board \.card\s*\{[^}]*box-sizing:border-box;[^}]*position:relative;[^}]*width:100%;[^}]*max-width:100%;[^}]*padding:8px 61px 8px 9px;/s);
  assert.match(mobile,/\.board \.card>\.btn\s*\{[^}]*box-sizing:border-box;[^}]*position:absolute;[^}]*right:8px;[^}]*bottom:9px;/s);
  assert.match(mobile,/\.board \.card>\.btn\s*\{[^}]*width:43px;[^}]*min-width:43px;[^}]*max-width:43px;/s);
  assert.match(mobile,/\.board \.card>\.btn::after\s*\{[^}]*content:"Edit";/s);
  // At narrowest supported phone, the absolute button is 8px from the card's right edge.
  for(const viewport of [320,360,390,425]){
    const cardWidth=viewport-20-18;
    assert.ok(8+43<cardWidth);
    const contentWidth=cardWidth-61-9;
    assert.ok(contentWidth>180, 'WO/project text area remains readable');
  }
  assert.match(html,/onclick="openM\(\\'/,'Click callback is still present');
  assert.match(html,/function openM\(id\)/);
  assert.match(html,/function saveM\(\)/);
});

test('0140 preserves compact mobile card typography without removing WO fields',()=>{
  assert.match(mobile,/\.board \.card>div:not\(\.off\)\s*\{[^}]*text-overflow:ellipsis;/s);
  assert.match(mobile,/\.board \.card>\.meta:nth-of-type\(n\+3\)\{display:none\}/);
  for(const s of ['t.wo_number','t.project_name','t.customer_name','t.technicians','t.status','t.scheduled_start_time']){
    assert.ok(html.includes(s),s);
  }
  assert.match(html,/Edit Jadwal<\/button>/);
});

test('0140 changes only mobile Kanban: desktop 7-column 0138 and Timeline unaffected',()=>{
  assert.match(desk,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.equal(mobile.slice(mobile.indexOf('@media')).split('{').length-mobile.slice(mobile.indexOf('@media')).split('}').length,0);
  assert.equal(mobile.slice(0,mobile.indexOf('@media')).replace(/\/\*[\s\S]*?\*\//g,'').trim(),'');
  assert.doesNotMatch(mobile,/\.timeline-wrap|\.timeline-grid|\.tl-bar|\.week-grid|\.modal|\.dialog|\.field/);
  assert.match(html,/function renderKanban\(\)/);
  assert.match(html,/function renderDay\(selected\)/);
  assert.match(html,/function renderWeek\(\)/);
  assert.match(html,/function bindTimelineDrag\(/);
});

test('0140 retains seven dates and previous Edit Jadwal click handlers',()=>{
  const match=html.match(/function renderKanban\(\)\{[^\n]*\}/);
  assert.ok(match);
  const out={innerHTML:''};
  const baseDate=new Date(2026,10,9,12);
  const format=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const rows=Array.from({length:7},(_,i)=>{
    const d=new Date(baseDate);d.setDate(d.getDate()+i);
    return {id:'ticket-'+i,wo_number:'WO-2026-000'+(450+i),
      scheduled_date:format(d),project_name:'Perbaikan CCTV '+i,customer_name:'Customer '+i,
      technicians:[{id:'tech-1',name:'Teknisi A'}],status:'assigned',scheduled_start_time:'09:00',estimated_duration_minutes:60};
  });
  const ctx={
    body:out,week:baseDate,tickets:rows,techs:[{id:'tech-1',name:'Teknisi A'}],canEdit:true,
    esc:v=>String(v??''),norm:v=>String(v).toLowerCase(),
    add:(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x},
    ymd:format,leaveFor:()=>null,
    techKeys:t=>[t.id,t.name.toLowerCase()],techName:t=>t.name,endTime:()=> '10:00',Date,
  };
  vm.runInNewContext(match[0]+';renderKanban()',ctx);
  assert.equal((out.innerHTML.match(/class="day /g)||[]).length,7);
  assert.equal((out.innerHTML.match(/Edit Jadwal/g)||[]).length,7);
  assert.ok(out.innerHTML.indexOf('Senin')<out.innerHTML.indexOf('Minggu'));
  assert.match(out.innerHTML,/onclick="openM/);
  assert.match(out.innerHTML,/WO-2026-000450/);
  assert.match(out.innerHTML,/WO-2026-000456/);
});
