'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'public/pxl-vnext-3d-project-photos.js'),'utf8');
function harness({api=async()=>[],fetch=async()=>({ok:true,status:200})}={}){
 const elements={
  'pxl3d-error':{textContent:''},
  'pxl3d-gallery':{innerHTML:'Memuat gallery...',querySelectorAll:()=>[]}
 };
 const context={window:{api},fetch,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,1)),document:{getElementById:id=>elements[id]||null},URL:{createObjectURL:()=> 'blob:mock',revokeObjectURL:()=>{}},localStorage:{getItem:()=>''},sessionStorage:{getItem:()=>''},console};
 const sourceWithExports=source.replace(/\}\)\(\);\s*$/, `  window.__galleryTests={galleryGet,photoFetch,loadGallery,politePhotoError,setState:s=>{ctxState=s}};\n})();`);
 vm.runInNewContext(sourceWithExports,context,{filename:'pxl-vnext-3d-project-photos.js'});
 const state={item:{id:'item1'},project:{id:'project1'},photos:[],projectPhotos:[],selected:new Set(),user:{role:'manager'}};
 context.window.__galleryTests.setState(state);
 return {lib:context.window.__galleryTests,elements,state};
}
test('gateway 502/503 retries GET and eventually returns saved photo list',async()=>{
 let calls=0;const h=harness({api:async(method,path)=>{assert.equal(method,'GET');calls++;if(calls<3)throw new Error('<html><title>502 Bad Gateway</title></html>');return [{id:'photo1'}]}});
 const rows=await h.lib.galleryGet('/project-report-items/item1/photos');
 assert.equal(calls,3);assert.equal(rows.length,1);
});
test('HTTP 400 validation and permission errors never retry',async()=>{
 let calls=0;const h=harness({api:async()=>{calls++;throw new Error('403 Forbidden')}});
 await assert.rejects(h.lib.galleryGet('/project-report-items/item1/photos'),/403/);
 assert.equal(calls,1);
});
test('when both gallery routes return 502, retry link is shown without raw nginx HTML',async()=>{
 let calls=0;const h=harness({api:async()=>{calls++;throw new Error('<html><body><h1>502 Bad Gateway</h1></body></html>')}});
 await h.lib.loadGallery();
 assert.equal(calls,6);
 assert.match(h.elements['pxl3d-gallery'].innerHTML,/Muat Ulang Foto/);
 assert.match(h.elements['pxl3d-error'].textContent,/Server foto sementara/);
 assert.doesNotMatch(h.elements['pxl3d-error'].textContent,/<html>|nginx/);
});
test('if project-wide gallery fails, item photos still appear',async()=>{
 let projectCalls=0;const h=harness({api:async(method,p)=>{
  if(p.startsWith('/projects/')){projectCalls++;throw new Error('HTTP 502 Bad Gateway')}
  return [{id:'photo-current',project_report_item_id:'item1',source_type:'camera',uploaded_at:'2026-11-01T00:00:00Z',evidence_count:1}];
 }});
 await h.lib.loadGallery();
 assert.equal(projectCalls,3);
 assert.equal(h.state.photos.length,1);
 assert.match(h.elements['pxl3d-gallery'].innerHTML,/Foto Item Ini/);
 assert.match(h.elements['pxl3d-error'].textContent,/Server foto sementara/);
});
test('photo download GET retries 502 without retrying upload or modifying photo history',async()=>{
 let count=0;const h=harness({fetch:async()=>{count++;return {ok:count>1,status:count>1?200:502}}});
 const response=await h.lib.photoFetch('/api/project-report-item-photos/p/download',{});
 assert.equal(response.status,200);assert.equal(count,2);
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 assert.match(html,/pxl-vnext-3d-project-photos\.js\?v=PXL-URG-0116(?:F|G)/);
 const js=source;
 assert.match(js,/revision:'PXL-URG-0116(?:F|G)'/);
 assert.match(js,/await fetch\(`https:\/\/api\.cloudinary\.com/);
 assert.match(js,/async function deletePhoto\(id\)/);
 assert.match(js,/apiCall\('DELETE'/);
});

test('133 photo project does not trigger image downloads until visible, then max four concurrently',async()=>{
 const images=Array.from({length:133},(_,i)=>({dataset:{p3dProjectPhoto:'photo-'+i},isConnected:true,closest:()=>null}));
 const host={innerHTML:'',querySelectorAll:selector=>selector.includes('data-p3d-photo-id')?images:[]};
 const elements={'pxl3d-error':{textContent:''},'pxl3d-gallery':host};
 let observer,requests=0;
 class FakeIntersectionObserver{constructor(fn){this.fn=fn;observer=this}observe(){}disconnect(){}unobserve(){}reveal(){this.fn(images.map(target=>({target,isIntersecting:true})))}}
 const ctx={window:{api:async(method,path)=>path.startsWith('/projects/')?Array.from({length:133},(_,i)=>({id:'photo-'+i,project_report_item_id:'other',uploaded_at:'2026-11-01T00:00:00Z',source_type:'camera'})):[],__pxlAuthToken:'test-token'},fetch:async()=>{requests++;return new Promise(()=>{})},IntersectionObserver:FakeIntersectionObserver,setTimeout,document:{getElementById:id=>elements[id]||null},URL,localStorage:{getItem:()=>''},sessionStorage:{getItem:()=>''},console};
 const modified=source.replace(/\}\)\(\);\s*$/,`  window.__tests={loadGallery,setState:s=>{ctxState=s}};\n})();`);
 vm.runInNewContext(modified,ctx);
 ctx.window.__tests.setState({item:{id:'i'},project:{id:'p'},photos:[],projectPhotos:[],selected:new Set(),user:{role:'manager'}});
 await ctx.window.__tests.loadGallery();
 assert.equal(requests,0);
 observer.reveal();
 await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(requests,4,'simultaneous photo download limit');
});
