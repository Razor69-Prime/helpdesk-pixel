'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const script=read('public/pxl-urg-0139-wo-tracking-wa.js');
const {inject}=require('../pxl-urg-0121-pr-live-load-hook');

function setup(tickets){
  const byId={};
  const opened=[],alerts=[],clipboard=[];
  const modal={id:'track-modal',querySelector(sel){
    return {'[onclick="copyTrackLink()"]':linkButton,'[onclick="shareWA()"]':waButton}[sel]||null;
  }};
  const parent={insertBefore(child){byId[child.id]=child;child.parentElement=parent}};
  const actions={parentElement:parent,children:[],insertBefore(child,before){
    const index=this.children.indexOf(before);
    this.children.splice(index<0?this.children.length:index,0,child);
    child.parentElement=this;
    byId[child.id]=child;
  },querySelectorAll:()=>actions.children};
  const linkButton={textContent:'📋 Salin',style:{},parentElement:actions};
  const waButton={textContent:'📲 WA',style:{},parentElement:actions};
  const openButton={textContent:'🌐 Buka',style:{},parentElement:actions};
  const printButton={textContent:'🖨️ Print',style:{},parentElement:actions};
  actions.children.push(linkButton,waButton,openButton,printButton);
  const document={
    readyState:'complete',
    getElementById(id){return id==='track-modal'?modal:byId[id]||null},
    createElement(tag){
      const element={tagName:tag.toUpperCase(),style:{},textContent:'',parentElement:null,
        addEventListener(event,listener){this.listeners??={};this.listeners[event]=listener},
        click(){return this.listeners?.click?.()}};
      return element;
    },
    addEventListener(){}
  };
  const ctx={
    window:{openTrackModal(btn){
      ctx.trackUrl='https://internal.pixelsolusindo.com/track/'+btn.getAttribute('data-token');
      return 'OPENED';
    },shareWA(){throw Error('Old generic WA must be overridden')},
      open:(...args)=>opened.push(args)},
    document,
    allTickets:tickets,
    trackUrl:'',
    location:{origin:'https://internal.pixelsolusindo.com'},
    navigator:{clipboard:{writeText:async text=>clipboard.push(text)}},
    alert:text=>alerts.push(text),
    Date,console,
  };
  vm.runInNewContext(script,ctx);
  function open(token,wo,created='2026-11-13T09:00:00.000Z'){
    return ctx.window.openTrackModal({getAttribute:name=>({
      'data-token':token,'data-wo':wo,'data-created':created
    })[name]||''});
  }
  return {ctx,open,opened,alerts,clipboard,byId,actions,linkButton,waButton};
}

test('0139 injects the tracking WA module once, after old loader without modifying original modal / QR',()=>{
  const html=inject(read('public/index.html'));
  assert.match(html,/\/pxl-urg-0139-wo-tracking-wa\.js\?v=PXL-URG-0139/);
  assert.equal(html.split('/pxl-urg-0139-wo-tracking-wa.js').length-1,1);
  assert.equal(inject(html),html);
  assert.match(html,/function shareWA\(\)/);
  assert.match(html,/function copyTrackLink\(\)/);
  assert.match(html,/function openTrackLink\(\)/);
  assert.match(html,/function printQR\(\)/);
  assert.match(html,/pxl-urg-0032a-remarks-button-fix\.js\?v=PXL-URG-0135/);
  assert.match(html,/pxl-urg-0010-wo-autonumber\.js\?v=PXL-URG-0133/);
  assert.match(html,/pxl-stg-0004d\.js\?v=PXL-URG-0134/);
  const before=html.indexOf('/pxl-urg-0032a-remarks-button-fix.js');
  const after=html.indexOf('/pxl-urg-0139-wo-tracking-wa.js');
  assert.ok(after>before);
});

test('0139 opens correct customer WhatsApp chat with Service Center-style WO message',()=>{
  const t=setup([{id:'ticket-1',wo_number:'WO-2026-000295',tracking_token:'t12345',
    customer_name:'Customer Contoh',customer_phone:'+62 877-9201-2802',
    project_name:'Survey CCTV dan Access Point',status:'ongoing',
    worked_at:'2026-11-13T00:00:00.000Z'}]);
  assert.equal(t.open('t12345','WO-2026-000295'),'OPENED');
  assert.equal(t.byId['pxl-0139-wa-receiver'].textContent.includes('Customer Contoh'),true);
  assert.match(t.byId['pxl-0139-wa-receiver'].textContent,/\+6287792012802/);
  assert.equal(t.waButton.textContent,'📲 WA Customer');
  assert.equal(t.linkButton.textContent,'📋 Salin Link');
  t.ctx.window.shareWA();
  assert.equal(t.opened.length,1);
  const [url,target,features]=t.opened[0];
  assert.equal(target,'_blank');
  assert.match(features,/noopener/);
  const parsed=new URL(url);
  assert.equal(parsed.origin,'https://wa.me');
  assert.equal(parsed.pathname,'/6287792012802');
  const message=parsed.searchParams.get('text');
  assert.ok(message.startsWith('Halo Bapak/Ibu Customer Contoh,'));
  assert.match(message,/Kami dari Pixel Solusindo/);
  assert.match(message,/\*No\. Work Order:\* WO-2026-000295/);
  assert.match(message,/\*Pekerjaan:\* Survey CCTV dan Access Point/);
  assert.match(message,/\*Status:\* Sedang Dikerjakan/);
  assert.match(message,/Tracking Pekerjaan:[\s\S]*https:\/\/internal\.pixelsolusindo\.com\/track\/t12345/);
  assert.match(message,/Customer Care: \+62 811-3961-8857/);
  assert.match(message,/Link tracking aktif hingga/);
  assert.match(message,/Jika ada pertanyaan, silakan balas pesan ini/);
  assert.ok(!url.includes('/?text='),'Never opens generic WhatsApp share without customer phone');
});

test('0139 preserves copy link and supports copy full WhatsApp message via separate button',async()=>{
  const t=setup([{wo_number:'WO-2026-000281',tracking_token:'two',customer_name:'Pak Erwin',
    customer_phone:'087792012802',project_name:'Pemasangan CCTV',status:'assigned'}]);
  t.open('two','WO-2026-000281');
  assert.equal(t.actions.children.length,5);
  assert.equal(t.actions.children[1].id,'pxl-0139-wa-copy');
  assert.equal(t.actions.children[2],t.waButton);
  await t.byId['pxl-0139-wa-copy'].click();
  assert.equal(t.clipboard.length,1);
  assert.match(t.clipboard[0],/Halo Bapak\/Ibu Pak Erwin,/);
  assert.match(t.clipboard[0],/https:\/\/internal\.pixelsolusindo\.com\/track\/two/);
  assert.ok(t.alerts.some(x=>x.includes('berhasil disalin')));
  assert.equal(t.linkButton.textContent,'📋 Salin Link');
  t.open('two','WO-2026-000281');
  assert.equal(t.actions.children.length,5,'Opening twice does not insert a duplicate button');
});

test('0139 switches to each WO customer phone instead of using previous ticket',()=>{
  const t=setup([
    {wo_number:'WO-2026-000101',tracking_token:'token-a',customer_name:'Customer A',customer_phone:'08111111111',project_name:'Project A'},
    {wo_number:'WO-2026-000102',tracking_token:'token-b',customer_name:'Customer B',customer_phone:'08222222222',project_name:'Project B'}
  ]);
  t.open('token-a','WO-2026-000101');
  t.ctx.window.shareWA();
  t.open('token-b','WO-2026-000102');
  t.ctx.window.shareWA();
  assert.equal(t.opened.length,2);
  assert.match(t.opened[0][0],/wa\.me\/628111111111/);
  assert.match(t.opened[1][0],/wa\.me\/628222222222/);
  assert.match(decodeURIComponent(t.opened[1][0]),/Project B/);
  assert.doesNotMatch(decodeURIComponent(t.opened[1][0]),/Project A/);
});

test('0139 missing/invalid WA warns and never opens generic chat',async()=>{
  for(const customer_phone of ['',null,'0812','invalid', '12345']){
    const t=setup([{wo_number:'WO-2026-000501',tracking_token:'missing',customer_name:'Unknown',
      customer_phone,project_name:'Service',status:'assigned'}]);
    t.open('missing','WO-2026-000501','invalid-date');
    t.ctx.window.shareWA();
    assert.equal(t.opened.length,0,JSON.stringify(customer_phone));
    assert.match(t.alerts[0],/belum tersedia atau tidak valid/);
    assert.match(t.byId['pxl-0139-wa-receiver'].textContent,/belum tersedia\/valid/);
    await t.byId['pxl-0139-wa-copy'].click();
    assert.equal(t.clipboard.length,1,'Copy template still works without a phone number');
    assert.ok(!t.clipboard[0].includes('undefined'));
  }
});

test('0139 WhatsApp number normalization recognizes Indonesian local and international customer numbers',()=>{
  const t=setup([]);
  const norm=t.ctx.window.PXL_URG_0139.normalizedPhone;
  const cases={
    '0877-9201-2802':'6287792012802',
    '+62 877 9201 2802':'6287792012802',
    '6287792012802':'6287792012802',
    '87792012802':'6287792012802',
    '0062 87792012802':'6287792012802',
    '0812':'','abc':'','': '',
  };
  for(const [raw,expected] of Object.entries(cases))assert.equal(norm(raw),expected,raw);
});

test('0139 read-only UI sends no API requests, and does not patch original service center template',()=>{
  assert.doesNotMatch(script,/\bfetch\s*\(/);
  assert.doesNotMatch(script,/\bapi\s*\(/);
  assert.doesNotMatch(script,/\bPATCH\b|\bPOST\b|\bDELETE\b/);
  const hook=read('pxl-urg-0121-pr-live-load-hook.js');
  assert.match(hook,/const trackWaTag=/);
  assert.match(hook,/if\(!result\.includes\('\/pxl-urg-0139-wo-tracking-wa\.js'\)\)/);
  assert.match(read('public/pxl-urg-0077-service-center.js'),/function waTemplate\(r\)/);
});

test('0139 does not accidentally target customer from WO number if tracking token is different',()=>{
  const t=setup([{wo_number:'WO-2026-000777',tracking_token:'valid-token',
    customer_name:'Customer Alpha',customer_phone:'081234567890'}]);
  t.open('other-token','WO-2026-000777');
  t.ctx.window.shareWA();
  assert.equal(t.opened.length,0);
  assert.match(t.alerts[0],/Nomor WhatsApp customer/);
});
