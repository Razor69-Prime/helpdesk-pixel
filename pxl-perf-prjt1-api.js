'use strict';
/* PXL-PERF-PRJT1 — on-demand full Purchase Request detail for PDF/signature use. */
module.exports=function installPrPerformanceApi(app,{db,requireAuth}){
  const allowed=new Set(['superadmin','manager','accounting','admin']);
  app.get('/api/purchase-requests/:id',requireAuth,async(req,res)=>{
    try{
      const role=String(req.session?.user?.role||'').trim().toLowerCase();
      if(!allowed.has(role))return res.status(403).json({error:'Akses ditolak.'});
      const entry=await db.getPurchaseRequest(req.params.id);
      if(!entry)return res.status(404).json({error:'Purchase Request tidak ditemukan.'});
      res.json(entry);
    }catch(e){res.status(500).json({error:e.message});}
  });
};
