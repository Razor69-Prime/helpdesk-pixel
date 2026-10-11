'use strict';

function finiteNonNegative(value){
  const n=Number(value??0);
  return Number.isFinite(n)&&n>0?n:0;
}

function normalizeProjectMaterialOverrideInput(raw={}){
  const qty=Number(raw.qty);
  const reason=String(raw.reason??'').trim();
  if(!Number.isFinite(qty)||qty<=0) throw new Error('Qty override wajib lebih dari 0.');
  if(!reason) throw new Error('Alasan override wajib diisi.');
  return {qty,reason};
}

function projectMrReleaseQty(item={},status=''){
  const state=String(status||'').trim().toLowerCase();
  const requested=finiteNonNegative(item.qty_requested);
  if(state==='approved') return requested;
  if(state==='issued'||state==='final') return Math.max(0,requested-finiteNonNegative(item.qty_returned));
  return 0;
}

function summarizeProjectMaterialLedger({boqItemId,materialRequests=[],overrides=[],totalDone=0}={}){
  const key=String(boqItemId??'');
  const mrApproved=(Array.isArray(materialRequests)?materialRequests:[]).reduce((sum,mr)=>{
    const items=Array.isArray(mr?.items)?mr.items:[];
    return sum+items.reduce((n,item)=>String(item?.project_boq_item_id??'')===key?n+projectMrReleaseQty(item,mr?.status):n,0);
  },0);
  const overrideQty=(Array.isArray(overrides)?overrides:[]).reduce((sum,row)=>{
    if(String(row?.project_boq_item_id??'')!==key||row?.reversed_at) return sum;
    return sum+finiteNonNegative(row?.qty);
  },0);
  const usageLimit=mrApproved+overrideQty;
  const done=finiteNonNegative(totalDone);
  return {
    mr_approved_qty:mrApproved,
    override_qty:overrideQty,
    usage_limit:usageLimit,
    available_for_use:Math.max(0,usageLimit-done)
  };
}

function checkProjectMaterialUsage({itemName='',mrApprovedQty=0,usageLimit=0,totalDone=0,requestedToday=0}={}){
  const approved=Math.max(0,Number(mrApprovedQty)||0);
  const limit=Math.max(0,Number(usageLimit)||0);
  const done=Math.max(0,Number(totalDone)||0);
  const requested=Math.max(0,Number(requestedToday)||0);
  const remaining=Math.max(0,limit-done);
  const ok=done+requested<=limit+1e-9;
  return {
    ok,
    mr_approved_qty:approved,
    usage_limit:limit,
    total_done:done,
    requested_today:requested,
    remaining_allowed:remaining,
    message:ok?'':`Material ${String(itemName||'-')} melebihi batas material approved. MR Approved: ${approved}. Total Done: ${done}. Today diminta: ${requested}. Sisa diizinkan: ${remaining}.`
  };
}

module.exports={normalizeProjectMaterialOverrideInput,projectMrReleaseQty,summarizeProjectMaterialLedger,checkProjectMaterialUsage};
