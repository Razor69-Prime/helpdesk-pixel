'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const {inject}=require('../pxl-urg-0121-pr-live-load-hook');

test('0135 loads last known-good remarks handler once, preserving other live patches',()=>{
  const html=inject(read('public/index.html'));
  assert.match(html,/\/pxl-urg-0032a-remarks-button-fix\.js\?v=PXL-URG-0135/);
  for(const asset of [
    '/pxl-urg-0121-pr-live-load.js','/pxl-stg-0004d.js',
    '/pxl-urg-0040-master-pricelist-menu.js','/pxl-urg-0010-wo-autonumber.js'
  ])assert.ok(html.includes(asset),asset);
  assert.equal(html.split('/pxl-urg-0032a-remarks-button-fix.js').length-1,1);
  assert.equal(inject(html),html,'no duplicate loader on re-application');
  const already='<html><body><script src="/pxl-urg-0032a-remarks-button-fix.js?v=old"></script></body></html>';
  assert.equal(inject(already).split('/pxl-urg-0032a-remarks-button-fix.js').length-1,1);
});

function setup({initial='',responseOk=true}={}){
  const ticket={id:'ticket-0135',wo_number:'WO-2026-000300',technician_remarks:initial};
  const listeners={};
  const refs={};
  const btnHandlers={};
  let modal;
  const document={
    addEventListener(name,fn){listeners[name]=fn;},
    querySelectorAll(selector){assert.equal(selector,'.ticket-item');return [];},
    getElementById(id){return id==='pxl-0032a-remarks-modal'?modal:null;},
    createElement(tag){
      assert.equal(tag,'div');
      const children={};
      for(const id of ['pxl-0032a-title','pxl-0032a-text','pxl-0032a-error','pxl-0032a-cancel','pxl-0032a-save']){
        children[id]={value:'',textContent:'',style:{},dataset:{},disabled:false,
          addEventListener(event,fn){btnHandlers[id+':'+event]=fn;},focus(){}};
      }
      refs.children=children;
      return {id:'',style:{},dataset:{},innerHTML:'',querySelector(selector){return children[selector.slice(1)];},
        addEventListener(){},isConnected:false};
    },
    body:{appendChild(element){modal=element;element.isConnected=true;}}
  };
  const requests=[];
  const env={
    allTickets:[ticket],archivedTickets:[],
    window:{},document,
    localStorage:{getItem(key){return key==='pixel_token'?'test-token':null;}},
    fetch:async(url,opts)=>{requests.push({url,opts});return {
      ok:responseOk,status:responseOk?200:403,
      json:async()=>responseOk?{...ticket,technician_remarks:JSON.parse(opts.body).remarks}:{error:'Akses ditolak'}
    };},
    setTimeout(){},console,
    pxlRefreshWoRemarksToggles(){}
  };
  vm.runInNewContext(read('public/pxl-urg-0032a-remarks-button-fix.js'),env);
  function click(){
    const button={dataset:{ticketId:ticket.id},closest:()=>null};
    let prevented=false,stopped=false;
    listeners.click({target:{closest:selector=>selector==='.pxl-native-remarks-btn'?button:null},
      preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
    assert.ok(prevented&&stopped,'remarks captures delegated click');
  }
  return {click,requests,ticket,refs,btnHandlers,modal:()=>modal,env};
}

test('0135 Add Remarks opens, PATCH saves, then Edit Remarks reopens with current text',async()=>{
  const t=setup();
  t.click();
  const modal=t.modal();
  assert.equal(modal.style.display,'flex');
  assert.equal(t.refs.children['pxl-0032a-title'].textContent,'Add Remarks');
  const details='Konfigurasi perangkat dan pengecekan koneksi. '.repeat(6);
  t.refs.children['pxl-0032a-text'].value=details;
  await t.btnHandlers['pxl-0032a-save:click']();
  assert.equal(t.requests.length,1);
  assert.equal(t.requests[0].url,'/api/tickets/ticket-0135/remarks');
  assert.equal(t.requests[0].opts.method,'PATCH');
  assert.equal(t.requests[0].opts.headers.Authorization,'Bearer test-token');
  assert.equal(JSON.parse(t.requests[0].opts.body).remarks,details.trim());
  assert.equal(t.ticket.technician_remarks,details.trim());
  assert.equal(modal.style.display,'none');
  t.click();
  assert.equal(t.refs.children['pxl-0032a-title'].textContent,'Edit Remarks');
  assert.equal(t.refs.children['pxl-0032a-text'].value,details.trim());
});

test('0135 failed authorization keeps modal open and never invents saved remarks',async()=>{
  const t=setup({responseOk:false});
  t.click();
  t.refs.children['pxl-0032a-text'].value='Tidak diizinkan';
  await t.btnHandlers['pxl-0032a-save:click']();
  assert.equal(t.ticket.technician_remarks,'');
  assert.equal(t.modal().style.display,'flex');
  assert.equal(t.refs.children['pxl-0032a-error'].style.display,'block');
  assert.match(t.refs.children['pxl-0032a-error'].textContent,/Akses ditolak/);
});

test('0135 native card renders remarks above meta with long-text disclosure',()=>{
  const html=read('public/index.html');
  const i=html.indexOf('function renderTickets(){'),j=html.indexOf('/* ══ PXL-REV-0064',i);
  assert.ok(i>0&&j>i);
  const rendered=html.slice(i,j);
  assert.match(rendered,/pxl-native-remarks-btn/);
  assert.match(rendered,/data-ticket-id="\$\{t\.id\}"/);
  assert.match(rendered,/pxlFormatWoRemarks\(technicianRemarks,true\)/);
  assert.ok(rendered.indexOf('pxl-native-remarks-inline')<rendered.indexOf('<div class="ticket-meta">'));
  assert.match(rendered,/pxlRefreshWoRemarksToggles\(el\)/);
  assert.match(html,/\.pxl-remarks-wrap\.is-collapsed \.pxl-remarks-content\{max-height:/);
  assert.match(html,/function pxlToggleWoRemarks\(/);
  const script=read('public/pxl-urg-0032a-remarks-button-fix.js');
  assert.match(script,/pxlRefreshWoRemarksToggles\(card\)/);
  assert.doesNotMatch(script,/new MutationObserver\(/,'native card rendering makes global observer unnecessary');
});

test('0135 long remarks disclosure expands and collapses without changing text',()=>{
  const html=read('public/index.html');
  const start=html.indexOf('function pxlFormatWoRemarks(');
  const end=html.indexOf('\nfunction renderSurveyResults(){',start);
  assert.ok(start>0&&end>start);
  const source=html.slice(start,end);
  const classes=new Set(['is-collapsed']);
  const wrap={classList:{
    add:c=>classes.add(c),remove:c=>classes.delete(c),
    toggle(c){if(classes.has(c)){classes.delete(c);return false}classes.add(c);return true;}
  }};
  const content={scrollHeight:140,clientHeight:44};
  const button={style:{},dataset:{},textContent:'',closest:()=>wrap};
  wrap.querySelector=selector=>selector==='.pxl-remarks-content'?content:selector==='.pxl-remarks-toggle'?button:null;
  const root={querySelectorAll:()=>[wrap]};
  const ctx={requestAnimationFrame:cb=>cb(),pxlWoDescEsc:str=>String(str)};
  vm.runInNewContext(source,ctx);
  const formatted=ctx.pxlFormatWoRemarks('Catatan panjang tentang pekerjaan'.repeat(12),true);
  assert.match(formatted,/is-collapsed/);
  assert.match(formatted,/Lihat Selengkapnya/);
  ctx.pxlRefreshWoRemarksToggles(root);
  assert.equal(button.style.display,'inline-block');
  assert.equal(button.textContent,'Lihat Selengkapnya');
  ctx.pxlToggleWoRemarks(button);
  assert.equal(button.textContent,'Tutup');
  assert.equal(button.dataset.pxlExpanded,'1');
  assert.equal(classes.has('is-collapsed'),false);
  ctx.pxlToggleWoRemarks(button);
  assert.equal(classes.has('is-collapsed'),true);
  assert.equal(button.textContent,'Lihat Selengkapnya');
});
