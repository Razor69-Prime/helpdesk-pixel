'use strict';

/** PXL-STG-0007O — sinkronisasi jadwal Rev007 dengan waktu existing Daftar Tiket. */
const db = require('./db');
const originalGetTickets = db.getTickets;
const originalUpdateTicket = db.updateTicket;

function validDate(value) {
  const s = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function validTime(value) {
  const s = String(value || '').slice(11, 16) || String(value || '').slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}
function applyExistingTime(ticket) {
  if (!ticket || !ticket.worked_at) return ticket;
  const date = validDate(ticket.worked_at);
  const time = validTime(ticket.worked_at);
  return {
    ...ticket,
    scheduled_date: date || ticket.scheduled_date,
    scheduled_start_time: time || ticket.scheduled_start_time
  };
}

if (typeof originalGetTickets === 'function' && !db.__pxl0007oGetPatched) {
  db.__pxl0007oGetPatched = true;
  db.getTickets = async function pxl0007oGetTickets(...args) {
    const rows = await originalGetTickets.apply(this, args);
    return Array.isArray(rows) ? rows.map(applyExistingTime) : rows;
  };
}

if (typeof originalUpdateTicket === 'function' && !db.__pxl0007oUpdatePatched) {
  db.__pxl0007oUpdatePatched = true;
  db.updateTicket = async function pxl0007oUpdateTicket(id, patch = {}, ...rest) {
    const next = { ...patch };
    if (next.scheduled_date && next.scheduled_start_time) {
      const time = String(next.scheduled_start_time).slice(0, 5);
      next.worked_at = `${next.scheduled_date}T${time}:00`;
    } else if (next.worked_at) {
      next.scheduled_date = validDate(next.worked_at) || next.scheduled_date;
      next.scheduled_start_time = validTime(next.worked_at) || next.scheduled_start_time;
    }
    return originalUpdateTicket.call(this, id, next, ...rest);
  };
}
