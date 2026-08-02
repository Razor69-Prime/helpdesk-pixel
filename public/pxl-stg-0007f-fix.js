/* PXL-STG-0007F — isolasi halaman Kanban, menu sidebar/PWA, dan kapasitas teknisi. */
(function(){
  'use strict';

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function pxl0007fFetch(input, init) {
    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : String(input?.url || '');
    if (!url.includes('/api/technician-kanban?') || !response.ok) return response;
    try {
      const data = await response.clone().json();
      if (Array.isArray(data.technicians) && data.technicians.length) return response;
      const techResponse = await originalFetch('/api/technician-kanban/active-technicians', { credentials: 'same-origin' });
      if (!techResponse.ok) return response;
      const techData = await techResponse.json();
      data.technicians = Array.isArray(techData.technicians) ? techData.technicians : [];
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (_) {
      return response;
    }
  };

  function stylePage(page) {
    if (!page) return;
    page.classList.add('view', 'pxl-k7-module');
    if (!page.classList.contains('pxl-k7-active')) {
      page.hidden = true;
      page.style.setProperty('display', 'none', 'important');
    }
  }

  function closeKanban() {
    const page = document.getElementById('pxlKanbanPage');
    if (!page) return;
    page.classList.remove('pxl-k7-active');
    page.hidden = true;
    page.style.setProperty('display', 'none', 'important');
    document.querySelectorAll('[data-k7-nav]').forEach(button => button.classList.remove('active'));
  }

  function openKanban(event) {
    if (event) event.preventDefault();
    const page = document.getElementById('pxlKanbanPage');
    if (!page) return;
    document.querySelectorAll('.app-content > .view, .app-content > section, .app-content > [id^="view-"]').forEach(node => {
      if (node !== page) node.style.display = 'none';
    });
    document.querySelectorAll('.sidebar .nav-btn').forEach(button => button.classList.remove('active'));
    page.hidden = false;
    page.classList.add('pxl-k7-active');
    page.style.setProperty('display', 'block', 'important');
    document.querySelectorAll('[data-k7-nav]').forEach(button => button.classList.add('active'));

    const originalButton = document.querySelector('[data-k7-nav][data-k7-original="1"]');
    if (originalButton && !originalButton.dataset.k7Loading) {
      originalButton.dataset.k7Loading = '1';
      originalButton.click();
      setTimeout(() => delete originalButton.dataset.k7Loading, 100);
    }
  }

  function createMenu() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const buttons = [...sidebar.querySelectorAll('[data-k7-nav]')];
    let button = buttons[0];
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-btn';
      button.dataset.k7Nav = '1';
      button.innerHTML = '<span>🗓️</span><span class="nav-label">Kanban Teknisi</span>';
      const group = sidebar.querySelector('.sidebar-group-content') || sidebar;
      group.appendChild(button);
    }
    button.dataset.k7Original = '1';
    button.onclick = openKanban;
  }

  function bindOtherMenus() {
    document.querySelectorAll('.sidebar .nav-btn:not([data-k7-nav])').forEach(button => {
      if (button.dataset.k7CloseBound) return;
      button.dataset.k7CloseBound = '1';
      button.addEventListener('click', closeKanban, true);
    });
  }

  function repair() {
    stylePage(document.getElementById('pxlKanbanPage'));
    createMenu();
    bindOtherMenus();
  }

  const css = document.createElement('style');
  css.textContent = '#pxlKanbanPage.pxl-k7-module{display:none!important}#pxlKanbanPage.pxl-k7-module.pxl-k7-active{display:block!important}';
  document.head.appendChild(css);

  const observer = new MutationObserver(repair);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', repair, { once: true });
  else repair();
})();
