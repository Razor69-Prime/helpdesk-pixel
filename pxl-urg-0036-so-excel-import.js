'use strict';
/* PXL-URG-0036 — Sales Order Excel import helper. Parses XLSX only; no SO is saved here. */
const express=require('express');
const multer=require('multer');
const ExcelJS=require('exceljs');
const originalUse=express.application.use;
const originalGet=express.application.get;
const originalPost=express.application.post;
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024},fileFilter:(_,f,cb)=>cb(null,/\.xlsx$/i.test(f.originalname||''))});
const ALLOWED=new Set(['sales','admin','manager','superadmin']);
function auth(req,res){const u=req.session?.user;if(!u){res.status(401).json({error:'Unauthorized'});return null}if(!ALLOWED.has(String(u.role||'').toLowerCase())){res.status(403).json({error:'Akses ditolak.'});return null}return u}
function clean(v){return String(v??'').trim()}
function num(v){const x=Number(String(v??'').replace(/[^0-9.,-]/g,'').replace(/\./g,'').replace(',','.'));return Number.isFinite(x)?x:0}
async function template(req,res){if(!auth(req,res))return;const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('SO Items');ws.columns=[{header:'Tipe',key:'type',width:14},{header:'Nama Item / Jasa',key:'name',width:42},{header:'SKU',key:'sku',width:20},{header:'Qty',key:'qty',width:10},{header:'Satuan',key:'unit',width:14},{header:'Harga Satuan',key:'price',width:18},{header:'Keterangan',key:'note',width:34}];[
['Material','Kamera CCTV Outdoor 4MP','',4,'pcs',0,'Gunakan nama/SKU yang sesuai Inventory'],
['Material','Kabel UTP Cat6','',100,'meter',0,'Material akan dicocokkan ke Inventory'],
['Jasa','Instalasi Kamera CCTV', '',4,'titik',0,'Jasa instalasi per titik'],
['Jasa','Konfigurasi dan Testing Sistem CCTV','',1,'lot',0,'Setting, testing dan serah terima']
].forEach(r=>ws.addRow(r));ws.getRow(1).font={bold:true};ws.views=[{state:'frozen',ySplit:1}];const buf=await wb.xlsx.writeBuffer();res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition','attachment; filename="Template_Import_SO_Material_Jasa.xlsx"');res.send(Buffer.from(buf))}
async function preview(req,res){if(!auth(req,res))return;if(!req.file)return res.status(400).json({error:'File .xlsx wajib dipilih.'});try{const wb=new ExcelJS.Workbook();await wb.xlsx.load(req.file.buffer);const ws=wb.worksheets[0];if(!ws)return res.status(400).json({error:'Worksheet tidak ditemukan.'});const heads={};ws.getRow(1).eachCell((c,i)=>{heads[clean(c.value).toLowerCase()]=i});const col=(names)=>{for(const n of names){const i=heads[n.toLowerCase()];if(i)return i}return 0};const cType=col(['Tipe','Type']),cName=col(['Nama Item / Jasa','Nama Item','Nama Jasa','Name']),cSku=col(['SKU']),cQty=col(['Qty','Quantity']),cUnit=col(['Satuan','Unit']),cPrice=col(['Harga Satuan','Harga','Unit Price']),cNote=col(['Keterangan','Catatan','Note']);if(!cType||!cName)return res.status(400).json({error:'Kolom Tipe dan Nama Item / Jasa wajib tersedia.'});const rows=[];ws.eachRow((row,n)=>{if(n===1||rows.length>=300)return;const type=clean(row.getCell(cType).value),name=clean(row.getCell(cName).value);if(!type&&!name)return;rows.push({row:n,type,name,sku:cSku?clean(row.getCell(cSku).value):'',qty:cQty?Math.max(0,num(row.getCell(cQty).value)):0,unit:cUnit?clean(row.getCell(cUnit).value):'',unit_price:cPrice?Math.max(0,num(row.getCell(cPrice).value)):0,note:cNote?clean(row.getCell(cNote).value):''})});res.json({source:'PXL-URG-0036',rows})}catch(e){res.status(400).json({error:'Gagal membaca Excel: '+String(e.message||e)})}}
function register(app){if(app.__pxl0036)return;app.__pxl0036=true;originalGet.call(app,'/api/sales-orders/import-template',template);originalPost.call(app,'/api/sales-orders/import-preview',upload.single('file'),preview)}
express.application.use=function(...args){const result=originalUse.apply(this,args);if(!this.__pxl0036){const src=args.filter(x=>typeof x==='function').map(x=>Function.prototype.toString.call(x)).join('\n');if(src.includes('req.session')&&src.includes('_setUser'))register(this)}return result};
