'use strict';

const ACCOUNTING_COLUMNS=[
  'TANGGAL','KLASIFIKASI','SUB KLASIFIKASI','NAMA CUSTOMER - PEKERJAAN','TRANSAKSI',
  'NOMINAL TRANSAKSI','HPP','NET','DPP','PPN','KATEGORI PRODUK','METODE PEMBAYARAN',
  'STATUS PAID','PENJ. BARANG','PENJ. JASA','PIC'
];
const CLASSIFICATIONS=['B2C','B2B','B2G','B2BG'];
const SUB_CLASSIFICATIONS=['Perdagangan','Project','Operasional'];
const PAID_STATUSES=['PAID','UNPAID'];
const SALES_TYPES=['BARANG','JASA'];

const clean=v=>String(v??'').trim();
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const money=v=>{
  const n=Number(v);
  if(!Number.isFinite(n)) throw new Error('Nilai Rupiah tidak valid.');
  return Math.round(n);
};
function normalizeOutletId(value){
  const id=clean(value);
  if(!UUID_RE.test(id)) throw new Error('Outlet wajib dipilih.');
  return id;
}
function calculateAccountingAmounts(grossAmount,hppAmount){
  const gross=money(grossAmount),hpp=money(hppAmount);
  if(gross<0) throw new Error('Nominal transaksi tidak boleh negatif.');
  if(hpp<0) throw new Error('HPP tidak boleh negatif.');
  const dpp=Math.round(gross/1.11);
  const ppn=gross-dpp;
  return {gross_amount:gross,hpp_amount:hpp,dpp_amount:dpp,ppn_amount:ppn,net_amount:dpp-hpp};
}
function mustEnum(value,allowed,label){
  const s=clean(value);
  if(!allowed.includes(s)) throw new Error(`${label} tidak valid.`);
  return s;
}
function normalizeAccountingTransactionInput(input={}){
  const transaction_date=clean(input.transaction_date);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(transaction_date)) throw new Error('Tanggal transaksi wajib diisi dengan format YYYY-MM-DD.');
  const classification=mustEnum(input.classification,CLASSIFICATIONS,'Klasifikasi');
  const sub_classification=mustEnum(input.sub_classification,SUB_CLASSIFICATIONS,'Sub klasifikasi');
  const paid_status=mustEnum(input.paid_status,PAID_STATUSES,'Status paid');
  const sales_type=mustEnum(input.sales_type,SALES_TYPES,'Jenis penjualan');
  const amounts=calculateAccountingAmounts(input.gross_amount,input.hpp_amount);
  return {
    transaction_date,classification,sub_classification,
    customer_name:clean(input.customer_name),job_name:clean(input.job_name),
    transaction_description:clean(input.transaction_description),
    ...amounts,
    product_category:clean(input.product_category),payment_method:clean(input.payment_method),
    paid_status,sales_type,
    goods_amount:sales_type==='BARANG'?amounts.gross_amount:0,
    service_amount:sales_type==='JASA'?amounts.gross_amount:0,
    pic_name:clean(input.pic_name),
    classification_source:clean(input.classification_source)||'MANUAL',
    notes:clean(input.notes)
  };
}
function resolveAccountingClassification(input={},customerMaster,picMaster){
  const customer=clean(customerMaster?.default_classification);
  if(CLASSIFICATIONS.includes(customer)) return {classification:customer,source:'CUSTOMER'};
  const pic=clean(picMaster?.default_classification);
  if(CLASSIFICATIONS.includes(pic)) return {classification:pic,source:'PIC'};
  const manual=clean(input.manual||input.classification);
  if(!CLASSIFICATIONS.includes(manual)) throw new Error('Klasifikasi manual wajib dipilih.');
  return {classification:manual,source:'MANUAL'};
}
function normalizeRole(role){return clean(role).toLowerCase().replace(/[ _-]/g,'');}
function isAccountingSuperadmin(user){return normalizeRole(user?.role)==='superadmin';}
function filterTransactions(rows=[],filters={}){
  const month=clean(filters.month),year=clean(filters.year),outletId=clean(filters.outlet_id);
  return rows.filter(r=>{
    if(r.deleted_at) return false;
    if(outletId&&clean(r.outlet_id)!==outletId) return false;
    const d=clean(r.transaction_date);
    if(year&&d.slice(0,4)!==year) return false;
    if(month&&d.slice(5,7)!==String(month).padStart(2,'0')) return false;
    if(filters.classification&&r.classification!==filters.classification) return false;
    if(filters.sub_classification&&r.sub_classification!==filters.sub_classification) return false;
    if(filters.pic_name&&r.pic_name!==filters.pic_name) return false;
    if(filters.product_category&&r.product_category!==filters.product_category) return false;
    return true;
  });
}
function aggregateAccountingDashboard(rows=[],options={}){
  const active=rows.filter(r=>!r.deleted_at);
  const summary={gross_amount:0,hpp_amount:0,dpp_amount:0,ppn_amount:0,net_amount:0,transaction_count:active.length};
  const bucket=()=>Object.create(null);
  const byClassification=bucket(),countByClassification=bucket(),bySub=bucket(),byCategory=bucket(),byPic=bucket(),netByClassification=bucket(),trend=bucket(),byOutlet=bucket(),netByOutlet=bucket(),paidTotals=bucket(),paidCounts=bucket(),paymentTotals=bucket(),paymentCounts=bucket();
  const outletSummaries=new Map();
  const outletOrder=[];
  const emptyOutletSummary=()=>({gross_amount:0,hpp_amount:0,dpp_amount:0,ppn_amount:0,net_amount:0,transaction_count:0});
  if(options.scope==='all'&&Array.isArray(options.outlets))for(const o of options.outlets){
    const name=clean(o?.name||o?.outlet_name||o?.code||o?.id)||'-';
    if(!outletSummaries.has(name)){outletOrder.push(name);outletSummaries.set(name,emptyOutletSummary());byOutlet[name]=0;netByOutlet[name]=0;}
  }
  let goods=0,services=0;
  for(const r of active){
    for(const k of ['gross_amount','hpp_amount','dpp_amount','ppn_amount','net_amount']) summary[k]+=Number(r[k]||0);
    const c=r.classification||'-',s=r.sub_classification||'-',cat=r.product_category||'-',outlet=r.outlet_name||r.outlet_code||r.outlet_id||'-',paid=r.paid_status||'-',payment=r.payment_method||'-';
    const rawPic=r.pic_name||'-';
    const pic=options.scope==='all'&&outlet!=='-'?`${outlet} / ${rawPic}`:rawPic;
    const m=String(r.transaction_date||'').slice(0,7)||'-';
    byClassification[c]=(byClassification[c]||0)+Number(r.gross_amount||0);
    countByClassification[c]=(countByClassification[c]||0)+1;
    bySub[s]=(bySub[s]||0)+Number(r.gross_amount||0);
    byCategory[cat]=(byCategory[cat]||0)+Number(r.gross_amount||0);
    byPic[pic]=(byPic[pic]||0)+Number(r.gross_amount||0);
    netByClassification[c]=(netByClassification[c]||0)+Number(r.net_amount||0);
    paidTotals[paid]=(paidTotals[paid]||0)+Number(r.gross_amount||0);paidCounts[paid]=(paidCounts[paid]||0)+1;
    paymentTotals[payment]=(paymentTotals[payment]||0)+Number(r.gross_amount||0);paymentCounts[payment]=(paymentCounts[payment]||0)+1;
    trend[m]=(trend[m]||0)+Number(r.gross_amount||0);
    goods+=Number(r.goods_amount||0);services+=Number(r.service_amount||0);
    if(options.scope==='all'){
      if(!outletSummaries.has(outlet)){
        outletOrder.push(outlet);
        outletSummaries.set(outlet,emptyOutletSummary());
      }
      const os=outletSummaries.get(outlet);os.transaction_count+=1;
      for(const k of ['gross_amount','hpp_amount','dpp_amount','ppn_amount','net_amount']) os[k]+=Number(r[k]||0);
      byOutlet[outlet]=(byOutlet[outlet]||0)+Number(r.gross_amount||0);
      netByOutlet[outlet]=(netByOutlet[outlet]||0)+Number(r.net_amount||0);
    }
  }
  const series=o=>Object.entries(o).map(([name,value])=>({name,value}));
  const charts={
    revenue_by_classification:series(byClassification),transactions_by_classification:series(countByClassification),
    revenue_by_sub_classification:series(bySub),revenue_by_category:series(byCategory),
    goods_vs_services:[{name:'Barang',value:goods},{name:'Jasa',value:services}],
    revenue_by_pic:series(byPic),net_by_classification:series(netByClassification),monthly_revenue:series(trend).sort((a,b)=>a.name.localeCompare(b.name))
  };
  if(options.scope==='all'){
    charts.revenue_by_outlet=outletOrder.map(name=>({name,value:byOutlet[name]||0}));
    charts.net_by_outlet=outletOrder.map(name=>({name,value:netByOutlet[name]||0}));
  }
  const paid_breakdown=['PAID','UNPAID'].map(name=>({name,value:paidTotals[name]||0,count:paidCounts[name]||0}));
  const payment_methods=Object.keys(paymentTotals).sort((a,b)=>a.localeCompare(b)).map(name=>({name,value:paymentTotals[name]||0,count:paymentCounts[name]||0}));
  return {
    summary,paid_breakdown,payment_methods,
    outlet_breakdown:options.scope==='all'?outletOrder.map(outlet_name=>({outlet_name,summary:outletSummaries.get(outlet_name)})):[],
    charts
  };
}
module.exports={ACCOUNTING_COLUMNS,CLASSIFICATIONS,SUB_CLASSIFICATIONS,PAID_STATUSES,SALES_TYPES,normalizeOutletId,calculateAccountingAmounts,normalizeAccountingTransactionInput,resolveAccountingClassification,normalizeRole,isAccountingSuperadmin,filterTransactions,aggregateAccountingDashboard};
