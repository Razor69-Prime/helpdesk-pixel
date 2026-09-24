PXL-URG-0086 — Standalone Package Recipe

Scope
- Modul Master Paket / Package Recipe standalone untuk fase UAT.
- HANYA Superadmin.
- Belum terhubung ke Sales Order, Material Request, Work Order, atau perubahan quantity Inventory.
- Paket dapat dibuat, diedit, dicopy menjadi paket baru, dinonaktifkan/diaktifkan, dan dihapus.
- Recipe menyimpan Material / Jasa / Cost.
- Pricing: HPP, markup per item, PPN, harga paket manual, diskon, harga final, profit ex-PPN, margin.
- Version snapshot disimpan pada setiap create/update/copy.

Anomaly rules aktif
- RULE-PKG-001: RG59/RG6 minimum 10 meter per kamera.
- RULE-PKG-002: 1-4 kamera membutuhkan minimal DVR 4 Channel.
- RULE-PKG-003: 5-8 kamera membutuhkan minimal DVR 8 Channel.
- RULE-PKG-004: 9-16 kamera membutuhkan minimal DVR 16 Channel.
- RULE-PKG-005: Brand Camera dan DVR berbeda -> warning.
- Warning tidak memblokir Save.

File
- PXL-URG-0086-package-recipe.sql
- db-core.js
- server.js
- public/package-recipes.html
- public/pxl-urg-0086-package-recipes.js
- public/index.html

Deployment
- GitHub push saja pada request PXL-URG-0086.
- Migration dan deployment VPS belum dilakukan.
