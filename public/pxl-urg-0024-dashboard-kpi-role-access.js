/* PXL-URG-0024 — Dashboard & KPI navigation access: Manager/Superadmin only. */
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
    var allowed=role==='manager'||role==='superadmin';
    var removeIds=new Set(['dashboard','dashboard_read','dashboard_write','kpi','kpi_read','kpi_write']);
    menus=menus.filter(function(v){return !removeIds.has(String(v||''));});
    if(allowed){
      menus.push('dashboard','dashboard_read','kpi','kpi_read');
      if(role==='superadmin')menus.push('dashboard_write','kpi_write');
    }
    user.custom_menus=[...new Set(menus)];
  }

  function install(){
    if(typeof window.buildNav!=='function'||window.buildNav.__pxlUrg0024)return false;
    var original=window.buildNav;
    var wrapped=function(){
      try{normalizeMenus(window.currentUser||currentUser);}catch(_){}
      return original.apply(this,arguments);
    };
    wrapped.__pxlUrg0024=true;
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
