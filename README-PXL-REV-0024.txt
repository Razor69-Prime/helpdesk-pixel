PXL-REV-0024
Modul: Material Request
Fitur: Tanda tangan Material Request mengikuti pola Purchase Request.

Struktur Purchase Request yang dijadikan acuan:
- requester_signature
- approver1_signature
- approver_signature
- identitas penanda tangan dan timestamp approval

Implementasi Material Request:
- requester_signature: wajib saat pengambilan material pertama kali disimpan
- requester_signed_by / requester_signed_at
- technician_signature: wajib saat teknisi menyelesaikan pengembalian
- technician_signed_by / technician_signed_at
- prepared_signature / prepared_by / prepared_at disiapkan untuk pengembangan petugas gudang
- tanda tangan dapat memakai profil akun, menggambar, atau upload PNG/JPG
- PDF Material Request menampilkan tanda tangan PIC dan Teknisi

Cara implementasi:
1. Jalankan PXL-REV-0024-material-request-signature.sql di Supabase SQL Editor.
2. Replace public/index.html dari ZIP ini.
3. Jalankan npm start dan tes lokal.
4. Push ke GitHub.

Tidak ada dependency baru.
