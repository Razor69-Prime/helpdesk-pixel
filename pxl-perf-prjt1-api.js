'use strict';
/* PXL-PERF-PRJT1 — on-demand full Purchase Request detail for PDF/signature use. */
module.exports=function installPrPerformanceApi(app,{db,requireAuth}){
  const allowed=new Set(['superadmin','manager','accounting','admin']);
  const readPerms=new Set(['maker_pr','approval_pr1','approval_pr2','purchasing','supplier_admin']);
  app.get('/api/purchase-requests/:id',requireAuth,async(req,res)=>{
    try{
      const role=String(req.session?.user?.role||'').trim().toLowerCase();
      let canRead=allowed.has(role);
      if(!canRead){
        let account=req.session.user;
        try{
          const users=await db.getUsers();
          account=(Array.isArray(users)?users:[]).find(x=>String(x.id)===String(req.session?.user?.id))||account;
        }catch(_){/* same session fallback as existing PR list permission guard */}
        canRead=Array.isArray(account.pr_roles)&&account.pr_roles.some(x=>readPerms.has(String(x||'').trim()));
      }
      if(!canRead)return res.status(403).json({error:'Akses ditolak.'});
      const entry=await db.getPurchaseRequest(req.params.id);
      if(!entry)return res.status(404).json({error:'Purchase Request tidak ditemukan.'});
      res.json(entry);
    }catch(e){res.status(500).json({error:e.message});}
  });
};
