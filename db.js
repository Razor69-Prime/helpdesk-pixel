/**
 * db.js — Storage adapter
 * Lokal  : pakai data/tickets.json (tidak perlu konfigurasi)
 * Online : pakai Supabase (isi SUPABASE_URL & SUPABASE_KEY di config.js)
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const cfg    = require('./config');

const USE_SUPABASE = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('GANTI');

// ─────────────────────────────────────────
//  MODE LOKAL — file JSON
// ─────────────────────────────────────────
const TICKETS_FILE = path.join(__dirname, 'data', 'tickets.json');

function readLocal() {
  if (!fs.existsSync(TICKETS_FILE)) return [];
  return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
}
function writeLocal(data) {
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────
//  MODE SUPABASE — REST API
// ─────────────────────────────────────────
let fetch;
if (USE_SUPABASE) {
  try { fetch = require('node-fetch'); } catch(e) {}
}

const sbBase = () => `${cfg.SUPABASE_URL}/rest/v1`;
const sbHdrs = () => ({
  'apikey':        cfg.SUPABASE_KEY,
  'Authorization': `Bearer ${cfg.SUPABASE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation'
});

async function sbFetch(method, path, body) {
  const opts = { method, headers: sbHdrs() };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(sbBase() + path, opts);
  if (!r.ok) throw new Error(await r.text());
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

// ─────────────────────────────────────────
//  UNIFIED API — dipakai oleh server.js
// ─────────────────────────────────────────

// ── TICKETS ──────────────────────────────

async function getTickets(filterTech, includeArchived=false) {
  if (!USE_SUPABASE) {
    let rows = readLocal().sort((a,b) => new Date(b.worked_at) - new Date(a.worked_at));
    // by default exclude archived
    if (!includeArchived) rows = rows.filter(t => !t.archived);
    if (filterTech) {
      rows = rows.filter(t => {
        const techs = Array.isArray(t.technicians) ? t.technicians
                    : t.technician ? [t.technician] : [];
        return techs.includes(filterTech);
      });
    }
    return rows;
  }
  let p = '/tickets?order=worked_at.desc';
  if (!includeArchived) p += '&archived=is.false';
  if (filterTech) p += `&technicians=cs.["${encodeURIComponent(filterTech)}"]`;
  return sbFetch('GET', p);
}

async function getArchivedTickets() {
  if (!USE_SUPABASE) {
    return readLocal()
      .filter(t => t.archived === true)
      .sort((a,b) => new Date(b.worked_at) - new Date(a.worked_at));
  }
  return sbFetch('GET', '/tickets?archived=is.true&order=worked_at.desc');
}

async function getTicketByToken(token) {
  if (!USE_SUPABASE) {
    return readLocal().find(t => t.tracking_token === token) || null;
  }
  const rows = await sbFetch('GET', `/tickets?tracking_token=eq.${token}&limit=1`);
  return rows?.length ? rows[0] : null;
}

async function insertTicket(data) {
  if (!USE_SUPABASE) {
    const tickets = readLocal();
    const ticket  = {
      id:         crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...data,
      job_stages:     [],  // selalu kosong saat baru dibuat
      status_history: [],  // dikelola terpisah via insertStatusHistory
      invoices:       [],  // dikelola terpisah via insertInvoice
    };
    tickets.push(ticket);
    writeLocal(tickets);
    return ticket;
  }
  const rows = await sbFetch('POST', '/tickets', data);
  return rows?.[0] || null;
}

async function updateTicket(id, patch) {
  if (!USE_SUPABASE) {
    const tickets = readLocal();
    const idx = tickets.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Tiket tidak ditemukan');
    tickets[idx] = { ...tickets[idx], ...patch };
    writeLocal(tickets);
    return tickets[idx];
  }
  const rows = await sbFetch('PATCH', `/tickets?id=eq.${id}`, patch);
  return rows?.[0] || null;
}

async function deleteTicket(id) {
  if (!USE_SUPABASE) {
    writeLocal(readLocal().filter(t => t.id !== id));
    return;
  }
  return sbFetch('DELETE', `/tickets?id=eq.${id}`);
}

// ── STATUS HISTORY ────────────────────────

async function getStatusHistory(ticketId) {
  if (!USE_SUPABASE) {
    const t = readLocal().find(t => t.id === ticketId);
    return t?.status_history || [];
  }
  return sbFetch('GET', `/status_history?ticket_id=eq.${ticketId}&order=timestamp.desc`);
}

async function insertStatusHistory(data) {
  if (!USE_SUPABASE) {
    const tickets = readLocal();
    const idx = tickets.findIndex(t => t.id === data.ticket_id);
    if (idx === -1) return;
    if (!tickets[idx].status_history) tickets[idx].status_history = [];
    const entry = { id: crypto.randomUUID(), ...data };
    tickets[idx].status_history.push(entry);
    writeLocal(tickets);
    return entry;
  }
  const rows = await sbFetch('POST', '/status_history', data);
  return rows?.[0] || null;
}

// ── INVOICES ──────────────────────────────

async function getInvoicesByTicket(ticketId) {
  if (!USE_SUPABASE) {
    const t = readLocal().find(t => t.id === ticketId);
    return t?.invoices || [];
  }
  return sbFetch('GET', `/invoices?ticket_id=eq.${ticketId}&order=uploaded_at.desc`);
}

async function insertInvoice(data) {
  if (!USE_SUPABASE) {
    const tickets = readLocal();
    const idx = tickets.findIndex(t => t.id === data.ticket_id);
    if (idx === -1) throw new Error('Tiket tidak ditemukan');
    if (!tickets[idx].invoices) tickets[idx].invoices = [];
    const inv = {
      id:            crypto.randomUUID(),
      uploaded_at:   new Date().toISOString(),
      total_amount:  data.total_amount || null,
      sales_pic:     data.sales_pic    || null,
      ...data
    };
    tickets[idx].invoices.push(inv);
    writeLocal(tickets);
    return inv;
  }
  const rows = await sbFetch('POST', '/invoices', data);
  return rows?.[0] || null;
}

async function deleteInvoice(id, ticketId) {
  if (!USE_SUPABASE) {
    const tickets = readLocal();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx !== -1 && tickets[idx].invoices) {
      tickets[idx].invoices = tickets[idx].invoices.filter(i => i.id !== id);
      writeLocal(tickets);
    }
    return;
  }
  return sbFetch('DELETE', `/invoices?id=eq.${id}`);
}

console.log(`💾 Storage: ${USE_SUPABASE ? 'Supabase (online)' : 'Local JSON (lokal)'}`);

// ── Job Stages ────────────────────────────

async function getJobStages(ticketId) {
  if (!USE_SUPABASE) {
    const t = readLocal().find(t => t.id === ticketId);
    return t?.job_stages || [];
  }
  return sbFetch('GET', `/job_stages?ticket_id=eq.${ticketId}&order=timestamp.asc`);
}

async function insertJobStage(data) {
  // data: { ticket_id, stage, timestamp, lat, lng, technician }
  if (!USE_SUPABASE) {
    const tickets = readLocal();
    const idx = tickets.findIndex(t => t.id === data.ticket_id);
    if (idx === -1) throw new Error('Tiket tidak ditemukan');
    if (!tickets[idx].job_stages) tickets[idx].job_stages = [];
    const entry = { id: crypto.randomUUID(), ...data };
    tickets[idx].job_stages.push(entry);
    writeLocal(tickets);
    return entry;
  }
  const rows = await sbFetch('POST', '/job_stages', data);
  return rows?.[0] || null;
}


// ─────────────────────────────────────────
//  SALES VISITS
// ─────────────────────────────────────────
const VISITS_FILE = require('path').join(__dirname, 'data', 'sales_visits.json');
function readVisits()       { try { return JSON.parse(require('fs').readFileSync(VISITS_FILE,'utf8')); } catch{ return []; } }
function writeVisits(data)  { require('fs').writeFileSync(VISITS_FILE, JSON.stringify(data,null,2)); }

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

function computePipelineDates(prospectDate) {
  const fu1 = addDays(prospectDate, 3);
  const fu2 = addDays(fu1, 3);
  const lf  = addDays(fu2, 7);
  return { follow_up_1_date: fu1, follow_up_2_date: fu2, last_follow_date: lf };
}

async function getSalesVisits(filterUserId=null) {
  let rows = readVisits().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if (filterUserId) rows = rows.filter(v => v.sales_user_id === filterUserId);
  return rows;
}

async function insertSalesVisit(data) {
  const visits = readVisits();
  const pipeline = computePipelineDates(data.prospect_date);
  const visit = {
    id:            require('crypto').randomUUID(),
    created_at:    new Date().toISOString(),
    updated_at:    new Date().toISOString(),
    ...pipeline,
    ...data,
    status: data.status || 'prospect',
  };
  visits.push(visit);
  writeVisits(visits);
  return visit;
}

async function updateSalesVisit(id, patch) {
  const visits = readVisits();
  const idx = visits.findIndex(v => v.id === id);
  if (idx === -1) throw new Error('Visit tidak ditemukan');
  // Jika prospect_date berubah, recompute pipeline dates
  if (patch.prospect_date && patch.prospect_date !== visits[idx].prospect_date) {
    const pipeline = computePipelineDates(patch.prospect_date);
    Object.assign(patch, pipeline);
  }
  visits[idx] = { ...visits[idx], ...patch, updated_at: new Date().toISOString() };
  writeVisits(visits);
  return visits[idx];
}

async function deleteSalesVisit(id) {
  const visits = readVisits().filter(v => v.id !== id);
  writeVisits(visits);
}

module.exports = {
  USE_SUPABASE,
  getTickets, getArchivedTickets, getTicketByToken,
  insertTicket, updateTicket, deleteTicket,
  getStatusHistory, insertStatusHistory,
  getInvoicesByTicket, insertInvoice, deleteInvoice,
  getJobStages, insertJobStage,
  getSalesVisits, insertSalesVisit, updateSalesVisit, deleteSalesVisit,
  computePipelineDates
};
