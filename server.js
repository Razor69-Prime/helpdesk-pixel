const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const cfg      = require('./config');
const db       = require('./db');
const reportSvc = require('./report-service');

const app  = express();
const PORT = cfg.PORT;
const UPLOADS_DIR  = path.join(__dirname, 'data', 'uploads');
const USERS_FILE   = path.join(__dirname, 'data', 'users.json');
const TICKETS_FILE = path.join(__dirname, 'data', 'tickets.json');

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

const jwt = require('jsonwebtoken');
const JWT_SECRET = cfg.SESSION_SECRET;

// ── JWT Session Middleware ──
// Token dikirim via Authorization header dari frontend (localStorage)
// Bekerja sempurna di Vercel serverless tanpa cookie issue
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.get('/api/me',     (req, res) => res.json({ user: req.session.user || null }));

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

    const { username, name, password, role, custom_menus, signature_url, pr_roles, extra_roles, allow_invoice_no_wo, is_active } = req.body;
    const patch = {};
    if (username)                     patch.username      = username;
    if (name)                         patch.name          = name;
    if (password)                     patch.password      = password;
    if (role)                         patch.role          = role;
    if (custom_menus !== undefined)   patch.custom_menus  = custom_menus;
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
  try {
    const role   = req.session.user.role;
    // teknisi hanya lihat tiket yang di-assign ke dirinya
    const filter = role === 'technician' ? req.session.user.name : null; // superadmin: null (lihat semua)
    const tickets = await db.getTickets(filter);
    const enriched = await Promise.all(tickets.map(async t => {
      const [invoices, status_history, job_stages] = await Promise.all([
        db.getInvoicesByTicket(t.id),
        db.getStatusHistory(t.id),
        db.getJobStages(t.id)
      ]);
      return { ...t, invoices: invoices || [], status_history: status_history || [], job_stages: job_stages || [] };
    }));
    res.json(enriched);
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.post('/api/tickets', requireRole('technician','admin','superadmin','manager','operator','sales'), async (req, res) => {
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
    const { status, lat, lng, technicians, technician } = req.body;
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
    if (canAssign && technicians && Array.isArray(technicians) && technicians.length) {
      patch.technicians = technicians;
      patch.technician  = technicians[0];
      logActivity(req, 'ticket', 'REASSIGN TEKNISI', `Ticket: ${req.params.id} → ${technicians.join(', ')}`);
    } else if (!canAssign && technicians) {
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
      let file_url      = "";
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
app.get('/api/invoices/standalone', requireAuth, async (req, res) => {
  try { res.json(await db.getStandaloneInvoices()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices/standalone', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (req.session.user.allow_invoice_no_wo !== true) {
      return res.status(403).json({ error: 'Anda tidak memiliki izin upload invoice tanpa WO.' });
    }

    let file_url      = "";
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
    const entry=await db.insertMRForm({...req.body, created_by:req.session.user.name});
    logActivity(req,'material','BUAT MR FORM',`WO: ${req.body.wo_number}`);
    res.status(201).json(entry);
  }catch(e){ res.status(500).json({error:e.message}); }
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
        if (tech_signature)     ticketPatch.tech_signature     = tech_signature;
        if (customer_signature) ticketPatch.customer_signature = customer_signature;
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
//  PUBLIC TRACKING
// ══════════════════════════════════════════
app.get('/api/track/:token', async (req, res) => {
  try {
    const ticket = await db.getTicketByToken(req.params.token);
    if (!ticket)        return res.status(404).json({ error: 'Tiket tidak ditemukan.' });
    if (isExpired(ticket)) return res.status(410).json({ error: 'Link tracking sudah kedaluwarsa.' });
    const [invoices, status_history, job_stages] = await Promise.all([
      db.getInvoicesByTicket(ticket.id),
      db.getStatusHistory(ticket.id),
      db.getJobStages(ticket.id)
    ]);
    logActivity(req, 'tracking', 'LIHAT TRACKING', `WO: ${ticket.wo_number} · Customer: ${ticket.customer_name||'-'}`);
    res.json({
      wo_number: ticket.wo_number, project_name: ticket.project_name,
      customer_name: ticket.customer_name,
      customer_phone: ticket.customer_phone || null,
      technician: ticket.technician,
      technicians: ticket.technicians || (ticket.technician ? [ticket.technician] : []),
      status: ticket.status, worked_at: ticket.worked_at,
      description: ticket.description, last_lat: ticket.last_lat,
      last_lng: ticket.last_lng, last_gps_at: ticket.last_gps_at,
      created_at: ticket.created_at, expires_at: trackExpiry(ticket).toISOString(),
      invoices: invoices || [], status_history: status_history || [],
      job_stages: job_stages || [],
      tech_signature: ticket.tech_signature || null,
      customer_signature: ticket.customer_signature || null,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
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
// CRM + SALES ORDER FLOW — PXL-REV-0035 CUMULATIVE
// ══════════════════════════════════════════
const CRM_WRITE_ROLES=['sales','manager','admin','superadmin'];
app.get('/api/crm/report',requireAuth,async(req,res)=>{try{res.json(await db.getCrmReport())}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/crm/customers',requireAuth,async(req,res)=>{try{res.json(await db.getCrmCustomers())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/customers',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{if(!req.body.name)return res.status(400).json({error:'Nama customer wajib diisi'});const x=await db.insertCrmCustomer({...req.body,created_by:req.session.user.name});logActivity(req,'crm','BUAT CUSTOMER',x.name);res.status(201).json(x)}catch(e){res.status(500).json({error:e.message})}});
app.patch('/api/crm/customers/:id',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{res.json(await db.updateCrmCustomer(req.params.id,req.body))}catch(e){res.status(500).json({error:e.message})}});
app.delete('/api/crm/customers/:id',requireRole('superadmin'),async(req,res)=>{try{const deleted=await db.deleteCrmCustomer(req.params.id);logActivity(req,'crm','HAPUS CUSTOMER',deleted?.name||req.params.id);res.json({ok:true,deleted})}catch(e){const status=/foreign key|constraint|reference/i.test(String(e.message))?409:500;res.status(status).json({error:status===409?'Customer masih terhubung dengan data lain dan belum dapat dihapus.':e.message})}});

app.get('/api/sales-orders',requireAuth,async(req,res)=>{try{res.json(await db.getSalesOrders())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/sales-orders',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{if(!req.body.customer_name)return res.status(400).json({error:'Customer wajib diisi'});const items=Array.isArray(req.body.items)?req.body.items:[];const total=items.reduce((s,i)=>s+Number(i.qty||0)*Number(i.unit_price||0),0);const x=await db.insertSalesOrder({...req.body,items,total_amount:req.body.total_amount??total,created_by:req.session.user.name});logActivity(req,'so','BUAT SALES ORDER',x.so_number);res.status(201).json(x)}catch(e){res.status(500).json({error:e.message})}});
app.patch('/api/sales-orders/:id',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{const old=(await db.getSalesOrders()).find(x=>x.id===req.params.id);if(!old)return res.status(404).json({error:'SO tidak ditemukan'});if(req.body.delete===true)return res.status(400).json({error:'Sales Order tidak dapat dihapus. Gunakan status void/cancelled.'});const history=[...(old.history||[]),{at:new Date().toISOString(),by:req.session.user.name,action:'update',status:req.body.status||old.status}];res.json(await db.updateSalesOrder(req.params.id,{...req.body,history}))}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/crm/work-orders',requireAuth,async(req,res)=>{try{res.json(await db.getCrmWorkOrders())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/work-orders',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{const payload={...req.body,sales_order_id:req.body.sales_order_id||null,so_number:req.body.so_number||null,created_by:req.session.user.name};const x=await db.insertCrmWorkOrder(payload);logActivity(req,'wo','BUAT WO',x.wo_number);res.status(201).json(x)}catch(e){res.status(400).json({error:e.message})}});
app.patch('/api/crm/work-orders/:id',requireAuth,async(req,res)=>{try{res.json(await db.updateCrmWorkOrder(req.params.id,req.body))}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/crm/material-requests',requireAuth,async(req,res)=>{try{res.json(await db.getCrmMaterialRequests())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/material-requests/from-so/:soId',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{const so=(await db.getSalesOrders()).find(x=>x.id===req.params.soId);if(!so)return res.status(404).json({error:'SO tidak ditemukan'});const items=(so.items||[]).filter(x=>(x.item_type||'item')!=='service');const x=await db.insertCrmMaterialRequest({sales_order_id:so.id,so_number:so.so_number,work_order_id:req.body.work_order_id||null,wo_number:req.body.wo_number||null,customer_name:so.customer_name,items,technician:req.body.technician||null,created_by:req.session.user.name});logActivity(req,'mr','BUAT MR DARI SO',x.mr_number);res.status(201).json(x)}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/material-requests/:id/verify',requireRole('technician','manager','admin','superadmin'),async(req,res)=>{try{if(!req.body.technician_signature)return res.status(400).json({error:'Tanda tangan teknisi wajib diisi'});const x=await db.updateCrmMaterialRequest(req.params.id,{status:'verified_signed',technician:req.session.user.name,technician_note:req.body.technician_note||null,technician_signature:req.body.technician_signature,verified_at:new Date().toISOString(),verified_items:req.body.items||null});logActivity(req,'mr','VERIFIKASI & SIGN TEKNISI',x.mr_number||req.params.id);res.json(x)}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/crm/additional-materials',requireAuth,async(req,res)=>{try{res.json(await db.getAdditionalMaterialRequests())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/additional-materials',requireRole('technician','manager','admin','superadmin'),async(req,res)=>{try{if(!req.body.work_order_id||!Array.isArray(req.body.items)||!req.body.items.length)return res.status(400).json({error:'WO dan item tambahan wajib diisi'});const x=await db.insertAdditionalMaterialRequest({...req.body,requested_by:req.session.user.name});logActivity(req,'amr','AJUKAN TAMBAHAN MATERIAL',x.amr_number);res.status(201).json(x)}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/additional-materials/:id/internal-approve',requireRole('manager','admin','superadmin'),async(req,res)=>{try{res.json(await db.updateAdditionalMaterialRequest(req.params.id,{status:'waiting_customer_approval',internal_approved_by:req.session.user.name,internal_approved_at:new Date().toISOString()}))}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/additional-materials/:id/customer-approve',requireRole(...CRM_WRITE_ROLES),async(req,res)=>{try{if(!req.body.customer_approval_name)return res.status(400).json({error:'Nama pemberi persetujuan customer wajib diisi'});res.json(await db.updateAdditionalMaterialRequest(req.params.id,{status:'approved',customer_approval_name:req.body.customer_approval_name,customer_approved_at:new Date().toISOString()}))}catch(e){res.status(500).json({error:e.message})}});


function normalizeWaNumber(v){const d=String(v||'').replace(/\D/g,'');if(!d)return'';if(d.startsWith('62'))return d;if(d.startsWith('0'))return '62'+d.slice(1);return '62'+d;}
app.get('/api/crm/whatsapp-templates',requireAuth,async(req,res)=>{try{res.json(await db.getWhatsappTemplates())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/communications',requireAuth,async(req,res)=>{try{if(!req.body.customer_id||!req.body.channel)return res.status(400).json({error:'Customer dan channel wajib'});const x=await db.insertCommunicationHistory({...req.body,created_by:req.session.user.name,communication_at:new Date().toISOString()});await db.updateCrmCustomer(req.body.customer_id,{last_communication_at:x.communication_at,last_communication_channel:req.body.channel,next_follow_up_at:req.body.next_follow_up_at||null});res.status(201).json(x)}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/crm/communications/all',requireAuth,async(req,res)=>{try{res.json(await db.getCommunicationHistory())}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/crm/communications/:customerId',requireAuth,async(req,res)=>{try{const rows=await db.getCommunicationHistory();res.json(rows.filter(x=>x.customer_id===req.params.customerId))}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/customer-import/staging',requireRole('admin','superadmin'),async(req,res)=>{try{const rows=Array.isArray(req.body)?req.body:[req.body];const out=[];for(const r of rows){out.push(await db.insertCustomerImportStaging({...r,normalized_phone:normalizeWaNumber(r.phone),import_status:'pending'}))}res.status(201).json(out)}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/crm/customer-import/:id/commit',requireRole('admin','superadmin'),async(req,res)=>{try{const rows=await db.getCustomerImportStaging();const r=rows.find(x=>x.id===req.params.id);if(!r)return res.status(404).json({error:'Data staging tidak ditemukan'});const customers=await db.getCrmCustomers();let c=customers.find(x=>(r.legacy_customer_id&&x.legacy_customer_id===r.legacy_customer_id&&x.source_name===r.source_name)||(r.normalized_phone&&x.normalized_phone===r.normalized_phone));if(c)c=await db.updateCrmCustomer(c.id,{name:r.name,type:r.type,sales_pic:r.sales_pic,phone:r.phone,normalized_phone:r.normalized_phone,email:r.email,address:r.address});else c=await db.insertCrmCustomer({name:r.name,type:r.type||'B2B',sales_pic:r.sales_pic,phone:r.phone,normalized_phone:r.normalized_phone,email:r.email,address:r.address,legacy_customer_id:r.legacy_customer_id,source_name:r.source_name||'existing_customer',status:'active',created_by:req.session.user.name});await db.updateCustomerImportStaging(r.id,{import_status:'imported',matched_customer_id:c.id});res.json(c)}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/crm/invoices',requireAuth,async(req,res)=>{try{res.json(await db.getCrmInvoices())}catch(e){res.status(500).json({error:e.message})}});
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
