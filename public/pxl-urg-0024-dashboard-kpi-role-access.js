/* PXL-URG-0042 — Dashboard navigation permission follows Account Management checklist. KPI policy unchanged. */
(function(){
  'use strict';

  function normalizedRole(){
    try{return String(window.currentUser?.role||currentUser?.role||'').toLowerCase().replace(/[ _-]/g,'');}
    catch(_){return '';}
  }

  function normalizeMenus(user){
    if(!user)return;
    var role=String(user.role||'').toLowerCase().replace(/[ _-]/g,'');
    var menus=Array.isArray(user.custom_menus)?user.custom_menus.slice():[];
    var source=new Set(menus.map(function(v){return String(v||'');}));

    // Dashboard permission v1:
    // - Superadmin is always allowed.
    // - Once Account Management has saved the new marker, honor the Dashboard checkbox exactly.
    // - Before the marker exists, preserve legacy Dashboard access for Manager/Admin so
    //   existing accounts that lost Dashboard during older permission saves recover safely.
    var dashboardExplicit=source.has('dashboard_permission_v1');
    var dashboardChecked=source.has('dashboard')||source.has('dashboard_read')||source.has('dashboard_write');
    var dashboardAllowed=role==='superadmin'||(dashboardExplicit?dashboardChecked:(role==='manager'||role==='admin'));

    // KPI keeps the previous policy: Manager/Superadmin only.
    var kpiAllowed=role==='manager'||role==='superadmin';

    var removeIds=new Set(['dashboard','dashboard_read','dashboard_write','kpi','kpi_read','kpi_write']);
    menus=menus.filter(function(v){return !removeIds.has(String(v||''));});

    if(dashboardAllowed){
      menus.push('dashboard','dashboard_read');
      if(role==='superadmin'||source.has('dashboard_write'))menus.push('dashboard_write');
    }
    if(kpiAllowed){
      menus.push('kpi','kpi_read');
      if(role==='superadmin')menus.push('kpi_write');
    }
    user.custom_menus=[...new Set(menus)];
  }

  function install(){
    if(typeof window.buildNav!=='function'||window.buildNav.__pxlUrg0042)return false;
    var original=window.buildNav.__pxlUrg0024&&window.buildNav.__original?window.buildNav.__original:window.buildNav;
    var wrapped=function(){
      try{normalizeMenus(window.currentUser||currentUser);}catch(_){}
      return original.apply(this,arguments);
    };
    wrapped.__pxlUrg0042=true;
    wrapped.__original=original;
    window.buildNav=wrapped;
    try{
      var role=normalizedRole();
      if(role)window.buildNav();
    }catch(_){}
    return true;
  }

  if(!install()){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(install()||tries>=40)clearInterval(timer);
    },100);
  }
})();
