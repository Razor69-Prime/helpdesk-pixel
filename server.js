const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const ExcelJS  = require('exceljs');
const JSZip    = require('jszip');
const cfg      = require('./config');
const db       = require('./db');
const reportSvc = require('./report-service');

// PXL-STG-0001 — staging safety guard.
// Guard hanya aktif bila APP_ENV=staging, sehingga source tetap aman saat nanti di-merge ke production.
const APP_ENV = String(process.env.APP_ENV || '').trim().toLowerCase();
const IS_STAGING = APP_ENV === 'staging';
const STAGING_SUPABASE_PROJECT_REF = String(process.env.STAGING_SUPABASE_PROJECT_REF || '').trim();
const PRODUCTION_SUPABASE_PROJECT_REF = 'chgcictuycjeqdxfrnej';

if (IS_STAGING) {
  const configuredSupabaseUrl = String(cfg.SUPABASE_URL || '').trim();
  if (!STAGING_SUPABASE_PROJECT_REF) {
    throw new Error('PXL-STG-0001: STAGING_SUPABASE_PROJECT_REF wajib diisi pada Vercel staging.');
  }
  if (!configuredSupabaseUrl || !configuredSupabaseUrl.includes(STAGING_SUPABASE_PROJECT_REF)) {
    throw new Error('PXL-STG-0001: Supabase URL staging tidak cocok dengan project reference yang diizinkan.');
  }
  if (configuredSupabaseUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF)) {
    throw new Error('PXL-STG-0001: Staging dilarang terhubung ke Supabase production.');
  }
}

const app  = express();
const PORT = cfg.PORT;
const UPLOADS_DIR  = path.join(__dirname, 'data', 'uploads');
const USERS_FILE   = path.join(__dirname, 'data', 'users.json');
const TICKETS_FILE = path.join(__dirname, 'data', 'tickets.json');

// PXL-REV-0052 — Cloudinary signed upload helpers
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
function cloudinaryReady(){ return !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET); }
function safeDocPart(value){ return String(value||'WO').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'WO'; }
function cloudinarySignature(params){
  const raw=Object.keys(params).sort().map(k=>`${k}=${params[k]}`).join('&')+CLOUDINARY_API_SECRET;
  return crypto.createHash('sha1').update(raw).digest('hex');
}


// ensure dirs & files — hanya di mode lokal
if (!db.USE_SUPABASE) {
  [path.join(__dirname,'data'), UPLOADS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
  if (!fs.existsSync(TICKETS_FILE)) fs.writeFileSync(TICKETS_FILE, '[]');
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([
      { id:'u1', username:'admin',    password:'admin888', name:'Admin',    role:'admin'      },
      { id:'u2', username:'akunting', password:'akun2024', name:'Akunting', role:'accounting' }
    ], null, 2));
  }
}

// ── User helpers ──
function readUsers() {
  if (db.USE_SUPABASE) return []; // Supabase: gunakan async getUsers()
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}
function writeUsers(data) {
  if (db.USE_SUPABASE) return; // Supabase: gunakan async updateUser()
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// ── Multer — memory storage untuk Supabase, disk untuk lokal ──
const storage = db.USE_SUPABASE
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_,__,cb) => cb(null, UPLOADS_DIR),
      filename:    (_,file,cb) => cb(null, crypto.randomBytes(10).toString('hex') + path.extname(file.originalname).toLowerCase())
    });
const upload = multer({
  storage,
  limits: { fileSize: 10*1024*1024 },
  fileFilter: (_,file,cb) => {
    ['.jpg','.jpeg','.png','.pdf'].includes(path.extname(file.originalname).toLowerCase())
      ? cb(null,true) : cb(new Error('Format tidak didukung.'));
  }
});


// PXL-REV-0050 — upload khusus workbook Inventory.
// ExcelJS membaca .xlsx; file lama .xls perlu disimpan ulang sebagai .xlsx.
const inventoryExcelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.xlsx') return cb(null, true);
    cb(new Error('File Inventory harus berformat .xlsx. Untuk file .xls, buka lalu Save As menjadi .xlsx.'));
  }
});

const jwt = require('jsonwebtoken');
const JWT_SECRET = cfg.SESSION_SECRET;

// ── JWT Session Middleware ──
// Token dikirim via Authorization header dari frontend (localStorage)
// Bekerja sempurna di Vercel serverless tanpa cookie issue
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Header dan endpoint identitas environment dipakai UI untuk menampilkan penanda STAGING.
app.use((req, res, next) => {
  res.setHeader('X-PXL-Environment', IS_STAGING ? 'staging' : 'production');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (req.path.startsWith('/api/')) {res.setHeader('Cache-Control', 'no-store, max-age=0');res.setHeader('Pragma', 'no-cache');}
  next();
});
app.get('/api/environment', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json({
    environment: IS_STAGING ? 'staging' : 'production',
    staging: IS_STAGING,
    project_ref: IS_STAGING ? STAGING_SUPABASE_PROJECT_REF : null
  });
});

// PXL-STG-0002 — marker data sampling hanya boleh digunakan di staging.
const STAGING_DEMO_MARKER = 'STG-DEMO';
function containsStagingDemoMarker(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.toUpperCase().includes(STAGING_DEMO_MARKER);
  try { return JSON.stringify(value).toUpperCase().includes(STAGING_DEMO_MARKER); }
  catch (_) { return false; }
}
function blockStagingDemoOnProduction(req, res, next) {
  if (!IS_STAGING && containsStagingDemoMarker(req.body)) {
    return res.status(403).json({ error: 'Data STG-DEMO dilarang dibuat pada server production.' });
  }
  next();
}

app.use((req, res, next) => {
  req.session = { user: null };
  req.session.destroy = (cb) => {
    req.session.user = null;
    if (cb) cb();
  };
  req.session._setUser = (user) => {
    req.session.user = user;
  };

  // Baca token dari Authorization header atau query param
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.headers['x-auth-token'] || '';

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.session.user = decoded.user;
    } catch(e) {
      // token invalid/expired — biarkan null
    }
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Pastikan manifest.json di-serve dengan Content-Type yang benar (penting untuk PWA install Android)
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// Pastikan icon PNG di-serve dengan Content-Type yang benar
app.get('/icons/:file', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'public', 'icons', req.params.file));
});

// ── Auth middleware ──
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    // superadmin selalu lolos semua role check
    if (req.session.user.role === 'superadmin') return next();
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'Akses ditolak.' });
    next();
  };
}

// PXL-REV-0048: proteksi backend untuk modul sensitif per divisi.
function denyRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.session.user.role === 'superadmin') return next();
    if (roles.includes(req.session.user.role)) return res.status(403).json({ error: 'Akses modul tidak tersedia untuk divisi Anda.' });
    next();
  };
}
const CRM_READ_ROLES=['sales','admin','manager','accounting','superadmin'];
const SO_READ_ROLES=['sales','admin','manager','accounting','superadmin'];
const INVOICE_READ_ROLES=['accounting','admin','manager','superadmin'];

function trackExpiry(t) { return new Date(new Date(t.created_at).getTime() + cfg.TRACK_DAYS * 864e5); }
function isExpired(t)   { return new Date() > trackExpiry(t); }

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
app.post('/api/login', async (req, res) => {
  try {
    let u;
    if (db.USE_SUPABASE) {
      const users = await db.getUsersWithPassword();
      u = users.find(u => u.username === req.body.username && u.password === req.body.password);
    } else {
      const users = readUsers();
      u = users.find(u => u.username === req.body.username && u.password === req.body.password);
    }
    if (!u) return res.status(401).json({ error: 'Username atau password salah.' });
    if (u.is_active === false) return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan. Hubungi admin untuk informasi lebih lanjut.' });
    const userData = {
      id:            u.id,
      username:      u.username,
      name:          u.name,
      role:          u.role,
      custom_menus:  Array.isArray(u.custom_menus) ? u.custom_menus : [],
      custom_menus_override: u.custom_menus_override === true,
      pr_roles:      Array.isArray(u.pr_roles) ? u.pr_roles : [],
      extra_roles:   Array.isArray(u.extra_roles) ? u.extra_roles : [],
      allow_invoice_no_wo: u.allow_invoice_no_wo === true,
      // signature_url TIDAK disimpan di JWT (terlalu besar → HTTP 494)
    };
    req.session._setUser(userData);
    logActivity(req, 'auth', 'LOGIN', `${userData.name} (${userData.role}) login berhasil`);
    const token = jwt.sign({ user: userData }, JWT_SECRET, { expiresIn: '8h' });
    // Kirim signature_url terpisah di response (tidak masuk JWT)
    res.json({ ok: true, user: { ...userData, signature_url: u.signature_url||null }, token });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', (req, res) => {
  logActivity(req, 'auth', 'LOGOUT', req.session?.user?.name ? `${req.session.user.name} logout` : '');
  req.session.destroy();
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => {
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, private');
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: req.session.user });
});

// ══════════════════════════════════════════
//  USER MANAGEMENT
// ══════════════════════════════════════════

app.get('/api/users', requireRole('admin','superadmin'), async (req, res) => {
  try {
    if (db.USE_SUPABASE) {
      const users = await db.getUsers();
      // Exclude signature_url dari list (besar, tidak perlu di list)
      return res.json(users.map(({ signature_url: _, ...u }) => u));
    }
    res.json(readUsers().map(({ password: _, ...u }) => u));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Endpoint khusus ambil signature satu user (untuk PDF export)
app.get('/api/users/:id/signature', requireAuth, async (req, res) => {
  try {
    const users = await db.getUsers();
    const u = users.find(u => u.id === req.params.id || u.name === req.params.id);
    res.json({ signature_url: u?.signature_url || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', requireRole('admin','superadmin'), async (req, res) => {
  try {
    const { username, password, name, role, custom_menus } = req.body;
    if (!username || !password || !name || !role)
      return res.status(400).json({ error: 'Semua field wajib diisi.' });
    if (db.USE_SUPABASE) {
      const existing = await db.getUsersWithPassword();
      if (existing.find(u => u.username === username))
        return res.status(409).json({ error: 'Username sudah digunakan.' });
      const saved = await db.insertUser({ username, password, name, role, custom_menus: custom_menus||[], is_active: true });
      return res.status(201).json(saved);
    }
    const users = readUsers();
    if (users.find(u => u.username === username))
      return res.status(409).json({ error: 'Username sudah digunakan.' });
    const newUser = { id: crypto.randomUUID(), username, password, name, role, custom_menus: custom_menus||[], is_active: true };
    users.push(newUser);
    writeUsers(users);
    const { password: _, ...safe } = newUser;
    logActivity(req, 'users', 'TAMBAH USER', `Username: ${username} · Role: ${role}`);
    res.status(201).json(safe);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/:id', requireRole('admin','superadmin'), async (req, res) => {
  try {
    const callerRole = req.session.user.role;
    let targetUser;
    if (db.USE_SUPABASE) {
      const all = await db.getUsersWithPassword();
      targetUser = all.find(u => u.id === req.params.id);
    } else {
      targetUser = readUsers().find(u => u.id === req.params.id);
    }
    if (!targetUser) return res.status(404).json({ error: 'User tidak ditemukan.' });
    if (targetUser.role === 'superadmin' && callerRole !== 'superadmin')
      return res.status(403).json({ error: 'Hanya Super Admin yang bisa mengubah akun Super Admin.' });
    if (req.body.role === 'superadmin' && callerRole !== 'superadmin')
      return res.status(403).json({ error: 'Hanya Super Admin yang bisa assign role Super Admin.' });
    if (req.session.user.id === req.params.id && req.body.role && req.body.role !== callerRole)
      return res.status(400).json({ error: 'Tidak bisa mengubah role akun Anda sendiri.' });
    if (req.session.user.id === req.params.id && req.body.is_active === false)
      return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun Anda sendiri.' });

    // Validasi & cek duplikat username jika diubah
    if (req.body.username && req.body.username !== targetUser.username) {
      const allUsersList = db.USE_SUPABASE ? await db.getUsersWithPassword() : readUsers();
      const clash = allUsersList.find(u => u.username === req.body.username && u.id !== req.params.id);
      if (clash) return res.status(409).json({ error: 'Username sudah digunakan oleh akun lain.' });
    }

    const { username, name, password, role, custom_menus, custom_menus_override, signature_url, pr_roles, extra_roles, allow_invoice_no_wo, is_active } = req.body;
    const patch = {};
    if (username)                     patch.username      = username;
    if (name)                         patch.name          = name;
    if (password)                     patch.password      = password;
    if (role)                         patch.role          = role;
    if (custom_menus !== undefined)   patch.custom_menus  = custom_menus;
    if (custom_menus_override !== undefined) patch.custom_menus_override = custom_menus_override === true;
    if (signature_url !== undefined)  patch.signature_url = signature_url;
    if (pr_roles !== undefined)       patch.pr_roles      = pr_roles;
    if (extra_roles !== undefined)    patch.extra_roles   = extra_roles;
    if (allow_invoice_no_wo !== undefined) patch.allow_invoice_no_wo = allow_invoice_no_wo;
    if (is_active !== undefined)      patch.is_active     = is_active;

    if (db.USE_SUPABASE) {
      const updated = await db.updateUser(req.params.id, patch);
      return res.json(updated);
    }
    const users = readUsers();
    const idx = users.findIndex(u => u.id === req.params.id);
    Object.assign(users[idx], patch);
    writeUsers(users);
    const { password: _, ...safe } = users[idx];
    res.json(safe);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', requireRole('admin','superadmin'), async (req, res) => {
  try {
    if (req.session.user.id === req.params.id)
      return res.status(400).json({ error: 'Tidak bisa menghapus akun Anda sendiri.' });
    let target;
    if (db.USE_SUPABASE) {
      const all = await db.getUsersWithPassword();
      target = all.find(u => u.id === req.params.id);
    } else {
      target = readUsers().find(u => u.id === req.params.id);
    }
    if (!target) return res.status(404).json({ error: 'User tidak ditemukan.' });
    if (target.role === 'superadmin' && req.session.user.role !== 'superadmin')
      return res.status(403).json({ error: 'Hanya Super Admin yang bisa menghapus akun Super Admin.' });
    if (db.USE_SUPABASE) {
      await db.deleteUser(req.params.id);
    } else {
      writeUsers(readUsers().filter(u => u.id !== req.params.id));
    }
    logActivity(req, 'users', 'HAPUS USER', `User ID: ${req.params.id} · Nama: ${target.name}`);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET daftar Sales PIC ──
app.get('/api/sales-pics', requireAuth, async (req, res) => {
  try {
    let users;
    if (db.USE_SUPABASE) users = await db.getUsersWithPassword();
    else users = readUsers();
    const sales = users.filter(u =>
      (u.role === 'sales' || (Array.isArray(u.extra_roles) && u.extra_roles.includes('sales')))
      && u.is_active !== false
    ).map(({ password: _, ...u }) => u);
    res.json(sales);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Endpoint publik daftar teknisi aktif — dipakai untuk dropdown assign teknisi
// oleh role yang tidak punya akses penuh ke /api/users (mis. operator)
app.get('/api/technician-pics', requireAuth, async (req, res) => {
  try {
    let users;
    if (db.USE_SUPABASE) users = await db.getUsersWithPassword();
    else users = readUsers();
    const techs = users.filter(u =>
      (u.role === 'technician' || (Array.isArray(u.extra_roles) && u.extra_roles.includes('technician')))
      && u.is_active !== false
    ).map(({ password: _, ...u }) => u);
    res.json(techs);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET dashboard data (manager + admin) ──
app.get('/api/dashboard', requireRole('manager','admin'), async (req, res) => {
  try {
    // Gabungkan aktif + arsip agar semua data masuk ke report/dashboard
    const [active, archived] = await Promise.all([
      db.getTickets(null, false),
      db.getArchivedTickets()
    ]);
    const all = [...active, ...archived];
    const enriched = await Promise.all(all.map(async t => {
      const invoices = await db.getInvoicesByTicket(t.id);
      return { ...t, invoices: invoices || [] };
    }));
    res.json(enriched);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════
//  SALES TARGETS (admin only)
// ══════════════════════════════════════════

// GET semua targets
app.get('/api/sales-targets', requireRole('admin','manager','superadmin'), async (req, res) => {
  try {
    res.json(await db.getSalesTargets());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST tambah/update target — { sales_pic, year_month (YYYY-MM), target_amount }
app.post('/api/sales-targets', requireRole('admin','superadmin','manager'), async (req, res) => {
  try {
    const { sales_pic, year_month, target_amount } = req.body;
    if (!sales_pic || !year_month || target_amount == null) {
      return res.status(400).json({ error: 'sales_pic, year_month, dan target_amount wajib diisi.' });
    }
    const entry = await db.upsertSalesTarget({
      sales_pic, year_month, target_amount,
      updated_by: req.session.user.name
    });
    res.status(201).json(entry);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE target
app.delete('/api/sales-targets/:id', requireRole('admin','superadmin','manager'), async (req, res) => {
  try {
    await db.deleteSalesTarget(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  TICKETS
// ══════════════════════════════════════════
app.get('/api/tickets', requireAuth, async (req, res) => {
  const startedAt = Date.now();
  try {
    const role   = req.session.user.role;
    // teknisi hanya lihat tiket yang di-assign ke dirinya
    const filter = role === 'technician' ? req.session.user.name : null; // superadmin: null (lihat semua)
    const tickets = await db.getTickets(filter);
    const relations = await db.getTicketRelationsBatch(tickets.map(t => t.id));
    const enriched = tickets.map(t => {
      const id = String(t.id);
      return {
        ...t,
        invoices: relations.invoices[id] || [],
        status_history: relations.status_history[id] || [],
        job_stages: relations.job_stages[id] || []
      };
    });
    res.set('Server-Timing', `tickets;dur=${Date.now()-startedAt}`);
    res.json(enriched);
  } catch(e) {
    console.error(`[PXL-REV-0056] GET /api/tickets gagal setelah ${Date.now()-startedAt}ms`, e);
    res.status(500).json({ error: e.message });
  }
});

// PXL-STG-0009A10 — validasi cuti approved juga berlaku untuk assign dari halaman Laporan/WO.
const leaveDateOnly = value => {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const leaveKey = value => String(value ?? '').trim().toLowerCase();
const leaveTechniciansFromBody = body => {
  const source = body || {};
  const values = [];
  const add = value => {
    if (Array.isArray(value)) value.forEach(add);
    else if (value && typeof value === 'object') values.push(value.id || value.user_id || value.technician_id || value.name || value.username);
    else if (value != null && String(value).trim()) values.push(value);
  };
  add(source.technicians);
  add(source.technician);
  add(source.assigned_to);
  add(source.assigned_to2);
  add(source.technician_1);
  add(source.technician_2);
  return [...new Map(values.filter(Boolean).map(value => [leaveKey(value), value])).values()].slice(0, 2);
};
const leaveDayBefore = value => {
  const date = leaveDateOnly(value); if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`); parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
};
const leaveEffectiveEnd = row => {
  const end = leaveDateOnly(row?.end_date), beforeReturn = leaveDayBefore(row?.return_date);
  return beforeReturn && (!end || beforeReturn > end) ? beforeReturn : end;
};
async function approvedLeaveConflicts(technicians, workDate) {
  if (!workDate || !Array.isArray(technicians) || !technicians.length || typeof db.getLeaveRequests !== 'function') return [];
  const keys = new Set(technicians.flatMap(value => value && typeof value === 'object'
    ? [value.id, value.user_id, value.technician_id, value.name, value.full_name, value.username]
    : [value]).map(leaveKey).filter(Boolean));
  if (typeof db.getUsers === 'function') {
    const allUsers = await db.getUsers();
    for (const account of Array.isArray(allUsers) ? allUsers : []) {
      const aliases = [account.id, account.user_id, account.name, account.full_name, account.username].map(leaveKey).filter(Boolean);
      if (aliases.some(alias => keys.has(alias))) aliases.forEach(alias => keys.add(alias));
    }
  }
  const requests = await db.getLeaveRequests();
  return (Array.isArray(requests) ? requests : []).filter(row => {
    const start = leaveDateOnly(row.start_date), end = leaveEffectiveEnd(row);
    return leaveKey(row.status) === 'approved' && start && end && workDate >= start && workDate <= end &&
      [row.applicant_user_id, row.applicant_name, row.created_by_id, row.created_by].map(leaveKey).some(key => keys.has(key));
  });
}
function sendLeaveAssignmentConflict(res, conflicts, workDate, canForce) {
  const rows = [...new Map(conflicts.map(row => [String(row.id), row])).values()];
  const names = [...new Set(rows.map(row => row.applicant_name).filter(Boolean))];
  return res.status(409).json({
    error: `Teknisi ${names.join(', ')} sedang cuti pada ${workDate}. Assignment diblokir.`,
    code: 'TECHNICIAN_ON_APPROVED_LEAVE', can_force: Boolean(canForce), scheduled_date: workDate,
    conflicts: rows.map(row => ({
      request_id: row.id, request_number: row.request_number || null,
      user_id: row.applicant_user_id || null, technician: row.applicant_name || null,
      start_date: leaveDateOnly(row.start_date), end_date: leaveEffectiveEnd(row),
      requested_end_date: leaveDateOnly(row.end_date), return_date: leaveDateOnly(row.return_date), leave_type: row.leave_type || null
    }))
  });
}

app.post('/api/tickets', requireRole('technician','admin','superadmin','manager','operator','sales'), blockStagingDemoOnProduction, async (req, res) => {
  try {
    const now   = new Date().toISOString();
    const token = crypto.randomBytes(14).toString('hex');
    const role  = req.session.user.role;

    // Build technicians array (max 2)
    let technicians = [];
    if (['admin','superadmin','manager','operator','sales'].includes(role)) {
      // admin/superadmin/manager/operator assign: ambil dari assigned_to
      const raw = req.body.assigned_to;
      if (Array.isArray(raw)) {
        technicians = raw.filter(Boolean).slice(0, 2);
      } else if (raw) {
        technicians = [raw];
      }
      if (req.body.assigned_to2 && technicians.length < 2) {
        technicians.push(req.body.assigned_to2);
      }
    } else {
      // teknisi assign ke diri sendiri
      technicians = [req.session.user.name];
    }
    if (!technicians.length) technicians = [req.session.user.name];
    const workDate = leaveDateOnly(req.body.worked_at || req.body.scheduled_date);
    const leaveConflicts = await approvedLeaveConflicts(technicians, workDate);
    const canForceLeave = ['manager','admin','superadmin'].includes(leaveKey(role));
    if (leaveConflicts.length && (req.body.force_leave_assignment !== true || !canForceLeave)) {
      return sendLeaveAssignmentConflict(res, leaveConflicts, workDate, canForceLeave);
    }

    const ticket = await db.insertTicket({
      wo_number:      req.body.wo_number,
      project_name:   req.body.project_name  || null,
      customer_name:  req.body.customer_name || null,
      customer_phone: req.body.customer_phone|| null,
      technicians:    technicians,               // array
      technician:     technicians[0],            // backward compat display
      created_by:     req.session.user.name,
      status:         'assigned',
      worked_at:      req.body.worked_at,
      description:    req.body.description   || null,
      rating:         req.body.rating        || 0,
      tracking_token: token,
      last_lat:       req.body.lat           || null,
      last_lng:       req.body.lng           || null,
      last_gps_at:    req.body.lat ? now : null,
      // PXL-STG-0002 — relasi integrasi bersifat opsional; WO manual tetap valid.
      source_type:    req.body.source_type    || 'manual',
      sales_order_id: req.body.sales_order_id || null,
      so_number:      req.body.so_number      || null,
      crm_customer_id:req.body.crm_customer_id|| null,
      integration_key:req.body.integration_key|| null,
      integration_meta:req.body.integration_meta||{},
    });
    await db.insertStatusHistory({
      ticket_id: ticket.id, status: 'assigned', timestamp: now,
      technician: req.session.user.name,
      lat: req.body.lat || null, lng: req.body.lng || null
    });
    logActivity(req, 'ticket', 'BUAT TIKET', `WO: ${ticket.wo_number} → Teknisi: ${technicians.join(', ')}`);
    createNotification({
      type: 'tiket',
      text: `<b>Tiket baru</b> ${ticket.wo_number} dibuat oleh ${req.session.user.name}`,
      target_role: 'superadmin',
      ref_id: ticket.id,
      created_by: req.session.user.name,
    });
    createNotification({
      type: 'tiket',
      text: `<b>Tiket baru</b> ${ticket.wo_number} dibuat oleh ${req.session.user.name}`,
      target_role: 'manager',
      ref_id: ticket.id,
      created_by: req.session.user.name,
    });
    res.status(201).json({
      ...ticket,
      invoices:       [],
      status_history: [{ status: 'assigned', timestamp: now, technician: req.session.user.name }],
      job_stages:     []
    });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// PATCH — teknisi hanya bisa update status tiket milik sendiri
app.patch('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const role = req.session.user.role;
    const { status, lat, lng } = req.body;
    const now = new Date().toISOString();

    // Validasi kepemilikan untuk teknisi
    if (role === 'technician') {
      const tickets = await db.getTickets(req.session.user.name);
      const t = tickets.find(t => t.id === req.params.id);
      if (!t) return res.status(403).json({ error: 'Akses ditolak.' });
      // Teknisi hanya boleh update status
      if (Object.keys(req.body).some(k => !['status','lat','lng'].includes(k))) {
        return res.status(403).json({ error: 'Teknisi hanya bisa update status.' });
      }
    }

    // Hanya role tertentu yang boleh mengubah status tiket secara manual.
    // Operator, sales, accounting hanya boleh melihat — tidak boleh ubah status/assign.
    const STATUS_EDIT_ROLES = ['admin','superadmin','technician','operator'];
    if (status && !STATUS_EDIT_ROLES.includes(role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki izin untuk mengubah status tiket.' });
    }

    const patch = {};
    if (status) patch.status = status;
    if (lat && lng){ patch.last_lat = lat; patch.last_lng = lng; patch.last_gps_at = now; }

    // Manager ke atas bisa update teknisi
    const canAssign = ['admin','superadmin','manager','operator'].includes(role);
    const hasTechnicianEdit = ['technicians','technician','assigned_to','assigned_to2','technician_1','technician_2']
      .some(key => Object.prototype.hasOwnProperty.call(req.body || {}, key));
    const requestedTechnicians = leaveTechniciansFromBody(req.body);
    if (canAssign && hasTechnicianEdit && requestedTechnicians.length) {
      const existing = (await db.getTickets(null, true)).find(ticket => String(ticket.id) === String(req.params.id));
      if (!existing) return res.status(404).json({ error: 'Work Order tidak ditemukan.' });
      const workDate = leaveDateOnly(req.body.worked_at || req.body.scheduled_date || existing.worked_at || existing.scheduled_date);
      const leaveConflicts = await approvedLeaveConflicts(requestedTechnicians, workDate);
      const canForceLeave = ['manager','admin','superadmin'].includes(leaveKey(role));
      if (leaveConflicts.length && (req.body.force_leave_assignment !== true || !canForceLeave)) {
        return sendLeaveAssignmentConflict(res, leaveConflicts, workDate, canForceLeave);
      }
      patch.technicians = requestedTechnicians;
      patch.technician  = requestedTechnicians[0];
      logActivity(req, 'ticket', req.body.force_leave_assignment === true ? 'PAKSA ASSIGN TEKNISI CUTI' : 'REASSIGN TEKNISI', `Ticket: ${req.params.id} → ${requestedTechnicians.join(', ')}`);
    } else if (!canAssign && hasTechnicianEdit) {
      return res.status(403).json({ error: 'Anda tidak memiliki izin untuk mengubah teknisi yang ditugaskan.' });
    }

    const updated = await db.updateTicket(req.params.id, patch);
    if (status) {
      await db.insertStatusHistory({
        ticket_id: req.params.id, status, timestamp: now,
        technician: req.session.user.name, lat: lat||null, lng: lng||null
      });
    }
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE — hanya admin
app.delete('/api/tickets/:id', requireRole('admin'), async (req, res) => {
  try { await db.deleteTicket(req.params.id); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ARSIP ──────────────────────────────────
// GET semua tiket arsip (admin, manager, accounting)
app.get('/api/archive', requireRole('admin','manager','accounting'), async (req, res) => {
  try {
    const tickets = await db.getArchivedTickets();
    const enriched = await Promise.all(tickets.map(async t => {
      const [invoices, status_history, job_stages] = await Promise.all([
        db.getInvoicesByTicket(t.id),
        db.getStatusHistory(t.id),
        db.getJobStages(t.id)
      ]);
      return { ...t, invoices: invoices||[], status_history: status_history||[], job_stages: job_stages||[] };
    }));
    res.json(enriched);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST arsipkan tiket (admin only)
app.post('/api/tickets/:id/archive', requireRole('admin'), async (req, res) => {
  try {
    const updated = await db.updateTicket(req.params.id, {
      archived:    true,
      archived_at: new Date().toISOString(),
      archived_by: req.session.user.name
    });
    logActivity(req, 'archive', 'ARSIPKAN TIKET', `Ticket ID: ${req.params.id}`);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST restore tiket dari arsip (admin only)
app.post('/api/tickets/:id/unarchive', requireRole('admin'), async (req, res) => {
  try {
    const updated = await db.updateTicket(req.params.id, {
      archived:    false,
      archived_at: null,
      archived_by: null
    });
    logActivity(req, 'archive', 'RESTORE TIKET', `Ticket ID: ${req.params.id}`);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  INVOICE
// ══════════════════════════════════════════
app.post('/api/tickets/:id/invoice',
  requireRole('accounting','admin','superadmin'),
  upload.single('file'),
  async (req, res) => {
    try {
      // Draft invoice belum memiliki berkas. Simpan NULL agar file_url hanya
      // terisi setelah file benar-benar berhasil diunggah/disimpan.
      let file_url      = null;
      let original_name = null;
      let mime_type     = null;

      if (req.file) {
        if (db.USE_SUPABASE) {
          // Upload ke Supabase Storage
          const ext      = path.extname(req.file.originalname).toLowerCase();
          const filename = crypto.randomBytes(10).toString('hex') + ext;
          const bucket   = 'invoices';

          const uploadRes = await fetch(
            `${cfg.SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`,
            {
              method:  'POST',
              headers: {
                'Authorization': `Bearer ${cfg.SUPABASE_KEY}`,
                'Content-Type':  req.file.mimetype,
                'x-upsert':      'true'
              },
              body: req.file.buffer
            }
          );
          if (!uploadRes.ok) {
            const err = await uploadRes.text();
            throw new Error('Upload ke Supabase Storage gagal: ' + err);
          }
          file_url = `${cfg.SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
        } else {
          // Simpan ke disk lokal
          const ext      = path.extname(req.file.originalname).toLowerCase();
          const filename = crypto.randomBytes(10).toString('hex') + ext;
          const filepath = path.join(UPLOADS_DIR, filename);
          fs.writeFileSync(filepath, req.file.buffer || req.file.path);
          file_url = '/uploads/' + filename;
        }
        original_name = req.file.originalname;
        mime_type     = req.file.mimetype;
      }

      const inv = await db.insertInvoice({
        ticket_id:     req.params.id,
        file_url,
        original_name,
        mime_type,
        uploaded_by:   req.session.user.name,
        note:          req.body.note         || null,
        total_amount:  req.body.total_amount ? Number(req.body.total_amount) : null,
        sales_pic:     req.body.sales_pic    || null,
      });
      logActivity(req, 'invoice', 'UPLOAD INVOICE', `WO: ${req.params.id} · File: ${original_name||'(tanpa file)'}`);
      createNotification({
        type: 'invoice',
        text: `<b>Invoice baru</b> diupload oleh ${req.session.user.name}${inv.total_amount?` — Rp ${Number(inv.total_amount).toLocaleString('id-ID')}`:''}`,
        target_role: 'superadmin',
        ref_id: inv.id,
        created_by: req.session.user.name,
      });
      res.status(201).json(inv);
    } catch(e) {
      console.error('Invoice upload error:', e.message);
      res.status(500).json({ error: e.message });
    }
  }
);

app.delete('/api/tickets/:id/invoice/:invId', requireRole('accounting','admin'), async (req, res) => {
  try { await db.deleteInvoice(req.params.invId, req.params.id); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  INVOICE TANPA WO (STANDALONE)
//  Hanya untuk akun yang di-checklist admin: allow_invoice_no_wo = true
// ══════════════════════════════════════════
app.get('/api/invoices/standalone', requireRole(...INVOICE_READ_ROLES), async (req, res) => {
  try { res.json(await db.getStandaloneInvoices()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices/standalone', requireRole('accounting','admin','manager','superadmin'), upload.single('file'), async (req, res) => {
  try {
    if (req.session.user.allow_invoice_no_wo !== true) {
      return res.status(403).json({ error: 'Anda tidak memiliki izin upload invoice tanpa WO.' });
    }

    // Draft invoice belum memiliki berkas. Simpan NULL agar file_url hanya
    // terisi setelah file benar-benar berhasil diunggah/disimpan.
    let file_url      = null;
    let original_name = null;
    let mime_type     = null;

    if (req.file) {
      if (db.USE_SUPABASE) {
        const ext      = path.extname(req.file.originalname).toLowerCase();
        const filename = crypto.randomBytes(10).toString('hex') + ext;
        const bucket   = 'invoices';

        const uploadRes = await fetch(
          `${cfg.SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`,
          {
            method:  'POST',
            headers: {
              'Authorization': `Bearer ${cfg.SUPABASE_KEY}`,
              'Content-Type':  req.file.mimetype,
              'x-upsert':      'true'
            },
            body: req.file.buffer
          }
        );
        if (!uploadRes.ok) {
          const err = await uploadRes.text();
          throw new Error('Upload ke Supabase Storage gagal: ' + err);
        }
        file_url = `${cfg.SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
      } else {
        const ext      = path.extname(req.file.originalname).toLowerCase();
        const filename = crypto.randomBytes(10).toString('hex') + ext;
        const filepath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filepath, req.file.buffer || req.file.path);
        file_url = '/uploads/' + filename;
      }
      original_name = req.file.originalname;
      mime_type     = req.file.mimetype;
    }

    const inv = await db.insertStandaloneInvoice({
      file_url,
      original_name,
      mime_type,
      uploaded_by:   req.session.user.name,
      note:          req.body.note         || null,
      total_amount:  req.body.total_amount ? Number(req.body.total_amount) : null,
      sales_pic:     req.body.sales_pic    || null,
    });
    logActivity(req, 'invoice', 'UPLOAD INVOICE TANPA WO', `File: ${original_name||'(tanpa file)'} · Nominal: ${req.body.total_amount||'-'}`);
    createNotification({
      type: 'invoice',
      text: `<b>Invoice baru</b> (tanpa WO) diupload oleh ${req.session.user.name}${inv.total_amount?` — Rp ${Number(inv.total_amount).toLocaleString('id-ID')}`:''}`,
      target_role: 'superadmin',
      ref_id: inv.id,
      created_by: req.session.user.name,
    });
    res.status(201).json(inv);
  } catch(e) {
    console.error('Standalone invoice upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/invoices/standalone/:invId', requireRole('accounting','admin','superadmin'), async (req, res) => {
  try { await db.deleteStandaloneInvoice(req.params.invId); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  MASTER SUPPLIER
// ══════════════════════════════════════════
const SUPPLIER_ROLES=['superadmin','manager','accounting'];

app.get('/api/suppliers', requireAuth, async (req,res)=>{
  try{ res.json(await db.getSuppliers()); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/suppliers', requireRole(...SUPPLIER_ROLES), async (req,res)=>{
  try{
    const entry=await db.insertSupplier(req.body);
    res.status(201).json(entry);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/suppliers/:id', requireRole(...SUPPLIER_ROLES), async (req,res)=>{
  try{
    const entry=await db.updateSupplier(req.params.id, req.body);
    res.json(entry);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/suppliers/:id', requireRole(...SUPPLIER_ROLES), async (req,res)=>{
  try{
    await db.deleteSupplier(req.params.id);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// ══════════════════════════════════════════
//  PURCHASE REQUEST
// ══════════════════════════════════════════
const PR_ROLES = ['superadmin','manager','accounting','admin'];

app.get('/api/purchase-requests', requireRole(...PR_ROLES), async (req,res)=>{
  try{ res.json(await db.getPurchaseRequests()); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/purchase-requests', requireRole(...PR_ROLES), async (req,res)=>{
  try{
    const {pr_number,pr_date,outlet,requester,requester_title,department,reason,items,status}=req.body;
    if(!pr_number||!outlet||!items?.length) return res.status(400).json({error:'Field wajib kurang.'});
    const entry=await db.insertPurchaseRequest({pr_number,pr_date,outlet,requester,requester_title,department,reason,items,status:'pending'});
    logActivity(req,'pr','BUAT PR',`${pr_number} - ${outlet}`);
    createNotification({
      type: 'pr',
      text: `<b>Purchase Request baru</b> ${pr_number} diajukan oleh ${requester||req.session.user.name}`,
      target_role: 'superadmin',
      ref_id: entry.id,
      created_by: req.session.user.name,
    });
    createNotification({
      type: 'pr',
      text: `<b>Purchase Request baru</b> ${pr_number} menunggu approval Anda`,
      target_role: 'manager',
      ref_id: entry.id,
      created_by: req.session.user.name,
    });
    res.status(201).json(entry);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/purchase-requests/:id', requireRole(...PR_ROLES), async (req,res)=>{
  try{
    const entry=await db.updatePurchaseRequest(req.params.id, req.body);
    if(req.body.status==='approved') logActivity(req,'pr','APPROVE PR',req.params.id);
    if(req.body.status==='rejected') logActivity(req,'pr','REJECT PR',req.params.id);
    res.json(entry);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/purchase-requests/:id', requireRole('superadmin'), async (req,res)=>{
  try{
    await db.deletePurchaseRequest(req.params.id);
    logActivity(req,'pr','HAPUS PR',req.params.id);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// ══════════════════════════════════════════
//  PROJECT TRACKER
// ══════════════════════════════════════════
const PROJECT_ROLES = ['superadmin','manager','admin','sales'];

// PXL-STG-0012 — pemisahan akses Project Report (teknisi) dan Input BOQ (manager/permission khusus)
function hasProjectBoqAccess(req) {
  const user=req.session?.user||{};
  const role=String(user.role||'').toLowerCase().replace(/[ _-]/g,'');
  const custom=Array.isArray(user.custom_menus)?user.custom_menus:[];
  if(user.custom_menus_override===true) return custom.includes('project_boq_manage');
  if(role==='superadmin'||role==='manager') return true;
  return custom.includes('project_boq_manage');
}
function requireProjectBoqAccess(req,res,next){
  if(!req.session?.user) return res.status(401).json({error:'Unauthorized'});
  if(!hasProjectBoqAccess(req)) return res.status(403).json({error:'Anda tidak memiliki izin Input Total BOQ Project.'});
  next();
}
function canReadProjectReport(req){
  const user=req.session?.user||{};
  const role=String(user.role||'').toLowerCase().replace(/[ _-]/g,'');
  return role==='technician'||role==='superadmin'||hasProjectBoqAccess(req);
}
function requireProjectReportRead(req,res,next){
  if(!req.session?.user) return res.status(401).json({error:'Unauthorized'});
  if(!canReadProjectReport(req)) return res.status(403).json({error:'Project Report hanya untuk Teknisi atau akun pengelola BOQ.'});
  next();
}
function requireProjectAchievementInput(req,res,next){
  if(!req.session?.user) return res.status(401).json({error:'Unauthorized'});
  const role=String(req.session.user.role||'').toLowerCase().replace(/[ _-]/g,'');
  if(!['technician','superadmin'].includes(role)) return res.status(403).json({error:'Today Achievement hanya dapat diinput oleh Teknisi.'});
  next();
}

app.get('/api/projects', requireRole(...PROJECT_ROLES), async (req,res)=>{
  try{ res.json(await db.getProjects()); }
  catch(e){ res.status(500).json({error:e.message}); }
});

// POST bulk import project dari Excel — SUPERADMIN ONLY
app.post('/api/projects/import', requireRole('superadmin'), async (req,res)=>{
  try{
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ error: 'Data import kosong atau format salah.' });
    }
    const results = { success: 0, failed: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        if (!r.nama_project) {
          results.failed++;
          results.errors.push(`Baris ${i+2}: nama_project wajib diisi.`);
          continue;
        }
        const history = (r.issue || r.action_plan) ? [{
          date: new Date().toISOString(),
          issue: r.issue || null,
          action_plan: r.action_plan || null,
          by: req.session.user.name,
        }] : [];
        await db.insertProject({
          prioritas:      r.prioritas || 'P2',
          nama_project:   r.nama_project,
          pic:            r.pic || null,
          harga_pokok:    r.harga_pokok ? Number(r.harga_pokok) : null,
          omset:          r.omset ? Number(r.omset) : null,
          issue:          r.issue || null,
          action_plan:    r.action_plan || null,
          status:         r.status || 'On Plan',
          pic_desa:       r.pic_desa || null,
          pic_desa_phone: r.pic_desa_phone || null,
          target_week:    r.target_week || null,
          history,
          created_by:     req.session.user.name,
        });
        results.success++;
      } catch (rowErr) {
        results.failed++;
        results.errors.push(`Baris ${i+2}: ${rowErr.message}`);
      }
    }
    logActivity(req, 'project', 'IMPORT EXCEL', `${results.success} berhasil, ${results.failed} gagal`);
    res.json(results);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/projects', requireRole(...PROJECT_ROLES), async (req,res)=>{
  try{
    const {prioritas,nama_project,pic,harga_pokok,omset,issue,action_plan,status,
           pic_desa,pic_desa_phone,target_week} = req.body;
    if(!nama_project) return res.status(400).json({error:'Nama project wajib diisi.'});
    const now=new Date().toISOString();
    const history = issue||action_plan ? [{
      date: now,
      issue: issue||null,
      action_plan: action_plan||null,
      by: req.session.user.name,
    }] : [];
    const entry=await db.insertProject({
      prioritas:      prioritas||'P2',
      nama_project,
      pic:            pic||null,
      harga_pokok:    harga_pokok?Number(harga_pokok):null,
      omset:          omset?Number(omset):null,
      issue:          issue||null,
      action_plan:    action_plan||null,
      status:         status||'On Plan',
      pic_desa:       pic_desa||null,
      pic_desa_phone: pic_desa_phone||null,
      target_week:    target_week||null,
      history,
      created_by:     req.session.user.name,
    });
    logActivity(req,'project','BUAT PROJECT',nama_project);
    createNotification({
      type: 'project',
      text: `<b>Project baru</b> "${nama_project}" ditambahkan oleh ${req.session.user.name}`,
      target_role: 'superadmin',
      ref_id: entry.id,
      created_by: req.session.user.name,
    });
    createNotification({
      type: 'project',
      text: `<b>Project baru</b> "${nama_project}" ditambahkan`,
      target_role: 'manager',
      ref_id: entry.id,
      created_by: req.session.user.name,
    });
    res.status(201).json(entry);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/projects/:id', requireRole(...PROJECT_ROLES), async (req,res)=>{
  try{
    const projects = await db.getProjects();
    const existing = projects.find(p=>p.id===req.params.id);
    const patch = {...req.body};

    // Jika ada issue/action_plan baru → tambahkan ke history, jangan overwrite
    if((req.body.issue || req.body.action_plan) && existing){
      const newEntry = {
        date: new Date().toISOString(),
        issue: req.body.issue ?? existing.issue ?? null,
        action_plan: req.body.action_plan ?? existing.action_plan ?? null,
        by: req.session.user.name,
      };
      patch.history = [...(existing.history||[]), newEntry];
    }

    const entry=await db.updateProject(req.params.id, patch);
    logActivity(req,'project','UPDATE PROJECT',req.params.id);
    res.json(entry);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/projects/:id', requireRole('superadmin','admin'), async (req,res)=>{
  try{
    await db.deleteProject(req.params.id);
    logActivity(req,'project','HAPUS PROJECT',req.params.id);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});


// ══════════════════════════════════════════
//  PXL-STG-0011 — PROJECT REPORT + DETAIL MATERIAL/JASA
// ══════════════════════════════════════════
async function buildProjectReportRows(){
  const [projects,reports,legacyAchievements,items,itemAchievements]=await Promise.all([
    db.getProjects(), db.getProjectReports(), db.getProjectReportAchievements(),
    db.getProjectReportItems(), db.getProjectReportItemAchievements()
  ]);
  const reportByProject=new Map(reports.map(r=>[String(r.project_id),r]));
  const legacyByProject=new Map();
  legacyAchievements.forEach(a=>{
    const k=String(a.project_id);
    if(!legacyByProject.has(k)) legacyByProject.set(k,[]);
    legacyByProject.get(k).push(a);
  });
  const itemAchByItem=new Map();
  itemAchievements.forEach(a=>{
    const k=String(a.item_id);
    if(!itemAchByItem.has(k)) itemAchByItem.set(k,[]);
    itemAchByItem.get(k).push(a);
  });
  const itemsByProject=new Map();
  items.forEach(i=>{
    const k=String(i.project_id);
    if(!itemsByProject.has(k)) itemsByProject.set(k,[]);
    const hist=itemAchByItem.get(String(i.id))||[];
    const boq=Number(i.boq_qty)||0;
    const done=hist.reduce((n,a)=>n+(Number(a.achievement)||0),0);
    const remain=Math.max(boq-done,0);
    const progress=boq>0?Math.min(100,Math.round(done/boq*10000)/100):0;
    let status=String(i.status_override||'').trim();
    if(!status) status=done<=0?'Not Started':remain<=0?'Done':'On Progress';
    itemsByProject.get(k).push({...i,boq_qty:boq,total_done:done,remain,progress,status,achievements:hist});
  });
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return projects.map(p=>{
    const report=reportByProject.get(String(p.id))||null;
    const legacyHist=legacyByProject.get(String(p.id))||[];
    const detailItems=itemsByProject.get(String(p.id))||[];
    const hasDetail=detailItems.length>0;
    const calcCategory=cat=>{
      const list=detailItems.filter(i=>String(i.category).toLowerCase()===cat);
      const boq=list.reduce((n,i)=>n+Number(i.boq_qty||0),0);
      const done=list.reduce((n,i)=>n+Number(i.total_done||0),0);
      const todayDone=list.reduce((n,i)=>n+(i.achievements||[]).filter(a=>String(a.achievement_date).slice(0,10)===today).reduce((x,a)=>x+Number(a.achievement||0),0),0);
      return {count:list.length,boq,total_done:done,today_achievement:todayDone,remain:Math.max(boq-done,0),progress:boq>0?Math.min(100,Math.round(done/boq*10000)/100):0};
    };
    const material=calcCategory('material'), jasa=calcCategory('jasa');
    let totalBoq,totalDone,todayAchievement;
    if(hasDetail){
      totalBoq=material.boq+jasa.boq;
      totalDone=material.total_done+jasa.total_done;
      todayAchievement=material.today_achievement+jasa.today_achievement;
    }else{
      totalBoq=Number(report?.total_boq)||0;
      totalDone=legacyHist.reduce((n,a)=>n+(Number(a.achievement)||0),0);
      todayAchievement=legacyHist.filter(a=>String(a.achievement_date).slice(0,10)===today).reduce((n,a)=>n+(Number(a.achievement)||0),0);
    }
    const remain=Math.max(totalBoq-totalDone,0);
    const progress=totalBoq>0?Math.min(100,Math.round((totalDone/totalBoq)*10000)/100):0;
    return {...p,report_id:report?.id||null,total_boq:totalBoq,today_achievement:todayAchievement,total_done:totalDone,remain,progress,
      material_summary:material,jasa_summary:jasa,items:detailItems,has_detail_boq:hasDetail,achievements:legacyHist};
  });
}

app.get('/api/project-reports', requireProjectReportRead, async (req,res)=>{
  try{ res.json(await buildProjectReportRows()); }
  catch(e){ res.status(500).json({error:e.message}); }
});


// Ringkasan progress untuk badge di Project Tracker; tidak membuka detail BOQ/history.
app.get('/api/project-report-summaries', requireRole(...PROJECT_ROLES), async (req,res)=>{
  try{
    const rows=await buildProjectReportRows();
    res.json(rows.map(r=>({
      id:r.id,
      material_summary:r.material_summary,
      jasa_summary:r.jasa_summary,
      progress:r.progress
    })));
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Legacy PXL-STG-0010 endpoints dipertahankan untuk kompatibilitas project yang belum memiliki detail BOQ.
app.put('/api/project-reports/:projectId/boq', requireProjectBoqAccess, async (req,res)=>{
  try{
    const totalBoq=Number(req.body.total_boq);
    if(!Number.isFinite(totalBoq)||totalBoq<=0) return res.status(400).json({error:'Total BOQ wajib lebih dari 0.'});
    const rows=await buildProjectReportRows();
    const current=rows.find(r=>String(r.id)===String(req.params.projectId));
    if(!current) return res.status(404).json({error:'Project tidak ditemukan.'});
    if(current.has_detail_boq) return res.status(400).json({error:'Project sudah memakai Detail BOQ. Total BOQ dihitung otomatis dari Material + Jasa.'});
    if(current.total_done>totalBoq) return res.status(400).json({error:`Total BOQ tidak boleh lebih kecil dari Total Done (${current.total_done}).`});
    await db.upsertProjectReport(req.params.projectId,totalBoq,req.session.user.name);
    logActivity(req,'project','UPDATE PROJECT REPORT BOQ',`${current.nama_project}: ${totalBoq}`);
    res.json((await buildProjectReportRows()).find(r=>String(r.id)===String(req.params.projectId)));
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/project-reports/:projectId/achievements', requireProjectAchievementInput, async (req,res)=>{
  try{
    const achievement=Number(req.body.achievement);
    const date=String(req.body.achievement_date||new Date().toISOString().slice(0,10));
    if(!Number.isFinite(achievement)||achievement<=0) return res.status(400).json({error:'Today Achievement wajib lebih dari 0.'});
    const rows=await buildProjectReportRows();
    const current=rows.find(r=>String(r.id)===String(req.params.projectId));
    if(!current) return res.status(404).json({error:'Project tidak ditemukan.'});
    if(current.has_detail_boq) return res.status(400).json({error:'Project sudah memakai Detail BOQ. Input achievement dilakukan per item Material/Jasa.'});
    if(!current.total_boq) return res.status(400).json({error:'Isi Total BOQ terlebih dahulu.'});
    if(current.total_done+achievement>current.total_boq) return res.status(400).json({error:`Achievement melebihi sisa BOQ. Remain saat ini ${current.remain}.`});
    await db.insertProjectReportAchievement({project_id:req.params.projectId,achievement_date:date,achievement,notes:req.body.notes?String(req.body.notes).trim():null,created_by:req.session.user.name});
    logActivity(req,'project','TAMBAH PROJECT ACHIEVEMENT',`${current.nama_project}: +${achievement}`);
    res.status(201).json((await buildProjectReportRows()).find(r=>String(r.id)===String(req.params.projectId)));
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/project-report-achievements/:id', requireRole('superadmin'), async (req,res)=>{
  try{
    const all=await db.getProjectReportAchievements();
    const existing=all.find(a=>String(a.id)===String(req.params.id));
    if(!existing) return res.status(404).json({error:'History achievement tidak ditemukan.'});
    const projectRows=await buildProjectReportRows();
    const current=projectRows.find(r=>String(r.id)===String(existing.project_id));
    const achievement=req.body.achievement===undefined?Number(existing.achievement):Number(req.body.achievement);
    if(!Number.isFinite(achievement)||achievement<=0) return res.status(400).json({error:'Achievement wajib lebih dari 0.'});
    const otherDone=current.total_done-Number(existing.achievement||0);
    if(otherDone+achievement>current.total_boq) return res.status(400).json({error:`Achievement melebihi Total BOQ. Maksimal ${Math.max(current.total_boq-otherDone,0)}.`});
    const patch={achievement};
    if(req.body.achievement_date!==undefined) patch.achievement_date=String(req.body.achievement_date);
    if(req.body.notes!==undefined) patch.notes=req.body.notes?String(req.body.notes).trim():null;
    await db.updateProjectReportAchievement(req.params.id,patch);
    logActivity(req,'project','EDIT PROJECT ACHIEVEMENT',req.params.id);
    res.json((await buildProjectReportRows()).find(r=>String(r.id)===String(existing.project_id)));
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/project-report-achievements/:id', requireRole('superadmin'), async (req,res)=>{
  try{ await db.deleteProjectReportAchievement(req.params.id); logActivity(req,'project','HAPUS PROJECT ACHIEVEMENT',req.params.id); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

// Detail BOQ Material/Jasa
app.post('/api/project-reports/:projectId/items', requireProjectBoqAccess, async (req,res)=>{
  try{
    const rows=await buildProjectReportRows();
    const current=rows.find(r=>String(r.id)===String(req.params.projectId));
    if(!current) return res.status(404).json({error:'Project tidak ditemukan.'});
    const category=String(req.body.category||'').toLowerCase();
    const itemName=String(req.body.item_name||'').trim();
    const boq=Number(req.body.boq_qty);
    if(!['material','jasa'].includes(category)) return res.status(400).json({error:'Kategori wajib Material atau Jasa.'});
    if(!itemName) return res.status(400).json({error:'Nama item/jasa wajib diisi.'});
    if(!Number.isFinite(boq)||boq<=0) return res.status(400).json({error:'BOQ item wajib lebih dari 0.'});
    await db.insertProjectReportItem({project_id:req.params.projectId,category,item_name:itemName,boq_qty:boq,unit:req.body.unit?String(req.body.unit).trim():null,notes:req.body.notes?String(req.body.notes).trim():null,sort_order:Number(req.body.sort_order)||0,status_override:req.body.status_override?String(req.body.status_override).trim():null,created_by:req.session.user.name});
    logActivity(req,'project','TAMBAH DETAIL BOQ',`${current.nama_project}: ${category} - ${itemName}`);
    res.status(201).json((await buildProjectReportRows()).find(r=>String(r.id)===String(req.params.projectId)));
  }catch(e){ res.status(500).json({error:e.message}); }
});


// Import massal Detail BOQ dari Excel (hasil parsing frontend).
app.post('/api/project-reports/:projectId/items/import', requireProjectBoqAccess, async (req,res)=>{
  try{
    const rows=await buildProjectReportRows();
    const current=rows.find(r=>String(r.id)===String(req.params.projectId));
    if(!current) return res.status(404).json({error:'Project tidak ditemukan.'});
    const importRows=Array.isArray(req.body.rows)?req.body.rows:[];
    if(!importRows.length) return res.status(400).json({error:'Data import BOQ kosong.'});
    if(importRows.length>1000) return res.status(400).json({error:'Maksimal 1000 baris per import.'});
    const normalized=[];
    for(let idx=0;idx<importRows.length;idx++){
      const x=importRows[idx]||{};
      const category=String(x.category||'').trim().toLowerCase();
      const itemName=String(x.item_name||'').trim();
      const boq=Number(x.boq_qty);
      if(!['material','jasa'].includes(category)) return res.status(400).json({error:`Baris ${idx+2}: Kategori harus Material atau Jasa.`});
      if(!itemName) return res.status(400).json({error:`Baris ${idx+2}: Nama Item/Jasa wajib diisi.`});
      if(!Number.isFinite(boq)||boq<=0) return res.status(400).json({error:`Baris ${idx+2}: BOQ wajib lebih dari 0.`});
      normalized.push({
        project_id:req.params.projectId,
        category,
        item_name:itemName,
        boq_qty:boq,
        unit:x.unit?String(x.unit).trim():null,
        notes:x.notes?String(x.notes).trim():null,
        sort_order:Number.isFinite(Number(x.sort_order))?Number(x.sort_order):idx+1,
        status_override:null,
        created_by:req.session.user.name
      });
    }
    for(const item of normalized) await db.insertProjectReportItem(item);
    logActivity(req,'project','IMPORT DETAIL BOQ',`${current.nama_project}: ${normalized.length} baris`);
    res.status(201).json((await buildProjectReportRows()).find(r=>String(r.id)===String(req.params.projectId)));
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/project-report-items/:id', requireProjectBoqAccess, async (req,res)=>{
  try{
    const all=await db.getProjectReportItems();
    const existing=all.find(i=>String(i.id)===String(req.params.id));
    if(!existing) return res.status(404).json({error:'Detail BOQ tidak ditemukan.'});
    const ach=await db.getProjectReportItemAchievements(req.params.id);
    const done=ach.reduce((n,a)=>n+Number(a.achievement||0),0);
    const patch={};
    if(req.body.category!==undefined){ const c=String(req.body.category).toLowerCase(); if(!['material','jasa'].includes(c)) return res.status(400).json({error:'Kategori tidak valid.'}); patch.category=c; }
    if(req.body.item_name!==undefined){ const x=String(req.body.item_name).trim(); if(!x)return res.status(400).json({error:'Nama item/jasa wajib diisi.'}); patch.item_name=x; }
    if(req.body.boq_qty!==undefined){ const q=Number(req.body.boq_qty); if(!Number.isFinite(q)||q<=0)return res.status(400).json({error:'BOQ item wajib lebih dari 0.'}); if(q<done)return res.status(400).json({error:`BOQ tidak boleh lebih kecil dari Total Done (${done}).`}); patch.boq_qty=q; }
    if(req.body.unit!==undefined) patch.unit=req.body.unit?String(req.body.unit).trim():null;
    if(req.body.notes!==undefined) patch.notes=req.body.notes?String(req.body.notes).trim():null;
    if(req.body.sort_order!==undefined) patch.sort_order=Number(req.body.sort_order)||0;
    if(req.body.status_override!==undefined) patch.status_override=req.body.status_override?String(req.body.status_override).trim():null;
    await db.updateProjectReportItem(req.params.id,patch);
    logActivity(req,'project','EDIT DETAIL BOQ',req.params.id);
    res.json((await buildProjectReportRows()).find(r=>String(r.id)===String(existing.project_id)));
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/project-report-items/:id', requireProjectBoqAccess, async (req,res)=>{
  try{ await db.deleteProjectReportItem(req.params.id); logActivity(req,'project','HAPUS DETAIL BOQ',req.params.id); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/project-report-items/:id/achievements', requireProjectAchievementInput, async (req,res)=>{
  try{
    const all=await db.getProjectReportItems();
    const item=all.find(i=>String(i.id)===String(req.params.id));
    if(!item) return res.status(404).json({error:'Detail BOQ tidak ditemukan.'});
    const achievement=Number(req.body.achievement);
    if(!Number.isFinite(achievement)||achievement<=0)return res.status(400).json({error:'Achievement wajib lebih dari 0.'});
    const hist=await db.getProjectReportItemAchievements(req.params.id);
    const done=hist.reduce((n,a)=>n+Number(a.achievement||0),0);
    const boq=Number(item.boq_qty)||0;
    if(done+achievement>boq)return res.status(400).json({error:`Achievement melebihi remain item. Maksimal ${Math.max(boq-done,0)}.`});
    await db.insertProjectReportItemAchievement({item_id:req.params.id,achievement_date:String(req.body.achievement_date||new Date().toISOString().slice(0,10)),achievement,notes:req.body.notes?String(req.body.notes).trim():null,created_by:req.session.user.name});
    logActivity(req,'project','TAMBAH ACHIEVEMENT ITEM',`${item.item_name}: +${achievement}`);
    res.status(201).json((await buildProjectReportRows()).find(r=>String(r.id)===String(item.project_id)));
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/project-report-item-achievements/:id', requireRole('superadmin'), async (req,res)=>{
  try{
    const allAch=await db.getProjectReportItemAchievements();
    const existing=allAch.find(a=>String(a.id)===String(req.params.id));
    if(!existing)return res.status(404).json({error:'Achievement item tidak ditemukan.'});
    const allItems=await db.getProjectReportItems();
    const item=allItems.find(i=>String(i.id)===String(existing.item_id));
    if(!item)return res.status(404).json({error:'Detail BOQ tidak ditemukan.'});
    const hist=allAch.filter(a=>String(a.item_id)===String(item.id));
    const otherDone=hist.filter(a=>String(a.id)!==String(existing.id)).reduce((n,a)=>n+Number(a.achievement||0),0);
    const achievement=req.body.achievement===undefined?Number(existing.achievement):Number(req.body.achievement);
    if(!Number.isFinite(achievement)||achievement<=0)return res.status(400).json({error:'Achievement wajib lebih dari 0.'});
    if(otherDone+achievement>Number(item.boq_qty))return res.status(400).json({error:`Achievement melebihi BOQ item. Maksimal ${Math.max(Number(item.boq_qty)-otherDone,0)}.`});
    const patch={achievement};
    if(req.body.achievement_date!==undefined)patch.achievement_date=String(req.body.achievement_date);
    if(req.body.notes!==undefined)patch.notes=req.body.notes?String(req.body.notes).trim():null;
    await db.updateProjectReportItemAchievement(req.params.id,patch);
    logActivity(req,'project','EDIT ACHIEVEMENT ITEM',req.params.id);
    res.json((await buildProjectReportRows()).find(r=>String(r.id)===String(item.project_id)));
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/project-report-item-achievements/:id', requireRole('superadmin'), async (req,res)=>{
  try{ await db.deleteProjectReportItemAchievement(req.params.id); logActivity(req,'project','HAPUS ACHIEVEMENT ITEM',req.params.id); res.json({ok:true}); }
  catch(e){ res.status(500).json({error:e.message}); }
});

// ══════════════════════════════════════════
//  MATERIAL REQUEST (akses: superadmin, akunting, manager)
// ══════════════════════════════════════════

// POST — teknisi submit material saat selesaikan tiket
app.post('/api/material-requests', requireAuth, async (req, res) => {
  try {
    const { ticket_id, materials, jasa, notes } = req.body;
    const matArr  = Array.isArray(materials) ? materials : [];
    const jasaArr = Array.isArray(jasa) ? jasa : [];
    if (!ticket_id || (!matArr.length && !jasaArr.length)) {
      return res.status(400).json({ error: 'ticket_id wajib diisi dan minimal 1 material atau 1 jasa.' });
    }
    // Validasi tiap material
    for (const m of matArr) {
      if (!m.name || !m.qty || Number(m.qty) <= 0) {
        return res.status(400).json({ error: 'Setiap material wajib punya nama dan jumlah > 0.' });
      }
    }
    // Validasi tiap jasa
    for (const j of jasaArr) {
      if (!j.name || !j.qty || Number(j.qty) <= 0) {
        return res.status(400).json({ error: 'Setiap jasa wajib punya nama dan jumlah > 0.' });
      }
    }
    // Ambil wo_number untuk referensi cepat
    const tickets = await db.getTickets(null, true);
    const ticket = tickets.find(t => t.id === ticket_id);

    const entry = await db.insertMaterialRequest({
      ticket_id,
      wo_number:  ticket?.wo_number || null,
      technician: req.session.user.name,
      materials:  matArr,
      jasa:       jasaArr,
      notes
    });
    logActivity(req, 'ticket', 'REQUEST MATERIAL/JASA', `WO: ${ticket?.wo_number||ticket_id} · ${matArr.length} material, ${jasaArr.length} jasa`);
    createNotification({
      type: 'mr',
      text: `<b>Material Request baru</b> untuk ${ticket?.wo_number||ticket_id} oleh ${req.session.user.name}`,
      target_role: 'superadmin',
      ref_id: entry.id,
      created_by: req.session.user.name,
    });
    res.status(201).json(entry);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET — hanya superadmin, akunting, manager (data mentah)
app.get('/api/material-requests', requireRole('superadmin','accounting','manager'), async (req, res) => {
  try { res.json(await db.getMaterialRequests()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  MATERIAL REQUEST FORM (akses semua role)
// ══════════════════════════════════════════
app.get('/api/material-requests-form', requireAuth, async (req,res)=>{
  try{ res.json(await db.getMRForms()); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/material-requests-form', requireAuth, async (req,res)=>{
  try{
    const requestedStatus=String(req.body.status||'draft').toLowerCase();

    const entry=await db.insertMRForm({
      ...req.body,
      status:requestedStatus==='taken'?'draft':requestedStatus,
      created_by:req.session.user.name
    });

    let finalEntry=entry;

    if(requestedStatus==='taken'){
      const items=(Array.isArray(entry.items)?entry.items:[]).map(i=>({
        inventory_item_id:i.inventory_item_id||null,
        qty_out:Number(i.qty_out??i.qty??0)
      }));

      if(!items.length){
        throw new Error('Material Request tidak memiliki item Inventory.');
      }

      if(items.some(i=>!i.inventory_item_id||i.qty_out<=0)){
        throw new Error('Ada item Material Request yang belum terhubung ke Inventory atau quantity tidak valid.');
      }

      await db.issueInventoryMaterialRequest(
        entry.id,
        items,
        req.session.user.name,
        entry.wo_number||''
      );

      finalEntry=await db.updateMRForm(entry.id,{status:'taken'});
    }

    logActivity(req,'material','BUAT MR FORM',`WO: ${req.body.wo_number}`);
    res.status(201).json(finalEntry);
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.patch('/api/material-requests-form/:id', requireAuth, async (req,res)=>{
  try{
    const entry=await db.updateMRForm(req.params.id, req.body);
    res.json(entry);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/material-requests-form/:id', requireAuth, async (req,res)=>{
  try{
    await db.deleteMRForm(req.params.id);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// ══════════════════════════════════════════
//  ACTIVITY LOG (superadmin only)
// ══════════════════════════════════════════

// Helper — log aktivitas (fire and forget)
function logActivity(req, category, action, detail='') {
  const user = req.session?.user?.name || 'anonymous';
  const ip   = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  db.insertLog({ category, action, user, detail, ip }).catch(()=>{});
}

// GET logs — superadmin only
app.get('/api/activity-logs', requireRole('superadmin'), async (req, res) => {
  try { res.json(await db.getLogs(1000)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE semua logs — superadmin only
app.delete('/api/activity-logs', requireRole('superadmin'), async (req, res) => {
  try { await db.clearLogs(); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
// ══════════════════════════════════════════

// GET semua visit (superadmin/admin lihat semua, sales lihat milik sendiri)
app.get('/api/sales-visits', requireAuth, async (req, res) => {
  try {
    const role = req.session.user.role;
    const isPrivileged = ['admin','superadmin','manager'].includes(role);
    const filterUserId = isPrivileged ? null : req.session.user.id;
    const visits = await db.getSalesVisits(filterUserId);
    res.json(visits);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST bulk import kunjungan dari Excel — SUPERADMIN ONLY
app.post('/api/sales-visits/import', requireRole('superadmin'), async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ error: 'Data import kosong atau format salah.' });
    }
    const results = { success: 0, failed: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        if (!r.customer_name || !r.prospect_date) {
          results.failed++;
          results.errors.push(`Baris ${i+2}: customer_name dan prospect_date wajib diisi.`);
          continue;
        }
        await db.insertSalesVisit({
          sales_pic:       r.sales_pic || req.session.user.name,
          sales_user_id:   req.session.user.id,
          customer_name:   r.customer_name,
          pic_name:        r.pic_name || null,
          customer_phone:  r.customer_phone || null,
          address:         r.address || null,
          kabupaten:       r.kabupaten || null,
          customer_type:   r.customer_type || null,
          sub_segmentasi:  r.sub_segmentasi || null,
          visit_status:    r.visit_status || 'Visited',
          cust_status:     r.cust_status || 'Canvasing',
          lat:             null,
          lng:             null,
          location_manual: true,
          estimasi_omzet:  r.estimasi_omzet ? Number(r.estimasi_omzet) : null,
          realisasi_omzet: r.realisasi_omzet ? Number(r.realisasi_omzet) : null,
          prospect_date:   r.prospect_date,
          next_follow_up:  r.next_follow_up || null,
          notes:           r.notes || null,
        });
        results.success++;
      } catch (rowErr) {
        results.failed++;
        results.errors.push(`Baris ${i+2}: ${rowErr.message}`);
      }
    }
    logActivity(req, 'kunjungan', 'IMPORT EXCEL', `${results.success} berhasil, ${results.failed} gagal`);
    res.json(results);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST buat visit baru
app.post('/api/sales-visits', requireAuth, async (req, res) => {
  try {
    const { customer_name, customer_phone, address,
            pic_name, kabupaten, customer_type, sub_segmentasi, activity, week_progress,
            visit_status, cust_status,
            lat, lng, location_manual,
            estimasi_omzet, realisasi_omzet,
            prospect_date, next_follow_up, notes } = req.body;
    if (!customer_name || !prospect_date) {
      return res.status(400).json({ error: 'customer_name dan prospect_date wajib diisi.' });
    }
    // Operator boleh override sales_pic dari body
    const isOperator = req.session.user.role === 'operator';
    const salesPic = (isOperator && req.body.sales_pic_override) ? req.body.sales_pic_override : req.session.user.name;
    const visit = await db.insertSalesVisit({
      sales_pic:       salesPic,
      sales_user_id:   req.session.user.id,
      customer_name,
      pic_name:        pic_name       || null,
      customer_phone:  customer_phone || null,
      address:         address        || null,
      kabupaten:       kabupaten      || null,
      customer_type:   customer_type  || null,
      sub_segmentasi:  sub_segmentasi || null,
      activity:        activity       || null,
      week_progress:   week_progress  || null,
      visit_status:    visit_status   || 'Visited',
      cust_status:     cust_status    || 'Canvasing',
      lat:             lat            || null,
      lng:             lng            || null,
      location_manual: location_manual|| false,
      estimasi_omzet:  estimasi_omzet  ? Number(estimasi_omzet)  : null,
      realisasi_omzet: realisasi_omzet ? Number(realisasi_omzet) : null,
      prospect_date,
      next_follow_up:  next_follow_up || null,
      notes:           notes          || null,
      status:          cust_status    || 'prospect',
    });
    logActivity(req, 'ticket', 'KUNJUNGAN SALES', `Customer: ${customer_name} · Status: ${visit_status||'Visited'}`);
    createNotification({
      type: 'kunjungan',
      text: `<b>Kunjungan baru</b> dicatat oleh ${salesPic} — ${customer_name}`,
      target_role: 'superadmin',
      ref_id: visit.id,
      created_by: salesPic,
    });
    res.status(201).json(visit);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH update visit (status, realisasi, notes, dll)
app.patch('/api/sales-visits/:id', requireAuth, async (req, res) => {
  try {
    const role = req.session.user.role;
    const visits = await db.getSalesVisits(null);
    const visit = visits.find(v => v.id === req.params.id);
    if (!visit) return res.status(404).json({ error: 'Visit tidak ditemukan.' });
    // Sales hanya bisa edit miliknya sendiri
    if (!['admin','superadmin','manager'].includes(role) && visit.sales_user_id !== req.session.user.id) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }
    // sales_pic dan sales_user_id tidak bisa diubah, KECUALI oleh superadmin
    // (mis. untuk mengoreksi kunjungan yang salah input Sales PIC oleh operator)
    let patch;
    if (role === 'superadmin') {
      patch = { ...req.body };
      // Kalau superadmin kirim sales_pic baru, pastikan sales_user_id ikut disesuaikan
      if (req.body.sales_pic && !req.body.sales_user_id) {
        const users = await db.getUsers();
        const matchedUser = users.find(u => u.name === req.body.sales_pic);
        patch.sales_user_id = matchedUser ? matchedUser.id : null;
      }
    } else {
      const { sales_pic: _, sales_user_id: __, ...rest } = req.body;
      patch = rest;
    }
    const updated = await db.updateSalesVisit(req.params.id, patch);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE visit (admin/superadmin only)
app.delete('/api/sales-visits/:id', requireRole('admin','superadmin','manager'), async (req, res) => {
  try { await db.deleteSalesVisit(req.params.id); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET pipeline dates preview (helper untuk frontend)
app.get('/api/sales-visits/pipeline-dates', requireAuth, (req, res) => {
  const { prospect_date } = req.query;
  if (!prospect_date) return res.status(400).json({ error: 'prospect_date required.' });
  try {
    res.json({ prospect_date, ...db.computePipelineDates(prospect_date) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════
//  JOB STAGES (per teknisi dalam tim)
// ══════════════════════════════════════════
app.post('/api/tickets/:id/stage', requireRole('technician','admin'), async (req, res) => {
  try {
    const { stage, lat, lng, tech_signature, customer_signature } = req.body;
    const VALID = ['berangkat','tiba','selesai'];
    if (!VALID.includes(stage)) return res.status(400).json({ error: 'Stage tidak valid.' });
    if (stage === 'selesai' && !String(tech_signature || '').trim()) {
      return res.status(400).json({ error: 'Tanda tangan teknisi wajib diisi sebelum WO diselesaikan.' });
    }
    if (stage === 'selesai' && !String(customer_signature || '').trim()) {
      return res.status(400).json({ error: 'Tanda tangan customer wajib diisi sebelum WO diselesaikan.' });
    }

    const now      = new Date().toISOString();
    const userName = req.session.user.name;

    // ambil semua tiket lalu cari berdasarkan id + membership
    const allTickets = await db.getTickets(null);
    const ticket = allTickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Tiket tidak ditemukan.' });

    // cek apakah user adalah anggota tim tiket ini
    const techs = Array.isArray(ticket.technicians) ? ticket.technicians
                : ticket.technician ? [ticket.technician] : [];
    if (req.session.user.role === 'technician' && !techs.includes(userName)) {
      return res.status(403).json({ error: 'Anda bukan anggota tim tiket ini.' });
    }

    // ambil semua stages tiket ini
    const existing = await db.getJobStages(req.params.id);

    // cek duplikat per-tiket (bukan per-teknisi) — shared lock
    if (stage !== 'selesai') {
      if (existing.find(s => s.stage === stage)) {
        // stage sudah diklik oleh siapapun — update status saja jika belum sync
        const stageStatusMap = { berangkat:'travelling', tiba:'ongoing', selesai:'done' };
        const expectedStatus = stageStatusMap[stage];
        if (ticket.status !== expectedStatus) {
          await db.updateTicket(req.params.id, { status: expectedStatus });
        }
        return res.status(200).json({ ok: true, already_done: true, stage, status: expectedStatus });
      }
      // tiba: pastikan berangkat sudah ada (oleh siapapun)
      if (stage === 'tiba' && !existing.find(s => s.stage === 'berangkat')) {
        return res.status(400).json({ error: 'Harus ada anggota tim yang sudah Berangkat.' });
      }
    }

    // Simpan stage (berangkat & tiba saja, per-teknisi)
    let entry = null;
    if (stage !== 'selesai') {
      entry = await db.insertJobStage({
        ticket_id:  req.params.id,
        stage,
        timestamp:  now,
        technician: userName,
        lat:        lat || null,
        lng:        lng || null
      });
    }

    // Auto update status tiket berdasarkan stage
    // travelling: jika ada yang berangkat
    // ongoing: jika ada yang tiba
    // done: jika salah satu klik selesai → semua selesai
    const stageStatusMap = {
      berangkat: 'travelling',
      tiba:      'ongoing',
      selesai:   'done'
    };
    const newStatus = stageStatusMap[stage];
    if (newStatus) {
      const ticketPatch = { status: newStatus };
      if (stage === 'selesai') {
        ticketPatch.tech_signature = tech_signature;
        ticketPatch.customer_signature = customer_signature;
      }
      await db.updateTicket(req.params.id, ticketPatch);
      await db.insertStatusHistory({
        ticket_id:  req.params.id,
        status:     newStatus,
        timestamp:  now,
        technician: userName,
        lat:        lat || null,
        lng:        lng || null
      });
    }

    logActivity(req, 'stage', `STAGE: ${stage.toUpperCase()}`, `Ticket: ${req.params.id}`);
    res.status(201).json(entry || { ok: true, stage, status: newStatus });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});


// ══════════════════════════════════════════
//  WORK ORDER PHOTOS — CLOUDINARY
//  PXL-REV-0052
// ══════════════════════════════════════════
app.get('/api/tickets/:id/photos', requireAuth, async (req,res)=>{
  try{ res.json(await db.getWorkOrderPhotos(req.params.id,false)); }
  catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/tickets/:id/photos/signature', requireAuth, async (req,res)=>{
  try{
    if(!cloudinaryReady()) return res.status(503).json({error:'Cloudinary belum dikonfigurasi di Vercel Environment Variables.'});
    const ticket=(await db.getTickets(null,true)).find(x=>String(x.id)===String(req.params.id));
    if(!ticket) return res.status(404).json({error:'Work Order tidak ditemukan.'});
    // PXL-REV-0065: setiap file harus memiliki Cloudinary public_id yang unik.
    // Nomor urut berbasis jumlah foto dapat bentrok pada multi-upload atau retry.
    const now=Date.now();
    const date=new Date(now).toISOString().slice(0,10).replace(/-/g,'');
    const wo=safeDocPart(ticket.wo_number||ticket.id);
    const uniqueSuffix=`${now}-${Math.random().toString(36).slice(2,8)}`;
    const public_id=`helpdesk-pixel/work-orders/${wo}/${wo}-${date}-${uniqueSuffix}`;
    const timestamp=Math.floor(now/1000);
    const params={public_id,timestamp};
    res.json({cloud_name:CLOUDINARY_CLOUD_NAME,api_key:CLOUDINARY_API_KEY,timestamp,public_id,signature:cloudinarySignature(params),generated_filename:public_id.split('/').pop()});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/tickets/:id/photos', requireAuth, async (req,res)=>{
  try{
    const role=String(req.session.user.role||'').toLowerCase();
    if(!['technician','sales','operator','manager','admin','superadmin'].includes(role)) return res.status(403).json({error:'Tidak memiliki akses upload foto pekerjaan.'});
    if(!req.body.secure_url || !req.body.cloudinary_public_id) return res.status(400).json({error:'Data upload Cloudinary tidak lengkap.'});
    const row=await db.insertWorkOrderPhoto({
      ticket_id:req.params.id,image_url:req.body.secure_url,secure_url:req.body.secure_url,
      cloudinary_public_id:req.body.cloudinary_public_id,original_filename:req.body.original_filename,
      generated_filename:req.body.generated_filename,caption:req.body.caption,
      visible_to_customer:req.body.visible_to_customer!==false,uploaded_by:req.session.user.name,uploaded_by_id:req.session.user.id
    });
    logActivity(req,'ticket','UPLOAD FOTO WO',`WO ID: ${req.params.id} · ${row.generated_filename||row.cloudinary_public_id}`);
    res.status(201).json(row);
  }catch(e){res.status(500).json({error:e.message});}
});

app.patch('/api/tickets/:id/photos/:photoId', requireAuth, async(req,res)=>{
  try{
    const patch={};
    if(req.body.caption!==undefined) patch.caption=String(req.body.caption||'').trim()||null;
    if(req.body.visible_to_customer!==undefined) patch.visible_to_customer=req.body.visible_to_customer===true;
    res.json(await db.updateWorkOrderPhoto(req.params.photoId,patch));
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/tickets/:id/photos/:photoId', requireAuth, async(req,res)=>{
  try{
    const role=String(req.session.user.role||'').toLowerCase();
    if(!['admin','superadmin'].includes(role)) return res.status(403).json({error:'Hanya Admin/Superadmin yang dapat menghapus foto.'});
    const row=await db.updateWorkOrderPhoto(req.params.photoId,{deleted_at:new Date().toISOString(),deleted_by:req.session.user.name});
    logActivity(req,'ticket','HAPUS FOTO WO',`WO ID: ${req.params.id} · Foto: ${req.params.photoId}`);
    res.json({ok:true,row});
  }catch(e){res.status(500).json({error:e.message});}
});

// ══════════════════════════════════════════
//  PUBLIC TRACKING
// ══════════════════════════════════════════
app.get('/api/track/:token', async (req, res) => {
  try {
    const ticket = await db.getTicketByToken(req.params.token);
    if (!ticket) return res.status(404).json({ error: 'Tiket tidak ditemukan.' });
    if (isExpired(ticket)) return res.status(410).json({ error: 'Link tracking sudah kedaluwarsa.' });

    const [legacyInvoices, invoiceV1, status_history, job_stages, photos] = await Promise.all([
      db.getInvoicesByTicket(ticket.id),
      db.getInvoiceV1ByTicket(ticket.id),
      db.getStatusHistory(ticket.id),
      db.getJobStages(ticket.id),
      db.getWorkOrderPhotos(ticket.id, true)
    ]);

    const invoiceMap = new Map();
    [...(legacyInvoices || []), ...(invoiceV1 || [])].forEach((invoice, index) => {
      const key = String(invoice?.id || `legacy-${index}`);
      if (!invoiceMap.has(key)) invoiceMap.set(key, invoice);
    });
    const invoices = [...invoiceMap.values()];

    logActivity(req, 'tracking', 'LIHAT TRACKING', `WO: ${ticket.wo_number} · Customer: ${ticket.customer_name||'-'}`);
    res.json({
      wo_number: ticket.wo_number,
      project_name: ticket.project_name,
      customer_name: ticket.customer_name,
      customer_phone: ticket.customer_phone || null,
      technician: ticket.technician,
      technicians: ticket.technicians || (ticket.technician ? [ticket.technician] : []),
      status: ticket.status,
      worked_at: ticket.worked_at,
      description: ticket.description,
      last_lat: ticket.last_lat,
      last_lng: ticket.last_lng,
      last_gps_at: ticket.last_gps_at,
      created_at: ticket.created_at,
      expires_at: trackExpiry(ticket).toISOString(),
      invoices,
      invoice_count: invoices.length,
      status_history: status_history || [],
      job_stages: job_stages || [],
      tech_signature: ticket.tech_signature || null,
      customer_signature: ticket.customer_signature || null,
      photos: photos || []
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/track/:token', (req, res) => {
  const trackFile = path.join(__dirname, 'public', 'track.html');
  if (fs.existsSync(trackFile)) {
    res.sendFile(trackFile);
  } else {
    // Fallback: redirect ke root dengan token
    res.redirect('/?track=' + req.params.token);
  }
});


// ══════════════════════════════════════════
// PXL-STG-0002 — FONDASI INTEGRASI WO
// Hanya menambah relasi opsional. Status/KPI WO existing tidak diubah.
// ══════════════════════════════════════════
const WO_FOUNDATION_ROLES = ['sales','manager','admin','superadmin'];
const demoDate = (offsetDays=0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(9,0,0,0);
  return d.toISOString();
};
const normalizeDemoPhone = value => {
  const d=String(value||'').replace(/\D/g,'');
  if(!d) return '';
  if(d.startsWith('62')) return d;
  if(d.startsWith('0')) return '62'+d.slice(1);
  return '62'+d;
};

app.get('/api/integration/wo-foundation', requireRole(...WO_FOUNDATION_ROLES), async (req,res)=>{
  try{
    const [tickets,sos,wos,customers,users]=await Promise.all([
      db.getTickets(null,true), db.getSalesOrders(), db.getCrmWorkOrders(), db.getCrmCustomers(), db.getUsers()
    ]);
    const demo = {
      customers: customers.filter(x=>x.source_marker===STAGING_DEMO_MARKER).length,
      sales_orders: sos.filter(x=>x.source_marker===STAGING_DEMO_MARKER).length,
      tickets: tickets.filter(x=>String(x.integration_key||'').startsWith(STAGING_DEMO_MARKER)).length,
      crm_work_orders: wos.filter(x=>x.source_marker===STAGING_DEMO_MARKER).length,
      technicians: users.filter(x=>String(x.username||'').startsWith('stg.tech.')).length
    };
    const linkedTickets=tickets.filter(x=>x.sales_order_id||x.so_number).length;
    const manualTickets=tickets.filter(x=>!x.sales_order_id&&!x.so_number).length;
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.json({
      revision:'PXL-STG-0002', environment:IS_STAGING?'staging':'production',
      rules:{work_order_center:true,sales_order_optional:true,kpi_status_unchanged:true,demo_seed_enabled:IS_STAGING},
      totals:{tickets:tickets.length,sales_orders:sos.length,crm_work_orders:wos.length,customers:customers.length,technicians:users.filter(x=>x.role==='technician'||(x.extra_roles||[]).includes('technician')).length,linked_tickets:linkedTickets,manual_tickets:manualTickets},
      demo
    });
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/staging/demo/wo-foundation', requireRole('superadmin'), async (req,res)=>{
  if(!IS_STAGING) return res.status(403).json({error:'Seed dummy hanya tersedia pada staging.'});
  try{
    const result={created:{technicians:[],customers:[],sales_orders:[],tickets:[],crm_work_orders:[]},skipped:[]};

    const existingUsers=await db.getUsersWithPassword();
    const techSpecs=[
      ['stg.tech.made','STG Teknisi Made'],['stg.tech.wayan','STG Teknisi Wayan'],
      ['stg.tech.komang','STG Teknisi Komang'],['stg.tech.kadek','STG Teknisi Kadek']
    ];
    for(const [username,name] of techSpecs){
      let u=existingUsers.find(x=>x.username===username);
      if(!u){u=await db.insertUser({username,password:'DemoTech#2026',name,role:'technician',custom_menus:[],extra_roles:[],is_active:true});result.created.technicians.push(u);}
      else result.skipped.push(`user:${username}`);
    }

    let customers=await db.getCrmCustomers();
    const customerSpecs=[
      {name:'STG-DEMO Villa Samudra',type:'B2B',sales_pic:'Admin Staging',phone:'081200000101',address:'Canggu, Bali'},
      {name:'STG-DEMO Restoran Purnama',type:'B2B',sales_pic:'Admin Staging',phone:'081200000102',address:'Denpasar, Bali'},
      {name:'STG-DEMO Toko Teknologi',type:'B2C',sales_pic:'Admin Staging',phone:'081200000103',address:'Badung, Bali'}
    ];
    const demoCustomers=[];
    for(const spec of customerSpecs){
      let c=customers.find(x=>x.source_marker===STAGING_DEMO_MARKER&&x.name===spec.name);
      if(!c){c=await db.insertCrmCustomer({...spec,normalized_phone:normalizeDemoPhone(spec.phone),status:'active',source_marker:STAGING_DEMO_MARKER,created_by:req.session.user.name});result.created.customers.push(c);customers.push(c);}
      else result.skipped.push(`customer:${spec.name}`);
      demoCustomers.push(c);
    }

    let sos=await db.getSalesOrders();
    const soSpecs=[
      {key:'SO-001',customer:demoCustomers[0],status:'approved',items:[{item_name:'CCTV 2MP',qty:4,unit_price:0,item_type:'item'},{item_name:'Instalasi CCTV',qty:1,unit_price:0,item_type:'service'}]},
      {key:'SO-002',customer:demoCustomers[1],status:'approved',items:[{item_name:'Access Point',qty:3,unit_price:0,item_type:'item'}]},
      {key:'SO-003',customer:demoCustomers[2],status:'draft',items:[{item_name:'Switch PoE 8 Port',qty:1,unit_price:0,item_type:'item'}]}
    ];
    const demoSos=[];
    for(const spec of soSpecs){
      let so=sos.find(x=>x.source_marker===STAGING_DEMO_MARKER&&x.integration_key===`${STAGING_DEMO_MARKER}-${spec.key}`);
      if(!so){so=await db.insertSalesOrder({customer_id:spec.customer.id,customer_name:spec.customer.name,customer_phone:spec.customer.phone,items:spec.items,total_amount:0,status:spec.status,source_marker:STAGING_DEMO_MARKER,integration_key:`${STAGING_DEMO_MARKER}-${spec.key}`,notes:'Data sampling fondasi integrasi WO',created_by:req.session.user.name});result.created.sales_orders.push(so);sos.push(so);}
      else result.skipped.push(`sales-order:${spec.key}`);
      demoSos.push(so);
    }

    let tickets=await db.getTickets(null,true);
    let crmWos=await db.getCrmWorkOrders();
    const woSpecs=[
      {no:'STG-DEMO-WO-001',customer:demoCustomers[0],so:demoSos[0],tech:'STG Teknisi Made',days:1},
      {no:'STG-DEMO-WO-002',customer:demoCustomers[1],so:demoSos[1],tech:'STG Teknisi Wayan',days:1},
      {no:'STG-DEMO-WO-003',customer:demoCustomers[2],so:null,tech:'STG Teknisi Komang',days:2},
      {no:'STG-DEMO-WO-004',customer:demoCustomers[0],so:null,tech:'STG Teknisi Kadek',days:2},
      {no:'STG-DEMO-WO-005',customer:demoCustomers[1],so:null,tech:'STG Teknisi Made',days:3},
      {no:'STG-DEMO-WO-006',customer:demoCustomers[2],so:null,tech:'STG Teknisi Wayan',days:4}
    ];
    for(const spec of woSpecs){
      const integrationKey=`${STAGING_DEMO_MARKER}-${spec.no}`;
      let ticket=tickets.find(x=>x.integration_key===integrationKey||x.wo_number===spec.no);
      if(!ticket){
        const now=new Date().toISOString();
        ticket=await db.insertTicket({
          wo_number:spec.no,project_name:`Sampling ${spec.customer.name}`,customer_name:spec.customer.name,
          customer_phone:spec.customer.phone,technicians:[spec.tech],technician:spec.tech,created_by:req.session.user.name,
          status:'assigned',worked_at:demoDate(spec.days),description:'Data sampling PXL-STG-0002. Status KPI existing tetap digunakan.',
          rating:0,tracking_token:crypto.randomBytes(14).toString('hex'),last_lat:null,last_lng:null,last_gps_at:null,
          source_type:spec.so?'sales_order':'manual',sales_order_id:spec.so?.id||null,so_number:spec.so?.so_number||null,
          crm_customer_id:spec.customer.id,integration_key:integrationKey,integration_meta:{revision:'PXL-STG-0002',demo:true}
        });
        await db.insertStatusHistory({ticket_id:ticket.id,status:'assigned',timestamp:now,technician:req.session.user.name,lat:null,lng:null});
        result.created.tickets.push(ticket);tickets.push(ticket);
      }else result.skipped.push(`ticket:${spec.no}`);

      let crmWo=crmWos.find(x=>x.integration_key===integrationKey||x.wo_number===spec.no);
      if(!crmWo){
        crmWo=await db.insertCrmWorkOrder({number_source:'manual',wo_number:spec.no,ticket_id:ticket.id,
          sales_order_id:spec.so?.id||null,so_number:spec.so?.so_number||null,customer_id:spec.customer.id,
          customer_name:spec.customer.name,customer_phone:spec.customer.phone,source_type:spec.so?'sales_order':'manual',
          integration_key:integrationKey,source_marker:STAGING_DEMO_MARKER,status:'draft',created_by:req.session.user.name});
        result.created.crm_work_orders.push(crmWo);crmWos.push(crmWo);
      }else result.skipped.push(`crm-work-order:${spec.no}`);

      if(spec.so && (!spec.so.linked_work_order_id || spec.so.linked_work_order_id!==ticket.id)){
        const updated=await db.updateSalesOrder(spec.so.id,{linked_work_order_id:ticket.id,linked_wo_number:ticket.wo_number,converted_to_wo_at:new Date().toISOString()});
        Object.assign(spec.so,updated);
      }
    }

    logActivity(req,'staging','SEED DEMO WO FOUNDATION',`PXL-STG-0002 · ${result.created.tickets.length} WO dibuat`);
    res.status(201).json({ok:true,revision:'PXL-STG-0002',credentials:{technician_username_prefix:'stg.tech.',password:'DemoTech#2026'},...result});
  }catch(e){
    const message=String(e.message||e);
    const migrationHint=/column|schema cache|PGRST/i.test(message)?' Jalankan SQL PXL-STG-0002 terlebih dahulu pada Supabase staging.':'';
    res.status(500).json({error:message+migrationHint});
  }
});

app.delete('/api/staging/demo/wo-foundation', requireRole('superadmin'), async (req,res)=>{
  if(!IS_STAGING) return res.status(403).json({error:'Cleanup dummy hanya tersedia pada staging.'});
  try{
    const out={tickets:0,crm_work_orders:0,sales_orders:0,customers:0,technicians:0};
    const [tickets,wos,sos,customers,users]=await Promise.all([db.getTickets(null,true),db.getCrmWorkOrders(),db.getSalesOrders(),db.getCrmCustomers(),db.getUsersWithPassword()]);
    for(const row of wos.filter(x=>x.source_marker===STAGING_DEMO_MARKER)){await db.deleteCrmWorkOrder(row.id);out.crm_work_orders++;}
    for(const row of tickets.filter(x=>String(x.integration_key||'').startsWith(STAGING_DEMO_MARKER))){await db.deleteTicket(row.id);out.tickets++;}
    for(const row of sos.filter(x=>x.source_marker===STAGING_DEMO_MARKER)){await db.deleteSalesOrder(row.id);out.sales_orders++;}
    for(const row of customers.filter(x=>x.source_marker===STAGING_DEMO_MARKER)){await db.deleteCrmCustomer(row.id);out.customers++;}
    for(const row of users.filter(x=>String(x.username||'').startsWith('stg.tech.'))){await db.deleteUser(row.id);out.technicians++;}
    logActivity(req,'staging','HAPUS DEMO WO FOUNDATION',`PXL-STG-0002 · ${out.tickets} WO dihapus`);
    res.json({ok:true,deleted:out});
  }catch(e){res.status(500).json({error:e.message});}
});

// ══════════════════════════════════════════
// CRM + SALES ORDER FLOW — PXL-REV-0035 CUMULATIVE
// ══════════════════════════════════════════
const CRM_WRITE_ROLES=['sales','manager','admin','superadmin'];
function hasSalesOrderPermission(req, permission){
  const u=req.session?.user||{};
  const custom=Array.isArray(u.custom_menus)?u.custom_menus:[];
  if(u.custom_menus_override===true) return custom.includes(permission);
  if(String(u.role||'').toLowerCase()==='superadmin') return true;
  return custom.includes(permission);
}
function requireSalesOrderPermission(permission){
  return (req,res,next)=>{
    if(!req.session?.user)return res.status(401).json({error:'Unauthorized'});
    if(!hasSalesOrderPermission(req,permission))return res.status(403).json({error:permission==='sales_order_approve'?'Anda tidak memiliki izin Setujui Sales Order.':'Anda tidak memiliki izin Buat Work Order.'});
    next();
  };
}
app.get('/api/crm/report',requireRole(...CRM_READ_ROLES),async(req,res)=>{try{res.json(await db.getCrmReport())}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/crm/customers',requireRole(...CRM_READ_ROLES),async(req,res)=>{try{res.json(await db.getCrmCustomers())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/customers',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{if(!req.body.name)return res.status(400).json({error:'Nama customer wajib diisi'});const x=await db.insertCrmCustomer({...req.body,created_by:req.session.user.name});logActivity(req,'crm','BUAT CUSTOMER',x.name);res.status(201).json(x)}catch(e){res.status(500).json({error:e.message})}});
app.patch('/api/crm/customers/:id',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{res.json(await db.updateCrmCustomer(req.params.id,req.body))}catch(e){res.status(500).json({error:e.message})}});
app.delete('/api/crm/customers/:id',requireRole('superadmin'),async(req,res)=>{try{const deleted=await db.deleteCrmCustomer(req.params.id);logActivity(req,'crm','HAPUS CUSTOMER',deleted?.name||req.params.id);res.json({ok:true,deleted})}catch(e){const status=/foreign key|constraint|reference/i.test(String(e.message))?409:500;res.status(status).json({error:status===409?'Customer masih terhubung dengan data lain dan belum dapat dihapus.':e.message})}});


// PXL-STG-0003B/0003C/STG-0004 — options, approval, MR and inventory issue.
app.get('/api/sales-orders/options',requireRole(...SO_READ_ROLES),async(req,res)=>{
  try{
    const [users,inventory]=await Promise.all([db.getUsers(),db.getInventoryItems()]);
    const salesUsers=(users||[]).filter(u=>u.is_active!==false&&(u.role==='sales'||(u.extra_roles||[]).includes('sales')))
      .map(u=>({id:u.id,name:u.name,email:u.email||null,role:u.role}));
    const items=(inventory||[]).filter(i=>i.is_active!==false).map(i=>({id:i.id,name:i.name,sku:i.sku||null,unit:i.unit||'pcs',stock:Number(i.stock||0),tracking_mode:i.tracking_mode||'quantity'}));
    res.json({sales_users:salesUsers,inventory_items:items,current_user:{id:req.session.user.id,name:req.session.user.name,role:req.session.user.role},can_approve:hasSalesOrderPermission(req,'sales_order_approve'),can_issue:hasSalesOrderPermission(req,'sales_order_create_wo')});
  }catch(e){res.status(500).json({error:e.message})}
});

app.post('/api/sales-orders/:id/approve',requireSalesOrderPermission('sales_order_approve'),async(req,res)=>{
  try{
    const so=(await db.getSalesOrders()).find(x=>String(x.id)===String(req.params.id));
    if(!so)return res.status(404).json({error:'SO tidak ditemukan'});
    if(so.status!=='draft')return res.status(400).json({error:'Hanya SO Draft yang dapat disetujui.'});
    const history=[...(so.history||[]),{at:new Date().toISOString(),by:req.session.user.name,action:'approve',from_status:so.status,status:'approved'}];
    const x=await db.updateSalesOrder(so.id,{status:'approved',approved_by:req.session.user.name,approved_at:new Date().toISOString(),history});
    logActivity(req,'so','SETUJUI SALES ORDER',so.so_number);res.json(x);
  }catch(e){res.status(500).json({error:e.message})}
});

app.post('/api/sales-orders/:id/cancel',requireRole('manager','admin','superadmin'),async(req,res)=>{
  try{
    const so=(await db.getSalesOrders()).find(x=>String(x.id)===String(req.params.id));
    if(!so)return res.status(404).json({error:'SO tidak ditemukan'});
    if(so.linked_work_order_id)return res.status(400).json({error:'SO yang sudah memiliki WO tidak dapat dibatalkan langsung.'});
    const target=req.body.status==='void'?'void':'cancelled';
    const history=[...(so.history||[]),{at:new Date().toISOString(),by:req.session.user.name,action:target,from_status:so.status,status:target,note:req.body.note||null}];
    const x=await db.updateSalesOrder(so.id,{status:target,cancelled_by:req.session.user.name,cancelled_at:new Date().toISOString(),history});
    logActivity(req,'so',target==='void'?'VOID SALES ORDER':'BATALKAN SALES ORDER',so.so_number);res.json(x);
  }catch(e){res.status(500).json({error:e.message})}
});

app.post('/api/sales-orders/:id/material-request',requireRole('sales','manager','admin','superadmin'),async(req,res)=>{
  try{
    const so=(await db.getSalesOrders()).find(x=>String(x.id)===String(req.params.id));
    if(!so)return res.status(404).json({error:'SO tidak ditemukan'});
    if(!so.linked_work_order_id)return res.status(400).json({error:'Buat Work Order terlebih dahulu.'});
    const all=await db.getCrmMaterialRequests();
    let mr=all.find(x=>String(x.sales_order_id||'')===String(so.id)&&String(x.work_order_id||'')===String(so.linked_work_order_id)&&!['cancelled','void'].includes(x.status));
    let created=false;
    if(!mr){
      const items=(so.items||[]).filter(i=>(i.item_type||'item')!=='service').map(i=>({inventory_item_id:i.inventory_item_id||null,name:i.item_name||i.name,qty:Number(i.qty||0),unit:i.unit||'pcs',stock_at_request:i.stock_at_select??null}));
      if(!items.length)return res.status(400).json({error:'SO tidak memiliki item Inventory untuk Material Request.'});
      mr=await db.insertCrmMaterialRequest({sales_order_id:so.id,so_number:so.so_number,work_order_id:so.linked_work_order_id,wo_number:so.linked_wo_number,customer_name:so.customer_name,items,technician:null,created_by:req.session.user.name});created=true;
      logActivity(req,'mr','BUAT MR DARI WO',`${so.linked_wo_number} / ${so.so_number}`);
    }
    res.status(created?201:200).json({created,material_request:mr});
  }catch(e){res.status(500).json({error:e.message})}
});

app.post('/api/crm/material-requests/:id/issue',requireRole('manager','admin','superadmin'),async(req,res)=>{
  try{
    const mr=(await db.getCrmMaterialRequests()).find(x=>String(x.id)===String(req.params.id));
    if(!mr)return res.status(404).json({error:'Material Request tidak ditemukan'});
    if(mr.status==='issued')return res.status(409).json({error:'Material Request sudah pernah dikeluarkan.'});
    const items=(mr.items||[]).map(i=>({inventory_item_id:i.inventory_item_id,qty_out:Number(i.qty||0)}));
    if(items.some(i=>!i.inventory_item_id||i.qty_out<=0))return res.status(400).json({error:'Ada item MR yang belum terhubung ke Inventory atau qty tidak valid.'});
    const result=await db.issueInventoryMaterialRequest(mr.id,items,req.session.user.name,mr.wo_number||mr.mr_number||'Material Request');
    const updated=await db.updateCrmMaterialRequest(mr.id,{status:'issued',issued_by:req.session.user.name,issued_at:new Date().toISOString(),inventory_issue_result:result});
    logActivity(req,'inventory','KELUARKAN MATERIAL MR',`${mr.mr_number} / ${mr.wo_number||'-'}`);res.json({ok:true,material_request:updated,result});
  }catch(e){res.status(400).json({error:e.message})}
});

app.get('/api/sales-orders',requireRole(...SO_READ_ROLES),async(req,res)=>{try{res.json(await db.getSalesOrders())}catch(e){res.status(500).json({error:e.message})}});
// PXL-PROD-0022B — reusable Site templates for Sales Order.
app.get('/api/sales-orders/site-templates',requireRole(...SO_READ_ROLES),async(req,res)=>{
  try{res.json(await db.getSalesOrderSiteTemplates())}catch(e){res.status(500).json({error:e.message})}
});
app.post('/api/sales-orders/site-templates',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{
  try{
    const template_name=String(req.body.template_name||'').trim();
    const items=Array.isArray(req.body.items)?req.body.items:[];
    if(!template_name)return res.status(400).json({error:'Nama template wajib diisi'});
    if(!items.length)return res.status(400).json({error:'Template Site harus memiliki minimal satu Material/Jasa'});
    const invalid=items.some(i=>{const service=['service','jasa'].includes(String(i.item_type||i.type||'item').toLowerCase());return !i.name||Number(i.qty||0)<=0||(!service&&!i.inventory_item_id)});
    if(invalid)return res.status(400).json({error:'Ada item template yang belum lengkap atau Material belum terhubung ke Inventory'});
    const row=await db.insertSalesOrderSiteTemplate({template_name,description:req.body.description||null,items,created_by:req.session.user.name});
    logActivity(req,'so','BUAT TEMPLATE SITE',template_name);
    res.status(201).json(row);
  }catch(e){res.status(400).json({error:e.message})}
});

app.post('/api/sales-orders',requireRole(...CRM_WRITE_ROLES),blockStagingDemoOnProduction,async(req,res)=>{
  try{
    // PXL-PROD-0022A — validate Material + Jasa per Site without changing existing SO→WO→MR flow.
    if(!req.body.customer_name)return res.status(400).json({error:'Customer wajib diisi'});
    if(!req.body.sales_pic_user_id)return res.status(400).json({error:'Sales PIC wajib dipilih dari akun Sales'});
    if(!req.body.project_name)return res.status(400).json({error:'Nama project wajib diisi'});
    if(!req.body.address)return res.status(400).json({error:'Alamat/lokasi pekerjaan wajib diisi'});
    const items=Array.isArray(req.body.items)?req.body.items:[];
    const invalid=items.some(i=>{
      const service=['service','jasa'].includes(String(i.item_type||i.type||'item').toLowerCase());
      return !i.name||Number(i.qty||0)<=0||(!service&&!i.inventory_item_id);
    });
    if(!items.length||invalid)return res.status(400).json({error:'Minimal satu Material/Jasa valid wajib diisi. Material wajib dipilih dari Inventory.'});
    const total=items.reduce((s,i)=>s+Number(i.qty||0)*Number(i.unit_price||0),0);
    const x=await db.insertSalesOrder({...req.body,status:'draft',items,total_amount:req.body.total_amount??total,created_by:req.session.user.name});
    logActivity(req,'so','BUAT SALES ORDER',x.so_number);
    res.status(201).json(x);
  }catch(e){res.status(500).json({error:e.message})}
});
app.patch('/api/sales-orders/:id',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{const old=(await db.getSalesOrders()).find(x=>x.id===req.params.id);if(!old)return res.status(404).json({error:'SO tidak ditemukan'});if(req.body.delete===true)return res.status(400).json({error:'Sales Order tidak dapat dihapus. Gunakan status void/cancelled.'});const history=[...(old.history||[]),{at:new Date().toISOString(),by:req.session.user.name,action:'update',status:req.body.status||old.status}];res.json(await db.updateSalesOrder(req.params.id,{...req.body,history}))}catch(e){res.status(500).json({error:e.message})}});


// PXL-STG-0003 — konversi Sales Order menjadi WO operasional existing.
// Idempotent: satu Sales Order hanya boleh terhubung ke satu ticket/WO.
app.post('/api/sales-orders/:id/work-order',requireSalesOrderPermission('sales_order_create_wo'),async(req,res)=>{
  try{
    const salesOrders=await db.getSalesOrders();
    const so=salesOrders.find(x=>String(x.id)===String(req.params.id));
    if(!so) return res.status(404).json({error:'Sales Order tidak ditemukan.'});
    if(['cancelled','void'].includes(String(so.status||'').toLowerCase())){
      return res.status(400).json({error:'Sales Order batal/void tidak dapat dibuatkan Work Order.'});
    }
    if(String(so.status||'').toLowerCase()!=='approved'){
      return res.status(400).json({error:'Sales Order harus berstatus Disetujui sebelum dibuatkan Work Order.'});
    }

    const integrationKey=`sales-order:${so.id}`;
    const tickets=await db.getTickets(null,true);
    let ticket=tickets.find(x=>
      String(x.sales_order_id||'')===String(so.id)||
      String(x.integration_key||'')===integrationKey||
      (so.linked_work_order_id&&String(x.id)===String(so.linked_work_order_id))
    );
    let created=false;

    if(!ticket){
      const year=new Date().getFullYear();
      const re=new RegExp(`^WO-${year}-(\\d+)$`);
      const max=tickets.reduce((m,row)=>{const hit=String(row.wo_number||'').match(re);return hit?Math.max(m,Number(hit[1])):m},0);
      const woNumber=`WO-${year}-${String(max+1).padStart(6,'0')}`;
      const itemSummary=(Array.isArray(so.items)?so.items:[]).map(i=>{
        const name=i.item_name||i.name||'Item';
        return `${name} x ${Number(i.qty||0)}`;
      }).join(', ');
      const now=new Date().toISOString();
      const workedAt=req.body.worked_at||new Date().toISOString().slice(0,10);
      ticket=await db.insertTicket({
        wo_number:woNumber,
        project_name:req.body.project_name||so.project_name||`Pekerjaan ${so.so_number}`,
        customer_name:so.customer_name||null,
        customer_phone:so.customer_phone||null,
        technicians:[],
        technician:'Belum Ditugaskan',
        created_by:req.session.user.name,
        status:'assigned',
        worked_at:workedAt,
        description:req.body.description||[`Dibuat otomatis dari ${so.so_number}.`,so.address?`Lokasi pekerjaan: ${so.address}.`:'',so.notes||'',itemSummary?`Item: ${itemSummary}`:''].filter(Boolean).join(' '),
        rating:0,
        tracking_token:crypto.randomBytes(14).toString('hex'),
        last_lat:null,last_lng:null,last_gps_at:null,
        source_type:'sales_order',
        sales_order_id:so.id,
        so_number:so.so_number,
        crm_customer_id:so.customer_id||null,
        integration_key:integrationKey,
        integration_meta:{revision:'PXL-STG-0003B-0003C-STG-0004',source:'sales_order',created_from_so_at:now,work_address:so.address||null}
      });
      await db.insertStatusHistory({ticket_id:ticket.id,status:'assigned',timestamp:now,technician:req.session.user.name,lat:null,lng:null});
      created=true;
    }

    // Mirror CRM bersifat ringkasan; ticket tetap menjadi sumber operasional dan KPI.
    const crmWos=await db.getCrmWorkOrders();
    let crmWo=crmWos.find(x=>
      String(x.ticket_id||'')===String(ticket.id)||
      String(x.sales_order_id||'')===String(so.id)||
      String(x.integration_key||'')===integrationKey
    );
    if(!crmWo){
      crmWo=await db.insertCrmWorkOrder({
        number_source:'manual',wo_number:ticket.wo_number,ticket_id:ticket.id,
        sales_order_id:so.id,so_number:so.so_number,customer_id:so.customer_id||null,
        customer_name:so.customer_name||null,customer_phone:so.customer_phone||null,
        source_type:'sales_order',integration_key:integrationKey,
        source_marker:so.source_marker||null,status:'draft',created_by:req.session.user.name
      });
    }

    const history=[...(so.history||[])];
    if(!history.some(h=>h.action==='create_work_order'&&String(h.ticket_id||'')===String(ticket.id))){
      history.push({at:new Date().toISOString(),by:req.session.user.name,action:'create_work_order',ticket_id:ticket.id,wo_number:ticket.wo_number});
    }
    await db.updateSalesOrder(so.id,{linked_work_order_id:ticket.id,linked_wo_number:ticket.wo_number,converted_to_wo_at:so.converted_to_wo_at||new Date().toISOString(),history});
    logActivity(req,'so',created?'BUAT WO DARI SALES ORDER':'BUKA WO SALES ORDER',`${so.so_number} → ${ticket.wo_number}`);
    res.status(created?201:200).json({ok:true,created,ticket,crm_work_order:crmWo});
  }catch(e){
    const duplicate=/duplicate key|unique constraint|23505/i.test(String(e.message));
    res.status(duplicate?409:500).json({error:duplicate?'Sales Order ini sudah memiliki Work Order. Muat ulang daftar Sales Order.':e.message});
  }
});

app.get('/api/crm/work-orders',requireAuth,async(req,res)=>{try{res.json(await db.getCrmWorkOrders())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/work-orders',requireRole(...CRM_WRITE_ROLES),blockStagingDemoOnProduction,async(req,res)=>{try{const payload={...req.body,sales_order_id:req.body.sales_order_id||null,so_number:req.body.so_number||null,created_by:req.session.user.name};const x=await db.insertCrmWorkOrder(payload);logActivity(req,'wo','BUAT WO',x.wo_number);res.status(201).json(x)}catch(e){res.status(400).json({error:e.message})}});
app.patch('/api/crm/work-orders/:id',requireAuth,async(req,res)=>{try{res.json(await db.updateCrmWorkOrder(req.params.id,req.body))}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/crm/material-requests',requireAuth,async(req,res)=>{try{res.json(await db.getCrmMaterialRequests())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/material-requests/from-so/:soId',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{const so=(await db.getSalesOrders()).find(x=>x.id===req.params.soId);if(!so)return res.status(404).json({error:'SO tidak ditemukan'});const items=(so.items||[]).filter(x=>(x.item_type||'item')!=='service');const x=await db.insertCrmMaterialRequest({sales_order_id:so.id,so_number:so.so_number,work_order_id:req.body.work_order_id||null,wo_number:req.body.wo_number||null,customer_name:so.customer_name,items,technician:req.body.technician||null,created_by:req.session.user.name});logActivity(req,'mr','BUAT MR DARI SO',x.mr_number);res.status(201).json(x)}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/material-requests/:id/verify',requireRole('technician','manager','admin','superadmin'),async(req,res)=>{try{if(!req.body.technician_signature)return res.status(400).json({error:'Tanda tangan teknisi wajib diisi'});const x=await db.updateCrmMaterialRequest(req.params.id,{status:'verified_signed',technician:req.session.user.name,technician_note:req.body.technician_note||null,technician_signature:req.body.technician_signature,verified_at:new Date().toISOString(),verified_items:req.body.items||null});logActivity(req,'mr','VERIFIKASI & SIGN TEKNISI',x.mr_number||req.params.id);res.json(x)}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/crm/additional-materials',requireAuth,async(req,res)=>{try{res.json(await db.getAdditionalMaterialRequests())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/additional-materials',requireRole('technician','manager','admin','superadmin'),async(req,res)=>{try{if(!req.body.work_order_id||!Array.isArray(req.body.items)||!req.body.items.length)return res.status(400).json({error:'WO dan item tambahan wajib diisi'});const x=await db.insertAdditionalMaterialRequest({...req.body,requested_by:req.session.user.name});logActivity(req,'amr','AJUKAN TAMBAHAN MATERIAL',x.amr_number);res.status(201).json(x)}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/additional-materials/:id/internal-approve',requireRole('manager','admin','superadmin'),async(req,res)=>{try{res.json(await db.updateAdditionalMaterialRequest(req.params.id,{status:'waiting_customer_approval',internal_approved_by:req.session.user.name,internal_approved_at:new Date().toISOString()}))}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/additional-materials/:id/customer-approve',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{if(!req.body.customer_approval_name)return res.status(400).json({error:'Nama pemberi persetujuan customer wajib diisi'});res.json(await db.updateAdditionalMaterialRequest(req.params.id,{status:'approved',customer_approval_name:req.body.customer_approval_name,customer_approved_at:new Date().toISOString()}))}catch(e){res.status(500).json({error:e.message})}});


function normalizeWaNumber(v){const d=String(v||'').replace(/\D/g,'');if(!d)return'';if(d.startsWith('62'))return d;if(d.startsWith('0'))return '62'+d.slice(1);return '62'+d;}
app.get('/api/crm/whatsapp-templates',requireRole(...CRM_READ_ROLES),async(req,res)=>{try{res.json(await db.getWhatsappTemplates())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/communications',requireRole(...CRM_READ_ROLES),async(req,res)=>{try{if(!req.body.customer_id||!req.body.channel)return res.status(400).json({error:'Customer dan channel wajib'});const x=await db.insertCommunicationHistory({...req.body,created_by:req.session.user.name,communication_at:new Date().toISOString()});await db.updateCrmCustomer(req.body.customer_id,{last_communication_at:x.communication_at,last_communication_channel:req.body.channel,next_follow_up_at:req.body.next_follow_up_at||null});res.status(201).json(x)}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/crm/communications/all',requireRole(...CRM_READ_ROLES),async(req,res)=>{try{res.json(await db.getCommunicationHistory())}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/crm/communications/:customerId',requireRole(...CRM_READ_ROLES),async(req,res)=>{try{const rows=await db.getCommunicationHistory();res.json(rows.filter(x=>x.customer_id===req.params.customerId))}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/customer-import/staging',requireRole('admin','superadmin'),async(req,res)=>{try{const rows=Array.isArray(req.body)?req.body:[req.body];const out=[];for(const r of rows){out.push(await db.insertCustomerImportStaging({...r,normalized_phone:normalizeWaNumber(r.phone),import_status:'pending'}))}res.status(201).json(out)}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/customer-import/:id/commit',requireRole('admin','superadmin'),async(req,res)=>{try{const rows=await db.getCustomerImportStaging();const r=rows.find(x=>x.id===req.params.id);if(!r)return res.status(404).json({error:'Data staging tidak ditemukan'});const customers=await db.getCrmCustomers();let c=customers.find(x=>(r.legacy_customer_id&&x.legacy_customer_id===r.legacy_customer_id&&x.source_name===r.source_name)||(r.normalized_phone&&x.normalized_phone===r.normalized_phone));if(c)c=await db.updateCrmCustomer(c.id,{name:r.name,type:r.type,sales_pic:r.sales_pic,phone:r.phone,normalized_phone:r.normalized_phone,email:r.email,address:r.address});else c=await db.insertCrmCustomer({name:r.name,type:r.type||'B2B',sales_pic:r.sales_pic,phone:r.phone,normalized_phone:r.normalized_phone,email:r.email,address:r.address,legacy_customer_id:r.legacy_customer_id,source_name:r.source_name||'existing_customer',status:'active',created_by:req.session.user.name});await db.updateCustomerImportStaging(r.id,{import_status:'imported',matched_customer_id:c.id});res.json(c)}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/crm/invoices',requireRole(...INVOICE_READ_ROLES),async(req,res)=>{try{res.json(await db.getCrmInvoices())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/invoices/from-so/:soId',requireRole('accounting','manager','admin','superadmin'),async(req,res)=>{try{const so=(await db.getSalesOrders()).find(x=>x.id===req.params.soId);if(!so)return res.status(404).json({error:'SO tidak ditemukan'});const amrs=(await db.getAdditionalMaterialRequests()).filter(x=>x.sales_order_id===so.id&&x.status==='approved');const additional=amrs.flatMap(x=>(x.items||[]).map(i=>({...i,amr_number:x.amr_number})));const base=Number(so.total_amount||0),extra=additional.reduce((s,i)=>s+Number(i.qty||0)*Number(i.unit_price||0),0);const grand=base+extra,downPayment=Number(req.body.down_payment||0),redemption=Number(req.body.redemption||0);const x=await db.insertCrmInvoice({sales_order_id:so.id,so_number:so.so_number,customer_id:so.customer_id||null,customer_name:so.customer_name,work_order_ids:req.body.work_order_ids||[],items:so.items||[],additional_items:additional,base_total:base,additional_total:extra,grand_total:grand,invoice_date:req.body.invoice_date||new Date().toISOString().slice(0,10),due_date:req.body.due_date||null,down_payment:downPayment,redemption,balance_due:Math.max(0,grand-downPayment-redemption),payment_method:req.body.payment_method||'CASH & TRANSFER BANK',remark:req.body.remark||null,billing_address:req.body.billing_address||null,created_by:req.session.user.name});for(const a of amrs)await db.updateAdditionalMaterialRequest(a.id,{status:'invoiced',invoice_id:x.id});logActivity(req,'invoice','BUAT INVOICE DARI SO',x.invoice_number);res.status(201).json(x)}catch(e){res.status(500).json({error:e.message})}});

// ══════════════════════════════════════════
//  AUTO-DELETE ATTACHMENT (14 hari)
//  File fisik dihapus, metadata tetap ada
// ══════════════════════════════════════════
const ATTACH_EXPIRE_DAYS = 14;

async function cleanExpiredAttachments() {
  try {
    const now      = new Date();
    const tickets  = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
    let   changed  = false;
    let   deleted  = 0;

    tickets.forEach(ticket => {
      (ticket.invoices || []).forEach(inv => {
        // skip jika sudah ditandai expired atau tidak punya file_url lokal
        if (inv.file_deleted) return;
        if (!inv.file_url || !inv.uploaded_at) return;

        const uploadedAt = new Date(inv.uploaded_at);
        const ageMs      = now - uploadedAt;
        const ageDays    = ageMs / (1000 * 60 * 60 * 24);

        if (ageDays >= ATTACH_EXPIRE_DAYS) {
          // Hapus file fisik
          const filename  = inv.file_url.replace('/uploads/', '');
          const filepath  = path.join(UPLOADS_DIR, filename);
          if (fs.existsSync(filepath)) {
            try {
              fs.unlinkSync(filepath);
              deleted++;
              console.log(`🗑️  Auto-delete: ${filename} (${Math.floor(ageDays)} hari)`);
            } catch(e) {
              console.error(`⚠️  Gagal hapus file: ${filename}`, e.message);
            }
          }
          // Tandai di metadata — file sudah dihapus, data tetap ada
          inv.file_deleted    = true;
          inv.file_deleted_at = now.toISOString();
          inv.file_url        = null;   // clear url, metadata lain tetap
          changed = true;
        }
      });
    });

    if (changed) {
      fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
      console.log(`✅ Auto-delete selesai: ${deleted} file dihapus`);
    }
  } catch(e) {
    console.error('❌ Auto-delete error:', e.message);
  }
}

// ══════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const notifs = await db.getNotificationsForUser(req.session.user);
    // Tandai is_read per user berdasarkan read_by array
    const withReadState = notifs.map(n => ({
      ...n,
      is_read: Array.isArray(n.read_by) && n.read_by.includes(req.session.user.id)
    }));
    res.json(withReadState);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await db.markNotificationRead(req.params.id, req.session.user.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await db.markAllNotificationsRead(req.session.user);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Helper dipakai di seluruh route lain untuk membuat notifikasi baru
async function createNotification({ type, text, target_role, target_user_id, ref_id, created_by }) {
  try {
    await db.insertNotification({ type, text, target_role: target_role || null, target_user_id: target_user_id || null, ref_id: ref_id || null, created_by: created_by || null });
  } catch(e) {
    console.error('Gagal membuat notifikasi:', e.message);
  }
}



// ══════════════════════════════════════════
//  INVENTORY — PXL-REV-0050
//  Memulihkan API Inventory yang sempat hilang dari server cumulative CRM/RBAC.
// ══════════════════════════════════════════
function hasInventoryAccess(req, permission) {
  const user = req.session?.user || {};
  const role = String(user.role || '').toLowerCase().replace(/[ _-]/g, '');
  if (role === 'superadmin') return true;
  // Sesuai RBAC PXL-REV-0048/0049: teknisi tidak dapat membuka modul Inventory.
  if (role === 'technician') return false;

  const custom = Array.isArray(user.custom_menus) ? user.custom_menus : [];
  const defaults = {
    inventory_view: ['admin', 'manager'],
    inventory_manage: ['admin', 'manager'],
    inventory_import_export: ['admin', 'manager'],
    inventory_barcode: ['admin', 'manager'],
    inventory_opname: ['admin', 'manager']
  };
  // Opsi B: default divisi + custom access sebagai tambahan.
  if ((defaults[permission] || []).includes(role)) return true;
  if (custom.includes(permission)) return true;
  if (permission === 'inventory_view' && custom.includes('inventory')) return true;
  return false;
}

function requireInventoryPermission(permission) {
  return (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (permission === 'inventory_delete' && String(req.session.user.role || '').toLowerCase().replace(/[ _-]/g, '') !== 'superadmin') {
      return res.status(403).json({ error: 'Hapus inventory hanya untuk Super Admin.' });
    }
    if (!hasInventoryAccess(req, permission)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses fitur Inventory ini.' });
    }
    next();
  };
}

function inventoryCellValue(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return value.result ?? '';
    if (Array.isArray(value.richText)) return value.richText.map(x => x.text || '').join('');
    if (Object.prototype.hasOwnProperty.call(value, 'text')) return value.text ?? '';
    if (Object.prototype.hasOwnProperty.call(value, 'hyperlink')) return value.text || value.hyperlink || '';
  }
  return value;
}

function inventoryParseNumber(value) {
  if (typeof value === 'number') return value;
  let text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return 0;
  if (text.includes('.') && text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.includes(',')) text = text.replace(',', '.');
  return Number(text);
}

function inventorySheetToRows(worksheet) {
  const headerMap = new Map();
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const key = String(inventoryCellValue(cell) || '').trim().toLowerCase();
    if (key) headerMap.set(key, col);
  });
  const findCol = names => {
    for (const name of names) {
      const col = headerMap.get(String(name).toLowerCase());
      if (col) return col;
    }
    return null;
  };
  const cols = {
    name: findCol(['Nama Barang', 'Nama Item', 'name']),
    sku: findCol(['SKU', 'sku']),
    product_number: findCol(['Product Number', 'product_number']),
    barcode: findCol(['Barcode', 'barcode']),
    category: findCol(['Kategori', 'Main Kategori', 'category']),
    subcategory: findCol(['Sub Kategori', 'Subkategori', 'subcategory']),
    unit: findCol(['Satuan', 'unit']),
    stock: findCol(['Stok', 'Stok Import', 'Stok Cut Off', 'Stok Saat Ini', 'Qty', 'Quantity', 'stock']),
    min_stock: findCol(['Minimum Stok', 'Stok Minimum', 'min_stock'])
  };
  if (!cols.name || !cols.stock) {
    throw new Error('Header wajib Nama Barang dan Stok tidak ditemukan pada sheet pertama.');
  }
  const get = (row, col) => col ? inventoryCellValue(row.getCell(col)) : '';
  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rawName = String(get(row, cols.name) ?? '').trim();
    const rawStock = get(row, cols.stock);
    const hasAny = rawName || String(rawStock ?? '').trim() || Object.values(cols).some(col => col && String(get(row, col) ?? '').trim());
    if (!hasAny) continue;
    rows.push({
      row_number: rowNumber,
      name: rawName,
      sku: String(get(row, cols.sku) ?? '').trim(),
      product_number: String(get(row, cols.product_number) ?? '').trim(),
      barcode: String(get(row, cols.barcode) ?? '').trim(),
      category: String(get(row, cols.category) ?? '').trim() || 'Belum Dikategorikan',
      subcategory: String(get(row, cols.subcategory) ?? '').trim() || 'Umum',
      unit: String(get(row, cols.unit) ?? '').trim().toLowerCase() || 'pcs',
      stock: inventoryParseNumber(rawStock),
      min_stock: inventoryParseNumber(get(row, cols.min_stock))
    });
  }
  return rows;
}


// PXL-REV-0051 — parser fallback untuk workbook .xlsx yang valid di Excel,
// tetapi menggunakan namespace XML ber-prefix yang tidak dapat dibaca ExcelJS.
function inventoryXmlDecode(value) {
  return String(value || '')
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) => String.fromCodePoint(
      code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10)
    ))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function inventoryXmlAttr(fragment, name) {
  const escaped = String(name).replace(':', '\\:');
  const match = String(fragment || '').match(new RegExp('(?:^|\\s)' + escaped + '=["\\\']([^"\\\']*)["\\\']', 'i'));
  return match ? inventoryXmlDecode(match[1]) : '';
}

function inventoryExcelColumnNumber(reference) {
  const match = String(reference || '').toUpperCase().match(/^([A-Z]+)/);
  if (!match) return 0;
  let number = 0;
  for (const char of match[1]) number = number * 26 + char.charCodeAt(0) - 64;
  return number;
}

function inventoryXmlTextNodes(xml) {
  let output = '';
  for (const match of String(xml || '').matchAll(/<(?:[A-Za-z0-9_]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/gi)) {
    output += inventoryXmlDecode(match[1]);
  }
  return output;
}

function inventoryMatrixToRows(matrix) {
  const headerMap = new Map();
  (matrix[0] || []).forEach((value, index) => {
    const key = String(value ?? '').trim().toLowerCase();
    if (key) headerMap.set(key, index + 1);
  });
  const findCol = names => {
    for (const name of names) {
      const col = headerMap.get(String(name).toLowerCase());
      if (col) return col;
    }
    return null;
  };
  const cols = {
    name: findCol(['Nama Barang', 'Nama Item', 'name']),
    sku: findCol(['SKU', 'sku']),
    product_number: findCol(['Product Number', 'product_number']),
    barcode: findCol(['Barcode', 'barcode']),
    category: findCol(['Kategori', 'Main Kategori', 'category']),
    subcategory: findCol(['Sub Kategori', 'Subkategori', 'subcategory']),
    unit: findCol(['Satuan', 'unit']),
    stock: findCol(['Stok', 'Stok Import', 'Stok Cut Off', 'Stok Saat Ini', 'Qty', 'Quantity', 'stock']),
    min_stock: findCol(['Minimum Stok', 'Stok Minimum', 'min_stock'])
  };
  if (!cols.name || !cols.stock) {
    throw new Error('Header wajib Nama Barang dan Stok tidak ditemukan pada sheet pertama.');
  }
  const get = (row, col) => col ? row?.[col - 1] ?? '' : '';
  const rows = [];
  for (let index = 1; index < matrix.length; index++) {
    const row = matrix[index] || [];
    const rowNumber = index + 1;
    const rawName = String(get(row, cols.name) ?? '').trim();
    const rawStock = get(row, cols.stock);
    const hasAny = rawName || String(rawStock ?? '').trim() || Object.values(cols).some(col => col && String(get(row, col) ?? '').trim());
    if (!hasAny) continue;
    rows.push({
      row_number: rowNumber,
      name: rawName,
      sku: String(get(row, cols.sku) ?? '').trim(),
      product_number: String(get(row, cols.product_number) ?? '').trim(),
      barcode: String(get(row, cols.barcode) ?? '').trim(),
      category: String(get(row, cols.category) ?? '').trim() || 'Belum Dikategorikan',
      subcategory: String(get(row, cols.subcategory) ?? '').trim() || 'Umum',
      unit: String(get(row, cols.unit) ?? '').trim().toLowerCase() || 'pcs',
      stock: inventoryParseNumber(rawStock),
      min_stock: inventoryParseNumber(get(row, cols.min_stock))
    });
  }
  return rows;
}

async function inventoryParseWorkbookFallback(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  let sheetPath = 'xl/worksheets/sheet1.xml';
  let sheetName = 'Sheet 1';
  const workbookFile = zip.file('xl/workbook.xml');
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');

  if (workbookFile && relsFile) {
    const workbookXml = await workbookFile.async('string');
    const relsXml = await relsFile.async('string');
    const firstSheet = workbookXml.match(/<(?:[A-Za-z0-9_]+:)?sheet\b([^>]*)\/?\s*>/i);
    const relationshipId = firstSheet ? (inventoryXmlAttr(firstSheet[1], 'r:id') || inventoryXmlAttr(firstSheet[1], 'id')) : '';
    if (firstSheet) sheetName = inventoryXmlAttr(firstSheet[1], 'name') || sheetName;
    if (relationshipId) {
      for (const relationship of relsXml.matchAll(/<(?:[A-Za-z0-9_]+:)?Relationship\b([^>]*)\/?\s*>/gi)) {
        if (inventoryXmlAttr(relationship[1], 'Id') !== relationshipId) continue;
        let target = inventoryXmlAttr(relationship[1], 'Target').replace(/^\//, '');
        if (!target.startsWith('xl/')) target = 'xl/' + target.replace(/^\.\//, '');
        sheetPath = target;
        break;
      }
    }
  }

  const sharedStrings = [];
  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  if (sharedStringsFile) {
    const sharedStringsXml = await sharedStringsFile.async('string');
    for (const item of sharedStringsXml.matchAll(/<(?:[A-Za-z0-9_]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?si>/gi)) {
      sharedStrings.push(inventoryXmlTextNodes(item[1]));
    }
  }

  const worksheetFile = zip.file(sheetPath) || zip.file('xl/worksheets/sheet1.xml');
  if (!worksheetFile) throw new Error('Sheet pertama tidak ditemukan di workbook.');
  const worksheetXml = await worksheetFile.async('string');
  const matrix = [];

  for (const rowMatch of worksheetXml.matchAll(/<(?:[A-Za-z0-9_]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?row>/gi)) {
    const rowNumber = Number(inventoryXmlAttr(rowMatch[1], 'r')) || matrix.length + 1;
    const row = [];
    const cellPattern = /<(?:[A-Za-z0-9_]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?c>)/gi;
    for (const cellMatch of rowMatch[2].matchAll(cellPattern)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2] || '';
      const column = inventoryExcelColumnNumber(inventoryXmlAttr(attributes, 'r'));
      if (!column) continue;
      const type = inventoryXmlAttr(attributes, 't').toLowerCase();
      let value = '';
      if (type === 'inlinestr') {
        value = inventoryXmlTextNodes(body);
      } else {
        const valueMatch = body.match(/<(?:[A-Za-z0-9_]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?v>/i);
        const rawValue = valueMatch ? inventoryXmlDecode(valueMatch[1]) : '';
        if (type === 's') value = sharedStrings[Number(rawValue)] ?? '';
        else if (type === 'str' || type === 'e') value = rawValue;
        else if (rawValue !== '' && Number.isFinite(Number(rawValue))) value = Number(rawValue);
        else value = rawValue || inventoryXmlTextNodes(body);
      }
      row[column - 1] = value;
    }
    matrix[rowNumber - 1] = row;
  }

  return { sheetName, rows: inventoryMatrixToRows(matrix) };
}

app.get('/api/inventory/health', async (req, res) => {
  try {
    const health = await db.getInventoryHealth();
    res.json({ ok: true, ...health });
  } catch (e) {
    console.error('[Inventory Health]', e.message);
    res.status(503).json({
      ok: false,
      error: e.message,
      hint: 'Pastikan route Inventory sudah terdeploy dan SQL PXL-REV-0050 telah dijalankan di Supabase.'
    });
  }
});

app.get('/api/inventory/access', requireAuth, (req, res) => {
  res.json({
    view: hasInventoryAccess(req, 'inventory_view'),
    manage: hasInventoryAccess(req, 'inventory_manage'),
    import_export: hasInventoryAccess(req, 'inventory_import_export'),
    barcode: hasInventoryAccess(req, 'inventory_barcode'),
    opname: hasInventoryAccess(req, 'inventory_opname'),
    delete: String(req.session.user.role || '').toLowerCase().replace(/[ _-]/g, '') === 'superadmin'
  });
});

app.get('/api/inventory/categories', requireInventoryPermission('inventory_view'), async (req, res) => {
  try { res.json(await db.getInventoryCategories()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/inventory/barcode-next', requireInventoryPermission('inventory_manage'), async (req, res) => {
  try { res.json({ barcode: await db.generateInventoryBarcode() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/inventory/lookup', requireInventoryPermission('inventory_view'), async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ error: 'Kode barcode/SKU wajib diisi.' });
    res.json({ item: await db.findInventoryItemByCode(code) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/inventory/sku-preview', requireInventoryPermission('inventory_manage'), async (req, res) => {
  try {
    const category = String(req.query.category || '').trim();
    const subcategory = String(req.query.subcategory || '').trim();
    if (!category || !subcategory) return res.status(400).json({ error: 'Kategori dan Sub Kategori wajib diisi.' });
    res.json({ sku: await db.generateInventorySku(category, subcategory) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/inventory/template.xlsx', requireInventoryPermission('inventory_import_export'), async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Pixel Solusindo';
    const ws = wb.addWorksheet('Template Inventory', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Nama Barang', key: 'name', width: 36 },
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Product Number', key: 'product_number', width: 22 },
      { header: 'Barcode', key: 'barcode', width: 20 },
      { header: 'Kategori', key: 'category', width: 24 },
      { header: 'Sub Kategori', key: 'subcategory', width: 28 },
      { header: 'Satuan', key: 'unit', width: 14 },
      { header: 'Stok', key: 'stock', width: 16 },
      { header: 'Minimum Stok', key: 'min_stock', width: 16 }
    ];
    ws.addRow({
      name: 'Contoh Kabel UTP', sku: '', product_number: 'CBL-001', barcode: '',
      category: 'Material Kabel', subcategory: 'Kabel LAN', unit: 'meter', stock: 100, min_stock: 20
    });
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE07B39' } };
    ws.autoFilter = 'A1:I1';

    const guide = wb.addWorksheet('Petunjuk');
    [
      'PETUNJUK IMPORT STOK INVENTORY',
      '1. Jangan mengubah nama header pada baris pertama.',
      '2. Nama Barang dan Stok wajib diisi.',
      '3. SKU dan Barcode boleh dikosongkan agar dibuat otomatis.',
      '4. Barang dicocokkan berdasarkan SKU, Product Number, Barcode, lalu Nama Barang.',
      '5. Kategori dan Sub Kategori akan disimpan serta ditambahkan ke master kategori.',
      '6. Nilai Stok menjadi saldo terbaru dan selisih dicatat pada Log Stok.',
      '7. Maksimum 3.000 baris per import.'
    ].forEach(text => guide.addRow([text]));
    guide.getColumn(1).width = 100;
    guide.getRow(1).font = { bold: true };

    const out = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-inventory.xlsx"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(out));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/inventory/export.xlsx', requireInventoryPermission('inventory_import_export'), async (req, res) => {
  try {
    const [items, logs] = await Promise.all([db.getInventoryItems(), db.getInventoryTransactions()]);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Pixel Solusindo';
    const ws = wb.addWorksheet('Stok Inventory', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Nama Barang', key: 'name', width: 36 },
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Product Number', key: 'product_number', width: 22 },
      { header: 'Barcode Internal', key: 'barcode', width: 20 },
      { header: 'Barcode Pabrikan', key: 'manufacturer_barcode', width: 22 },
      { header: 'Kategori', key: 'category', width: 24 },
      { header: 'Sub Kategori', key: 'subcategory', width: 28 },
      { header: 'Satuan', key: 'unit', width: 14 },
      { header: 'Stok Saat Ini', key: 'stock', width: 16 },
      { header: 'Minimum Stok', key: 'min_stock', width: 16 },
      { header: 'Status', key: 'status', width: 14 }
    ];
    for (const i of items) {
      const stock = Number(i.stock || 0), min = Number(i.min_stock || 0);
      ws.addRow({
        name: i.name, sku: i.sku || '', product_number: i.product_number || '', barcode: i.barcode || '', manufacturer_barcode: i.manufacturer_barcode || '',
        category: i.category || '', subcategory: i.subcategory || '', unit: i.unit || '', stock, min_stock: min,
        status: stock <= min ? 'Kritis' : (min > 0 && stock <= min * 1.5 ? 'Rendah' : 'Aman')
      });
    }
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE07B39' } };
    ws.autoFilter = 'A1:K1';

    const logWs = wb.addWorksheet('Log Stok', { views: [{ state: 'frozen', ySplit: 1 }] });
    logWs.columns = [
      { header: 'Tanggal', key: 'date', width: 22 }, { header: 'Jenis', key: 'type', width: 16 },
      { header: 'Barang', key: 'item', width: 34 }, { header: 'Qty', key: 'qty', width: 12 },
      { header: 'Satuan', key: 'unit', width: 12 }, { header: 'Saldo Setelah', key: 'balance', width: 16 },
      { header: 'Referensi', key: 'reference', width: 26 }, { header: 'Catatan', key: 'notes', width: 34 },
      { header: 'Oleh', key: 'actor', width: 22 }
    ];
    for (const l of logs) {
      logWs.addRow({
        date: l.created_at ? new Date(l.created_at).toLocaleString('id-ID') : '', type: l.transaction_type || '',
        item: l.inventory_items?.name || '', qty: Number(l.qty || 0), unit: l.inventory_items?.unit || '',
        balance: Number(l.balance_after || 0), reference: l.reference || '', notes: l.notes || '', actor: l.created_by || ''
      });
    }
    logWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    logWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE07B39' } };

    const out = await wb.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-${stamp}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(out));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory/import/preview', requireInventoryPermission('inventory_import_export'), inventoryExcelUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Pilih file Excel terlebih dahulu.' });
    let rows = [];
    let sheetName = 'Sheet 1';
    let parser = 'exceljs';
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.file.buffer);
      const worksheet = wb.worksheets[0];
      if (!worksheet) throw new Error('Workbook tidak memiliki sheet.');
      rows = inventorySheetToRows(worksheet);
      sheetName = worksheet.name || sheetName;
    } catch (excelJsError) {
      console.warn('[Inventory Import] ExcelJS fallback:', excelJsError.message);
      const fallback = await inventoryParseWorkbookFallback(req.file.buffer);
      rows = fallback.rows;
      sheetName = fallback.sheetName || sheetName;
      parser = 'xlsx-compatible';
    }
    if (!rows.length) return res.status(400).json({ error: 'File Excel tidak memiliki data.' });

    const errors = [];
    const skuSeen = new Set(), pnSeen = new Set(), bcSeen = new Set(), identitySeen = new Set();
    for (const row of rows) {
      if (!row.name) errors.push(`Baris ${row.row_number}: Nama Barang wajib diisi.`);
      if (!Number.isFinite(row.stock) || row.stock < 0) errors.push(`Baris ${row.row_number}: Stok tidak valid.`);
      if (!Number.isFinite(row.min_stock) || row.min_stock < 0) errors.push(`Baris ${row.row_number}: Minimum Stok tidak valid.`);
      for (const [field, seen, label] of [['sku', skuSeen, 'SKU'], ['product_number', pnSeen, 'Product Number'], ['barcode', bcSeen, 'Barcode']]) {
        if (!row[field]) continue;
        const key = row[field].toLowerCase();
        if (seen.has(key)) errors.push(`Baris ${row.row_number}: ${label} duplikat dalam file.`);
        seen.add(key);
      }
      const identity = (row.sku || row.product_number || row.barcode || row.name).toLowerCase();
      if (identitySeen.has(identity)) errors.push(`Baris ${row.row_number}: Barang yang sama muncul lebih dari sekali dalam file.`);
      identitySeen.add(identity);
    }
    res.json({ ok: errors.length === 0, sheet: sheetName, row_count: rows.length, rows, errors, parser });
  } catch (e) {
    console.error('[Inventory Import Preview]', e);
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/inventory/import/commit', requireInventoryPermission('inventory_import_export'), async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'Tidak ada data import untuk diproses.' });
    if (rows.length > 3000) return res.status(400).json({ error: 'Maksimum 3.000 baris per import.' });
    const result = await db.importInventoryCutoff(rows, req.session.user.name);
    logActivity(req, 'inventory', 'IMPORT STOK EXCEL', `${rows.length} baris`);
    res.json({ ok: true, result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/inventory/items', requireInventoryPermission('inventory_view'), async (req, res) => {
  try { res.json(await db.getInventoryItems()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/inventory/logs', requireInventoryPermission('inventory_view'), async (req, res) => {
  try { res.json(await db.getInventoryTransactions()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/inventory/opnames', requireInventoryPermission('inventory_view'), async (req, res) => {
  try { res.json(await db.getInventoryOpnames()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory/items', requireInventoryPermission('inventory_manage'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const qty = Number(req.body.qty || 0);
    if (!name) return res.status(400).json({ error: 'Nama barang wajib diisi.' });
    if (qty < 0) return res.status(400).json({ error: 'Qty tidak boleh negatif.' });
    const category = String(req.body.category || '').trim();
    const subcategory = String(req.body.subcategory || '').trim();
    if (!category || !subcategory) return res.status(400).json({ error: 'Kategori dan subkategori wajib dipilih.' });
    const trackingMode = String(req.body.tracking_mode || 'quantity') === 'serial' ? 'serial' : 'quantity';
    if (trackingMode === 'serial' && qty > 0) return res.status(400).json({ error: 'Stok awal barang serial harus 0. Tambahkan melalui Restock.' });
    const suppliedBarcode = String(req.body.barcode || '').trim();
    const manufacturerBarcode = String(req.body.manufacturer_barcode || '').trim();
    const barcodePattern = /^[A-Za-z0-9._-]{4,64}$/;
    if (suppliedBarcode && !barcodePattern.test(suppliedBarcode)) return res.status(400).json({ error: 'Format barcode internal tidak valid.' });
    if (manufacturerBarcode && !barcodePattern.test(manufacturerBarcode)) return res.status(400).json({ error: 'Format barcode pabrikan tidak valid.' });
    if (suppliedBarcode) {
      const duplicate = await db.findInventoryItemByCode(suppliedBarcode);
      if (duplicate) return res.status(409).json({ error: `Barcode internal sudah digunakan oleh ${duplicate.name} (${duplicate.sku || '-'}).` });
    }
    if (manufacturerBarcode) {
      const duplicateManufacturer = await db.findInventoryItemByManufacturerBarcode(manufacturerBarcode);
      if (duplicateManufacturer) return res.status(409).json({ error: `Barcode pabrikan sudah digunakan oleh ${duplicateManufacturer.name} (${duplicateManufacturer.sku || '-'}).` });
    }
    const sku = String(req.body.sku || '').trim() || await db.generateInventorySku(category, subcategory);
    const barcode = suppliedBarcode || await db.generateInventoryBarcode();
    const item = await db.insertInventoryItem({
      name, sku, product_number: String(req.body.product_number || '').trim() || null,
      category, subcategory, unit: String(req.body.unit || 'pcs'), tracking_mode: trackingMode,
      stock: qty, min_stock: Number(req.body.min_stock || 0), barcode,
      manufacturer_barcode: manufacturerBarcode || null, is_active: true
    });
    if (qty > 0) await db.insertInventoryTransaction({
      item_id: item.id, transaction_type: 'RESTOCK', qty, balance_after: qty,
      reference: 'Stok awal', notes: 'Barang baru', created_by: req.session.user.name
    });
    const persisted = await db.getInventoryItem(item.id);
    if (!persisted) throw new Error('Barang tidak ditemukan kembali setelah disimpan ke Supabase.');
    logActivity(req, 'inventory', 'TAMBAH BARANG', `${name} · stok awal ${qty}`);
    res.status(201).json({ ok: true, item: persisted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/inventory/items/:id/manufacturer-barcode', requireInventoryPermission('inventory_manage'), async (req, res) => {
  try {
    const item = await db.getInventoryItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Barang tidak ditemukan.' });
    const manufacturerBarcode = String(req.body.manufacturer_barcode || '').trim();
    if (!manufacturerBarcode) return res.status(400).json({ error: 'Barcode pabrikan wajib diisi.' });
    if (!/^[A-Za-z0-9._-]{4,64}$/.test(manufacturerBarcode)) return res.status(400).json({ error: 'Format barcode pabrikan tidak valid.' });
    const duplicate = await db.findInventoryItemByManufacturerBarcode(manufacturerBarcode);
    if (duplicate && String(duplicate.id) !== String(item.id)) {
      return res.status(409).json({ error: `Barcode pabrikan sudah digunakan oleh ${duplicate.name} (${duplicate.sku || '-'}).` });
    }
    const updated = await db.updateInventoryItem(item.id, { manufacturer_barcode: manufacturerBarcode });
    logActivity(req, 'inventory', 'BARCODE PABRIKAN', `${item.name} · ${manufacturerBarcode}`);
    res.json({ ok: true, item: updated });
  } catch (e) {
    const message = String(e.message || e);
    res.status(message.includes('duplicate key') ? 409 : 500).json({ error: message });
  }
});

app.delete('/api/inventory/items/:id', requireInventoryPermission('inventory_delete'), async (req, res) => {
  try {
    const result = await db.deleteInventoryItem(req.params.id, req.session.user.name);
    logActivity(req, 'inventory', 'HAPUS BARANG', `${result.name || req.params.id} · stok dinolkan dan item dinonaktifkan`);
    res.json({ ok: true, item: result });
  } catch (e) {
    const message = String(e.message || e);
    res.status(message.includes('Barang tidak ditemukan') ? 404 : 500).json({ error: message });
  }
});


// PXL-URG-0051 — Inventory duplicate / similar item manager.
// Review only: candidate detection never changes Inventory automatically.
// Merge/nonaktif destructive actions follow inventory_delete (Super Admin) protection.
function inventoryDuplicateNorm(value){
  return String(value||'').toUpperCase()
    .replace(/[^A-Z0-9]+/g,' ')
    .replace(/\b(CAMERA|KAMERA|CCTV|IP|ANALOG|OUTDOOR|INDOOR|PCS|PC|UNIT|NEW|PRODUCT|BARANG)\b/g,' ')
    .replace(/\s+/g,' ').trim();
}
function inventoryDuplicateTokens(value){
  return inventoryDuplicateNorm(value).split(' ').filter(x=>x.length>1);
}
function inventoryDuplicatePackageClass(value){
  const tokens=String(value||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').split(/\s+/).filter(Boolean);
  return tokens.some(x=>['PAKET','KIT','BUNDLE','SET'].includes(x))?'package':'single';
}
function inventoryDuplicateModels(value){
  return [...new Set(inventoryDuplicateTokens(value).filter(x=>/[A-Z]/.test(x)&&/\d/.test(x)&&x.length>=4))];
}
function inventoryDuplicateScore(a,b){
  if(inventoryDuplicatePackageClass(a.name)!==inventoryDuplicatePackageClass(b.name))return 0;
  const an=inventoryDuplicateNorm(a.name),bn=inventoryDuplicateNorm(b.name);
  if(!an||!bn)return 0;
  if(String(a.sku||'')&&String(a.sku)===String(b.sku))return 100;
  if(String(a.manufacturer_barcode||'')&&String(a.manufacturer_barcode)===String(b.manufacturer_barcode))return 100;
  if(an===bn)return 100;
  const am=inventoryDuplicateModels(a.name),bm=inventoryDuplicateModels(b.name);
  if(am.some(x=>bm.includes(x)))return 98;
  const at=new Set(inventoryDuplicateTokens(a.name)),bt=new Set(inventoryDuplicateTokens(b.name));
  const common=[...at].filter(x=>bt.has(x)).length;
  const union=new Set([...at,...bt]).size;
  const j=union?common/union:0;
  const min=Math.min(at.size,bt.size);
  const coverage=min?common/min:0;
  if((an.includes(bn)||bn.includes(an))&&Math.min(an.length,bn.length)>=6)return Math.max(90,Math.round(coverage*100));
  if(coverage>=0.8&&common>=2)return Math.max(86,Math.round((coverage*.7+j*.3)*100));
  if(coverage>=0.6&&common>=2)return Math.max(76,Math.round((coverage*.65+j*.35)*100));
  return 0;
}

app.get('/api/inventory/duplicates', requireInventoryPermission('inventory_manage'), async (req,res)=>{
  try{
    const rows=await db.getInventoryItems();
    const items=Array.isArray(rows)?rows.filter(x=>x&&x.is_active!==false):[];
    const candidates=[];
    for(let i=0;i<items.length;i++){
      for(let j=i+1;j<items.length;j++){
        const a=items[i],b=items[j];
        const score=inventoryDuplicateScore(a,b);
        if(score<76)continue;
        candidates.push({
          score,
          a:{id:a.id,name:a.name,sku:a.sku||null,product_number:a.product_number||null,category:a.category||null,subcategory:a.subcategory||null,unit:a.unit||'pcs',stock:Number(a.stock||0),tracking_mode:a.tracking_mode||'quantity'},
          b:{id:b.id,name:b.name,sku:b.sku||null,product_number:b.product_number||null,category:b.category||null,subcategory:b.subcategory||null,unit:b.unit||'pcs',stock:Number(b.stock||0),tracking_mode:b.tracking_mode||'quantity'}
        });
      }
    }
    candidates.sort((x,y)=>y.score-x.score||String(x.a.name).localeCompare(String(y.a.name),'id',{numeric:true}));
    res.json({count:candidates.length,candidates:candidates.slice(0,300)});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/inventory/duplicates/merge', requireInventoryPermission('inventory_delete'), async (req,res)=>{
  let target=null,source=null,targetUpdated=false;
  try{
    const targetId=String(req.body.target_id||'').trim(),sourceId=String(req.body.source_id||'').trim();
    if(!targetId||!sourceId||targetId===sourceId)return res.status(400).json({error:'Item utama dan item duplikat wajib berbeda.'});
    [target,source]=await Promise.all([db.getInventoryItem(targetId),db.getInventoryItem(sourceId)]);
    if(!target||target.is_active===false||!source||source.is_active===false)return res.status(404).json({error:'Salah satu item Inventory tidak ditemukan / sudah nonaktif.'});
    if(String(target.tracking_mode||'quantity')==='serial'||String(source.tracking_mode||'quantity')==='serial'){
      return res.status(400).json({error:'Merge item tracking Serial diblokir untuk menjaga serial number/history. Gunakan review manual.'});
    }
    const similarity=inventoryDuplicateScore(target,source);
    if(similarity<98){
      return res.status(400).json({error:'Merge review hanya diizinkan untuk kandidat similarity minimal 98% dan paket/non-paket tidak boleh dicampur.'});
    }
    if(String(target.unit||'pcs').toLowerCase()!==String(source.unit||'pcs').toLowerCase()){
      return res.status(400).json({error:'Satuan item berbeda. Samakan satuan terlebih dahulu sebelum Merge.'});
    }
    const sourceStock=Number(source.stock||0),targetStock=Number(target.stock||0),mergedStock=targetStock+sourceStock;
    await db.updateInventoryItem(target.id,{stock:mergedStock});
    targetUpdated=true;
    await db.updateInventoryItem(source.id,{stock:0,is_active:false});
    await db.insertInventoryTransaction({item_id:target.id,transaction_type:'MERGE_IN',qty:sourceStock,balance_after:mergedStock,reference:'Merge Inventory',notes:'Gabung dari '+source.name+' ('+(source.sku||'-')+')',created_by:req.session.user.name});
    await db.insertInventoryTransaction({item_id:source.id,transaction_type:'MERGED_OUT',qty:-sourceStock,balance_after:0,reference:'Merge Inventory',notes:'Digabung ke '+target.name+' ('+(target.sku||'-')+')',created_by:req.session.user.name});
    logActivity(req,'inventory','MERGE ITEM',source.name+' → '+target.name+' · stok '+targetStock+' + '+sourceStock+' = '+mergedStock);
    res.json({ok:true,target_id:target.id,source_id:source.id,merged_stock:mergedStock});
  }catch(e){
    if(targetUpdated&&target){
      try{await db.updateInventoryItem(target.id,{stock:Number(target.stock||0)});}catch(_){}
    }
    res.status(500).json({error:e.message});
  }
});


app.post('/api/inventory/duplicates/merge-exact-bulk', requireInventoryPermission('inventory_delete'), async (req,res)=>{
  try{
    const rows=await db.getInventoryItems();
    const items=Array.isArray(rows)?rows.filter(x=>x&&x.is_active!==false):[];
    const byId=new Map(items.map(x=>[String(x.id),x]));
    const adj=new Map(items.map(x=>[String(x.id),new Set()]));

    for(let i=0;i<items.length;i++){
      for(let j=i+1;j<items.length;j++){
        if(inventoryDuplicateScore(items[i],items[j])!==100)continue;
        adj.get(String(items[i].id)).add(String(items[j].id));
        adj.get(String(items[j].id)).add(String(items[i].id));
      }
    }

    const seen=new Set(),components=[];
    for(const item of items){
      const startId=String(item.id);
      if(seen.has(startId)||!adj.get(startId)?.size)continue;
      const stack=[startId],ids=[];seen.add(startId);
      while(stack.length){
        const id=stack.pop();ids.push(id);
        for(const n of adj.get(id)||[])if(!seen.has(n)){seen.add(n);stack.push(n);}
      }
      if(ids.length>1)components.push(ids.map(id=>byId.get(id)).filter(Boolean));
    }

    const merges=[],skipped=[];
    for(const component of components){
      const partitions=new Map();
      for(const item of component){
        const mode=String(item.tracking_mode||'quantity');
        const unit=String(item.unit||'pcs').trim().toLowerCase();
        const key=mode+'|'+unit;
        if(!partitions.has(key))partitions.set(key,[]);
        partitions.get(key).push(item);
      }

      for(const group of partitions.values()){
        if(group.length<2)continue;
        if(String(group[0].tracking_mode||'quantity')==='serial'){
          skipped.push({reason:'Tracking Serial',items:group.map(x=>x.name)});
          continue;
        }

        const sorted=[...group].sort((a,b)=>
          Number(b.stock||0)-Number(a.stock||0) ||
          String(a.sku||'').localeCompare(String(b.sku||''),'id',{numeric:true}) ||
          String(a.name||'').localeCompare(String(b.name||''),'id',{numeric:true})
        );
        const target=sorted.shift();
        for(const source of sorted){
          if(inventoryDuplicateScore(target,source)!==100){
            skipped.push({reason:'Bukan exact 100% saat validasi ulang',items:[target.name,source.name]});
            continue;
          }
          merges.push({target_id:target.id,source_id:source.id});
        }
      }
    }

    if(!merges.length){
      return res.json({ok:true,groups_total:0,groups_merged:0,items_deactivated:0,stock_moved:0,skipped});
    }

    const result=await db.mergeInventoryDuplicatesBulk(merges,req.session.user.name);
    logActivity(req,'inventory','MERGE MASSAL 100% RPC',
      Number(result.items_deactivated||0)+' item · '+Number(result.stock_moved||0)+' stok dipindahkan');

    res.json({...result,skipped:[...(Array.isArray(result.skipped)?result.skipped:[]),...skipped]});
  }catch(e){
    console.error('[PXL-URG-0051G Bulk Merge RPC]',e);
    const message=String(e.message||e);
    res.status(message.includes('inventory_merge_duplicates_bulk')?503:500).json({
      error:message.includes('inventory_merge_duplicates_bulk')
        ?'RPC Supabase inventory_merge_duplicates_bulk belum tersedia. Jalankan SQL PXL-URG-0051G terlebih dahulu.'
        :message
    });
  }
});

app.post('/api/inventory/duplicates/deactivate', requireInventoryPermission('inventory_delete'), async (req,res)=>{
  try{
    const id=String(req.body.item_id||'').trim();
    if(!id)return res.status(400).json({error:'Item wajib dipilih.'});
    const item=await db.getInventoryItem(id);
    if(!item||item.is_active===false)return res.status(404).json({error:'Item tidak ditemukan / sudah nonaktif.'});
    if(Number(item.stock||0)!==0)return res.status(400).json({error:'Item masih memiliki stok '+Number(item.stock||0)+' '+(item.unit||'pcs')+'. Merge atau nolkan stok melalui proses Inventory yang benar sebelum dinonaktifkan.'});
    const updated=await db.updateInventoryItem(item.id,{is_active:false});
    logActivity(req,'inventory','NONAKTIF ITEM DUPLIKAT',item.name+' · '+(item.sku||'-'));
    res.json({ok:true,item:updated});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/inventory/items/:id/restock-batch', requireInventoryPermission('inventory_manage'), async (req, res) => {
  try {
    const item = await db.getInventoryItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Barang tidak ditemukan.' });
    const serialNumbers = Array.isArray(req.body.serial_numbers)
      ? req.body.serial_numbers.map(v => String(v || '').trim()).filter(Boolean) : [];
    const qty = item.tracking_mode === 'serial' ? serialNumbers.length : Number(req.body.qty || 0);
    if (qty <= 0) return res.status(400).json({ error: 'Qty restock harus lebih dari 0.' });
    const result = await db.restockInventoryBatch(item.id, qty, serialNumbers, String(req.body.reference || 'Restock').trim(), req.session.user.name);
    logActivity(req, 'inventory', 'RESTOCK BATCH', `${item.name} +${qty} ${item.unit}`);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/inventory/items/:id/restock', requireInventoryPermission('inventory_manage'), async (req, res) => {
  try {
    const qty = Number(req.body.qty || 0);
    if (qty <= 0) return res.status(400).json({ error: 'Qty restock harus lebih dari 0.' });
    const item = await db.getInventoryItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Barang tidak ditemukan.' });
    const balance = Number(item.stock || 0) + qty;
    const updated = await db.updateInventoryItem(item.id, { stock: balance });
    await db.insertInventoryTransaction({
      item_id: item.id, transaction_type: 'RESTOCK', qty, balance_after: balance,
      reference: req.body.reference || 'Restock', notes: req.body.notes || null, created_by: req.session.user.name
    });
    logActivity(req, 'inventory', 'RESTOCK', `${item.name} +${qty} ${item.unit}`);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory/opname', requireInventoryPermission('inventory_opname'), async (req, res) => {
  try {
    const lines = Array.isArray(req.body.items) ? req.body.items : [];
    if (!lines.length) return res.status(400).json({ error: 'Tidak ada barang untuk opname.' });
    let matched = 0, different = 0;
    const opname = await db.insertInventoryOpname({ item_count: lines.length, matched_count: 0, difference_count: 0, created_by: req.session.user.name, notes: req.body.notes || null });
    for (const line of lines) {
      const item = await db.getInventoryItem(line.item_id);
      if (!item) continue;
      const system = Number(item.stock || 0), physical = Number(line.physical_stock || 0), diff = physical - system;
      diff === 0 ? matched++ : different++;
      await db.insertInventoryOpnameItem({ opname_id: opname.id, item_id: item.id, system_stock: system, physical_stock: physical, difference: diff, notes: line.notes || null });
      if (diff !== 0) {
        await db.updateInventoryItem(item.id, { stock: physical });
        await db.insertInventoryTransaction({ item_id: item.id, transaction_type: 'OPNAME', qty: diff, balance_after: physical, reference: `Opname ${opname.id}`, notes: line.notes || null, created_by: req.session.user.name });
      }
    }
    await db.updateInventoryOpname(opname.id, { matched_count: matched, difference_count: different });
    logActivity(req, 'inventory', 'STOCK OPNAME', `${lines.length} item · ${different} selisih`);
    res.json({ ok: true, item_count: lines.length, matched_count: matched, difference_count: different });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────
// UNIVERSAL REPORTS + INVOICE PDF TEMPLATE
// PXL-REV-0035 CUMULATIVE
// ─────────────────────────────────────────
async function getReportRows(moduleName){
  const crm=await db.getCrmReport();
  const modules={
    dashboard:[{...crm.counts,revenue:crm.revenue,pipeline:crm.pipeline}],
    report:crm.tickets,
    tickets:crm.tickets,
    invoice:[...(crm.invoices||[]), ...((await db.getStandaloneInvoices())||[])],
    kpi:[{module:'KPI',tickets:crm.counts.tickets,invoices:crm.counts.invoices,revenue:crm.revenue}],
    sales:crm.sales_orders,
    kunjungan:crm.visits,
    archive:await db.getArchivedTickets(),
    users:await db.getUsers(),
    actlog:await db.getLogs(),
    materials:await db.getMRForms(),
    inventory:[{keterangan:'Inventory menggunakan halaman inventory.html/Supabase langsung. Export detail tetap tersedia dari tombol Export Excel pada modul Inventory.'}],
    pr:await db.getPurchaseRequests(),
    projects:crm.projects,
    crm:[...(crm.customers||[]),...(crm.sales_orders||[]),...(crm.work_orders||[])],
    supplier:await db.getSuppliers()
  };
  if(!(moduleName in modules)) throw new Error('Module report tidak dikenal');
  return modules[moduleName]||[];
}
app.get('/api/reports/:module.:format', requireAuth, async(req,res)=>{
  try{
    const rows=await getReportRows(req.params.module);
    const title=`Report ${req.params.module}`;
    if(req.params.format==='xlsx') return reportSvc.writeExcel(res,title,rows);
    if(req.params.format==='pdf') return reportSvc.writePdf(res,title,rows);
    res.status(400).json({error:'Format report harus pdf atau xlsx'});
  }catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/invoices/:id/template.pdf', requireAuth, async(req,res)=>{
  try{
    const id=req.params.id;
    const crm=(await db.getCrmInvoices()).find(x=>String(x.id)===id||String(x.invoice_number)===id);
    if(crm) return reportSvc.invoicePdf(res,crm);
    const standalone=(await db.getStandaloneInvoices()).find(x=>String(x.id)===id);
    if(standalone) return reportSvc.invoicePdf(res,{...standalone,invoice_number:standalone.invoice_number||standalone.original_name,customer_name:standalone.customer_name||'Customer'});
    const tickets=await db.getTickets(null,true);
    for(const t of tickets){
      const invs=await db.getInvoicesByTicket(t.id);
      const inv=(invs||[]).find(x=>String(x.id)===id);
      if(inv) return reportSvc.invoicePdf(res,{...inv,invoice_number:inv.invoice_number||inv.original_name,customer_name:t.customer_name,description:inv.description||`Invoice WO ${t.wo_number||'-'}`});
    }
    res.status(404).json({error:'Invoice tidak ditemukan'});
  }catch(e){res.status(500).json({error:e.message});}
});

// PXL-URG-0043 — Master Pricelist persistent cache/history API (Superadmin only).
require('./pxl-urg-0043-master-pricelist-cache')(app,{requireAuth});

// PXL-STG-0009A — modul terpisah Form Cuti / Izin
require('./pxl-stg-0009a-leave-api')(app,{db,requireAuth,logActivity});

// SPA fallback harus berada setelah seluruh route API/report.
app.get('*', (req, res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, () => {
  console.log(`\n✅ Helpdesk Pixel v5.3 → http://localhost:${PORT}`);
  console.log(`💾 Mode: ${db.USE_SUPABASE ? 'Supabase' : 'Local JSON'}`);
  console.log(`🗑️  Auto-delete invoice attachment: ${ATTACH_EXPIRE_DAYS} hari\n`);

  // Jalankan saat server start
  cleanExpiredAttachments();

  // Jalankan setiap 24 jam
  setInterval(cleanExpiredAttachments, 24 * 60 * 60 * 1000);
});
