const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
const s=()=>fs.readFileSync('public/pxl-attendance-v1.js','utf8');

test('attendance UI is camera-only and GPS-required',()=>{const x=s();assert.match(x,/getUserMedia/);assert.match(x,/navigator\.geolocation/);assert.doesNotMatch(x,/type=["']file["']/i);assert.doesNotMatch(x,/input\.files|FileReader/);assert.match(x,/GPS.*wajib|Lokasi.*wajib/i);assert.match(x,/kamera.*wajib|getUserMedia.*wajib/i);});

test('attendance UI uses optional work context and WITA labels',()=>{const x=s();assert.match(x,/Pekerjaan \/ kegiatan/);assert.match(x,/opsional/i);assert.match(x,/WITA/);assert.match(x,/Overtime Stage 1|Lembur Tahap 1/);assert.match(x,/Overtime Stage 2|Lembur Tahap 2/);});

test('attendance UI renders own history for all users and HR-only admin controls',()=>{const x=s();assert.match(x,/\/attendance\/me/);assert.match(x,/\/attendance\/today/);assert.match(x,/role\(\)==='hr'/);assert.match(x,/role\(\)==='superadmin'/);assert.match(x,/\/attendance\/admin/);assert.match(x,/\/attendance\/rules/);});

test('watermark is drawn from server capture context and GPS metadata',()=>{const x=s();assert.match(x,/server_time_wita/);assert.match(x,/fillText/);assert.match(x,/latitude/);assert.match(x,/longitude/);assert.match(x,/accuracy/);assert.match(x,/capture-context/);assert.match(x,/photo-signature/);});

test('attendance UI reuses Project watermark logo and layout asset',()=>{const x=s();assert.match(x,/\/assets\/pxl-vnext-3d-watermark-logo\.png/);assert.match(x,/loadImage\(/);assert.match(x,/drawImage\(logo/);assert.match(x,/rgba\(0,0,0,\.24\)/);});

test('attendance action is selected from CHECK_IN CHECK_OUT dropdown',()=>{const x=s();assert.match(x,/id="att-action-select"/);assert.match(x,/<option value="CHECK_IN">CHECK_IN<\/option>/);assert.match(x,/<option value="CHECK_OUT">CHECK_OUT<\/option>/);assert.match(x,/pxlAttendanceStartSelected/);});

test('attendance watermark matches Project metadata pattern without Project ID',()=>{const x=s();for(const text of ['Lokasi Absensi Online','Lokasi:','Alamat:','GPS:','Waktu:','User:'])assert.match(x,new RegExp(text.replace('/','\\/')));assert.doesNotMatch(x,/Project ID:/);assert.match(x,/nominatim\.openstreetmap\.org\/reverse/);});

test('attendance watermark uses compact translucent block and smaller readable font',()=>{const x=s();assert.match(x,/rgba\(0,0,0,\.24\)/);assert.match(x,/Math\.round\(w\*\.012\)/);assert.match(x,/Math\.round\(w\*\.048\)/);assert.match(x,/ctx\.font=.*Arial,sans-serif/);assert.match(x,/Math\.round\(h\*\.30\)/);});

test('checkout is allowed without checkin and watermark typography is uniform',()=>{const x=s();assert.doesNotMatch(x,/Lakukan CHECK_IN terlebih dahulu/);assert.match(x,/Lokasi Absensi Online/);assert.doesNotMatch(x,/i===2\?Math\.max\(13,font-2\):font/);});



test('attendance watermark reads lexical currentUser and uses one compact font size without canvas compression',()=>{const x=s();assert.match(x,/typeof currentUser!==['"]undefined['"]/);assert.match(x,/user\(\)\.name\|\|user\(\)\.nama\|\|user\(\)\.username/);assert.match(x,/Math\.round\(w\*\.012\)/);assert.match(x,/measureText/);assert.doesNotMatch(x,/fillText\([^\n]*Math\.max\(100,w-textX-pad\)/);});

test('attendance administration UI is role HR only with superadmin bypass',()=>{const x=s();assert.match(x,/role\(\)==='hr'/);assert.match(x,/role\(\)==='superadmin'/);assert.doesNotMatch(x,/canAdmin=\(\)=>has\('attendance_view_all'\)/);});

test('attendance admin provides period report and Excel export',()=>{const x=s();assert.match(x,/Report Absensi/);assert.match(x,/att-report-from/);assert.match(x,/att-report-to/);assert.match(x,/pxlAttendanceReportLoad/);assert.match(x,/pxlAttendanceExportExcel/);assert.match(x,/XLSX\.utils\.json_to_sheet/);assert.match(x,/Laporan Absensi/);assert.match(x,/attendance\/admin\?from=/);});
