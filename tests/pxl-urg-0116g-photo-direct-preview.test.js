'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/pxl-vnext-3d-project-photos.js','utf8');
function harness(photos,request){
 let downloads=0;const ctx={URL,window:{api:async()=>[],__pxlAuthToken:'test'},fetch:async()=>{downloads++;return request?request():{ok:true,status:200,blob:async()=>new Blob(['ok'])}},document:{getElementById:()=>({textContent:''})},localStorage:{getItem:()=>''},sessionStorage:{getItem:()=>''},setTimeout,console};
 const code=source.replace(/\}\)\(\);\s*$/,`  window.__probe={setState:s=>{ctxState=s},loadPhotoImage,approvedCloudinaryUrl};\n})();`);
 vm.runInNewContext(code,ctx);const state={photos,projectPhotos:[],photoObjectUrls:new Map()};ctx.URL=class MockURL extends URL{static createObjectURL(){return 'blob:mock'}static revokeObjectURL(){}};ctx.window.__probe.setState(state);
 return {probe:ctx.window.__probe,state,downloads:()=>downloads};
}
function image(failDirect=false){let src='';return {isConnected:true,closest:()=>null,onload:null,onerror:null,get src(){return src},set src(v){src=v;queueMicrotask(()=>{if(failDirect&&String(v).startsWith('https://'))this.onerror?.();else this.onload?.()})}}}
test('authenticated gallery metadata URL loads direct Cloudinary preview without proxy request',async()=>{
 const url='https://res.cloudinary.com/pixel/image/upload/v123/foo.jpg';const h=harness([{id:'p1',secure_url:url}]);const img=image();const r=await h.probe.loadPhotoImage(img,'p1',h.state);assert.equal(r,url);assert.equal(img.src,url);assert.equal(h.downloads(),0);
});
test('if Cloudinary direct image fails, proxy can load the same photo as fallback',async()=>{
 const url='https://res.cloudinary.com/pixel/image/upload/v123/foo.jpg';const h=harness([{id:'p1',secure_url:url}]);const img=image(true);const r=await h.probe.loadPhotoImage(img,'p1',h.state);assert.equal(r,'blob:mock');assert.equal(h.downloads(),1);
});
test('untrusted file URLs never become direct image previews',()=>{
 const h=harness([]);assert.equal(h.probe.approvedCloudinaryUrl({secure_url:'https://evil.example/steal'}),null);
 assert.equal(h.probe.approvedCloudinaryUrl({secure_url:'http://res.cloudinary.com/a/image/upload/p.jpg'}),null);
 assert.equal(h.probe.approvedCloudinaryUrl({secure_url:'https://res.cloudinary.com.attacker.com/image/upload/x'}),null);
});
