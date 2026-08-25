/* PXL-URG-0018 — Account Permission explicit override, fresh DB readback. */
(function(){
  'use strict';

  function unique(values){return [...new Set((values||[]).filter(Boolean).map(String))];}

  function collectVisiblePermissions(){
    const values=[];
    document.querySelectorAll('#menu-checkboxes [data-access]:checked').forEach(el=>{
      const v=String(el.dataset.access||'').trim();
      if(v) values.push(v);
    });
    if(document.querySelector('#menu-checkboxes [data-access]')) values.push('access_v2');

    document.querySelectorAll('[data-menu]:checked').forEach(el=>{
      const v=String(el.dataset.menu||'').trim();
      if(v) values.push(v);
    });

    // Navigation lama masih membaca id tanpa suffix _read/_write.
    [...values].forEach(v=>{
      if(/_(read|write)$/.test(v)) values.push(v.replace(/_(read|write)$/,''));
    });
    return unique(values);
  }

  function userById(id){
    try{return Array.isArray(allUsers)?allUsers.find(u=>String(u.id)===String(id)):null;}
    catch(_){return null;}
  }

  function applyExactStoredPermissions(userId){
    const modal=document.getElementById('edit-user-modal');
    if(!modal||modal.style.display==='none') return;
    const u=userById(userId||document.getElementById('edit-user-id')?.value);
    if(!u) return;

    const stored=new Set(Array.isArray(u.custom_menus)?u.custom_menus:[]);
    const explicit=u.custom_menus_override===true;

    // Hanya akun explicit/custom yang harus mengikuti DB 100%.
    // Akun lama yang belum pernah dicustom masih boleh memakai preset role saat pertama dibuka.
    if(!explicit) return;

    document.querySelectorAll('#menu-checkboxes [data-access]').forEach(el=>{
      el.checked=stored.has(String(el.dataset.access||''));
    });
    document.querySelectorAll('[data-menu]').forEach(el=>{
      el.checked=stored.has(String(el.dataset.menu||''));
    });
  }

  const originalOpenEditModal=typeof openEditModal==='function'?openEditModal:null;
  if(originalOpenEditModal){
    openEditModal=function(userId){
      const result=originalOpenEditModal.apply(this,arguments);
      // Script legacy 0005d masih merender matrix sesudah modal dibuka.
      // Re-apply data DB explicit setelah render legacy selesai.
      setTimeout(()=>applyExactStoredPermissions(userId),0);
      setTimeout(()=>applyExactStoredPermissions(userId),80);
      setTimeout(()=>applyExactStoredPermissions(userId),250);
      return result;
    };
  }

  saveEditUser=async function(){
    const id=document.getElementById('edit-user-id')?.value;
    const username=document.getElementById('edit-username')?.value.trim();
    const name=document.getElementById('edit-name')?.value.trim();
    const role=String(document.getElementById('edit-role')?.value||'').toLowerCase().replace(/[ _-]/g,'');
    const password=document.getElementById('edit-password')?.value||'';
    const err=document.getElementById('edit-error');
    if(err){err.style.display='none';err.textContent='';}
    if(!id||!username||!name||!role){
      if(err){err.textContent='Username, nama, dan role wajib diisi.';err.style.display='block';}
      return;
    }

    const prRoles=[];
    if(document.getElementById('pr-role-maker')?.checked) prRoles.push('maker_pr');
    if(document.getElementById('pr-role-approval1')?.checked) prRoles.push('approval_pr1');
    if(document.getElementById('pr-role-approval2')?.checked) prRoles.push('approval_pr2');
    if(document.getElementById('pr-role-purchasing')?.checked) prRoles.push('purchasing');
    if(document.getElementById('pr-role-supplier')?.checked) prRoles.push('supplier_admin');

    const extraRoles=[];
    if(document.getElementById('edit-extra-sales')?.checked) extraRoles.push('sales');
    if(document.getElementById('edit-extra-technician')?.checked) extraRoles.push('technician');

    const expected=collectVisiblePermissions();
    const patch={
      username,name,role,
      custom_menus:expected,
      custom_menus_override:true,
      signature_url:document.getElementById('edit-signature-url')?.value||null,
      pr_roles:prRoles,
      extra_roles:extraRoles,
      allow_invoice_no_wo:document.getElementById('edit-allow-invoice-no-wo')?.checked===true,
      is_active:document.getElementById('edit-is-active')?.value==='true'
    };
    if(password) patch.password=password;

    try{
      await api('PATCH','/users/'+encodeURIComponent(id),patch);

      // Jangan percaya snapshot lokal. Ambil ulang langsung dari database.
      const fresh=await api('GET','/users');
      allUsers=Array.isArray(fresh)?fresh:[];
      const saved=userById(id);
      if(!saved) throw new Error('User tidak ditemukan setelah penyimpanan.');

      const savedMenus=unique(Array.isArray(saved.custom_menus)?saved.custom_menus:[]);
      const savedSet=new Set(savedMenus);
      const missing=expected.filter(v=>!savedSet.has(v));
      const extra=savedMenus.filter(v=>!expected.includes(v));
      if(saved.custom_menus_override!==true||missing.length||extra.length){
        throw new Error('Permission database tidak sama dengan checklist. Missing: '+(missing.join(', ')||'-')+' | Extra: '+(extra.join(', ')||'-')+' | Override: '+String(saved.custom_menus_override));
      }

      if(typeof renderUserTable==='function') renderUserTable();
      if(typeof closeEditModal==='function') closeEditModal();
      alert('✅ Akun berhasil diperbarui!');
    }catch(e){
      console.error('[PXL-URG-0018] account permission save failed',e);
      if(err){err.textContent='Gagal menyimpan permission: '+(e.message||String(e));err.style.display='block';}
      else alert('Gagal menyimpan permission: '+(e.message||String(e)));
    }
  };
})();
