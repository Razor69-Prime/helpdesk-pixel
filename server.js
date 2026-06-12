const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const cfg      = require('./config');
const db       = require('./db');

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
    const userData = {
      id:           u.id,
      username:     u.username,
      name:         u.name,
      role:         u.role,
      custom_menus: Array.isArray(u.custom_menus) ? u.custom_menus : []
    };
    req.session._setUser(userData);
    // Buat JWT token untuk dikirim ke frontend
    const token = jwt.sign({ user: userData }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ ok: true, user: userData, token });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });
app.get('/api/me',     (req, res) => res.json({ user: req.session.user || null }));

// ══════════════════════════════════════════
//  USER MANAGEMENT
// ══════════════════════════════════════════

app.get('/api/users', requireRole('admin','superadmin'), async (req, res) => {
  try {
    if (db.USE_SUPABASE) return res.json(await db.getUsers());
    res.json(readUsers().map(({ password: _, ...u }) => u));
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
      const saved = await db.insertUser({ username, password, name, role, custom_menus: custom_menus||[] });
      return res.status(201).json(saved);
    }
    const users = readUsers();
    if (users.find(u => u.username === username))
      return res.status(409).json({ error: 'Username sudah digunakan.' });
    const newUser = { id: crypto.randomUUID(), username, password, name, role, custom_menus: custom_menus||[] };
    users.push(newUser);
    writeUsers(users);
    const { password: _, ...safe } = newUser;
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

    const { name, password, role, custom_menus } = req.body;
    const patch = {};
    if (name)                       patch.name         = name;
    if (password)                   patch.password     = password;
    if (role)                       patch.role         = role;
    if (custom_menus !== undefined) patch.custom_menus = custom_menus;

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
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET daftar Sales PIC ──
app.get('/api/sales-pics', requireAuth, async (req, res) => {
  try {
    let users;
    if (db.USE_SUPABASE) users = await db.getUsersWithPassword();
    else users = readUsers();
    const sales = users.filter(u => u.role === 'sales').map(({ password: _, ...u }) => u);
    res.json(sales);
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
app.post('/api/sales-targets', requireRole('admin','superadmin'), async (req, res) => {
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
app.delete('/api/sales-targets/:id', requireRole('admin','superadmin'), async (req, res) => {
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

app.post('/api/tickets', requireRole('technician','admin','superadmin'), async (req, res) => {
  try {
    const now   = new Date().toISOString();
    const token = crypto.randomBytes(14).toString('hex');
    const role  = req.session.user.role;

    // Build technicians array (max 2)
    let technicians = [];
    if (role === 'admin' || role === 'superadmin') {
      // admin/superadmin assign: ambil dari assigned_to (bisa string atau array)
      const raw = req.body.assigned_to;
      if (Array.isArray(raw)) {
        technicians = raw.filter(Boolean).slice(0, 2);
      } else if (raw) {
        technicians = [raw];
      }
      // optional second technician
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
      if (Object.keys(req.body).some(k => k !== 'status' && k !== 'lat' && k !== 'lng')) {
        return res.status(403).json({ error: 'Teknisi hanya bisa update status.' });
      }
    }

    const patch = {};
    if (status)    patch.status     = status;
    if (lat && lng){ patch.last_lat = lat; patch.last_lng = lng; patch.last_gps_at = now; }

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
    if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan.' });
    try {
      let file_url;

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

      const inv = await db.insertInvoice({
        ticket_id:     req.params.id,
        file_url,
        original_name: req.file.originalname,
        mime_type:     req.file.mimetype,
        uploaded_by:   req.session.user.name,
        note:          req.body.note         || null,
        total_amount:  req.body.total_amount ? Number(req.body.total_amount) : null,
        sales_pic:     req.body.sales_pic    || null,
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
//  SALES VISITS (API siap, UI belum aktif)
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

// POST buat visit baru
app.post('/api/sales-visits', requireAuth, async (req, res) => {
  try {
    const { customer_name, customer_phone, address,
            lat, lng, location_manual, location_label,
            estimasi_omzet, realisasi_omzet,
            prospect_date, notes } = req.body;
    if (!customer_name || !prospect_date) {
      return res.status(400).json({ error: 'customer_name dan prospect_date wajib diisi.' });
    }
    const visit = await db.insertSalesVisit({
      sales_pic:       req.session.user.name,
      sales_user_id:   req.session.user.id,
      customer_name,
      customer_phone:  customer_phone  || null,
      address:         address         || null,
      lat:             lat             || null,
      lng:             lng             || null,
      location_manual: location_manual || false,
      location_label:  location_label  || null,
      estimasi_omzet:  estimasi_omzet  ? Number(estimasi_omzet)  : null,
      realisasi_omzet: realisasi_omzet ? Number(realisasi_omzet) : null,
      prospect_date,
      notes:           notes           || null,
      status:          'prospect',
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
    // sales_pic dan sales_user_id tidak bisa diubah
    const { sales_pic: _, sales_user_id: __, ...patch } = req.body;
    const updated = await db.updateSalesVisit(req.params.id, patch);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE visit (admin/superadmin only)
app.delete('/api/sales-visits/:id', requireRole('admin','superadmin'), async (req, res) => {
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
    const { stage, lat, lng } = req.body;
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
      await db.updateTicket(req.params.id, { status: newStatus });
      await db.insertStatusHistory({
        ticket_id:  req.params.id,
        status:     newStatus,
        timestamp:  now,
        technician: userName,
        lat:        lat || null,
        lng:        lng || null
      });
    }

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
      job_stages: job_stages || []
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
app.get('*',            (req, res) => res.sendFile(path.join(__dirname,'public','index.html')));

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

app.listen(PORT, () => {
  console.log(`\n✅ Helpdesk Pixel v5.2 → http://localhost:${PORT}`);
  console.log(`💾 Mode: ${db.USE_SUPABASE ? 'Supabase' : 'Local JSON'}`);
  console.log(`🗑️  Auto-delete invoice attachment: ${ATTACH_EXPIRE_DAYS} hari\n`);

  // Jalankan saat server start
  cleanExpiredAttachments();

  // Jalankan setiap 24 jam
  setInterval(cleanExpiredAttachments, 24 * 60 * 60 * 1000);
});
