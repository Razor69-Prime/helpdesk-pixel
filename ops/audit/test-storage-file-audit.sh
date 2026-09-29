#!/usr/bin/env bash
set -euo pipefail
AUDIT=/tmp/pxl-urg-0107c/storage-file-audit.sh
[[ -f "$AUDIT" ]] || { echo 'FAIL audit script missing'; exit 1; }
bash -n "$AUDIT"
for token in 'supabase.co' 'storage/v1' 'cloudinary.com' '/uploads/' 'invoices.file_url' 'standalone_invoices.file_url' 'work_order_photos.secure_url' 'service_photos.secure_url' 'users.signature_url'; do
  grep -q "$token" "$AUDIT" || { echo "FAIL missing audit target $token"; exit 1; }
done
echo PASS