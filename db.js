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
  const rows = await sbFetch('GET', `/inventory_items?or=(barcode.eq.${q},sku.eq.${q},product_number.eq.${q})&is_active=is.true&limit=1`);
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

// ─────────────────────────────────────────
// CRM / SALES ORDER / WO / INVOICE FLOW
// PXL-REV-0039
// ─────────────────────────────────────────
const CRM_FILES = {
  customers: path.join(__dirname,'data','crm_customers.json'),
  sales_orders: path.join(__dirname,'data','sales_orders.json'),
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
async function getCrmWorkOrders(){return listEntity('crm_work_orders','work_orders')}
async function insertCrmWorkOrder(data){
  const rows=await getCrmWorkOrders();
  const wo_number=data.number_source==='manual'?String(data.wo_number||'').trim():nextDocNo('WO',rows,'wo_number');
  if(!wo_number) throw new Error('Nomor WO manual wajib diisi');
  if(rows.some(x=>String(x.wo_number).toLowerCase()===wo_number.toLowerCase())) throw new Error('Nomor WO sudah digunakan');
  return insertEntity('crm_work_orders','work_orders',{...data,wo_number,status:data.status||'draft'});
}
async function updateCrmWorkOrder(id,data){return updateEntity('crm_work_orders','work_orders',id,data)}
async function getCrmMaterialRequests(){return listEntity('crm_material_requests','crm_material_requests')}
async function insertCrmMaterialRequest(data){
  const rows=await getCrmMaterialRequests();
  return insertEntity('crm_material_requests','crm_material_requests',{...data,mr_number:nextDocNo('MR',rows,'mr_number'),status:'waiting_technician_verification'});
}
async function updateCrmMaterialRequest(id,data){return updateEntity('crm_material_requests','crm_material_requests',id,data)}
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

async function getCrmReport(){
  const [customers,sos,wos,mrs,amrs,invoices,projects,visits,tickets]=await Promise.all([
    getCrmCustomers(),getSalesOrders(),getCrmWorkOrders(),getCrmMaterialRequests(),getAdditionalMaterialRequests(),getCrmInvoices(),getProjects(),getSalesVisits(),getTickets(null,true)
  ]);
  const revenue=invoices.reduce((s,x)=>s+Number(x.grand_total||x.total_amount||0),0);
  const pipeline=sos.filter(x=>!['completed','void','cancelled'].includes(x.status)).reduce((s,x)=>s+Number(x.total_amount||0),0);
  return {counts:{customers:customers.length,sales_orders:sos.length,work_orders:wos.length,material_requests:mrs.length,additional_material_requests:amrs.length,invoices:invoices.length,projects:projects.length,visits:visits.length,tickets:tickets.length},revenue,pipeline,customers,sales_orders:sos,work_orders:wos,material_requests:mrs,additional_material_requests:amrs,invoices,projects,visits,tickets};
}

module.exports = {
  USE_SUPABASE,
  getTickets, getArchivedTickets, getTicketByToken,
  insertTicket, updateTicket, deleteTicket,
  getStatusHistory, insertStatusHistory,
  getInvoicesByTicket, insertInvoice, deleteInvoice,
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
  getInventoryCategories, generateInventoryBarcode, findInventoryItemByCode, getInventoryHealth,
  getInventoryItems, getInventoryItem, insertInventoryItem, updateInventoryItem, generateInventorySku, deleteInventoryItem,
  restockInventoryBatch, getInventoryTransactions, insertInventoryTransaction,
  getInventoryOpnames, insertInventoryOpname, updateInventoryOpname, insertInventoryOpnameItem, importInventoryCutoff,
  getCrmCustomers, insertCrmCustomer, updateCrmCustomer, deleteCrmCustomer,
  getSalesOrders, insertSalesOrder, updateSalesOrder,
  getCrmWorkOrders, insertCrmWorkOrder, updateCrmWorkOrder,
  getCrmMaterialRequests, insertCrmMaterialRequest, updateCrmMaterialRequest,
  getAdditionalMaterialRequests, insertAdditionalMaterialRequest, updateAdditionalMaterialRequest,
  getCrmInvoices, insertCrmInvoice, getCustomerImportStaging, insertCustomerImportStaging, updateCustomerImportStaging, getWhatsappTemplates, insertWhatsappTemplate, getCommunicationHistory, insertCommunicationHistory, getWorkOrderPhotos, insertWorkOrderPhoto, updateWorkOrderPhoto, getCrmReport
};
