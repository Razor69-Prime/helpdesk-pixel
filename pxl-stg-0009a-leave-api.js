'use strict';

module.exports=function installLeaveApi(app,{db,requireAuth,logActivity}){
  const norm=v=>String(v||'').trim().toLowerCase().replace(/[ _-]/g,'');
  const hrRoles=new Set(['manager','admin','superadmin']);
  const user=req=>req.session.user;
  const find=async id=>(await db.getLeaveRequests()).find(x=>String(x.id)===String(id));
  const audit=async(req,row,action,note='')=>{
    await db.insertLeaveHistory({leave_request_id:row.id,action,note,actor_user_id:user(req).id,actor_name:user(req).name,actor_role:user(req).role});
    if(logActivity)logActivity(req,'leave',action,`${row.request_number||row.id}${note?` — ${note}`:''}`);
  };
  const nextNo=rows=>{
    const d=new Date(),prefix=`CUTI-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-`;
    const n=rows.reduce((m,x)=>Math.max(m,Number(String(x.request_number||'').split('-').pop())||0),0)+1;
    return prefix+String(n).padStart(4,'0');
  };
  const annual=v=>['annualleave','cutitahunan'].includes(norm(v));
  const consumed=(requests,userId,year,excludeId)=>requests.filter(x=>String(x.applicant_user_id)===String(userId)&&String(x.id)!==String(excludeId)&&Number(String(x.start_date||'').slice(0,4))===Number(year)&&annual(x.leave_type)&&x.status==='approved').reduce((s,x)=>s+Number(x.duration_days||0),0);
  const dates=(start,end)=>{const a=new Date(`${start}T00:00:00Z`),b=new Date(`${end}T00:00:00Z`);if(!start||!end||Number.isNaN(+a)||Number.isNaN(+b)||b<a)throw new Error('Rentang tanggal tidak valid.');const duration=Math.floor((b-a)/86400000)+1,back=new Date(b.getTime()+86400000).toISOString().slice(0,10);return{duration,back};};

  app.get('/api/leave/requests',requireAuth,async(req,res)=>{try{
    const rows=await db.getLeaveRequests(),balances=await db.getLeaveBalances();
    res.json({requests:rows,balances,options:await db.getLeaveHrOptions()});
  }catch(e){res.status(500).json({error:e.message});}});
  app.get('/api/leave/users',requireAuth,async(req,res)=>{try{res.json((await db.getUsers()).filter(x=>x.is_active!==false).map(x=>({id:x.id,name:x.name,role:x.role})));}catch(e){res.status(500).json({error:e.message});}});

  app.post('/api/leave/requests',requireAuth,async(req,res)=>{try{
    const me=user(req),rows=await db.getLeaveRequests(),b=req.body||{},period=dates(b.start_date,b.end_date);
    if(!b.start_date||!b.end_date||!b.leave_type||!b.reason)return res.status(400).json({error:'Tanggal, jenis izin/cuti, dan alasan wajib diisi.'});
    const row=await db.insertLeaveRequest({request_number:nextNo(rows),applicant_user_id:me.id,applicant_name:me.name,company:b.company||'',division:b.division||'',job_title:b.job_title||'',start_date:b.start_date,end_date:b.end_date,duration_days:period.duration,return_date:period.back,leave_type:b.leave_type,leave_type_other:b.leave_type_other||null,reason:b.reason,pic_user_id:b.pic_user_id||null,pic_name:b.pic_name||null,opening_balance:Number(b.opening_balance||0),remaining_balance:Number(b.remaining_balance||0),status:'draft',created_by:me.name,created_by_id:me.id});
    await audit(req,row,'CREATE','Draft dibuat');res.status(201).json(row);
  }catch(e){res.status(500).json({error:e.message});}});

  app.patch('/api/leave/requests/:id',requireAuth,async(req,res)=>{try{
    const old=await find(req.params.id);if(!old)return res.status(404).json({error:'Pengajuan tidak ditemukan.'});
    const me=user(req),manager=norm(me.role)==='manager';
    if(!manager&&String(old.created_by_id)!==String(me.id))return res.status(403).json({error:'Anda hanya dapat mengedit pengajuan sendiri. Manager dapat mengedit semua pengajuan.'});
    if(['approved','rejected','cancelled'].includes(old.status)&&!manager)return res.status(409).json({error:'Pengajuan yang sudah diproses hanya dapat diedit Manager.'});
    const allowed=['company','division','job_title','start_date','end_date','leave_type','leave_type_other','reason','pic_user_id','pic_name'];
    const patch={};allowed.forEach(k=>{if(Object.prototype.hasOwnProperty.call(req.body,k))patch[k]=req.body[k];});
    if(patch.start_date||patch.end_date){const period=dates(patch.start_date||old.start_date,patch.end_date||old.end_date);patch.duration_days=period.duration;patch.return_date=period.back;}
    const row=await db.updateLeaveRequest(old.id,patch);await audit(req,row,'EDIT','Data pengajuan diperbarui');res.json(row);
  }catch(e){res.status(500).json({error:e.message});}});

  app.post('/api/leave/requests/:id/submit',requireAuth,async(req,res)=>{try{
    const old=await find(req.params.id),me=user(req);if(!old)return res.status(404).json({error:'Pengajuan tidak ditemukan.'});
    if(String(old.created_by_id)!==String(me.id)&&norm(me.role)!=='manager')return res.status(403).json({error:'Hanya pembuat atau Manager yang dapat mengajukan.'});
    if(!old.applicant_signature)return res.status(400).json({error:'Pemohon wajib tanda tangan sebelum mengajukan.'});
    const row=await db.updateLeaveRequest(old.id,{status:'submitted',submitted_at:new Date().toISOString()});await audit(req,row,'SUBMIT','Diajukan untuk tanda tangan dan approval');res.json(row);
  }catch(e){res.status(500).json({error:e.message});}});

  app.post('/api/leave/requests/:id/sign',requireAuth,async(req,res)=>{try{
    const old=await find(req.params.id),me=user(req),part=String(req.body.part||''),sig=String(req.body.signature||'');
    if(!old)return res.status(404).json({error:'Pengajuan tidak ditemukan.'});if(!sig.startsWith('data:image/'))return res.status(400).json({error:'Tanda tangan tidak valid.'});
    let patch={};
    if(part==='applicant'){
      if(String(old.applicant_user_id)!==String(me.id))return res.status(403).json({error:'Tanda tangan pemohon hanya dapat diisi pemohon.'});
      patch={applicant_signature:sig,applicant_signed_by:me.name,applicant_signed_at:new Date().toISOString()};
    }else if(part==='pic'){
      if(String(old.pic_user_id)!==String(me.id))return res.status(403).json({error:'Tanda tangan PIC hanya dapat diisi PIC Incharge terpilih.'});
      patch={pic_signature:sig,pic_signed_by:me.name,pic_signed_at:new Date().toISOString()};
    }else return res.status(400).json({error:'Bagian tanda tangan tidak dikenal.'});
    const row=await db.updateLeaveRequest(old.id,patch);await audit(req,row,'SIGN',`${part}: ${me.name}`);res.json(row);
  }catch(e){res.status(500).json({error:e.message});}});

  app.post('/api/leave/requests/:id/decision',requireAuth,async(req,res)=>{try{
    const old=await find(req.params.id),me=user(req),decision=String(req.body.decision||'');if(!old)return res.status(404).json({error:'Pengajuan tidak ditemukan.'});
    if(norm(me.role)!=='manager')return res.status(403).json({error:'Hanya Manager yang dapat menyetujui atau menolak pengajuan.'});
    if(!['approved','rejected'].includes(decision))return res.status(400).json({error:'Keputusan tidak valid.'});
    if(decision==='approved'&&!old.pic_signature)return res.status(400).json({error:'PIC Incharge harus tanda tangan sebelum Manager menyetujui.'});
    const sig=String(req.body.signature||'');if(!sig.startsWith('data:image/'))return res.status(400).json({error:'Tanda tangan Manager wajib diisi.'});
    if(decision==='approved'&&annual(old.leave_type)){
      const year=Number(String(old.start_date).slice(0,4)),balances=await db.getLeaveBalances(),all=await db.getLeaveRequests();
      const balance=balances.find(x=>String(x.user_id)===String(old.applicant_user_id)&&Number(x.year)===year),opening=Number(balance?.opening_balance||0),used=consumed(all,old.applicant_user_id,year,old.id),remaining=opening-used-Number(old.duration_days||0);
      if(remaining<0)return res.status(409).json({error:'Saldo cuti tahunan tidak mencukupi.'});
      await db.upsertLeaveBalance({user_id:old.applicant_user_id,user_name:old.applicant_name,year,opening_balance:opening,used_days:used+Number(old.duration_days||0),remaining_balance:remaining,updated_by:me.name});
      old.opening_balance=opening;old.remaining_balance=remaining;
    }
    const row=await db.updateLeaveRequest(old.id,{status:decision,opening_balance:old.opening_balance,remaining_balance:old.remaining_balance,approver_user_id:me.id,approver_name:me.name,approver_role:me.role,approver_signature:sig,approved_at:new Date().toISOString(),decision_note:req.body.note||null});await audit(req,row,decision.toUpperCase(),req.body.note||'');res.json(row);
  }catch(e){res.status(500).json({error:e.message});}});

  app.get('/api/leave/hr',requireAuth,async(req,res)=>{try{if(!hrRoles.has(norm(user(req).role)))return res.status(403).json({error:'Menu Admin HR hanya untuk Manager, Admin, dan Superadmin.'});res.json({users:await db.getUsers(),balances:await db.getLeaveBalances(),requests:await db.getLeaveRequests(),options:await db.getLeaveHrOptions()});}catch(e){res.status(500).json({error:e.message});}});
  app.post('/api/leave/hr/balances',requireAuth,async(req,res)=>{try{const me=user(req);if(!hrRoles.has(norm(me.role)))return res.status(403).json({error:'Tidak berhak mengatur saldo cuti.'});const b=req.body||{};if(!b.user_id||!b.year)return res.status(400).json({error:'User dan tahun wajib diisi.'});const all=await db.getLeaveRequests(),used=consumed(all,b.user_id,b.year),opening=Number(b.opening_balance||0);const row=await db.upsertLeaveBalance({user_id:b.user_id,user_name:b.user_name,year:Number(b.year),opening_balance:opening,used_days:used,remaining_balance:opening-used,notes:b.notes||null,updated_by:me.name});res.json(row);}catch(e){res.status(500).json({error:e.message});}});
  app.post('/api/leave/hr/options',requireAuth,async(req,res)=>{try{const me=user(req),b=req.body||{};if(!hrRoles.has(norm(me.role)))return res.status(403).json({error:'Tidak berhak mengatur dropdown HRD.'});if(!['company','division','job_title','leave_type'].includes(b.option_type)||!String(b.option_value||'').trim())return res.status(400).json({error:'Jenis dan nama pilihan wajib diisi.'});res.status(201).json(await db.insertLeaveHrOption({option_type:b.option_type,option_value:String(b.option_value).trim(),sort_order:Number(b.sort_order||0),is_active:true}));}catch(e){res.status(500).json({error:e.message});}});
  app.patch('/api/leave/hr/options/:id',requireAuth,async(req,res)=>{try{if(!hrRoles.has(norm(user(req).role)))return res.status(403).json({error:'Tidak berhak mengubah dropdown HRD.'});res.json(await db.updateLeaveHrOption(req.params.id,{is_active:req.body.is_active!==false,option_value:req.body.option_value}));}catch(e){res.status(500).json({error:e.message});}});
};
