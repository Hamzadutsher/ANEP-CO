/* ============================================
   ANEP MOD — Authentication
   Login, Session Management, Role-based access
   ============================================ */

// Current user session
let currentUser = null;

async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btnText = document.getElementById('login-btn-text');
    const spinner = document.getElementById('login-spinner');
    
    if (!username || !password) {
        errorEl.textContent = 'Veuillez remplir tous les champs.';
        errorEl.classList.add('show');
        return;
    }
    
    // Show loading
    btnText.style.display = 'none';
    spinner.style.display = 'block';
    errorEl.classList.remove('show');
    
    try {
        // Attempt authentication
        const user = await window.api.auth.login(username, password);
        
        if (user) {
            currentUser = user;

            // Save to sessionStorage
            sessionStorage.setItem('currentUser', JSON.stringify(user));

            // Se souvenir de moi : sauvegarder / effacer les identifiants (localement)
            const remember = document.getElementById('login-remember');
            if (remember && remember.checked) {
                localStorage.setItem('rememberedLogin', JSON.stringify({ username, password }));
            } else {
                localStorage.removeItem('rememberedLogin');
            }

            // Transition to app
            showApp();
        } else {
            errorEl.textContent = 'Identifiants incorrects. Veuillez réessayer.';
            errorEl.classList.add('show');
            document.getElementById('login-password').value = '';
        }
    } catch (err) {
        console.error('Login error:', err);
        errorEl.textContent = 'Erreur de connexion. Veuillez réessayer.';
        errorEl.classList.add('show');
    }
    
    // Hide loading
    btnText.style.display = 'inline';
    spinner.style.display = 'none';
}

function handleLogout() {
    // Mode web : invalider le jeton côté serveur (inoffensif sous Electron)
    if (window.api && window.api.auth && window.api.auth.logout) { try { window.api.auth.logout(); } catch (e) {} }
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    
    // Reset login form
    document.getElementById('login-form').reset();
    document.getElementById('login-error').classList.remove('show');

    // Re-remplir si « Se souvenir de moi » était activé
    loadRememberedCredentials();
    
    // Show login, hide app
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
    const hw = document.getElementById('header-weather'); if (hw) hw.style.display = 'none';
    
    showToast('Déconnexion', 'Vous avez été déconnecté avec succès.', 'info');
}

// Permissions par défaut (permissives) tant que la config n'est pas chargée
window.appSettings = { modules: { paiements: false }, perms: {} };

async function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';

    // Charger les paramètres / permissions gérés par le MOD
    try { window.appSettings = await window.api.settings.get(); } catch (e) { /* défauts */ }

    // Update user info in sidebar
    updateUserUI();

    // Build navigation for role
    buildNavigation(currentUser.role);

    // Restaurer le projet actif (filtre global) si présent
    if (typeof restoreActiveProjet === 'function') restoreActiveProjet();

    // Navigate to dashboard
    navigateTo('dashboard');

    // Sécurité : forcer le changement de mot de passe à la 1re connexion
    if (currentUser && currentUser.must_change_pwd && typeof showForcedPasswordChange === 'function') {
        setTimeout(() => showForcedPasswordChange(), 500);
    }

    // Widget météo dans l'en-tête (chargement en arrière-plan)
    if (typeof updateHeaderWeather === 'function') updateHeaderWeather();

    // Initialize icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function updateUserUI() {
    if (!currentUser) return;
    
    const name = currentUser.role === 'MOD' ? (currentUser.nom || 'Administrateur MOD') : (currentUser.contact_nom || currentUser.raison_sociale);
    const initials = getInitials(name);
    const color = roleColor(currentUser.role);
    
    const avEl = document.getElementById('user-avatar');
    avEl.innerHTML = '';
    avEl.textContent = initials;
    avEl.style.background = color;
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-role').textContent = currentUser.role === 'MOD' ? (currentUser.fonction || 'Maître d\'Ouvrage Délégué') : currentUser.role + ' — ' + (currentUser.raison_sociale || '');

    // Photo (avatar) de l'intervenant si disponible
    if (currentUser.role !== 'MOD' && currentUser.intervenant_id) {
        window.api.intervenants.getAvatar(currentUser.intervenant_id).then(url => {
            if (url) {
                avEl.textContent = '';
                avEl.style.background = 'transparent';
                avEl.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            }
        }).catch(() => {});
    }
}

function loadRememberedCredentials() {
    try {
        const saved = localStorage.getItem('rememberedLogin');
        if (!saved) return;
        const { username, password } = JSON.parse(saved);
        const uEl = document.getElementById('login-username');
        const pEl = document.getElementById('login-password');
        const cb = document.getElementById('login-remember');
        if (uEl) uEl.value = username || '';
        if (pEl) pEl.value = password || '';
        if (cb) cb.checked = true;
    } catch (e) { /* ignore */ }
}

function checkAuth() {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            showApp();
            return true;
        } catch (e) {
            sessionStorage.removeItem('currentUser');
        }
    }
    return false;
}

function isRole(role) {
    return currentUser && currentUser.role === role;
}

function isMOD() {
    return isRole('MOD');
}
