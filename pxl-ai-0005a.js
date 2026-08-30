'use strict';

// PXL-AI-0007A — Gemini Daily + Weekly Management Report.
// Gemini receives sanitized summary metrics only. No raw PixelApps records, credentials, tokens, or API keys are sent.
const express = require('express');
const jwt = require('jsonwebtoken');
const originalStatic = express.static;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

function authorized(req){
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.headers['x-auth-token'] || '');
  if (!token) return false;
  try { const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'pixel-helpdesk-2026-secret'); return !!decoded?.user; }
  catch (_) { return false; }
}
function n(value){ const v=Number(value); if(!Number.isFinite(v))return 0; return Math.max(0,Math.min(v,999999999999999)); }
function s(value,max=40){ return String(value||'').replace(/[\r\n\t]/g,' ').trim().slice(0,max); }
function sanitizeDaily(input){
  const x=input&&typeof input==='object'?input:{};
  return {date:s(x.date,10),wo_total:n(x.wo_total),wo_done:n(x.wo_done),wo_pending:n(x.wo_pending),wo_overdue:n(x.wo_overdue),project_total:n(x.project_total),project_overdue:n(x.project_overdue),crm_total:n(x.crm_total),visits_total:n(x.visits_total),sales_order_total:n(x.sales_order_total),sales_order_value:n(x.sales_order_value),invoice_total:n(x.invoice_total),invoice_outstanding:n(x.invoice_outstanding),material_request_total:n(x.material_request_total),material_request_pending:n(x.material_request_pending),purchase_request_total:n(x.purchase_request_total),purchase_request_pending:n(x.purchase_request_pending)};
}
function sanitizeWeekly(input){
  const x=input&&typeof input==='object'?input:{};
  const fields=['wo_total','wo_done','wo_pending','wo_overdue','wo_unassigned','wo_scheduled','technicians_total','technicians_used','technicians_free','technicians_off','project_active','project_completed','project_overdue','project_avg_progress','project_no_progress','visits_total','visits_customers','sales_order_total','sales_order_approved','sales_order_value','sales_target','sales_actual','sales_achievement','sales_gap','invoice_total','invoice_value','invoice_outstanding','invoice_unpaid','material_request_total','material_request_pending','material_request_items','purchase_request_total','purchase_request_pending','purchase_request_items','prev_wo_total','prev_wo_done','prev_wo_overdue','prev_sales_order_total','prev_sales_order_value','prev_visits_total','prev_invoice_value','prev_invoice_outstanding','prev_mr_pending','prev_pr_pending'];
  const out={period_start:s(x.period_start,10),period_end:s(x.period_end,10)}; fields.forEach(k=>out[k]=n(x[k])); return out;
}
async function geminiGenerate(apiKey,prompt,maxOutputTokens){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens,temperature:0.2}}),signal:controller.signal});
    const body=await response.json().catch(()=>({})); if(!response.ok)throw new Error(body?.error?.message||`Gemini HTTP ${response.status}`);
    return String(body?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'').trim();
  }finally{clearTimeout(timer)}
}
express.static=function pxlAi0007AStatic(root,options){
  const middleware=originalStatic(root,options);
  return async function pxlAi0007AMiddleware(req,res,next){
    const isHealth=req.method==='GET'&&req.path==='/api/ai/gemini/health';
    const isDaily=req.method==='POST'&&req.path==='/api/ai/reports/daily';
    const isWeekly=req.method==='POST'&&req.path==='/api/ai/reports/weekly';
    if(!isHealth&&!isDaily&&!isWeekly)return middleware(req,res,next);
    res.setHeader('Cache-Control','no-store, max-age=0');
    if(!authorized(req))return res.status(401).json({ok:false,connected:false,error:'Unauthorized'});
    const apiKey=String(process.env.GEMINI_API_KEY||'').trim();
    if(!apiKey)return res.status(503).json({ok:false,connected:false,configured:false,model:MODEL,error:'GEMINI_API_KEY belum dikonfigurasi.'});
    if(isHealth){try{const text=await geminiGenerate(apiKey,'Reply with exactly: PIXEL_GEMINI_OK',16);return res.json({ok:true,connected:true,configured:true,model:MODEL,response_ok:text.includes('PIXEL_GEMINI_OK')})}catch(e){return res.status(503).json({ok:false,connected:false,configured:true,model:MODEL,error:e?.name==='AbortError'?'Gemini timeout':String(e?.message||e)})}}
    if(isDaily){
      const summary=sanitizeDaily(req.body?.summary); if(!/^\d{4}-\d{2}-\d{2}$/.test(summary.date))return res.status(400).json({ok:false,error:'Tanggal report tidak valid.'});
      const prompt=`Anda adalah AI Management Report internal Pixel Solusindo. Buat DAILY MANAGEMENT REPORT dalam Bahasa Indonesia berdasarkan DATA RINGKAS berikut.\n\nATURAN WAJIB:\n- Gunakan HANYA angka/data yang diberikan.\n- Jangan membuat atau menebak customer, nama teknisi, nilai, status, penyebab, atau fakta lain yang tidak tersedia.\n- Jika konteks untuk suatu kesimpulan tidak cukup, tulis bahwa perlu verifikasi data detail.\n- Fokus singkat, jelas, actionable. Nilai uang adalah Rupiah.\n\nFORMAT: DAILY MANAGEMENT REPORT; Executive Summary; Operational / WO; Project Progress; Sales & CRM; Invoice / Outstanding; Material & Purchase; Issue / Risk; Priority Follow Up.\n\nDATA RINGKAS:\n${JSON.stringify(summary,null,2)}`;
      try{const report=await geminiGenerate(apiKey,prompt,1400);if(!report)throw new Error('Gemini tidak menghasilkan report.');return res.json({ok:true,model:MODEL,revision:'PXL-AI-0007A',summary,report})}catch(e){return res.status(503).json({ok:false,model:MODEL,error:e?.name==='AbortError'?'Gemini timeout':String(e?.message||e)})}
    }
    const summary=sanitizeWeekly(req.body?.summary);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(summary.period_start)||!/^\d{4}-\d{2}-\d{2}$/.test(summary.period_end))return res.status(400).json({ok:false,error:'Periode weekly report tidak valid.'});
    const prompt=`Anda adalah AI Management Report internal Pixel Solusindo. Buat WEEKLY MANAGEMENT REPORT dalam Bahasa Indonesia hanya dari DATA RINGKAS agregat berikut.\n\nATURAN WAJIB:\n- Jangan membuat nama customer, teknisi, penyebab, nilai, status, atau fakta yang tidak tersedia.\n- Bandingkan minggu berjalan dengan field prev_* secara proporsional.\n- Soroti WO overdue/unassigned, project overdue/no progress, kapasitas teknisi, KPI/gap sales, outstanding, MR/PR pending bila relevan.\n- sales_target dan sales_actual adalah snapshot KPI bulan berjalan pada akhir periode weekly; jangan menganggapnya target mingguan.\n- Jika data tidak cukup untuk menyimpulkan penyebab, tulis perlu verifikasi detail.\n- Nilai uang adalah Rupiah. Fokus manajemen: singkat, jelas, actionable.\n\nFORMAT WAJIB:\nWEEKLY MANAGEMENT REPORT\nPeriode: [period_start] – [period_end]\n\nExecutive Summary\n...\n\nOperational / WO & Technician Capacity\n...\n\nProject Progress\n...\n\nSales, CRM & KPI\n...\n\nInvoice / Outstanding\n...\n\nMaterial & Purchase\n...\n\nWeek-over-Week Comparison\n...\n\nIssue / Risk\n...\n\nPriority Next Week\n...\n\nDATA RINGKAS:\n${JSON.stringify(summary,null,2)}`;
    try{const report=await geminiGenerate(apiKey,prompt,1800);if(!report)throw new Error('Gemini tidak menghasilkan report.');return res.json({ok:true,model:MODEL,revision:'PXL-AI-0007A',summary,report})}catch(e){return res.status(503).json({ok:false,model:MODEL,error:e?.name==='AbortError'?'Gemini timeout':String(e?.message||e)})}
  };
};
