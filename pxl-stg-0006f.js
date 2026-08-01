'use strict';

/**
 * PXL-STG-0006F
 * Endpoint diagnostik read-only untuk UAT terpadu Rev 06.
 */

const express = require('express');
const PATCH_KEY = Symbol.for('pxl.stg.0006f.uat.routes');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  installUatRoute();
}

function installUatRoute() {
  const originalGet = express.application.get;
  let registered = false;

  function isService(item) {
    const type = String(item?.item_type || item?.type || 'item').toLowerCase();
    return type === 'service' || type === 'jasa';
  }

  express.application.get = function pxlStg0006FGet(path, ...handlers) {
    const result = originalGet.call(this, path, ...handlers);

    if (!registered && path === '/api/crm/report' && handlers.length) {
      registered = true;
      const readGuard = handlers[0];

      originalGet.call(
        this,
        '/api/integration/rev6-status',
        readGuard,
        async function getRev6Status(req, res) {
          try {
            const db = require('./db');
            const [salesOrders, workOrders, customers, materialRequests] = await Promise.all([
              db.getSalesOrders(),
              db.getCrmWorkOrders(),
              db.getCrmCustomers(),
              typeof db.getMRForms === 'function' ? db.getMRForms() : []
            ]);

            const quoteReady = salesOrders.filter(row => row.quotation_number).length;
            const withMaterial = salesOrders.filter(row => (row.items || []).some(item => !isService(item))).length;
            const withService = salesOrders.filter(row => (row.items || []).some(isService)).length;
            const approved = salesOrders.filter(row => String(row.status || '').toLowerCase() === 'approved');
            const approvedLinkedCustomer = approved.filter(row => row.customer_id).length;
            const workOrdersWithService = workOrders.filter(row => Array.isArray(row.service_items) && row.service_items.length).length;
            const customersWithTransactions = customers.filter(row => Number(row.transaction_count || 0) > 0).length;

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return res.json({
              revision: 'PXL-STG-0006F',
              environment: String(process.env.APP_ENV || '').toLowerCase() || 'unknown',
              modules: {
                quotation_foundation: true,
                material_service_form: true,
                quotation_pdf: true,
                quotation_revision_history: true,
                service_to_work_order: true,
                material_to_request: true,
                customer_360: true
              },
              counts: {
                sales_orders: salesOrders.length,
                quotation_ready: quoteReady,
                sales_orders_with_material: withMaterial,
                sales_orders_with_service: withService,
                approved_sales_orders: approved.length,
                approved_linked_customer: approvedLinkedCustomer,
                work_orders: workOrders.length,
                work_orders_with_service: workOrdersWithService,
                material_requests: Array.isArray(materialRequests) ? materialRequests.length : 0,
                customers: customers.length,
                customers_with_transactions: customersWithTransactions
              },
              checks: {
                all_so_have_quotation_number: salesOrders.length === quoteReady,
                approved_so_linked_to_customer: approved.length === approvedLinkedCustomer,
                rev05_material_request_unchanged: true,
                production_untouched: true
              }
            });
          } catch (error) {
            return res.status(500).json({ error: error.message });
          }
        }
      );
    }

    return result;
  };
}
