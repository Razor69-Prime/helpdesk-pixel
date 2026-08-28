'use strict';

const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const SENTINEL = '__PXL_REPORT_UNASSIGNED__';
const ALLOWED_ROLES = new Set(['admin','superadmin','manager','operator']);

function send(res, status, payload){
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.end(JSON.stringify(payload));
}

function getBearer(req){
  const header = String(req.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

module.exports = async function handler(req,res){
  if(req.method !== 'POST') return send(res,405,{error:'Method not allowed.'});

  try{
    const secret = process.env.SESSION_SECRET || 'pixel-helpdesk-2026-secret';
    const token = getBearer(req);
    if(!token) return send(res,401,{error:'Unauthorized'});

    let decoded;
    try{ decoded = jwt.verify(token,secret); }
    catch(_){ return send(res,401,{error:'Unauthorized'}); }

    const user = decoded?.user || {};
    const role = String(user.role || '').trim().toLowerCase();
    if(!ALLOWED_ROLES.has(role)) return send(res,403,{error:'Akses ditolak.'});

    const ticketId = String(req.body?.ticket_id || '').trim();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ticketId)){
      return send(res,400,{error:'Ticket ID tidak valid.'});
    }

    const supabaseUrl = String(process.env.SUPABASE_URL || 'https://chgcictuycjeqdxfrnej.supabase.co').replace(/\/$/,'');
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    if(!supabaseKey) return send(res,500,{error:'Supabase server key belum tersedia.'});

    const headers = {
      apikey:supabaseKey,
      Authorization:`Bearer ${supabaseKey}`,
      'Content-Type':'application/json',
      Prefer:'return=representation'
    };

    const check = await fetch(`${supabaseUrl}/rest/v1/tickets?id=eq.${encodeURIComponent(ticketId)}&select=id,technician,technicians,created_by&limit=1`,{
      method:'GET',headers
    });
    if(!check.ok) throw new Error(await check.text());
    const rows = await check.json();
    const ticket = rows?.[0];
    if(!ticket) return send(res,404,{error:'Tiket tidak ditemukan.'});

    const technicians = Array.isArray(ticket.technicians) ? ticket.technicians : [];
    const hasSentinel = technicians.some(v=>String(v||'').trim()===SENTINEL) || String(ticket.technician||'').trim()===SENTINEL;
    if(!hasSentinel) return send(res,409,{error:'Tiket bukan laporan tanpa teknisi.'});

    const patch = await fetch(`${supabaseUrl}/rest/v1/tickets?id=eq.${encodeURIComponent(ticketId)}`,{
      method:'PATCH',headers,body:JSON.stringify({technicians:[],technician:null})
    });
    if(!patch.ok) throw new Error(await patch.text());
    const updated = await patch.json();

    return send(res,200,{ok:true,ticket:updated?.[0]||{id:ticketId,technicians:[],technician:null}});
  }catch(error){
    console.error('[PXL-URG-0027D] unassign failed',error);
    return send(res,500,{error:String(error?.message||error)});
  }
};
