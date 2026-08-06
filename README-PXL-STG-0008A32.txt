PXL-STG-0008A32 — FLOW WO TANPA MATERIAL & AKSES MR TEKNISI

Branch target: staging
Production/main: tidak disentuh
SQL: tidak ada

Perubahan:
1. Material Request tidak lagi wajib untuk setiap Work Order.
2. WO tanpa MR dapat diselesaikan setelah tanda tangan teknisi dan customer lengkap.
3. Jika WO mempunyai MR, material wajib sudah berstatus diambil sebelum WO diselesaikan.
4. Jika WO mempunyai MR, seluruh pengembalian material wajib selesai sebelum Invoice diajukan, disetujui, atau diterbitkan.
5. WO tanpa MR tidak tertahan pada proses Invoice setelah WO selesai.
6. Teknisi selalu dapat melihat dan membuat Material Request dari WO yang ditugaskan kepadanya.
7. Validasi assignment teknisi tetap dilakukan di server; teknisi tidak dapat membuat MR untuk WO teknisi lain.

Flow tanpa material:
WO ditugaskan -> pekerjaan selesai -> tanda tangan teknisi + customer -> WO selesai -> Invoice

Flow dengan material:
WO ditugaskan -> teknisi membuat MR -> material diambil -> pekerjaan selesai -> tanda tangan teknisi + customer -> WO selesai -> material dikembalikan -> Invoice

