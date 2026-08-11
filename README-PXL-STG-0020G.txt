PXL-STG-0020G — Fully Customizable Account Permissions
- Role menjadi preset/default saja.
- Semua checkbox menu/custom feature dapat dicentang atau dilepas; tidak ada lock berdasarkan role.
- Setelah akun disimpan, custom_menus menyimpan pilihan exact dengan custom_menus_override=true.
- Akun lama tetap memakai perilaku default lama sampai diedit/disimpan, sehingga aman untuk staging existing.
- Backend BOQ dan approval/create WO menghormati exact custom permission.
- Kanban, Invoice +14, Sales PIC tidak disentuh.
- Tidak ada SQL; field JSON/user record tambahan disimpan melalui mekanisme user existing.
- STAGING ONLY. Main/production tidak disentuh.
