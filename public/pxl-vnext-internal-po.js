/* PXL-VNEXT-IPO1 — Project Internal PO monitoring UI. Monitoring only; no Inventory/accounting writes. */
(function(){
  'use strict';
  const REV='PXL-VNEXT-IPO1';
  const state={projectId:null,host:null,data:null,draft:{general_issue:null,items:[]},dirty:false,loading:false};
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>v===null||v===undefined||v===''?'—':Number(v).toLocaleString('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0});
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const priceValue=v=>v===null||v===undefined||v===''?null:Number(v);
  function ensureStyle(){
    if(document.getElementById('pxl-ipo-style'))return;
    const el=document.createElement('style');el.id='pxl-ipo-style';el.textContent=`
      .pxl-ipo-toolbar{display:flex;gap:7px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}.pxl-ipo-actions{display:flex;gap:7px;flex-wrap:wrap}.pxl-ipo-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:12px}.pxl-ipo-kpi{border:1px solid var(--border);border-radius:10px;background:var(--surface2);padding:10px}.pxl-ipo-kpi span{display:block;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase}.pxl-ipo-kpi b{display:block;margin-top:4px;font-size:14px}.pxl-ipo-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:10px}.pxl-ipo-table{width:100%;min-width:1180px;border-collapse:collapse;font-size:11px}.pxl-ipo-table th{padding:8px;background:var(--surface2);color:var(--muted);font-size:9px;text-transform:uppercase;text-align:left;white-space:nowrap}.pxl-ipo-table td{padding:7px;border-top:1px solid var(--border);vertical-align:top}.pxl-ipo-table input,.pxl-ipo-table select,.pxl-ipo-table textarea{font-size:11px;padding:6px;min-width:70px}.pxl-ipo-table textarea{min-height:52px}.pxl-ipo-has-issue{background:#fff8f1}.pxl-ipo-badge{display:inline-flex;padding:3px 7px;border-radius:99px;font-size:9px;font-weight:800;white-space:nowrap}.pxl-ipo-status-arrived{background:var(--green-bg);color:var(--green)}.pxl-ipo-status-partial{background:var(--amber-bg);color:var(--amber)}.pxl-ipo-status-hold{background:#fff0e5;color:#b54708}.pxl-ipo-status-cancelled{background:var(--red-bg);color:var(--red)}.pxl-ipo-status-ordered{background:var(--blue-bg);color:var(--blue)}.pxl-ipo-status-not-ordered{background:var(--surface2);color:var(--muted)}.pxl-ipo-error{padding:9px 11px;border-radius:8px;background:var(--red-bg);color:var(--red);margin-bottom:10px}.pxl-ipo-note{font-size:10px;color:var(--muted)}.pxl-ipo-history-modal{position:fixed;inset:0;z-index:10070;background:rgba(15,23,42,.58);display:flex;align-items:flex-start;justify-content:center;padding:40px 12px;overflow:auto}.pxl-ipo-history-box{width:min(760px,96vw);background:var(--surface);border-radius:14px;border:1px solid var(--border);padding:16px}.pxl-ipo-history-row{padding:9px 0;border-top:1px solid var(--border)}.pxl-ipo-source-results{margin-top:9px;display:grid;gap:6px;max-height:420px;overflow:auto}.pxl-ipo-source-option{width:100%;text-align:left;border:1px solid var(--border);border-radius:9px;background:var(--surface);padding:9px;cursor:pointer;color:var(--text)}.pxl-ipo-source-option:hover,.pxl-ipo-source-option.active{background:var(--accent-light);border-color:var(--accent)}
      @media(max-width:800px){.pxl-ipo-grid{grid-template-columns:1fr 1fr}.pxl-ipo-toolbar{align-items:flex-start}}
    `;document.head.appendChild(el);
  }
  function statusOf(row){
    if(String(row.manual_state||'not_ordered')==='cancelled')return'Cancelled';
    const q=num(row.qty_po),a=num(row.qty_arrived);
    if(q>0&&a>=q)return'Arrived';
    if(a>0&&a<q)return'Partial Arrived';
    if(row.manual_state==='hold')return'Hold';
    if(row.manual_state==='ordered')return'Ordered';
    return'Belum Dipesan';
  }
  function statusClass(status){return status==='Arrived'?'pxl-ipo-status-arrived':status==='Partial Arrived'?'pxl-ipo-status-partial':status==='Hold'?'pxl-ipo-status-hold':status==='Cancelled'?'pxl-ipo-status-cancelled':status==='Ordered'?'pxl-ipo-status-ordered':'pxl-ipo-status-not-ordered'}
  function preview(){
    const items=state.draft.items||[];const statuses=items.map(statusOf);const active=statuses.filter(x=>x!=='Cancelled');
    let overall='Belum Ada Item';
    if(items.length){
      if(statuses.every(x=>x==='Cancelled'))overall='Cancelled';
      else if(active.length&&active.every(x=>x==='Arrived'))overall='Completed';
      else if(active.some(x=>x==='Partial Arrived')||(active.some(x=>x==='Arrived')&&active.some(x=>x!=='Arrived')))overall='Partial';
      else if(active.some(x=>x==='Ordered'||x==='Hold'))overall='In Progress';
      else overall='Belum Dipesan';
    }
    const totals=items.map(x=>priceValue(x.actual_unit_price)===null?null:num(x.qty_po)*priceValue(x.actual_unit_price));
    return {overall,totals,grand_total:totals.reduce((s,x)=>s+(x===null?0:x),0),counts:{total_items:items.length,arrived:statuses.filter(x=>x==='Arrived').length,partial_pending:statuses.filter(x=>!['Arrived','Cancelled'].includes(x)).length,issues:items.filter(x=>String(x.issue||'').trim()).length}};
  }
  function markDirty(){state.dirty=true;}
  function canLeave(){
    if(!state.dirty)return true;
    if(!confirm('Ada perubahan Internal PO yang belum disimpan. Buang perubahan dan lanjut?'))return false;
    state.dirty=false;return true;
  }
  function onBeforeUnload(e){
    if(!state.dirty)return;
    e.preventDefault();
    e.returnValue='';
    return '';
  }
  window.addEventListener('beforeunload',onBeforeUnload);
  function rowHtml(row,index,editable,total){
    const st=statusOf(row),issue=String(row.issue||'').trim();
    const field=(name,value,type='text',extra='')=>editable?`<input ${type==='number'?'type="number"':''} data-ipo-field="${name}" data-row-index="${index}" value="${h(value??'')}" ${extra}>`:h(value??'—');
    return `<tr class="${issue?'pxl-ipo-has-issue':''}" data-ipo-row="${index}">
      <td>${index+1}${editable?`<div><button class="btn danger sm" data-ipo-remove="${index}" title="Hapus dari monitoring">×</button></div>`:''}</td>
      <td>${field('item_name',row.item_name)}</td>
      <td>${field('qty_po',row.qty_po,'number','min="0.000001" step="any"')}</td>
      <td>${field('qty_arrived',row.qty_arrived,'number','min="0" step="any"')}</td>
      <td>${field('unit',row.unit||'')}</td>
      <td>${field('actual_unit_price',row.actual_unit_price??'','number','min="0" step="any"')}</td>
      <td id="pxl-ipo-total-${index}">${total===null?'—':money(total)}</td>
      <td>${field('supplier_name',row.supplier_name||'')}</td>
      <td>${editable?`<select data-ipo-field="manual_state" data-row-index="${index}"><option value="not_ordered" ${row.manual_state==='not_ordered'?'selected':''}>Belum Dipesan</option><option value="ordered" ${row.manual_state==='ordered'?'selected':''}>Ordered</option><option value="hold" ${row.manual_state==='hold'?'selected':''}>Hold</option><option value="cancelled" ${row.manual_state==='cancelled'?'selected':''}>Cancelled</option></select>`:''}<div style="margin-top:${editable?'4px':'0'}"><span id="pxl-ipo-status-${index}" class="pxl-ipo-badge ${statusClass(st)}">${h(st)}</span></div></td>
      <td>${editable?`<textarea data-ipo-field="issue" data-row-index="${index}">${h(row.issue||'')}</textarea>`:h(row.issue||'—')}</td>
    </tr>`;
  }
  function render(){
    ensureStyle();if(!state.host)return;
    if(state.loading){state.host.innerHTML='<div class="pxl-v3a-placeholder">Memuat Internal PO...</div>';return;}
    if(!state.data){state.host.innerHTML='<div class="pxl-ipo-error">Data Internal PO belum tersedia.</div>';return;}
    const editable=state.data?.can_manage===true;
    const project=state.data.project||{};const pv=preview();const shownOverall=state.dirty?pv.overall:(state.data.overall_status||pv.overall);
    const rows=(state.draft.items||[]).map((r,i)=>rowHtml(r,i,editable,pv.totals[i])).join('');
    const mutation=editable?`<button class="btn sm" id="pxl-ipo-pr-import">Pilih Purchase Request</button><button class="btn sm" id="pxl-ipo-boq-add">Tambah Item BOQ</button><button class="btn primary sm" id="pxl-ipo-save">Simpan Perubahan</button>`:'';
    state.host.innerHTML=`
      <div id="pxl-ipo-error"></div>
      <div class="pxl-ipo-toolbar"><div><b>Internal PO — Monitoring Pembelian Project</b><div class="pxl-ipo-note">Monitoring internal saja. Tidak membuat PO supplier, transaksi Inventory, atau jurnal keuangan.</div></div><div class="pxl-ipo-actions">${mutation}<button class="btn sm" id="pxl-ipo-export-excel">Export Excel</button><button class="btn sm" id="pxl-ipo-export-pdf">Export PDF</button><button class="btn sm" id="pxl-ipo-history">Riwayat Perubahan</button></div></div>
      <div class="pxl-ipo-grid">
        <div class="pxl-ipo-kpi"><span>Project ID</span><b>${h(project.project_number||'—')}</b></div>
        <div class="pxl-ipo-kpi"><span>Nama Project</span><b>${h(project.nama_project||'—')}</b></div>
        <div class="pxl-ipo-kpi"><span>Status</span><b id="pxl-ipo-overall">${h(shownOverall)}</b></div>
        <div class="pxl-ipo-kpi"><span>Total Item</span><b id="pxl-ipo-count">${pv.counts.total_items}</b></div>
        <div class="pxl-ipo-kpi"><span>Total Harga Beli</span><b id="pxl-ipo-grand">${money(pv.grand_total)}</b></div>
      </div>
      <div class="pxl-ipo-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="pxl-ipo-kpi"><span>Arrived</span><b id="pxl-ipo-arrived">${pv.counts.arrived}</b></div><div class="pxl-ipo-kpi"><span>Partial / Pending</span><b id="pxl-ipo-pending">${pv.counts.partial_pending}</b></div><div class="pxl-ipo-kpi"><span>Item Ada Issue</span><b id="pxl-ipo-issues">${pv.counts.issues}</b></div></div>
      <div style="margin-bottom:12px"><label>Issue Umum</label>${editable?`<textarea id="pxl-ipo-general-issue" placeholder="Catatan issue pembelian secara umum...">${h(state.draft.general_issue||'')}</textarea>`:`<div class="pxl-v3a-card">${h(state.draft.general_issue||'—')}</div>`}</div>
      <div class="pxl-ipo-table-wrap"><table class="pxl-ipo-table"><thead><tr><th>No</th><th>Nama Barang</th><th>Qty PO</th><th>Qty Arrived</th><th>Satuan</th><th>Harga Beli Aktual</th><th>Total</th><th>Supplier</th><th>Status</th><th>Issue</th></tr></thead><tbody>${rows||'<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:22px">Belum ada item Internal PO.</td></tr>'}</tbody></table></div>`;
    bind(editable);
  }
  function bind(editable){
    const history=document.getElementById('pxl-ipo-history');if(history)history.onclick=openHistory;
    const excel=document.getElementById('pxl-ipo-export-excel');if(excel)excel.onclick=exportExcel;
    const pdf=document.getElementById('pxl-ipo-export-pdf');if(pdf)pdf.onclick=exportPdf;
    if(!editable)return;
    const general=document.getElementById('pxl-ipo-general-issue');if(general)general.oninput=()=>{state.draft.general_issue=general.value;markDirty()};
    document.querySelectorAll('[data-ipo-field]').forEach(el=>{
      el.oninput=el.onchange=()=>{
        const row=state.draft.items[Number(el.dataset.rowIndex)];if(!row)return;
        const field=el.dataset.ipoField;
        row[field]=['qty_po','qty_arrived','actual_unit_price'].includes(field)?(el.value===''?null:Number(el.value)):el.value;
        markDirty();refreshPreview();
      };
    });
    document.querySelectorAll('[data-ipo-remove]').forEach(btn=>btn.onclick=()=>{state.draft.items.splice(Number(btn.dataset.ipoRemove),1);markDirty();render()});
    const prBtn=document.getElementById('pxl-ipo-pr-import');if(prBtn)prBtn.onclick=openPurchaseRequestPicker;
    const boqBtn=document.getElementById('pxl-ipo-boq-add');if(boqBtn)boqBtn.onclick=openBoqPicker;
    const saveBtn=document.getElementById('pxl-ipo-save');if(saveBtn)saveBtn.onclick=save;
  }
  function refreshPreview(){
    const pv=preview();
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
    set('pxl-ipo-overall',pv.overall);set('pxl-ipo-count',pv.counts.total_items);set('pxl-ipo-grand',money(pv.grand_total));set('pxl-ipo-arrived',pv.counts.arrived);set('pxl-ipo-pending',pv.counts.partial_pending);set('pxl-ipo-issues',pv.counts.issues);
    state.draft.items.forEach((row,index)=>{const total=document.getElementById(`pxl-ipo-total-${index}`);if(total)total.textContent=pv.totals[index]===null?'—':money(pv.totals[index]);const st=statusOf(row),badge=document.getElementById(`pxl-ipo-status-${index}`);if(badge){badge.textContent=st;badge.className=`pxl-ipo-badge ${statusClass(st)}`;}const tr=document.querySelector(`[data-ipo-row="${index}"]`);if(tr)tr.classList.toggle('pxl-ipo-has-issue',!!String(row.issue||'').trim())});
  }
  function closeSourceModal(){document.querySelector('.pxl-ipo-source-modal')?.remove();}
  function createSourceModal(title,subtitle){
    closeSourceModal();
    const wrap=document.createElement('div');wrap.className='pxl-ipo-history-modal pxl-ipo-source-modal';
    wrap.innerHTML=`<div class="pxl-ipo-history-box"><div class="pxl-ipo-toolbar"><div><b>${h(title)}</b><div class="pxl-ipo-note">${h(subtitle||'')}</div></div><button class="btn sm" data-ipo-source-close>✕</button></div><input id="pxl-ipo-source-search" autocomplete="off"><div id="pxl-ipo-source-error"></div><div class="pxl-ipo-source-results" id="pxl-ipo-source-results"></div></div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-ipo-source-close]'))closeSourceModal()});
    return wrap;
  }
  function importPurchaseRequest(pr){
    if(!pr?.id)return 0;
    const existingKeys=new Set((state.draft.items||[]).filter(row=>row.source_type==='pr'&&row.source_pr_id!=null&&row.source_pr_item_index!=null).map(row=>`${row.source_pr_id}:${row.source_pr_item_index}`));
    const savedByKey=new Map((state.data?.items||[]).filter(row=>row.source_type==='pr'&&row.source_pr_id!=null&&row.source_pr_item_index!=null).map(row=>[`${row.source_pr_id}:${row.source_pr_item_index}`,row]));
    let added=0;
    (Array.isArray(pr.items)?pr.items:[]).forEach((item,index)=>{
      const key=`${pr.id}:${index}`;
      if(existingKeys.has(key)) return;
      const saved=savedByKey.get(key);
      if(saved){
        state.draft.items.push({...saved,sort_order:state.draft.items.length});
        existingKeys.add(key);added++;return;
      }
      const price=Number(item.price); const importedPrice=Number.isFinite(price)&&price>0?price:null;
      state.draft.items.push({
        id:null,source_type:'pr',source_pr_id:pr.id,source_pr_number:pr.pr_number||null,source_pr_item_index:index,source_boq_item_id:null,
        item_name:String(item.desc??item.item_name??item.name??'').trim(),qty_po:Number(item.qty)||1,qty_arrived:0,unit:String(item.unit||'').trim()||null,
        actual_unit_price:importedPrice,source_supplier_id:item.supplier_id||null,supplier_name:String(item.supplier_name??item.supplier??'').trim()||null,
        manual_state:'not_ordered',issue:null,sort_order:state.draft.items.length
      });
      existingKeys.add(key);added++;
    });
    if(added){markDirty();render();}
    return added;
  }
  function openPurchaseRequestPicker(){
    if(state.data?.can_manage!==true)return;
    const modal=createSourceModal('Pilih Purchase Request','PR Number · requester/outlet · status. Semua item baru dari PR terpilih akan diautofill dan tetap editable.');
    const input=modal.querySelector('#pxl-ipo-source-search'),results=modal.querySelector('#pxl-ipo-source-results'),error=modal.querySelector('#pxl-ipo-source-error');
    input.placeholder='Cari nomor PR, requester, atau outlet...';let timer=null,seq=0,rows=[];
    async function searchPurchaseRequests(query){
      const my=++seq;error.innerHTML='';results.innerHTML='<div class="pxl-ipo-note">Mencari Purchase Request...</div>';
      try{
        const out=await api('GET',`/projects/${encodeURIComponent(state.projectId)}/internal-po/purchase-requests?q=${encodeURIComponent(String(query||'').trim())}&limit=30`);
        if(my!==seq)return;rows=Array.isArray(out)?out:[];
        results.innerHTML=rows.length?rows.map((pr,i)=>`<button type="button" class="pxl-ipo-source-option" data-ipo-pr-option="${i}"><b>${h(pr.pr_number||'PR')}</b><div class="pxl-ipo-note">${h(pr.pr_date||'-')} · ${h(pr.requester||pr.outlet||'-')} · ${h(pr.status||'-')} · ${(Array.isArray(pr.items)?pr.items.length:0)} item</div></button>`).join(''):'<div class="pxl-ipo-note">Purchase Request tidak ditemukan.</div>';
        results.querySelectorAll('[data-ipo-pr-option]').forEach(btn=>btn.onclick=()=>{const pr=rows[Number(btn.dataset.ipoPrOption)];const added=importPurchaseRequest(pr);closeSourceModal();if(!added)alert('Semua item dari PR ini sudah ada di Internal PO. Edit yang sudah ada tetap dipertahankan.');});
      }catch(e){if(my===seq){results.innerHTML='';error.innerHTML=`<div class="pxl-ipo-error">${h(e.message||'Gagal mencari Purchase Request.')}</div>`;}}
    }
    input.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>searchPurchaseRequests(input.value),250)};
    searchPurchaseRequests('');setTimeout(()=>input.focus(),0);
  }
  function selectBoqOption(row){
    if(!row?.id)return;
    const qty=Number(row.boq_qty);
    state.draft.items.push({
      id:null,source_type:'boq',source_pr_id:null,source_pr_number:null,source_pr_item_index:null,source_boq_item_id:row.id,
      item_name:row.item_name||'',qty_po:Number.isFinite(qty)&&qty>0?qty:1,qty_arrived:0,unit:row.unit||null,actual_unit_price:null,
      source_supplier_id:null,supplier_name:null,manual_state:'not_ordered',issue:null,sort_order:state.draft.items.length
    });
    markDirty();closeSourceModal();render();
  }
  function openBoqPicker(){
    if(state.data?.can_manage!==true)return;
    const modal=createSourceModal('Tambah Item BOQ','Fast search hanya BOQ Material Project ini. Item BOQ yang sama boleh ditambahkan lagi untuk pembelian terpisah.');
    const input=modal.querySelector('#pxl-ipo-source-search'),results=modal.querySelector('#pxl-ipo-source-results'),error=modal.querySelector('#pxl-ipo-source-error');
    input.placeholder='Cari nama material BOQ...';let timer=null,seq=0,rows=[],activeIndex=-1;
    function paint(){
      results.innerHTML=rows.length?rows.map((row,i)=>`<button type="button" class="pxl-ipo-source-option ${i===activeIndex?'active':''}" data-ipo-boq-option="${i}"><b>${h(row.item_name||'-')}</b><div class="pxl-ipo-note">BOQ Material · ${h(row.boq_qty||'-')} ${h(row.unit||'')}</div></button>`).join(''):'<div class="pxl-ipo-note">Material BOQ tidak ditemukan.</div>';
      results.querySelectorAll('[data-ipo-boq-option]').forEach(btn=>btn.onmousedown=e=>{e.preventDefault();selectBoqOption(rows[Number(btn.dataset.ipoBoqOption)])});
    }
    async function searchBoq(query){
      const my=++seq;error.innerHTML='';results.innerHTML='<div class="pxl-ipo-note">Mencari BOQ Material...</div>';
      try{
        const out=await api('GET',`/projects/${encodeURIComponent(state.projectId)}/internal-po/boq-options?q=${encodeURIComponent(String(query||'').trim())}&limit=30`);
        if(my!==seq)return;rows=Array.isArray(out)?out:[];activeIndex=rows.length?0:-1;paint();
      }catch(e){if(my===seq){rows=[];results.innerHTML='';error.innerHTML=`<div class="pxl-ipo-error">${h(e.message||'Gagal mencari BOQ Material.')}</div>`;}}
    }
    input.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>searchBoq(input.value),250)};
    input.onkeydown=e=>{
      if(e.key==='ArrowDown'){e.preventDefault();if(rows.length){activeIndex=(activeIndex+1)%rows.length;paint();}}
      else if(e.key==='ArrowUp'){e.preventDefault();if(rows.length){activeIndex=(activeIndex-1+rows.length)%rows.length;paint();}}
      else if(e.key==='Enter'&&activeIndex>=0&&rows[activeIndex]){e.preventDefault();selectBoqOption(rows[activeIndex]);}
    };
    searchBoq('');setTimeout(()=>input.focus(),0);
  }
  async function load(){
    if(!state.projectId||!state.host)return;state.loading=true;render();
    try{const data=await api('GET',`/projects/${encodeURIComponent(state.projectId)}/internal-po`);state.data=data;state.draft={general_issue:data.header?.general_issue||null,items:(data.items||[]).map(x=>({...x}))};state.dirty=false;}
    catch(e){state.data=null;state.host.innerHTML=`<div class="pxl-ipo-error">${h(e.message||'Gagal memuat Internal PO.')}</div>`;return}
    finally{state.loading=false}
    render();
  }
  async function save(){
    if(!state.data?.can_manage)return;
    const error=document.getElementById('pxl-ipo-error');if(error)error.innerHTML='';
    try{
      const data=await api('PUT',`/projects/${encodeURIComponent(state.projectId)}/internal-po`,{general_issue:state.draft.general_issue,items:state.draft.items});
      state.data=data;state.draft={general_issue:data.header?.general_issue||null,items:(data.items||[]).map(x=>({...x}))};state.dirty=false;render();
    }catch(e){if(error)error.innerHTML=`<div class="pxl-ipo-error">${h(e.message||'Gagal menyimpan Internal PO.')}</div>`;}
  }
  function exportDateStamp(){return new Date().toISOString().slice(0,10).replace(/-/g,'');}
  function safeExportProjectId(){return String(state.data?.project?.project_number||'Project').replace(/[^a-zA-Z0-9_-]/g,'-').replace(/^-+|-+$/g,'')||'Project';}
  function exportExcel(){
    if(!window.XLSX){alert('Library Excel belum tersedia. Muat ulang halaman dan coba kembali.');return;}
    const project=state.data?.project||{},pv=preview(),overall=state.dirty?pv.overall:(state.data?.overall_status||pv.overall),generated=new Date().toLocaleString('id-ID');
    const headers=['No','Nama Barang','Qty PO','Qty Arrived','Satuan','Harga Beli Aktual','Total','Supplier','Status','Issue'];
    const body=(state.draft.items||[]).map((row,index)=>{
      const price=priceValue(row.actual_unit_price),total=price===null?null:num(row.qty_po)*price;
      return [index+1,row.item_name||'',num(row.qty_po),num(row.qty_arrived),row.unit||'',price===null?'':price,total===null?'':total,row.supplier_name||'',statusOf(row),row.issue||''];
    });
    const rows=[
      ['PIXEL SOLUSINDO'],['INTERNAL PO — PROJECT MONITORING'],
      ['Project ID',project.project_number||'—'],['Nama Project',project.nama_project||'—'],['Overall Status',overall],['Generated',generated],['Issue Umum',state.draft.general_issue||'—'],[],headers,
      ...body,[],['TOTAL HARGA BELI','','','','','',pv.grand_total]
    ];
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:6},{wch:38},{wch:12},{wch:13},{wch:12},{wch:20},{wch:20},{wch:24},{wch:18},{wch:34}];
    const headerRow=9,firstDataRow=headerRow+1;
    for(let i=0;i<body.length;i++){
      for(const col of ['C','D','F','G']){
        const cell=ws[`${col}${firstDataRow+i}`];if(cell&&typeof cell.v==='number')cell.z='#,##0.##';
      }
    }
    const totalCell=ws[`G${firstDataRow+body.length+1}`];if(totalCell)totalCell.z='#,##0.##';
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Internal PO');
    const projectId=safeExportProjectId();
    XLSX.writeFile(wb,`Internal-PO-${projectId}-${exportDateStamp()}.xlsx`);
  }
  function exportPdf(){
    const jsPDF=window.jspdf?.jsPDF;
    if(!jsPDF){alert('Library PDF belum tersedia. Muat ulang halaman dan coba kembali.');return;}
    const project=state.data?.project||{},pv=preview(),overall=state.dirty?pv.overall:(state.data?.overall_status||pv.overall),generated=new Date().toLocaleString('id-ID');
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('PIXEL SOLUSINDO',10,11);
    doc.setFontSize(12);doc.text('INTERNAL PO — PROJECT MONITORING',10,18);
    doc.setFont('helvetica','normal');doc.setFontSize(8);
    doc.text(`Project ID: ${project.project_number||'—'}`,10,24);doc.text(`Nama Project: ${project.nama_project||'—'}`,10,29);
    doc.text(`Status: ${overall}`,145,24);doc.text(`Generated: ${generated}`,145,29);
    const issueLines=doc.splitTextToSize(`Issue Umum: ${String(state.draft.general_issue||'—')}`,277);
    doc.text(issueLines,10,34);
    const tableStartY=34+(Math.max(1,issueLines.length)*3.6)+3;
    const head=[['No','Nama Barang','Qty PO','Qty Arrived','Satuan','Harga Beli Aktual','Total','Supplier','Status','Issue']];
    const body=(state.draft.items||[]).map((row,index)=>{
      const price=priceValue(row.actual_unit_price),total=price===null?null:num(row.qty_po)*price;
      return [index+1,row.item_name||'',num(row.qty_po),num(row.qty_arrived),row.unit||'',price===null?'—':money(price),total===null?'—':money(total),row.supplier_name||'',statusOf(row),row.issue||''];
    });
    if(typeof doc.autoTable!=='function'){alert('Komponen tabel PDF belum tersedia. Muat ulang halaman dan coba kembali.');return;}
    doc.autoTable({startY:tableStartY,head,body,theme:'grid',styles:{fontSize:6.5,cellPadding:1.4,valign:'middle',overflow:'linebreak'},headStyles:{fillColor:[235,237,240],textColor:[20,20,20]},columnStyles:{0:{cellWidth:8},1:{cellWidth:45},2:{cellWidth:14},3:{cellWidth:16},4:{cellWidth:14},5:{cellWidth:28},6:{cellWidth:28},7:{cellWidth:30},8:{cellWidth:24},9:{cellWidth:52}},showHead:'everyPage',rowPageBreak:'avoid'});
    const y=Math.min(doc.internal.pageSize.getHeight()-9,(doc.lastAutoTable?.finalY||tableStartY)+7);
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(`TOTAL HARGA BELI: ${money(pv.grand_total)}`,doc.internal.pageSize.getWidth()-10,y,{align:'right'});
    const projectId=safeExportProjectId();
    doc.save(`Internal-PO-${projectId}-${exportDateStamp()}.pdf`);
  }
  async function openHistory(){
    try{
      const rows=await api('GET',`/projects/${encodeURIComponent(state.projectId)}/internal-po/history`);
      const wrap=document.createElement('div');wrap.className='pxl-ipo-history-modal';wrap.innerHTML=`<div class="pxl-ipo-history-box"><div class="pxl-ipo-toolbar"><b>Riwayat Perubahan</b><button class="btn sm" data-ipo-history-close>✕</button></div><div>${(rows||[]).length?(rows||[]).map(x=>`<div class="pxl-ipo-history-row"><b>${h(x.change_type||'-')}</b><div class="pxl-ipo-note">${h(new Date(x.created_at).toLocaleString('id-ID'))} · ${h(x.actor_name||'-')}</div>${x.field_name?`<div>${h(x.field_name)}</div>`:''}</div>`).join(''):'<div class="pxl-v3a-placeholder">Belum ada riwayat perubahan.</div>'}</div></div>`;document.body.appendChild(wrap);wrap.onclick=e=>{if(e.target===wrap||e.target.closest('[data-ipo-history-close]'))wrap.remove()};
    }catch(e){alert(e.message||'Gagal memuat riwayat Internal PO.');}
  }
  async function open(projectId,host){state.projectId=String(projectId||'');state.host=host||null;state.data=null;state.draft={general_issue:null,items:[]};state.dirty=false;await load();}
  async function refresh(projectId){if(projectId)state.projectId=String(projectId);await load();}
  function destroy(){state.projectId=null;state.host=null;state.data=null;state.draft={general_issue:null,items:[]};state.dirty=false;}
  window.pxlProjectInternalPo={revision:REV,open,refresh,canLeave,destroy};
})();
