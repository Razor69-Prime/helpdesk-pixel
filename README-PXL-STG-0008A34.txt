PXL-STG-0008A34 — Customer 360 riwayat pembelian terakhir

Branch: staging

Perubahan:
- Customer 360 menampilkan nomor dan tanggal transaksi terakhir.
- Menampilkan nominal transaksi terakhir.
- Menampilkan barang/jasa terakhir yang dibeli dan harga satuan terakhir.
- Riwayat transaksi memprioritaskan Invoice berstatus Terbit/Sebagian/Lunas.
- Jika belum ada Invoice Terbit, data lama tetap dapat fallback dari Sales Order Approved.
- Script Customer 360 dipasang langsung pada crm.html agar tidak hilang akibat mekanisme injeksi/cache.
- Sinkronisasi Invoice ke CRM ikut menyimpan tipe item atau jasa.

Tidak ada SQL baru. Production dan branch main tidak disentuh.
