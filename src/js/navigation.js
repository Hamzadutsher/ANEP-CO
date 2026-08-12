/* ============================================
   ANEP MOD — Navigation
   Menu compact : 3 grands titres repliables + sous-titres
   ============================================ */

const NAV_CONFIG = {
    MOD: [
        {
            group: 'Pilotage', icon: 'gauge', sub: [
                {
                    title: '', items: [
                        { id: 'dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
                        { id: 'hub-reporting-journal', icon: 'bar-chart-3', label: 'Reporting & journal' },
                        { id: 'projects', icon: 'building-2', label: 'Projets' },
                        { id: 'hub-acteurs', icon: 'users', label: 'Intervenants & accès' }
                    ]
                }
            ]
        },
        {
            group: 'Chantier', icon: 'hard-hat', sub: [
                {
                    title: '', items: [
                        { id: 'hub-suivi', icon: 'clipboard-check', label: 'Suivi & contrôle' },
                        { id: 'hub-planning', icon: 'calendar-clock', label: 'Planning & délais' },
                        { id: 'hub-chantier', icon: 'calendar-days', label: 'Réunions & permanence' },
                        { id: 'documentation', icon: 'folder', label: 'Documentation & PV' }
                    ]
                }
            ]
        },
        {
            group: 'Finances & Administration', icon: 'settings-2', sub: [
                {
                    title: '', items: [
                        { id: 'paiements', icon: 'banknote', label: 'Décomptes & Paiements' },
                        { id: 'hub-admin', icon: 'sliders-horizontal', label: 'Paramètres & sauvegarde' }
                    ]
                }
            ]
        }
    ]
};

// ---- Espaces intervenants (2 grands titres : Mon espace + Chantier) ----
const ROLE_TASKS = {
    Architecte: [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
        { id: 'taches-arch', icon: 'clipboard-list', label: 'Tâches en attente', badge: 'warning' },
        { id: 'avis-arch', icon: 'check-square', label: 'Mes avis' }
    ],
    BET: [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
        { id: 'missions-bet', icon: 'clipboard-list', label: 'Missions', badge: 'warning' },
        { id: 'rapports-bet', icon: 'file-check', label: 'Rapports' }
    ],
    BCT: [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
        { id: 'validations-bct', icon: 'shield-check', label: 'Validations', badge: 'warning' },
        { id: 'avis-produits', icon: 'package-check', label: 'Avis produits' }
    ],
    Laboratoire: [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
        { id: 'essais-labo', icon: 'flask-conical', label: 'Essais en cours', badge: 'warning' },
        { id: 'resultats-labo', icon: 'file-bar-chart', label: 'Résultats' }
    ],
    Topographe: [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
        { id: 'implantations', icon: 'map-pin', label: 'Implantations', badge: 'warning' }
    ],
    Entreprise: [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
        { id: 'declarations', icon: 'megaphone', label: 'Déclarations' },
        { id: 'betonnage', icon: 'truck', label: 'Bétonnage' },
        { id: 'reserves-ent', icon: 'alert-triangle', label: 'Réserves à lever', badge: 'danger' }
    ]
};

Object.keys(ROLE_TASKS).forEach(role => {
    const chantier = [
        { id: 'permanence', icon: 'user-check', label: 'Permanence chantier' },
        { id: 'documentation', icon: 'folder', label: 'Documentation & PV' }
    ];
    if (role === 'Entreprise') {
        chantier.push({ id: 'meteo', icon: 'cloud-sun-rain', label: 'Météo & intempéries' });
        chantier.push({ id: 'hqse', icon: 'shield-alert', label: 'HQSE & Risques' });
        chantier.push({ id: 'paiements', icon: 'banknote', label: 'Attachements' });
    }
    NAV_CONFIG[role] = [
        { group: 'Mon espace', icon: (typeof roleIcon === 'function' ? roleIcon(role) : 'user'), sub: [{ title: '', items: ROLE_TASKS[role] }] },
        { group: 'Chantier', icon: 'hard-hat', sub: [{ title: '', items: chantier }] }
    ];
});

// Modules optionnels dont l'accès intervenant est réglable par le MOD
const OPTIONAL_MODULES = ['documentation', 'meteo', 'hqse'];

function isNavItemAllowed(role, itemId) {
    const s = window.appSettings || { modules: {}, perms: {} };
    if (itemId === 'paiements') {
        if (!s.modules || !s.modules.paiements) return false;
        if (role === 'MOD') return true;
        return !!(s.perms && s.perms[role] && s.perms[role].attachements);
    }
    if (OPTIONAL_MODULES.includes(itemId) && role !== 'MOD') {
        if (s.perms && s.perms[role] && s.perms[role][itemId] === false) return false;
        return true;
    }
    return true;
}

let currentPage = null;

function buildNavigation(role) {
    const nav = document.getElementById('sidebar-nav');
    const config = NAV_CONFIG[role];
    if (!config) {
        nav.innerHTML = '<div class="empty-state p-lg"><p class="text-muted">Aucune navigation pour ce rôle.</p></div>';
        return;
    }

    let html = '';
    config.forEach((group, gi) => {
        const subs = (group.sub || [])
            .map(s => ({ title: s.title, items: s.items.filter(it => isNavItemAllowed(role, it.id)) }))
            .filter(s => s.items.length);
        if (!subs.length) return;

        html += `<div class="nav-group ${gi > 0 ? 'collapsed' : ''}">
            <div class="nav-group-header" onclick="toggleNavGroup(this)">
                <span class="nav-item-icon"><i data-lucide="${group.icon}"></i></span>
                <span class="nav-group-title">${group.group}</span>
                <span class="nav-chevron"><i data-lucide="chevron-down"></i></span>
            </div>
            <div class="nav-group-body">`;
        subs.forEach(s => {
            if (s.title) html += `<div class="nav-subtitle">${s.title}</div>`;
            s.items.forEach(item => {
                html += `
                    <div class="nav-item ripple" data-page="${item.id}" onclick="navigateTo('${item.id}')">
                        <span class="nav-item-icon"><i data-lucide="${item.icon}"></i></span>
                        <span class="nav-item-text">${item.label}</span>
                        ${item.badge ? `<span class="nav-item-badge ${item.badge}" id="nav-badge-${item.id}"></span>` : ''}
                    </div>`;
            });
        });
        html += `</div></div>`;
    });

    nav.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: nav });
}

function toggleNavGroup(header) {
    header.parentElement.classList.toggle('collapsed');
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: header });
}

function setActiveNav(pageId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageId);
    });
    // Accordéon : déplier le groupe de la page active, replier les autres
    const active = document.querySelector(`.nav-item.active[data-page="${pageId}"]`);
    if (active) {
        const grp = active.closest('.nav-group');
        if (grp) {
            document.querySelectorAll('.nav-group').forEach(g => { if (g !== grp) g.classList.add('collapsed'); });
            grp.classList.remove('collapsed');
        }
    }
}

function navigateTo(pageId, params = {}) {
    currentPage = pageId;
    setActiveNav(pageId);
    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="d-flex align-center justify-center h-full"><div class="spinner"></div></div>';
    renderPage(pageId, params);
}

function updatePageTitle(title) {
    document.getElementById('page-title').textContent = title;
}

async function toggleNotifications() {
    if (!currentUser) return;
    try {
        const role = currentUser.role;
        const intervenantId = currentUser.intervenant_id || null;
        const notifications = await window.api.notifications.get(role, intervenantId);

        let html = '<div style="max-height: 400px; overflow-y: auto;">';
        if (notifications.length === 0) {
            html += '<div class="empty-state p-lg"><p class="text-muted">Aucune notification</p></div>';
        } else {
            notifications.forEach(n => {
                const typeIcon = { info: 'info', alerte: 'alert-triangle', urgent: 'alert-circle', succes: 'check-circle' };
                const typeColor = { info: 'var(--info)', alerte: 'var(--warning)', urgent: 'var(--danger)', succes: 'var(--success)' };
                html += `
                    <div class="d-flex gap-md align-start p-md" style="border-bottom: 1px solid var(--border-color); ${n.lue ? 'opacity: 0.6;' : ''}">
                        <span style="color: ${typeColor[n.type_notif] || 'var(--info)'}; margin-top: 2px;">
                            <i data-lucide="${typeIcon[n.type_notif] || 'info'}"></i>
                        </span>
                        <div class="flex-1">
                            <div class="font-semibold text-sm">${n.titre}</div>
                            <div class="text-xs text-secondary mt-sm">${n.message}</div>
                            <div class="text-xs text-muted mt-sm">${formatDateRelative(n.created_at)}</div>
                        </div>
                    </div>`;
            });
        }
        html += '</div>';

        openModal('Notifications', html, '<button class="btn btn-ghost btn-sm" onclick="closeModal()">Fermer</button>');

        for (const n of notifications.filter(n => !n.lue)) {
            await window.api.notifications.markRead(n.id);
        }
        updateNotifCount();
    } catch (err) {
        console.error('Error fetching notifications:', err);
    }
}

async function updateNotifCount() {
    if (!currentUser) return;
    try {
        const count = await window.api.notifications.unreadCount(currentUser.role, currentUser.intervenant_id);
        const el = document.getElementById('notif-count');
        if (count > 0) {
            el.textContent = count > 9 ? '9+' : count;
            el.style.display = 'flex';
        } else {
            el.style.display = 'none';
        }
    } catch (err) {
        console.error(err);
    }
}
