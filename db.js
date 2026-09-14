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

let itemCache = null;
let itemCacheAt = 0;
let itemPending = null;
let logCache = null;
let logCacheAt = 0;
let logPending = null;

const clone = value => JSON.parse(JSON.stringify(value == null ? [] : value));
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

module.exports = {
  ...core,
  getInventoryItems,
  getInventoryTransactions,
  PXL_URG_0069: {
    revision: 'PXL-URG-0069',
    itemCacheMs: ITEM_CACHE_MS,
    logCacheMs: LOG_CACHE_MS,
    timeoutMs: GET_TIMEOUT_MS
  }
};
