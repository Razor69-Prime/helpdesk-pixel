'use strict';

/**
 * PXL-STG-0006A
 * Fondasi quotation, routing service item ke WO, snapshot revisi, dan Customer 360.
 *
 * Modul ini tidak mendaftarkan route Express dan tidak mengubah flow Material Request.
 * Ia mendekorasi adapter db setelah server selesai memuat config/db, sehingga source
 * PXL-STG-0005 tetap berjalan seperti sebelumnya.
 */

const PATCH_KEY = Symbol.for('pxl.stg.0006a.db.foundation');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  process.nextTick(installPxlStg0006A);
}

function installPxlStg0006A() {
  try {
    const db = require('./db');
    const cfg = require('./config');

    if (!db || db.__pxlStg0006AInstalled) return;
    Object.defineProperty(db, '__pxlStg0006AInstalled', {
      value: true,
      enumerable: false,
      configurable: false
    });

    const original = {
      getSalesOrders: db.getSalesOrders,
      insertSalesOrder: db.insertSalesOrder,
      updateSalesOrder: db.updateSalesOrder,
      insertTicket: db.insertTicket,
      insertCrmWorkOrder: db.insertCrmWorkOrder,
      getCrmCustomers: db.getCrmCustomers,
      insertCrmCustomer: db.insertCrmCustomer,
      updateCrmCustomer: db.updateCrmCustomer
    };

    const fetchImpl = global.fetch || require('node-fetch');
    const supabaseUrl = String(cfg.SUPABASE_URL || '').replace(/\/+$/, '');
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || cfg.SUPABASE_KEY || '';

    async function rest(method, path, body, prefer = 'return=representation') {
      if (!db.USE_SUPABASE) return null;
      if (!supabaseUrl || !supabaseKey) throw new Error('Konfigurasi Supabase server belum tersedia.');

      const response = await fetchImpl(`${supabaseUrl}/rest/v1${path}`, {
        method,
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: prefer
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });

      const text = await response.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); }
        catch (_) { data = text; }
      }

      if (!response.ok) {
        const message = typeof data === 'string'
          ? data
          : data?.message || data?.details || data?.hint || `Supabase HTTP ${response.status}`;
        throw new Error(message);
      }

      return data;
    }

    function safeNumber(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    }

    function normalizePhone(value) {
      let digits = String(value || '').replace(/\D/g, '');
      if (!digits) return '';
      if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
      else if (!digits.startsWith('62')) digits = `62${digits}`;
      return digits;
    }

    function normalizeItemName(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    }

    function normalizeItem(item, forcedType) {
      const rawType = String(forcedType || item?.item_type || item?.type || 'item').toLowerCase();
      const itemType = ['service', 'jasa'].includes(rawType) ? 'service' : 'item';
      const name = String(item?.name || item?.item_name || item?.description || '').trim();
      const qty = safeNumber(item?.qty);
      const unitPrice = safeNumber(item?.unit_price ?? item?.price);
      return {
        ...item,
        name,
        item_name: name,
        item_type: itemType,
        qty,
        unit: String(item?.unit || 'pcs').trim() || 'pcs',
        unit_price: unitPrice,
        line_total: Number((qty * unitPrice).toFixed(2))
      };
    }

    function splitItems(items) {
      const materialItems = [];
      const serviceItems = [];

      (Array.isArray(items) ? items : []).forEach(raw => {
        const normalized = normalizeItem(raw);
        if (normalized.item_type === 'service') serviceItems.push(normalized);
        else materialItems.push(normalized);
      });

      return { materialItems, serviceItems };
    }

    function addDays(dateValue, days) {
      const date = dateValue ? new Date(dateValue) : new Date();
      if (Number.isNaN(date.getTime())) return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0, 10);
    }

    function quotationTotals(items) {
      const { materialItems, serviceItems } = splitItems(items);
      const materialSubtotal = materialItems.reduce((sum, item) => sum + item.line_total, 0);
      const serviceSubtotal = serviceItems.reduce((sum, item) => sum + item.line_total, 0);
      return {
        items: [...materialItems, ...serviceItems],
        materialItems,
        serviceItems,
        materialSubtotal: Number(materialSubtotal.toFixed(2)),
        serviceSubtotal: Number(serviceSubtotal.toFixed(2)),
        quotationTotal: Number((materialSubtotal + serviceSubtotal).toFixed(2))
      };
    }

    function withQuotationFields(data, oldRow = null) {
      const sourceItems = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(oldRow?.items)
          ? oldRow.items
          : [];

      const totals = quotationTotals(sourceItems);
      const quotationDate = data?.quotation_date
        || oldRow?.quotation_date
        || new Date().toISOString().slice(0, 10);

      return {
        ...data,
        ...(Array.isArray(data?.items) ? { items: totals.items } : {}),
        quotation_status: data?.quotation_status || oldRow?.quotation_status || data?.status || oldRow?.status || 'draft',
        quotation_date: quotationDate,
        quotation_valid_until: data?.quotation_valid_until
          || oldRow?.quotation_valid_until
          || addDays(quotationDate, 14),
        quotation_title: data?.quotation_title
          || oldRow?.quotation_title
          || data?.project_name
          || oldRow?.project_name
          || 'Penawaran',
        material_subtotal: totals.materialSubtotal,
        service_subtotal: totals.serviceSubtotal,
        quotation_total: totals.quotationTotal,
        total_amount: data?.total_amount ?? totals.quotationTotal
      };
    }

    function hasQuotationContentChange(patch) {
      if (!patch || typeof patch !== 'object') return false;
      const fields = [
        'items', 'customer_name', 'customer_phone', 'address', 'location',
        'project_name', 'quotation_title', 'quotation_date',
        'quotation_valid_until', 'notes', 'sales_pic', 'sales_pic_user_id'
      ];
      return fields.some(field => Object.prototype.hasOwnProperty.call(patch, field));
    }

    function revisionPayload(so, revisionReason) {
      const { materialItems, serviceItems, materialSubtotal, serviceSubtotal, quotationTotal } = quotationTotals(so.items);
      const revisionNo = Number(so.quotation_revision_no ?? so.revision_no ?? 0);

      return {
        sales_order_id: so.id,
        quotation_number: so.quotation_number,
        revision_no: revisionNo,
        quotation_status: so.quotation_status || so.status || 'draft',
        so_number: so.so_number,
        customer_id: so.customer_id || null,
        customer_name: so.customer_name || '-',
        customer_phone: so.customer_phone || null,
        customer_address: so.address || so.location || null,
        sales_pic: so.sales_pic || null,
        project_name: so.project_name || null,
        quotation_title: so.quotation_title || so.project_name || 'Penawaran',
        quotation_date: so.quotation_date || new Date().toISOString().slice(0, 10),
        valid_until: so.quotation_valid_until || addDays(so.quotation_date, 14),
        material_items: materialItems,
        service_items: serviceItems,
        material_subtotal: so.material_subtotal ?? materialSubtotal,
        service_subtotal: so.service_subtotal ?? serviceSubtotal,
        grand_total: so.quotation_total ?? so.total_amount ?? quotationTotal,
        notes: so.notes || null,
        revision_reason: revisionReason || null,
        snapshot: so,
        pdf_template_version: 'PXL-STG-0006',
        created_by: so.updated_by || so.approved_by || so.created_by || null
      };
    }

    async function saveRevision(so, reason) {
      if (!so?.id || !so?.quotation_number) return null;
      if (!db.USE_SUPABASE) return revisionPayload(so, reason);

      const path = '/sales_order_quotation_revisions?on_conflict=sales_order_id,revision_no';
      const rows = await rest(
        'POST',
        path,
        revisionPayload(so, reason),
        'resolution=merge-duplicates,return=representation'
      );
      return Array.isArray(rows) ? rows[0] : rows;
    }

    async function findOrCreateCustomer(so) {
      const customers = await original.getCrmCustomers();
      const normalizedPhone = normalizePhone(so.customer_phone);
      const normalizedName = normalizeItemName(so.customer_name);

      let customer = normalizedPhone
        ? customers.find(row =>
            String(row.normalized_phone || '') === normalizedPhone
            || normalizePhone(row.phone) === normalizedPhone
          )
        : null;

      if (!customer && normalizedName) {
        customer = customers.find(row => normalizeItemName(row.name) === normalizedName) || null;
      }

      const patch = {
        name: so.customer_name,
        phone: so.customer_phone || customer?.phone || null,
        normalized_phone: normalizedPhone || customer?.normalized_phone || null,
        address: so.address || so.location || customer?.address || null,
        sales_pic: so.sales_pic || customer?.sales_pic || null,
        status: 'active'
      };

      if (customer) return original.updateCrmCustomer(customer.id, patch);

      return original.insertCrmCustomer({
        ...patch,
        type: 'B2B',
        source_name: 'sales_order',
        created_by: so.approved_by || so.created_by || 'System'
      });
    }

    async function syncCustomerSummary(customerId) {
      if (!db.USE_SUPABASE || !customerId) return null;
      const transactions = await rest(
        'GET',
        `/crm_customer_transactions?customer_id=eq.${encodeURIComponent(customerId)}`
          + '&status=eq.approved&order=transaction_at.desc,created_at.desc'
      ) || [];

      const latest = transactions[0] || null;
      const lifetimeValue = transactions.reduce((sum, row) => sum + safeNumber(row.grand_total), 0);

      return original.updateCrmCustomer(customerId, {
        last_transaction_at: latest?.transaction_at || null,
        last_sales_order_id: latest?.sales_order_id || null,
        last_so_number: latest?.so_number || null,
        last_quotation_number: latest?.quotation_number || null,
        last_transaction_amount: latest ? safeNumber(latest.grand_total) : 0,
        transaction_count: transactions.length,
        lifetime_value: Number(lifetimeValue.toFixed(2)),
        last_sales_pic: latest?.sales_pic || null,
        last_project_name: latest?.project_name || null,
        last_location: latest?.location || null
      });
    }

    async function syncCustomer360(so) {
      if (!so?.id || String(so.status || '').toLowerCase() !== 'approved') return so;

      const customer = await findOrCreateCustomer(so);
      let linkedSo = so;

      if (customer?.id && String(so.customer_id || '') !== String(customer.id)) {
        linkedSo = await original.updateSalesOrder(so.id, { customer_id: customer.id });
      }

      if (!db.USE_SUPABASE || !customer?.id) return linkedSo;

      const totals = quotationTotals(linkedSo.items);
      const transactionPayload = {
        customer_id: customer.id,
        sales_order_id: linkedSo.id,
        so_number: linkedSo.so_number,
        quotation_number: linkedSo.quotation_number || null,
        quotation_revision_no: Number(linkedSo.quotation_revision_no ?? linkedSo.revision_no ?? 0),
        transaction_at: linkedSo.approved_at || new Date().toISOString(),
        status: 'approved',
        sales_pic: linkedSo.sales_pic || null,
        project_name: linkedSo.project_name || null,
        location: linkedSo.address || linkedSo.location || null,
        material_items: totals.materialItems,
        service_items: totals.serviceItems,
        material_subtotal: linkedSo.material_subtotal ?? totals.materialSubtotal,
        service_subtotal: linkedSo.service_subtotal ?? totals.serviceSubtotal,
        grand_total: linkedSo.quotation_total ?? linkedSo.total_amount ?? totals.quotationTotal,
        created_by: linkedSo.approved_by || linkedSo.created_by || null
      };

      const transactionRows = await rest(
        'POST',
        '/crm_customer_transactions?on_conflict=sales_order_id',
        transactionPayload,
        'resolution=merge-duplicates,return=representation'
      );
      const transaction = Array.isArray(transactionRows) ? transactionRows[0] : transactionRows;

      if (transaction?.id) {
        await rest(
          'DELETE',
          `/crm_customer_transaction_lines?sales_order_id=eq.${encodeURIComponent(linkedSo.id)}`,
          undefined,
          'return=minimal'
        );

        const lines = [...totals.materialItems, ...totals.serviceItems].map((item, index) => ({
          transaction_id: transaction.id,
          customer_id: customer.id,
          sales_order_id: linkedSo.id,
          line_no: index + 1,
          item_type: item.item_type,
          item_key: String(item.inventory_item_id || item.sku || normalizeItemName(item.name)),
          inventory_item_id: item.inventory_item_id ? String(item.inventory_item_id) : null,
          item_name: item.name,
          sku: item.sku || null,
          qty: safeNumber(item.qty),
          unit: item.unit || null,
          unit_price: safeNumber(item.unit_price),
          line_total: safeNumber(item.line_total)
        }));

        if (lines.length) {
          await rest('POST', '/crm_customer_transaction_lines', lines);
        }
      }

      await syncCustomerSummary(customer.id);
      return linkedSo;
    }

    async function getSalesOrderById(id) {
      const rows = await original.getSalesOrders();
      return rows.find(row => String(row.id) === String(id)) || null;
    }

    db.insertSalesOrder = async function insertSalesOrder0006A(data) {
      const saved = await original.insertSalesOrder(withQuotationFields(data));
      try { await saveRevision(saved, 'initial'); }
      catch (error) { console.error('PXL-STG-0006A snapshot awal gagal:', error.message); }
      return saved;
    };

    db.updateSalesOrder = async function updateSalesOrder0006A(id, patch) {
      const oldRow = await getSalesOrderById(id);
      if (!oldRow) return original.updateSalesOrder(id, patch);

      const contentChanged = hasQuotationContentChange(patch);
      const nextPatch = withQuotationFields(patch, oldRow);
      const nextStatus = String(patch?.status || oldRow.status || '').toLowerCase();

      if (contentChanged && String(oldRow.status || '').toLowerCase() === 'draft' && !patch?.status) {
        nextPatch.quotation_revision_no = Number(oldRow.quotation_revision_no ?? oldRow.revision_no ?? 0) + 1;
        nextPatch.revision_no = Number(oldRow.revision_no || 0) + 1;
      }

      if (nextStatus === 'approved') {
        nextPatch.quotation_status = 'approved';
        nextPatch.quotation_locked_at = patch?.approved_at || new Date().toISOString();
        nextPatch.quotation_locked_by = patch?.approved_by || null;
      } else if (['cancelled', 'canceled', 'void'].includes(nextStatus)) {
        nextPatch.quotation_status = nextStatus;
      }

      let saved = await original.updateSalesOrder(id, nextPatch);

      if (contentChanged || nextStatus === 'approved') {
        try {
          await saveRevision(saved, nextStatus === 'approved' ? 'approved' : 'draft_update');
        } catch (error) {
          console.error('PXL-STG-0006A snapshot revisi gagal:', error.message);
        }
      }

      if (nextStatus === 'approved') {
        try {
          saved = await syncCustomer360(saved);
        } catch (error) {
          console.error('PXL-STG-0006A Customer 360 gagal:', error.message);
        }
      }

      return saved;
    };

    db.insertTicket = async function insertTicket0006A(data) {
      if (!data?.sales_order_id) return original.insertTicket(data);
      const salesOrder = await getSalesOrderById(data.sales_order_id);
      if (!salesOrder) return original.insertTicket(data);

      const { serviceItems } = splitItems(salesOrder.items);
      return original.insertTicket({
        ...data,
        service_items: Array.isArray(data.service_items) && data.service_items.length
          ? data.service_items
          : serviceItems,
        integration_meta: {
          ...(data.integration_meta || {}),
          quotation_number: salesOrder.quotation_number || null,
          quotation_revision_no: Number(salesOrder.quotation_revision_no ?? salesOrder.revision_no ?? 0),
          service_item_count: serviceItems.length,
          revision: 'PXL-STG-0006A'
        }
      });
    };

    db.insertCrmWorkOrder = async function insertCrmWorkOrder0006A(data) {
      if (!data?.sales_order_id) return original.insertCrmWorkOrder(data);
      const salesOrder = await getSalesOrderById(data.sales_order_id);
      if (!salesOrder) return original.insertCrmWorkOrder(data);

      const { serviceItems } = splitItems(salesOrder.items);
      return original.insertCrmWorkOrder({
        ...data,
        service_items: Array.isArray(data.service_items) && data.service_items.length
          ? data.service_items
          : serviceItems,
        quotation_number: data.quotation_number || salesOrder.quotation_number || null,
        quotation_revision_no: Number(
          data.quotation_revision_no
          ?? salesOrder.quotation_revision_no
          ?? salesOrder.revision_no
          ?? 0
        )
      });
    };

    db.getSalesOrderQuotationRevisions = async function getSalesOrderQuotationRevisions(salesOrderId) {
      if (!db.USE_SUPABASE) return [];
      const filter = salesOrderId
        ? `?sales_order_id=eq.${encodeURIComponent(salesOrderId)}&order=revision_no.desc`
        : '?order=created_at.desc';
      return await rest('GET', `/sales_order_quotation_revisions${filter}`) || [];
    };

    db.getCustomer360Summary = async function getCustomer360Summary(customerId) {
      if (!db.USE_SUPABASE) return null;
      const rows = await rest(
        'GET',
        `/crm_customer_360_summary?id=eq.${encodeURIComponent(customerId)}&limit=1`
      ) || [];
      return rows[0] || null;
    };

    db.getCustomerLastPrices = async function getCustomerLastPrices(customerId) {
      if (!db.USE_SUPABASE) return [];
      return await rest(
        'GET',
        `/crm_customer_last_prices?customer_id=eq.${encodeURIComponent(customerId)}`
          + '&order=transaction_at.desc'
      ) || [];
    };

    db.syncSalesOrderCustomer360 = syncCustomer360;
  } catch (error) {
    console.error('PXL-STG-0006A gagal diaktifkan:', error.message);
  }
}
