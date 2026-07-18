PXL-REV-0029
Modul: Penyelesaian Tiket, Material Request, Inventory, Manajemen Akun

Perubahan:
1. Menghapus field notes sebelum insert ke material_request_forms karena kolom tersebut tidak ada pada database aktif.
2. Penyelesaian tiket dengan material tetap dapat membuat Material Request tanpa error PGRST204.
3. Role Teknisi tidak lagi melihat menu Inventory Asset.
4. Custom menu lama tidak dapat memunculkan Inventory untuk Teknisi.
5. Checklist Inventory pada akun Teknisi dinonaktifkan; Material Request tetap dapat memakai lookup Inventory melalui backend.

SQL: Tidak ada.
Dependency baru: Tidak ada.
