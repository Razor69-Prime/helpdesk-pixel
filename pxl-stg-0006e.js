'use strict';

/**
 * PXL-STG-0006E
 * Endpoint Customer 360 lengkap: transaksi, harga terakhir, WO, invoice, dan sinkronisasi ulang.
 */

const express = require('express');
const PATCH_KEY = Symbol.for('pxl.stg.0006e.customer360.routes');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  installCustomer360Routes();
}

function installCustomer360Routes() {
  const originalGet = express.application.get;
  const originalPost = express.application.post;
  let registered = false;

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function numberValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isService(item) {
    const type = String(item?.item_type || item?.type || 'item').toLowerCase();
    return type === 'service' || type === 'jasa';
  }

  function fallbackTransactions(customer, salesOrders) {
    return salesOrders
      .filter(row => String(row.status || '').toLowerCase() === 'approved')
      .map(row => {
        const items = Array.isArray(row.items) ? row.items : [];
        const materialItems = items.filter(item => !isService(item));
        const serviceItems = items.filter(isService);
        return {
          id: `so-${row.id}`,
          customer_id: customer.id,
          sales_order_id: row.id,
          so_number: row.so_number,
          quotation_number: row.quotation_number || null,
          quotation_revision_no: Number(row.quotation_revision_no ?? row.revision_no ?? 0),
          transaction_at: row.approved_at || row.created_at,
          status: 'approved',
          sales_pic: row.sales_pic || null,
          project_name: row.project_name || null,
          location: row.address || row.location || null,
          material_items: materialItems,
          service_items: serviceItems,
          material_subtotal: numberValue(row.material_subtotal),
          service_subtotal: numberValue(row.service_subtotal),
          grand_total: numberValue(row.quotation_total ?? row.total_amount)
        };
      })
      .sort((a, b) => new Date(b.transaction_at || 0) - new Date(a.transaction_at || 0));
  }

  function fallbackLastPrices(customerId, transactions) {
    const map = new Map();
    transactions.forEach(transaction => {
      [...(transaction.material_items || []), ...(transaction.service_items || [])].forEach(item => {
        const type = isService(item) ? 'service' : 'item';
        const name = String(item.name || item.item_name || '').trim();
        if (!name) return;
        const key = `${type}:${item.inventory_item_id || item.sku || normalizeName(name)}`;
        if (map.has(key)) return;
        map.set(key, {
          customer_id: customerId,
          item_type: type,
          item_key: item.inventory_item_id || item.sku || normalizeName(name),
          inventory_item_id: item.inventory_item_id || null,
          item_name: name,
          sku: item.sku || null,
          qty: numberValue(item.qty),
          unit: item.unit || null,
          unit_price: numberValue(item.unit_price),
          line_total: numberValue(item.line_total ?? numberValue(item.qty) * numberValue(item.unit_price)),
          transaction_at: transaction.transaction_at,
          sales_order_id: transaction.sales_order_id,
          so_number: transaction.so_number,
          quotation_number: transaction.quotation_number,
          quotation_revision_no: transaction.quotation_revision_no
        });
      });
    });
    return [...map.values()];
  }

  function invoiceTransactions(customer, invoices) {
    const validStatuses = new Set(['issued', 'partially_paid', 'paid', 'terbit', 'sebagian', 'lunas']);
    return invoices
      .filter(row => validStatuses.has(String(row.status || row.invoice_status || '').toLowerCase()))
      .map(row => {
        const items = Array.isArray(row.items) ? row.items : [];
        const materialItems = items.filter(item => !isService(item));
        const serviceItems = items.filter(isService);
        return {
          id: `invoice-${row.id}`,
          source: 'invoice',
          customer_id: row.customer_id || customer.id,
          invoice_id: row.id,
          invoice_number: row.invoice_number || null,
          sales_order_id: row.sales_order_id || null,
          so_number: row.so_number || null,
          transaction_at: row.issued_at || row.invoice_date || row.updated_at || row.created_at,
          status: row.status || row.invoice_status,
          project_name: row.project_name || null,
          location: row.billing_address || null,
          material_items: materialItems,
          service_items: serviceItems,
          grand_total: numberValue(row.grand_total ?? row.total_amount ?? row.base_total)
        };
      })
      .sort((a, b) => new Date(b.transaction_at || 0) - new Date(a.transaction_at || 0));
  }

  express.application.get = function pxlStg0006EGet(path, ...handlers) {
    const result = originalGet.call(this, path, ...handlers);

    if (!registered && path === '/api/crm/report' && handlers.length) {
      registered = true;
      const crmGuard = handlers[0];

      originalGet.call(
        this,
        '/api/crm/customer-360/:id',
        crmGuard,
        async function getCustomer360(req, res) {
          try {
            const db = require('./db');
            const customerId = String(req.params.id || '');
            const [customers, salesOrders, workOrders, invoices] = await Promise.all([
              db.getCrmCustomers(),
              db.getSalesOrders(),
              db.getCrmWorkOrders(),
              db.getCrmInvoices()
            ]);

            const customer = customers.find(row => String(row.id) === customerId);
            if (!customer) return res.status(404).json({ error: 'Customer tidak ditemukan.' });

            const sameCustomer = row => String(row.customer_id || '') === customerId
              || normalizeName(row.customer_name) === normalizeName(customer.name);

            const relatedSalesOrders = salesOrders.filter(sameCustomer);
            const relatedWorkOrders = workOrders.filter(sameCustomer);
            const relatedInvoices = invoices.filter(sameCustomer);

            let summary = null;
            let lastPrices = [];
            if (typeof db.getCustomer360Summary === 'function') {
              try { summary = await db.getCustomer360Summary(customerId); } catch (_) {}
            }
            if (typeof db.getCustomerLastPrices === 'function') {
              try { lastPrices = await db.getCustomerLastPrices(customerId); } catch (_) { lastPrices = []; }
            }

            const invoiceHistory = invoiceTransactions(customer, relatedInvoices);
            let transactions = invoiceHistory.length
              ? invoiceHistory
              : fallbackTransactions(customer, relatedSalesOrders);
            if (db.USE_SUPABASE) {
              try {
                const cfg = require('./config');
                const fetchImpl = global.fetch || require('node-fetch');
                const base = String(cfg.SUPABASE_URL || '').replace(/\/+$/, '');
                const key = process.env.SUPABASE_SERVICE_ROLE_KEY || cfg.SUPABASE_KEY || '';
                const response = await fetchImpl(
                  `${base}/rest/v1/crm_customer_transactions?customer_id=eq.${encodeURIComponent(customerId)}&order=transaction_at.desc,created_at.desc`,
                  {
                    headers: {
                      apikey: key,
                      Authorization: `Bearer ${key}`,
                      'Content-Type': 'application/json'
                    }
                  }
                );
                if (response.ok && !invoiceHistory.length) {
                  const rows = await response.json();
                  if (Array.isArray(rows) && rows.length) transactions = rows;
                }
              } catch (_) {}
            }

            if (invoiceHistory.length || !Array.isArray(lastPrices) || !lastPrices.length) {
              lastPrices = fallbackLastPrices(customerId, transactions);
            }

            const computedSummary = summary || {
              ...customer,
              computed_transaction_count: transactions.length,
              computed_lifetime_value: transactions.reduce((sum, row) => sum + numberValue(row.grand_total), 0),
              computed_last_transaction_at: transactions[0]?.transaction_at || customer.last_transaction_at || null,
              computed_last_sales_order_id: transactions[0]?.sales_order_id || customer.last_sales_order_id || null,
              computed_last_so_number: transactions[0]?.so_number || customer.last_so_number || null,
              computed_last_quotation_number: transactions[0]?.quotation_number || customer.last_quotation_number || null,
              computed_last_transaction_amount: numberValue(transactions[0]?.grand_total ?? customer.last_transaction_amount),
              computed_last_sales_pic: transactions[0]?.sales_pic || customer.last_sales_pic || null,
              computed_last_project_name: transactions[0]?.project_name || customer.last_project_name || null,
              computed_last_location: transactions[0]?.location || customer.last_location || null
            };

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return res.json({
              revision: 'PXL-STG-0008A34',
              customer,
              summary: computedSummary,
              transactions,
              last_prices: lastPrices,
              sales_orders: relatedSalesOrders,
              work_orders: relatedWorkOrders,
              invoices: relatedInvoices
            });
          } catch (error) {
            return res.status(500).json({ error: error.message });
          }
        }
      );

      originalPost.call(
        this,
        '/api/crm/customer-360/:id/sync',
        crmGuard,
        async function syncCustomer360(req, res) {
          try {
            const allowedRoles = ['sales', 'manager', 'admin', 'superadmin'];
            if (!allowedRoles.includes(String(req.session?.user?.role || '').toLowerCase())) {
              return res.status(403).json({ error: 'Akses sinkronisasi Customer 360 ditolak.' });
            }

            const db = require('./db');
            if (typeof db.syncSalesOrderCustomer360 !== 'function') {
              return res.status(503).json({ error: 'Fondasi Customer 360 belum aktif.' });
            }

            const customerId = String(req.params.id || '');
            const customers = await db.getCrmCustomers();
            const customer = customers.find(row => String(row.id) === customerId);
            if (!customer) return res.status(404).json({ error: 'Customer tidak ditemukan.' });

            const salesOrders = await db.getSalesOrders();
            const candidates = salesOrders.filter(row =>
              String(row.status || '').toLowerCase() === 'approved'
              && (
                String(row.customer_id || '') === customerId
                || normalizeName(row.customer_name) === normalizeName(customer.name)
              )
            );

            let synced = 0;
            for (const salesOrder of candidates) {
              await db.syncSalesOrderCustomer360({ ...salesOrder, customer_id: customerId });
              synced += 1;
            }

            return res.json({ ok: true, customer_id: customerId, synced });
          } catch (error) {
            return res.status(500).json({ error: error.message });
          }
        }
      );
    }

    return result;
  };
}
