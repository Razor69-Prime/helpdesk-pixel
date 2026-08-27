/* PXL-URG-0026B — deterministic Account Management permission save + readback + Leave Approval. */
(function(){
  'use strict';

  function collectPermissions(){
    const values=new Set();
    document.querySelectorAll('#menu-checkboxes [data-access]:checked').forEach(function(input){
      const value=String(input.dataset.access||'').trim();
      if(value) values.add(value);
    });
    if(document.querySelector('#menu-checkboxes [data-access]')) values.add('access_v2');
    document.querySelectorAll('[data-menu]:checked').forEach(function(input){
      const value=String(input.dataset.menu||'').trim();
      if(value) values.add(value);
    });
    Array.from(values).forEach(function(value){
      if(/_(read|write)$/.test(value)) values.add(value.replace(/_(read|write)$/,''));
    });
    return Array.from(values);
  }

  function getUserById(id){
    try{return Array.isArray(window.allUsers)?window.allUsers.find(function(u){return String(u.id)===String(id);}):null;}catch(_){return null;}
  }

  // A13 membuat checkbox Approve Cuti di matrix akun, tetapi implementasi lama tidak
  // memberikan kontrak ID yang konsisten. Cari berdasarkan ID/name/value bila ada,
  // lalu fallback ke teks container "Approval/Approve Cuti/Izin" agar kompatibel.
  function getLeaveApprovalCheckbox(){
    const directIds=['leave-role-approval','leave-approve','pr-role-leave-approve','edit-leave-approve','approve-leave'];
    for(const id of directIds){
      const el=document.getElementById(id);
      if(el&&el.type==='checkbox') return el;
    }
    const boxes=Array.from(document.querySelectorAll('#edit-user-modal input[type="checkbox"], #menu-checkboxes input[type="checkbox"]'));
    return boxes.find(function(input){
      const key=[input.id,input.name,input.value,input.dataset?.role,input.dataset?.access,input.dataset?.permission].filter(Boolean).join(' ').toLowerCase();
      if(key.includes('leave_approve')||key.includes('leave-approve')||key.includes('approve_leave')) return true;
      const text=String(input.closest('label,div')?.textContent||'').toLowerCase().replace(/\s+/g,' ');
      return (text.includes('approval')||text.includes('approve')||text.includes('setujui'))&&(text.includes('cuti')||text.includes('izin'));
    })||null;
  }

  function applyStoredPermissions(){
    const modal=document.getElementById('edit-user-modal');
    if(!modal||modal.style.display==='none') return;
    const id=document.getElementById('edit-user-id')?.value;
    const user=getUserById(id);
    if(!user) return;
    const stored=new Set(Array.isArray(user.custom_menus)?user.custom_menus:[]);
    document.querySelectorAll('#menu-checkboxes [data-access]').forEach(function(input){
      input.checked=stored.has(input.dataset.access);
    });
    document.querySelectorAll('[data-menu]').forEach(function(input){
      input.checked=stored.has(input.dataset.menu);
    });
    const leaveBox=getLeaveApprovalCheckbox();
    if(leaveBox) leaveBox.checked=Array.isArray(user.pr_roles)&&user.pr_roles.includes('leave_approve');
  }

  function setError(message){
    const el=document.getElementById('edit-error');
    if(!el) return;
    el.textContent=message||'';
    el.style.display=message?'block':'none';
  }

  async function hardSave(){
    const id=document.getElementById('edit-user-id')?.value;
    const username=document.getElementById('edit-username')?.value.trim();
    const name=document.getElementById('edit-name')?.value.trim();
    const role=String(document.getElementById('edit-role')?.value||'').toLowerCase().replace(/[ _-]/g,'');
    const password=document.getElementById('edit-password')?.value||'';
    if(!id||!username||!name||!role) return false;

    const prRoles=[];
    if(document.getElementById('pr-role-maker')?.checked) prRoles.push('maker_pr');
    if(document.getElementById('pr-role-approval1')?.checked) prRoles.push('approval_pr1');
    if(document.getElementById('pr-role-approval2')?.checked) prRoles.push('approval_pr2');
    if(document.getElementById('pr-role-purchasing')?.checked) prRoles.push('purchasing');
    if(document.getElementById('pr-role-supplier')?.checked) prRoles.push('supplier_admin');
    const leaveBox=getLeaveApprovalCheckbox();
    if(leaveBox?.checked) prRoles.push('leave_approve');

    const extraRoles=[];
    if(document.getElementById('edit-extra-sales')?.checked) extraRoles.push('sales');
    if(document.getElementById('edit-extra-technician')?.checked) extraRoles.push('technician');

    const expected=collectPermissions();
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

    setError('');
    await window.api('PATCH','/users/'+encodeURIComponent(id),patch);

    // Readback dari database, bukan response PATCH/snapshot lokal.
    const fresh=await window.api('GET','/users');
    window.allUsers=Array.isArray(fresh)?fresh:[];
    const updated=getUserById(id);
    if(!updated) throw new Error('User tidak ditemukan setelah penyimpanan.');

    const saved=new Set(Array.isArray(updated.custom_menus)?updated.custom_menus:[]);
    const missing=expected.filter(function(v){return !saved.has(v);});
    const extra=Array.from(saved).filter(function(v){return !expected.includes(v);});
    if(missing.length||extra.length){
      throw new Error('Permission gagal tersimpan konsisten. Missing: '+missing.join(', ')+' | Extra: '+extra.join(', '));
    }
    const expectedLeave=Boolean(leaveBox?.checked);
    const savedLeave=Array.isArray(updated.pr_roles)&&updated.pr_roles.includes('leave_approve');
    if(expectedLeave!==savedLeave){
      throw new Error('Permission Approval Cuti gagal tersimpan. Expected: '+expectedLeave+' | Database: '+savedLeave);
    }

    if(typeof window.renderUserTable==='function') window.renderUserTable();
    if(typeof window.closeEditModal==='function') window.closeEditModal();
    alert('✅ Akun berhasil diperbarui!');
    return true;
  }

  // Ini adalah save path aktif: listener capture berjalan sebelum saveEditUser legacy/override.
  document.addEventListener('click',function(event){
    const btn=event.target?.closest?.('#edit-user-save,[onclick*="saveEditUser"]');
    if(!btn) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    hardSave().catch(function(error){
      console.error('[PXL-URG-0026B] save failed',error);
      setError(error?.message||'Gagal menyimpan akun.');
    });
  },true);

  document.addEventListener('click',function(event){
    const trigger=event.target?.closest?.('[onclick*="openEditUserModal"],#user-table-body button');
    if(trigger){
      setTimeout(applyStoredPermissions,20);
      setTimeout(applyStoredPermissions,150);
      setTimeout(applyStoredPermissions,500);
    }
  },true);

  const observer=new MutationObserver(function(){setTimeout(applyStoredPermissions,0);});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
