'use strict';

/**
 * PXL-STG-0006D
 * Routing defensif:
 * - Jasa/Pekerjaan masuk ke service_items dan deskripsi Work Order teknisi.
 * - Material/Barang saja yang boleh masuk ke Material Request.
 *
 * Modul dipasang setelah PXL-STG-0006A agar tetap menggunakan dekorator SO/WO existing.
 */

const PATCH_KEY = Symbol.for('pxl.stg.0006d.routing');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  process.nextTick(installRouting);
}

function installRouting() {
  try {
    const db = require('./db');
    if (!db || db.__pxlStg0006DInstalled) return;

    Object.defineProperty(db, '__pxlStg0006DInstalled', {
      value: true,
      enumerable: false,
      configurable: false
    });

    const original = {
      insertTicket: db.insertTicket,
      insertCrmWorkOrder: db.insertCrmWorkOrder,
      insertMRForm: db.insertMRForm,
      insertCrmMaterialRequest: db.insertCrmMaterialRequest
    };

    function numberValue(value) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function isService(item) {
      const type = String(item?.item_type || item?.type || 'item').trim().toLowerCase();
      return type === 'service' || type === 'jasa';
    }

    function normalizeService(item) {
      const name = String(item?.name || item?.item_name || item?.description || '').trim();
      return {
        ...item,
        inventory_item_id: null,
        name,
        item_name: name,
        item_type: 'service',
        qty: numberValue(item?.qty),
        unit: String(item?.unit || 'jasa').trim() || 'jasa',
        unit_price: numberValue(item?.unit_price ?? item?.price),
        line_total: Number((numberValue(item?.qty) * numberValue(item?.unit_price ?? item?.price)).toFixed(2))
      };
    }

    function materialOnly(items) {
      return (Array.isArray(items) ? items : []).filter(item => !isService(item));
    }

    function servicesOnly(items) {
      return (Array.isArray(items) ? items : [])
        .filter(isService)
        .map(normalizeService)
        .filter(item => item.name && item.qty > 0);
    }

    async function salesOrderById(id) {
      if (!id) return null;
      const salesOrders = await db.getSalesOrders();
      return salesOrders.find(row => String(row.id) === String(id)) || null;
    }

    function serviceScope(services) {
      if (!services.length) return '';
      const lines = services.map((item, index) => {
        const qty = Number.isInteger(item.qty) ? item.qty : Number(item.qty.toFixed(2));
        return `${index + 1}. ${item.name} — ${qty} ${item.unit}`;
      });
      return ['DAFTAR PEKERJAAN / JASA', ...lines].join('\n');
    }

    function appendScope(description, services) {
      const current = String(description || '').trim();
      if (!services.length || current.includes('DAFTAR PEKERJAAN / JASA')) return current;
      return [current, serviceScope(services)].filter(Boolean).join('\n\n');
    }

    db.insertTicket = async function insertTicket0006D(data) {
      if (!data?.sales_order_id) return original.insertTicket(data);
      const salesOrder = await salesOrderById(data.sales_order_id);
      const services = servicesOnly(salesOrder?.items);
      const materials = materialOnly(salesOrder?.items);

      return original.insertTicket({
        ...data,
        description: appendScope(data.description, services),
        service_items: services,
        integration_meta: {
          ...(data.integration_meta || {}),
          service_item_count: services.length,
          material_item_count: materials.length,
          work_scope_source: 'sales_order_service_items',
          revision: 'PXL-STG-0006D'
        }
      });
    };

    db.insertCrmWorkOrder = async function insertCrmWorkOrder0006D(data) {
      if (!data?.sales_order_id) return original.insertCrmWorkOrder(data);
      const salesOrder = await salesOrderById(data.sales_order_id);
      const services = servicesOnly(salesOrder?.items);

      return original.insertCrmWorkOrder({
        ...data,
        project_name: data.project_name || salesOrder?.project_name || null,
        service_items: services,
        quotation_number: data.quotation_number || salesOrder?.quotation_number || null,
        quotation_revision_no: Number(
          data.quotation_revision_no
          ?? salesOrder?.quotation_revision_no
          ?? salesOrder?.revision_no
          ?? 0
        )
      });
    };

    if (typeof original.insertMRForm === 'function') {
      db.insertMRForm = async function insertMRForm0006D(data) {
        return original.insertMRForm({
          ...data,
          items: materialOnly(data?.items)
        });
      };
    }

    if (typeof original.insertCrmMaterialRequest === 'function') {
      db.insertCrmMaterialRequest = async function insertCrmMaterialRequest0006D(data) {
        return original.insertCrmMaterialRequest({
          ...data,
          items: materialOnly(data?.items)
        });
      };
    }
  } catch (error) {
    console.error('PXL-STG-0006D gagal diaktifkan:', error.message);
  }
}
