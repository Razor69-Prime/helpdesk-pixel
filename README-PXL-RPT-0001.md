# PXL-RPT-0001 — Hybrid Report Center (Superadmin Read-Only)
Base: origin/main 8348a44 (PXL-URG-0133)
Branch: feature/pxl-rpt-0001
No database migration, no production deployment.
Routes are GET-only, authenticated, and Superadmin-only.
Available reports: WO, SO, visits, projects, MR, PR, CRM invoices.
Exports use existing report-service.js; original report buttons/routes unchanged.
This is a staged source branch. UAT with real data is required before deployment.
Known limitations: columns depend on existing field aliases; 5,000-row maximum; date filtering excludes rows with no recognized date field. Existing generic /api/reports routes are unchanged by this branch.
