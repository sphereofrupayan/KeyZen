/* ============================================================
   CIPHERVAULT — Shared interactions
   Backend: http://localhost:5000 (Flask). Frontend served from
   http://localhost:5500. Every fetch() below uses `localhost` on
   both sides (not 127.0.0.1) and credentials: 'include', so the
   session cookie survives across requests.
   ============================================================ */

const API = 'https://keyzen-mcbu.onrender.com';
const CIPHER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*01';

/* ---------- Cipher scramble reveal ---------- */
function scrambleReveal(el, { duration = 700, stagger = 22 } = {}) {
  const finalText = el.dataset.text || el.textContent;
  el.dataset.text = finalText;
  const chars = finalText.split('');
  const frameRate = 40;
  const totalTicks = Math.ceil(duration / frameRate);

  let tick = 0;
  const interval = setInterval(() => {
    tick++;
    el.textContent = chars
      .map((ch, i) => {
        if (ch === ' ') return ' ';
        const revealTick = Math.floor((i * stagger) / frameRate);
        if (tick >= revealTick + totalTicks * 0.4) return ch;
        return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
      })
      .join('');

    if (tick >= totalTicks + Math.ceil((chars.length * stagger) / frameRate)) {
      el.textContent = finalText;
      clearInterval(interval);
    }
  }, frameRate);
}

function initCipherReveals() {
  document.querySelectorAll('[data-cipher]').forEach((el, idx) => {
    setTimeout(() => scrambleReveal(el), idx * 90);
  });
}

/* ---------- Password strength (client-side live meter) ---------- */
function scorePassword(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 14) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_META = [
  { label: 'Too weak', color: 'var(--danger)' },
  { label: 'Weak', color: 'var(--danger)' },
  { label: 'Fair', color: 'var(--warn)' },
  { label: 'Strong', color: 'var(--accent)' },
  { label: 'Excellent', color: 'var(--accent)' },
];

function initStrengthMeters() {
  document.querySelectorAll('[data-strength-input]').forEach((input) => {
    const wrapId = input.dataset.strengthInput;
    const meter = document.querySelector(`[data-strength-meter="${wrapId}"]`);
    const label = document.querySelector(`[data-strength-label="${wrapId}"]`);
    if (!meter) return;
    const bars = meter.querySelectorAll('.strength-bar');

    const update = () => {
      const score = scorePassword(input.value);
      const meta = STRENGTH_META[score];
      bars.forEach((bar, i) => {
        bar.style.background = i <= score - 1 ? meta.color : 'var(--border)';
      });
      if (label) {
        label.textContent = input.value ? meta.label : 'Enter a password to check its strength';
        label.style.color = input.value ? meta.color : 'var(--text-tertiary)';
      }
    };

    input.addEventListener('input', update);
    update();
  });
}

/* ---------- Show/hide password ---------- */
function eyeIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function eyeOffIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.3 20.3 0 0 1 4.22-5.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a20.3 20.3 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>`;
}

function initVisibilityToggles() {
  document.querySelectorAll('[data-toggle-visibility]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.toggleVisibility);
      if (!target) return;
      const isPassword = target.type === 'password';
      target.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword ? eyeOffIcon() : eyeIcon();
    });
  });
}

/* ---------- Copy to clipboard ---------- */
function initCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        showToast('Copied to clipboard', 'success');
      } catch {
        showToast('Could not copy — copy manually', 'error');
      }
    });
  });
}

/* ---------- Toast (with success / error / warn variants) ---------- */
function showToast(message, type = 'success') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"></svg><span class="toast-msg"></span>`;
    document.body.appendChild(toast);
  }

  toast.classList.remove('toast-error', 'toast-warn');
  const icon = toast.querySelector('svg');
  if (type === 'error') {
    toast.classList.add('toast-error');
    icon.innerHTML = '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>';
  } else if (type === 'warn') {
    toast.classList.add('toast-warn');
    icon.innerHTML = '<path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/>';
  } else {
    icon.innerHTML = '<path d="M20 6L9 17l-5-5"/>';
  }

  toast.querySelector('.toast-msg').textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

/* ---------- Mobile nav / sidebar toggle ---------- */
function initNavToggle() {
  const toggle = document.querySelector('.nav-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

/* ---------- Modal handling ---------- */
function openModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

function initModals() {
  document.querySelectorAll('[data-open-modal]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.openModal));
  });
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  });
  // Esc closes any open modal or the command palette
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.show').forEach((o) => o.classList.remove('show'));
    document.getElementById('command-palette')?.classList.remove('show');
  });
}

/* ---------- Login / Register tab switch ---------- */
function initAuthTabs() {
  const tabButtons = document.querySelectorAll('[data-auth-tab]');
  if (!tabButtons.length) return;
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.authTab;
      document.querySelectorAll('[data-auth-panel]').forEach((panel) => {
        panel.style.display = panel.dataset.authPanel === target ? 'block' : 'none';
      });
    });
  });
}

/* ---------- Generic OTP digit-box wiring (used by login OTP + reset OTP) ---------- */
function wireOtpDigitGroup(selector) {
  const inputs = Array.from(document.querySelectorAll(selector));
  if (!inputs.length) return;
  inputs.forEach((input, idx) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (input.value && inputs[idx + 1]) inputs[idx + 1].focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && inputs[idx - 1]) {
        inputs[idx - 1].focus();
      }
    });
  });
}

function initOtpInputs() {
  wireOtpDigitGroup('[data-otp-digit]');
  wireOtpDigitGroup('[data-reset-otp-digit]');
}

function initOtpVerify() {
  const btn = document.getElementById('otp-verify-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const digits = Array.from(document.querySelectorAll('[data-otp-digit]'))
      .map((input) => input.value)
      .join('');

    if (digits.length !== 6) {
      showToast('Enter all 6 digits', 'warn');
      return;
    }

    try {
      const res = await fetch(`${API}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: digits }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Verified — redirecting...', 'success');
        window.location.href = 'dashboard.html';
      } else {
        showToast(data.error || 'Incorrect code', 'error');
      }
    } catch {
      showToast('Server unreachable — check the backend is running', 'error');
    }
  });
}

/* ---------- Forgot password flow ---------- */
function initForgotPassword() {
  const link = document.getElementById('forgot-link');
  const panel = document.getElementById('forgot-password-panel');
  if (!link || !panel) return;

  const stepEmail = document.getElementById('forgot-step-email');
  const stepReset = document.getElementById('forgot-step-reset');

  link.addEventListener('click', (e) => {
    e.preventDefault();
    panel.style.display = 'block';
    stepEmail.style.display = 'block';
    stepReset.style.display = 'none';
    document.getElementById('forgot-email').focus();
  });

  document.getElementById('forgot-cancel-btn').addEventListener('click', () => {
    panel.style.display = 'none';
  });

  document.getElementById('forgot-send-btn').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) {
      showToast('Enter your email', 'warn');
      return;
    }
    try {
      await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      showToast('Check your email (or terminal) for the reset code', 'success');
      stepEmail.style.display = 'none';
      stepReset.style.display = 'block';
      document.querySelector('[data-reset-otp-digit]').focus();
    } catch {
      showToast('Server unreachable — check the backend is running', 'error');
    }
  });

  document.getElementById('reset-submit-btn').addEventListener('click', async () => {
    const digits = Array.from(document.querySelectorAll('[data-reset-otp-digit]'))
      .map((input) => input.value)
      .join('');
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    if (digits.length !== 6) {
      showToast('Enter all 6 digits', 'warn');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords don't match", 'error');
      return;
    }

    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: digits,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Password updated — sign in with your new password', 'success');
        panel.style.display = 'none';
        setTimeout(() => window.location.reload(), 1200);
      } else {
        showToast(data.error || 'Could not reset password', 'error');
      }
    } catch {
      showToast('Server unreachable — check the backend is running', 'error');
    }
  });
}

/* ---------- Password generator ---------- */
function generatePassword({ length = 16, upper = true, numbers = true, symbols = true }) {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upperCh = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';
  const syms = '!@#$%^&*()-_=+[]{}';

  let pool = lower;
  if (upper) pool += upperCh;
  if (numbers) pool += nums;
  if (symbols) pool += syms;

  let result = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) result += pool[array[i] % pool.length];
  return result;
}

function initGenerator() {
  const genBtn = document.querySelector('[data-generate-password]');
  if (!genBtn) return;
  const targetInput = document.getElementById(genBtn.dataset.generatePassword);
  const lengthSlider = document.querySelector('[data-gen-length]');
  const lengthValueEl = document.querySelector('[data-gen-length-value]');
  const upperToggle = document.querySelector('[data-gen-upper]');
  const numToggle = document.querySelector('[data-gen-numbers]');
  const symToggle = document.querySelector('[data-gen-symbols]');

  if (lengthSlider && lengthValueEl) {
    lengthSlider.addEventListener('input', () => {
      lengthValueEl.textContent = lengthSlider.value;
    });
  }

  genBtn.addEventListener('click', () => {
    const pw = generatePassword({
      length: lengthSlider ? parseInt(lengthSlider.value, 10) : 16,
      upper: upperToggle ? upperToggle.checked : true,
      numbers: numToggle ? numToggle.checked : true,
      symbols: symToggle ? symToggle.checked : true,
    });
    if (targetInput) {
      targetInput.value = pw;
      targetInput.type = 'text';
      targetInput.dispatchEvent(new Event('input'));
      showToast('New password generated', 'success');
    }
  });
}

/* ---------- Dashboard search + tag filter chips ---------- */
let activeFilterTag = 'All';
let currentSearchQuery = '';

function applyVaultFilters() {
  document.querySelectorAll('[data-vault-card]').forEach((card) => {
    const matchesSearch = card.dataset.vaultCard.toLowerCase().includes(currentSearchQuery);
    const matchesTag = activeFilterTag === 'All' || card.dataset.vaultTag === activeFilterTag;
    card.style.display = matchesSearch && matchesTag ? '' : 'none';
  });
}

function initVaultSearch() {
  const search = document.querySelector('[data-vault-search]');
  if (search) {
    search.addEventListener('input', () => {
      currentSearchQuery = search.value.trim().toLowerCase();
      applyVaultFilters();
    });
  }

  const chips = document.querySelectorAll('.filter-chip');
  const sidebarTagLinks = document.querySelectorAll('[data-sidebar-tag]');

  const setActiveTag = (tag) => {
    activeFilterTag = tag;
    chips.forEach((c) => c.classList.toggle('active', (c.dataset.tag || 'All') === tag));
    applyVaultFilters();
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => setActiveTag(chip.dataset.tag || 'All'));
  });

  sidebarTagLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setActiveTag(link.dataset.sidebarTag);
      document.querySelector('.toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ---------- Relative time ("2 days ago") ---------- */
function relativeTime(isoString) {
  if (!isoString) return '';
  const then = new Date(isoString + 'Z'); // backend sends naive UTC ISO
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

const STRENGTH_TAG = {
  strong: { label: 'Strong', cls: 'tag-strong' },
  medium: { label: 'Fair', cls: 'tag-medium' },
  weak: { label: 'Weak', cls: 'tag-weak' },
};

/* ---------- Skeleton loading state ---------- */
function renderSkeletons(count = 4) {
  return Array.from({ length: count }).map(() => `
    <div class="panel skeleton-card">
      <div class="skeleton-head">
        <div class="skeleton-avatar"></div>
        <div style="flex:1;">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-line skeleton-sub"></div>
        </div>
      </div>
      <div class="skeleton-line skeleton-row" style="width:100%;"></div>
      <div class="skeleton-line skeleton-row" style="width:70%;"></div>
    </div>
  `).join('');
}

/* ---------- Load real vault entries onto the dashboard ---------- */
async function loadVaultEntries() {
  const grid = document.getElementById('vault-grid');
  if (!grid) return; // not on the dashboard page

  grid.innerHTML = renderSkeletons(4);

  try {
    const res = await fetch(`${API}/api/vault`, { credentials: 'include' });

    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    const data = await res.json();
    const entries = data.entries || [];

    if (entries.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
          <h3>No entries yet</h3>
          <p>Add your first password to see it here.</p>
          <a href="add.html" class="btn btn-primary">Add entry</a>
        </div>`;
      return;
    }

    grid.innerHTML = entries.map((entry, idx) => {
      const initials = entry.site_name.slice(0, 2).toUpperCase();
      const strengthMeta = STRENGTH_TAG[entry.strength] || STRENGTH_TAG.medium;
      return `
        <div class="panel vault-card" style="animation-delay:${idx * 45}ms"
             data-vault-card="${escapeHtml(entry.site_name)} ${escapeHtml(entry.username)}"
             data-vault-tag="${escapeHtml(entry.tag || 'Personal')}">
          <div class="vault-card-head">
            <div class="vault-favicon">${escapeHtml(initials)}</div>
            <div>
              <div class="vault-card-title">${escapeHtml(entry.site_name)}</div>
              <div class="vault-card-sub">${escapeHtml(entry.site_url || '')}</div>
            </div>
          </div>
          <div class="vault-card-body">
            <div class="credential-row">
              <span class="credential-label">User</span>
              <span class="credential-value">${escapeHtml(entry.username)}</span>
              <div class="credential-actions">
                <button class="icon-btn" data-copy="${escapeHtml(entry.username)}" aria-label="Copy username">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
            <div class="credential-row">
              <span class="credential-label">Pass</span>
              <span class="credential-value masked" data-entry-id="${entry.id}" data-revealed="false">••••••••••••</span>
              <div class="credential-actions">
                <button class="icon-btn" data-reveal-entry="${entry.id}" aria-label="Reveal password">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="icon-btn" data-copy-entry="${entry.id}" aria-label="Copy password">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
          </div>
          <div class="vault-card-foot">
            <span class="tag ${strengthMeta.cls}">${strengthMeta.label}</span>
            <span class="text-tertiary mono" style="font-size:11px;">${relativeTime(entry.updated_at)}</span>
            <button class="icon-btn" data-delete-entry="${entry.id}" aria-label="Delete entry">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6h12z"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');

    attachVaultCardHandlers();
    applyVaultFilters();
  } catch {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
        <h3>Could not reach the server</h3>
        <p>Is the backend running at ${API}?</p>
      </div>`;
  }
}

async function revealEntryPassword(entryId) {
  const res = await fetch(`${API}/api/vault/${entryId}/reveal`, { credentials: 'include' });
  if (!res.ok) {
    showToast('Could not reveal password', 'error');
    return null;
  }
  const data = await res.json();
  return data.entry.password;
}

function attachVaultCardHandlers() {
  document.querySelectorAll('[data-reveal-entry]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.revealEntry;
      const valueEl = document.querySelector(`[data-entry-id="${id}"]`);
      if (valueEl.dataset.revealed === 'true') {
        valueEl.textContent = '••••••••••••';
        valueEl.dataset.revealed = 'false';
        return;
      }
      const plain = await revealEntryPassword(id);
      if (plain) {
        valueEl.textContent = plain;
        valueEl.dataset.revealed = 'true';
      }
    });
  });

  document.querySelectorAll('[data-copy-entry]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const plain = await revealEntryPassword(btn.dataset.copyEntry);
      if (plain) {
        await navigator.clipboard.writeText(plain);
        showToast('Password copied to clipboard', 'success');
      }
    });
  });

  document.querySelectorAll('[data-delete-entry]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteEntry;
      if (!confirm('Delete this entry permanently?')) return;
      const res = await fetch(`${API}/api/vault/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        showToast('Entry deleted', 'success');
        loadVaultEntries();
        loadVaultStats();
      } else {
        showToast('Could not delete entry', 'error');
      }
    });
  });
}

/* ---------- Live dashboard stats ---------- */
async function loadVaultStats() {
  const totalEl = document.getElementById('stat-total');
  if (!totalEl) return;

  const label = document.getElementById('entry-count-label');
  try {
    const res = await fetch(`${API}/api/vault/stats`, { credentials: 'include' });
    if (!res.ok) return;
    const stats = await res.json();

    totalEl.textContent = stats.total;
    document.getElementById('stat-strong').textContent = stats.strong;
    document.getElementById('stat-reused').textContent = stats.reused;
    document.getElementById('stat-weak').textContent = stats.weak;

    if (label) {
      label.textContent = `${stats.total} credential${stats.total === 1 ? '' : 's'} · last synced just now`;
    }
  } catch {
    if (label) label.textContent = 'Could not load stats';
  }
}

/* ---------- Security audit page ---------- */
async function loadSecurityAudit() {
  const container = document.getElementById('audit-results');
  if (!container) return;

  try {
    const res = await fetch(`${API}/api/vault/audit`, { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const data = await res.json();
    const flagged = data.flagged || [];

    if (flagged.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <h3>Nothing needs attention</h3>
          <p>Every saved password is strong and unique.</p>
        </div>`;
      return;
    }

    container.innerHTML = flagged.map((entry) => {
      const reasons = [];
      if (entry.strength === 'weak') reasons.push('Weak password');
      if (entry.reused) reasons.push('Reused elsewhere');
      return `
        <div class="panel vault-card" style="margin-bottom:12px;">
          <div class="vault-card-head">
            <div class="vault-favicon">${escapeHtml(entry.site_name.slice(0, 2).toUpperCase())}</div>
            <div>
              <div class="vault-card-title">${escapeHtml(entry.site_name)}</div>
              <div class="vault-card-sub">${escapeHtml(entry.username)}</div>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${reasons.map((r) => `<span class="tag tag-weak">${r}</span>`).join('')}
          </div>
        </div>`;
    }).join('');
  } catch {
    container.innerHTML = `<p class="text-secondary">Could not reach the server.</p>`;
  }
}

/* ---------- Inline validation helpers ---------- */
function setFieldError(fieldEl, message) {
  fieldEl.classList.add('has-error');
  fieldEl.classList.remove('has-success');
  let err = fieldEl.querySelector('.field-error');
  if (!err) {
    err = document.createElement('div');
    err.className = 'field-error';
    fieldEl.appendChild(err);
  }
  err.textContent = message;
}
function clearFieldError(fieldEl) {
  fieldEl.classList.remove('has-error');
  fieldEl.classList.add('has-success');
}

/* ---------- Auth forms ---------- */
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('#login-email').value;
    const password = form.querySelector('#login-password').value;
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        showToast('Password verified — check your email (or terminal) for the code', 'success');
        document.getElementById('otp-section').setAttribute('open', 'true');
        document.querySelector('[data-otp-digit]').focus();
      } else {
        showToast('Invalid email or password', 'error');
      }
    } catch {
      showToast('Server unreachable — check the backend is running', 'error');
    }
  });
}

function initSignupForm() {
  const form = document.getElementById('signup-form');
  if (!form) return;

  const confirmField = form.querySelector('#signup-confirm').closest('.field');
  form.querySelector('#signup-confirm').addEventListener('input', () => {
    const pw = form.querySelector('#signup-password').value;
    const confirm = form.querySelector('#signup-confirm').value;
    if (!confirm) {
      confirmField.classList.remove('has-error', 'has-success');
    } else if (pw !== confirm) {
      setFieldError(confirmField, "Passwords don't match");
    } else {
      clearFieldError(confirmField);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.querySelector('#signup-name').value;
    const email = form.querySelector('#signup-email').value;
    const password = form.querySelector('#signup-password').value;
    const confirm_password = form.querySelector('#signup-confirm').value;

    if (password !== confirm_password) {
      setFieldError(confirmField, "Passwords don't match");
      showToast("Passwords don't match", 'error');
      return;
    }

    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, confirm_password }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Account created — you can now sign in', 'success');
        document.querySelector('[data-auth-tab="signin"]').click();
      } else {
        showToast(data.error || 'Could not create account', 'error');
      }
    } catch {
      showToast('Server unreachable — check the backend is running', 'error');
    }
  });
}

function initAddForm() {
  const form = document.getElementById('add-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      site: form.querySelector('#site-name').value,
      url: form.querySelector('#site-url').value,
      username: form.querySelector('#site-username').value,
      password: form.querySelector('#site-password').value,
      tag: form.querySelector('#site-tag')?.value || 'Personal',
      notes: form.querySelector('#site-notes')?.value || '',
    };
    try {
      const res = await fetch(`${API}/api/vault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast('Entry saved', 'success');
        window.location.href = 'dashboard.html';
      } else if (res.status === 401) {
        window.location.href = 'login.html';
      } else {
        showToast('Could not save entry', 'error');
      }
    } catch {
      showToast('Server unreachable — check the backend is running', 'error');
    }
  });
}

/* ---------- Command palette (Ctrl/Cmd+K) — quick jump to a vault entry ---------- */
function initCommandPalette() {
  const overlay = document.getElementById('command-palette');
  if (!overlay) return; // only present on dashboard-family pages

  const input = document.getElementById('palette-input');
  const results = document.getElementById('palette-results');

  const open = async () => {
    overlay.classList.add('show');
    input.value = '';
    input.focus();
    await renderPaletteResults('');
  };
  const close = () => overlay.classList.remove('show');

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open();
    }
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  let allEntries = null;
  async function renderPaletteResults(query) {
    if (allEntries === null) {
      try {
        const res = await fetch(`${API}/api/vault`, { credentials: 'include' });
        const data = await res.json();
        allEntries = data.entries || [];
      } catch {
        allEntries = [];
      }
    }

    const q = query.trim().toLowerCase();
    const matches = allEntries.filter((e) =>
      e.site_name.toLowerCase().includes(q) || e.username.toLowerCase().includes(q)
    );

    if (matches.length === 0) {
      results.innerHTML = `<div class="palette-empty">No matching entries</div>`;
      return;
    }

    results.innerHTML = matches.slice(0, 8).map((e) => `
      <div class="palette-item" data-goto="${e.id}">
        <div class="palette-item-avatar">${escapeHtml(e.site_name.slice(0, 2).toUpperCase())}</div>
        <div>
          <div class="palette-item-title">${escapeHtml(e.site_name)}</div>
          <div class="palette-item-sub">${escapeHtml(e.username)}</div>
        </div>
      </div>
    `).join('');

    results.querySelectorAll('[data-goto]').forEach((item) => {
      item.addEventListener('click', () => {
        close();
        window.location.href = 'dashboard.html';
      });
    });
  }

  input.addEventListener('input', () => renderPaletteResults(input.value));
}
(function () {
  const security = document.getElementById('security');
  if (!security) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // restart the animation cleanly
        entry.target.classList.remove('steps-in');
        void entry.target.offsetWidth;   // force reflow so CSS re-triggers
        entry.target.classList.add('steps-in');
      } else {
        // reset when it leaves the viewport so it can replay next time
        entry.target.classList.remove('steps-in');
      }
    });
  }, { threshold: 0.4 });

  io.observe(security);
})();
/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initCipherReveals();
  initStrengthMeters();
  initVisibilityToggles();
  initCopyButtons();
  initNavToggle();
  initModals();
  initAuthTabs();
  initOtpInputs();
  initOtpVerify();
  initForgotPassword();
  initGenerator();
  initVaultSearch();
  initLoginForm();
  initSignupForm();
  initAddForm();
  initCommandPalette();
  loadVaultEntries();
  loadVaultStats();
  loadSecurityAudit();
});
/* ---------- Navbar scroll state ---------- */
(function () {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const onScroll = () => {
        navbar.classList.toggle('scrolled', window.scrollY > 12);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
})();
