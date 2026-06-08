/**
 * =====================================================
 * BANKFLOW – script.js
 * Sistema de Gerenciamento de Contas Bancárias
 * =====================================================
 */

// ── 1. STATE ──────────────────────────────────────────
const STORAGE_KEY = 'bankflow_clients';

/** @type {Array<{conta: string, nome: string, saldo: number, status: string}>} */
let clients = [];

// Sorting state for the clients table
let sortCol = '';
let sortDir = 'asc';

// Chart instance (Chart.js)
let balanceChart = null;

// Pending modal callback
let modalCallback = null;

// ── 2. STORAGE HELPERS ────────────────────────────────
/** Persist clients array to localStorage */
function saveClients() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

/** Load clients from localStorage on startup */
function loadClients() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      clients = JSON.parse(raw);
    } catch {
      clients = [];
    }
  }
}

// ── 3. NAVIGATION ─────────────────────────────────────
/** Switch visible section */
function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(`section-${sectionId}`);
  if (target) target.classList.add('active');

  const navEl = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  if (navEl) navEl.classList.add('active');

  // Refresh dynamic sections
  if (sectionId === 'dashboard') updateDashboard();
  if (sectionId === 'listar')    renderTable();

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

// ── 4. CLOCK ──────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('datetime');
  if (!el) return;
  const now = new Date();
  const date = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('pt-BR');
  el.innerHTML = `${date}<br>${time}`;
}

// ── 5. DASHBOARD ──────────────────────────────────────
function updateDashboard() {
  const total   = clients.length;
  const ativas  = clients.filter(c => c.status === 'ativa').length;
  const inativas= clients.filter(c => c.status === 'inativa').length;
  const saldo   = clients.reduce((acc, c) => acc + (c.status === 'ativa' ? c.saldo : 0), 0);

  animateNumber('stat-total',   total,   false);
  animateNumber('stat-ativas',  ativas,  false);
  animateNumber('stat-inativas',inativas,false);
  animateNumber('stat-saldo',   saldo,   true);

  renderRecentList();
  renderChart();
}

/** Animate a counter from 0 to target */
function animateNumber(elId, target, isCurrency) {
  const el = document.getElementById(elId);
  if (!el) return;
  const duration = 500;
  const start = performance.now();
  const startVal = parseFloat(el.dataset.val || '0') || 0;
  el.dataset.val = target;

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = startVal + (target - startVal) * ease;
    el.textContent = isCurrency ? formatCurrency(current) : Math.round(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/** Render last 5 clients in dashboard */
function renderRecentList() {
  const container = document.getElementById('recentList');
  const recent = [...clients].slice(-5).reverse();

  if (recent.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Nenhuma conta cadastrada</p></div>`;
    return;
  }

  container.innerHTML = recent.map(c => `
    <div class="recent-item">
      <div class="recent-icon"><i class="fa-solid fa-user"></i></div>
      <div>
        <div class="recent-name">${escHtml(c.nome)}</div>
        <div class="recent-account">Conta: ${escHtml(c.conta)}</div>
      </div>
      <div style="margin-left:auto">
        <span class="badge ${c.status === 'ativa' ? 'badge-active' : 'badge-inactive'}">
          ${c.status}
        </span>
      </div>
    </div>
  `).join('');
}

/** Draw / update balance distribution chart */
function renderChart() {
  const canvas = document.getElementById('balanceChart');
  if (!canvas) return;

  // Build buckets
  const buckets = { '< R$1k': 0, 'R$1k–5k': 0, 'R$5k–20k': 0, '> R$20k': 0 };
  clients.filter(c => c.status === 'ativa').forEach(c => {
    if (c.saldo < 1000)       buckets['< R$1k']++;
    else if (c.saldo < 5000)  buckets['R$1k–5k']++;
    else if (c.saldo < 20000) buckets['R$5k–20k']++;
    else                      buckets['> R$20k']++;
  });

  const labels = Object.keys(buckets);
  const data   = Object.values(buckets);

  // Detect theme
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor  = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const tickColor  = isDark ? '#8b949e' : '#57606a';

  if (balanceChart) {
    balanceChart.data.datasets[0].data = data;
    balanceChart.options.scales.x.ticks.color = tickColor;
    balanceChart.options.scales.y.ticks.color = tickColor;
    balanceChart.options.scales.x.grid.color  = gridColor;
    balanceChart.options.scales.y.grid.color  = gridColor;
    balanceChart.update();
    return;
  }

  balanceChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Contas',
        data,
        backgroundColor: ['rgba(26,115,232,.7)', 'rgba(0,200,151,.7)', 'rgba(245,166,35,.7)', 'rgba(124,58,237,.7)'],
        borderColor:     ['rgba(26,115,232,1)',   'rgba(0,200,151,1)',   'rgba(245,166,35,1)',   'rgba(124,58,237,1)'],
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
        y: { ticks: { color: tickColor, font: { size: 11 }, precision: 0 }, grid: { color: gridColor }, beginAtZero: true }
      }
    }
  });
}

// ── 6. CADASTRO ───────────────────────────────────────
function cadastrarCliente() {
  const conta = getValue('cad-conta').trim();
  const nome  = getValue('cad-nome').trim();
  const saldo = parseFloat(getValue('cad-saldo')) || 0;

  if (!conta) { showToast('Número da conta é obrigatório.', 'error'); return; }
  if (!nome)  { showToast('Nome do cliente é obrigatório.', 'error'); return; }
  if (clients.find(c => c.conta === conta)) {
    showToast(`Conta ${conta} já está cadastrada.`, 'error');
    return;
  }

  const btn = document.getElementById('btn-cadastrar');
  setLoading(btn, true);

  setTimeout(() => {
    clients.push({ conta, nome, saldo, status: 'ativa' });
    saveClients();
    clearInputs(['cad-conta', 'cad-nome', 'cad-saldo']);
    setLoading(btn, false);
    showToast(`Cliente "${nome}" cadastrado com sucesso!`, 'success');
    updateDashboard();
  }, 400);
}

// ── 7. CONSULTA ───────────────────────────────────────
function consultarCliente() {
  const conta = getValue('con-conta').trim();
  if (!conta) { showToast('Informe o número da conta.', 'error'); return; }

  const client = clients.find(c => c.conta === conta);
  const result = document.getElementById('con-result');

  if (!client) {
    result.classList.add('hidden');
    showToast('Conta não encontrada.', 'error');
    return;
  }

  document.getElementById('con-nome-result').textContent  = client.nome;
  document.getElementById('con-conta-result').textContent = client.conta;
  document.getElementById('con-saldo-result').textContent = formatCurrency(client.saldo);

  const statusEl = document.getElementById('con-status-result');
  statusEl.textContent = client.status === 'ativa' ? 'Ativa' : 'Inativa';
  statusEl.className = `badge ${client.status === 'ativa' ? 'badge-active' : 'badge-inactive'}`;

  result.classList.remove('hidden');
}

// ── 8. ATUALIZAR SALDO ────────────────────────────────
function atualizarSaldo() {
  const conta     = getValue('atu-conta').trim();
  const novoSaldo = parseFloat(getValue('atu-saldo'));

  if (!conta)          { showToast('Informe o número da conta.', 'error'); return; }
  if (isNaN(novoSaldo) || novoSaldo < 0) { showToast('Informe um saldo válido (≥ 0).', 'error'); return; }

  const client = clients.find(c => c.conta === conta);
  if (!client) { showToast('Conta não encontrada.', 'error'); return; }
  if (client.status === 'inativa') { showToast('Conta inativa. Não é possível atualizar.', 'error'); return; }

  const btn = document.getElementById('btn-atualizar');
  setLoading(btn, true);

  setTimeout(() => {
    client.saldo = novoSaldo;
    saveClients();
    clearInputs(['atu-conta', 'atu-saldo']);
    setLoading(btn, false);
    showToast(`Saldo atualizado para ${formatCurrency(novoSaldo)}.`, 'success');
    updateDashboard();
  }, 400);
}

// ── 9. ENCERRAR CONTA ─────────────────────────────────
function encerrarConta() {
  const conta = getValue('enc-conta').trim();
  if (!conta) { showToast('Informe o número da conta.', 'error'); return; }

  const client = clients.find(c => c.conta === conta);
  if (!client) { showToast('Conta não encontrada.', 'error'); return; }
  if (client.status === 'inativa') { showToast('Conta já está inativa.', 'error'); return; }

  openModal(
    'Encerrar Conta',
    `Deseja encerrar a conta <strong>${escHtml(conta)}</strong> de <strong>${escHtml(client.nome)}</strong>? Esta ação é irreversível.`,
    () => {
      const btn = document.getElementById('btn-encerrar');
      setLoading(btn, true);
      setTimeout(() => {
        client.status = 'inativa';
        saveClients();
        clearInputs(['enc-conta']);
        setLoading(btn, false);
        showToast(`Conta ${conta} encerrada com sucesso.`, 'success');
        updateDashboard();
      }, 400);
    }
  );
}

// ── 10. LISTAR CLIENTES ───────────────────────────────
function getFilteredClients() {
  const search = getValue('search-input').toLowerCase().trim();
  const filter = getValue('filter-status');

  return clients.filter(c => {
    const matchSearch = !search || c.nome.toLowerCase().includes(search) || c.conta.toLowerCase().includes(search);
    const matchStatus = filter === 'todos' || c.status === filter;
    return matchSearch && matchStatus;
  });
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  const empty = document.getElementById('tableEmpty');

  let data = getFilteredClients();

  // Sort
  if (sortCol) {
    data.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol === 'saldo') { av = +av; bv = +bv; }
      else { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  if (data.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  tbody.innerHTML = data.map(c => `
    <tr data-conta="${escHtml(c.conta)}">
      <td class="td-account">${escHtml(c.conta)}</td>
      <td class="td-name">${escHtml(c.nome)}</td>
      <td class="td-balance">${formatCurrency(c.saldo)}</td>
      <td>
        <span class="badge ${c.status === 'ativa' ? 'badge-active' : 'badge-inactive'}">
          <i class="fa-solid fa-circle" style="font-size:7px"></i>
          ${c.status === 'ativa' ? 'Ativa' : 'Inativa'}
        </span>
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="goConsultar('${escHtml(c.conta)}')" title="Ver detalhes">
            <i class="fa-solid fa-eye"></i>
          </button>
          ${c.status === 'ativa' ? `
            <button class="btn btn-outline btn-sm" onclick="goAtualizar('${escHtml(c.conta)}')" title="Atualizar saldo">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="goEncerrar('${escHtml(c.conta)}')" title="Encerrar conta">
              <i class="fa-solid fa-xmark"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// Quick-nav helpers used in table action buttons
function goConsultar(conta) {
  setValue('con-conta', conta);
  showSection('consultar');
  consultarCliente();
}

function goAtualizar(conta) {
  setValue('atu-conta', conta);
  showSection('atualizar');
}

function goEncerrar(conta) {
  setValue('enc-conta', conta);
  showSection('encerrar');
}

// Table sort
function handleSort(col) {
  if (sortCol === col) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortCol = col;
    sortDir = 'asc';
  }

  // Update header icons
  document.querySelectorAll('.data-table th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
  });

  const th = document.querySelector(`.data-table th[data-col="${col}"]`);
  if (th) th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');

  renderTable();
}

// ── 11. CSV EXPORT ────────────────────────────────────
function exportCSV() {
  if (clients.length === 0) { showToast('Nenhum dado para exportar.', 'error'); return; }

  const headers = ['Conta', 'Nome', 'Saldo', 'Status'];
  const rows = clients.map(c => [
    c.conta,
    `"${c.nome.replace(/"/g, '""')}"`,
    c.saldo.toFixed(2).replace('.', ','),
    c.status
  ]);

  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `bankflow_clientes_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exportação CSV concluída!', 'success');
}

// ── 12. THEME ─────────────────────────────────────────
function toggleTheme() {
  const html  = document.documentElement;
  const isDark = html.getAttribute('data-theme') !== 'light';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeIcon').className  = isDark ? 'fa-solid fa-sun'  : 'fa-solid fa-moon';
  document.getElementById('themeLabel').textContent = isDark ? 'Tema Escuro' : 'Tema Claro';
  localStorage.setItem('bankflow_theme', isDark ? 'light' : 'dark');

  // Rebuild chart for new theme colors
  if (balanceChart) {
    balanceChart.destroy();
    balanceChart = null;
    renderChart();
  }
}

// ── 13. MODAL ─────────────────────────────────────────
function openModal(title, body, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = body;
  document.getElementById('modal').classList.remove('hidden');
  modalCallback = onConfirm;
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  modalCallback = null;
}

// ── 14. TOAST ─────────────────────────────────────────
/**
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'info') {
  const iconMap = {
    success: 'fa-circle-check',
    error:   'fa-circle-exclamation',
    info:    'fa-circle-info',
  };

  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fa-solid ${iconMap[type]}"></i></div>
    <span>${escHtml(message)}</span>
    <button class="toast-close" onclick="removeToast(this.parentElement)">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);

  // Auto-remove after 3.5 s
  setTimeout(() => removeToast(toast), 3500);
}

function removeToast(el) {
  if (!el || !el.isConnected) return;
  el.classList.add('removing');
  setTimeout(() => el.remove(), 300);
}

// ── 15. UTILITIES ─────────────────────────────────────
function getValue(id)       { return document.getElementById(id)?.value ?? ''; }
function setValue(id, val)  { const el = document.getElementById(id); if (el) el.value = val; }
function clearInputs(ids)   { ids.forEach(id => setValue(id, '')); }

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

/** Basic HTML-escape to prevent XSS in dynamic content */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Show loading spinner inside a button */
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.original || btn.innerHTML;
    btn.disabled = false;
  }
}

// ── 16. BOOT ──────────────────────────────────────────
function init() {
  // Load persisted data
  loadClients();

  // Restore theme
  const savedTheme = localStorage.getItem('bankflow_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (savedTheme === 'light') {
    document.getElementById('themeIcon').className   = 'fa-solid fa-sun';
    document.getElementById('themeLabel').textContent = 'Tema Escuro';
  }

  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Initial dashboard
  updateDashboard();

  // ── Event: nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      showSection(item.dataset.section);
    });
  });

  // ── Event: hamburger (mobile)
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // ── Event: theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // ── Event: cadastrar
  document.getElementById('btn-cadastrar').addEventListener('click', cadastrarCliente);
  document.getElementById('cad-saldo').addEventListener('keydown', e => { if (e.key === 'Enter') cadastrarCliente(); });

  // ── Event: consultar
  document.getElementById('btn-consultar').addEventListener('click', consultarCliente);
  document.getElementById('con-conta').addEventListener('keydown', e => { if (e.key === 'Enter') consultarCliente(); });

  // ── Event: atualizar
  document.getElementById('btn-atualizar').addEventListener('click', atualizarSaldo);
  document.getElementById('atu-saldo').addEventListener('keydown', e => { if (e.key === 'Enter') atualizarSaldo(); });

  // ── Event: encerrar
  document.getElementById('btn-encerrar').addEventListener('click', encerrarConta);
  document.getElementById('enc-conta').addEventListener('keydown', e => { if (e.key === 'Enter') encerrarConta(); });

  // ── Event: table search / filter
  document.getElementById('search-input').addEventListener('input', renderTable);
  document.getElementById('filter-status').addEventListener('change', renderTable);

  // ── Event: table sort (column headers)
  document.querySelectorAll('.data-table th.sortable').forEach(th => {
    th.addEventListener('click', () => handleSort(th.dataset.col));
  });

  // ── Event: CSV export
  document.getElementById('btn-export').addEventListener('click', exportCSV);

  // ── Event: modal buttons
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-confirm').addEventListener('click', () => {
    closeModal();
    if (typeof modalCallback === 'function') modalCallback();
  });

  // Close modal on overlay click
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // ── Event: keyboard shortcut — Escape closes modal / sidebar
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('sidebar').classList.remove('open');
    }
  });
}

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', init);
