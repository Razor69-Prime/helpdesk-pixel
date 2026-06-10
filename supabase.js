const fetch   = require('node-fetch');
const { SUPABASE_URL, SUPABASE_KEY } = require('./config');

const BASE = `${SUPABASE_URL}/rest/v1`;

const hdrs = (extra = {}) => ({
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation',
  ...extra
});

// ── Generic helpers ──────────────────────────────────────

async function sbFetch(method, path, body) {
  const opts = { method, headers: hdrs() };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Supabase ${method} ${path}: ${err}`);
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// ── Tickets ──────────────────────────────────────────────

async function getTickets(filterTechnician = null) {
  let path = '/tickets?order=worked_at.desc';
  if (filterTechnician) {
    path += `&technician=eq.${encodeURIComponent(filterTechnician)}`;
  }
  return sbFetch('GET', path);
}

async function getTicketByToken(token) {
  const rows = await sbFetch('GET', `/tickets?tracking_token=eq.${token}&limit=1`);
  return rows && rows.length ? rows[0] : null;
}

async function insertTicket(data) {
  const rows = await sbFetch('POST', '/tickets', data);
  return rows && rows.length ? rows[0] : null;
}

async function updateTicket(id, data) {
  const rows = await sbFetch('PATCH', `/tickets?id=eq.${id}`, data);
  return rows && rows.length ? rows[0] : null;
}

async function deleteTicket(id) {
  return sbFetch('DELETE', `/tickets?id=eq.${id}`);
}

// ── Invoices ─────────────────────────────────────────────

async function getInvoicesByTicket(ticketId) {
  return sbFetch('GET', `/invoices?ticket_id=eq.${ticketId}&order=uploaded_at.desc`);
}

async function getAllInvoices() {
  return sbFetch('GET', '/invoices?order=uploaded_at.desc');
}

async function insertInvoice(data) {
  const rows = await sbFetch('POST', '/invoices', data);
  return rows && rows.length ? rows[0] : null;
}

async function deleteInvoice(id) {
  return sbFetch('DELETE', `/invoices?id=eq.${id}`);
}

// ── Status History ────────────────────────────────────────

async function getStatusHistory(ticketId) {
  return sbFetch('GET', `/status_history?ticket_id=eq.${ticketId}&order=timestamp.desc`);
}

async function insertStatusHistory(data) {
  const rows = await sbFetch('POST', '/status_history', data);
  return rows && rows.length ? rows[0] : null;
}

module.exports = {
  getTickets, getTicketByToken, insertTicket, updateTicket, deleteTicket,
  getInvoicesByTicket, getAllInvoices, insertInvoice, deleteInvoice,
  getStatusHistory, insertStatusHistory
};
