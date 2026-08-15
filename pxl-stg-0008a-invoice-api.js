'use strict';

/* PXL-STG-0008A19 — pasang route Invoice V1 setelah middleware JWT utama. */
const express = require('express');
const crypto = require('crypto');
const reportSvc = require('./report-service');
const PATCH_KEY = Symbol.for('pxl.stg.0008a.invoice.api');

if (!global[PATCH_KEY]) {
  global[PATCH_KEY] = true;
  installAfterJwtSession();
}

function installAfterJwtSession() {
  const originalUse = express.application.use;

  express.application.use = function pxl0008a19Use(...args) {
    const shouldInstall = !this.__pxl0008aInstalled && args.some(isMainJwtSessionMiddleware);
    const result = originalUse.apply(this, args);

    if (shouldInstall) {
      this.__pxl0008aInstalled = true;
      express.application.use = originalUse;
      register(this);
    }

    return result;
  };
}

function isMainJwtSessionMiddleware(handler) {
  if (typeof handler !== 'function') return false;
  const source = Function.prototype.toString.call(handler);
  return source.includes('req.session')
    && source.includes('req.session._setUser')
    && source.includes('jwt.verify')
    && source.includes('JWT_SECRET');
}

function register(app) {
  const auth = (req,res,next) => req.session?.user ? next() : res.status(401).json({error:'Unauthorized'});
  const roles = (...allowed) => (req,res,next) => {
    const role = String(req.session?.user?.role||'');
    if (role === 'superadmin' || allowed.includes(role)) return next();
    return res.status(403).json({error:'Akses ditolak.'});
  };
  const api = makeSupabase();
  const accounting = roles('accounting','admin');
  const reviewer = roles('manager','admin');
  const readable = roles('accounting','manager','admin','sales');

  app.get('/api/invoice-v1/sources', auth, readable, async (req,res) => {
    try {
      const [sos,wos,customers,inventory,users] = await Promise.all([
        api.get('/sales_orders?select=*&order=created_at.desc&limit=300'),
        api.get('/tickets?select=*&order=created_at.desc&limit=500'),
        api.safeGet('/crm_customers?select=*&order=name.asc&limit=500', []),
        api.safeGet('/inventory_items?select=*&is_active=is.true&order=name.asc&limit=1000', []),
        api.safeGet('/users?select=id,name,username,role,extra_roles,is_active&order=name.asc&limit=500', [])
      ]);
      res.json({
        sales_orders:(sos||[]).filter(x=>['approved','setujui','disetujui'].includes(String(x.status||'').toLowerCase())),
        work_orders:wos||[], customers:customers||[],
        inventory_items:inventory||[],
        sales_users:(users||[]).filter(u=>u.is_active!==false&&(String(u.role||'')==='sales'||(Array.isArray(u.extra_roles)&&u.extra_roles.includes('sales'))))
      });
    } catch(e) { res.status(500).json({error:clean(e)}); }
  });

  app.get('/api/invoice-v1', auth, readable, async (req,res) => {
    try {
      let q='/invoices?select=*&order=issued_at.desc.nullslast,updated_at.desc.nullslast,uploaded_at.desc.nullslast&limit=500';
      if(req.query.status) q += `&invoice_status=eq.${enc(req.query.status)}`;
      const rows=await api.get(q);
      // Backfill Invoice Terbit lama yang dibuat sebelum sinkronisasi CRM aktif.
      // Maksimal 50 record per pembukaan daftar agar request tetap terkendali.
      if(['accounting','admin','superadmin'].includes(String(req.session.user.role||''))){
        const [crmRows,crmCustomers]=await Promise.all([
          api.safeGet('/crm_invoices?select=invoice_number,customer_id,customer_name&limit=2000',[]),
          api.safeGet('/crm_customers?select=id,name&limit=2000',[])
        ]);
        const crmByNumber=new Map((crmRows||[]).map(x=>[String(x.invoice_number||''),x]));
        const validCustomerIds=new Set((crmCustomers||[]).map(x=>String(x.id||'')).filter(Boolean));
        const missing=(rows||[]).filter(x=>
          ['issued','partially_paid','paid'].includes(String(x.invoice_status||''))&&
          x.invoice_number&&(
            !crmByNumber.has(String(x.invoice_number))||
            !crmByNumber.get(String(x.invoice_number))?.customer_id||
            !validCustomerIds.has(String(crmByNumber.get(String(x.invoice_number))?.customer_id||''))
          )
        ).slice(0,50);
        await Promise.allSettled(missing.map(x=>syncIssuedInvoiceToCrm(api,x,req.session.user.name)));
      }
      const invoiceIds=(rows||[]).map(x=>x.id).filter(Boolean);
      const soIds=[...new Set((rows||[]).map(x=>x.source_so_id).filter(Boolean))];
      const [relations,salesOrders,tickets]=await Promise.all([
        invoiceIds.length?api.get(`/invoice_work_orders?invoice_id=in.(${invoiceIds.map(enc).join(',')})&select=invoice_id,ticket_id`):Promise.resolve([]),
        soIds.length?api.get(`/sales_orders?id=in.(${soIds.map(enc).join(',')})&select=id,so_number`):Promise.resolve([]),
        invoiceIds.length?api.get('/tickets?select=id,wo_number&limit=1000'):Promise.resolve([])
      ]);
      const soById=new Map((salesOrders||[]).map(x=>[String(x.id),x]));
      const ticketById=new Map((tickets||[]).map(x=>[String(x.id),x]));
      const wosByInvoice=new Map();
      for(const relation of relations||[]){
        const id=String(relation.invoice_id||'');
        if(!wosByInvoice.has(id))wosByInvoice.set(id,[]);
        const wo=ticketById.get(String(relation.ticket_id||''));
        wosByInvoice.get(id).push(wo?.wo_number||relation.ticket_id);
      }
      res.json((rows||[]).map(row=>({
        ...row,
        source_so_number:soById.get(String(row.source_so_id||''))?.so_number||null,
        work_order_numbers:[...new Set((wosByInvoice.get(String(row.id))||[]).filter(Boolean))]
      })));
    } catch(e){res.status(500).json({error:clean(e)});}
  });

  // PDF hanya tersedia setelah Invoice diterbitkan. Draft tetap dapat diedit
  // tanpa menghasilkan dokumen resmi bernomor Invoice.
  app.get('/api/invoice-v1/:id/pdf', auth, readable, async (req,res) => {
    try {
      const invoice=await one(api,req.params.id);
      if(!['issued','partially_paid','paid'].includes(String(invoice.invoice_status||''))){
        return res.status(400).json({error:'PDF tersedia setelah Invoice diterbitkan.'});
      }
      const [items,relations,tickets,sos]=await Promise.all([
        api.get(`/invoice_items?invoice_id=eq.${enc(req.params.id)}&order=line_no.asc`),
        api.get(`/invoice_work_orders?invoice_id=eq.${enc(req.params.id)}`),
        api.get('/tickets?select=id,wo_number,project_name&limit=1000'),
        invoice.source_so_id?api.get(`/sales_orders?id=eq.${enc(invoice.source_so_id)}&select=id,so_number,project_name`):Promise.resolve([])
      ]);
      const ticketById=new Map((tickets||[]).map(x=>[String(x.id),x]));
      const relatedWos=(relations||[]).map(x=>ticketById.get(String(x.ticket_id||''))||{wo_number:x.ticket_id}).filter(Boolean);
      const woNumbers=relatedWos.map(x=>x.wo_number).filter(Boolean);
      const so=sos?.[0]||{};
      const projectName=relatedWos.map(x=>text(x.project_name)).find(Boolean)||text(so.project_name)||'Invoice Pekerjaan';
      reportSvc.invoicePdf(res,{
        ...invoice,
        customer_name:invoice.customer_name_snapshot||'Customer',
        uploaded_at:invoice.issued_at||invoice.invoice_date,
        project_name:projectName,
        reference_text:`SO ${so.so_number||'-'} · WO ${woNumbers.join(', ')||'-'}`,
        // Dokumen yang sudah lunas harus mudah dikenali oleh customer dan Accounting.
        remark:String(invoice.payment_status||'').toLowerCase()==='paid'||String(invoice.invoice_status||'').toLowerCase()==='paid'||num(invoice.balance_amount)<=0.0001?'PAID':(invoice.term_name||invoice.invoice_type||''),
        grand_total:invoice.total_amount,
        down_payment:invoice.paid_amount,
        redemption:0,
        payment_method:'CASH & TRANSFER BANK',
        items:(items||[]).map(x=>({
          description:x.item_name||x.description||'-', qty:num(x.quantity),
          unit:x.unit||'Pcs', unit_price:num(x.unit_price), total:num(x.line_total||x.total_amount||num(x.quantity)*num(x.unit_price))
        }))
      });
    } catch(e){res.status(status(e)).json({error:clean(e)});}
  });

  // CRM meminta repair ini sebelum memuat Master Customer. Berbeda dengan
  // backfill daftar Invoice, hasilnya tidak disembunyikan: setiap kegagalan
  // dikembalikan bersama nomor Invoice agar masalah data dapat ditelusuri.
  app.post('/api/invoice-v1/crm/repair-customers', auth, roles('accounting','manager','admin'), async (req,res) => {
    try {
      const rows=await api.get('/invoices?invoice_status=in.(issued,partially_paid,paid)&select=*&order=invoice_date.asc.nullslast,issued_at.asc.nullslast&limit=1000');
      const result={checked:(rows||[]).length,repaired:0,failed:[]};
      // Jalankan berurutan supaya repair relasi customer/SO/WO yang sama tidak
      // saling berlomba dan membuat master customer duplikat.
      for(const invoice of rows||[]){
        try{
          await syncIssuedInvoiceToCrm(api,invoice,req.session.user.name);
          result.repaired++;
        }catch(error){
          result.failed.push({
            invoice_number:invoice.invoice_number||invoice.temporary_number||invoice.id,
            customer_name:invoice.customer_name_snapshot||null,
            error:clean(error)
          });
        }
      }
      if(result.failed.length)return res.status(409).json({
        error:`${result.failed.length} Invoice gagal disinkronkan ke Master Customer CRM.`,
        ...result
      });
      res.json({ok:true,...result});
    }catch(e){res.status(status(e)).json({error:clean(e)});}
  });

  app.get('/api/invoice-v1/:id', auth, readable, async (req,res) => {
    try {
      const rows=await api.get(`/invoices?id=eq.${enc(req.params.id)}&select=*`);
      if(!rows?.length)return res.status(404).json({error:'Invoice tidak ditemukan.'});
      const [items,wos,audit,tickets,sos]=await Promise.all([
        api.get(`/invoice_items?invoice_id=eq.${enc(req.params.id)}&order=line_no.asc`),
        api.get(`/invoice_work_orders?invoice_id=eq.${enc(req.params.id)}`),
        api.get(`/invoice_audit_logs?invoice_id=eq.${enc(req.params.id)}&order=created_at.desc`),
        api.get('/tickets?select=id,wo_number&limit=1000'),
        rows[0].source_so_id?api.get(`/sales_orders?id=eq.${enc(rows[0].source_so_id)}&select=id,so_number`):Promise.resolve([])
      ]);
      const woById=new Map((tickets||[]).map(x=>[String(x.id),x.wo_number]));
      res.json({...rows[0],items,wos:(wos||[]).map(x=>({...x,wo_number:woById.get(String(x.ticket_id||''))||x.ticket_id})),audit,source_so_number:sos?.[0]?.so_number||null});
    } catch(e){res.status(500).json({error:clean(e)});}
  });

  app.post('/api/invoice-v1', auth, accounting, async (req,res) => {
    try {
      const calculated=calculate(req.body||{});
      const now=new Date().toISOString();
      const invoiceId=crypto.randomUUID();
      const header={
        id:invoiceId, temporary_number:`DRAFT-${Date.now()}`,
        invoice_date:req.body.invoice_date||now.slice(0,10), due_date:req.body.due_date||null,
        source_type:req.body.source_type||null, source_so_id:req.body.source_so_id||null,
        billing_group_id:req.body.billing_group_id||crypto.randomUUID(),
        invoice_type:req.body.invoice_type||'full_payment', term_name:req.body.term_name||null,
        term_percent:num(req.body.term_percent), customer_id:req.body.customer_id||null,
        customer_name_snapshot:text(req.body.customer_name), billing_address_snapshot:text(req.body.billing_address),
        customer_pic_snapshot:text(req.body.customer_pic), sales_pic_snapshot:text(req.body.sales_pic),
        company_template:calculated.tax_mode==='non_ppn'?'pixel':'ck', tax_mode:calculated.tax_mode,
        tax_percent:calculated.tax_percent, subtotal_amount:calculated.subtotal,
        item_discount_amount:calculated.itemDiscount, invoice_discount_amount:calculated.invoiceDiscount,
        hg_amount:calculated.hg, dpp_amount:calculated.dpp, ppn_amount:calculated.ppn,
        pph_amount:calculated.pph, total_amount:calculated.total, balance_amount:calculated.total,
        invoice_status:'draft', payment_status:'unpaid', approval_required:req.body.source_type==='direct_sales'?false:true,
        approval_reason:req.body.source_type==='direct_sales'?null:calculated.approvalReason, created_by:req.session.user.name,
        updated_by:req.session.user.name, updated_at:now
      };
      const saved=(await api.post('/invoices',header))[0];
      await replaceItems(api,invoiceId,calculated.items);
      await replaceWos(api,invoiceId,req.body.work_order_ids||[]);
      await audit(api,req,invoiceId,'CREATE_DRAFT',null,header,null);
      res.status(201).json(saved);
    } catch(e){res.status(status(e)).json({error:clean(e)});}
  });

  app.patch('/api/invoice-v1/:id', auth, accounting, async (req,res) => {
    try {
      const old=await one(api,req.params.id);
      const directSales=String(old.source_type||'')==='direct_sales';
      const editable=old.invoice_status==='draft'||(directSales&&['issued','partially_paid'].includes(String(old.invoice_status||'')));
      if(!editable)return res.status(400).json({error:'Invoice ini tidak dapat diedit pada status sekarang.'});
      const calculated=calculate(req.body||{});
      const patch={
        invoice_date:req.body.invoice_date||old.invoice_date,due_date:req.body.due_date||null,
        source_type:req.body.source_type||null,source_so_id:req.body.source_so_id||null,
        invoice_type:req.body.invoice_type||'full_payment',term_name:req.body.term_name||null,
        term_percent:num(req.body.term_percent),customer_id:req.body.customer_id||null,
        customer_name_snapshot:text(req.body.customer_name),billing_address_snapshot:text(req.body.billing_address),
        customer_pic_snapshot:text(req.body.customer_pic),sales_pic_snapshot:text(req.body.sales_pic),
        company_template:calculated.tax_mode==='non_ppn'?'pixel':'ck',tax_mode:calculated.tax_mode,
        tax_percent:calculated.tax_percent,subtotal_amount:calculated.subtotal,
        item_discount_amount:calculated.itemDiscount,invoice_discount_amount:calculated.invoiceDiscount,
        hg_amount:calculated.hg,dpp_amount:calculated.dpp,ppn_amount:calculated.ppn,pph_amount:calculated.pph,
        total_amount:calculated.total,balance_amount:calculated.total-Number(old.paid_amount||0),
        approval_required:directSales?false:true,approval_reason:directSales?null:calculated.approvalReason,
        approved_by:directSales?old.approved_by:null,approved_at:directSales?old.approved_at:null,updated_by:req.session.user.name,updated_at:new Date().toISOString()
      };
      const saved=(await api.patch(`/invoices?id=eq.${enc(req.params.id)}`,patch))[0];
      await replaceItems(api,req.params.id,calculated.items);
      await replaceWos(api,req.params.id,req.body.work_order_ids||[]);
      await audit(api,req,req.params.id,'UPDATE_DRAFT',old,patch,req.body.change_reason||null);
      res.json(saved);
    }catch(e){res.status(status(e)).json({error:clean(e)});}
  });

  app.post('/api/invoice-v1/:id/submit', auth, accounting, async(req,res)=>{
    try{
      const old=await one(api,req.params.id);
      if(old.invoice_status!=='draft')return res.status(400).json({error:'Invoice bukan Draft.'});
      await validateWorkOrderFlow(api,old);
      const saved=(await api.patch(`/invoices?id=eq.${enc(req.params.id)}`,{invoice_status:'pending_approval',updated_by:req.session.user.name,updated_at:new Date().toISOString()}))[0];
      await audit(api,req,req.params.id,'SUBMIT_APPROVAL',old,saved,null);
      res.json(saved);
    }catch(e){res.status(status(e)).json({error:clean(e)});}
  });

  app.post('/api/invoice-v1/:id/approve', auth, reviewer, async(req,res)=>{
    try{
      const old=await one(api,req.params.id);
      if(old.invoice_status!=='pending_approval')return res.status(400).json({error:'Invoice tidak menunggu persetujuan.'});
      await validateWorkOrderFlow(api,old);
      const patch={invoice_status:'approved',approved_by:req.session.user.name,approved_at:new Date().toISOString(),rejected_by:null,rejected_at:null,rejection_reason:null,updated_by:req.session.user.name,updated_at:new Date().toISOString()};
      const saved=(await api.patch(`/invoices?id=eq.${enc(req.params.id)}`,patch))[0];
      await audit(api,req,req.params.id,'APPROVE',old,saved,req.body.reason||null);res.json(saved);
    }catch(e){res.status(status(e)).json({error:clean(e)});}
  });

  app.post('/api/invoice-v1/:id/reject', auth, reviewer, async(req,res)=>{
    try{
      if(!text(req.body.reason))return res.status(400).json({error:'Alasan penolakan wajib diisi.'});
      const old=await one(api,req.params.id);
      const patch={invoice_status:'draft',rejected_by:req.session.user.name,rejected_at:new Date().toISOString(),rejection_reason:text(req.body.reason),approved_by:null,approved_at:null,updated_by:req.session.user.name,updated_at:new Date().toISOString()};
      const saved=(await api.patch(`/invoices?id=eq.${enc(req.params.id)}`,patch))[0];
      await audit(api,req,req.params.id,'REJECT',old,saved,req.body.reason);res.json(saved);
    }catch(e){res.status(status(e)).json({error:clean(e)});}
  });

  app.post('/api/invoice-v1/:id/issue', auth, accounting, async(req,res)=>{
    try{
      const old=await one(api,req.params.id);
      const directSales=String(old.source_type||'')==='direct_sales';
      if(directSales){
        if(old.invoice_status!=='draft')return res.status(400).json({error:'Direct Sales harus berstatus Draft sebelum diterbitkan.'});
      }else{
        if(old.invoice_status!=='approved' || !old.approved_at)return res.status(400).json({error:'Invoice harus berstatus Disetujui sebelum diterbitkan.'});
        await validateIssueRules(api,old);
      }
      const series=old.tax_mode==='non_ppn'?'INVPIXEL':'INVCK';
      const date=new Date(`${old.invoice_date}T00:00:00+08:00`); const year=date.getFullYear(); const month=String(date.getMonth()+1).padStart(2,'0');
      const seq=await nextSequence(api,series,year,req.body.manual_number||null,month);
      const number=`${series}-${month}${year}${String(seq).padStart(3,'0')}`;
      const snapshot={...old,invoice_number:number,issued_at:new Date().toISOString()};
      const patch={invoice_number:number,invoice_series:series,invoice_year:year,invoice_sequence:seq,manual_number:!!req.body.manual_number,invoice_status:'issued',issued_by:req.session.user.name,issued_at:new Date().toISOString(),snapshot_json:snapshot,updated_at:new Date().toISOString()};
      if(!directSales)await syncIssuedInvoiceToCrm(api,{...old,...patch},req.session.user.name);
      const saved=(await api.patch(`/invoices?id=eq.${enc(req.params.id)}`,patch))[0];
      await audit(api,req,req.params.id,'ISSUE',old,saved,null);res.json(saved);
    }catch(e){res.status(status(e)).json({error:clean(e)});}
  });

  // PXL-STG-0008A24 — pembayaran piutang dicatat manual oleh Accounting.
  // Omzet tetap dihitung saat invoice Terbit; payment hanya mengubah saldo/piutang.
  app.post('/api/invoice-v1/:id/payment', auth, accounting, async(req,res)=>{
    try{
      const old=await one(api,req.params.id);
      if(!['issued','partially_paid','paid'].includes(String(old.invoice_status||''))) {
        return res.status(400).json({error:'Pembayaran hanya dapat dicatat untuk Invoice Terbit.'});
      }
      const total=num(old.total_amount);
      const previous=Math.max(0,num(old.paid_amount));
      const requested=req.body?.mark_paid===true ? total : num(req.body?.paid_amount);
      if(requested<=0)return res.status(400).json({error:'Nominal pembayaran harus lebih dari Rp0.'});
      const paid=Math.min(total,round(previous+requested));
      const balance=Math.max(0,round(total-paid));
      const isPaid=balance<=0.0001;
      const patch={
        paid_amount:paid,balance_amount:balance,
        payment_status:isPaid?'paid':(paid>0?'partially_paid':'unpaid'),
        invoice_status:isPaid?'paid':(paid>0?'partially_paid':'issued'),
        paid_at:isPaid?new Date().toISOString():(old.paid_at||null),
        updated_by:req.session.user.name,updated_at:new Date().toISOString()
      };
      // Pembayaran juga menjadi jalur repair untuk Invoice lama: pastikan master
      // customer dan relasi Invoice CRM tersedia sebelum saldo diperbarui.
      if(isPaid && String(old.source_type||'')==='direct_sales' && String(old.payment_status||'')!=='paid'){
        await issueDirectSalesInventory(api,old,req.session.user.name);
      }
      if(String(old.source_type||'')!=='direct_sales'){
        await syncIssuedInvoiceToCrm(api,{...old,...patch},req.session.user.name);
        await syncCrmPayment(api,{...old,...patch});
      }
      const saved=(await api.patch(`/invoices?id=eq.${enc(req.params.id)}`,patch))[0];
      await audit(api,req,req.params.id,isPaid?'MARK_PAID':'RECORD_PAYMENT',old,saved,text(req.body?.note));
      res.json(saved);
    }catch(e){res.status(status(e)).json({error:clean(e)});}
  });
}

async function syncIssuedInvoiceToCrm(api,invoice,actor){
  const [relations,items]=await Promise.all([
    api.get(`/invoice_work_orders?invoice_id=eq.${enc(invoice.id)}&select=ticket_id`),
    api.get(`/invoice_items?invoice_id=eq.${enc(invoice.id)}&order=line_no.asc`)
  ]);
  const ticketIds=[...new Set((relations||[]).map(x=>x.ticket_id).filter(Boolean))];
  if(!ticketIds.length)throw bad('Sinkronisasi CRM gagal: Invoice tidak memiliki Work Order.');
  const tickets=await api.get(`/tickets?id=in.(${ticketIds.map(enc).join(',')})&select=id,wo_number,project_name,status,sales_order_id,so_number,crm_customer_id,customer_name,customer_phone,technician,created_by`);
  const salesOrderId=invoice.source_so_id||(tickets||[]).map(x=>x.sales_order_id).find(Boolean);
  if(!salesOrderId)throw bad('Sinkronisasi CRM gagal: Sales Order sumber Invoice tidak ditemukan.');
  const salesOrders=await api.get(`/sales_orders?id=eq.${enc(salesOrderId)}&select=id,so_number,customer_id,customer_name`);
  const so=salesOrders?.[0];
  if(!so)throw bad('Sinkronisasi CRM gagal: data Sales Order tidak ditemukan di CRM.');
  const customer=await ensureCrmCustomer(api,invoice,so,tickets,actor);
  // WO operasional lama/manual dapat valid tetapi belum mempunyai mirror CRM.
  // Cari juga berdasarkan nomor WO, lalu perbaiki/buat mirror secara idempotent
  // agar penerbitan Invoice tidak tertahan oleh data integrasi historis.
  const crmWos=await api.safeGet(`/crm_work_orders?or=(ticket_id.in.(${ticketIds.map(enc).join(',')}),sales_order_id.eq.${enc(salesOrderId)})&select=id,ticket_id,wo_number,sales_order_id`,[]);
  const crmWoByTicket=new Map((crmWos||[]).filter(x=>x.ticket_id).map(x=>[String(x.ticket_id),x]));
  const crmWoByNumber=new Map((crmWos||[]).filter(x=>x.wo_number).map(x=>[String(x.wo_number).trim().toLowerCase(),x]));
  for(const ticket of tickets||[]){
    const ticketKey=String(ticket.id);
    if(crmWoByTicket.has(ticketKey))continue;
    const numberKey=String(ticket.wo_number||'').trim().toLowerCase();
    let mirror=numberKey?crmWoByNumber.get(numberKey):null;
    const mirrorPayload={
      ticket_id:ticket.id,sales_order_id:salesOrderId,so_number:so.so_number,
      wo_number:ticket.wo_number||`WO-${String(ticket.id).slice(0,8)}`,
      number_source:'manual',project_name:ticket.project_name||null,
      technician:ticket.technician||null,status:ticket.status||'done',
      customer_id:customer.id,
      customer_name:ticket.customer_name||so.customer_name||null,
      customer_phone:ticket.customer_phone||null,
      source_type:'invoice_sync_repair',integration_key:`ticket:${ticket.id}`,
      updated_at:new Date().toISOString()
    };
    if(mirror){
      mirror=(await api.patch(`/crm_work_orders?id=eq.${enc(mirror.id)}`,mirrorPayload))[0];
    }else{
      mirror=(await api.post('/crm_work_orders',{...mirrorPayload,created_by:actor||ticket.created_by||'System'}))[0];
    }
    if(mirror)crmWoByTicket.set(ticketKey,mirror);
  }
  const missingCrmWo=(tickets||[]).filter(x=>!crmWoByTicket.has(String(x.id)));
  if(missingCrmWo.length)throw bad(`Sinkronisasi CRM gagal setelah repair otomatis: ${missingCrmWo.map(woLabel).join(', ')}.`);
  const crmWorkOrderIds=ticketIds.map(id=>crmWoByTicket.get(String(id))?.id).filter(Boolean);
  const mappedItems=(items||[]).map(x=>({
    name:x.item_name||x.description||'-',description:x.description||null,
    item_type:String(x.source_type||'').toLowerCase()==='service'||String(x.unit||'').toLowerCase()==='jasa'?'service':'item',
    qty:num(x.quantity),unit:x.unit||'pcs',unit_price:num(x.unit_price),total:num(x.line_total)
  }));
  const existing=await api.safeGet(`/crm_invoices?invoice_number=eq.${enc(invoice.invoice_number)}&select=id`,[]);
  const payload={
    invoice_number:invoice.invoice_number,sales_order_id:salesOrderId,so_number:so.so_number,
    customer_id:customer.id,
    customer_name:invoice.customer_name_snapshot||so.customer_name||null,work_order_ids:crmWorkOrderIds,
    items:mappedItems,additional_items:[],base_total:num(invoice.total_amount),additional_total:0,
    grand_total:num(invoice.total_amount),status:num(invoice.balance_amount)<=0.0001&&num(invoice.paid_amount)>0?'paid':(num(invoice.paid_amount)>0?'partially_paid':'issued'),invoice_date:invoice.invoice_date,
    due_date:invoice.due_date||null,down_payment:num(invoice.paid_amount),redemption:0,
    balance_due:num(invoice.balance_amount??invoice.total_amount),payment_method:'CASH & TRANSFER BANK',
    remark:`Sinkron otomatis Invoice V1 ${invoice.id}`,billing_address:invoice.billing_address_snapshot||null,
    created_by:actor,updated_at:new Date().toISOString()
  };
  if(existing?.length)return (await api.patch(`/crm_invoices?id=eq.${enc(existing[0].id)}`,payload))[0];
  return (await api.post('/crm_invoices',payload))[0];
}

async function ensureCrmCustomer(api,invoice,so,tickets,actor){
  const customerName=text(invoice.customer_name_snapshot||so.customer_name||(tickets||[]).map(x=>x.customer_name).find(Boolean));
  if(!customerName)throw bad('Sinkronisasi CRM gagal: nama customer Invoice tidak tersedia.');
  const candidates=[invoice.customer_id,so.customer_id,...(tickets||[]).map(x=>x.crm_customer_id)].filter(Boolean);
  for(const id of candidates){
    const rows=await api.safeGet(`/crm_customers?id=eq.${enc(id)}&select=id,name,status&limit=1`,[]);
    const matched=rows?.[0];
    if(matched&&normalizeCustomerName(matched.name)===normalizeCustomerName(customerName)){
      if(String(matched.status||'active').toLowerCase()==='active')return matched;
      return (await api.patch(`/crm_customers?id=eq.${enc(matched.id)}`,{
        status:'active',updated_at:new Date().toISOString()
      }))[0]||matched;
    }
  }
  const nameCandidates=await api.safeGet(`/crm_customers?name=ilike.${enc(customerName)}&select=id,name,status&limit=20`,[]);
  let customer=(nameCandidates||[]).find(row=>normalizeCustomerName(row.name)===normalizeCustomerName(customerName));
  if(!customer){
    const phone=text((tickets||[]).map(x=>x.customer_phone).find(Boolean))||null;
    customer=(await api.post('/crm_customers',{
      name:customerName,type:'B2B',sales_pic:text(invoice.sales_pic_snapshot)||null,
      phone,normalized_phone:phone?phone.replace(/\D/g,''):null,
      address:text(invoice.billing_address_snapshot)||null,status:'active',
      source_name:'invoice_sync',created_by:actor||'System',updated_at:new Date().toISOString()
    }))[0];
  }else if(String(customer.status||'active').toLowerCase()!=='active'){
    customer=(await api.patch(`/crm_customers?id=eq.${enc(customer.id)}`,{
      status:'active',updated_at:new Date().toISOString()
    }))[0]||customer;
  }
  if(!customer?.id)throw bad(`Sinkronisasi CRM gagal: customer ${customerName} tidak dapat dibuat.`);
  // Repair relasi sumber secara best effort; master customer dan crm_invoices
  // tetap menjadi sumber utama bila salah satu tabel lama belum memiliki kolomnya.
  await Promise.allSettled([
    api.patch(`/sales_orders?id=eq.${enc(so.id)}`,{customer_id:customer.id,updated_at:new Date().toISOString()}),
    ...(tickets||[]).map(x=>api.patch(`/tickets?id=eq.${enc(x.id)}`,{crm_customer_id:customer.id}))
  ]);
  return customer;
}

function normalizeCustomerName(value){
  return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
}

async function syncCrmPayment(api,invoice){
  if(!invoice?.invoice_number)return;
  const rows=await api.safeGet(`/crm_invoices?invoice_number=eq.${enc(invoice.invoice_number)}&select=id`,[]);
  if(!rows?.length)throw bad('Database CRM untuk Invoice ini tidak ditemukan. Pencatatan pembayaran dibatalkan.');
  await api.patch(`/crm_invoices?id=eq.${enc(rows[0].id)}`,{
    down_payment:num(invoice.paid_amount),balance_due:num(invoice.balance_amount),
    status:num(invoice.balance_amount)<=0.0001?'paid':(num(invoice.paid_amount)>0?'partially_paid':'issued'),
    updated_at:new Date().toISOString()
  });
}

function calculate(body){
  const items=(Array.isArray(body.items)?body.items:[]).map((x,i)=>{
    const quantity=num(x.quantity||x.qty); const unitPrice=num(x.unit_price||x.price);
    if(!text(x.item_name||x.name))throw bad(`Nama item baris ${i+1} wajib diisi.`);
    if(quantity<=0)throw bad(`Qty baris ${i+1} harus lebih dari 0.`);
    const base=quantity*unitPrice; const type=text(x.discount_type);
    const discount=type==='percent'?base*num(x.discount_value)/100:Math.min(base,num(x.discount_value));
    return {line_no:i+1,source_type:text(x.source_type)||'manual',source_id:x.source_id||null,item_name:text(x.item_name||x.name),description:text(x.description)||null,quantity,unit:text(x.unit)||'pcs',unit_price:unitPrice,discount_type:type||null,discount_value:num(x.discount_value),discount_amount:round(discount),line_subtotal:round(base),line_total:round(base-discount)};
  });
  if(!items.length)throw bad('Minimal satu item invoice wajib diisi.');
  const subtotal=round(items.reduce((s,x)=>s+x.line_subtotal,0)); const itemDiscount=round(items.reduce((s,x)=>s+x.discount_amount,0));
  const afterItems=subtotal-itemDiscount; const invDiscType=text(body.invoice_discount_type); const invDiscValue=num(body.invoice_discount_value);
  const invoiceDiscount=round(invDiscType==='percent'?afterItems*invDiscValue/100:Math.min(afterItems,invDiscValue));
  const hg=round(afterItems-invoiceDiscount); const taxMode=text(body.tax_mode)||'ppn'; const taxPercent=taxMode==='non_ppn'?0:num(body.tax_percent||12);
  const dpp=body.manual_dpp?num(body.dpp_amount):hg; const ppn=taxMode==='non_ppn'?0:(body.manual_ppn?num(body.ppn_amount):round(dpp*taxPercent/100));
  const pph=body.manual_pph?num(body.pph_amount):num(body.pph_amount); const total=round(hg+ppn-pph);
  const approvalRequired=true;
  return {items,subtotal,itemDiscount,invoiceDiscount,hg,dpp:round(dpp),ppn:round(ppn),pph:round(pph),total,taxMode,tax_mode:taxMode,taxPercent,tax_percent:taxPercent,approvalRequired,approvalReason:'Persetujuan Manager wajib sebelum Invoice diterbitkan.'};
}

async function validateIssueRules(api,inv){
  await validateWorkOrderFlow(api,inv);
  if(inv.billing_group_id&&inv.term_percent){
    const siblings=await api.get(`/invoices?billing_group_id=eq.${enc(inv.billing_group_id)}&invoice_status=in.(issued,partially_paid,paid)&select=term_percent`);
    const used=siblings.reduce((s,x)=>s+num(x.term_percent),0);
    if(used+num(inv.term_percent)>100.0001)throw bad('Total termin yang diterbitkan tidak boleh melebihi 100%.');
  }
}

async function validateWorkOrderFlow(api,inv){
  const rel=await api.get(`/invoice_work_orders?invoice_id=eq.${enc(inv.id)}&select=ticket_id`);
  const ids=[...new Set((rel||[]).map(x=>x.ticket_id).filter(Boolean))];
  if(!ids.length)throw bad('Invoice wajib terhubung ke minimal satu Work Order.');

  const idList=ids.map(enc).join(',');
  const wos=await api.get(`/tickets?id=in.(${idList})&select=id,wo_number,status`);
  const woById=new Map((wos||[]).map(x=>[String(x.id),x]));
  const missing=ids.filter(id=>!woById.has(String(id)));
  if(missing.length)throw bad('Sebagian Work Order Invoice tidak ditemukan. Periksa kembali relasi WO.');

  const unfinished=(wos||[]).filter(x=>!isFinishedWorkOrderStatus(x.status));
  if(unfinished.length)throw bad(`Invoice belum dapat diproses. WO belum selesai: ${unfinished.map(woLabel).join(', ')}.`);

  const [legacyMrs,crmWos]=await Promise.all([
    api.safeGet(`/material_request_forms?ticket_id=in.(${idList})&select=id,ticket_id,status`,[]),
    api.safeGet(`/crm_work_orders?ticket_id=in.(${idList})&select=id,ticket_id`,[])
  ]);
  const crmWoIds=(crmWos||[]).map(x=>x.id).filter(Boolean);
  const crmMrs=crmWoIds.length
    ? await api.safeGet(`/crm_material_requests?work_order_id=in.(${crmWoIds.map(enc).join(',')})&select=id,work_order_id,status`,[])
    : [];
  const crmTicketByWo=new Map((crmWos||[]).map(x=>[String(x.id),String(x.ticket_id)]));
  const requestsByTicket=new Map(ids.map(id=>[String(id),[]]));
  for(const mr of legacyMrs||[]){
    const key=String(mr.ticket_id||'');
    if(requestsByTicket.has(key))requestsByTicket.get(key).push(mr);
  }
  for(const mr of crmMrs||[]){
    const key=crmTicketByWo.get(String(mr.work_order_id||''));
    if(key&&requestsByTicket.has(key))requestsByTicket.get(key).push(mr);
  }

  const notReturned=[];
  for(const id of ids){
    const wo=woById.get(String(id));
    const requests=requestsByTicket.get(String(id))||[];
    // MR tidak wajib untuk WO yang memang tidak memakai material. Namun bila
    // MR pernah dibuat, seluruh pengembaliannya wajib selesai sebelum Invoice.
    if(requests.length&&requests.some(mr=>!isReturnedMaterialStatus(mr.status)))notReturned.push(woLabel(wo));
  }
  if(notReturned.length)throw bad(`Invoice belum dapat diproses. Pengembalian material belum selesai untuk: ${notReturned.join(', ')}.`);
}

// Status WO yang dipakai aplikasi teknisi saat pekerjaan selesai adalah "done".
// Terima juga label yang digunakan pada data/migrasi lama agar Full Payment
// tidak tertahan ketika seluruh WO sebenarnya sudah selesai.
function isFinishedWorkOrderStatus(value){
  return ['done','selesai','completed','closed','finished']
    .includes(String(value||'').trim().toLowerCase());
}

function isReturnedMaterialStatus(value){
  return ['returned','dikembalikan','return_complete','returned_complete']
    .includes(String(value||'').trim().toLowerCase());
}

function woLabel(wo){return text(wo?.wo_number)||text(wo?.id)||'WO';}

async function nextSequence(api,series,year,manual,month){
  const rows=await api.get(`/invoice_sequences?series=eq.${series}&invoice_year=eq.${year}&limit=1`); const current=num(rows?.[0]?.last_sequence);
  const expected=current+1;
  if(manual){
    const re=new RegExp(`^${series}-${month}${year}(\\d{3,})$`); const m=String(manual).match(re);
    if(!m||Number(m[1])!==expected)throw bad(`Nomor manual wajib nomor berikutnya: ${series}-${month}${year}${String(expected).padStart(3,'0')}`);
  }
  if(rows.length)await api.patch(`/invoice_sequences?id=eq.${enc(rows[0].id)}`,{last_sequence:expected,updated_at:new Date().toISOString()});
  else await api.post('/invoice_sequences',{series,invoice_year:year,last_sequence:expected,updated_at:new Date().toISOString()});
  return expected;
}
async function replaceItems(api,id,items){await api.del(`/invoice_items?invoice_id=eq.${enc(id)}`);if(items.length)await api.post('/invoice_items',items.map(x=>({...x,invoice_id:id})));}

async function issueDirectSalesInventory(api,invoice,actor){
  const items=await api.get(`/invoice_items?invoice_id=eq.${enc(invoice.id)}&order=line_no.asc`);
  const inventoryItems=(items||[]).filter(x=>String(x.source_type||'')==='inventory'&&x.source_id);
  if(!inventoryItems.length)return {ok:true,issued_items:0};
  const prior=await api.safeGet(`/inventory_transactions?notes=like.*${enc(invoice.id)}*&select=id&limit=1`,[]);
  if(prior?.length)return {ok:true,already_issued:true};
  const payload=inventoryItems.map(x=>({inventory_item_id:x.source_id,qty_out:num(x.quantity)}));
  const reference=invoice.invoice_number||invoice.temporary_number||'Direct Sales';
  return api.post('/rpc/inventory_issue_material_request',{p_request_id:invoice.id,p_items:payload,p_actor:actor||'System',p_wo_number:`Direct Sales ${reference}`});
}

async function replaceWos(api,id,ids){await api.del(`/invoice_work_orders?invoice_id=eq.${enc(id)}`);if(ids.length)await api.post('/invoice_work_orders',ids.map(ticket_id=>({invoice_id:id,ticket_id,override_unfinished:false,override_reason:null})));}
async function audit(api,req,id,action,oldValue,newValue,reason){await api.post('/invoice_audit_logs',{invoice_id:id,action,actor_id:req.session.user.id||null,actor_name:req.session.user.name,actor_role:req.session.user.role,reason:reason||null,old_value:oldValue,new_value:newValue});}
async function one(api,id){const rows=await api.get(`/invoices?id=eq.${enc(id)}&limit=1`);if(!rows?.length){const e=bad('Invoice tidak ditemukan.');e.statusCode=404;throw e;}return rows[0];}
function makeSupabase(){
  const cfg = require('./config');
  let fetchFn=global.fetch; try{if(!fetchFn)fetchFn=require('node-fetch');}catch(_){ }
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||cfg.SUPABASE_KEY; const base=`${cfg.SUPABASE_URL}/rest/v1`;
  async function call(method,path,body){const r=await fetchFn(base+path,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body==null?undefined:JSON.stringify(body)});const txt=await r.text();if(!r.ok)throw new Error(txt||`HTTP ${r.status}`);return txt?JSON.parse(txt):[];}
  return {get:p=>call('GET',p),safeGet:async(p,f)=>{try{return await call('GET',p);}catch(_){return f;}},post:(p,b)=>call('POST',p,b),patch:(p,b)=>call('PATCH',p,b),del:p=>call('DELETE',p)};
}
function text(v){return String(v??'').trim();} function num(v){const n=Number(v);return Number.isFinite(n)?n:0;} function round(v){return Math.round((num(v)+Number.EPSILON)*100)/100;} function enc(v){return encodeURIComponent(String(v));}
function bad(message){const e=new Error(message);e.statusCode=400;return e;} function status(e){return e.statusCode||500;} function clean(e){return String(e.message||e).slice(0,1000);}
