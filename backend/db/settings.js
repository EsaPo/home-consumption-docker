// settings.js

// Load profile data when settings page is shown
async function loadSettingsProfile() {
    const user = getUser();
    if (!user) return;

    // Fetch fresh user data from server to get is_admin reliably
    try {
        const res = await fetch('/auth/verify', { headers: authHeaders() });
        const data = await res.json();
        if (data.user) {
            const stored = getUser() || {};
            const fresh = { ...stored, ...data.user };
            localStorage.setItem('authUser', JSON.stringify(fresh));

            const adminCard = document.getElementById('adminCard');
            if (adminCard) {
                if (fresh.is_admin) {
                    adminCard.style.display = 'block';
                    loadAdminUsers();
                } else {
                    adminCard.style.display = 'none';
                }
            }
        }
    } catch {}

    document.getElementById('profileName').textContent    = user.name  || '-';
    document.getElementById('profileEmail').textContent   = user.email || '-';
    document.getElementById('settingsName').value         = user.name  || '';
    document.getElementById('settingsEmail').value        = user.email || '';

    // Fetch full profile from server (has created_at)
    fetch('/auth/profile', { headers: authHeaders() })
        .then(r => r.json())
        .then(data => {
            if (data.user && data.user.created_at) {
                const d = new Date(data.user.created_at);
                document.getElementById('profileCreated').textContent =
                    d.toLocaleDateString('fi-FI', { year: 'numeric', month: 'long', day: 'numeric' });
            }
        })
        .catch(() => {});
}

// ── Save profile (name + email) ───────────────────────────────────────────────
async function saveProfile() {
    const name  = document.getElementById('settingsName').value.trim();
    const email = document.getElementById('settingsEmail').value.trim();

    if (!name || !email) { showError('Nimi ja sähköposti ovat pakollisia.'); return; }

    try {
        const res  = await fetch('/auth/profile', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ name, email })
        });
        const data = await res.json();

        if (!res.ok) { showError(data.error || 'Tallennus epäonnistui.'); return; }

        // Update localStorage
        const user = getUser();
        user.name  = name;
        user.email = email;
        localStorage.setItem('authUser', JSON.stringify(user));

        // Update navbar
        const userEl = document.getElementById('loggedInUser');
        if (userEl) userEl.textContent = name;

        // Update profile display
        document.getElementById('profileName').textContent  = name;
        document.getElementById('profileEmail').textContent = email;

        showSuccess('Profiili päivitetty!');
    } catch {
        showError('Verkkovirhe.');
    }
}

// ── Change password ───────────────────────────────────────────────────────────
async function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const next    = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (!current || !next || !confirm) { showError('Täytä kaikki salasanakentät.'); return; }
    if (next.length < 8)               { showError('Uuden salasanan tulee olla vähintään 8 merkkiä.'); return; }
    if (next !== confirm)              { showError('Uudet salasanat eivät täsmää.'); return; }

    try {
        const res  = await fetch('/auth/password', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ currentPassword: current, newPassword: next })
        });
        const data = await res.json();

        if (!res.ok) { showError(data.error || 'Salasanan vaihto epäonnistui.'); return; }

        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value     = '';
        document.getElementById('confirmPassword').value = '';
        showSuccess('Salasana vaihdettu!');
    } catch {
        showError('Verkkovirhe.');
    }
}

// ── Delete account ────────────────────────────────────────────────────────────
function confirmDeleteAccount() {
    const modal = document.getElementById('deleteAccountModal');
    if (modal) {
        modal.style.display = 'block';
        setTimeout(() => modal.classList.add('show'), 10);
    }
}

function closeDeleteAccountModal() {
    const modal = document.getElementById('deleteAccountModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

async function executeDeleteAccount() {
    try {
        const res = await fetch('/auth/account', {
            method: 'DELETE',
            headers: authHeaders()
        });

        if (!res.ok) {
            const data = await res.json();
            showError(data.error || 'Tilin poisto epäonnistui.');
            return;
        }

        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        window.location.href = '/login.html';
    } catch {
        showError('Verkkovirhe.');
    }
}

// Close modal on outside click
window.addEventListener('click', e => {
    const modal = document.getElementById('deleteAccountModal');
    if (modal && e.target === modal) closeDeleteAccountModal();
});

// ── Load email settings ───────────────────────────────────────────────────────
async function loadEmailSettings() {
    try {
        const res  = await fetch('/auth/email-settings', { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok || !data.settings) return;

        const s = data.settings;
        document.getElementById('emailEnabled').checked      = !!s.enabled;
        document.getElementById('emailHost').value           = s.host        || '';
        document.getElementById('emailPort').value           = s.port        || 587;
        document.getElementById('emailSecure').checked       = !!s.secure;
        document.getElementById('emailUser').value           = s.user        || '';
        document.getElementById('emailFromName').value       = s.from_name   || '';
        document.getElementById('emailFromEmail').value      = s.from_email  || '';
        document.getElementById('emailFrontendUrl').value    = s.frontend_url|| '';
    } catch {}
}

// ── Save email settings ───────────────────────────────────────────────────────
async function saveEmailSettings() {
    const body = {
        enabled:      document.getElementById('emailEnabled').checked ? 1 : 0,
        host:         document.getElementById('emailHost').value.trim(),
        port:         parseInt(document.getElementById('emailPort').value) || 587,
        secure:       document.getElementById('emailSecure').checked ? 1 : 0,
        user:         document.getElementById('emailUser').value.trim(),
        from_name:    document.getElementById('emailFromName').value.trim(),
        from_email:   document.getElementById('emailFromEmail').value.trim(),
        frontend_url: document.getElementById('emailFrontendUrl').value.trim(),
    };
    const pass = document.getElementById('emailPass').value;
    if (pass) body.pass = pass;

    try {
        const res  = await fetch('/auth/email-settings', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error || 'Tallennus epäonnistui.'); return; }
        document.getElementById('emailPass').value = '';
        showSuccess('Sähköpostiasetukset tallennettu!');
    } catch {
        showError('Verkkovirhe.');
    }
}

// ── Test email connection ─────────────────────────────────────────────────────
async function testEmail() {
    try {
        const res  = await fetch('/auth/test-email', {
            method: 'POST',
            headers: authHeaders()
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error); return; }
        showSuccess(data.message);
    } catch {
        showError('Verkkovirhe.');
    }
}

// ── Load all users (admin) ────────────────────────────────────────────────────
async function loadAdminUsers() {
    try {
        const res  = await fetch('/auth/users', { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) return;

        const me = getUser();
        const container = document.getElementById('userListContainer');
        if (!container) return;

        if (!data.users || data.users.length === 0) {
            container.innerHTML = '<p style="padding:1rem 1.5rem;color:var(--text-2);font-size:0.88rem">Ei käyttäjiä.</p>';
            return;
        }

        const rows = data.users.map(u => `
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:10px 20px;border-bottom:1px solid var(--border);gap:8px;flex-wrap:wrap">
                <div>
                    <div style="font-weight:600;font-size:0.9rem;color:var(--text)">${escapeHtml(u.name)}
                        ${u.is_admin ? '<span style="background:#dbeafe;color:#1d4ed8;font-size:0.72rem;padding:1px 7px;border-radius:50px;margin-left:6px;font-weight:600">ADMIN</span>' : ''}
                        ${u.id === me.id ? '<span style="background:var(--surface-2);color:var(--text-3);font-size:0.72rem;padding:1px 7px;border-radius:50px;margin-left:4px">sinä</span>' : ''}
                    </div>
                    <div style="font-size:0.8rem;color:var(--text-2)">${escapeHtml(u.email)}</div>
                </div>
                ${u.id !== me.id ? `
                <div style="display:flex;gap:6px">
                    <button class="settings-btn" style="padding:5px 12px;font-size:0.78rem;margin:0"
                        onclick="toggleAdminRole(${u.id}, ${u.is_admin ? 0 : 1}, '${escapeHtml(u.name)}')">
                        ${u.is_admin ? '⬇️ Poista admin' : '⬆️ Tee admin'}
                    </button>
                    <button class="settings-btn-danger" style="padding:5px 12px;font-size:0.78rem;margin:0"
                        onclick="deleteUser(${u.id}, '${escapeHtml(u.name)}')">
                        🗑️
                    </button>
                </div>` : ''}
            </div>
        `).join('');

        container.innerHTML = rows;
    } catch {
        showError('Käyttäjien lataus epäonnistui.');
    }
}

async function toggleAdminRole(userId, newRole, name) {
    if (!confirm(`${newRole ? 'Tee ' + name + ' pääkäyttäjäksi?' : 'Poista ' + name + ' pääkäyttäjäoikeudet?'}`)) return;
    try {
        const res  = await fetch(`/auth/users/${userId}/role`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ is_admin: newRole })
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error); return; }
        showSuccess(data.message);
        loadAdminUsers();
    } catch {
        showError('Verkkovirhe.');
    }
}

async function deleteUser(userId, name) {
    if (!confirm(`Poista käyttäjä "${name}" pysyvästi?`)) return;
    try {
        const res  = await fetch(`/auth/users/${userId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error); return; }
        showSuccess(data.message);
        loadAdminUsers();
    } catch {
        showError('Verkkovirhe.');
    }
}
