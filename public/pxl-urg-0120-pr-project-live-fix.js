/* PXL-URG-0120 — resilient Project Tracker load after 0119. */
(()=>{
  'use strict';
  const REV='PXL-URG-0120';

  async function appToken(){
    try{if(typeof waitForAppToken==='function'){const t=await waitForAppToken();if(t)return t;}}catch(_){}
    for(const key of ['token','authToken','pxl_token']){
      const value=localStorage.getItem(key)||sessionStorage.getItem(key);
      if(value)return value;
    }
    return '';
  }

  async function directGet(path){
    const token=await appToken();
    if(!token)throw new Error('Token login belum tersedia.');
    const sep=String(path).includes('?')?'&':'?';
    const response=await fetch('/api'+path+sep+'_pxl0120='+Date.now(),{
      method:'GET',cache:'no-store',
      headers:{Authorization:'Bearer '+token,'X-Auth-Token':token,'Cache-Control':'no-cache'}
    });
    if(!response.ok){
      let msg='HTTP '+response.status;
      try{const body=await response.json();msg=body.error||body.message||msg;}catch(_){}
      throw new Error(msg);
    }
    return response.json();
  }

  const oldLoadProjects=window.loadProjects;
  if(typeof oldLoadProjects==='function'&&!oldLoadProjects.__pxl0120){
    window.loadProjects=async function(){
      try{
        const rows=await directGet('/projects');
        if(!Array.isArray(rows))throw new Error('Format Project tidak valid.');
        projectsData=rows;
        dashProjectData=rows;
        if(typeof populateProjectPicFilter==='function')populateProjectPicFilter();
        if(typeof renderProjectList==='function')renderProjectList();
      }catch(error){
        console.warn(REV+' projects',error);
        if(Array.isArray(projectsData)&&projectsData.length){
          if(typeof renderProjectList==='function')renderProjectList();
          return projectsData;
        }
        return oldLoadProjects.apply(this,arguments);
      }

      try{
        const summaries=await directGet('/project-report-summaries');
        window.pxlProjectReportSummaries={};
        (Array.isArray(summaries)?summaries:[]).forEach(row=>{
          window.pxlProjectReportSummaries[String(row.id)]={material:row.material_summary||{},jasa:row.jasa_summary||{},progress:Number(row.progress)||0};
        });
        if(typeof renderProjectList==='function')renderProjectList();
      }catch(error){console.warn(REV+' summaries',error);}
      return projectsData;
    };
    window.loadProjects.__pxl0120=true;
  }

  window.PXL_URG_0120={revision:REV,directGet};
})();