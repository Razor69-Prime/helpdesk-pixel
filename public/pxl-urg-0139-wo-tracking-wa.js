/* PXL-URG-0139 — WhatsApp template for WO customer tracking.
 * Read-only presentation: reuses the existing tracking modal and the current WO.
 * Opens the customer-specific WA chat; never sends messages automatically.
 */
(function(){
  'use strict';
  const REV='PXL-URG-0139';
  const CUSTOMER_CARE='+62 811-3961-8857'; // Same contact as Service Center.
  let selected=null;

  function ticketList(){
    try{return typeof allTickets!=='undefined'&&Array.isArray(allTickets)?allTickets:[]}
    catch(_){return []}
  }
  function normalizedPhone(raw){
    let digits=String(raw||'').replace(/\D/g,'');
    if(digits.startsWith('00'))digits=digits.slice(2);
    if(digits.startsWith('0'))digits='62'+digits.slice(1);
    else if(digits.startsWith('8'))digits='62'+digits;
    return /^62\d{8,13}$/.test(digits)?digits:'';
  }
  function cleanText(value){
    return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  }
  function workDate(value){
    if(!value)return '';
    const s=String(value);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
      const [y,m,d]=s.split('-').map(Number);
      const dt=new Date(y,m-1,d);
      return Number.isNaN(dt.getTime())?'':dt.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
    }
    const date=new Date(s);
    return Number.isNaN(date.getTime())?'':date.toLocaleString('id-ID',{timeZone:'Asia/Makassar',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})+' WITA';
  }
  function expiryDate(created){
    if(!created)return '';
    const date=new Date(created);
    if(Number.isNaN(date.getTime()))return '';
    return workDate(new Date(date.getTime()+14*864e5).toISOString().slice(0,10));
  }
  function getTicket(btn){
    const token=String(btn?.getAttribute?.('data-token')||'');
    const wo=String(btn?.getAttribute?.('data-wo')||'');
    const rows=ticketList();
    // Do not fall back to a different tracking token: wrong customer chat is worse than a warning.
    const ticket=(token?rows.find(t=>String(t.tracking_token||'')===token)
      :rows.find(t=>wo&&String(t.wo_number||'')===wo))||null;
    const track=String(typeof trackUrl!=='undefined'?trackUrl:'')||
      (token?location.origin+'/track/'+encodeURIComponent(token):'');
    return {ticket,wo:wo||String(ticket?.wo_number||''),token,track,
      customer_name:cleanText(ticket?.customer_name),
      customer_phone:cleanText(ticket?.customer_phone),
      project_name:cleanText(ticket?.project_name),
      status:cleanText(ticket?.status),
      date:workDate(ticket?.worked_at||ticket?.scheduled_date),
      expiry:expiryDate(btn?.getAttribute?.('data-created'))};
  }
  const STATUS={
    assigned:'Assigned',travelling:'Dalam Perjalanan',ongoing:'Sedang Dikerjakan',
    done:'Selesai',completed:'Selesai',pending:'Menunggu',cancelled:'Dibatalkan'
  };
  function message(data){
    if(!data)return '';
    const name=data.customer_name?' '+data.customer_name:'';
    const project=data.project_name||'-';
    const status=STATUS[String(data.status||'').toLowerCase()]||data.status||'-';
    return [
      'Halo Bapak/Ibu'+name+',',
      '',
      'Kami dari Pixel Solusindo ingin menginformasikan terkait pekerjaan Anda.',
      '',
      '*No. Work Order:* '+(data.wo||'-'),
      '*Pekerjaan:* '+project,
      '*Status:* '+status,
      ...(data.date?['*Jadwal Pekerjaan:* '+data.date]:[]),
      '',
      '*Tracking Pekerjaan:*',
      data.track,
      ...(data.expiry?['Link tracking aktif hingga '+data.expiry+'.']:[]),
      '',
      '*Kontak:*',
      'Customer Care: '+CUSTOMER_CARE,
      '',
      'Jika ada pertanyaan, silakan balas pesan ini.',
      '',
      'Terima kasih.',
      '*Pixel Solusindo*'
    ].join('\n');
  }
  function updateReceiver(){
    const info=document.getElementById('pxl-0139-wa-receiver');
    if(!info)return;
    const phone=normalizedPhone(selected?.customer_phone);
    if(phone){
      info.textContent='📲 Penerima WA: '+(selected.customer_name||'Customer')+' · +'+phone;
      info.style.color='var(--muted)';
    }else{
      info.textContent='⚠️ Nomor WhatsApp customer belum tersedia/valid. Periksa nomor pada WO sebelum mengirim.';
      info.style.color='var(--red)';
    }
  }
  function setupModal(){
    const modal=document.getElementById('track-modal');
    const salin=modal?.querySelector?.('[onclick="copyTrackLink()"]');
    const wa=modal?.querySelector?.('[onclick="shareWA()"]');
    const actions=salin?.parentElement;
    if(!modal||!salin||!wa||!actions)return false;
    salin.textContent='📋 Salin Link';
    wa.textContent='📲 WA Customer';
    if(!document.getElementById('pxl-0139-wa-copy')){
      const button=document.createElement('button');
      button.type='button';
      button.id='pxl-0139-wa-copy';
      button.className='btn sm';
      button.textContent='📋 Salin Pesan WA';
      button.style.cssText='flex:1 1 135px;justify-content:center';
      button.addEventListener('click',copyMessage);
      actions.insertBefore(button,wa);
    }
    actions.querySelectorAll?.('button').forEach(button=>{button.style.flex='1 1 105px'});
    if(!document.getElementById('pxl-0139-wa-receiver')){
      const info=document.createElement('div');
      info.id='pxl-0139-wa-receiver';
      info.style.cssText='font-size:11px;margin:0 0 11px;overflow-wrap:anywhere';
      actions.parentElement?.insertBefore(info,actions);
    }
    return true;
  }
  async function copyMessage(){
    if(!selected||!selected.track){alert('Pilih link tracking WO terlebih dahulu.');return;}
    try{
      await navigator.clipboard.writeText(message(selected));
      alert('✅ Template pesan WhatsApp customer berhasil disalin.');
    }catch(_){alert('Gagal menyalin pesan WA. Periksa izin clipboard browser.');}
  }
  function sendWA(){
    if(!selected||!selected.track){alert('Pilih link tracking WO terlebih dahulu.');return;}
    const phone=normalizedPhone(selected.customer_phone);
    if(!phone){
      alert('Nomor WhatsApp customer belum tersedia atau tidak valid. Lengkapi nomor pada Work Order terlebih dahulu.');
      return;
    }
    window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message(selected)),'_blank','noopener,noreferrer');
  }
  function install(){
    if(typeof window.openTrackModal!=='function')return false;
    if(window.openTrackModal.__pxl0139)return true;
    const original=window.openTrackModal;
    function openWithWA(btn){
      const response=original.call(this,btn);
      selected=getTicket(btn);
      setupModal();
      updateReceiver();
      return response;
    }
    openWithWA.__pxl0139=true;
    window.openTrackModal=openWithWA;
    window.shareWA=sendWA;
    setupModal();
    return true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  window.PXL_URG_0139={revision:REV,normalizedPhone,message,getSelected:()=>selected,copyMessage,sendWA};
})();
