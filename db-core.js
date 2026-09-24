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
// PXL-REV-0063 — Server-side Supabase writes must use the service-role key.
// Keep the existing SUPABASE_KEY as a read/fallback key for backward compatibility.
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || cfg.SUPABASE_KEY;
const sbHdrs = () => ({
  'apikey':        SUPABASE_SERVER_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVER_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation'
});

async function sbFetch(method, path, body, extraHeaders) {
  const opts = { method, headers: { ...sbHdrs(), ...(extraHeaders||{}) } };
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
  if (filterTech) {
    // PostgREST cs. filter butuh JSON array literal yang di-encode sebagai whole query param,
    // bukan encode tiap karakter di dalam nama (spasi dsb merusak pencocokan JSON).
    const jsonArr = JSON.stringify([filterTech]);
    p += `&technicians=cs.${encodeURIComponent(jsonArr)}`;
  }
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

async function getInvoiceV1ByTicket(ticketId) {
  if (!USE_SUPABASE) return [];

  const relations = await sbFetch(
    'GET',
    `/invoice_work_orders?ticket_id=eq.${encodeURIComponent(ticketId)}&select=invoice_id,ticket_id`
  ) || [];

  const invoiceIds = [...new Set(
    relations.map(x => x.invoice_id).filter(Boolean).map(String)
  )];

  if (!invoiceIds.length) return [];

  const inFilter = invoiceIds.map(id => encodeURIComponent(id)).join(',');

  return await sbFetch(
    'GET',
    `/invoices?id=in.(${inFilter})&select=*&order=issued_at.desc.nullslast,updated_at.desc.nullslast`
  ) || [];
}

async function getInvoicesByTicket(ticketId) {
  if (!USE_SUPABASE) {
    const t = readLocal().find(t => t.id === ticketId);
    return t?.invoices || [];
  }
  return sbFetch('GET', `/invoices?ticket_id=eq.${ticketId}&order=uploaded_at.desc`);
}


// PXL-REV-0056 — ambil relasi seluruh tiket dalam query batch, bukan 3 query per tiket.
function groupRowsByTicket(rows) {
  return (rows || []).reduce((map, row) => {
    const key = String(row.ticket_id || '');
    if (!map[key]) map[key] = [];
    map[key].push(row);
    return map;
  }, {});
}

async function getTicketRelationsBatch(ticketIds) {
  const ids = [...new Set((ticketIds || []).filter(Boolean).map(String))];
  if (!ids.length) return { invoices:{}, status_history:{}, job_stages:{} };

  if (!USE_SUPABASE) {
    const tickets = readLocal();
    const wanted = new Set(ids);
    const invoices = {}, status_history = {}, job_stages = {};
    tickets.forEach(t => {
      const id = String(t.id);
      if (!wanted.has(id)) return;
      invoices[id] = t.invoices || [];
      status_history[id] = t.status_history || [];
      job_stages[id] = t.job_stages || [];
    });
    return { invoices, status_history, job_stages };
  }

  // PXL-URG-0074 — pecah relasi tiket menjadi batch kecil agar filter PostgREST
  // tidak menghasilkan Request-URI Too Large saat jumlah tiket bertambah.
  const RELATION_BATCH_SIZE = 50;
  const invoiceRows = [], historyRows = [], stageRows = [];
  for (let i = 0; i < ids.length; i += RELATION_BATCH_SIZE) {
    const batch = ids.slice(i, i + RELATION_BATCH_SIZE);
    // UUID tidak mengandung koma; encode tiap nilai agar filter PostgREST tetap aman.
    const inFilter = batch.map(id => encodeURIComponent(id)).join(',');
    const [batchInvoices, batchHistory, batchStages] = await Promise.all([
      sbFetch('GET', `/invoices?ticket_id=in.(${inFilter})&order=uploaded_at.desc`),
      sbFetch('GET', `/status_history?ticket_id=in.(${inFilter})&order=timestamp.desc`),
      sbFetch('GET', `/job_stages?ticket_id=in.(${inFilter})&order=timestamp.asc`)
    ]);
    if (Array.isArray(batchInvoices)) invoiceRows.push(...batchInvoices);
    if (Array.isArray(batchHistory)) historyRows.push(...batchHistory);
    if (Array.isArray(batchStages)) stageRows.push(...batchStages);
  }
  return {
    invoices: groupRowsByTicket(invoiceRows),
    status_history: groupRowsByTicket(historyRows),
    job_stages: groupRowsByTicket(stageRows)
  };
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

// ─────────────────────────────────────────
//  INVOICE TANPA WO (STANDALONE)
// ─────────────────────────────────────────
async function getStandaloneInvoices() {
  if (!USE_SUPABASE) return [];
  return await sbFetch('GET', '/standalone_invoices?order=uploaded_at.desc') || [];
}
async function insertStandaloneInvoice(data) {
  const entry = { id: crypto.randomUUID(), ...data, uploaded_at: new Date().toISOString() };
  if (!USE_SUPABASE) return entry;
  const rows = await sbFetch('POST', '/standalone_invoices', entry);
  return rows?.[0] || entry;
}
async function deleteStandaloneInvoice(id) {
  if (!USE_SUPABASE) return;
  await sbFetch('DELETE', `/standalone_invoices?id=eq.${id}`);
}

// ─────────────────────────────────────────
//  NOTIFICATIONS
// ─────────────────────────────────────────
async function insertNotification(data) {
  const entry = { id: crypto.randomUUID(), ...data, is_read: false, read_by: [], created_at: new Date().toISOString() };
  if (!USE_SUPABASE) return entry;
  const rows = await sbFetch('POST', '/notifications', entry);
  return rows?.[0] || entry;
}

async function getNotificationsForUser(user) {
  if (!USE_SUPABASE) return [];
  // Ambil notif yang: target_user_id = user.id, ATAU target_role = user.role, ATAU target_role null (broadcast)
  // Dipecah jadi query terpisah (lebih aman daripada .or() PostgREST yang rawan salah escape)
  const [byUser, byRole] = await Promise.all([
    sbFetch('GET', `/notifications?target_user_id=eq.${user.id}&order=created_at.desc&limit=50`),
    sbFetch('GET', `/notifications?target_role=eq.${user.role}&order=created_at.desc&limit=50`),
  ]);
  const combined = [...(byUser || []), ...(byRole || [])];
  // Dedupe berdasarkan id, lalu urutkan terbaru dulu
  const uniqueMap = new Map();
  combined.forEach(n => uniqueMap.set(n.id, n));
  return [...uniqueMap.values()]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 50);
}

async function markNotificationRead(id, userId) {
  if (!USE_SUPABASE) return;
  // Ambil dulu read_by yang ada, tambahkan userId, simpan lagi
  const rows = await sbFetch('GET', `/notifications?id=eq.${id}&select=read_by`);
  const current = rows?.[0]?.read_by || [];
  if (!current.includes(userId)) current.push(userId);
  await sbFetch('PATCH', `/notifications?id=eq.${id}`, { read_by: current, is_read: true });
}

async function markAllNotificationsRead(user) {
  if (!USE_SUPABASE) return;
  const notifs = await getNotificationsForUser(user);
  for (const n of notifs) {
    const current = n.read_by || [];
    if (!current.includes(user.id)) {
      current.push(user.id);
      await sbFetch('PATCH', `/notifications?id=eq.${n.id}`, { read_by: current, is_read: true });
    }
  }
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
function writeVisits(data)  { try { require('fs').writeFileSync(VISITS_FILE, JSON.stringify(data,null,2)); } catch{} }

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
  if (USE_SUPABASE) {
    let path = '/sales_visits?order=created_at.desc';
    if (filterUserId) path += `&sales_user_id=eq.${filterUserId}`;
    return await sbFetch('GET', path) || [];
  }
  let rows = readVisits().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if (filterUserId) rows = rows.filter(v => v.sales_user_id === filterUserId);
  return rows;
}

async function insertSalesVisit(data) {
  const pipeline = computePipelineDates(data.prospect_date);
  const visit = {
    id:         require('crypto').randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...pipeline,
    ...data,
    status: data.status || 'prospect',
  };
  if (USE_SUPABASE) {
    const rows = await sbFetch('POST', '/sales_visits', visit);
    return rows?.[0] || visit;
  }
  const visits = readVisits();
  visits.push(visit);
  writeVisits(visits);
  return visit;
}

async function updateSalesVisit(id, patch) {
  if (USE_SUPABASE) {
    if (patch.prospect_date) {
      const pipeline = computePipelineDates(patch.prospect_date);
      Object.assign(patch, pipeline);
    }
    patch.updated_at = new Date().toISOString();
    const rows = await sbFetch('PATCH', `/sales_visits?id=eq.${id}`, patch);
    return rows?.[0] || null;
  }
  const visits = readVisits();
  const idx = visits.findIndex(v => v.id === id);
  if (idx === -1) throw new Error('Visit tidak ditemukan');
  if (patch.prospect_date && patch.prospect_date !== visits[idx].prospect_date) {
    const pipeline = computePipelineDates(patch.prospect_date);
    Object.assign(patch, pipeline);
  }
  visits[idx] = { ...visits[idx], ...patch, updated_at: new Date().toISOString() };
  writeVisits(visits);
  return visits[idx];
}

async function deleteSalesVisit(id) {
  if (USE_SUPABASE) {
    await sbFetch('DELETE', `/sales_visits?id=eq.${id}`);
    return;
  }
  const visits = readVisits().filter(v => v.id !== id);
  writeVisits(visits);
}


// ─────────────────────────────────────────
//  USERS (Supabase only)
// ─────────────────────────────────────────
async function getUsers() {
  if (!USE_SUPABASE) return [];
  const rows = await sbFetch('GET', '/users?order=created_at.asc');
  return (rows || []).map(({ password: _, ...u }) => u);
}

async function getUsersWithPassword() {
  if (!USE_SUPABASE) return [];
  return await sbFetch('GET', '/users?order=created_at.asc') || [];
}

async function insertUser(data) {
  if (!USE_SUPABASE) return null;
  const rows = await sbFetch('POST', '/users', { ...data, id: require('crypto').randomUUID(), created_at: new Date().toISOString() });
  const { password: _, ...safe } = rows?.[0] || {};
  return safe;
}

async function updateUser(id, patch) {
  if (!USE_SUPABASE) return null;
  const rows = await sbFetch('PATCH', `/users?id=eq.${id}`, patch);
  const { password: _, ...safe } = rows?.[0] || {};
  return safe;
}

async function deleteUser(id) {
  if (!USE_SUPABASE) return;
  await sbFetch('DELETE', `/users?id=eq.${id}`);
}


// ─────────────────────────────────────────
//  SALES TARGETS
// ─────────────────────────────────────────
const TARGETS_FILE = require('path').join(__dirname, 'data', 'sales_targets.json');
function readTargetsLocal()      { try { return JSON.parse(require('fs').readFileSync(TARGETS_FILE,'utf8')); } catch{ return []; } }
function writeTargetsLocal(data) { require('fs').writeFileSync(TARGETS_FILE, JSON.stringify(data,null,2)); }

async function getSalesTargets() {
  if (!USE_SUPABASE) return readTargetsLocal();
  return await sbFetch('GET', '/sales_targets?order=year_month.desc') || [];
}

async function upsertSalesTarget({ sales_pic, year_month, target_amount, updated_by }) {
  if (!USE_SUPABASE) {
    const targets = readTargetsLocal();
    const idx = targets.findIndex(t => t.sales_pic === sales_pic && t.year_month === year_month);
    const entry = {
      id:            idx >= 0 ? targets[idx].id : require('crypto').randomUUID(),
      sales_pic, year_month,
      target_amount: Number(target_amount),
      updated_at:    new Date().toISOString(),
      updated_by
    };
    if (idx >= 0) targets[idx] = entry; else targets.push(entry);
    writeTargetsLocal(targets);
    return entry;
  }
  // Supabase upsert via on_conflict
  const rows = await sbFetch('POST', '/sales_targets?on_conflict=sales_pic,year_month', {
    sales_pic, year_month,
    target_amount: Number(target_amount),
    updated_at: new Date().toISOString(),
    updated_by
  }, { Prefer: 'resolution=merge-duplicates,return=representation' });
  return rows?.[0] || null;
}

async function deleteSalesTarget(id) {
  if (!USE_SUPABASE) {
    writeTargetsLocal(readTargetsLocal().filter(t => t.id !== id));
    return;
  }
  await sbFetch('DELETE', `/sales_targets?id=eq.${id}`);
}


// ─────────────────────────────────────────
//  ACTIVITY LOG
// ─────────────────────────────────────────
const LOG_FILE = require('path').join(__dirname, 'data', 'activity_log.json');
function readLogLocal()      { try { return JSON.parse(require('fs').readFileSync(LOG_FILE,'utf8')); } catch{ return []; } }
function writeLogLocal(data) { try { require('fs').writeFileSync(LOG_FILE, JSON.stringify(data,null,2)); } catch{} }

async function insertLog(entry) {
  const log = {
    id:        require('crypto').randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry
  };
  if (!USE_SUPABASE) {
    const logs = readLogLocal();
    logs.unshift(log);
    // Simpan max 5000 log
    writeLogLocal(logs.slice(0, 5000));
    return log;
  }
  try {
    await sbFetch('POST', '/activity_logs', log);
  } catch(e) { console.error('Log insert error:', e.message); }
  return log;
}

async function getLogs(limit=500) {
  if (!USE_SUPABASE) {
    return readLogLocal().slice(0, limit);
  }
  return await sbFetch('GET', `/activity_logs?order=timestamp.desc&limit=${limit}`) || [];
}

async function clearLogs() {
  if (!USE_SUPABASE) { writeLogLocal([]); return; }
  await sbFetch('DELETE', '/activity_logs?id=neq.00000000-0000-0000-0000-000000000000');
}

// ─────────────────────────────────────────
//  PURCHASE REQUESTS
// ─────────────────────────────────────────
async function getPurchaseRequests(){
  if(!USE_SUPABASE) return [];
  return await sbFetch('GET','/purchase_requests?order=created_at.desc')||[];
}
async function insertPurchaseRequest(data){
  const entry={id:require('crypto').randomUUID(),...data,created_at:new Date().toISOString()};
  if(!USE_SUPABASE) return entry;
  const rows=await sbFetch('POST','/purchase_requests',entry);
  return rows?.[0]||entry;
}
async function updatePurchaseRequest(id,data){
  if(!USE_SUPABASE) return {id,...data};
  const rows=await sbFetch('PATCH',`/purchase_requests?id=eq.${id}`,data);
  return rows?.[0]||{id,...data};
}
async function deletePurchaseRequest(id){
  if(!USE_SUPABASE) return;
  await sbFetch('DELETE',`/purchase_requests?id=eq.${id}`);
}

// ─────────────────────────────────────────
//  PROJECT TRACKER
// ─────────────────────────────────────────
async function getProjects(){
  if(!USE_SUPABASE) return [];
  return await sbFetch('GET','/projects?order=created_at.desc')||[];
}
async function insertProject(data){
  const entry={id:require('crypto').randomUUID(),...data,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(!USE_SUPABASE) return entry;
  const rows=await sbFetch('POST','/projects',entry);
  return rows?.[0]||entry;
}
async function updateProject(id,data){
  const patch={...data,updated_at:new Date().toISOString()};
  if(!USE_SUPABASE) return {id,...patch};
  const rows=await sbFetch('PATCH',`/projects?id=eq.${id}`,patch);
  return rows?.[0]||{id,...patch};
}
async function deleteProject(id){
  if(!USE_SUPABASE) return;
  await sbFetch('DELETE',`/projects?id=eq.${id}`);
}

// PXL-STG-0010 — PROJECT REPORT
async function getProjectReports(){
  if(!USE_SUPABASE) return [];
  return await sbFetch('GET','/project_reports?order=updated_at.desc')||[];
}
async function upsertProjectReport(projectId,totalBoq,updatedBy){
  const payload={project_id:projectId,total_boq:Number(totalBoq),updated_by:updatedBy||null,updated_at:new Date().toISOString()};
  if(!USE_SUPABASE) return {id:require('crypto').randomUUID(),...payload};
  const existing=await sbFetch('GET',`/project_reports?project_id=eq.${projectId}&limit=1`);
  if(existing?.length){
    const rows=await sbFetch('PATCH',`/project_reports?project_id=eq.${projectId}`,payload);
    return rows?.[0]||{...existing[0],...payload};
  }
  const rows=await sbFetch('POST','/project_reports',payload);
  return rows?.[0]||payload;
}
async function getProjectReportAchievements(projectId=null){
  if(!USE_SUPABASE) return [];
  let q='/project_report_achievements?order=achievement_date.desc,created_at.desc';
  if(projectId) q+=`&project_id=eq.${projectId}`;
  return await sbFetch('GET',q)||[];
}
async function insertProjectReportAchievement(data){
  const entry={id:require('crypto').randomUUID(),...data,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(!USE_SUPABASE) return entry;
  const rows=await sbFetch('POST','/project_report_achievements',entry);
  return rows?.[0]||entry;
}
async function updateProjectReportAchievement(id,patch){
  const data={...patch,updated_at:new Date().toISOString()};
  if(!USE_SUPABASE) return {id,...data};
  const rows=await sbFetch('PATCH',`/project_report_achievements?id=eq.${id}`,data);
  return rows?.[0]||{id,...data};
}
async function deleteProjectReportAchievement(id){
  if(!USE_SUPABASE) return;
  await sbFetch('DELETE',`/project_report_achievements?id=eq.${id}`);
}


// PXL-STG-0011 — PROJECT REPORT DETAIL BOQ
async function getProjectReportItems(projectId=null){
  if(!USE_SUPABASE) return [];
  let q='/project_report_items?order=sort_order.asc,created_at.asc';
  if(projectId) q+=`&project_id=eq.${encodeURIComponent(projectId)}`;
  return await sbFetch('GET',q)||[];
}
async function insertProjectReportItem(data){
  const entry={id:require('crypto').randomUUID(),...data,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(!USE_SUPABASE) return entry;
  const rows=await sbFetch('POST','/project_report_items',entry);
  return rows?.[0]||entry;
}
async function updateProjectReportItem(id,patch){
  const data={...patch,updated_at:new Date().toISOString()};
  if(!USE_SUPABASE) return {id,...data};
  const rows=await sbFetch('PATCH',`/project_report_items?id=eq.${encodeURIComponent(id)}`,data);
  return rows?.[0]||{id,...data};
}
async function deleteProjectReportItem(id){
  if(!USE_SUPABASE) return;
  await sbFetch('DELETE',`/project_report_items?id=eq.${encodeURIComponent(id)}`);
}
async function getProjectReportItemAchievements(itemId=null){
  if(!USE_SUPABASE) return [];
  let q='/project_report_item_achievements?order=achievement_date.desc,created_at.desc';
  if(itemId) q+=`&item_id=eq.${encodeURIComponent(itemId)}`;
  return await sbFetch('GET',q)||[];
}
async function insertProjectReportItemAchievement(data){
  const entry={id:require('crypto').randomUUID(),...data,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(!USE_SUPABASE) return entry;
  const rows=await sbFetch('POST','/project_report_item_achievements',entry);
  return rows?.[0]||entry;
}
async function updateProjectReportItemAchievement(id,patch){
  const data={...patch,updated_at:new Date().toISOString()};
  if(!USE_SUPABASE) return {id,...data};
  const rows=await sbFetch('PATCH',`/project_report_item_achievements?id=eq.${encodeURIComponent(id)}`,data);
  return rows?.[0]||{id,...data};
}
async function deleteProjectReportItemAchievement(id){
  if(!USE_SUPABASE) return;
  await sbFetch('DELETE',`/project_report_item_achievements?id=eq.${encodeURIComponent(id)}`);
}

// ─────────────────────────────────────────
//  SUPPLIERS
// ─────────────────────────────────────────
async function getSuppliers(){
  if(!USE_SUPABASE) return [];
  return await sbFetch('GET','/suppliers?order=name.asc')||[];
}
async function insertSupplier(data){
  const entry={id:require('crypto').randomUUID(),...data,created_at:new Date().toISOString()};
  if(!USE_SUPABASE) return entry;
  const rows=await sbFetch('POST','/suppliers',entry);
  return rows?.[0]||entry;
}
async function updateSupplier(id,data){
  if(!USE_SUPABASE) return {id,...data};
  const rows=await sbFetch('PATCH',`/suppliers?id=eq.${id}`,data);
  return rows?.[0]||{id,...data};
}
async function deleteSupplier(id){
  if(!USE_SUPABASE) return;
  await sbFetch('DELETE',`/suppliers?id=eq.${id}`);
}

// ─────────────────────────────────────────
//  MATERIAL REQUESTS
// ─────────────────────────────────────────
const MATERIALS_FILE = require('path').join(__dirname, 'data', 'material_requests.json');
function readMaterialsLocal()      { try { return JSON.parse(require('fs').readFileSync(MATERIALS_FILE,'utf8')); } catch{ return []; } }
function writeMaterialsLocal(data) { try { require('fs').writeFileSync(MATERIALS_FILE, JSON.stringify(data,null,2)); } catch{} }

async function insertMaterialRequest({ ticket_id, wo_number, technician, materials, jasa, notes }) {
  const entry = {
    id:         require('crypto').randomUUID(),
    ticket_id,
    wo_number:  wo_number || null,
    technician: technician || null,
    materials:  materials || [],
    jasa:       jasa || [],
    notes:      notes || null,
    created_at: new Date().toISOString(),
  };
  if (!USE_SUPABASE) {
    const all = readMaterialsLocal();
    all.unshift(entry);
    writeMaterialsLocal(all);
    return entry;
  }
  const rows = await sbFetch('POST', '/material_requests', entry);
  return rows?.[0] || entry;
}

async function getMaterialRequests() {
  if (!USE_SUPABASE) return readMaterialsLocal();
  return await sbFetch('GET', '/material_requests?order=created_at.desc') || [];
}

// ─────────────────────────────────────────
//  MATERIAL REQUEST FORM (tabel baru)
// ─────────────────────────────────────────
async function getMRForms() {
  if (!USE_SUPABASE) return [];
  return await sbFetch('GET', '/material_request_forms?order=created_at.desc') || [];
}
async function insertMRForm(data) {
  const entry = { id: require('crypto').randomUUID(), ...data, created_at: new Date().toISOString() };
  if (!USE_SUPABASE) return entry;
  const rows = await sbFetch('POST', '/material_request_forms', entry);
  return rows?.[0] || entry;
}
async function updateMRForm(id, data) {
  if (!USE_SUPABASE) return { id, ...data };
  const rows = await sbFetch('PATCH', `/material_request_forms?id=eq.${id}`, data);
  return rows?.[0] || { id, ...data };
}
async function deleteMRForm(id) {
  if (!USE_SUPABASE) return;
  await sbFetch('DELETE', `/material_request_forms?id=eq.${id}`);
}




// ─────────────────────────────────────────
//  INVENTORY — PXL-REV-0050
// ─────────────────────────────────────────
function requireInventorySupabase() {
  if (!USE_SUPABASE) {
    throw new Error('Supabase belum aktif. Pastikan SUPABASE_URL dan SUPABASE_KEY tersedia di Vercel Environment Variables.');
  }
}

async function getInventoryCategories() {
  requireInventorySupabase();
  const categories = await sbFetch('GET', '/inventory_categories?is_active=is.true&order=sort_order.asc,name.asc') || [];
  const subcategories = await sbFetch('GET', '/inventory_subcategories?is_active=is.true&order=sort_order.asc,name.asc') || [];
  return categories.map(c => ({
    id: c.id, name: c.name, code: c.code,
    subcategories: subcategories.filter(sc => sc.category_id === c.id).map(sc => ({ id: sc.id, name: sc.name, code: sc.code }))
  }));
}
async function generateInventoryBarcode() {
  requireInventorySupabase();
  const result = await sbFetch('POST', '/rpc/inventory_next_barcode', {}, { Prefer: 'return=representation' });
  return typeof result === 'string' ? result : (Array.isArray(result) ? result[0] : result);
}
async function findInventoryItemByCode(code) {
  requireInventorySupabase();
  const q = encodeURIComponent(String(code || '').trim());
  const rows = await sbFetch('GET', `/inventory_items?or=(manufacturer_barcode.eq.${q},barcode.eq.${q},sku.eq.${q},product_number.eq.${q})&is_active=is.true&limit=1`);
  return rows?.[0] || null;
}
async function findInventoryItemByManufacturerBarcode(code) {
  requireInventorySupabase();
  const q = encodeURIComponent(String(code || '').trim());
  const rows = await sbFetch('GET', `/inventory_items?manufacturer_barcode=eq.${q}&is_active=is.true&limit=1`);
  return rows?.[0] || null;
}
async function getInventoryHealth() {
  requireInventorySupabase();
  const rows = await sbFetch('GET', '/inventory_items?select=id&limit=1');
  return { connected: true, table: 'inventory_items', sample_count: Array.isArray(rows) ? rows.length : 0 };
}
async function getInventoryItems() {
  requireInventorySupabase();
  return await sbFetch('GET', '/inventory_items?is_active=is.true&order=name.asc') || [];
}
async function getInventoryItem(id) {
  requireInventorySupabase();
  const rows = await sbFetch('GET', `/inventory_items?id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}
async function insertInventoryItem(data) {
  requireInventorySupabase();
  const entry = { id: crypto.randomUUID(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const rows = await sbFetch('POST', '/inventory_items', entry, { Prefer: 'return=representation' });
  if (!rows?.[0]) throw new Error('Supabase tidak mengembalikan data barang setelah insert.');
  return rows[0];
}
async function updateInventoryItem(id, data) {
  requireInventorySupabase();
  const patch = { ...data, updated_at: new Date().toISOString() };
  const rows = await sbFetch('PATCH', `/inventory_items?id=eq.${encodeURIComponent(id)}`, patch, { Prefer: 'return=representation' });
  return rows?.[0] || { id, ...patch };
}
async function generateInventorySku(category, subcategory) {
  requireInventorySupabase();
  const result = await sbFetch('POST', '/rpc/inventory_next_sku', { p_category: category, p_subcategory: subcategory }, { Prefer: 'return=representation' });
  return typeof result === 'string' ? result : (Array.isArray(result) ? result[0] : result);
}
async function deleteInventoryItem(id, actor = 'System') {
  requireInventorySupabase();
  const result = await sbFetch('POST', '/rpc/inventory_soft_delete', { p_item_id: id, p_actor: actor }, { Prefer: 'return=representation' });
  const deleted = Array.isArray(result) ? result[0] : result;
  if (!deleted || deleted.ok !== true) throw new Error(deleted?.error || 'Supabase tidak mengonfirmasi penghapusan barang.');
  return deleted;
}
async function restockInventoryBatch(itemId, qty, serialNumbers, reference, actor) {
  requireInventorySupabase();
  const result = await sbFetch('POST', '/rpc/inventory_restock_batch', {
    p_item_id: itemId, p_qty: Number(qty || 0), p_serial_numbers: Array.isArray(serialNumbers) ? serialNumbers : [],
    p_reference: reference || 'Restock', p_actor: actor || 'System'
  }, { Prefer: 'return=representation' });
  const row = Array.isArray(result) ? result[0] : result;
  if (!row || row.ok !== true) throw new Error(row?.error || 'Restock gagal diproses.');
  return row;
}
async function getInventoryTransactions() {
  requireInventorySupabase();
  return await sbFetch('GET', '/inventory_transactions?select=*,inventory_items(name,unit)&order=created_at.desc&limit=500') || [];
}
async function insertInventoryTransaction(data) {
  requireInventorySupabase();
  const entry = { id: crypto.randomUUID(), ...data, created_at: new Date().toISOString() };
  const rows = await sbFetch('POST', '/inventory_transactions', entry, { Prefer: 'return=representation' });
  return rows?.[0] || entry;
}
async function getInventoryOpnames() {
  requireInventorySupabase();
  return await sbFetch('GET', '/inventory_opnames?order=created_at.desc&limit=50') || [];
}
async function insertInventoryOpname(data) {
  requireInventorySupabase();
  const entry = { id: crypto.randomUUID(), ...data, created_at: new Date().toISOString() };
  const rows = await sbFetch('POST', '/inventory_opnames', entry, { Prefer: 'return=representation' });
  return rows?.[0] || entry;
}
async function updateInventoryOpname(id, data) {
  requireInventorySupabase();
  const rows = await sbFetch('PATCH', `/inventory_opnames?id=eq.${encodeURIComponent(id)}`, data, { Prefer: 'return=representation' });
  return rows?.[0] || { id, ...data };
}
async function insertInventoryOpnameItem(data) {
  requireInventorySupabase();
  const entry = { id: crypto.randomUUID(), ...data, created_at: new Date().toISOString() };
  const rows = await sbFetch('POST', '/inventory_opname_items', entry, { Prefer: 'return=representation' });
  return rows?.[0] || entry;
}
async function importInventoryCutoff(rows, actor) {
  requireInventorySupabase();
  const result = await sbFetch('POST', '/rpc/inventory_apply_cutoff', { p_rows: rows, p_actor: actor || 'System' }, { Prefer: 'return=representation' });
  const output = Array.isArray(result) ? result[0] : result;
  if (output?.ok === false) throw new Error(output.error || 'Import Inventory gagal.');
  return output || result;
}

async function mergeInventoryDuplicatesBulk(merges, actor) {
  requireInventorySupabase();
  const result = await sbFetch('POST', '/rpc/inventory_merge_duplicates_bulk', {
    p_merges: Array.isArray(merges) ? merges : [],
    p_actor: actor || 'System'
  }, { Prefer: 'return=representation' });
  const output = Array.isArray(result) ? result[0] : result;
  if (!output || output.ok !== true) throw new Error(output?.error || 'Merge massal Inventory gagal.');
  return output;
}

// ─────────────────────────────────────────
// CRM / SALES ORDER / WO / INVOICE FLOW
// PXL-REV-0039
// ─────────────────────────────────────────
const CRM_FILES = {
  customers: path.join(__dirname,'data','crm_customers.json'),
  sales_orders: path.join(__dirname,'data','sales_orders.json'),
  sales_order_site_templates: path.join(__dirname,'data','sales_order_site_templates.json'),
  work_orders: path.join(__dirname,'data','crm_work_orders.json'),
  crm_material_requests: path.join(__dirname,'data','crm_material_requests.json'),
  additional_material_requests: path.join(__dirname,'data','additional_material_requests.json'),
  crm_invoices: path.join(__dirname,'data','crm_invoices.json'),
  customer_import_staging: path.join(__dirname,'data','crm_customer_import_staging.json'),
  whatsapp_templates: path.join(__dirname,'data','crm_whatsapp_templates.json'),
  communication_history: path.join(__dirname,'data','crm_communication_history.json'),
  work_order_photos: path.join(__dirname,'data','work_order_photos.json')
};
function readJsonFile(file){ try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return []} }
function writeJsonFile(file,data){ fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(data,null,2)); }
function nextDocNo(prefix,rows,field){
  const year=new Date().getFullYear();
  const re=new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const max=rows.reduce((m,r)=>{const x=String(r[field]||'').match(re);return x?Math.max(m,Number(x[1])):m},0);
  return `${prefix}-${year}-${String(max+1).padStart(6,'0')}`;
}
async function listEntity(table,localKey,order='created_at.desc'){
  if(!USE_SUPABASE) return readJsonFile(CRM_FILES[localKey]).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  return await sbFetch('GET',`/${table}?order=${order}`)||[];
}
async function insertEntity(table,localKey,data){
  const entry={id:crypto.randomUUID(),...data,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(!USE_SUPABASE){const rows=readJsonFile(CRM_FILES[localKey]);rows.unshift(entry);writeJsonFile(CRM_FILES[localKey],rows);return entry;}
  const rows=await sbFetch('POST',`/${table}`,entry);return rows?.[0]||entry;
}
async function updateEntity(table,localKey,id,patch){
  const data={...patch,updated_at:new Date().toISOString()};
  if(!USE_SUPABASE){const rows=readJsonFile(CRM_FILES[localKey]);const i=rows.findIndex(x=>x.id===id);if(i<0)throw new Error('Data tidak ditemukan');rows[i]={...rows[i],...data};writeJsonFile(CRM_FILES[localKey],rows);return rows[i];}
  const rows=await sbFetch('PATCH',`/${table}?id=eq.${id}`,data);return rows?.[0]||{id,...data};
}
async function deleteEntity(table,localKey,id){
  if(!USE_SUPABASE){
    const rows=readJsonFile(CRM_FILES[localKey]);
    const i=rows.findIndex(x=>x.id===id);
    if(i<0) throw new Error('Data tidak ditemukan');
    const [deleted]=rows.splice(i,1);
    writeJsonFile(CRM_FILES[localKey],rows);
    return deleted;
  }
  const rows=await sbFetch('DELETE',`/${table}?id=eq.${id}`);
  return rows?.[0]||{id};
}
async function getCrmCustomers(){return listEntity('crm_customers','customers','name.asc')}
async function insertCrmCustomer(data){return insertEntity('crm_customers','customers',data)}
async function updateCrmCustomer(id,data){return updateEntity('crm_customers','customers',id,data)}
async function deleteCrmCustomer(id){return deleteEntity('crm_customers','customers',id)}
async function getSalesOrders(){return listEntity('sales_orders','sales_orders')}
async function insertSalesOrder(data){
  const rows=await getSalesOrders();
  return insertEntity('sales_orders','sales_orders',{...data,so_number:nextDocNo('SO',rows,'so_number'),status:data.status||'draft',revision_no:0,is_deleted:false,history:data.history||[]});
}
async function updateSalesOrder(id,data){return updateEntity('sales_orders','sales_orders',id,data)}
async function deleteSalesOrder(id){return deleteEntity('sales_orders','sales_orders',id)}
async function getSalesOrderSiteTemplates(){return listEntity('sales_order_site_templates','sales_order_site_templates','template_name.asc')}
async function insertSalesOrderSiteTemplate(data){return insertEntity('sales_order_site_templates','sales_order_site_templates',data)}
async function updateSalesOrderSiteTemplate(id,data){return updateEntity('sales_order_site_templates','sales_order_site_templates',id,data)}
async function deleteSalesOrderSiteTemplate(id){return deleteEntity('sales_order_site_templates','sales_order_site_templates',id)}

async function getCrmWorkOrders(){return listEntity('crm_work_orders','work_orders')}
async function insertCrmWorkOrder(data){
  const rows=await getCrmWorkOrders();
  const wo_number=data.number_source==='manual'?String(data.wo_number||'').trim():nextDocNo('WO',rows,'wo_number');
  if(!wo_number) throw new Error('Nomor WO manual wajib diisi');
  if(rows.some(x=>String(x.wo_number).toLowerCase()===wo_number.toLowerCase())) throw new Error('Nomor WO sudah digunakan');
  return insertEntity('crm_work_orders','work_orders',{...data,wo_number,status:data.status||'draft'});
}
async function updateCrmWorkOrder(id,data){return updateEntity('crm_work_orders','work_orders',id,data)}
async function deleteCrmWorkOrder(id){return deleteEntity('crm_work_orders','work_orders',id)}
async function getCrmMaterialRequests(){return listEntity('crm_material_requests','crm_material_requests')}
async function insertCrmMaterialRequest(data){
  const rows=await getCrmMaterialRequests();
  return insertEntity('crm_material_requests','crm_material_requests',{...data,mr_number:nextDocNo('MR',rows,'mr_number'),status:'waiting_technician_verification'});
}
async function updateCrmMaterialRequest(id,data){return updateEntity('crm_material_requests','crm_material_requests',id,data)}
async function issueInventoryMaterialRequest(requestId,items,actor,woNumber){
  requireInventorySupabase();
  const result=await sbFetch('POST','/rpc/inventory_issue_material_request',{p_request_id:requestId,p_items:items,p_actor:actor||'System',p_wo_number:woNumber||''},{Prefer:'return=representation'});
  return Array.isArray(result)?result[0]:result;
}
async function getAdditionalMaterialRequests(){return listEntity('additional_material_requests','additional_material_requests')}
async function insertAdditionalMaterialRequest(data){
  const rows=await getAdditionalMaterialRequests();
  return insertEntity('additional_material_requests','additional_material_requests',{...data,amr_number:nextDocNo('AMR',rows,'amr_number'),status:'waiting_internal_approval'});
}
async function updateAdditionalMaterialRequest(id,data){return updateEntity('additional_material_requests','additional_material_requests',id,data)}
async function getCrmInvoices(){return listEntity('crm_invoices','crm_invoices')}
async function insertCrmInvoice(data){
  const rows=await getCrmInvoices();
  return insertEntity('crm_invoices','crm_invoices',{...data,invoice_number:nextDocNo('INV',rows,'invoice_number'),status:data.status||'draft'});
}

async function getCustomerImportStaging(){return listEntity('crm_customer_import_staging','customer_import_staging')}
async function insertCustomerImportStaging(data){return insertEntity('crm_customer_import_staging','customer_import_staging',data)}
async function updateCustomerImportStaging(id,data){return updateEntity('crm_customer_import_staging','customer_import_staging',id,data)}
async function getWhatsappTemplates(){return listEntity('crm_whatsapp_templates','whatsapp_templates','template_name.asc')}
async function insertWhatsappTemplate(data){return insertEntity('crm_whatsapp_templates','whatsapp_templates',data)}
async function getCommunicationHistory(){return listEntity('crm_communication_history','communication_history')}
async function insertCommunicationHistory(data){return insertEntity('crm_communication_history','communication_history',data)}

// PXL-REV-0052 — Dokumentasi foto Work Order (Cloudinary metadata)
async function getWorkOrderPhotos(ticketId, publicOnly=false){
  if(!USE_SUPABASE){
    return readJsonFile(CRM_FILES.work_order_photos)
      .filter(x=>String(x.ticket_id)===String(ticketId) && !x.deleted_at && (!publicOnly || x.visible_to_customer===true))
      .sort((a,b)=>new Date(a.uploaded_at||a.created_at||0)-new Date(b.uploaded_at||b.created_at||0));
  }
  let q=`/work_order_photos?ticket_id=eq.${encodeURIComponent(ticketId)}&deleted_at=is.null`;
  if(publicOnly) q += '&visible_to_customer=eq.true';
  q += '&order=uploaded_at.asc';
  return await sbFetch('GET',q)||[];
}
async function insertWorkOrderPhoto(data){
  const entry={
    id:crypto.randomUUID(),
    ticket_id:data.ticket_id,
    image_url:data.image_url,
    secure_url:data.secure_url||data.image_url,
    cloudinary_public_id:data.cloudinary_public_id,
    original_filename:data.original_filename||null,
    generated_filename:data.generated_filename||null,
    caption:data.caption||null,
    visible_to_customer:data.visible_to_customer!==false,
    uploaded_by:data.uploaded_by||null,
    uploaded_by_id:data.uploaded_by_id||null,
    uploaded_at:new Date().toISOString(),
    created_at:new Date().toISOString(),
    deleted_at:null
  };
  if(!USE_SUPABASE){const rows=readJsonFile(CRM_FILES.work_order_photos);rows.push(entry);writeJsonFile(CRM_FILES.work_order_photos,rows);return entry;}
  const rows=await sbFetch('POST','/work_order_photos',entry);return rows?.[0]||entry;
}
async function updateWorkOrderPhoto(id,patch){
  const data={...patch,updated_at:new Date().toISOString()};
  if(!USE_SUPABASE){const rows=readJsonFile(CRM_FILES.work_order_photos);const i=rows.findIndex(x=>String(x.id)===String(id));if(i<0)throw new Error('Foto tidak ditemukan');rows[i]={...rows[i],...data};writeJsonFile(CRM_FILES.work_order_photos,rows);return rows[i];}
  const rows=await sbFetch('PATCH',`/work_order_photos?id=eq.${encodeURIComponent(id)}`,data);return rows?.[0]||{id,...data};
}

// PXL-STG-0009A — Form Cuti / Izin
const LEAVE_REQUESTS_FILE=path.join(__dirname,'data','leave_requests.json');
const LEAVE_BALANCES_FILE=path.join(__dirname,'data','leave_balances.json');
const LEAVE_HISTORY_FILE=path.join(__dirname,'data','leave_request_history.json');
const LEAVE_OPTIONS_FILE=path.join(__dirname,'data','leave_hr_options.json');
const LEAVE_SIGNATORIES_FILE=path.join(__dirname,'data','leave_signatory_settings.json');
function readLeaveLocal(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(_){return [];}}
function writeLeaveLocal(file,rows){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(rows,null,2));}
async function getLeaveRequests(){return USE_SUPABASE?sbFetch('GET','/leave_requests?order=created_at.desc'):readLeaveLocal(LEAVE_REQUESTS_FILE).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));}
async function insertLeaveRequest(data){const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),status:'draft',...data};if(USE_SUPABASE){const rows=await sbFetch('POST','/leave_requests',row);return rows?.[0]||row;}const all=readLeaveLocal(LEAVE_REQUESTS_FILE);all.push(row);writeLeaveLocal(LEAVE_REQUESTS_FILE,all);return row;}
async function updateLeaveRequest(id,patch){patch={...patch,updated_at:new Date().toISOString()};if(USE_SUPABASE){const rows=await sbFetch('PATCH',`/leave_requests?id=eq.${encodeURIComponent(id)}`,patch);return rows?.[0]||null;}const all=readLeaveLocal(LEAVE_REQUESTS_FILE),i=all.findIndex(x=>String(x.id)===String(id));if(i<0)throw new Error('Pengajuan tidak ditemukan');all[i]={...all[i],...patch};writeLeaveLocal(LEAVE_REQUESTS_FILE,all);return all[i];}
async function getLeaveBalances(){return USE_SUPABASE?sbFetch('GET','/leave_balances?order=year.desc'):readLeaveLocal(LEAVE_BALANCES_FILE);}
async function upsertLeaveBalance(data){if(USE_SUPABASE){const rows=await sbFetch('POST','/leave_balances?on_conflict=user_id%2Cyear',data,{'Prefer':'resolution=merge-duplicates,return=representation'});return rows?.[0]||data;}const all=readLeaveLocal(LEAVE_BALANCES_FILE),i=all.findIndex(x=>String(x.user_id)===String(data.user_id)&&Number(x.year)===Number(data.year));const row={id:i>=0?all[i].id:crypto.randomUUID(),...data,updated_at:new Date().toISOString()};if(i>=0)all[i]=row;else all.push(row);writeLeaveLocal(LEAVE_BALANCES_FILE,all);return row;}
async function insertLeaveHistory(data){const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...data};if(USE_SUPABASE){const rows=await sbFetch('POST','/leave_request_history',row);return rows?.[0]||row;}const all=readLeaveLocal(LEAVE_HISTORY_FILE);all.push(row);writeLeaveLocal(LEAVE_HISTORY_FILE,all);return row;}
async function getLeaveHrOptions(){return USE_SUPABASE?sbFetch('GET','/leave_hr_options?order=option_type.asc,sort_order.asc,option_value.asc'):readLeaveLocal(LEAVE_OPTIONS_FILE);}
async function insertLeaveHrOption(data){const row={id:crypto.randomUUID(),is_active:true,sort_order:0,...data,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(USE_SUPABASE){const rows=await sbFetch('POST','/leave_hr_options',row);return rows?.[0]||row;}const all=readLeaveLocal(LEAVE_OPTIONS_FILE);all.push(row);writeLeaveLocal(LEAVE_OPTIONS_FILE,all);return row;}
async function updateLeaveHrOption(id,patch){patch={...patch,updated_at:new Date().toISOString()};if(USE_SUPABASE){const rows=await sbFetch('PATCH',`/leave_hr_options?id=eq.${encodeURIComponent(id)}`,patch);return rows?.[0]||null;}const all=readLeaveLocal(LEAVE_OPTIONS_FILE),i=all.findIndex(x=>String(x.id)===String(id));if(i<0)throw new Error('Pilihan HRD tidak ditemukan');all[i]={...all[i],...patch};writeLeaveLocal(LEAVE_OPTIONS_FILE,all);return all[i];}
async function deleteLeaveHrOption(id){if(USE_SUPABASE){const rows=await sbFetch('DELETE',`/leave_hr_options?id=eq.${encodeURIComponent(id)}`);return rows?.[0]||{id};}const all=readLeaveLocal(LEAVE_OPTIONS_FILE),i=all.findIndex(x=>String(x.id)===String(id));if(i<0)throw new Error('Pilihan HRD tidak ditemukan');const [row]=all.splice(i,1);writeLeaveLocal(LEAVE_OPTIONS_FILE,all);return row;}
async function getLeaveSignatories(){return USE_SUPABASE?sbFetch('GET','/leave_signatory_settings?order=signatory_type.asc'):readLeaveLocal(LEAVE_SIGNATORIES_FILE);}
async function upsertLeaveSignatory(data){if(USE_SUPABASE){const rows=await sbFetch('POST','/leave_signatory_settings',data,{'Prefer':'resolution=merge-duplicates,return=representation'});return rows?.[0]||data;}const all=readLeaveLocal(LEAVE_SIGNATORIES_FILE),i=all.findIndex(x=>x.signatory_type===data.signatory_type);const row={...data,updated_at:new Date().toISOString()};if(i>=0)all[i]=row;else all.push(row);writeLeaveLocal(LEAVE_SIGNATORIES_FILE,all);return row;}

async function getCrmReport(){
  const [customers,sos,wos,mrs,amrs,invoices,projects,visits,tickets]=await Promise.all([
    getCrmCustomers(),getSalesOrders(),getCrmWorkOrders(),getCrmMaterialRequests(),getAdditionalMaterialRequests(),getCrmInvoices(),getProjects(),getSalesVisits(),getTickets(null,true)
  ]);
  const revenue=invoices.reduce((s,x)=>s+Number(x.grand_total||x.total_amount||0),0);
  const pipeline=sos.filter(x=>!['completed','void','cancelled'].includes(x.status)).reduce((s,x)=>s+Number(x.total_amount||0),0);
  return {counts:{customers:customers.length,sales_orders:sos.length,work_orders:wos.length,material_requests:mrs.length,additional_material_requests:amrs.length,invoices:invoices.length,projects:projects.length,visits:visits.length,tickets:tickets.length},revenue,pipeline,customers,sales_orders:sos,work_orders:wos,material_requests:mrs,additional_material_requests:amrs,invoices,projects,visits,tickets};
}


// ─────────────────────────────────────────
//  PXL-URG-0077 — SERVICE CENTER
// ─────────────────────────────────────────
const SERVICE_ORDERS_FILE=path.join(__dirname,'data','service_orders.json');
const SERVICE_HISTORY_FILE=path.join(__dirname,'data','service_status_history.json');
const SERVICE_PHOTOS_FILE=path.join(__dirname,'data','service_photos.json');
function readServiceLocal(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(_){return [];}}
function writeServiceLocal(file,rows){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(rows,null,2));}

async function getServiceOrders(){
  if(USE_SUPABASE) return await sbFetch('GET','/service_orders?order=created_at.desc')||[];
  return readServiceLocal(SERVICE_ORDERS_FILE).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
}
async function getServiceOrder(id){
  if(USE_SUPABASE){const rows=await sbFetch('GET',`/service_orders?id=eq.${encodeURIComponent(id)}&limit=1`);return rows?.[0]||null;}
  return readServiceLocal(SERVICE_ORDERS_FILE).find(x=>String(x.id)===String(id))||null;
}
async function getServiceOrderByToken(token){
  if(USE_SUPABASE){const rows=await sbFetch('GET',`/service_orders?tracking_token=eq.${encodeURIComponent(token)}&limit=1`);return rows?.[0]||null;}
  return readServiceLocal(SERVICE_ORDERS_FILE).find(x=>String(x.tracking_token)===String(token))||null;
}
async function insertServiceOrder(data){
  const now=new Date().toISOString();
  const row={id:crypto.randomUUID(),created_at:now,updated_at:now,is_archived:false,...data};
  if(USE_SUPABASE){const rows=await sbFetch('POST','/service_orders',row);return rows?.[0]||row;}
  const all=readServiceLocal(SERVICE_ORDERS_FILE);all.push(row);writeServiceLocal(SERVICE_ORDERS_FILE,all);return row;
}
async function updateServiceOrder(id,patch){
  const data={...patch,updated_at:new Date().toISOString()};
  if(USE_SUPABASE){const rows=await sbFetch('PATCH',`/service_orders?id=eq.${encodeURIComponent(id)}`,data);return rows?.[0]||null;}
  const all=readServiceLocal(SERVICE_ORDERS_FILE),idx=all.findIndex(x=>String(x.id)===String(id));
  if(idx<0) throw new Error('Service tidak ditemukan.');
  all[idx]={...all[idx],...data};writeServiceLocal(SERVICE_ORDERS_FILE,all);return all[idx];
}
async function getServiceHistory(serviceId,publicOnly=false){
  if(USE_SUPABASE){
    let q=`/service_status_history?service_id=eq.${encodeURIComponent(serviceId)}`;
    if(publicOnly) q+='&customer_visible=eq.true';
    q+='&order=created_at.asc';
    return await sbFetch('GET',q)||[];
  }
  return readServiceLocal(SERVICE_HISTORY_FILE).filter(x=>String(x.service_id)===String(serviceId)&&(!publicOnly||x.customer_visible===true)).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
}
async function insertServiceHistory(data){
  const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),customer_visible:data.customer_visible!==false,...data};
  if(USE_SUPABASE){const rows=await sbFetch('POST','/service_status_history',row);return rows?.[0]||row;}
  const all=readServiceLocal(SERVICE_HISTORY_FILE);all.push(row);writeServiceLocal(SERVICE_HISTORY_FILE,all);return row;
}
async function getServicePhotos(serviceId,publicOnly=false){
  if(USE_SUPABASE){
    let q=`/service_photos?service_id=eq.${encodeURIComponent(serviceId)}&deleted_at=is.null`;
    if(publicOnly) q+='&visible_to_customer=eq.true';
    q+='&order=uploaded_at.asc';
    return await sbFetch('GET',q)||[];
  }
  return readServiceLocal(SERVICE_PHOTOS_FILE).filter(x=>String(x.service_id)===String(serviceId)&&!x.deleted_at&&(!publicOnly||x.visible_to_customer===true)).sort((a,b)=>new Date(a.uploaded_at)-new Date(b.uploaded_at));
}
async function insertServicePhoto(data){
  const now=new Date().toISOString();
  const row={id:crypto.randomUUID(),uploaded_at:now,created_at:now,deleted_at:null,visible_to_customer:data.visible_to_customer!==false,...data};
  if(USE_SUPABASE){const rows=await sbFetch('POST','/service_photos',row);return rows?.[0]||row;}
  const all=readServiceLocal(SERVICE_PHOTOS_FILE);all.push(row);writeServiceLocal(SERVICE_PHOTOS_FILE,all);return row;
}


// ─────────────────────────────────────────
//  PXL-URG-0086 — STANDALONE PACKAGE RECIPE
// ─────────────────────────────────────────
const PACKAGE_RECIPES_FILE=path.join(__dirname,'data','package_recipes.json');
const PACKAGE_ITEMS_FILE=path.join(__dirname,'data','package_recipe_items.json');
const PACKAGE_VERSIONS_FILE=path.join(__dirname,'data','package_recipe_versions.json');
function readPackageLocal(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(_){return [];}}
function writePackageLocal(file,rows){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(rows,null,2));}
function packageSnapshot(recipe,items){return {...recipe,items:Array.isArray(items)?items:[]};}

async function getPackageRecipes(){
  if(USE_SUPABASE){
    const [recipes,items]=await Promise.all([
      sbFetch('GET','/package_recipes?order=updated_at.desc'),
      sbFetch('GET','/package_recipe_items?order=package_id.asc,sort_order.asc')
    ]);
    const byPackage=new Map();
    (items||[]).forEach(item=>{const key=String(item.package_id);if(!byPackage.has(key))byPackage.set(key,[]);byPackage.get(key).push(item);});
    return (recipes||[]).map(row=>({...row,items:byPackage.get(String(row.id))||[]}));
  }
  const recipes=readPackageLocal(PACKAGE_RECIPES_FILE);
  const items=readPackageLocal(PACKAGE_ITEMS_FILE);
  return recipes.sort((a,b)=>new Date(b.updated_at||0)-new Date(a.updated_at||0)).map(row=>({...row,items:items.filter(x=>String(x.package_id)===String(row.id)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))}));
}
async function getPackageRecipe(id){
  if(USE_SUPABASE){
    const [rows,items,versions]=await Promise.all([
      sbFetch('GET',`/package_recipes?id=eq.${encodeURIComponent(id)}&limit=1`),
      sbFetch('GET',`/package_recipe_items?package_id=eq.${encodeURIComponent(id)}&order=sort_order.asc`),
      sbFetch('GET',`/package_recipe_versions?package_id=eq.${encodeURIComponent(id)}&order=revision_no.desc`)
    ]);
    return rows?.[0]?{...rows[0],items:items||[],versions:versions||[]}:null;
  }
  const row=readPackageLocal(PACKAGE_RECIPES_FILE).find(x=>String(x.id)===String(id));
  if(!row)return null;
  const items=readPackageLocal(PACKAGE_ITEMS_FILE).filter(x=>String(x.package_id)===String(id)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const versions=readPackageLocal(PACKAGE_VERSIONS_FILE).filter(x=>String(x.package_id)===String(id)).sort((a,b)=>(b.revision_no||0)-(a.revision_no||0));
  return {...row,items,versions};
}
async function insertPackageVersion(packageId,recipe,items,createdBy){
  if(USE_SUPABASE){
    const versions=await sbFetch('GET',`/package_recipe_versions?package_id=eq.${encodeURIComponent(packageId)}&select=revision_no&order=revision_no.desc&limit=1`)||[];
    const revisionNo=Number(versions?.[0]?.revision_no||0)+1;
    const row={id:crypto.randomUUID(),package_id:packageId,revision_no:revisionNo,snapshot:packageSnapshot(recipe,items),created_by:createdBy||null,created_at:new Date().toISOString()};
    const out=await sbFetch('POST','/package_recipe_versions',row);return out?.[0]||row;
  }
  const all=readPackageLocal(PACKAGE_VERSIONS_FILE);
  const revisionNo=Math.max(0,...all.filter(x=>String(x.package_id)===String(packageId)).map(x=>Number(x.revision_no)||0))+1;
  const row={id:crypto.randomUUID(),package_id:packageId,revision_no:revisionNo,snapshot:packageSnapshot(recipe,items),created_by:createdBy||null,created_at:new Date().toISOString()};
  all.push(row);writePackageLocal(PACKAGE_VERSIONS_FILE,all);return row;
}
async function insertPackageRecipe(data,items=[]){
  const now=new Date().toISOString();
  const row={id:crypto.randomUUID(),created_at:now,updated_at:now,...data};
  let saved=row;
  if(USE_SUPABASE){
    const out=await sbFetch('POST','/package_recipes',row);saved=out?.[0]||row;
    for(let i=0;i<items.length;i++){const item={id:crypto.randomUUID(),package_id:saved.id,sort_order:i,...items[i],created_at:now};await sbFetch('POST','/package_recipe_items',item);}
  }else{
    const recipes=readPackageLocal(PACKAGE_RECIPES_FILE);recipes.push(row);writePackageLocal(PACKAGE_RECIPES_FILE,recipes);
    const allItems=readPackageLocal(PACKAGE_ITEMS_FILE);items.forEach((item,i)=>allItems.push({id:crypto.randomUUID(),package_id:row.id,sort_order:i,...item,created_at:now}));writePackageLocal(PACKAGE_ITEMS_FILE,allItems);
  }
  const full=await getPackageRecipe(saved.id);await insertPackageVersion(saved.id,full||saved,full?.items||items,data.created_by||null);return await getPackageRecipe(saved.id);
}
async function updatePackageRecipe(id,patch,items=[]){
  const now=new Date().toISOString(),data={...patch,updated_at:now};
  if(USE_SUPABASE){
    const out=await sbFetch('PATCH',`/package_recipes?id=eq.${encodeURIComponent(id)}`,data);
    if(!out?.[0])throw new Error('Paket tidak ditemukan.');
    await sbFetch('DELETE',`/package_recipe_items?package_id=eq.${encodeURIComponent(id)}`);
    for(let i=0;i<items.length;i++){const item={id:crypto.randomUUID(),package_id:id,sort_order:i,...items[i],created_at:now};await sbFetch('POST','/package_recipe_items',item);}
  }else{
    const recipes=readPackageLocal(PACKAGE_RECIPES_FILE),idx=recipes.findIndex(x=>String(x.id)===String(id));if(idx<0)throw new Error('Paket tidak ditemukan.');
    recipes[idx]={...recipes[idx],...data};writePackageLocal(PACKAGE_RECIPES_FILE,recipes);
    const old=readPackageLocal(PACKAGE_ITEMS_FILE).filter(x=>String(x.package_id)!==String(id));
    items.forEach((item,i)=>old.push({id:crypto.randomUUID(),package_id:id,sort_order:i,...item,created_at:now}));writePackageLocal(PACKAGE_ITEMS_FILE,old);
  }
  const full=await getPackageRecipe(id);await insertPackageVersion(id,full||data,full?.items||items,patch.updated_by||null);return await getPackageRecipe(id);
}
async function deletePackageRecipe(id){
  if(USE_SUPABASE){const out=await sbFetch('DELETE',`/package_recipes?id=eq.${encodeURIComponent(id)}`);return out?.[0]||{id};}
  const recipes=readPackageLocal(PACKAGE_RECIPES_FILE),idx=recipes.findIndex(x=>String(x.id)===String(id));if(idx<0)throw new Error('Paket tidak ditemukan.');
  const [row]=recipes.splice(idx,1);writePackageLocal(PACKAGE_RECIPES_FILE,recipes);
  writePackageLocal(PACKAGE_ITEMS_FILE,readPackageLocal(PACKAGE_ITEMS_FILE).filter(x=>String(x.package_id)!==String(id)));
  writePackageLocal(PACKAGE_VERSIONS_FILE,readPackageLocal(PACKAGE_VERSIONS_FILE).filter(x=>String(x.package_id)!==String(id)));
  return row;
}


module.exports = {
  USE_SUPABASE,
  getTickets, getArchivedTickets, getTicketByToken,
  insertTicket, updateTicket, deleteTicket,
  getStatusHistory, insertStatusHistory,
  getInvoicesByTicket, getInvoiceV1ByTicket, getTicketRelationsBatch, insertInvoice, deleteInvoice,
  getStandaloneInvoices, insertStandaloneInvoice, deleteStandaloneInvoice,
  insertNotification, getNotificationsForUser, markNotificationRead, markAllNotificationsRead,
  getJobStages, insertJobStage,
  getSalesVisits, insertSalesVisit, updateSalesVisit, deleteSalesVisit,
  computePipelineDates,
  getUsers, getUsersWithPassword, insertUser, updateUser, deleteUser,
  getSalesTargets, upsertSalesTarget, deleteSalesTarget,
  insertLog, getLogs, clearLogs,
  getSuppliers, insertSupplier, updateSupplier, deleteSupplier,
  insertMaterialRequest, getMaterialRequests,
  // MR Form
  getMRForms, insertMRForm, updateMRForm, deleteMRForm,
  getPurchaseRequests, insertPurchaseRequest, updatePurchaseRequest, deletePurchaseRequest,
  getProjects, insertProject, updateProject, deleteProject,
  getProjectReports, upsertProjectReport, getProjectReportAchievements, insertProjectReportAchievement, updateProjectReportAchievement, deleteProjectReportAchievement,
  getProjectReportItems, insertProjectReportItem, updateProjectReportItem, deleteProjectReportItem, getProjectReportItemAchievements, insertProjectReportItemAchievement, updateProjectReportItemAchievement, deleteProjectReportItemAchievement,
  getInventoryCategories, generateInventoryBarcode, findInventoryItemByCode, findInventoryItemByManufacturerBarcode, getInventoryHealth,
  getInventoryItems, getInventoryItem, insertInventoryItem, updateInventoryItem, generateInventorySku, deleteInventoryItem, mergeInventoryDuplicatesBulk,
  restockInventoryBatch, getInventoryTransactions, insertInventoryTransaction,
  getInventoryOpnames, insertInventoryOpname, updateInventoryOpname, insertInventoryOpnameItem, importInventoryCutoff,
  getCrmCustomers, insertCrmCustomer, updateCrmCustomer, deleteCrmCustomer,
  getLeaveRequests, insertLeaveRequest, updateLeaveRequest, getLeaveBalances, upsertLeaveBalance, insertLeaveHistory,
  getLeaveHrOptions, insertLeaveHrOption, updateLeaveHrOption, deleteLeaveHrOption, getLeaveSignatories, upsertLeaveSignatory,
  getSalesOrders, insertSalesOrder, updateSalesOrder, deleteSalesOrder,
  getSalesOrderSiteTemplates, insertSalesOrderSiteTemplate, updateSalesOrderSiteTemplate, deleteSalesOrderSiteTemplate,
  getCrmWorkOrders, insertCrmWorkOrder, updateCrmWorkOrder, deleteCrmWorkOrder,
  getCrmMaterialRequests, insertCrmMaterialRequest, updateCrmMaterialRequest, issueInventoryMaterialRequest,
  getAdditionalMaterialRequests, insertAdditionalMaterialRequest, updateAdditionalMaterialRequest,
  getCrmInvoices, insertCrmInvoice, getCustomerImportStaging, insertCustomerImportStaging, updateCustomerImportStaging, getWhatsappTemplates, insertWhatsappTemplate, getCommunicationHistory, insertCommunicationHistory, getWorkOrderPhotos, insertWorkOrderPhoto, updateWorkOrderPhoto, getCrmReport,
  getServiceOrders, getServiceOrder, getServiceOrderByToken, insertServiceOrder, updateServiceOrder, getServiceHistory, insertServiceHistory, getServicePhotos, insertServicePhoto,
  getPackageRecipes, getPackageRecipe, insertPackageRecipe, updatePackageRecipe, deletePackageRecipe
};
