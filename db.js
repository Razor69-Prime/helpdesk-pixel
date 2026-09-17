'use strict';
/* PXL-URG-0069 — Inventory/Supabase stability wrapper.
 * Keeps the full legacy adapter in db-core.js, but replaces the two heaviest
 * Inventory reads with bounded-time, retryable, deduplicated Supabase GETs.
 */
const core = require('./db-core');
const cfg = require('./config');

const fetchImpl = global.fetch || require('node-fetch');
const USE_SUPABASE = !!core.USE_SUPABASE;
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || cfg.SUPABASE_KEY;
const REST_BASE = String(cfg.SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1';
const ITEM_CACHE_MS = 8000;
const LOG_CACHE_MS = 15000;
const GET_TIMEOUT_MS = 7000;
const TICKET_CACHE_MS = 15000;
const TICKET_RELATION_CACHE_MS = 15000;

let itemCache = null;
let itemCacheAt = 0;
let itemPending = null;
let logCache = null;
let logCacheAt = 0;
let logPending = null;
const ticketCache = new Map();
const ticketPending = new Map();
const relationCache = new Map();
const relationPending = new Map();

const clone = value => JSON.parse(JSON.stringify(value == null ? [] : value));
const cloneValue = value => value == null ? value : JSON.parse(JSON.stringify(value));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function headers() {
  return {
    apikey: SUPABASE_SERVER_KEY,
    Authorization: `Bearer ${SUPABASE_SERVER_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
}

async function readSupabase(path, { timeoutMs = GET_TIMEOUT_MS, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(REST_BASE + path, {
        method: 'GET',
        headers: headers(),
        signal: controller.signal
      });
      const raw = await response.text();
      if (!response.ok) {
        const err = new Error(raw || `Supabase HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      lastError = error;
      const retryable = error?.name === 'AbortError' || Number(error?.status || 0) >= 500;
      if (!retryable || attempt >= retries) break;
      await sleep(250 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastError?.name === 'AbortError') {
    const e = new Error(`Supabase read timeout setelah ${GET_TIMEOUT_MS}ms`);
    e.code = 'SUPABASE_READ_TIMEOUT';
    throw e;
  }
  throw lastError;
}

async function getInventoryItems() {
  if (!USE_SUPABASE) return core.getInventoryItems();
  const now = Date.now();
  if (Array.isArray(itemCache) && now - itemCacheAt < ITEM_CACHE_MS) return clone(itemCache);
  if (itemPending) return itemPending.then(clone);

  const select = [
    'id','name','sku','product_number','category','subcategory','unit','tracking_mode',
    'stock','min_stock','barcode','manufacturer_barcode','is_active','created_at','updated_at'
  ].join(',');

  itemPending = readSupabase(`/inventory_items?select=${select}&is_active=is.true&order=name.asc`)
    .then(rows => {
      itemCache = Array.isArray(rows) ? rows : [];
      itemCacheAt = Date.now();
      return itemCache;
    })
    .finally(() => { itemPending = null; });

  return itemPending.then(clone);
}

async function getInventoryTransactions() {
  if (!USE_SUPABASE) return core.getInventoryTransactions();
  const now = Date.now();
  if (Array.isArray(logCache) && now - logCacheAt < LOG_CACHE_MS) return clone(logCache);
  if (logPending) return logPending.then(clone);

  const select = 'id,item_id,transaction_type,qty,balance_after,reference,notes,created_by,created_at,inventory_items(name,unit)';
  logPending = readSupabase(`/inventory_transactions?select=${select}&order=created_at.desc&limit=200`)
    .then(rows => {
      logCache = Array.isArray(rows) ? rows : [];
      logCacheAt = Date.now();
      return logCache;
    })
    .finally(() => { logPending = null; });

  return logPending.then(clone);
}

// PXL-URG-0073 — coalesce repeated ticket bundle reads at the server boundary.
// A single /tickets refresh fans out to tickets + invoices + status_history + job_stages.
// Cache is deliberately short and all related writes invalidate it immediately.
function ticketKey(filterTech, includeArchived) {
  return `${includeArchived ? '1' : '0'}|${String(filterTech || '')}`;
}
function relationKey(ticketIds) {
  return [...new Set((ticketIds || []).filter(Boolean).map(String))].sort().join(',');
}
function invalidateTicketBundleCache() {
  ticketCache.clear();
  relationCache.clear();
}

async function getTickets(filterTech, includeArchived=false) {
  if (!USE_SUPABASE) return core.getTickets(filterTech, includeArchived);
  const key = ticketKey(filterTech, includeArchived);
  const now = Date.now();
  const hit = ticketCache.get(key);
  if (hit && now - hit.at < TICKET_CACHE_MS) return cloneValue(hit.data);
  if (ticketPending.has(key)) return ticketPending.get(key).then(cloneValue);

  const run = Promise.resolve(core.getTickets(filterTech, includeArchived))
    .then(rows => {
      const data = Array.isArray(rows) ? cloneValue(rows) : [];
      ticketCache.set(key, { at: Date.now(), data });
      return data;
    })
    .finally(() => ticketPending.delete(key));
  ticketPending.set(key, run);
  return run.then(cloneValue);
}

async function getTicketRelationsBatch(ticketIds) {
  if (!USE_SUPABASE) return core.getTicketRelationsBatch(ticketIds);
  const key = relationKey(ticketIds);
  if (!key) return { invoices:{}, status_history:{}, job_stages:{} };
  const now = Date.now();
  const hit = relationCache.get(key);
  if (hit && now - hit.at < TICKET_RELATION_CACHE_MS) return cloneValue(hit.data);
  if (relationPending.has(key)) return relationPending.get(key).then(cloneValue);

  const normalizedIds = key.split(',');
  const run = Promise.resolve(core.getTicketRelationsBatch(normalizedIds))
    .then(data => {
      const safe = cloneValue(data || { invoices:{}, status_history:{}, job_stages:{} });
      relationCache.set(key, { at: Date.now(), data: safe });
      return safe;
    })
    .finally(() => relationPending.delete(key));
  relationPending.set(key, run);
  return run.then(cloneValue);
}

function wrapTicketWrite(name) {
  const fn = core[name];
  if (typeof fn !== 'function') return undefined;
  return async function(){
    invalidateTicketBundleCache();
    try { return await fn.apply(core, arguments); }
    finally { invalidateTicketBundleCache(); }
  };
}

const insertTicket = wrapTicketWrite('insertTicket');
const updateTicket = wrapTicketWrite('updateTicket');
const deleteTicket = wrapTicketWrite('deleteTicket');
const insertStatusHistory = wrapTicketWrite('insertStatusHistory');
const insertInvoice = wrapTicketWrite('insertInvoice');
const deleteInvoice = wrapTicketWrite('deleteInvoice');
const insertJobStage = wrapTicketWrite('insertJobStage');

// PXL-URG-0070 — production sales_orders schema does not contain
// cancelled_by/cancelled_at. Keep cancellation audit in history and use the
// existing void_reason column when a note is supplied.
async function updateSalesOrder(id, data) {
  const patch = { ...(data || {}) };
  const hadLegacyCancelFields = Object.prototype.hasOwnProperty.call(patch, 'cancelled_by') ||
    Object.prototype.hasOwnProperty.call(patch, 'cancelled_at');

  if (hadLegacyCancelFields) {
    delete patch.cancelled_by;
    delete patch.cancelled_at;

    if ((patch.status === 'cancelled' || patch.status === 'void') && !patch.void_reason) {
      const history = Array.isArray(patch.history) ? patch.history : [];
      const last = history.length ? history[history.length - 1] : null;
      if (last?.note) patch.void_reason = String(last.note);
    }
  }

  return core.updateSalesOrder(id, patch);
}

module.exports = {
  ...core,
  getInventoryItems,
  getInventoryTransactions,
  getTickets,
  getTicketRelationsBatch,
  ...(insertTicket ? { insertTicket } : {}),
  ...(updateTicket ? { updateTicket } : {}),
  ...(deleteTicket ? { deleteTicket } : {}),
  ...(insertStatusHistory ? { insertStatusHistory } : {}),
  ...(insertInvoice ? { insertInvoice } : {}),
  ...(deleteInvoice ? { deleteInvoice } : {}),
  ...(insertJobStage ? { insertJobStage } : {}),
  updateSalesOrder,
  PXL_URG_0069: {
    revision: 'PXL-URG-0069',
    itemCacheMs: ITEM_CACHE_MS,
    logCacheMs: LOG_CACHE_MS,
    timeoutMs: GET_TIMEOUT_MS
  },
  PXL_URG_0070: {
    revision: 'PXL-URG-0070',
    fix: 'sales-order-cancel-schema-mismatch'
  },
  PXL_URG_0073: {
    revision: 'PXL-URG-0073',
    ticketCacheMs: TICKET_CACHE_MS,
    ticketRelationCacheMs: TICKET_RELATION_CACHE_MS,
    invalidateTicketBundleCache,
    ticketCacheSize: () => ticketCache.size,
    relationCacheSize: () => relationCache.size
  }
};
