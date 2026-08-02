'use strict';

/** PXL-STG-0007F — sumber teknisi aktif untuk kapasitas Kanban. */
const express = require('express');
const originalGet = express.application.get;
const originalUse = express.application.use;
const norm = value => String(value == null ? '' : value).trim().toLowerCase();

async function readUsers() {
  const db = require('./db');
  const candidates = ['getUsers', 'getAllUsers', 'listUsers'];
  for (const name of candidates) {
    if (typeof db[name] !== 'function') continue;
    try {
      const rows = await db[name]();
      if (Array.isArray(rows)) return rows;
    } catch (_) {}
  }
  return [];
}

function isActive(user) {
  if (user == null) return false;
  if (user.is_active === false || user.active === false || user.disabled === true) return false;
  const status = norm(user.status);
  return !['inactive', 'nonaktif', 'disabled', 'blocked'].includes(status);
}

async function techniciansRoute(req, res) {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await readUsers();
    const technicians = rows
      .filter(isActive)
      .filter(user => ['technician', 'teknisi'].includes(norm(user.role)))
      .map(user => ({
        id: user.id,
        name: user.name || user.full_name || user.username || user.email || String(user.id),
        username: user.username || null,
        email: user.email || null
      }))
      .filter(user => user.id || user.name);
    return res.json({ source: 'PXL-STG-0007F', technicians });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
}

function register(app) {
  if (app.__pxlStg0007FRoute) return;
  app.__pxlStg0007FRoute = true;
  originalGet.call(app, '/api/technician-kanban/active-technicians', techniciansRoute);
}

express.application.use = function pxlStg0007FUse(...args) {
  const result = originalUse.apply(this, args);
  if (!this.__pxlStg0007FRoute) {
    const source = args
      .filter(value => typeof value === 'function')
      .map(value => Function.prototype.toString.call(value))
      .join('\n');
    if (source.includes('req.session') && source.includes('_setUser')) register(this);
  }
  return result;
};
