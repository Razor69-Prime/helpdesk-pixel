const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
const s=()=>fs.readFileSync('public/pxl-attendance-v1.js','utf8');

test('attendance UI is camera-only and GPS-required',()=>{const x=s();assert.match(x,/getUserMedia/);assert.match(x,/navigator\.geolocation/);assert.doesNotMatch(x,/type=["']file["']/i);assert.doesNotMatch(x,/input\.files|FileReader/);assert.match(x,/GPS.*wajib|Lokasi.*wajib/i);assert.match(x,/kamera.*wajib|getUserMedia.*wajib/i);});

test('attendance UI uses optional work context and WITA labels',()=>{const x=s();assert.match(x,/Pekerjaan \/ kegiatan/);assert.match(x,/opsional/i);assert.match(x,/WITA/);assert.match(x,/Overtime Stage 1|Lembur Tahap 1/);assert.match(x,/Overtime Stage 2|Lembur Tahap 2/);});

test('attendance UI renders own history and permission-gated admin controls',()=>{const x=s();assert.match(x,/\/attendance\/me/);assert.match(x,/\/attendance\/today/);for(const p of ['attendance_view_all','attendance_manage_rules','attendance_manage'])assert.match(x,new RegExp(p));assert.match(x,/superadmin/);assert.match(x,/\/attendance\/admin/);assert.match(x,/\/attendance\/rules/);});

test('watermark is drawn from server capture context and GPS metadata',()=>{const x=s();assert.match(x,/server_time_wita/);assert.match(x,/fillText/);assert.match(x,/latitude/);assert.match(x,/longitude/);assert.match(x,/accuracy/);assert.match(x,/capture-context/);assert.match(x,/photo-signature/);});
