const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-internal-po.js'),'utf8');
function fn(name,next){const a=src.indexOf(`function ${name}(`);assert.ok(a>=0,`${name} must exist`);const b=next?src.indexOf(`function ${next}(`,a+1):-1;return src.slice(a,b>a?b:src.length)}

test('Internal PO toolbar exposes Excel and PDF export to monitoring viewers',()=>{
  assert.match(src,/Export Excel/);
  assert.match(src,/Export PDF/);
  assert.match(src,/pxl-ipo-export-excel/);
  assert.match(src,/pxl-ipo-export-pdf/);
  assert.match(src,/history\.onclick=openHistory[\s\S]{0,500}exportExcel/);
});

test('Excel exporter contains project metadata visible columns numeric cells and grand total',()=>{
  const s=fn('exportExcel','exportPdf');
  assert.match(s,/XLSX\.utils\.aoa_to_sheet/);
  assert.match(s,/XLSX\.utils\.book_new/);
  assert.match(s,/Project ID/);assert.match(s,/Nama Project/);assert.match(s,/Overall Status/);assert.match(s,/Generated/);assert.match(s,/Issue Umum/);
  for(const label of ['No','Nama Barang','Qty PO','Qty Arrived','Satuan','Harga Beli Non-PPN','PPN 11%','Harga Final','Total','Supplier','Status','Issue']) assert.match(s,new RegExp(label));
  assert.match(s,/TOTAL HARGA BELI/);
  assert.match(s,/actual_unit_price===null|priceValue/);
  assert.match(s,/XLSX\.writeFile/);
  assert.match(s,/Internal-PO-/);
  assert.match(s,/\.xlsx/);
  assert.match(s,/is_ppn/);
  assert.match(s,/Harga Final/);
  assert.doesNotMatch(s,/discount|diskon/i);
});

test('Excel blank price remains blank while explicit zero stays numeric',()=>{
  const s=fn('exportExcel','exportPdf');
  assert.match(s,/price===null\?''\:price/);
  assert.match(s,/total===null\?''\:total/);
  assert.match(s,/qty_po/);
  assert.match(s,/qty_arrived/);
});

test('PDF exporter is landscape A4 monitoring report with same table and no formal PO language',()=>{
  const s=fn('exportPdf','openHistory');
  assert.match(s,/window\.jspdf\?\.jsPDF/);
  assert.match(s,/orientation:'landscape'/);
  assert.match(s,/format:'a4'/);
  assert.match(s,/INTERNAL PO — PROJECT MONITORING/);
  assert.match(s,/Project ID/);assert.match(s,/Nama Project/);assert.match(s,/Status/);assert.match(s,/Generated/);assert.match(s,/Issue Umum/);
  assert.match(s,/doc\.autoTable/);
  assert.match(s,/TOTAL HARGA BELI/);
  assert.match(s,/splitTextToSize/,'general issue should wrap instead of being truncated');
  assert.doesNotMatch(s,/general_issue[^\n]+slice\(/,'general issue export must not truncate monitoring notes');
  assert.match(s,/Internal-PO-/);
  assert.match(s,/\.pdf/);
  assert.doesNotMatch(s,/payment terms|signature|PO To Supplier|approval signature/i);
});

test('export filenames use human Project ID plus YYYYMMDD safe form',()=>{
  assert.match(src,/function exportDateStamp\(/);
  assert.match(src,/project_number/);
  assert.match(src,/replace\(\/\[\^a-zA-Z0-9_-\]/);
  assert.match(src,/Internal-PO-\$\{projectId\}-\$\{exportDateStamp\(\)\}/);
});

test('Excel export uses style-capable XLSX build and draws borders around the report table',()=>{
  assert.match(src,/xlsx-js-style@1\.2\.0\/dist\/xlsx(?:\.bundle)?\.js/,'styled XLSX browser build must be loaded by the Internal PO module');
  assert.match(src,/ensureStyledXlsx/,'Excel export must load the style-capable XLSX build');
  assert.match(src,/await ensureStyledXlsx\(\)/,'Excel export must wait for the styled XLSX build before writing');
  const s=fn('exportExcel','exportPdf');
  assert.match(s,/border/,'Excel export must assign cell borders');
  assert.match(s,/style:\s*'thin'/,'Excel table border should use thin lines');
  assert.match(s,/headerRow|firstDataRow/,'Excel styling should target the table region');
});

test('PDF total price is rendered as the final aligned table row',()=>{
  const s=fn('exportPdf','openHistory');
  assert.match(s,/const foot=/,'PDF total row must be prepared for autoTable');
  assert.match(s,/doc\.autoTable\(\{[\s\S]*\bfoot\b/,'PDF total must be part of autoTable instead of floating text');
  assert.match(s,/showFoot:\s*'lastPage'/,'PDF total row should appear once on the last page');
  assert.match(s,/TOTAL HARGA BELI/);
  assert.doesNotMatch(s,/doc\.text\(`TOTAL HARGA BELI:/,'PDF should not draw the total as detached page text');
});
