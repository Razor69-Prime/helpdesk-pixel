# Absensi Online V1 — Design Spec

## Goal
Membangun modul Absensi Online PixelApps yang aman untuk seluruh user login, menggunakan kamera live, GPS wajib, waktu resmi server yang dihitung dalam WITA, rule jam kerja otomatis, dan administrasi HR berbasis permission tanpa mengubah timezone VPS.

## Scope yang Disetujui
- Event absensi hanya `CHECK_IN` dan `CHECK_OUT`.
- Foto wajib diambil dari kamera live melalui browser/PWA. Tidak ada upload file/galeri sebagai fallback.
- GPS/location service wajib berhasil dibaca saat absensi. Jika permission ditolak, GPS mati, atau pembacaan lokasi gagal, absensi tidak dapat disubmit.
- GPS hanya direkam sebagai bukti lokasi (`latitude`, `longitude`, `accuracy`); tidak ada validasi titik/radius pada V1.
- Sumber waktu resmi adalah backend/server. Timezone bisnis attendance adalah `Asia/Makassar` (WITA). Timezone VPS tidak diubah.
- Field `Pekerjaan / kegiatan` tersedia pada setiap aksi absensi dan bersifat opsional.
- Role baru `HR` ditambahkan ke Manajemen Akun.
- Role HR tidak otomatis mendapat hak Admin HR maupun approval cuti.
- Akses Admin HR Cuti memakai permission `hr_admin_manage`.
- Approval/reject cuti tetap memakai permission existing `leave_approve` dan terpisah dari role HR maupun `hr_admin_manage`.
- Permission attendance:
  - `attendance_view_all`: melihat seluruh absensi.
  - `attendance_manage_rules`: mengelola rule jam kerja.
  - `attendance_manage`: melakukan koreksi administratif attendance dengan audit trail.
- User biasa selalu dapat CHECK_IN/CHECK_OUT dan melihat riwayat miliknya sendiri tanpa permission tambahan.

## Rule Jam Kerja Default
Timezone: `Asia/Makassar`.

- Senin–Jumat: masuk 08:00, pulang 16:30.
- Sabtu: masuk 08:30, pulang 13:00.
- Minggu: hari libur/non-workday.
- Tidak ada toleransi keterlambatan.
- CHECK_IN tepat pada jam mulai = `On Time`.
- CHECK_IN setelah jam mulai = `Late`.
- CHECK_OUT sebelum jam pulang = `Early Checkout`.
- CHECK_OUT pada/selepas jam pulang tetapi kurang dari 2 jam setelah jam pulang = checkout normal, lembur tidak dihitung.
- CHECK_OUT minimal 2 jam setelah jam pulang dan kurang dari 4 jam = `Overtime Stage 1`.
- CHECK_OUT minimal 4 jam setelah jam pulang = `Overtime Stage 2`.
- V1 hanya menampilkan informasi tahap lembur. Tidak ada Form Lembur, approval lembur, atau perhitungan nominal lembur.
- Attendance pada hari non-workday tetap dapat direkam sebagai `Off Day Attendance`, tetapi V1 tidak menghitung Late/Early Checkout/Overtime otomatis pada hari tersebut.

## User Flow
### CHECK_IN
1. User membuka menu Absensi Online.
2. UI meminta lokasi dengan `navigator.geolocation` dan harus mendapatkan latitude/longitude/accuracy.
3. UI meminta context dari backend berisi waktu server WITA dan capture nonce berumur pendek.
4. Kamera live dibuka dengan `navigator.mediaDevices.getUserMedia`; tidak ada `<input type=file>` untuk foto attendance.
5. User mengisi `Pekerjaan / kegiatan` bila perlu.
6. User menekan Capture.
7. Browser membuat frame JPEG dan watermark yang memuat Pixel Solusindo, nama user, `CHECK_IN`, waktu server WITA dari capture context, latitude/longitude, dan accuracy.
8. Foto diunggah melalui jalur upload attendance.
9. Backend membuat CHECK_IN dengan timestamp server aktual, menghitung status menggunakan rule aktif, dan menyimpan audit metadata.

### CHECK_OUT
Flow sama seperti CHECK_IN, tetapi backend mengharuskan CHECK_IN pada work date terkait sudah ada dan CHECK_OUT belum ada. Status checkout dan overtime dihitung server-side.

## Camera-only Enforcement
- Attendance photo harus berasal dari frame stream `getUserMedia`.
- UI attendance tidak menyediakan file picker, drag/drop, paste image, atau gallery upload.
- Jika camera permission ditolak, kamera tidak tersedia, atau browser tidak mendukung `getUserMedia`, submit attendance diblokir dengan pesan yang jelas.
- Backend hanya menerima foto yang terikat pada capture nonce attendance yang valid dan belum dipakai.
- Nonce adalah anti-replay ringan untuk membedakan alur capture attendance dari upload gambar umum; ini bukan klaim anti-spoofing tingkat biometrik.

## GPS Enforcement
- `latitude`, `longitude`, dan `accuracy` wajib untuk CHECK_IN/CHECK_OUT.
- Backend memvalidasi angka finite dan rentang latitude/longitude.
- Tidak ada validasi radius, geofence, atau alamat pada V1.
- Accuracy disimpan apa adanya untuk audit dan detail attendance.

## Waktu dan Status
- Backend memakai current server timestamp sebagai sumber resmi event.
- Konversi kalender, work date, jam kerja, status, dan display attendance menggunakan timezone `Asia/Makassar`.
- Waktu HP tidak digunakan untuk menentukan On Time/Late/Early Checkout/Overtime.
- Watermark memakai waktu server dari capture context; timestamp database tetap timestamp server saat submit. Selisih beberapa detik dapat terjadi dan timestamp database adalah sumber kebenaran.
- Capture context/nonce harus berumur pendek; bila kedaluwarsa user harus mengambil context/capture ulang.

## Data Model
### `attendance_rules`
Satu rule per day-of-week untuk V1, additive dan dapat dikelola permission `attendance_manage_rules`.
- `id`
- `day_of_week` (1=Senin ... 7=Minggu)
- `is_workday`
- `check_in_time`
- `check_out_time`
- `timezone` default `Asia/Makassar`
- `overtime_stage1_minutes` default `120`
- `overtime_stage2_minutes` default `240`
- `is_active`
- `updated_by_id`, `updated_by_name`, `updated_at`

Seed default sesuai rule yang disetujui.

### `attendance_records`
Satu row per user per work date.
- identity: `id`, `user_id`, `user_name`, `work_date`, `timezone`
- CHECK_IN: `check_in_at`, `check_in_status`, `check_in_photo_url`, `check_in_photo_public_id`, `check_in_latitude`, `check_in_longitude`, `check_in_accuracy`, `check_in_work_context`
- CHECK_OUT: `check_out_at`, `check_out_status`, `check_out_photo_url`, `check_out_photo_public_id`, `check_out_latitude`, `check_out_longitude`, `check_out_accuracy`, `check_out_work_context`
- overtime snapshot: `overtime_stage`, `overtime_eligible_minutes` (0 pada V1 kecuali threshold tercapai; digunakan sebagai informasi, bukan payroll)
- rule snapshot: scheduled start/end dan rule id/version yang dipakai saat event dihitung
- audit: `created_at`, `updated_at`
- unique `(user_id, work_date)`.

### `attendance_capture_tokens`
Token/nonce capture berumur pendek.
- `id/token_hash`, `user_id`, `event_type`, `server_time_issued_at`, `expires_at`, `used_at`
- optional location snapshot untuk mengikat GPS yang dipakai watermark dengan submit.

### `attendance_history`
Append-only audit untuk koreksi administratif.
- `attendance_record_id`, `action`, `before_json`, `after_json`, `actor_user_id`, `actor_name`, `actor_role`, `reason`, `created_at`.

## API Surface
Semua endpoint membutuhkan session auth existing.

- `GET /api/attendance/me?from=&to=` — riwayat user sendiri.
- `GET /api/attendance/today` — status attendance hari WITA berjalan dan rule aktif.
- `POST /api/attendance/capture-context` — validasi GPS dasar dan menerbitkan server WITA context + nonce untuk `CHECK_IN`/`CHECK_OUT`.
- `POST /api/attendance/photo-upload` atau signed-upload equivalent — upload khusus attendance terikat nonce.
- `POST /api/attendance/check-in` — create CHECK_IN server-side.
- `POST /api/attendance/check-out` — create CHECK_OUT server-side.
- `GET /api/attendance/admin?from=&to=&user_id=` — seluruh attendance, permission `attendance_view_all`.
- `GET /api/attendance/rules` — rule aktif; user biasa boleh read untuk menampilkan jam kerja.
- `PUT /api/attendance/rules` — permission `attendance_manage_rules`.
- `PATCH /api/attendance/admin/:id` — koreksi administratif, permission `attendance_manage`, reason wajib, append audit history.
- `GET /api/attendance/admin/:id/history` — `attendance_view_all` atau `attendance_manage`.

## Permission & Role Integration
### Role `HR`
- Ditambahkan pada dropdown create/edit user.
- Tidak memberi permission attendance/leave secara implisit selain akses user biasa ke attendance miliknya sendiri.

### `hr_admin_manage`
- Menggantikan hard-coded role gate Admin HR Cuti untuk akses pengelolaan saldo, dropdown HR, dan history admin.
- Superadmin boleh bypass seperti pola permission PixelApps existing.
- Manager/Admin/HR tidak otomatis mendapat Admin HR hanya karena role. Akses ditentukan checklist `hr_admin_manage` pada akun.

### `leave_approve`
- Tidak diubah maknanya.
- Role HR tidak otomatis mendapatnya.
- `hr_admin_manage` tidak mengimplikasikan `leave_approve`.

## UI
### Menu Absensi Online
Mobile-first, karena kamera/GPS terutama digunakan di HP.
- Card status hari ini: jadwal, CHECK_IN, CHECK_OUT, status.
- Tombol aksi kontekstual: CHECK_IN lalu CHECK_OUT.
- Field `Pekerjaan / kegiatan (opsional)`.
- Kamera live, preview capture, GPS status/accuracy, server WITA status.
- Riwayat attendance user.
- Detail record menampilkan foto, GPS, accuracy, waktu WITA, status, work context, dan overtime stage bila ada.

### Admin Attendance
Hanya muncul sesuai permission.
- Filter tanggal dan user.
- `attendance_view_all`: read-only list/detail seluruh user.
- `attendance_manage_rules`: editor rule mingguan.
- `attendance_manage`: koreksi record dengan reason wajib dan history terlihat.

### Manajemen Akun
Tambahkan role HR dan checklist:
- Admin HR Cuti (`hr_admin_manage`)
- Approval Cuti (`leave_approve`) — existing
- Attendance: Lihat Semua (`attendance_view_all`)
- Attendance: Atur Rules (`attendance_manage_rules`)
- Attendance: Koreksi/Admin (`attendance_manage`)

## Security & Integrity
- Semua kalkulasi status dilakukan backend, bukan dipercaya dari client.
- Client tidak dapat mengirim timestamp resmi, status, overtime stage, atau rule result untuk dipercaya backend.
- Event duplicate pada user/work_date ditolak secara deterministic.
- CHECK_OUT tanpa CHECK_IN ditolak.
- GPS required fields divalidasi server-side.
- Capture nonce single-use dan expired token ditolak.
- Admin correction selalu membutuhkan reason dan menulis append-only history.
- Tidak ada perubahan timezone VPS, cron, backup, atau service lain.

## Out of Scope V1
- Geofence/radius validation.
- Face recognition/liveness/biometric identity.
- Upload foto dari galeri/file.
- Form Lembur dan approval lembur.
- Payroll/nominal lembur.
- Shift per orang, split shift, roster kompleks.
- Auto-address/reverse geocoding.
- Perubahan timezone VPS.

## Acceptance Criteria
1. User dapat CHECK_IN/CHECK_OUT hanya setelah GPS berhasil dan kamera live menghasilkan capture.
2. Tidak ada jalur gallery/file upload pada attendance.
3. Timestamp resmi/status dihitung backend dan ditampilkan WITA.
4. Senin–Jumat/Sabtu mengikuti jam yang disetujui tanpa tolerance.
5. 1 jam lewat jam pulang tidak dihitung lembur; 2 jam = Stage 1; 4 jam = Stage 2.
6. Work context opsional dan tidak memblokir submit bila kosong.
7. Role HR tersedia di Manajemen Akun, tetapi tidak otomatis mendapat Admin HR atau approval cuti.
8. `hr_admin_manage` dan `leave_approve` independen.
9. Attendance admin permissions terpisah dan dapat disimpan melalui Account Management existing.
10. Koreksi admin memiliki reason + audit history.
11. Regression test existing tetap hijau dan flow Cuti existing tidak kehilangan data/history.
12. Production timezone/cron tidak berubah.
