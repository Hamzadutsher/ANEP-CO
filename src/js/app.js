/* ============================================
   ANEP MOD — Application Principal
   SPA Router + Page Renderers
   ============================================ */

// ---- App Initialization ----
document.addEventListener('DOMContentLoaded', () => {
    // Police unifiée pour les graphiques (Chart.js) : Microsoft Sans Serif
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";
        Chart.defaults.color = '#46587a';
    }

    // Attach login handler
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Check for existing session
    if (!checkAuth()) {
        document.getElementById('login-screen').style.display = 'flex';
        // Pré-remplir si « Se souvenir de moi » était coché
        loadRememberedCredentials();
    }
    
    // Update notification count periodically
    setInterval(updateNotifCount, 30000);
});

// ---- SPA Router ----
async function renderPage(pageId, params = {}) {
    const content = document.getElementById('page-content');
    
    try {
        switch (pageId) {
            case 'dashboard':
                await renderDashboard(content);
                break;
            case 'projects':
                await renderProjects(content);
                break;
            case 'project-detail':
                await renderProjectDetail(content, params.id);
                break;
            case 'intervenants':
                await renderIntervenants(content);
                break;
            case 'sessions':
                await renderSessions(content);
                break;
            case 'workflow':
                await renderWorkflow(content);
                break;
            case 'delais':
                await renderDelais(content);
                break;
            case 'ordres-service':
                await renderOrdresService(content);
                break;
            case 'reserves':
                await renderReserves(content);
                break;
            case 'essais':
                await renderEssais(content);
                break;
            case 'reunions':
                await renderReunions(content);
                break;
            case 'reporting':
                await renderReporting(content);
                break;
            case 'journal':
                await renderJournal(content);
                break;
            case 'comptes-rendus':
                await renderComptesRendus(content);
                break;
            case 'permanence':
                await renderPermanence(content);
                break;
            case 'meteo':
                await renderMeteo(content);
                break;
            case 'paiements':
                await renderPaiements(content);
                break;
            case 'hqse':
                await renderHqse(content);
                break;
            case 'documentation':
                await renderDocumentationHub(content);
                break;
            // ---- Hubs de catégorie (modules fusionnés) ----
            case 'hub-reporting-journal':
                await renderReportingHub(content);
                break;
            case 'hub-acteurs':
                await renderActeursHub(content);
                break;
            case 'hub-suivi':
                await renderSuiviHub(content);
                break;
            case 'hub-planning':
                await renderPlanningHub(content);
                break;
            case 'hub-chantier':
                await renderChantierHub(content);
                break;
            case 'hub-admin':
                await renderAdminHub(content);
                break;
            case 'documents':
                await renderDocuments(content);
                break;
            case 'phototheque':
                await renderPhototheque(content);
                break;
            case 'parametres':
                await renderParametres(content);
                break;
            case 'sauvegarde':
                await renderBackup(content);
                break;
            // Intervenant-specific pages
            case 'taches-arch':
            case 'missions-bet':
            case 'validations-bct':
            case 'implantations':
                await renderIntervenantTasks(content, pageId);
                break;
            case 'avis-arch':
            case 'rapports-bet':
            case 'avis-produits':
            case 'resultats-labo':
                await renderIntervenantHistory(content, pageId);
                break;
            case 'essais-labo':
                await renderLaboEssais(content);
                break;
            case 'declarations':
                await renderEntrepriseDeclarations(content);
                break;
            case 'betonnage':
                await renderEntrepriseBetonnage(content);
                break;
            case 'reserves-ent':
                await renderEntrepriseReserves(content);
                break;
            default:
                content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚧</div><h4>Page en construction</h4><p>Cette fonctionnalité sera bientôt disponible.</p></div>`;
        }
    } catch (err) {
        console.error(`Error rendering page ${pageId}:`, err);
        content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><h4>Erreur</h4><p>${err.message}</p></div>`;
    }
    
    // Re-render icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ node: content });
    }
    
    // Scroll to top
    content.scrollTop = 0;
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderDashboard(container) {
    const role = currentUser.role;

    if (role === 'MOD') {
        await renderMODDashboard(container);
    } else {
        await renderIntervenantDashboard(container, role);
    }
}

// ---- Projet actif : filtre global appliqué à tous les modules ----
const PROJET_FILTER_KEYS = ['_paiementProjet', '_osProjet', '_meteoProjet', '_axeProjet', '_illuProjet', '_photoProjet', '_crProjet', '_interfaceProjet', '_delaisProjet'];
function setActiveProjet(id) {
    id = parseInt(id);
    if (!id) return;
    window._activeProjet = id;
    PROJET_FILTER_KEYS.forEach(k => { window[k] = id; });
    try { sessionStorage.setItem('anep_activeProjet', String(id)); } catch (e) {}
}
function restoreActiveProjet() {
    try { const v = parseInt(sessionStorage.getItem('anep_activeProjet')); if (v) setActiveProjet(v); } catch (e) {}
}
function selectProjetFromDashboard(id) {
    setActiveProjet(id);
    navigateTo('project-detail', { id: parseInt(id) });
}
function clearActiveProjet() {
    window._activeProjet = null;
    PROJET_FILTER_KEYS.forEach(k => { window[k] = undefined; });
    try { sessionStorage.removeItem('anep_activeProjet'); } catch (e) {}
    navigateTo('dashboard');
}

async function renderMODDashboard(container) {
    updatePageTitle('Dashboard');
    
    const stats = await window.api.dashboard.getStats();
    const projets = await window.api.projets.getAll();
    const reservesOuvertes = await window.api.reserves.getOuvertes();
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div>
                <h2>Bienvenue, Administrateur</h2>
                <p>Vue d'ensemble de vos projets en maîtrise d'ouvrage déléguée</p>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="showNewProjectModal()">
                    <i data-lucide="plus"></i> Nouveau Projet
                </button>
            </div>
        </div>
        
        <!-- PROJETS : élément prioritaire — cliquez une carte pour piloter et filtrer toute l'application -->
        <div class="card animate-fade-in-up" style="border:1px solid var(--border-color);">
            <div class="card-header">
                <h4><i data-lucide="building-2" style="width:18px;height:18px;margin-right:8px;"></i>Vos projets — cliquez pour piloter & filtrer</h4>
                ${window._activeProjet ? `<button class="btn btn-ghost btn-sm" onclick="clearActiveProjet()"><i data-lucide="x"></i> Filtre : ${(projets.find(p => p.id === window._activeProjet) || {}).code_projet || ''}</button>` : ''}
            </div>
            <div class="card-body">
                <div class="content-grid-3">
                    ${projets.map(p => `
                        <div class="card" style="cursor:pointer;border:2px solid ${p.id === window._activeProjet ? 'var(--primary)' : 'var(--border-color)'};" onclick="selectProjetFromDashboard(${p.id})">
                            <div class="d-flex justify-between align-center mb-sm">
                                <span class="badge badge-primary">${p.code_projet}</span>
                                ${statusBadge(p.statut)}
                            </div>
                            <h4 class="mb-sm" style="font-size:var(--text-md);">${p.intitule}</h4>
                            <div class="d-flex gap-lg text-xs text-muted mb-sm">
                                <span><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${p.localisation || '—'}</span>
                                <span><i data-lucide="layers" style="width:12px;height:12px;"></i> ${p.nb_lots || 0} lots</span>
                            </div>
                            ${progressBar(p.taux_avancement)}
                            <div class="d-flex justify-between mt-sm text-xs text-muted"><span>${formatCurrency(p.montant_marche)}</span><span>${p.taux_avancement}%</span></div>
                        </div>
                    `).join('') || '<div class="empty-state p-lg"><p class="text-muted">Aucun projet. Créez votre premier projet.</p></div>'}
                </div>
            </div>
        </div>

        <!-- Stats Grid -->
        <div class="stats-grid mt-lg">
            <div class="stat-card stat-primary animate-fade-in-up delay-1">
                <div class="stat-icon icon-primary"><i data-lucide="building-2"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${stats.totalProjets}</div>
                    <div class="stat-label">Projets Total</div>
                    <div class="stat-trend up">↑ ${stats.projetsEnCours} en cours</div>
                </div>
            </div>
            <div class="stat-card stat-secondary animate-fade-in-up delay-2">
                <div class="stat-icon icon-secondary"><i data-lucide="wallet"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${formatCurrency(stats.montantTotal)}</div>
                    <div class="stat-label">Enveloppe Totale</div>
                </div>
            </div>
            <div class="stat-card stat-info animate-fade-in-up delay-3">
                <div class="stat-icon icon-info"><i data-lucide="layers"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${stats.totalLots}</div>
                    <div class="stat-label">Lots Actifs</div>
                    <div class="stat-trend up">${stats.lotsEnCours} en cours</div>
                </div>
            </div>
            <div class="stat-card stat-success animate-fade-in-up delay-4">
                <div class="stat-icon icon-success"><i data-lucide="users"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${stats.totalIntervenants}</div>
                    <div class="stat-label">Intervenants</div>
                </div>
            </div>
        </div>

        <!-- Content Grid -->
        <div class="content-grid-2">
            <!-- Projects List -->
            <div class="card animate-fade-in-up delay-3">
                <div class="card-header">
                    <h4><i data-lucide="building-2" style="width:18px;height:18px;margin-right:8px;"></i>Projets en cours</h4>
                    <button class="btn btn-ghost btn-sm" onclick="navigateTo('projects')">Voir tout</button>
                </div>
                <div class="card-body">
                    ${projets.filter(p => p.statut === 'En cours').map(p => `
                        <div class="d-flex align-center gap-md p-md" style="border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="navigateTo('project-detail', {id: ${p.id}})">
                            <div class="flex-1">
                                <div class="font-semibold text-sm">${p.intitule}</div>
                                <div class="text-xs text-muted mt-sm">${p.code_projet} — ${p.localisation || ''}</div>
                                <div class="mt-sm">${progressBar(p.taux_avancement, false)}</div>
                            </div>
                            <div class="text-right">
                                <div class="font-bold text-sm">${p.taux_avancement}%</div>
                                <div class="text-xs text-muted">${p.nb_lots || 0} lots</div>
                            </div>
                        </div>
                    `).join('') || '<div class="empty-state p-lg"><p class="text-muted">Aucun projet en cours</p></div>'}
                </div>
            </div>

            <!-- Reserves -->
            <div class="card animate-fade-in-up delay-4">
                <div class="card-header">
                    <h4><i data-lucide="alert-triangle" style="width:18px;height:18px;margin-right:8px;color:var(--warning-light);"></i>Réserves ouvertes</h4>
                    <button class="btn btn-ghost btn-sm" onclick="navigateTo('reserves')">Voir tout</button>
                </div>
                <div class="card-body" style="max-height: 350px; overflow-y: auto;">
                    ${reservesOuvertes.length > 0 ? reservesOuvertes.slice(0, 8).map(r => `
                        <div class="d-flex align-center gap-md p-sm" style="border-bottom: 1px solid var(--border-color);">
                            <div class="flex-1">
                                <div class="text-sm font-medium">${r.description}</div>
                                <div class="text-xs text-muted mt-sm">${r.ouvrage_nom} — ${r.bloc || ''} ${r.niveau || ''}</div>
                            </div>
                            <div>${graviteBadge(r.gravite)}</div>
                        </div>
                    `).join('') : '<div class="empty-state p-lg"><div class="empty-state-icon" style="width:48px;height:48px;font-size:1.2rem;">✅</div><p class="text-muted text-sm">Aucune réserve ouverte</p></div>'}
                </div>
            </div>
        </div>

        <!-- Avancement Chart -->
        <div class="card mt-lg animate-fade-in-up delay-5">
            <div class="card-header">
                <h4><i data-lucide="bar-chart-3" style="width:18px;height:18px;margin-right:8px;"></i>Avancement des Projets</h4>
            </div>
            <div class="card-body">
                <canvas id="chart-avancement" height="80"></canvas>
            </div>
        </div>
    `;
    
    // Render chart
    setTimeout(() => renderAvancementChart(projets), 100);
}

function renderAvancementChart(projets) {
    const ctx = document.getElementById('chart-avancement');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: projets.map(p => p.code_projet),
            datasets: [{
                label: 'Avancement (%)',
                data: projets.map(p => p.taux_avancement),
                backgroundColor: projets.map((p, i) => {
                    const colors = ['rgba(26, 58, 107, 0.7)', 'rgba(212, 168, 67, 0.7)', 'rgba(0, 137, 123, 0.7)', 'rgba(21, 101, 192, 0.7)'];
                    return colors[i % colors.length];
                }),
                borderColor: projets.map((p, i) => {
                    const colors = ['rgb(42, 82, 152)', 'rgb(212, 168, 67)', 'rgb(0, 137, 123)', 'rgb(21, 101, 192)'];
                    return colors[i % colors.length];
                }),
                borderWidth: 1,
                borderRadius: 6,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 25, 35, 0.95)',
                    titleColor: '#e8edf3',
                    bodyColor: '#8fa4bd',
                    borderColor: 'rgba(42, 82, 152, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        title: (items) => {
                            const p = projets[items[0].dataIndex];
                            return p.intitule;
                        },
                        label: (item) => `Avancement: ${item.raw}%`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(26, 58, 107, 0.08)' },
                    ticks: { color: '#46587a', callback: v => v + '%' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#46587a' }
                }
            }
        }
    });
}

const ROLE_MISSIONS = {
    Architecte: { mission: 'Vérification des réservations, alignement, conformité architecturale et visa des ouvrages.', links: [['taches-arch', 'clipboard-list', 'Tâches en attente'], ['avis-arch', 'check-square', 'Mes avis'], ['comptes-rendus', 'clipboard-pen-line', 'Comptes rendus'], ['phototheque', 'images', 'Photothèque']] },
    BET: { mission: 'Réception du coffrage/ferraillage, notes de calcul et validation structurelle.', links: [['missions-bet', 'clipboard-list', 'Missions'], ['rapports-bet', 'file-check', 'Mes rapports'], ['documents', 'folder', 'Notes de calcul'], ['comptes-rendus', 'clipboard-pen-line', 'Comptes rendus']] },
    BCT: { mission: 'Contrôle technique réglementaire, validation des produits et sécurité de l\'ouvrage.', links: [['validations-bct', 'shield-check', 'Validations'], ['avis-produits', 'package-check', 'Avis produits'], ['hqse', 'shield-alert', 'HQSE'], ['documents', 'folder', 'Documents']] },
    Laboratoire: { mission: 'Contrôle qualité : essais béton (7j/28j), compactage, granulométrie — résultats dans les délais normatifs.', links: [['essais-labo', 'flask-conical', 'Essais en cours'], ['resultats-labo', 'file-bar-chart', 'Résultats'], ['documents', 'folder', 'PV d\'essais'], ['phototheque', 'images', 'Photothèque']] },
    Topographe: { mission: 'Implantation, nivellement et attestations topographiques.', links: [['implantations', 'map-pin', 'Implantations'], ['documents', 'folder', 'Documents'], ['phototheque', 'images', 'Photothèque'], ['comptes-rendus', 'clipboard-pen-line', 'Comptes rendus']] },
    Entreprise: { mission: 'Exécution des travaux, déclarations d\'achèvement et de bétonnage, levée des réserves.', links: [['declarations', 'megaphone', 'Déclarations'], ['betonnage', 'truck', 'Bétonnage'], ['reserves-ent', 'alert-triangle', 'Réserves'], ['hqse', 'shield-alert', 'HQSE']] }
};

async function renderIntervenantDashboard(container, role) {
    updatePageTitle('Dashboard ' + role);
    const pending = await window.api.workflow.getPending(role, currentUser.intervenant_id);
    const today = new Date().toISOString().split('T')[0];
    const info = ROLE_MISSIONS[role] || { mission: '', links: [] };

    // Présence du jour
    let permToday = null;
    try { if (currentUser.projet_id) permToday = await window.api.permanence.getToday(currentUser.intervenant_id, currentUser.projet_id, today); } catch (e) {}

    // KPI spécifique au rôle
    let kpiExtra = '';
    try {
        if (role === 'Laboratoire') {
            const essais = await window.api.essais.getEnCours(currentUser.intervenant_id);
            const enRetard = essais.filter(e => isOverdue(e.date_echeance_7j) || isOverdue(e.date_echeance_28j)).length;
            kpiExtra = `<div class="stat-card stat-danger animate-fade-in-up delay-3"><div class="stat-icon icon-danger"><i data-lucide="flask-conical"></i></div><div class="stat-content"><div class="stat-value">${essais.length}</div><div class="stat-label">Essais en cours${enRetard ? ` · ${enRetard} en retard` : ''}</div></div></div>`;
        } else if (['Architecte', 'BET', 'BCT'].includes(role)) {
            const avis = await window.api.avis.getByIntervenant(currentUser.intervenant_id);
            kpiExtra = `<div class="stat-card stat-success animate-fade-in-up delay-3"><div class="stat-icon icon-success"><i data-lucide="check-square"></i></div><div class="stat-content"><div class="stat-value">${avis.length}</div><div class="stat-label">Avis émis</div></div></div>`;
        }
    } catch (e) {}

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Espace ${role}</h2><p>${currentUser.raison_sociale || ''}</p></div>
        </div>

        <div class="card card-flat mb-lg animate-fade-in-up" style="border-left:4px solid var(--primary);">
            <div class="d-flex align-center gap-md">
                <span style="color:var(--primary);"><i data-lucide="${roleIcon(role)}" style="width:28px;height:28px;"></i></span>
                <div><div class="font-semibold">Votre mission</div><div class="text-sm text-secondary">${info.mission}</div></div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card stat-warning animate-fade-in-up delay-1"><div class="stat-icon icon-warning"><i data-lucide="clock"></i></div><div class="stat-content"><div class="stat-value">${pending.length}</div><div class="stat-label">Tâches en attente</div></div></div>
            <div class="stat-card ${permToday && permToday.present ? 'stat-success' : 'stat-info'} animate-fade-in-up delay-2" style="cursor:pointer;" onclick="navigateTo('permanence')">
                <div class="stat-icon ${permToday && permToday.present ? 'icon-success' : 'icon-info'}"><i data-lucide="user-check"></i></div>
                <div class="stat-content"><div class="stat-value" style="font-size:1.1rem;">${permToday ? (permToday.present ? 'Présent ✓' : 'Absent') : 'À pointer'}</div><div class="stat-label">Permanence du jour</div></div>
            </div>
            ${kpiExtra}
        </div>

        <div class="content-grid-4 mb-lg animate-fade-in-up delay-3">
            ${info.links.map(([id, icon, label]) => `
                <div class="card" style="cursor:pointer;text-align:center;padding:var(--space-lg);" onclick="navigateTo('${id}')">
                    <div class="stat-icon icon-primary" style="margin:0 auto 10px;"><i data-lucide="${icon}"></i></div>
                    <div class="font-medium text-sm">${label}</div>
                </div>
            `).join('')}
        </div>

        <div class="card animate-fade-in-up delay-4">
            <div class="card-header"><h4><i data-lucide="clipboard-list" style="width:18px;height:18px;margin-right:8px;"></i>Tâches en attente</h4></div>
            <div class="card-body">
                ${pending.length > 0 ? `
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead><tr><th>Projet</th><th>Ouvrage</th><th>Étape</th><th>Statut</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${pending.map(e => `
                                    <tr>
                                        <td><div class="font-medium">${e.projet_nom}</div><div class="text-xs text-muted">${e.code_lot}</div></td>
                                        <td><div>${e.ouvrage_nom}</div><div class="text-xs text-muted">${e.bloc || ''} ${e.niveau || ''}</div></td>
                                        <td>${e.type_etape}</td>
                                        <td>${statusBadge(e.statut)}</td>
                                        <td class="actions"><button class="btn btn-primary btn-sm" onclick="showSubmitAvisModal(${e.id}, '${e.type_etape}', ${e.ouvrage_id})"><i data-lucide="send"></i> Soumettre</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><div class="empty-state-icon">✅</div><h4>Aucune tâche en attente</h4><p>Toutes vos missions ont été traitées.</p></div>'}
            </div>
        </div>
    `;
}

// ============================================================
// PROJECTS
// ============================================================
async function renderProjects(container) {
    updatePageTitle('Projets');
    const projets = await window.api.projets.getAll();
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div>
                <h2>Gestion des Projets</h2>
                <p>${projets.length} projet(s) enregistré(s)</p>
            </div>
            <button class="btn btn-primary" onclick="showNewProjectModal()">
                <i data-lucide="plus"></i> Nouveau Projet
            </button>
        </div>
        
        <div class="content-grid-3 animate-fade-in-up delay-1">
            ${projets.map((p, i) => `
                <div class="card" style="cursor: pointer; animation-delay: ${0.1 * (i + 1)}s;" onclick="navigateTo('project-detail', {id: ${p.id}})">
                    <div class="d-flex justify-between align-center mb-md">
                        <span class="badge badge-primary">${p.code_projet}</span>
                        <div class="d-flex align-center gap-sm">
                            ${statusBadge(p.statut)}
                            <button class="btn btn-ghost btn-sm" title="Modifier" onclick="event.stopPropagation(); editProject(${p.id})"><i data-lucide="pencil"></i></button>
                            <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="event.stopPropagation(); deleteProject(${p.id}, '${(p.intitule || '').replace(/'/g, ' ')}')"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                    <h4 class="mb-sm" style="font-size: var(--text-md);">${p.intitule}</h4>
                    <p class="text-sm text-muted mb-md">${p.maitre_ouvrage}</p>
                    <div class="d-flex gap-lg text-xs text-muted mb-md">
                        <span><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${p.localisation || '—'}</span>
                        <span><i data-lucide="layers" style="width:12px;height:12px;"></i> ${p.nb_lots || 0} lots</span>
                    </div>
                    ${progressBar(p.taux_avancement)}
                    <div class="card-footer">
                        <span class="text-xs text-muted">${formatCurrency(p.montant_marche)}</span>
                        <span class="text-xs text-muted">${formatDate(p.date_debut)} → ${formatDate(p.date_fin_prevue)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function showNewProjectModal(p = null) {
    const v = (f) => p && p[f] != null ? String(p[f]).replace(/"/g, '&quot;') : '';
    const natures = ['Construction', 'Réhabilitation', 'Extension', 'Aménagement'];
    const statuts = ['En préparation', 'En cours', 'Arrêté', 'Réceptionné', 'Clôturé'];
    const body = `
        <form id="form-new-project">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label required">Code Projet</label>
                    <input type="text" class="form-control" name="code_projet" placeholder="PRJ-2026-XXX" value="${v('code_projet')}" required>
                </div>
                <div class="form-group">
                    <label class="form-label required">Nature</label>
                    <select class="form-control" name="nature_projet">
                        ${natures.map(n => `<option ${p && p.nature_projet === n ? 'selected' : ''}>${n}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label required">Intitulé du Projet</label>
                <input type="text" class="form-control" name="intitule" placeholder="Ex: Construction du Centre Hospitalier..." value="${v('intitule')}" required>
            </div>
            <div class="form-group">
                <label class="form-label required">Maître d'Ouvrage</label>
                <input type="text" class="form-control" name="maitre_ouvrage" placeholder="Ex: Ministère de la Santé" value="${v('maitre_ouvrage')}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Localisation</label>
                    <input type="text" class="form-control" name="localisation" placeholder="Adresse" value="${v('localisation')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Ville</label>
                    <input type="text" class="form-control" name="wilaya" placeholder="Ville" value="${v('wilaya')}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Montant Marché (DH)</label>
                    <input type="number" class="form-control" name="montant_marche" placeholder="0" value="${v('montant_marche')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Durée (mois)</label>
                    <input type="number" class="form-control" name="duree_mois" placeholder="0" value="${v('duree_mois')}">
                </div>
                ${p ? `<div class="form-group"><label class="form-label">Statut</label><select class="form-control" name="statut">${statuts.map(s => `<option ${p.statut === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>` : ''}
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Date de début</label>
                    <input type="date" class="form-control" name="date_debut" value="${v('date_debut')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Date de fin prévue</label>
                    <input type="date" class="form-control" name="date_fin_prevue" value="${v('date_fin_prevue')}">
                </div>
                ${p ? `<div class="form-group"><label class="form-label">Avancement (%)</label><input type="number" class="form-control" name="taux_avancement" value="${v('taux_avancement')}"></div>` : ''}
            </div>
        </form>
    `;

    const footer = `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitProject(${p ? p.id : 'null'})"><i data-lucide="save"></i> Enregistrer</button>
    `;

    openModal(p ? 'Modifier le projet' : 'Nouveau Projet', body, footer, 'lg');
}

async function submitProject(id) {
    const form = document.getElementById('form-new-project');
    const data = Object.fromEntries(new FormData(form));

    if (!data.code_projet || !data.intitule || !data.maitre_ouvrage) {
        showToast('Erreur', 'Veuillez remplir les champs obligatoires.', 'danger');
        return;
    }

    try {
        if (id) {
            await window.api.projets.update(id, data);
            closeModal();
            showToast('Succès', 'Projet modifié.', 'success');
            navigateTo('project-detail', { id });
        } else {
            await window.api.projets.create(data);
            closeModal();
            showToast('Succès', 'Projet créé avec succès.', 'success');
            navigateTo('projects');
        }
    } catch (err) {
        showToast('Erreur', err.message, 'danger');
    }
}

async function editProject(id) {
    const p = await window.api.projets.get(id);
    if (p) showNewProjectModal(p);
}

async function deleteProject(id, nom) {
    if (!confirm(`Supprimer définitivement le projet « ${nom} » et toutes ses données (lots, ouvrages, workflow…) ? Cette action est irréversible.`)) return;
    const res = await window.api.projets.delete(id);
    if (res.success) { showToast('Supprimé', 'Projet supprimé.', 'success'); navigateTo('projects'); }
    else showToast('Erreur', res.error || 'Suppression impossible.', 'danger');
}

// ============================================================
// PROJECT DETAIL
// ============================================================
async function renderProjectDetail(container, projetId) {
    const projet = await window.api.projets.get(projetId);
    const lots = await window.api.lots.getByProjet(projetId);
    const stats = await window.api.projets.getStats(projetId);
    const intervenants = await window.api.intervenants.getByProjet(projetId);
    const ordresService = await window.api.os.getByProjet(projetId);
    
    if (!projet) {
        container.innerHTML = '<div class="empty-state"><h4>Projet non trouvé</h4></div>';
        return;
    }
    
    updatePageTitle(projet.code_projet);
    window._currentProjetId = projetId;
    
    container.innerHTML = `
        <!-- Project Header -->
        <div class="project-detail-header animate-fade-in-up">
            <div class="d-flex justify-between align-center">
                <div>
                    <div class="d-flex align-center gap-md mb-sm">
                        <button class="btn btn-ghost btn-sm" onclick="navigateTo('projects')"><i data-lucide="arrow-left"></i></button>
                        <span class="badge badge-primary">${projet.code_projet}</span>
                        ${statusBadge(projet.statut)}
                    </div>
                    <h2 style="font-size: var(--text-2xl);">${projet.intitule}</h2>
                    <p class="text-muted mt-sm">${projet.maitre_ouvrage}</p>
                    ${isMOD() ? `<div class="btn-group mt-md">
                        <button class="btn btn-ghost btn-sm" onclick="editProject(${projet.id})"><i data-lucide="pencil"></i> Modifier</button>
                        <button class="btn btn-ghost btn-sm" onclick="deleteProject(${projet.id}, '${(projet.intitule || '').replace(/'/g, ' ')}')"><i data-lucide="trash-2"></i> Supprimer</button>
                    </div>` : ''}
                </div>
                <div>
                    ${gaugeChart(projet.taux_avancement)}
                </div>
            </div>
            <div class="project-info-grid">
                <div class="info-item">
                    <span class="info-item-label">Localisation</span>
                    <span class="info-item-value">${projet.localisation || '—'} ${projet.wilaya ? '(' + projet.wilaya + ')' : ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-item-label">Montant Marché</span>
                    <span class="info-item-value">${formatCurrency(projet.montant_marche)}</span>
                </div>
                <div class="info-item">
                    <span class="info-item-label">Date de début</span>
                    <span class="info-item-value">${formatDate(projet.date_debut)}</span>
                </div>
                <div class="info-item">
                    <span class="info-item-label">Date fin prévue</span>
                    <span class="info-item-value">${formatDate(projet.date_fin_prevue)}</span>
                </div>
                <div class="info-item">
                    <span class="info-item-label">Durée</span>
                    <span class="info-item-value">${projet.duree_mois || '—'} mois</span>
                </div>
                <div class="info-item">
                    <span class="info-item-label">Nature</span>
                    <span class="info-item-value">${projet.nature_projet || 'Construction'}</span>
                </div>
            </div>
        </div>

        <!-- Mini Stats -->
        <div class="stats-grid animate-fade-in-up delay-1">
            <div class="stat-card stat-info">
                <div class="stat-icon icon-info"><i data-lucide="layers"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${stats.nbLots}</div>
                    <div class="stat-label">Lots</div>
                </div>
            </div>
            <div class="stat-card stat-success">
                <div class="stat-icon icon-success"><i data-lucide="check-circle"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${stats.ouvragesTermines}/${stats.nbOuvrages}</div>
                    <div class="stat-label">Ouvrages Terminés</div>
                </div>
            </div>
            <div class="stat-card stat-danger">
                <div class="stat-icon icon-danger"><i data-lucide="alert-triangle"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${stats.reservesOuvertes}</div>
                    <div class="stat-label">Réserves Ouvertes</div>
                </div>
            </div>
            <div class="stat-card stat-primary">
                <div class="stat-icon icon-primary"><i data-lucide="users"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${stats.nbIntervenants}</div>
                    <div class="stat-label">Intervenants</div>
                </div>
            </div>
        </div>

        <!-- Tabs Content -->
        <div class="tabs animate-fade-in-up delay-2">
            <button class="tab active" onclick="switchTab(this, 'tab-lots')">Lots & Ouvrages</button>
            <button class="tab" onclick="switchTab(this, 'tab-intervenants')">Intervenants</button>
            <button class="tab" onclick="switchTab(this, 'tab-os')">Ordres de Service</button>
            <button class="tab" onclick="switchTab(this, 'tab-docs'); loadProjectDocs(${projetId})">Documents</button>
        </div>

        <!-- Tab: Lots -->
        <div id="tab-lots" class="tab-panel animate-fade-in-up delay-3">
            ${isMOD() ? `<div class="d-flex justify-end mb-md"><button class="btn btn-primary btn-sm" onclick="showNewLotModal(${projetId})"><i data-lucide="plus"></i> Nouveau lot</button></div>` : ''}
            ${lots.length > 0 ? lots.map(lot => `
                <div class="card mb-md" id="lot-${lot.id}">
                    <div class="card-header">
                        <div>
                            <div class="d-flex align-center gap-sm">
                                <span class="badge badge-info">${lot.code_lot}</span>
                                <h4 style="font-size: var(--text-md);">${lot.designation}</h4>
                            </div>
                            <div class="text-xs text-muted mt-sm">${lot.nature} — ${lot.entreprise_nom || 'Pas d\'entreprise assignée'}</div>
                        </div>
                        <div class="d-flex align-center gap-sm">
                            ${statusBadge(lot.statut)}
                            <button class="btn btn-ghost btn-sm" onclick="toggleLotOuvrages(${lot.id}, ${projetId})">
                                <i data-lucide="chevron-down"></i> Ouvrages
                            </button>
                            ${isMOD() ? `
                                <button class="btn btn-ghost btn-sm" title="Modifier le lot" onclick="editLot(${lot.id}, ${projetId})"><i data-lucide="pencil"></i></button>
                                <button class="btn btn-ghost btn-sm" title="Supprimer le lot" onclick="deleteLot(${lot.id}, ${projetId}, '${(lot.designation || '').replace(/'/g, ' ')}')"><i data-lucide="trash-2"></i></button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="d-flex gap-xl align-center">
                        <div class="flex-1">${progressBar(lot.taux_avancement)}</div>
                        <div class="text-right">
                            <div class="text-sm font-bold">${formatCurrency(lot.montant)}</div>
                            <div class="text-xs text-muted">${lot.duree_jours || '—'} jours</div>
                        </div>
                    </div>
                    <div id="ouvrages-${lot.id}" style="display: none; margin-top: var(--space-md);"></div>
                </div>
            `).join('') : '<div class="empty-state"><p class="text-muted">Aucun lot enregistré</p></div>'}
        </div>

        <!-- Tab: Intervenants -->
        <div id="tab-intervenants" class="tab-panel" style="display:none;">
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Rôle</th>
                            <th>Raison Sociale</th>
                            <th>Contact</th>
                            <th>Email</th>
                            <th>Téléphone</th>
                            <th>Fonction</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${intervenants.map(i => `
                            <tr>
                                <td>${roleBadge(i.type_role)}</td>
                                <td class="font-medium">${i.raison_sociale}</td>
                                <td>${i.contact_nom || ''} ${i.contact_prenom || ''}</td>
                                <td><a href="mailto:${i.email}">${i.email || '—'}</a></td>
                                <td>${i.telephone || '—'}</td>
                                <td class="text-muted text-xs">${i.role_specifique || '—'}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="6" class="text-center text-muted p-lg">Aucun intervenant assigné</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Tab: Ordres de Service -->
        <div id="tab-os" class="tab-panel" style="display:none;">
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>N° OS</th>
                            <th>Lot</th>
                            <th>Type</th>
                            <th>Objet</th>
                            <th>Date Notification</th>
                            <th>Date Effet</th>
                            <th>Délai</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ordresService.map(os => `
                            <tr>
                                <td class="font-medium">${os.numero_os}</td>
                                <td><span class="badge badge-info">${os.code_lot}</span></td>
                                <td>${statusBadge(os.type_os)}</td>
                                <td>${os.objet}</td>
                                <td>${formatDate(os.date_notification)}</td>
                                <td>${formatDate(os.date_effet)}</td>
                                <td>${os.delai_jours ? os.delai_jours + ' j' : '—'}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="7" class="text-center text-muted p-lg">Aucun ordre de service</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Tab: Documents -->
        <div id="tab-docs" class="tab-panel" style="display:none;">
            <div class="d-flex justify-end mb-md">
                <button class="btn btn-primary btn-sm" onclick="showUploadDocModal({entite_type:'projet', entite_id:${projetId}, projet_id:${projetId}, onDoneName:'project-docs'})"><i data-lucide="upload"></i> Ajouter un document</button>
            </div>
            <div id="project-docs-list"><div class="d-flex justify-center p-lg"><div class="spinner"></div></div></div>
        </div>
    `;
}

function switchTab(btn, tabId) {
    // Update tab buttons
    btn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    
    // Show/hide panels
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
}

async function toggleLotOuvrages(lotId, projetId) {
    const container = document.getElementById(`ouvrages-${lotId}`);
    if (container.style.display === 'none') {
        const ouvrages = await window.api.ouvrages.getByLot(lotId);
        const addBtn = isMOD() ? `<div class="d-flex justify-end mb-sm"><button class="btn btn-secondary btn-sm" onclick="showNewOuvrageModal(${lotId}, ${projetId})"><i data-lucide="plus"></i> Nouvel ouvrage</button></div>` : '';
        container.innerHTML = ouvrages.length > 0 ? `
            ${addBtn}
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Ouvrage</th><th>Bloc</th><th>Niveau</th><th>Phase</th><th>Statut</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${ouvrages.map(o => `
                            <tr>
                                <td class="font-medium">${o.designation}</td>
                                <td>${o.bloc || '—'}</td>
                                <td>${o.niveau || '—'}</td>
                                <td class="text-muted text-xs">${o.phase || '—'}</td>
                                <td>${statusBadge(o.statut)}</td>
                                <td class="actions">
                                    <button class="btn btn-ghost btn-sm" title="Workflow" onclick="showWorkflowModal(${o.id})"><i data-lucide="git-branch"></i></button>
                                    ${isMOD() ? `
                                        <button class="btn btn-ghost btn-sm" title="Modifier" onclick="editOuvrage(${o.id}, ${lotId}, ${projetId})"><i data-lucide="pencil"></i></button>
                                        <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteOuvrage(${o.id}, ${projetId}, '${(o.designation || '').replace(/'/g, ' ')}')"><i data-lucide="trash-2"></i></button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : `${addBtn}<p class="text-muted p-md">Aucun ouvrage enregistré pour ce lot.</p>`;
        container.style.display = 'block';
        if (typeof lucide !== 'undefined') lucide.createIcons({ node: container });
    } else {
        container.style.display = 'none';
    }
}

// ---- Création / modification de lot ----
async function showNewLotModal(projetId, lot = null) {
    const entreprises = await window.api.intervenants.getAll('Entreprise');
    const natures = ['Gros Œuvre & Étanchéité', 'Électricité', 'Fluides', 'VRD', 'Menuiserie Aluminium', 'Menuiserie Bois', 'Peinture & Revêtements', 'Ascenseurs', 'Climatisation & Chauffage', 'Sécurité Incendie', 'Aménagement Extérieur', 'Autre'];
    const statuts = ['En attente', 'En cours', 'Arrêté', 'Terminé', 'Réceptionné'];
    const v = (f) => lot && lot[f] != null ? String(lot[f]).replace(/"/g, '&quot;') : '';
    const body = `
        <form id="form-new-lot">
            <input type="hidden" name="projet_id" value="${projetId}">
            <div class="form-row">
                <div class="form-group"><label class="form-label required">Code lot</label><input type="text" class="form-control" name="code_lot" placeholder="LOT-05" value="${v('code_lot')}" required></div>
                <div class="form-group"><label class="form-label required">Nature</label>
                    <select class="form-control" name="nature">${natures.map(n => `<option ${lot && lot.nature === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
                </div>
            </div>
            <div class="form-group"><label class="form-label required">Désignation</label><input type="text" class="form-control" name="designation" placeholder="Ex : Plomberie et fluides médicaux" value="${v('designation')}" required></div>
            <div class="form-group"><label class="form-label">Entreprise adjudicataire</label>
                <select class="form-control" name="entreprise_id"><option value="">— À attribuer —</option>${entreprises.map(e => `<option value="${e.id}" ${lot && lot.entreprise_id === e.id ? 'selected' : ''}>${e.raison_sociale}</option>`).join('')}</select>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Montant (DH)</label><input type="number" class="form-control" name="montant" placeholder="0" value="${v('montant')}"></div>
                <div class="form-group"><label class="form-label">Délai (jours)</label><input type="number" class="form-control" name="duree_jours" placeholder="0" value="${v('duree_jours')}"></div>
                <div class="form-group"><label class="form-label">Date OS commencement</label><input type="date" class="form-control" name="date_os_commencement" value="${v('date_os_commencement')}"></div>
            </div>
            ${lot ? `<div class="form-row">
                <div class="form-group"><label class="form-label">Statut</label><select class="form-control" name="statut">${statuts.map(s => `<option ${lot.statut === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Avancement (%)</label><input type="number" class="form-control" name="taux_avancement" value="${v('taux_avancement')}"></div>
            </div>` : ''}
        </form>
    `;
    openModal(lot ? 'Modifier le lot' : 'Nouveau lot', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitLot(${projetId}, ${lot ? lot.id : 'null'})">Enregistrer</button>
    `, 'lg');
}

async function submitLot(projetId, id) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-new-lot')));
    if (!data.code_lot || !data.designation) { showToast('Erreur', 'Code et désignation requis.', 'danger'); return; }
    if (!data.entreprise_id) data.entreprise_id = null;
    try {
        if (id) { await window.api.lots.update(id, data); showToast('Succès', 'Lot modifié.', 'success'); }
        else { await window.api.lots.create(data); showToast('Succès', 'Lot créé.', 'success'); }
        closeModal();
        navigateTo('project-detail', { id: projetId });
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function editLot(id, projetId) {
    const lot = await window.api.lots.get(id);
    if (lot) showNewLotModal(projetId, lot);
}

async function deleteLot(id, projetId, nom) {
    if (!confirm(`Supprimer le lot « ${nom} » et ses ouvrages ?`)) return;
    const res = await window.api.lots.delete(id);
    if (res.success) { showToast('Supprimé', 'Lot supprimé.', 'success'); navigateTo('project-detail', { id: projetId }); }
    else showToast('Erreur', res.error || 'Suppression impossible.', 'danger');
}

// ---- Création / modification d'ouvrage ----
function showNewOuvrageModal(lotId, projetId, ouvrage = null) {
    const phases = ['Fondations', 'Infrastructure', 'Superstructure', 'Étanchéité', 'Second Œuvre', 'Finitions'];
    const v = (f) => ouvrage && ouvrage[f] != null ? String(ouvrage[f]).replace(/"/g, '&quot;') : '';
    const body = `
        <form id="form-new-ouvrage">
            <input type="hidden" name="lot_id" value="${lotId}">
            <div class="form-group"><label class="form-label required">Désignation de l'ouvrage</label><input type="text" class="form-control" name="designation" placeholder="Ex : Plancher haut RDC Bloc A" value="${v('designation')}" required></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Bloc</label><input type="text" class="form-control" name="bloc" placeholder="Bloc A" value="${v('bloc')}"></div>
                <div class="form-group"><label class="form-label">Niveau</label><input type="text" class="form-control" name="niveau" placeholder="RDC / 1er étage" value="${v('niveau')}"></div>
                <div class="form-group"><label class="form-label">Phase</label>
                    <select class="form-control" name="phase">${phases.map(p => `<option ${ouvrage && ouvrage.phase === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
                </div>
            </div>
            <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" name="description" rows="2">${v('description')}</textarea></div>
            ${!ouvrage ? '<p class="text-xs text-muted">Une étape « Déclaration d\'achèvement » sera automatiquement créée pour l\'entreprise du lot.</p>' : ''}
        </form>
    `;
    openModal(ouvrage ? "Modifier l'ouvrage" : 'Nouvel ouvrage', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitOuvrage(${projetId}, ${ouvrage ? ouvrage.id : 'null'})">Enregistrer</button>
    `, 'lg');
}

async function submitOuvrage(projetId, id) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-new-ouvrage')));
    if (!data.designation) { showToast('Erreur', 'Désignation requise.', 'danger'); return; }
    try {
        if (id) { await window.api.ouvrages.update(id, data); showToast('Succès', 'Ouvrage modifié.', 'success'); }
        else { await window.api.ouvrages.create(data); showToast('Succès', 'Ouvrage créé.', 'success'); }
        closeModal();
        navigateTo('project-detail', { id: projetId });
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function editOuvrage(id, lotId, projetId) {
    const o = await window.api.ouvrages.get(id);
    if (o) showNewOuvrageModal(lotId, projetId, o);
}

async function deleteOuvrage(id, projetId, nom) {
    if (!confirm(`Supprimer l'ouvrage « ${nom} » et son workflow ?`)) return;
    const res = await window.api.ouvrages.delete(id);
    if (res.success) { showToast('Supprimé', 'Ouvrage supprimé.', 'success'); navigateTo('project-detail', { id: projetId }); }
    else showToast('Erreur', res.error || 'Suppression impossible.', 'danger');
}

// ============================================================
// WORKFLOW
// ============================================================
async function renderWorkflow(container) {
    updatePageTitle('Workflow de Validation');
    const projets = await window.api.projets.getAll();
    const projetId = projets[0]?.id;
    
    if (!projetId) {
        container.innerHTML = '<div class="empty-state"><h4>Aucun projet</h4></div>';
        return;
    }
    
    const ouvrages = await window.api.ouvrages.getByProjet(projetId);

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div>
                <h2>Workflow de Validation</h2>
                <p>Suivi des ouvrages par étape — cliquez une carte pour le détail</p>
            </div>
        </div>

        <div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" id="workflow-projet-filter" onchange="filterWorkflowByProjet(this.value)">
                ${projets.map(p => `<option value="${p.id}" ${p.id === projetId ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
        </div>

        <div id="workflow-kanban" class="animate-fade-in-up delay-2">${renderKanban(ouvrages)}</div>
    `;
}

// Construit le tableau Kanban des ouvrages par étape
function renderKanban(ouvrages) {
    const columns = [
        { key: 'À déclarer', statuts: ['Non commencé', 'En cours'], color: 'var(--text-muted)' },
        { key: 'En réception', statuts: ['En validation'], color: 'var(--warning)' },
        { key: 'Validé / Bétonnage', statuts: ['Validé', 'Bétonnage planifié', 'Bétonné'], color: 'var(--info)' },
        { key: 'Contrôle labo', statuts: ['Essais en cours'], color: 'var(--secondary)' },
        { key: 'Terminé', statuts: ['Terminé', 'Réceptionné'], color: 'var(--success)' }
    ];
    return `<div class="kanban">
        ${columns.map(col => {
            const items = ouvrages.filter(o => col.statuts.includes(o.statut));
            return `
                <div class="kanban-col">
                    <div class="kanban-col-header" style="border-top: 3px solid ${col.color};">
                        <span>${col.key}</span><span class="kanban-count">${items.length}</span>
                    </div>
                    <div class="kanban-col-body">
                        ${items.map(o => `
                            <div class="kanban-card" onclick="showWorkflowModal(${o.id})">
                                <div class="d-flex justify-between align-center mb-sm">
                                    <span class="badge badge-info">${o.code_lot}</span>
                                    ${statusBadge(o.statut)}
                                </div>
                                <div class="font-medium text-sm">${o.designation}</div>
                                <div class="text-xs text-muted mt-sm">${o.bloc || ''} ${o.niveau || ''}</div>
                            </div>
                        `).join('') || '<div class="text-xs text-muted p-md text-center">—</div>'}
                    </div>
                </div>`;
        }).join('')}
    </div>`;
}

async function showWorkflowModal(ouvrageId) {
    const ouvrage = await window.api.ouvrages.get(ouvrageId);
    const etapes = await window.api.workflow.getByOuvrage(ouvrageId);
    
    const statusClass = (statut) => {
        if (['Terminé', 'Favorable'].includes(statut)) return 'completed';
        if (['En cours'].includes(statut)) return 'active';
        if (['Défavorable'].includes(statut)) return 'failed';
        return '';
    };
    
    const body = `
        <div class="mb-lg">
            <h4>${ouvrage.designation}</h4>
            <p class="text-sm text-muted">${ouvrage.bloc || ''} — ${ouvrage.niveau || ''} — ${ouvrage.lot_designation || ''}</p>
            <div class="mt-sm">${statusBadge(ouvrage.statut)}</div>
        </div>
        <div class="workflow-track">
            ${etapes.map(e => `
                <div class="workflow-step ${statusClass(e.statut)}">
                    <div class="workflow-dot"></div>
                    <div class="workflow-step-content">
                        <div class="workflow-step-header">
                            <span class="workflow-step-title">${e.type_etape}</span>
                            ${statusBadge(e.statut)}
                        </div>
                        <div class="d-flex justify-between align-center mt-sm">
                            <span class="text-xs text-muted">
                                ${e.responsable_type ? roleBadge(e.responsable_type) : ''} 
                                ${e.responsable_nom || ''}
                            </span>
                            <span class="text-xs text-muted">
                                ${e.date_debut ? formatDateTime(e.date_debut) : '—'}
                            </span>
                        </div>
                        ${e.commentaire ? `<p class="text-xs text-secondary mt-sm" style="font-style: italic;">"${e.commentaire}"</p>` : ''}
                    </div>
                </div>
            `).join('') || '<p class="text-muted">Aucune étape de workflow définie.</p>'}
        </div>
    `;
    
    openModal('Workflow — ' + ouvrage.designation, body, '<button class="btn btn-ghost" onclick="closeModal()">Fermer</button>', 'lg');
}

async function filterWorkflowByProjet(projetId) {
    const ouvrages = await window.api.ouvrages.getByProjet(projetId);
    const kanban = document.getElementById('workflow-kanban');
    kanban.innerHTML = renderKanban(ouvrages);
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: kanban });
}

// ============================================================
// INTERVENANTS
// ============================================================
async function renderIntervenants(container) {
    updatePageTitle('Intervenants');
    const intervenants = await window.api.intervenants.getAll();
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div>
                <h2>Gestion des Intervenants</h2>
                <p>${intervenants.length} intervenant(s) enregistré(s)</p>
            </div>
            <button class="btn btn-primary" onclick="showNewIntervenantModal()">
                <i data-lucide="user-plus"></i> Nouvel Intervenant
            </button>
        </div>
        
        <div class="table-wrapper animate-fade-in-up delay-1">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Photo</th>
                        <th>Rôle</th>
                        <th>Raison Sociale</th>
                        <th>Contact</th>
                        <th>Email</th>
                        <th>Téléphone</th>
                        <th>Ville</th>
                        <th>Spécialité</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${intervenants.map(i => `
                        <tr>
                            <td><span class="list-avatar" id="list-av-${i.id}" style="background:${roleColor(i.type_role)};">${getInitials(i.raison_sociale)}</span></td>
                            <td>${roleBadge(i.type_role)}</td>
                            <td class="font-semibold">${i.raison_sociale}</td>
                            <td>${i.contact_nom || ''} ${i.contact_prenom || ''}</td>
                            <td><a href="mailto:${i.email}">${i.email || '—'}</a></td>
                            <td>${i.telephone || '—'}</td>
                            <td>${i.ville || '—'}</td>
                            <td class="text-xs text-muted">${i.specialite || '—'}</td>
                            <td class="actions">
                                <button class="btn btn-ghost btn-sm" title="Modifier" onclick="editIntervenant(${i.id})"><i data-lucide="pencil"></i></button>
                                <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteIntervenant(${i.id}, '${(i.raison_sociale || '').replace(/'/g, ' ')}')"><i data-lucide="trash-2"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Charger les photos (avatars) des intervenants qui en ont une
    intervenants.filter(i => i.avatar).forEach(async i => {
        try {
            const url = await window.api.intervenants.getAvatar(i.id);
            const el = document.getElementById('list-av-' + i.id);
            if (url && el) { el.textContent = ''; el.style.background = 'transparent'; el.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; }
        } catch (e) {}
    });
}

let _pendingAvatar = null;

function onAvatarSelected(input) {
    const f = input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
        _pendingAvatar = reader.result;
        const img = document.getElementById('avatar-preview');
        if (img) { img.innerHTML = `<img src="${reader.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; }
    };
    reader.readAsDataURL(f);
}

function showNewIntervenantModal(it = null) {
    _pendingAvatar = null;
    const v = (f) => it && it[f] != null ? String(it[f]).replace(/"/g, '&quot;') : '';
    const roles = [['Architecte', 'Architecte'], ['BET', "Bureau d'Études Techniques (BET)"], ['BCT', 'Bureau de Contrôle Technique (BCT)'], ['Laboratoire', 'Laboratoire'], ['Topographe', 'Topographe'], ['Entreprise', 'Entreprise']];
    const body = `
        <form id="form-new-intervenant">
            <div class="d-flex align-center gap-lg mb-md">
                <div id="avatar-preview" class="avatar-preview">${it && it.avatar ? '' : '<i data-lucide="user"></i>'}</div>
                <div>
                    <label class="btn btn-ghost btn-sm" style="cursor:pointer;"><i data-lucide="camera"></i> Choisir une photo<input type="file" accept="image/*" style="display:none;" onchange="onAvatarSelected(this)"></label>
                    <div class="text-xs text-muted mt-sm">Photo de l'intervenant (avatar)</div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label required">Type / Rôle</label>
                <select class="form-control" name="type_role" required>
                    ${roles.map(([val, lab]) => `<option value="${val}" ${it && it.type_role === val ? 'selected' : ''}>${lab}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label required">Raison Sociale</label>
                <input type="text" class="form-control" name="raison_sociale" value="${v('raison_sociale')}" required>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Nom</label><input type="text" class="form-control" name="contact_nom" value="${v('contact_nom')}"></div>
                <div class="form-group"><label class="form-label">Prénom</label><input type="text" class="form-control" name="contact_prenom" value="${v('contact_prenom')}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="${v('email')}"></div>
                <div class="form-group"><label class="form-label">Téléphone</label><input type="tel" class="form-control" name="telephone" value="${v('telephone')}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Ville</label><input type="text" class="form-control" name="ville" value="${v('ville')}"></div>
                <div class="form-group"><label class="form-label">Spécialité</label><input type="text" class="form-control" name="specialite" value="${v('specialite')}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">N° Agrément</label><input type="text" class="form-control" name="numero_agrement" value="${v('numero_agrement')}"></div>
                <div class="form-group"><label class="form-label">Adresse</label><input type="text" class="form-control" name="adresse" value="${v('adresse')}"></div>
            </div>
        </form>
    `;
    openModal(it ? "Modifier l'intervenant" : 'Nouvel Intervenant', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitIntervenant(${it ? it.id : 'null'})">Enregistrer</button>
    `);
    // Charger l'avatar existant en édition
    if (it && it.avatar) {
        window.api.intervenants.getAvatar(it.id).then(url => {
            const img = document.getElementById('avatar-preview');
            if (url && img) img.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        }).catch(() => {});
    }
}

async function submitIntervenant(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-new-intervenant')));
    if (!data.raison_sociale) { showToast('Erreur', 'Raison sociale requise', 'danger'); return; }
    try {
        let targetId = id;
        if (id) { await window.api.intervenants.update(id, data); }
        else { const res = await window.api.intervenants.create(data); targetId = res.lastInsertRowid; }
        // Enregistrer l'avatar si une photo a été choisie
        if (_pendingAvatar && targetId) { await window.api.intervenants.setAvatar(targetId, _pendingAvatar); }
        _pendingAvatar = null;
        closeModal();
        showToast('Succès', id ? 'Intervenant modifié.' : 'Intervenant ajouté.', 'success');
        navigateTo('intervenants');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function editIntervenant(id) {
    const it = await window.api.intervenants.get(id);
    if (it) showNewIntervenantModal(it);
}

async function deleteIntervenant(id, nom) {
    if (!confirm(`Supprimer l'intervenant « ${nom} » ?`)) return;
    const res = await window.api.intervenants.delete(id);
    if (res.success) { showToast('Supprimé', 'Intervenant supprimé.', 'success'); navigateTo('intervenants'); }
    else showToast('Suppression impossible', res.error || 'Intervenant référencé ailleurs.', 'warning');
}

// ============================================================
// SESSIONS
// ============================================================
async function renderSessions(container) {
    updatePageTitle('Gestion des Sessions');
    const sessions = await window.api.sessions.getAll();
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div>
                <h2>Sessions d'Accès</h2>
                <p>Gérez les sessions d'accès des intervenants</p>
            </div>
            <button class="btn btn-primary" onclick="showNewSessionModal()">
                <i data-lucide="key-round"></i> Nouvelle Session
            </button>
        </div>
        
        <div class="table-wrapper animate-fade-in-up delay-1">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Rôle</th>
                        <th>Intervenant</th>
                        <th>Projet</th>
                        <th>Nom d'utilisateur</th>
                        <th>Mot de passe</th>
                        <th>Statut</th>
                        <th>Dernière connexion</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${sessions.map(s => `
                        <tr>
                            <td>${roleBadge(s.type_role)}</td>
                            <td class="font-semibold">${s.raison_sociale}</td>
                            <td class="text-sm text-muted">${s.projet_intitule || '—'}</td>
                            <td><code style="background: var(--bg-tertiary); padding: 2px 8px; border-radius: 4px;">${s.username}</code></td>
                            <td><span class="text-muted" title="Mot de passe chiffré">•••••••• 🔒</span></td>
                            <td>${s.actif ? '<span class="badge badge-success badge-dot">Actif</span>' : '<span class="badge badge-muted badge-dot">Inactif</span>'}</td>
                            <td class="text-xs text-muted">${s.derniere_connexion ? formatDateTime(s.derniere_connexion) : 'Jamais'}</td>
                            <td class="actions">
                                <button class="btn btn-ghost btn-sm" title="Réinitialiser le mot de passe" onclick="showResetPasswordModal(${s.id}, '${(s.username || '').replace(/'/g, ' ')}')"><i data-lucide="key-round"></i></button>
                                <button class="btn btn-ghost btn-sm" title="${s.actif ? 'Désactiver' : 'Activer'}" onclick="toggleSessionStatus(${s.id}, ${!s.actif})">
                                    ${s.actif ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>'}
                                </button>
                                <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteSession(${s.id}, '${(s.username || '').replace(/'/g, ' ')}')"><i data-lucide="trash-2"></i></button>
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="8" class="text-center text-muted p-lg">Aucune session</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div class="card mt-lg animate-fade-in-up delay-2 card-flat">
            <h4 class="mb-sm"><i data-lucide="info" style="width:16px;height:16px;margin-right:6px;"></i>Informations de connexion MOD</h4>
            <p class="text-sm text-muted">Identifiant: <code>admin</code> — Mot de passe: <code>admin2026</code></p>
        </div>
    `;
}

async function toggleSessionStatus(id, actif) {
    await window.api.sessions.toggle(id, actif);
    showToast('Succès', `Session ${actif ? 'activée' : 'désactivée'}.`, 'success');
    navigateTo('sessions');
}

async function deleteSession(id, username) {
    if (!confirm(`Supprimer la session « ${username} » ? L'intervenant ne pourra plus se connecter.`)) return;
    const res = await window.api.sessions.delete(id);
    if (res.success) { showToast('Supprimée', 'Session supprimée.', 'success'); navigateTo('sessions'); }
    else showToast('Erreur', 'Suppression impossible.', 'danger');
}

// ============================================================
// ÉQUIPE MOD (comptes nominatifs : chef de projet, chefs de service, techniciens…)
// ============================================================
const MOD_FONCTIONS = ['Chef de projet', 'Chef de service structure', 'Chef de service reporting', 'Chef de service technique', 'Ingénieur', 'Technicien', 'Assistant(e)', 'Autre'];

async function renderModTeam(container) {
    updatePageTitle('Équipe MOD');
    const isAdmin = currentUser && currentUser.is_admin;
    const team = await window.api.modteam.getAll();

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Équipe MOD</h2><p>Comptes nominatifs de votre équipe de maîtrise d'ouvrage</p></div>
            ${isAdmin ? `<button class="btn btn-primary" onclick="showModUserModal()"><i data-lucide="user-plus"></i> Ajouter un membre</button>` : ''}
        </div>
        <div class="card card-flat mb-lg animate-fade-in-up" style="border-left:4px solid var(--primary);">
            <div class="d-flex align-center gap-md">
                <span style="color:var(--primary);"><i data-lucide="shield-check" style="width:24px;height:24px;"></i></span>
                <div class="text-sm">Le compte principal <code>admin</code> reste l'administrateur. Les membres ajoutés ici se connectent avec leur <strong>nom</strong> et accèdent à l'espace MOD.${!isAdmin ? ' <em>(gestion réservée à l’administrateur)</em>' : ''}</div>
            </div>
        </div>
        <div class="table-wrapper animate-fade-in-up delay-1">
            <table class="data-table">
                <thead><tr><th>Nom</th><th>Fonction</th><th>Identifiant</th><th>Statut</th><th>Dernière connexion</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
                <tbody>
                    ${team.map(u => `
                        <tr>
                            <td class="font-semibold">${u.nom}</td>
                            <td>${u.fonction ? `<span class="badge badge-primary">${u.fonction}</span>` : '—'}</td>
                            <td><code style="background:var(--bg-tertiary);padding:2px 8px;border-radius:4px;">${u.username}</code></td>
                            <td>${u.actif ? '<span class="badge badge-success badge-dot">Actif</span>' : '<span class="badge badge-muted badge-dot">Inactif</span>'}</td>
                            <td class="text-xs text-muted">${u.derniere_connexion ? formatDateTime(u.derniere_connexion) : 'Jamais'}</td>
                            ${isAdmin ? `<td class="actions">
                                <button class="btn btn-ghost btn-sm" title="Modifier" onclick="editModUser(${u.id})"><i data-lucide="pencil"></i></button>
                                <button class="btn btn-ghost btn-sm" title="Réinitialiser le mot de passe" onclick="resetModUserPassword(${u.id}, '${(u.username || '').replace(/'/g, ' ')}')"><i data-lucide="key-round"></i></button>
                                <button class="btn btn-ghost btn-sm" title="${u.actif ? 'Désactiver' : 'Activer'}" onclick="toggleModUser(${u.id}, ${!u.actif})">${u.actif ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>'}</button>
                                <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteModUser(${u.id}, '${(u.nom || '').replace(/'/g, ' ')}')"><i data-lucide="trash-2"></i></button>
                            </td>` : ''}
                        </tr>
                    `).join('') || `<tr><td colspan="${isAdmin ? 6 : 5}" class="text-center text-muted p-lg">Aucun membre. ${isAdmin ? 'Cliquez sur « Ajouter un membre ».' : ''}</td></tr>`}
                </tbody>
            </table>
        </div>
    `;
}

function showModUserModal(u = null) {
    const v = (f) => u && u[f] != null ? String(u[f]).replace(/"/g, '&quot;') : '';
    const suggestion = 'mod' + Math.floor(1000 + Math.random() * 9000);
    const body = `
        <form id="form-moduser">
            <div class="form-group"><label class="form-label required">Nom et prénom</label><input type="text" class="form-control" name="nom" value="${v('nom')}" placeholder="Ex : Karim El Amrani" required></div>
            <div class="form-group"><label class="form-label required">Fonction</label>
                <select class="form-control" name="fonction">${MOD_FONCTIONS.map(f => `<option ${u && u.fonction === f ? 'selected' : ''}>${f}</option>`).join('')}</select>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label required">Identifiant</label><input type="text" class="form-control" name="username" value="${v('username')}" placeholder="k.elamrani" required></div>
                ${!u ? `<div class="form-group"><label class="form-label required">Mot de passe</label><input type="text" class="form-control" name="password" value="${suggestion}" required></div>` : ''}
            </div>
        </form>
    `;
    openModal(u ? 'Modifier le membre' : "Ajouter un membre de l'équipe MOD", body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitModUser(${u ? u.id : 'null'})">Enregistrer</button>
    `);
}

async function submitModUser(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-moduser')));
    if (!data.nom || !data.username) { showToast('Erreur', 'Nom et identifiant requis.', 'danger'); return; }
    try {
        if (id) { await window.api.modteam.update(id, data); showToast('Succès', 'Membre modifié.', 'success'); }
        else {
            await window.api.modteam.create(data);
            closeModal();
            openModal('Membre créé', `<div class="text-center p-md"><div style="font-size:2rem;">🔑</div><p class="mt-md">Identifiants de <strong>${data.nom}</strong> :</p><p style="font-size:1.2rem;font-weight:700;margin:10px 0;"><code>${data.username}</code> / <code>${data.password}</code></p><p class="text-xs text-muted">Communiquez-les au membre. Le mot de passe est stocké chiffré.</p></div>`, '<button class="btn btn-primary" onclick="closeModal();navigateTo(\'hub-acteurs\')">J\'ai noté</button>');
            return;
        }
        closeModal();
        navigateTo('hub-acteurs');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function editModUser(id) {
    const team = await window.api.modteam.getAll();
    const u = team.find(x => x.id === id);
    if (u) showModUserModal(u);
}

function resetModUserPassword(id, username) {
    const suggestion = 'mod' + Math.floor(1000 + Math.random() * 9000);
    openModal('Réinitialiser le mot de passe', `<form id="form-mod-pwd"><p class="text-sm text-muted mb-lg">Nouveau mot de passe pour <code>${username}</code> :</p><div class="form-group"><input type="text" class="form-control" name="password" value="${suggestion}" required></div></form>`, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitModUserPassword(${id}, '${username.replace(/'/g, ' ')}')">Réinitialiser</button>
    `);
}
async function submitModUserPassword(id, username) {
    const pwd = (new FormData(document.getElementById('form-mod-pwd'))).get('password');
    if (!pwd) return;
    await window.api.modteam.updatePassword(id, pwd);
    closeModal();
    openModal('Mot de passe réinitialisé', `<div class="text-center p-md"><p>Nouveau mot de passe pour <code>${username}</code> :</p><p style="font-size:1.3rem;font-weight:700;margin:12px 0;color:var(--primary-light);"><code>${pwd}</code></p></div>`, '<button class="btn btn-primary" onclick="closeModal()">J\'ai noté</button>');
}
async function toggleModUser(id, actif) {
    await window.api.modteam.toggle(id, actif);
    showToast('Succès', `Membre ${actif ? 'activé' : 'désactivé'}.`, 'success');
    navigateTo('hub-acteurs');
}
async function deleteModUser(id, nom) {
    if (!confirm(`Supprimer le membre « ${nom} » de l'équipe MOD ?`)) return;
    const res = await window.api.modteam.delete(id);
    if (res.success) { showToast('Supprimé', 'Membre supprimé.', 'success'); navigateTo('hub-acteurs'); }
    else showToast('Erreur', 'Suppression impossible.', 'danger');
}

function showResetPasswordModal(id, username) {
    const suggestion = 'anep' + Math.floor(1000 + Math.random() * 9000);
    const body = `
        <form id="form-reset-pwd">
            <p class="text-sm text-muted mb-lg">Définissez un nouveau mot de passe pour <code>${username}</code>. Il sera stocké chiffré ; communiquez-le à l'intervenant.</p>
            <div class="form-group">
                <label class="form-label required">Nouveau mot de passe</label>
                <input type="text" class="form-control" name="password" value="${suggestion}" required>
            </div>
        </form>
    `;
    openModal('Réinitialiser le mot de passe', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitResetPassword(${id}, '${username.replace(/'/g, ' ')}')">Réinitialiser</button>
    `);
}

async function submitResetPassword(id, username) {
    const pwd = (new FormData(document.getElementById('form-reset-pwd'))).get('password');
    if (!pwd) { showToast('Erreur', 'Mot de passe requis.', 'danger'); return; }
    try {
        await window.api.sessions.updatePassword(id, pwd);
        closeModal();
        openModal('Mot de passe réinitialisé', `
            <div class="text-center p-md">
                <div style="font-size:2rem;">🔑</div>
                <p class="mt-md">Nouveau mot de passe pour <code>${username}</code> :</p>
                <p style="font-size:1.4rem;font-weight:700;letter-spacing:1px;margin:12px 0;color:var(--primary-light);"><code>${pwd}</code></p>
                <p class="text-xs text-muted">Notez-le : il ne sera plus affiché (stockage chiffré).</p>
            </div>
        `, '<button class="btn btn-primary" onclick="closeModal()">J\'ai noté</button>');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

function showNewSessionModal() {
    const body = `
        <form id="form-new-session">
            <p class="text-sm text-muted mb-lg">Créez une session d'accès pour permettre à un intervenant de se connecter à l'application.</p>
            <div class="form-group">
                <label class="form-label required">Projet</label>
                <select class="form-control" name="projet_id" id="session-projet" required></select>
            </div>
            <div class="form-group">
                <label class="form-label required">Intervenant</label>
                <select class="form-control" name="intervenant_id" id="session-intervenant" required></select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label required">Nom d'utilisateur</label>
                    <input type="text" class="form-control" name="username" required>
                </div>
                <div class="form-group">
                    <label class="form-label required">Mot de passe</label>
                    <input type="text" class="form-control" name="password_hash" required>
                </div>
            </div>
        </form>
    `;
    openModal('Nouvelle Session', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitNewSession()">Créer la session</button>
    `);
    
    // Load dropdowns
    loadSessionDropdowns();
}

async function loadSessionDropdowns() {
    const projets = await window.api.projets.getAll();
    const intervenants = await window.api.intervenants.getAll();
    
    document.getElementById('session-projet').innerHTML = projets.map(p => `<option value="${p.id}">${p.code_projet} — ${p.intitule}</option>`).join('');
    document.getElementById('session-intervenant').innerHTML = intervenants.map(i => `<option value="${i.id}">[${i.type_role}] ${i.raison_sociale}</option>`).join('');
}

async function submitNewSession() {
    const data = Object.fromEntries(new FormData(document.getElementById('form-new-session')));
    if (!data.username || !data.password_hash) { showToast('Erreur', 'Champs requis manquants.', 'danger'); return; }
    try {
        await window.api.sessions.create(data);
        closeModal();
        showToast('Succès', 'Session créée.', 'success');
        navigateTo('sessions');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

// ============================================================
// DÉLAIS & PLANNING (Gantt par lot, sans chevauchement)
// ============================================================

// Calcule les indicateurs de délai d'un lot à partir de ses OS
function computeLotDelai(lot, osList) {
    const commencementOS = osList.find(o => o.type_os === 'Commencement');
    const start = lot.date_os_commencement || (commencementOS ? commencementOS.date_effet : null);
    // Prolongations cumulées
    const prolongation = osList.filter(o => o.type_os === 'Prolongation').reduce((s, o) => s + (o.delai_jours || 0), 0);
    // Arrêts (délai suspendu — approximé par la somme des délais d'arrêt déclarés)
    const dureeContractuelle = (lot.duree_jours || 0) + prolongation;
    let end = null, consomme = 0, restant = null, retard = 0, pct = 0;
    if (start) {
        const d0 = new Date(start);
        end = new Date(d0); end.setDate(end.getDate() + dureeContractuelle);
        const today = new Date();
        consomme = Math.max(0, Math.ceil((today - d0) / 86400000));
        restant = Math.ceil((end - today) / 86400000);
        pct = dureeContractuelle > 0 ? Math.min(100, Math.round((consomme / dureeContractuelle) * 100)) : 0;
        if (today > end && !['Terminé', 'Réceptionné'].includes(lot.statut)) retard = Math.ceil((today - end) / 86400000);
    }
    return { start, end, dureeContractuelle, prolongation, consomme, restant, retard, pct };
}

async function renderDelais(container) {
    updatePageTitle('Délais & Planning');
    const projets = await window.api.projets.getAll();
    const projetId = window._delaisProjet || projets[0]?.id;

    if (!projetId) {
        container.innerHTML = '<div class="empty-state"><h4>Aucun projet</h4></div>';
        return;
    }

    const projet = await window.api.projets.get(projetId);
    const lots = await window.api.lots.getByProjet(projetId);
    const interfaces = await window.api.interfaces.getByProjet(projetId);
    const interfaceStats = await window.api.interfaces.getStats(projetId);

    // Récupérer les OS de chaque lot et calculer les délais
    const rows = [];
    for (const lot of lots) {
        const osList = await window.api.os.getByLot(lot.id);
        rows.push({ lot, os: osList, delai: computeLotDelai(lot, osList) });
    }

    // Bornes temporelles globales pour le Gantt
    const dates = rows.filter(r => r.delai.start).flatMap(r => [new Date(r.delai.start), r.delai.end]);
    let minD = dates.length ? new Date(Math.min(...dates)) : new Date();
    let maxD = dates.length ? new Date(Math.max(...dates)) : new Date();
    // marge
    minD.setDate(minD.getDate() - 10); maxD.setDate(maxD.getDate() + 10);
    const totalSpan = Math.max(1, (maxD - minD) / 86400000);
    const today = new Date();
    const todayPct = Math.min(100, Math.max(0, ((today - minD) / 86400000 / totalSpan) * 100));

    const enRetard = rows.filter(r => r.delai.retard > 0).length;
    const echeanceProche = rows.filter(r => r.delai.restant !== null && r.delai.restant >= 0 && r.delai.restant <= 30 && !['Terminé', 'Réceptionné'].includes(r.lot.statut)).length;

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Délais & Planning</h2><p>Suivi des délais contractuels par lot — pilotage de l'allotissement</p></div>
            <button class="btn btn-secondary" onclick="exportDelais(${projetId})"><i data-lucide="printer"></i> Exporter le planning</button>
        </div>

        <div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" onchange="window._delaisProjet=parseInt(this.value);navigateTo('delais')">
                ${projets.map(p => `<option value="${p.id}" ${p.id === projetId ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
        </div>

        <div class="stats-grid animate-fade-in-up delay-1">
            <div class="stat-card stat-info"><div class="stat-icon icon-info"><i data-lucide="layers"></i></div><div class="stat-content"><div class="stat-value">${rows.length}</div><div class="stat-label">Lots</div></div></div>
            <div class="stat-card ${enRetard > 0 ? 'stat-danger' : 'stat-success'}"><div class="stat-icon ${enRetard > 0 ? 'icon-danger' : 'icon-success'}"><i data-lucide="alert-octagon"></i></div><div class="stat-content"><div class="stat-value">${enRetard}</div><div class="stat-label">Lot(s) en retard</div></div></div>
            <div class="stat-card stat-warning"><div class="stat-icon icon-warning"><i data-lucide="hourglass"></i></div><div class="stat-content"><div class="stat-value">${echeanceProche}</div><div class="stat-label">Échéance ≤ 30j</div></div></div>
            <div class="stat-card stat-primary"><div class="stat-icon icon-primary"><i data-lucide="calendar-check"></i></div><div class="stat-content"><div class="stat-value">${formatDate(projet.date_fin_prevue)}</div><div class="stat-label">Fin prévue projet</div></div></div>
        </div>

        <!-- Gantt -->
        <div class="card animate-fade-in-up delay-2">
            <div class="card-header"><h4><i data-lucide="gantt-chart" style="width:18px;height:18px;margin-right:8px;"></i>Planning des lots</h4>
                <div class="text-xs text-muted">${formatDate(minD)} → ${formatDate(maxD)}</div>
            </div>
            <div class="card-body">
                <div class="gantt">
                    <div class="gantt-today" style="left: calc(240px + (100% - 240px) * ${todayPct} / 100);" title="Aujourd'hui"></div>
                    ${rows.map(r => {
                        const d = r.delai;
                        let barHtml = '<span class="text-xs text-muted">Pas d\'OS de commencement</span>';
                        if (d.start) {
                            const offset = ((new Date(d.start) - minD) / 86400000 / totalSpan) * 100;
                            const width = ((d.end - new Date(d.start)) / 86400000 / totalSpan) * 100;
                            const barColor = d.retard > 0 ? 'var(--danger)' : (d.pct >= 90 ? 'var(--warning)' : 'var(--primary)');
                            barHtml = `<div class="gantt-bar" style="left:${offset}%; width:${Math.max(2, width)}%; background:${barColor};">
                                <span class="gantt-bar-label">${d.pct}%</span>
                            </div>`;
                        }
                        return `
                        <div class="gantt-row">
                            <div class="gantt-label">
                                <div class="d-flex align-center gap-sm"><span class="badge badge-info">${r.lot.code_lot}</span> ${statusBadge(r.lot.statut)}</div>
                                <div class="text-xs text-muted mt-sm truncate" title="${r.lot.designation}">${r.lot.designation}</div>
                                ${d.retard > 0 ? `<div class="text-xs text-danger font-bold mt-sm">⚠ Retard ${d.retard}j</div>` : (d.restant !== null && d.restant >= 0 ? `<div class="text-xs text-muted mt-sm">Reste ${d.restant}j</div>` : '')}
                            </div>
                            <div class="gantt-track">${barHtml}</div>
                        </div>`;
                    }).join('') || '<div class="empty-state"><p class="text-muted">Aucun lot</p></div>'}
                </div>
            </div>
        </div>

        <!-- Tableau détaillé -->
        <div class="table-wrapper animate-fade-in-up delay-3 mt-lg">
            <table class="data-table">
                <thead><tr><th>Lot</th><th>Entreprise</th><th>Début (OS)</th><th>Délai contract.</th><th>Fin contract.</th><th>Consommé</th><th>Restant</th><th>État délai</th></tr></thead>
                <tbody>
                    ${rows.map(r => {
                        const d = r.delai;
                        const etat = d.retard > 0 ? `<span class="badge badge-danger">Retard ${d.retard}j</span>` : (d.restant === null ? '<span class="badge badge-muted">Non démarré</span>' : (d.restant <= 30 ? '<span class="badge badge-warning">Échéance proche</span>' : '<span class="badge badge-success">Dans les délais</span>'));
                        return `<tr>
                            <td><span class="badge badge-info">${r.lot.code_lot}</span></td>
                            <td class="text-sm">${r.lot.entreprise_nom || '—'}</td>
                            <td>${formatDate(d.start)}</td>
                            <td>${d.dureeContractuelle} j${d.prolongation ? ` <span class="text-xs text-info">(+${d.prolongation})</span>` : ''}</td>
                            <td>${d.end ? formatDate(d.end) : '—'}</td>
                            <td>${d.start ? d.consomme + ' j' : '—'}</td>
                            <td class="${d.retard > 0 ? 'text-danger font-bold' : ''}">${d.restant !== null ? d.restant + ' j' : '—'}</td>
                            <td>${etat}</td>
                        </tr>`;
                    }).join('') || '<tr><td colspan="8" class="text-center text-muted p-lg">Aucun lot</td></tr>'}
                </tbody>
            </table>
        </div>

        <!-- Interfaces / dépendances entre lots -->
        <div class="card mt-lg animate-fade-in-up delay-3">
            <div class="card-header">
                <h4><i data-lucide="link" style="width:18px;height:18px;margin-right:8px;"></i>Interfaces entre lots — réservations, baies, supports…</h4>
                <button class="btn btn-primary btn-sm" onclick="showNewInterfaceModal(${projetId})"><i data-lucide="plus"></i> Nouvelle interface</button>
            </div>
            <div class="card-body">
                <p class="text-xs text-muted mb-md">Les prestations d'un lot (ex : réservations & baies du Gros Œuvre) conditionnent le démarrage des lots secondaires (fluides, CVC, courants forts/faibles, menuiserie, revêtements, faux plafonds…). ${interfaceStats.enAttente > 0 ? `<strong class="text-danger">${interfaceStats.enAttente} interface(s) non livrée(s) — risque de blocage.</strong>` : ''}</p>
                ${interfaces.length > 0 ? `
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Lot source (fournit)</th><th>Type d'interface</th><th>Lot cible (dépend)</th><th>Prévu</th><th>Statut</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${interfaces.map(it => `
                                <tr>
                                    <td><span class="badge badge-info">${it.source_code}</span> <span class="text-xs text-muted">${it.source_designation}</span></td>
                                    <td>${it.type_interface}${it.description ? `<div class="text-xs text-muted">${it.description}</div>` : ''}</td>
                                    <td><span class="badge badge-secondary">${it.cible_code}</span> <span class="text-xs text-muted">${it.cible_designation}</span></td>
                                    <td class="text-xs ${it.date_prevue && isOverdue(it.date_prevue) && it.statut !== 'Livré' ? 'text-danger font-bold' : 'text-muted'}">${formatDate(it.date_prevue)}</td>
                                    <td>${interfaceStatutBadge(it.statut)}</td>
                                    <td class="actions">
                                        ${it.statut !== 'Livré' ? `<button class="btn btn-ghost btn-sm" title="Marquer prêt" onclick="setInterfaceStatut(${it.id},'Prêt')"><i data-lucide="check"></i></button><button class="btn btn-ghost btn-sm" title="Marquer livré" onclick="setInterfaceStatut(${it.id},'Livré')"><i data-lucide="check-check"></i></button>` : ''}
                                        ${it.statut === 'En attente' ? `<button class="btn btn-ghost btn-sm" title="Bloqué" onclick="setInterfaceStatut(${it.id},'Bloqué')"><i data-lucide="ban"></i></button>` : ''}
                                        <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteInterface(${it.id})"><i data-lucide="trash-2"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>` : '<div class="empty-state p-lg"><p class="text-muted">Aucune interface définie. Déclarez les dépendances entre lots (ex : réservations GO → fluides).</p></div>'}
            </div>
        </div>
    `;
}

function interfaceStatutBadge(s) {
    const map = { 'En attente': 'badge-warning', 'Prêt': 'badge-info', 'Livré': 'badge-success', 'Bloqué': 'badge-danger' };
    return `<span class="badge ${map[s] || 'badge-muted'}">${s}</span>`;
}

async function showNewInterfaceModal(projetId) {
    const lots = await window.api.lots.getByProjet(projetId);
    if (lots.length < 2) { showToast('Info', 'Il faut au moins 2 lots pour définir une interface.', 'warning'); return; }
    const types = ['Réservations', 'Baies', 'Support / Dalle', 'Étanchéité préalable', 'Alimentation / Attente', 'Trémie', 'Scellement', 'Autre'];
    const opts = lots.map(l => `<option value="${l.id}">${l.code_lot} — ${l.designation}</option>`).join('');
    const body = `
        <form id="form-interface">
            <input type="hidden" name="projet_id" value="${projetId}">
            <p class="text-sm text-muted mb-md">Déclarez qu'un lot <strong>fournit</strong> une prestation (réservations, baies…) nécessaire à un autre lot.</p>
            <div class="form-group"><label class="form-label required">Lot source (qui fournit)</label><select class="form-control" name="lot_source_id">${opts}</select></div>
            <div class="form-group"><label class="form-label required">Type d'interface</label><select class="form-control" name="type_interface">${types.map(t => `<option>${t}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label required">Lot cible (qui dépend)</label><select class="form-control" name="lot_cible_id">${opts}</select></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Date prévue de livraison</label><input type="date" class="form-control" name="date_prevue"></div>
            </div>
            <div class="form-group"><label class="form-label">Description</label><input type="text" class="form-control" name="description" placeholder="Ex : Réservations gaines fluides + baies fenêtres façade Sud"></div>
        </form>
    `;
    openModal('Nouvelle interface entre lots', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitInterface(${projetId})">Enregistrer</button>
    `, 'lg');
    // pré-sélectionner un cible différent de la source
    setTimeout(() => { const c = document.querySelector('#form-interface [name=lot_cible_id]'); if (c && lots.length > 1) c.selectedIndex = 1; }, 50);
}

async function submitInterface(projetId) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-interface')));
    if (data.lot_source_id === data.lot_cible_id) { showToast('Erreur', 'Le lot source et le lot cible doivent être différents.', 'danger'); return; }
    try {
        await window.api.interfaces.create(data);
        closeModal();
        showToast('Succès', 'Interface enregistrée.', 'success');
        navigateTo('delais');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function setInterfaceStatut(id, statut) {
    await window.api.interfaces.updateStatut(id, statut);
    showToast('Mis à jour', `Interface : ${statut}.`, 'success');
    navigateTo('delais');
}

async function deleteInterface(id) {
    if (!confirm('Supprimer cette interface ?')) return;
    await window.api.interfaces.delete(id);
    showToast('Supprimée', 'Interface supprimée.', 'success');
    navigateTo('delais');
}

async function exportDelais(projetId) {
    const projet = await window.api.projets.get(projetId);
    const lots = await window.api.lots.getByProjet(projetId);
    const rows = [];
    for (const lot of lots) {
        const osList = await window.api.os.getByLot(lot.id);
        rows.push({ lot, delai: computeLotDelai(lot, osList) });
    }
    const tableRows = rows.map(r => {
        const d = r.delai;
        const etat = d.retard > 0 ? `RETARD ${d.retard}j` : (d.restant === null ? 'Non démarré' : (d.restant <= 30 ? 'Échéance proche' : 'Dans les délais'));
        return `<tr><td>${r.lot.code_lot} — ${r.lot.designation}</td><td>${r.lot.entreprise_nom || '—'}</td><td>${formatDate(d.start)}</td><td>${d.dureeContractuelle} j</td><td>${d.end ? formatDate(d.end) : '—'}</td><td>${d.start ? d.consomme + ' j' : '—'}</td><td>${d.restant !== null ? d.restant + ' j' : '—'}</td><td>${etat}</td></tr>`;
    }).join('');
    const html = buildDocHtml(`Planning & délais — ${projet.code_projet}`, `
        <h1>Suivi des délais — ${projet.intitule}</h1>
        <p class="meta">${projet.code_projet} · ${projet.maitre_ouvrage} · Édité le ${formatDate(new Date())}</p>
        <table class="doc-table">
            <thead><tr><th>Lot</th><th>Entreprise</th><th>Début OS</th><th>Délai</th><th>Fin contractuelle</th><th>Consommé</th><th>Restant</th><th>État</th></tr></thead>
            <tbody>${tableRows}</tbody>
        </table>
    `);
    const res = await window.api.docs.generate({ html, filename: `Planning_${projet.code_projet}`, subdir: 'Plannings' });
    if (res.success) showToast('Planning exporté', 'Document ouvert. Utilisez Ctrl+P pour imprimer ou enregistrer en PDF.', 'success');
    else showToast('Erreur', res.error || 'Export impossible', 'danger');
}

// ============================================================
// ORDRES DE SERVICE
// ============================================================
// Générateur d'axe de délai — cycle complet du projet (dates OS + décomptes → délai restant)
async function renderDelaiAxis(container) {
    const isM = isMOD();
    const projets = isM ? await window.api.projets.getAll() : [];
    const projetId = isM ? (window._axeProjet && projets.some(p => p.id === window._axeProjet) ? window._axeProjet : projets[0]?.id) : currentUser.projet_id;
    if (!projetId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📏</div><h4>Aucun projet</h4></div>'; return; }
    if (isM) window._axeProjet = projetId;
    const axis = await window.api.timeline.axis(projetId);
    window._axeData = axis;
    const withData = axis.lots.filter(l => l.hasData);

    const posPct = (lot, dateStr) => {
        const d0 = new Date(lot.debut).getTime(), d1 = new Date(lot.finPrev).getTime(), dx = new Date(dateStr).getTime();
        if (!d1 || d1 <= d0) return 0;
        return Math.max(0, Math.min(100, Math.round((dx - d0) / (d1 - d0) * 100)));
    };
    const evColor = (e) => e.type === 'fin' ? 'var(--danger)' : (e.type === 'decompte' ? (e.statut === 'Payé' ? 'var(--success)' : 'var(--warning)') : 'var(--primary)');

    const lotCard = (lot) => {
        const todayPos = posPct(lot, axis.today);
        const restBadge = lot.resilie ? `<span class="badge badge-danger">Résilié le ${formatDate(lot.resilie)}</span>` : (lot.restant < 0 ? `<span class="badge badge-danger">Dépassé de ${-lot.restant} j</span>` : `<span class="badge badge-success">${lot.restant} j restants</span>`);
        return `
      <div class="card mt-lg">
        <div class="card-header d-flex justify-between align-center flex-wrap gap-md">
          <h4><span class="badge badge-info">${lot.code_lot}</span> ${lot.designation}</h4>
          <div>${restBadge}</div>
        </div>
        <div class="card-body">
          <div class="stats-grid mb-md">
            <div class="stat-card"><div class="stat-content"><div class="stat-value text-sm">${formatDate(lot.debut)}</div><div class="stat-label">Début (OS)</div></div></div>
            <div class="stat-card"><div class="stat-content"><div class="stat-value text-sm">${lot.delaiContractuel} j${lot.prolong ? ` <span class="text-xs text-muted">(+${lot.prolong})</span>` : ''}</div><div class="stat-label">Délai contractuel</div></div></div>
            <div class="stat-card"><div class="stat-content"><div class="stat-value text-sm">${lot.suspended} j</div><div class="stat-label">Jours d'arrêt</div></div></div>
            <div class="stat-card"><div class="stat-content"><div class="stat-value text-sm">${formatDate(lot.finPrev)}</div><div class="stat-label">Fin prévisionnelle</div></div></div>
          </div>
          <div class="d-flex justify-between text-xs text-muted mb-sm flex-wrap gap-sm"><span>Consommé : <strong>${lot.ecoulesNet} j (${lot.pct}%)</strong></span><span>${lot.nbDecomptes} décompte(s) · ${formatCurrency(lot.totalPaye)} payé</span></div>
          <div style="position:relative;height:60px;margin:24px 8px 28px;">
            <div style="position:absolute;top:26px;left:0;right:0;height:6px;background:var(--bg-tertiary);border-radius:3px;"></div>
            <div style="position:absolute;top:26px;left:0;width:${todayPos}%;height:6px;background:var(--primary);border-radius:3px;"></div>
            <div style="position:absolute;top:10px;left:${todayPos}%;transform:translateX(-50%);text-align:center;z-index:2;">
              <div style="font-size:9px;color:var(--danger);font-weight:700;white-space:nowrap;">Auj.</div>
              <div style="width:2px;height:32px;background:var(--danger);margin:0 auto;"></div>
            </div>
            ${lot.events.map(e => { const x = posPct(lot, e.date); return `<div title="${e.label} · ${formatDate(e.date)}" style="position:absolute;top:22px;left:${x}%;transform:translateX(-50%);width:13px;height:13px;border-radius:50%;background:${evColor(e)};border:2px solid var(--bg-primary);cursor:help;z-index:1;"></div>`; }).join('')}
          </div>
        </div>
      </div>`;
    };

    container.innerHTML = `
    <div class="page-header animate-fade-in-up">
      <div><h2>Axe de délai — cycle complet</h2><p>Extraction automatique des dates (OS + décomptes) pour déduire le délai restant</p></div>
      <button class="btn btn-secondary" onclick="generateDelaiAxisDoc()"><i data-lucide="printer"></i> Générer / imprimer</button>
    </div>
    ${isM ? `<div class="filter-bar animate-fade-in-up delay-1">
      <select class="form-control" onchange="window._axeProjet=parseInt(this.value);renderDelaiAxis(document.getElementById('hub-axe'))">
        ${projets.map(p => `<option value="${p.id}" ${p.id === projetId ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
      </select>
    </div>` : ''}
    <div class="d-flex gap-md flex-wrap text-xs text-muted mb-md">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--primary);vertical-align:-1px;"></span> OS</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--warning);vertical-align:-1px;"></span> Décompte</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--success);vertical-align:-1px;"></span> Décompte payé</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--danger);vertical-align:-1px;"></span> Fin prévisionnelle</span>
    </div>
    ${withData.length ? withData.map(lotCard).join('') : '<div class="empty-state"><div class="empty-state-icon">📏</div><h4>Aucun OS de commencement</h4><p>Émettez un OS de commencement (avec délai) pour générer l\'axe de délai.</p></div>'}
  `;
    if (window.lucide) lucide.createIcons({ node: container });
}

async function generateDelaiAxisDoc() {
    const axis = window._axeData;
    if (!axis) { showToast('Info', 'Aucune donnée à générer.', 'info'); return; }
    const withData = axis.lots.filter(l => l.hasData);
    const rows = withData.map(l => `<tr><td>${l.code_lot} — ${l.designation}</td><td>${l.debut || '—'}</td><td>${l.delaiContractuel} j${l.prolong ? ' (+' + l.prolong + ')' : ''}</td><td>${l.suspended} j</td><td>${l.finPrev || '—'}</td><td style="font-weight:bold;color:${l.restant < 0 ? '#c0392b' : '#27ae60'}">${l.resilie ? 'Résilié' : (l.restant < 0 ? 'Dépassé ' + (-l.restant) + ' j' : l.restant + ' j')}</td><td>${l.pct}%</td><td>${formatCurrency(l.totalPaye)}</td></tr>`).join('');
    const html = `<h1 style="font-size:18px;">Axe de délai — cycle du projet</h1>
      <p style="color:#555;font-size:12px;">Édité le ${new Date().toLocaleDateString('fr-FR')} · Déduction automatique à partir des OS et des décomptes</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead style="background:#eef2ff;"><tr><th>Lot</th><th>Début</th><th>Délai contractuel</th><th>Jours d'arrêt</th><th>Fin prévisionnelle</th><th>Délai restant</th><th>% consommé</th><th>Payé</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8" style="text-align:center;">Aucun OS de commencement</td></tr>'}</tbody>
      </table>`;
    try { await window.api.docs.generate({ html, filename: 'axe_delai_projet_' + (axis.projetId || '') }); showToast('Généré', 'Axe de délai généré (imprimable / PDF).', 'success'); }
    catch (e) { showToast('Erreur', e.message, 'danger'); }
}

async function renderOrdresService(container) {
    updatePageTitle('Ordres de Service');
    const projets = await window.api.projets.getAll();
    const projetId = window._osProjet && projets.some(p => p.id === window._osProjet) ? window._osProjet : projets[0]?.id;
    window._osProjet = projetId;
    const os = projetId ? await window.api.os.getByProjet(projetId) : [];
    window._osList = os;
    // Chaîne des OS liés (arrêt d'un lot → reprise/prolongation des lots dépendants)
    const chaines = os.filter(o => o.os_lie_numero).length;

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div>
                <h2>Ordres de Service</h2>
                <p>Contrôle total (maître d'ouvrage) — création, modification, suppression, version signée scannée, et <strong>liaison entre lots</strong></p>
            </div>
            <button class="btn btn-primary" onclick="showNewOSModal()">
                <i data-lucide="file-plus"></i> Nouvel OS
            </button>
        </div>

        <div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" id="os-projet-filter" onchange="window._osProjet=parseInt(this.value);navigateTo('ordres-service')">
                ${projets.map(p => `<option value="${p.id}" ${p.id === projetId ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
            ${chaines ? `<span class="text-xs text-muted"><i data-lucide="link" style="width:13px;height:13px;vertical-align:-2px;"></i> ${chaines} OS lié(s) entre lots</span>` : ''}
        </div>

        <div id="os-list" class="table-wrapper animate-fade-in-up delay-2">
            <table class="data-table">
                <thead><tr><th>N° OS</th><th>Lot</th><th>Type</th><th>Objet</th><th>Notif.</th><th>Effet</th><th>Délai</th><th>Lié à</th><th>Pièces</th><th>Actions</th></tr></thead>
                <tbody>
                    ${os.map(o => `
                        <tr>
                            <td class="font-medium">${o.numero_os}</td>
                            <td><span class="badge badge-info">${o.code_lot}</span></td>
                            <td>${statusBadge(o.type_os)}</td>
                            <td class="text-sm">${o.objet}</td>
                            <td class="text-xs text-muted">${formatDate(o.date_notification)}</td>
                            <td class="text-xs text-muted">${formatDate(o.date_effet)}</td>
                            <td class="text-xs">${o.delai_jours ? o.delai_jours + ' j' : '—'}</td>
                            <td class="text-xs">${o.os_lie_numero ? `<span class="badge badge-muted" title="Dépend de ${o.os_lie_numero} (${o.os_lie_lot || ''})"><i data-lucide="link" style="width:11px;height:11px;vertical-align:-1px;"></i> ${o.os_lie_numero}</span>` : '—'}</td>
                            <td class="text-xs">${o.nb_pieces > 0 ? `<span class="badge badge-success">${o.nb_pieces}</span>` : '—'}</td>
                            <td class="actions">
                                <button class="btn btn-ghost btn-sm" title="Version signée / pièces jointes" onclick="showEntityDocs('os', ${o.id}, ${projetId}, 'OS ${o.numero_os}')"><i data-lucide="paperclip"></i></button>
                                <button class="btn btn-ghost btn-sm" title="Propager aux lots dépendants" onclick="propagateOS(${o.id})"><i data-lucide="git-branch"></i></button>
                                <button class="btn btn-ghost btn-sm" title="Modifier" onclick="editOS(${o.id})"><i data-lucide="pencil"></i></button>
                                <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteOS(${o.id})"><i data-lucide="trash-2"></i></button>
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="10" class="text-center text-muted p-lg">Aucun OS</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function showNewOSModal(os = null) {
    const types = ['Commencement', 'Arrêt', 'Reprise', 'Prolongation', 'Résiliation'];
    const v = (f) => os && os[f] != null ? String(os[f]).replace(/"/g, '&quot;') : '';
    const body = `
        <form id="form-new-os">
            <div class="form-row">
                <div class="form-group"><label class="form-label required">N° OS</label><input type="text" class="form-control" name="numero_os" value="${v('numero_os')}" required></div>
                <div class="form-group"><label class="form-label required">Type</label>
                    <select class="form-control" name="type_os">${types.map(t => `<option ${os && os.type_os === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
                </div>
            </div>
            <div class="form-group"><label class="form-label required">Lot</label><select class="form-control" name="lot_id" id="os-lot-select"></select></div>
            <div class="form-group"><label class="form-label required">Objet</label><input type="text" class="form-control" name="objet" value="${v('objet')}" required></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label required">Date Notification</label><input type="date" class="form-control" name="date_notification" value="${v('date_notification')}" required></div>
                <div class="form-group"><label class="form-label required">Date d'Effet</label><input type="date" class="form-control" name="date_effet" value="${v('date_effet')}" required></div>
                <div class="form-group"><label class="form-label">Délai (jours)</label><input type="number" class="form-control" name="delai_jours" value="${v('delai_jours')}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Date fin d'effet</label><input type="date" class="form-control" name="date_fin_effet" value="${v('date_fin_effet')}"></div>
                <div class="form-group"><label class="form-label">OS lié (dépendance d'un autre lot)</label><select class="form-control" name="os_lie_id" id="os-lie-select"><option value="">— Aucun —</option></select></div>
            </div>
            <div class="form-group"><label class="form-label">Motif</label><textarea class="form-control" name="motif" rows="2">${v('motif')}</textarea></div>
            <div class="form-group"><label class="form-label">Observations</label><textarea class="form-control" name="observations" rows="2">${v('observations')}</textarea></div>
            <div class="form-group"><label class="form-label"><i data-lucide="paperclip" style="width:14px;height:14px;vertical-align:-2px;"></i> Fichier joint (version signée scannée, Excel, PDF, Word…)</label>
                <input type="file" class="form-control" id="os-file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp">
                <span class="text-xs text-muted">Optionnel — joint directement à l'ordre de service (plusieurs fichiers possibles).</span></div>
        </form>
    `;
    openModal(os && os.id ? "Modifier l'ordre de service" : 'Nouvel Ordre de Service', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitOS(${os && os.id ? os.id : 'null'})">Enregistrer</button>
    `, 'lg');
    loadOSLots(os ? os.lot_id : null);
    loadOSLieOptions(os ? os.os_lie_id : null, os ? os.id : null);
}

// Peuple la liste des OS liables (OS des autres lots du même projet)
async function loadOSLieOptions(selectedId = null, currentOsId = null) {
    const sel = document.getElementById('os-lie-select');
    if (!sel) return;
    const projetId = window._osProjet || (await window.api.projets.getAll())[0]?.id;
    const list = projetId ? await window.api.os.getByProjet(projetId) : [];
    sel.innerHTML = '<option value="">— Aucun —</option>' + list.filter(o => o.id !== currentOsId).map(o =>
        `<option value="${o.id}" ${selectedId === o.id ? 'selected' : ''}>[${o.code_lot}] ${o.numero_os} — ${o.type_os}</option>`).join('');
}

async function loadOSLots(selectedLotId = null) {
    const projets = await window.api.projets.getAll();
    const allLots = [];
    for (const p of projets) {
        const lots = await window.api.lots.getByProjet(p.id);
        lots.forEach(l => allLots.push({ ...l, projet_code: p.code_projet }));
    }
    document.getElementById('os-lot-select').innerHTML = allLots.map(l => `<option value="${l.id}" ${selectedLotId === l.id ? 'selected' : ''}>[${l.projet_code}] ${l.code_lot} — ${l.designation}</option>`).join('');
}

// Lit les fichiers d'un <input type=file> en dataURL base64
function readFilesAsDataUrls(inputEl) {
    const files = Array.from((inputEl && inputEl.files) || []);
    return Promise.all(files.map(f => new Promise(resolve => {
        const r = new FileReader();
        r.onload = () => resolve({ name: f.name, dataUrl: r.result });
        r.onerror = () => resolve(null);
        r.readAsDataURL(f);
    }))).then(arr => arr.filter(Boolean));
}

async function submitOS(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-new-os')));
    if (!data.numero_os || !data.objet) { showToast('Erreur', 'Champs requis manquants.', 'danger'); return; }
    // Nettoyage : os_lie_id / date_fin_effet vides → null
    data.os_lie_id = data.os_lie_id ? parseInt(data.os_lie_id) : null;
    if (!data.date_fin_effet) data.date_fin_effet = null;
    const fileInput = document.getElementById('os-file');
    const hasFiles = fileInput && fileInput.files && fileInput.files.length > 0;
    try {
        let osId = id;
        if (id) { await window.api.os.update(id, data); }
        else { const res = await window.api.os.create(data); osId = res && res.lastInsertRowid; }
        // Pièce(s) jointe(s) choisie(s) dans le formulaire → upload sur l'OS
        if (osId && hasFiles) {
            const files = await readFilesAsDataUrls(fileInput);
            if (files.length) {
                const acteur = currentUser.role === 'MOD' ? (currentUser.nom || 'MOD') : (currentUser.raison_sociale || currentUser.role);
                await window.api.documents.uploadData({ files, meta: { entite_type: 'os', entite_id: osId, projet_id: window._osProjet || null, type_document: 'Autre', categorie: 'Pièce jointe', uploaded_by: acteur, uploaded_by_role: currentUser.role } });
            }
        }
        showToast('Succès', id ? 'Ordre de service modifié.' : `Ordre de service créé${hasFiles ? ' avec pièce(s) jointe(s)' : ''}.`, 'success');
        closeModal();
        navigateTo('ordres-service');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

// Propagation d'un OS aux lots dépendants (maîtrise du chevauchement des délais entre lots)
async function propagateOS(osId) {
    const os = (window._osList || []).find(o => o.id === osId) || null;
    if (!os) { showToast('Erreur', 'OS introuvable.', 'danger'); return; }
    const deps = await window.api.os.getDependentLots(os.lot_id);
    if (!deps.length) {
        showToast('Aucun lot dépendant', `Le lot ${os.code_lot} n'a pas d'interface déclarée. Déclarez les dépendances dans « Interfaces entre lots ».`, 'warning');
        return;
    }
    const body = `
        <div class="mb-md text-sm">Répercuter l'OS <strong>${os.numero_os}</strong> (${os.type_os}) du lot <span class="badge badge-info">${os.code_lot}</span> sur les lots dépendants.
        Un OS <strong>lié</strong> sera créé pour chaque lot coché, avec les mêmes dates — pour garder les délais synchronisés.</div>
        <div class="card-flat" style="border:1px solid var(--border-color);border-radius:8px;padding:6px 12px;">
            ${deps.map(l => `<label class="d-flex align-center gap-sm" style="padding:7px 0;border-bottom:1px solid var(--border-color);cursor:pointer;">
                <input type="checkbox" class="os-prop-lot" value="${l.id}" checked>
                <span><span class="badge badge-info">${l.code_lot}</span> ${l.designation} <span class="text-xs text-muted">· interface : ${l.type_interface}</span></span>
            </label>`).join('')}
        </div>`;
    openModal('Propager l\'OS aux lots dépendants', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitPropagateOS(${osId})"><i data-lucide="git-branch"></i> Créer les OS liés</button>`, 'lg');
    if (window.lucide) lucide.createIcons();
}

async function submitPropagateOS(osId) {
    const os = (window._osList || []).find(o => o.id === osId);
    if (!os) return;
    const lotIds = Array.from(document.querySelectorAll('.os-prop-lot:checked')).map(c => parseInt(c.value));
    if (!lotIds.length) { showToast('Rien à faire', 'Sélectionnez au moins un lot.', 'warning'); return; }
    if (!confirm(`Créer ${lotIds.length} OS lié(s) « ${os.type_os} » sur les lots dépendants ?`)) return;
    try {
        for (const lotId of lotIds) {
            const lot = (await window.api.lots.getByProjet(window._osProjet)).find(l => l.id === lotId);
            const suffix = lot ? '-' + lot.code_lot : '-L' + lotId;
            await window.api.os.create({
                lot_id: lotId,
                numero_os: os.numero_os + suffix,
                type_os: os.type_os,
                objet: '[Lié à ' + os.numero_os + '] ' + os.objet,
                date_notification: os.date_notification,
                date_effet: os.date_effet,
                delai_jours: os.delai_jours || 0,
                date_fin_effet: os.date_fin_effet || null,
                motif: os.motif || ('Répercussion de l\'OS ' + os.numero_os + ' du lot ' + os.code_lot),
                observations: os.observations || null,
                os_lie_id: osId
            });
        }
        closeModal();
        showToast('OS propagés', `${lotIds.length} OS lié(s) créé(s) — délais synchronisés entre lots.`, 'success');
        navigateTo('ordres-service');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function editOS(id) {
    const projets = await window.api.projets.getAll();
    for (const p of projets) {
        const list = await window.api.os.getByProjet(p.id);
        const os = list.find(o => o.id === id);
        if (os) { showNewOSModal(os); return; }
    }
}

async function deleteOS(id) {
    if (!confirm('Supprimer cet ordre de service ?')) return;
    const res = await window.api.os.delete(id);
    if (res.success) { showToast('Supprimé', 'Ordre de service supprimé.', 'success'); navigateTo('ordres-service'); }
    else showToast('Erreur', 'Suppression impossible.', 'danger');
}

// ============================================================
// RESERVES
// ============================================================
async function renderReserves(container) {
    updatePageTitle('Réserves');
    const reserves = await window.api.reserves.getOuvertes();
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Réserves</h2><p>${reserves.length} réserve(s) ouverte(s)</p></div>
        </div>
        <div class="table-wrapper animate-fade-in-up delay-1">
            <table class="data-table">
                <thead><tr><th>Ouvrage</th><th>Description</th><th>Émetteur</th><th>Gravité</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                    ${reserves.map(r => `
                        <tr>
                            <td><div class="font-medium">${r.ouvrage_nom}</div><div class="text-xs text-muted">${r.bloc || ''} ${r.niveau || ''}</div></td>
                            <td>${r.description}</td>
                            <td>${r.emetteur_nom}</td>
                            <td>${graviteBadge(r.gravite)}</td>
                            <td>${statusBadge(r.statut)}</td>
                            <td class="text-xs text-muted">${formatDate(r.date_emission)}</td>
                            <td class="actions">
                                <button class="btn btn-ghost btn-sm" title="Lever la réserve" onclick="leverReserve(${r.id})"><i data-lucide="check"></i></button>
                                <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteReserve(${r.id})"><i data-lucide="trash-2"></i></button>
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="7" class="text-center text-muted p-lg">Aucune réserve ouverte ✅</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================
// ESSAIS
// ============================================================
async function renderEssais(container) {
    updatePageTitle('Essais Laboratoire');
    const essais = await window.api.essais.getEnCours();
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Essais Laboratoire</h2><p>Suivi des essais en cours et résultats</p></div>
        </div>
        <div class="table-wrapper animate-fade-in-up delay-1">
            <table class="data-table">
                <thead><tr><th>Projet</th><th>Ouvrage</th><th>Type d'essai</th><th>Date Prélèvement</th><th>Échéance 7j</th><th>Résultat 7j</th><th>Échéance 28j</th><th>Résultat 28j</th><th>Conformité</th><th>Actions</th></tr></thead>
                <tbody>
                    ${essais.map(e => `
                        <tr>
                            <td class="text-xs">${e.projet_nom}</td>
                            <td><div class="font-medium text-sm">${e.ouvrage_nom}</div></td>
                            <td>${e.type_essai}</td>
                            <td>${formatDate(e.date_prelevement)}</td>
                            <td class="${isOverdue(e.date_echeance_7j) ? 'text-danger' : ''}">${formatDate(e.date_echeance_7j)}</td>
                            <td>${e.resultat_7j !== null ? e.resultat_7j + ' ' + (e.unite || 'MPa') : '—'}</td>
                            <td class="${isOverdue(e.date_echeance_28j) ? 'text-danger' : ''}">${formatDate(e.date_echeance_28j)}</td>
                            <td>${e.resultat_28j !== null ? e.resultat_28j + ' ' + (e.unite || 'MPa') : '—'}</td>
                            <td>${statusBadge(e.conformite || 'En attente')}</td>
                            <td class="actions"><button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteEssai(${e.id})"><i data-lucide="trash-2"></i></button></td>
                        </tr>
                    `).join('') || '<tr><td colspan="10" class="text-center text-muted p-lg">Aucun essai en cours</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================
// REUNIONS
// ============================================================
async function renderReunions(container) {
    updatePageTitle('Réunions de Chantier');
    const projets = await window.api.projets.getAll();
    const projetId = projets[0]?.id;
    const reunions = projetId ? await window.api.reunions.getByProjet(projetId) : [];
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Réunions de Chantier</h2><p>Planification et invitations</p></div>
            <button class="btn btn-primary" onclick="showNewReunionModal()"><i data-lucide="calendar-plus"></i> Nouvelle Réunion</button>
        </div>
        
        <div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" id="reunion-projet" onchange="filterReunionsByProjet(this.value)">
                ${projets.map(p => `<option value="${p.id}" ${p.id === projetId ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
        </div>
        
        <div id="reunions-list" class="content-grid-2 animate-fade-in-up delay-2">
            ${reunions.map(r => `
                <div class="card">
                    <div class="d-flex justify-between align-center mb-md">
                        <span class="badge badge-primary">${r.numero_reunion}</span>
                        ${statusBadge(r.statut)}
                    </div>
                    <h4 style="font-size: var(--text-md);">Réunion ${r.type_reunion}</h4>
                    <div class="text-sm text-muted mt-sm">
                        <div><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${formatDateTime(r.date_reunion)}</div>
                        <div class="mt-sm"><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${r.lieu || '—'}</div>
                    </div>
                    ${r.ordre_jour ? `<p class="text-xs text-secondary mt-md">${r.ordre_jour}</p>` : ''}
                    <div class="card-footer">
                        <span class="text-xs text-muted">${r.nb_invites || 0} invités (${r.nb_confirmes || 0} confirmés)</span>
                        <div class="d-flex gap-sm">
                            <button class="btn btn-ghost btn-sm" title="Invitations" onclick="showInvitationModal(${r.id})"><i data-lucide="send"></i> Invitations</button>
                            <button class="btn btn-ghost btn-sm" title="Modifier" onclick="editReunion(${r.id})"><i data-lucide="pencil"></i></button>
                            <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteReunion(${r.id}, '${(r.numero_reunion || '').replace(/'/g, ' ')}')"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                </div>
            `).join('') || '<div class="empty-state w-full"><p class="text-muted">Aucune réunion planifiée</p></div>'}
        </div>
    `;
}

// Contexte réunion courant (pour les envois)
let _currentReunion = null;

async function showInvitationModal(reunionId) {
    const reunion = await window.api.reunions.get(reunionId);
    _currentReunion = reunion;
    const invitations = await window.api.invitations.getByReunion(reunionId);
    const projetIntervenants = await window.api.intervenants.getByProjet(reunion.projet_id);
    const invitedIds = new Set(invitations.map(i => i.intervenant_id));
    const nonInvites = projetIntervenants.filter(i => !invitedIds.has(i.id));

    const body = `
        <div class="mb-lg d-flex justify-between align-center flex-wrap gap-md">
            <div>
                <div class="font-semibold">${reunion.numero_reunion} — Réunion ${reunion.type_reunion}</div>
                <div class="text-xs text-muted">${formatDateTime(reunion.date_reunion)} · ${reunion.lieu || 'Lieu à préciser'}</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="generateCollectiveLetter(${reunionId})"><i data-lucide="file-text"></i> Lettre d'invitation officielle</button>
        </div>

        ${nonInvites.length > 0 ? `
        <div class="card-flat mb-lg p-md">
            <div class="d-flex justify-between align-center mb-sm">
                <span class="text-sm font-semibold">Ajouter des invités</span>
                <button class="btn btn-primary btn-sm" onclick="addAllInvitees(${reunionId})"><i data-lucide="users"></i> Tous</button>
            </div>
            <div class="d-flex flex-wrap gap-sm">
                ${nonInvites.map(i => `<button class="btn btn-ghost btn-sm" onclick="addInvitee(${reunionId}, ${i.id})">+ ${roleBadge(i.type_role)} ${i.raison_sociale}</button>`).join('')}
            </div>
        </div>` : ''}

        ${invitations.length > 0 ? `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Rôle</th><th>Intervenant</th><th>Email</th><th>Téléphone</th><th>Envoyer</th></tr></thead>
                    <tbody>
                        ${invitations.map(inv => `
                            <tr>
                                <td>${roleBadge(inv.type_role)}</td>
                                <td class="font-medium">${inv.raison_sociale}</td>
                                <td class="text-xs">${inv.email || '—'}</td>
                                <td class="text-xs">${inv.telephone || '—'}</td>
                                <td class="actions">
                                    ${inv.email ? `<button class="btn btn-ghost btn-sm" title="Email" onclick="sendEmailInvitation('${inv.email}', '${(inv.raison_sociale || '').replace(/'/g, ' ')}')"><i data-lucide="mail"></i></button>` : ''}
                                    ${inv.telephone ? `<button class="btn btn-ghost btn-sm" title="WhatsApp" onclick="sendWhatsAppInvitation('${inv.telephone}', '${(inv.raison_sociale || '').replace(/'/g, ' ')}')"><i data-lucide="message-circle"></i></button>` : ''}
                                    <button class="btn btn-ghost btn-sm" title="Lettre PDF" onclick="generateSingleLetter(${_currentReunion.id}, '${(inv.raison_sociale || '').replace(/'/g, ' ')}', '${(inv.type_role || '')}')"><i data-lucide="printer"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<p class="text-muted p-md">Aucun invité. Ajoutez des intervenants ci-dessus.</p>'}
    `;

    openModal('Invitations — ' + reunion.numero_reunion, body, '<button class="btn btn-ghost" onclick="closeModal()">Fermer</button>', 'lg');
}

async function addInvitee(reunionId, intervenantId) {
    await window.api.invitations.create({ reunion_id: reunionId, intervenant_id: intervenantId, moyen_envoi: 'Email' });
    showToast('Ajouté', 'Invité ajouté à la réunion.', 'success');
    showInvitationModal(reunionId);
}

async function addAllInvitees(reunionId) {
    const reunion = await window.api.reunions.get(reunionId);
    const projetIntervenants = await window.api.intervenants.getByProjet(reunion.projet_id);
    const invitations = await window.api.invitations.getByReunion(reunionId);
    const invitedIds = new Set(invitations.map(i => i.intervenant_id));
    for (const i of projetIntervenants.filter(x => !invitedIds.has(x.id))) {
        await window.api.invitations.create({ reunion_id: reunionId, intervenant_id: i.id, moyen_envoi: 'Email' });
    }
    showToast('Ajoutés', 'Tous les intervenants du projet ont été invités.', 'success');
    showInvitationModal(reunionId);
}

function reunionMessageText(nom) {
    const r = _currentReunion || {};
    return `Bonjour ${nom},\n\nVous êtes cordialement invité(e) à la réunion de chantier ${r.numero_reunion || ''} (${r.type_reunion || 'Ordinaire'}).\n\n📅 Date : ${formatDateTime(r.date_reunion)}\n📍 Lieu : ${r.lieu || 'à préciser'}\n${r.ordre_jour ? '\n📋 Ordre du jour :\n' + r.ordre_jour + '\n' : ''}\nMerci de confirmer votre présence.\n\nCordialement,\nANEP — Maître d'Ouvrage Délégué`;
}

function sendEmailInvitation(email, nom) {
    const r = _currentReunion || {};
    const subject = `Invitation — Réunion de chantier ${r.numero_reunion || ''} (ANEP)`;
    window.api.external.openEmail({ to: email, subject, body: reunionMessageText(nom) });
    showToast('Email', `Ouverture du client mail pour ${nom}`, 'info');
}

function sendWhatsAppInvitation(phone, nom) {
    window.api.external.openWhatsApp({ phone, message: reunionMessageText(nom) });
    showToast('WhatsApp', `Ouverture WhatsApp pour ${nom}`, 'info');
}

// Corps de la lettre d'invitation officielle
function buildInvitationLetterBody(reunion, projet, destinataires) {
    const dateStr = formatDateTime(reunion.date_reunion);
    return `
        <h1>Convocation à une réunion de chantier</h1>
        <p class="meta">Objet : Réunion ${reunion.type_reunion} N° ${reunion.numero_reunion} — Projet ${projet ? projet.code_projet : ''}</p>
        <div class="letter-body">
            <p>Madame, Monsieur,</p>
            <p>Dans le cadre du suivi des travaux du projet <strong>${projet ? projet.intitule : ''}</strong>${projet && projet.localisation ? ` (${projet.localisation})` : ''}, sous maîtrise d'ouvrage déléguée de l'ANEP, vous êtes prié(e) de bien vouloir assister à la réunion de chantier qui se tiendra :</p>
            <p style="text-align:center; font-size:15px;"><strong>Le ${dateStr}</strong><br>${reunion.lieu ? 'Lieu : ' + reunion.lieu : ''}</p>
            ${reunion.ordre_jour ? `<div class="odj"><h3>Ordre du jour</h3><div>${reunion.ordre_jour.replace(/\n/g, '<br>')}</div></div>` : ''}
            ${destinataires && destinataires.length ? `<p><strong>Intervenants convoqués :</strong> ${destinataires.map(d => d.raison_sociale).join(', ')}.</p>` : ''}
            <p>Votre présence, ou celle de votre représentant dûment mandaté, est vivement souhaitée compte tenu de l'importance des points à traiter.</p>
            <p>Dans l'attente, veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
        </div>
        <div class="signature">
            <p class="role">Le Maître d'Ouvrage Délégué</p>
            <p>ANEP — Agence Nationale des Équipements Publics</p>
        </div>
    `;
}

async function generateCollectiveLetter(reunionId) {
    const reunion = await window.api.reunions.get(reunionId);
    const projet = await window.api.projets.get(reunion.projet_id);
    const invitations = await window.api.invitations.getByReunion(reunionId);
    const html = buildDocHtml(`Convocation ${reunion.numero_reunion}`, buildInvitationLetterBody(reunion, projet, invitations));
    const res = await window.api.docs.generate({ html, filename: `Convocation_${reunion.numero_reunion}`, subdir: 'Lettres' });
    if (res.success) showToast('Lettre générée', 'La lettre de convocation est ouverte. Ctrl+P pour imprimer / PDF.', 'success');
    else showToast('Erreur', res.error || 'Génération impossible', 'danger');
}

async function generateSingleLetter(reunionId, nom, role) {
    const reunion = await window.api.reunions.get(reunionId);
    const projet = await window.api.projets.get(reunion.projet_id);
    const body = buildInvitationLetterBody(reunion, projet, null).replace('<p>Madame, Monsieur,</p>', `<p>À l'attention de : <strong>${nom}</strong>${role ? ' (' + role + ')' : ''}</p><p>Madame, Monsieur,</p>`);
    const html = buildDocHtml(`Convocation ${nom}`, body);
    const res = await window.api.docs.generate({ html, filename: `Convocation_${reunion.numero_reunion}_${nom}`, subdir: 'Lettres' });
    if (res.success) showToast('Lettre générée', `Convocation pour ${nom} ouverte.`, 'success');
    else showToast('Erreur', res.error || 'Génération impossible', 'danger');
}

function showNewReunionModal(r = null) {
    const types = ['Ordinaire', 'Extraordinaire', 'Coordination', 'Réception'];
    const v = (f) => r && r[f] != null ? String(r[f]).replace(/"/g, '&quot;') : '';
    // datetime-local attend le format YYYY-MM-DDTHH:mm
    const dtVal = r && r.date_reunion ? String(r.date_reunion).replace(' ', 'T').slice(0, 16) : '';
    const body = `
        <form id="form-new-reunion">
            <div class="form-group"><label class="form-label required">Projet</label><select class="form-control" name="projet_id" id="reunion-projet-select"></select></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label required">N° Réunion</label><input type="text" class="form-control" name="numero_reunion" placeholder="RCH-001" value="${v('numero_reunion')}" required></div>
                <div class="form-group"><label class="form-label">Type</label>
                    <select class="form-control" name="type_reunion">${types.map(t => `<option ${r && r.type_reunion === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label required">Date & Heure</label><input type="datetime-local" class="form-control" name="date_reunion" value="${dtVal}" required></div>
                <div class="form-group"><label class="form-label">Lieu</label><input type="text" class="form-control" name="lieu" placeholder="Bureau de chantier" value="${v('lieu')}"></div>
            </div>
            <div class="form-group"><label class="form-label">Ordre du jour</label><textarea class="form-control" name="ordre_jour" rows="3">${v('ordre_jour')}</textarea></div>
        </form>
    `;
    openModal(r ? 'Modifier la réunion' : 'Nouvelle Réunion', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitReunion(${r ? r.id : 'null'})">${r ? 'Enregistrer' : 'Planifier'}</button>
    `);
    loadReunionProjets(r ? r.projet_id : null);
}

async function loadReunionProjets(selectedId = null) {
    const projets = await window.api.projets.getAll();
    document.getElementById('reunion-projet-select').innerHTML = projets.map(p => `<option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('');
}

async function submitReunion(id) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-new-reunion')));
    if (!data.numero_reunion || !data.date_reunion) { showToast('Erreur', 'Champs requis.', 'danger'); return; }
    try {
        if (id) { await window.api.reunions.update(id, data); showToast('Succès', 'Réunion modifiée.', 'success'); }
        else { await window.api.reunions.create(data); showToast('Succès', 'Réunion planifiée.', 'success'); }
        closeModal();
        navigateTo('reunions');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function editReunion(id) {
    const r = await window.api.reunions.get(id);
    if (r) showNewReunionModal(r);
}

async function deleteReunion(id, num) {
    if (!confirm(`Supprimer la réunion « ${num} » et ses invitations ?`)) return;
    const res = await window.api.reunions.delete(id);
    if (res.success) { showToast('Supprimée', 'Réunion supprimée.', 'success'); navigateTo('reunions'); }
    else showToast('Erreur', 'Suppression impossible.', 'danger');
}

async function filterReunionsByProjet(projetId) {
    const reunions = await window.api.reunions.getByProjet(projetId);
    navigateTo('reunions'); // Simplify: re-render
}

// ============================================================
// REPORTING
// ============================================================
async function renderReporting(container) {
    updatePageTitle('Reporting');
    const stats = await window.api.dashboard.getStats();
    const projets = await window.api.projets.getAll();
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Reporting & Indicateurs</h2><p>Tableaux de bord pour le pilotage et le reportage hiérarchique</p></div>
            <button class="btn btn-secondary" onclick="exportReport()"><i data-lucide="file-down"></i> Exporter le rapport</button>
        </div>

        <div class="content-grid-2 animate-fade-in-up delay-1">
            <div class="card">
                <div class="card-header"><h4>Répartition des projets par statut</h4></div>
                <div class="card-body"><canvas id="chart-statuts" height="250"></canvas></div>
            </div>
            <div class="card">
                <div class="card-header"><h4>Avancement par projet</h4></div>
                <div class="card-body"><canvas id="chart-avancement-report" height="250"></canvas></div>
            </div>
        </div>
        
        <div class="card mt-lg animate-fade-in-up delay-2">
            <div class="card-header"><h4>Synthèse</h4></div>
            <div class="card-body">
                <div class="content-grid-4">
                    <div class="text-center p-lg">
                        ${gaugeChart(stats.avancementMoyen, 'Moyen', 100)}
                    </div>
                    <div class="p-lg">
                        <h5 class="mb-md">Vue d'ensemble</h5>
                        <div class="d-flex justify-between mb-sm"><span class="text-sm text-muted">Projets</span><span class="font-bold">${stats.totalProjets}</span></div>
                        <div class="d-flex justify-between mb-sm"><span class="text-sm text-muted">Lots</span><span class="font-bold">${stats.totalLots}</span></div>
                        <div class="d-flex justify-between mb-sm"><span class="text-sm text-muted">Intervenants</span><span class="font-bold">${stats.totalIntervenants}</span></div>
                        <div class="d-flex justify-between mb-sm"><span class="text-sm text-muted">Enveloppe</span><span class="font-bold">${formatCurrency(stats.montantTotal)}</span></div>
                    </div>
                    <div class="p-lg">
                        <h5 class="mb-md">Alertes actives</h5>
                        <div class="d-flex justify-between mb-sm"><span class="text-sm text-muted">Réserves ouvertes</span><span class="font-bold text-danger">${stats.reservesOuvertes}</span></div>
                        <div class="d-flex justify-between mb-sm"><span class="text-sm text-muted">Essais en attente</span><span class="font-bold text-warning">${stats.essaisEnAttente}</span></div>
                        <div class="d-flex justify-between mb-sm"><span class="text-sm text-muted">Notifications</span><span class="font-bold">${stats.alertes}</span></div>
                    </div>
                    <div class="p-lg">
                        <h5 class="mb-md">Projets par statut</h5>
                        ${projets.map(p => `
                            <div class="d-flex justify-between align-center mb-sm">
                                <span class="text-xs truncate" style="max-width:120px;">${p.code_projet}</span>
                                ${statusBadge(p.statut)}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Render charts
    setTimeout(() => {
        const elStatuts = document.getElementById('chart-statuts');
        const elAvanc = document.getElementById('chart-avancement-report');
        if (!elStatuts || !elAvanc) return; // page changée avant le rendu
        // Statut pie chart
        const statutCounts = {};
        projets.forEach(p => { statutCounts[p.statut] = (statutCounts[p.statut] || 0) + 1; });

        new Chart(elStatuts, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statutCounts),
                datasets: [{
                    data: Object.values(statutCounts),
                    backgroundColor: ['rgba(21, 101, 192, 0.8)', 'rgba(46, 125, 50, 0.8)', 'rgba(230, 81, 0, 0.8)', 'rgba(90, 115, 147, 0.8)'],
                    borderColor: '#ffffff',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#46587a', padding: 16 } }
                }
            }
        });
        
        // Avancement bar chart
        new Chart(elAvanc, {
            type: 'bar',
            data: {
                labels: projets.map(p => p.code_projet),
                datasets: [{
                    label: 'Avancement (%)',
                    data: projets.map(p => p.taux_avancement),
                    backgroundColor: 'rgba(212, 168, 67, 0.6)',
                    borderColor: 'rgba(212, 168, 67, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { max: 100, grid: { color: 'rgba(26, 58, 107, 0.08)' }, ticks: { color: '#46587a', callback: v => v + '%' } },
                    y: { grid: { display: false }, ticks: { color: '#46587a' } }
                }
            }
        });
    }, 200);
}

async function exportReport() {
    const stats = await window.api.dashboard.getStats();
    const projets = await window.api.projets.getAll();
    const reserves = await window.api.reserves.getOuvertes();

    const projetRows = projets.map(p => `<tr>
        <td>${p.code_projet}</td><td>${p.intitule}</td><td>${p.maitre_ouvrage}</td>
        <td>${p.statut}</td><td>${p.taux_avancement}%</td><td>${formatCurrency(p.montant_marche)}</td>
        <td>${formatDate(p.date_fin_prevue)}</td></tr>`).join('');

    const reserveRows = reserves.length ? reserves.map(r => `<tr><td>${r.ouvrage_nom}</td><td>${r.description}</td><td>${r.emetteur_nom}</td><td>${r.gravite}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center">Aucune réserve ouverte</td></tr>';

    // Planche photos (illustration pour les services supérieurs)
    let photosSection = '';
    try {
        const photos = await window.api.photos.getGallery({ limit: 6 });
        if (photos.length) {
            photosSection = `
                <h3 style="color:#1a3a6b;margin-top:24px;">Illustration — photothèque de chantier</h3>
                <div style="display:flex;flex-wrap:wrap;gap:10px;">
                    ${photos.filter(p => p.dataUrl).map(p => `
                        <div style="width:31%;border:1px solid #d0d8e4;border-radius:6px;overflow:hidden;">
                            <img src="${p.dataUrl}" style="width:100%;height:120px;object-fit:cover;display:block;">
                            <div style="padding:5px 8px;font-size:10px;color:#5a7393;">${(p.categorie || '')} — ${p.description || p.nom}</div>
                        </div>
                    `).join('')}
                </div>`;
        }
    } catch (e) { /* pas de photos */ }

    const html = buildDocHtml('Rapport de synthèse — ANEP MOD', `
        <h1>Rapport de synthèse des projets</h1>
        <p class="meta">Maîtrise d'ouvrage déléguée · Édité le ${formatDate(new Date())}</p>

        <table class="doc-table" style="width:auto;">
            <tr><th>Projets total</th><td>${stats.totalProjets}</td><th>En cours</th><td>${stats.projetsEnCours}</td></tr>
            <tr><th>Enveloppe globale</th><td>${formatCurrency(stats.montantTotal)}</td><th>Avancement moyen</th><td>${Math.round(stats.avancementMoyen)}%</td></tr>
            <tr><th>Lots actifs</th><td>${stats.lotsEnCours}/${stats.totalLots}</td><th>Intervenants</th><td>${stats.totalIntervenants}</td></tr>
            <tr><th>Réserves ouvertes</th><td>${stats.reservesOuvertes}</td><th>Essais en attente</th><td>${stats.essaisEnAttente}</td></tr>
        </table>

        <h3 style="color:#1a3a6b;margin-top:24px;">Détail des projets</h3>
        <table class="doc-table">
            <thead><tr><th>Code</th><th>Intitulé</th><th>Maître d'ouvrage</th><th>Statut</th><th>Avanc.</th><th>Montant</th><th>Fin prévue</th></tr></thead>
            <tbody>${projetRows}</tbody>
        </table>

        <h3 style="color:#1a3a6b;margin-top:24px;">Réserves ouvertes (${reserves.length})</h3>
        <table class="doc-table">
            <thead><tr><th>Ouvrage</th><th>Description</th><th>Émetteur</th><th>Gravité</th></tr></thead>
            <tbody>${reserveRows}</tbody>
        </table>
    `);
    const res = await window.api.docs.generate({ html, filename: `Rapport_synthese_${new Date().toISOString().split('T')[0]}`, subdir: 'Rapports' });
    if (res.success) showToast('Rapport généré', 'Rapport ouvert. Ctrl+P pour imprimer ou enregistrer en PDF.', 'success');
    else showToast('Erreur', res.error || 'Export impossible', 'danger');
}

// ============================================================
// COMPTES RENDUS & PV (+ croquis / annotations)
// ============================================================
const CR_TYPES = ['CR Réunion', 'CR Chantier', 'PV Réception', 'Note', 'Observation'];
function crTypeBadge(t) {
    const map = { 'CR Réunion': 'badge-info', 'CR Chantier': 'badge-primary', 'PV Réception': 'badge-success', 'Note': 'badge-secondary', 'Observation': 'badge-warning' };
    return `<span class="badge ${map[t] || 'badge-muted'}">${t}</span>`;
}

async function renderComptesRendus(container) {
    updatePageTitle('Comptes rendus & PV');
    const isM = isMOD();
    const projets = isM ? await window.api.projets.getAll() : [];
    const projetId = isM ? (window._crProjet || (projets[0] && projets[0].id)) : currentUser.projet_id;
    if (!projetId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><h4>Aucun projet associé</h4></div>'; return; }
    window._crProjet = projetId;
    const crs = await window.api.cr.getByProjet(projetId);

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Comptes rendus & PV</h2><p>CR de réunion/chantier, PV, notes et croquis — traçabilité et responsabilités</p></div>
            <div class="btn-group">
                <button class="btn btn-ghost" onclick="showSketchModal(${projetId})"><i data-lucide="pencil-ruler"></i> Croquis / annotation</button>
                <button class="btn btn-primary" onclick="showCRModal(${projetId})"><i data-lucide="plus"></i> Nouveau compte rendu</button>
            </div>
        </div>
        ${isM ? `<div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" onchange="window._crProjet=parseInt(this.value);navigateTo('comptes-rendus')">
                ${projets.map(p => `<option value="${p.id}" ${p.id === projetId ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
        </div>` : ''}
        <div class="card animate-fade-in-up delay-2"><div class="card-body">
            ${crs.length > 0 ? `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Date</th><th>Type</th><th>Objet</th><th>Rédigé par</th><th>Actions suivies</th><th></th></tr></thead>
                    <tbody>
                        ${crs.map(cr => `
                            <tr>
                                <td class="text-xs text-muted">${formatDate(cr.date_cr)}</td>
                                <td>${crTypeBadge(cr.type)}</td>
                                <td class="font-medium">${cr.objet}</td>
                                <td class="text-xs">${cr.redige_par || '—'}${cr.redige_par_role ? ` <span class="text-muted">(${cr.redige_par_role})</span>` : ''}</td>
                                <td class="text-xs">${cr.nb_actions ? `${cr.nb_faites}/${cr.nb_actions} traitée(s)` : '—'}</td>
                                <td class="actions">
                                    <button class="btn btn-primary btn-sm" title="Ouvrir" onclick="viewCR(${cr.id})"><i data-lucide="eye"></i></button>
                                    <button class="btn btn-ghost btn-sm" title="Générer le PV" onclick="generateCRPv(${cr.id})"><i data-lucide="printer"></i></button>
                                    <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteCRentry(${cr.id})"><i data-lucide="trash-2"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>` : '<div class="empty-state"><div class="empty-state-icon">📝</div><h4>Aucun compte rendu</h4><p>Rédigez un CR de réunion, un PV de chantier ou une note.</p></div>'}
        </div></div>
    `;
}

function crActionRowHtml() {
    return `<div class="cr-action-row d-flex gap-sm mb-sm">
        <input type="text" class="form-control cr-act-desc" placeholder="Action / décision" style="flex:2;">
        <input type="text" class="form-control cr-act-resp" placeholder="Responsable" style="flex:1;">
        <input type="date" class="form-control cr-act-delai" style="width:150px;">
        <button type="button" class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()"><i data-lucide="x"></i></button>
    </div>`;
}

async function showCRModal(projetId) {
    const reunions = await window.api.reunions.getByProjet(projetId);
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <form id="form-cr">
            <input type="hidden" name="projet_id" value="${projetId}">
            <div class="form-row">
                <div class="form-group"><label class="form-label required">Type</label><select class="form-control" name="type">${CR_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-control" name="date_cr" value="${today}"></div>
                <div class="form-group"><label class="form-label">Réunion liée</label><select class="form-control" name="reunion_id"><option value="">— Aucune —</option>${reunions.map(r => `<option value="${r.id}">${r.numero_reunion}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label class="form-label required">Objet</label><input type="text" class="form-control" name="objet" placeholder="Ex : CR réunion de chantier n°5" required></div>
            <div class="form-group"><label class="form-label">Contenu / observations</label><textarea class="form-control" name="contenu" rows="5" placeholder="Points abordés, constats, décisions…"></textarea></div>
            <div class="form-group">
                <div class="d-flex justify-between align-center mb-sm"><label class="form-label" style="margin:0;">Actions & responsabilités</label><button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('cr-actions-list').insertAdjacentHTML('beforeend', crActionRowHtml()); if(typeof lucide!=='undefined')lucide.createIcons();"><i data-lucide="plus"></i> Ajouter</button></div>
                <div id="cr-actions-list">${crActionRowHtml()}</div>
            </div>
        </form>
    `;
    openModal('Nouveau compte rendu', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitCR(${projetId})"><i data-lucide="save"></i> Enregistrer</button>
    `, 'lg');
}

async function submitCR(projetId) {
    const form = document.getElementById('form-cr');
    const data = Object.fromEntries(new FormData(form));
    if (!data.objet) { showToast('Erreur', 'Objet requis.', 'danger'); return; }
    const actions = Array.from(document.querySelectorAll('.cr-action-row')).map(row => ({
        description: row.querySelector('.cr-act-desc').value.trim(),
        responsable: row.querySelector('.cr-act-resp').value.trim(),
        delai: row.querySelector('.cr-act-delai').value || null
    })).filter(a => a.description);
    data.actions = actions;
    data.redige_par = currentUser.role === 'MOD' ? 'Administrateur MOD' : (currentUser.raison_sociale || currentUser.role);
    data.redige_par_role = currentUser.role;
    try {
        await window.api.cr.create(data);
        closeModal();
        showToast('Enregistré', 'Compte rendu enregistré.', 'success');
        navigateTo('comptes-rendus');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function viewCR(id) {
    const cr = await window.api.cr.get(id);
    const actions = await window.api.cr.getActions(id);
    const body = `
        <div class="mb-md">
            <div class="d-flex justify-between align-center flex-wrap gap-sm">
                <div>${crTypeBadge(cr.type)} <span class="font-semibold">${cr.objet}</span></div>
                <span class="text-xs text-muted">${formatDate(cr.date_cr)}</span>
            </div>
            <div class="text-xs text-muted mt-sm">Rédigé par ${cr.redige_par || '—'}${cr.redige_par_role ? ' (' + cr.redige_par_role + ')' : ''}</div>
        </div>
        ${cr.contenu ? `<div class="card-flat p-md mb-md" style="white-space:pre-wrap;">${cr.contenu}</div>` : ''}
        ${actions.length ? `
            <h5 class="mb-sm">Actions & responsabilités</h5>
            <div class="table-wrapper"><table class="data-table">
                <thead><tr><th>Action</th><th>Responsable</th><th>Délai</th><th>Statut</th></tr></thead>
                <tbody>${actions.map(a => `<tr>
                    <td>${a.description}</td><td class="text-xs">${a.responsable || '—'}</td><td class="text-xs">${formatDate(a.delai)}</td>
                    <td><select class="form-control" style="padding:2px 8px;" onchange="setCRActionStatut(${a.id}, this.value, ${id})">
                        ${['À faire', 'En cours', 'Fait'].map(s => `<option ${a.statut === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select></td>
                </tr>`).join('')}</tbody>
            </table></div>` : ''}
    `;
    openModal('Compte rendu — ' + cr.objet, body, `
        <button class="btn btn-ghost" onclick="closeModal()">Fermer</button>
        <button class="btn btn-secondary" onclick="generateCRPv(${id})"><i data-lucide="printer"></i> Générer le PV</button>
    `, 'lg');
}

async function setCRActionStatut(id, statut, crId) {
    await window.api.cr.updateActionStatut(id, statut);
    showToast('Mis à jour', `Action : ${statut}.`, 'success');
}

async function generateCRPv(id) {
    const cr = await window.api.cr.get(id);
    const actions = await window.api.cr.getActions(id);
    const actionRows = actions.length ? actions.map(a => `<tr><td>${a.description}</td><td>${a.responsable || '—'}</td><td>${formatDate(a.delai)}</td><td>${a.statut}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center">—</td></tr>';
    const html = buildDocHtml(`${cr.type} — ${cr.objet}`, `
        <h1>${cr.type}</h1>
        <p class="meta">${cr.objet} · Projet ${cr.code_projet} — ${cr.projet_nom} · ${formatDate(cr.date_cr)}</p>
        <div class="letter-body" style="white-space:pre-wrap;">${cr.contenu || ''}</div>
        <h3 style="color:#1a3a6b;margin-top:20px;">Actions & responsabilités</h3>
        <table class="doc-table"><thead><tr><th>Action / décision</th><th>Responsable</th><th>Délai</th><th>Statut</th></tr></thead><tbody>${actionRows}</tbody></table>
        <div class="signature"><p class="role">Rédigé par : ${cr.redige_par || ''}${cr.redige_par_role ? ' (' + cr.redige_par_role + ')' : ''}</p><p>ANEP — Maîtrise d'Ouvrage Déléguée</p></div>
    `);
    const res = await window.api.docs.generate({ html, filename: `PV_${(cr.objet || 'CR').substring(0, 30)}`, subdir: 'PV' });
    if (res.success) showToast('PV généré', 'Document ouvert. Ctrl+P pour imprimer / PDF.', 'success');
    else showToast('Erreur', res.error || 'Génération impossible', 'danger');
}

async function deleteCRentry(id) {
    if (!confirm('Supprimer ce compte rendu ?')) return;
    await window.api.cr.delete(id);
    showToast('Supprimé', 'Compte rendu supprimé.', 'success');
    navigateTo('comptes-rendus');
}

// ---- Outil de croquis / annotation (canvas → photothèque) ----
let _sketch = { canvas: null, ctx: null, drawing: false, color: '#c62828', size: 3 };
function showSketchModal(projetId) {
    const colors = ['#c62828', '#1a3a6b', '#2e7d32', '#e65100', '#000000'];
    const body = `
        <div class="d-flex gap-sm mb-md align-center flex-wrap">
            <span class="text-sm text-muted">Couleur :</span>
            ${colors.map(c => `<button type="button" style="width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #ccc;background:${c};cursor:pointer;" onclick="_sketch.color='${c}'"></button>`).join('')}
            <span class="text-sm text-muted" style="margin-left:12px;">Trait :</span>
            <input type="range" min="1" max="14" value="3" onchange="_sketch.size=parseInt(this.value)">
            <button type="button" class="btn btn-ghost btn-sm" onclick="clearSketch()"><i data-lucide="eraser"></i> Effacer</button>
            <label class="btn btn-ghost btn-sm" style="cursor:pointer;margin:0;"><i data-lucide="image"></i> Fond (plan)<input type="file" accept="image/*" style="display:none;" onchange="loadSketchBg(this)"></label>
        </div>
        <canvas id="sketch-canvas" width="760" height="440" style="border:1px solid var(--border-color);border-radius:8px;background:#fff;width:100%;cursor:crosshair;touch-action:none;"></canvas>
        <div class="form-group mt-md"><label class="form-label">Légende</label><input type="text" class="form-control" id="sketch-legend" placeholder="Ex : Croquis implantation réservations plancher R+1"></div>
    `;
    openModal('Croquis / annotation', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="saveSketch(${projetId})"><i data-lucide="save"></i> Enregistrer dans la photothèque</button>
    `, 'lg');
    setTimeout(initSketch, 80);
}
function initSketch() {
    const c = document.getElementById('sketch-canvas'); if (!c) return;
    _sketch.canvas = c; _sketch.ctx = c.getContext('2d');
    _sketch.ctx.fillStyle = '#fff'; _sketch.ctx.fillRect(0, 0, c.width, c.height);
    _sketch.ctx.lineCap = 'round'; _sketch.ctx.lineJoin = 'round';
    const pos = e => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }; };
    c.onmousedown = e => { _sketch.drawing = true; const p = pos(e); _sketch.ctx.beginPath(); _sketch.ctx.moveTo(p.x, p.y); };
    c.onmousemove = e => { if (!_sketch.drawing) return; const p = pos(e); _sketch.ctx.strokeStyle = _sketch.color; _sketch.ctx.lineWidth = _sketch.size; _sketch.ctx.lineTo(p.x, p.y); _sketch.ctx.stroke(); };
    window.addEventListener('mouseup', () => { _sketch.drawing = false; });
}
function clearSketch() { const c = _sketch.canvas; if (c) { _sketch.ctx.fillStyle = '#fff'; _sketch.ctx.fillRect(0, 0, c.width, c.height); } }
function loadSketchBg(input) {
    const f = input.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { const img = new Image(); img.onload = () => { const c = _sketch.canvas; const ratio = Math.min(c.width / img.width, c.height / img.height); _sketch.ctx.drawImage(img, 0, 0, img.width * ratio, img.height * ratio); }; img.src = reader.result; };
    reader.readAsDataURL(f);
}
async function saveSketch(projetId) {
    const c = _sketch.canvas; if (!c) return;
    const dataUrl = c.toDataURL('image/png');
    const legend = (document.getElementById('sketch-legend') || {}).value || 'Croquis';
    const res = await window.api.documents.saveDataUrl(dataUrl, { projet_id: projetId, entite_type: 'projet', entite_id: projetId, categorie: 'Annotation', description: legend, nom: 'Croquis.png', uploaded_by: currentUser.role === 'MOD' ? 'MOD' : (currentUser.raison_sociale || currentUser.role) });
    if (res.success) { closeModal(); showToast('Enregistré', 'Croquis ajouté à la photothèque.', 'success'); }
    else showToast('Erreur', res.error || 'Enregistrement impossible', 'danger');
}

// ============================================================
// PERMANENCE / PRÉSENCE CHANTIER
// ============================================================
async function renderPermanence(container) {
    updatePageTitle('Permanence chantier');
    const isM = isMOD();
    const today = new Date().toISOString().split('T')[0];

    if (!isM) {
        // Vue intervenant : pointage + historique
        const projetId = currentUser.projet_id;
        if (!projetId) { container.innerHTML = '<div class="empty-state"><h4>Aucun projet associé</h4></div>'; return; }
        const todayRec = await window.api.permanence.getToday(currentUser.intervenant_id, projetId, today);
        const hist = await window.api.permanence.getByIntervenant(currentUser.intervenant_id, projetId);
        container.innerHTML = `
            <div class="page-header animate-fade-in-up"><div><h2>Ma permanence chantier</h2><p>Attestez votre présence quotidienne sur le chantier</p></div></div>
            <div class="card animate-fade-in-up delay-1">
                <div class="card-body d-flex justify-between align-center flex-wrap gap-md">
                    <div>
                        <div class="font-semibold">${formatDate(today)}</div>
                        <div class="text-sm ${todayRec ? (todayRec.present ? 'text-success' : 'text-danger') : 'text-muted'}">
                            ${todayRec ? (todayRec.present ? '✓ Présence attestée' + (todayRec.heure_arrivee ? ' (' + todayRec.heure_arrivee + (todayRec.heure_depart ? ' → ' + todayRec.heure_depart : '') + ')' : '') : 'Absence déclarée') : 'Non pointé ce jour'}
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="showPermanenceModal(${projetId})"><i data-lucide="user-check"></i> ${todayRec ? 'Modifier mon pointage' : 'Pointer ma présence'}</button>
                </div>
            </div>
            <div class="card mt-lg animate-fade-in-up delay-2"><div class="card-header"><h4>Historique</h4></div><div class="card-body">
                ${hist.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Présence</th><th>Horaires</th><th>Observations</th></tr></thead><tbody>
                    ${hist.map(p => `<tr><td>${formatDate(p.date)}</td><td>${p.present ? '<span class="badge badge-success">Présent</span>' : '<span class="badge badge-danger">Absent</span>'}</td><td class="text-xs">${p.heure_arrivee || '—'}${p.heure_depart ? ' → ' + p.heure_depart : ''}</td><td class="text-xs text-muted">${p.observations || '—'}</td></tr>`).join('')}
                </tbody></table></div>` : '<div class="empty-state p-lg"><p class="text-muted">Aucun pointage.</p></div>'}
            </div></div>
        `;
        return;
    }

    // Vue MOD : suivi de la permanence de tous les intervenants
    const projets = await window.api.projets.getAll();
    const projetId = window._permProjet || (projets[0] && projets[0].id);
    if (!projetId) { container.innerHTML = '<div class="empty-state"><h4>Aucun projet</h4></div>'; return; }
    window._permProjet = projetId;
    const records = await window.api.permanence.getByProjet(projetId);
    const stats = await window.api.permanence.getStats(projetId);
    const presentsToday = records.filter(r => r.date === today && r.present);

    container.innerHTML = `
        <div class="page-header animate-fade-in-up"><div><h2>Permanence chantier</h2><p>Suivi de la présence des intervenants (responsabilité de permanence)</p></div></div>
        <div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" onchange="window._permProjet=parseInt(this.value);navigateTo('permanence')">
                ${projets.map(p => `<option value="${p.id}" ${p.id === projetId ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
        </div>
        <div class="stats-grid animate-fade-in-up delay-1">
            <div class="stat-card stat-success"><div class="stat-icon icon-success"><i data-lucide="user-check"></i></div><div class="stat-content"><div class="stat-value">${presentsToday.length}</div><div class="stat-label">Présents aujourd'hui</div></div></div>
            <div class="stat-card stat-info"><div class="stat-icon icon-info"><i data-lucide="calendar-check"></i></div><div class="stat-content"><div class="stat-value">${stats.joursPresence}</div><div class="stat-label">Jours-présence cumulés</div></div></div>
            <div class="stat-card stat-primary"><div class="stat-icon icon-primary"><i data-lucide="users"></i></div><div class="stat-content"><div class="stat-value">${stats.parRole.length}</div><div class="stat-label">Rôles présents</div></div></div>
        </div>
        <div class="card animate-fade-in-up delay-2"><div class="card-body">
            ${records.length ? `<div class="table-wrapper"><table class="data-table">
                <thead><tr><th>Date</th><th>Rôle</th><th>Intervenant</th><th>Présence</th><th>Horaires</th><th>Observations</th><th></th></tr></thead>
                <tbody>${records.map(r => `<tr>
                    <td class="text-xs">${formatDate(r.date)}</td><td>${roleBadge(r.type_role)}</td><td class="font-medium text-sm">${r.raison_sociale}</td>
                    <td>${r.present ? '<span class="badge badge-success">Présent</span>' : '<span class="badge badge-danger">Absent</span>'}</td>
                    <td class="text-xs">${r.heure_arrivee || '—'}${r.heure_depart ? ' → ' + r.heure_depart : ''}</td>
                    <td class="text-xs text-muted">${r.observations || '—'}</td>
                    <td class="actions"><button class="btn btn-ghost btn-sm" onclick="deletePermanence(${r.id})"><i data-lucide="trash-2"></i></button></td>
                </tr>`).join('')}</tbody>
            </table></div>` : '<div class="empty-state"><div class="empty-state-icon">🦺</div><h4>Aucun pointage</h4><p>Les intervenants attestent leur présence depuis leur espace.</p></div>'}
        </div></div>
    `;
}

function showPermanenceModal(projetId) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const today = now.toISOString().split('T')[0];
    const body = `
        <form id="form-permanence">
            <input type="hidden" name="projet_id" value="${projetId}">
            <div class="form-group">
                <label class="checklist-item" style="font-size:14px;"><input type="checkbox" name="present" checked> <span>Je suis <strong>présent(e)</strong> sur le chantier ce jour</span></label>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-control" name="date" value="${today}"></div>
                <div class="form-group"><label class="form-label">Heure d'arrivée</label><input type="time" class="form-control" name="heure_arrivee" value="${hh}"></div>
                <div class="form-group"><label class="form-label">Heure de départ</label><input type="time" class="form-control" name="heure_depart"></div>
            </div>
            <div class="form-group"><label class="form-label">Observations</label><textarea class="form-control" name="observations" rows="2" placeholder="Tâches réalisées, points de vigilance…"></textarea></div>
        </form>
    `;
    openModal('Pointer ma présence', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitPermanence(${projetId})"><i data-lucide="check"></i> Attester</button>
    `);
}

async function submitPermanence(projetId) {
    const form = document.getElementById('form-permanence');
    const data = Object.fromEntries(new FormData(form));
    data.present = form.querySelector('[name=present]').checked ? 1 : 0;
    data.intervenant_id = currentUser.intervenant_id;
    data.role = currentUser.role;
    if (!data.date) { showToast('Erreur', 'Date requise.', 'danger'); return; }
    try {
        await window.api.permanence.create(data);
        closeModal();
        showToast('Attesté', 'Votre présence a été enregistrée.', 'success');
        navigateTo('permanence');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function deletePermanence(id) {
    if (!confirm('Supprimer ce pointage ?')) return;
    await window.api.permanence.delete(id);
    showToast('Supprimé', 'Pointage supprimé.', 'success');
    navigateTo('permanence');
}

// ============================================================
// JOURNAL / TRAÇABILITÉ (MOD)
// ============================================================
function eventIcon(action) {
    if (/Connexion/.test(action)) return 'log-in';
    if (/achèvement/i.test(action)) return 'megaphone';
    if (/Avis/.test(action)) return 'message-square';
    if (/Réserve/.test(action)) return 'alert-triangle';
    if (/[Bb]étonnage/.test(action)) return 'truck';
    if (/validé/i.test(action)) return 'check-circle';
    if (/[Ee]ssai/.test(action)) return 'flask-conical';
    return 'dot';
}

async function renderJournal(container) {
    updatePageTitle('Journal / Traçabilité');
    const projets = await window.api.projets.getAll();
    const filtreProjet = window._journalProjet || '';
    const events = await window.api.events.get({ projetId: filtreProjet || undefined, limit: 300 });

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Journal des événements</h2><p>Traçabilité complète des actions (audit)</p></div>
        </div>
        <div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" onchange="window._journalProjet=this.value;navigateTo('journal')">
                <option value="">Tous les projets</option>
                ${projets.map(p => `<option value="${p.id}" ${String(p.id) === String(filtreProjet) ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
        </div>
        <div class="card animate-fade-in-up delay-2">
            <div class="card-body">
                ${events.length > 0 ? `
                <div class="timeline">
                    ${events.map(e => `
                        <div class="timeline-item">
                            <div class="timeline-marker"><i data-lucide="${eventIcon(e.action)}"></i></div>
                            <div class="timeline-content">
                                <div class="d-flex justify-between align-center flex-wrap gap-sm">
                                    <span class="font-semibold text-sm">${e.action}</span>
                                    <span class="text-xs text-muted">${formatDateTime(e.created_at)}</span>
                                </div>
                                <div class="text-xs text-secondary mt-sm">
                                    ${e.acteur_type ? roleBadge(e.acteur_type) : ''}
                                    ${e.code_projet ? `<span class="badge badge-info">${e.code_projet}</span>` : ''}
                                    ${e.details ? '· ' + e.details : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>` : '<div class="empty-state"><div class="empty-state-icon">📜</div><h4>Aucun événement</h4><p>Les actions des intervenants apparaîtront ici.</p></div>'}
            </div>
        </div>
    `;
}

// ============================================================
// HQSE — Hygiène, Qualité, Sécurité, Environnement (risques)
// ============================================================
const HQSE_GRAVITE = { 1: 'Mineure', 2: 'Moyenne', 3: 'Grave', 4: 'Critique' };
const HQSE_PROBA = { 1: 'Rare', 2: 'Possible', 3: 'Probable', 4: 'Fréquent' };
const HQSE_DOMAINES = ['Sécurité', 'Hygiène', 'Qualité', 'Environnement'];
const HQSE_TYPES = ['Observation', 'Risque identifié', "Presqu'accident", 'Non-conformité', 'Accident', 'Action préventive'];

function criticiteBadge(g, p) {
    const c = (g || 0) * (p || 0);
    let cls = 'badge-success', lab = 'Faible';
    if (c >= 12) { cls = 'badge-danger'; lab = 'Critique'; }
    else if (c >= 8) { cls = 'badge-warning'; lab = 'Élevé'; }
    else if (c >= 4) { cls = 'badge-info'; lab = 'Modéré'; }
    return `<span class="badge ${cls}">${lab} (${c})</span>`;
}
function domaineBadge(d) {
    const map = { 'Sécurité': 'badge-danger', 'Hygiène': 'badge-info', 'Qualité': 'badge-primary', 'Environnement': 'badge-success' };
    return `<span class="badge ${map[d] || 'badge-muted'}">${d}</span>`;
}

async function renderHqse(container) {
    updatePageTitle('HQSE & Risques');
    const isM = isMOD();
    const projets = isM ? await window.api.projets.getAll() : [];
    const projetId = isM ? (window._hqseProjet || (projets[0] && projets[0].id)) : currentUser.projet_id;
    if (!projetId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🦺</div><h4>Aucun projet associé</h4></div>'; return; }
    window._hqseProjet = projetId;
    const fiches = await window.api.hqse.getByProjet(projetId);
    const stats = await window.api.hqse.getStats(projetId);

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>HQSE & Gestion des risques</h2><p>Hygiène · Qualité · Sécurité · Environnement — anticiper avant la non-conformité ou l'accident</p></div>
            <button class="btn btn-primary" onclick="showHqseModal(${projetId})"><i data-lucide="plus"></i> Nouvelle fiche HQSE</button>
        </div>
        ${isM ? `<div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" onchange="window._hqseProjet=parseInt(this.value);navigateTo('hqse')">
                ${projets.map(p => `<option value="${p.id}" ${p.id === projetId ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
        </div>` : ''}
        <div class="stats-grid animate-fade-in-up delay-1">
            <div class="stat-card stat-info"><div class="stat-icon icon-info"><i data-lucide="clipboard-list"></i></div><div class="stat-content"><div class="stat-value">${stats.total}</div><div class="stat-label">Fiches HQSE</div></div></div>
            <div class="stat-card stat-warning"><div class="stat-icon icon-warning"><i data-lucide="alert-triangle"></i></div><div class="stat-content"><div class="stat-value">${stats.ouverts}</div><div class="stat-label">Risques ouverts</div></div></div>
            <div class="stat-card stat-danger"><div class="stat-icon icon-danger"><i data-lucide="flame"></i></div><div class="stat-content"><div class="stat-value">${stats.critiques}</div><div class="stat-label">Criticité élevée</div></div></div>
            <div class="stat-card stat-danger"><div class="stat-icon icon-danger"><i data-lucide="siren"></i></div><div class="stat-content"><div class="stat-value">${stats.accidents}</div><div class="stat-label">Accidents / presqu'accidents</div></div></div>
        </div>
        <div class="card animate-fade-in-up delay-2"><div class="card-body">
            ${fiches.length > 0 ? `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Date</th><th>Domaine</th><th>Type</th><th>Criticité</th><th>Description</th><th>Localisation</th><th>Action corrective</th><th>Statut</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${fiches.map(h => `
                            <tr>
                                <td class="text-xs text-muted">${formatDate(h.date)}</td>
                                <td>${domaineBadge(h.domaine)}</td>
                                <td class="text-xs">${h.type_fiche}</td>
                                <td>${criticiteBadge(h.gravite, h.probabilite)}</td>
                                <td><div class="text-sm">${h.description}</div></td>
                                <td class="text-xs text-muted">${h.localisation || '—'}</td>
                                <td class="text-xs">${h.action_corrective || '—'}${h.responsable_action ? `<div class="text-muted">→ ${h.responsable_action}${h.delai ? ' (' + formatDate(h.delai) + ')' : ''}</div>` : ''}</td>
                                <td>${statusBadge(h.statut)}</td>
                                <td class="actions">
                                    ${h.statut !== 'Clôturé' ? `<button class="btn btn-ghost btn-sm" title="Marquer traité" onclick="setHqseStatut(${h.id},'Traité')"><i data-lucide="check"></i></button><button class="btn btn-ghost btn-sm" title="Clôturer" onclick="setHqseStatut(${h.id},'Clôturé')"><i data-lucide="check-check"></i></button>` : ''}
                                    <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteHqseEntry(${h.id})"><i data-lucide="trash-2"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>` : '<div class="empty-state"><div class="empty-state-icon">🦺</div><h4>Aucune fiche HQSE</h4><p>Enregistrez observations, risques et actions préventives pour anticiper les incidents.</p></div>'}
        </div></div>
    `;
}

async function showHqseModal(projetId) {
    const lots = await window.api.lots.getByProjet(projetId);
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <form id="form-hqse">
            <input type="hidden" name="projet_id" value="${projetId}">
            <div class="form-row">
                <div class="form-group"><label class="form-label required">Domaine</label><select class="form-control" name="domaine">${HQSE_DOMAINES.map(d => `<option>${d}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label required">Type de fiche</label><select class="form-control" name="type_fiche">${HQSE_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-control" name="date" value="${today}"></div>
            </div>
            <div class="form-group"><label class="form-label required">Description du constat / risque</label><textarea class="form-control" name="description" rows="2" required></textarea></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Gravité</label><select class="form-control" name="gravite">${Object.entries(HQSE_GRAVITE).map(([v, l]) => `<option value="${v}" ${v == 2 ? 'selected' : ''}>${v} — ${l}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Probabilité</label><select class="form-control" name="probabilite">${Object.entries(HQSE_PROBA).map(([v, l]) => `<option value="${v}" ${v == 2 ? 'selected' : ''}>${v} — ${l}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Lot concerné</label><select class="form-control" name="lot_id"><option value="">— Général —</option>${lots.map(l => `<option value="${l.id}">${l.code_lot}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label class="form-label">Localisation</label><input type="text" class="form-control" name="localisation" placeholder="Ex : Bloc A niveau R+2, zone échafaudage Nord"></div>
            <div class="form-group"><label class="form-label">Action corrective / préventive</label><textarea class="form-control" name="action_corrective" rows="2"></textarea></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Responsable de l'action</label><input type="text" class="form-control" name="responsable_action"></div>
                <div class="form-group"><label class="form-label">Délai</label><input type="date" class="form-control" name="delai"></div>
            </div>
        </form>
    `;
    openModal('Nouvelle fiche HQSE', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitHqse(${projetId})">Enregistrer</button>
    `, 'lg');
}

async function submitHqse(projetId) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-hqse')));
    if (!data.description) { showToast('Erreur', 'Description requise.', 'danger'); return; }
    data.gravite = parseInt(data.gravite);
    data.probabilite = parseInt(data.probabilite);
    data.saisi_par = currentUser.role === 'MOD' ? 'MOD' : (currentUser.raison_sociale || currentUser.role);
    data.saisi_par_role = currentUser.role;
    try {
        await window.api.hqse.create(data);
        closeModal();
        showToast('Enregistré', 'Fiche HQSE enregistrée. Le MOD est alerté si le risque est élevé.', 'success');
        navigateTo('hqse');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function setHqseStatut(id, statut) {
    await window.api.hqse.updateStatut(id, statut);
    showToast('Mis à jour', `Fiche : ${statut}.`, 'success');
    navigateTo('hqse');
}
async function deleteHqseEntry(id) {
    if (!confirm('Supprimer cette fiche HQSE ?')) return;
    await window.api.hqse.delete(id);
    showToast('Supprimée', 'Fiche supprimée.', 'success');
    navigateTo('hqse');
}

// ============================================================
// DÉCOMPTES & PAIEMENTS — circuit de mandatement
// ============================================================
function decompteStatutBadge(s) {
    const map = { 'Établi': 'badge-muted', 'Validé technique': 'badge-info', 'Visé': 'badge-primary', 'Mandaté': 'badge-warning', 'Payé': 'badge-success', 'Rejeté': 'badge-danger' };
    return `<span class="badge ${map[s] || 'badge-muted'}">${s}</span>`;
}

async function renderPaiements(container) {
    updatePageTitle('Décomptes & Paiements');
    const isM = isMOD();
    // Volet fermé par le MOD ?
    if (!(window.appSettings && window.appSettings.modules && window.appSettings.modules.paiements)) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔒</div><h4>Volet financier fermé</h4><p>Le volet Décomptes & Paiements n\'est pas encore ouvert par le maître d\'ouvrage délégué.</p></div>';
        return;
    }
    const projets = isM ? await window.api.projets.getAll() : [];
    const projetId = isM ? (window._paiementProjet || (projets[0] && projets[0].id)) : currentUser.projet_id;
    if (!projetId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💳</div><h4>Aucun projet</h4></div>'; return; }
    if (isM) window._paiementProjet = projetId;
    const stats = await window.api.decomptes.getStats(projetId);
    const attachements = await window.api.attachements.getByProjet(projetId);
    const decomptes = isM ? await window.api.decomptes.getByProjet(projetId) : [];

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>${isM ? 'Décomptes & Paiements' : 'Attachements'}</h2><p>${isM ? 'Attachements, décomptes et circuit validation → visa → mandatement → paiement' : 'Constatation des travaux exécutés'}</p></div>
            <div class="btn-group">
                <button class="btn btn-ghost" onclick="showNewAttachementModal(${projetId})"><i data-lucide="ruler"></i> Nouvel attachement</button>
                ${isM ? `<button class="btn btn-primary" onclick="showNewDecompteModal(${projetId})"><i data-lucide="plus"></i> Nouveau décompte</button>` : ''}
            </div>
        </div>
        ${isM ? `<div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" onchange="window._paiementProjet=parseInt(this.value);navigateTo('paiements')">
                ${projets.map(p => `<option value="${p.id}" ${p.id === projetId ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
        </div>` : ''}
        ${isM ? `<div class="stats-grid animate-fade-in-up delay-1">
            <div class="stat-card stat-info"><div class="stat-icon icon-info"><i data-lucide="receipt"></i></div><div class="stat-content"><div class="stat-value">${stats.totalDecomptes}</div><div class="stat-label">Décomptes</div></div></div>
            <div class="stat-card stat-warning"><div class="stat-icon icon-warning"><i data-lucide="file-check-2"></i></div><div class="stat-content"><div class="stat-value">${formatCurrency(stats.montantMandate)}</div><div class="stat-label">Mandaté</div></div></div>
            <div class="stat-card stat-success"><div class="stat-icon icon-success"><i data-lucide="banknote"></i></div><div class="stat-content"><div class="stat-value">${formatCurrency(stats.montantPaye)}</div><div class="stat-label">Payé</div></div></div>
            <div class="stat-card stat-primary"><div class="stat-icon icon-primary"><i data-lucide="hourglass"></i></div><div class="stat-content"><div class="stat-value">${stats.enCours}</div><div class="stat-label">En circuit</div></div></div>
        </div>` : ''}

        ${isM ? `<div class="card animate-fade-in-up delay-2">
            <div class="card-header"><h4><i data-lucide="receipt" style="width:18px;height:18px;margin-right:8px;"></i>Décomptes</h4></div>
            <div class="card-body">
                ${decomptes.length > 0 ? `
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>N°</th><th>Lot</th><th>Type</th><th>Montant HT</th><th>Net à payer</th><th>Circuit</th><th>Statut / Phase</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${decomptes.map(d => `
                                <tr>
                                    <td class="font-medium">${d.numero}</td>
                                    <td><span class="badge badge-info">${d.code_lot}</span></td>
                                    <td class="text-xs">${d.type}</td>
                                    <td class="text-xs">${formatCurrency(d.montant_ht)}</td>
                                    <td class="font-bold text-sm">${formatCurrency(d.montant_net_a_payer)}</td>
                                    <td class="text-xs">${d.etapes_validees}/${d.etapes_total}</td>
                                    <td>${decompteStatutBadge(d.statut)}${d.phase_paiement ? `<div class="text-xs text-muted mt-sm">${d.phase_paiement}</div>` : ''}</td>
                                    <td class="actions">
                                        <button class="btn btn-primary btn-sm" title="Circuit & phases de paiement" onclick="showDecompteCircuit(${d.id})"><i data-lucide="git-merge"></i></button>
                                        <button class="btn btn-ghost btn-sm" title="Pièces jointes (décompte signé, PJ…)" onclick="showEntityDocs('decompte', ${d.id}, ${projetId}, 'Décompte ${d.numero}')"><i data-lucide="paperclip"></i></button>
                                        <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteDecompte(${d.id})"><i data-lucide="trash-2"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>` : '<div class="empty-state p-lg"><div class="empty-state-icon">🧾</div><p class="text-muted">Aucun décompte. Créez un attachement puis un décompte.</p></div>'}
            </div>
        </div>` : ''}

        <div class="card mt-lg animate-fade-in-up delay-3">
            <div class="card-header"><h4><i data-lucide="ruler" style="width:18px;height:18px;margin-right:8px;"></i>Attachements (constatation des travaux)</h4></div>
            <div class="card-body">
                ${attachements.length > 0 ? `
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>N°</th><th>Lot</th><th>Période</th><th>Date</th><th>Montant travaux</th><th>Statut</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${attachements.map(a => `
                                <tr>
                                    <td class="font-medium">${a.numero}</td>
                                    <td><span class="badge badge-info">${a.code_lot}</span></td>
                                    <td class="text-xs">${a.periode || '—'}</td>
                                    <td class="text-xs text-muted">${formatDate(a.date_attachement)}</td>
                                    <td class="font-medium">${formatCurrency(a.montant_travaux)}</td>
                                    <td>${statusBadge(a.statut)}${a.motif_rectification && a.statut === 'Brouillon' ? `<div class="text-xs text-danger mt-sm" title="Motif de rectification">↩ ${a.motif_rectification}</div>` : ''}</td>
                                    <td class="actions">
                                        <button class="btn btn-ghost btn-sm" title="Pièces jointes (métré, plans, version signée…)" onclick="showEntityDocs('attachement', ${a.id}, ${projetId}, 'Attachement ${a.numero}')"><i data-lucide="paperclip"></i></button>
                                        ${isM && a.statut !== 'Validé' ? `<button class="btn btn-ghost btn-sm" title="Valider" onclick="validateAttachement(${a.id})"><i data-lucide="check"></i></button>` : ''}
                                        ${isM && a.statut === 'Soumis' ? `<button class="btn btn-ghost btn-sm" title="Demander rectification" onclick="requestAttachementRectif(${a.id})"><i data-lucide="undo-2"></i></button>` : ''}
                                        ${!isM && a.statut === 'Brouillon' ? `<button class="btn btn-secondary btn-sm" title="Re-soumettre après rectification" onclick="resubmitAttachement(${a.id})"><i data-lucide="send"></i> Re-soumettre</button>` : ''}
                                        ${isM ? `<button class="btn btn-ghost btn-sm" title="Créer décompte" onclick="showNewDecompteModal(${projetId}, ${a.id})"><i data-lucide="file-plus"></i></button>` : ''}
                                        <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteAttachement(${a.id})"><i data-lucide="trash-2"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>` : '<div class="empty-state p-lg"><p class="text-muted">Aucun attachement.</p></div>'}
            </div>
        </div>
    `;
}

async function showNewAttachementModal(projetId) {
    const lots = await window.api.lots.getByProjet(projetId);
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <form id="form-attachement">
            <input type="hidden" name="projet_id" value="${projetId}">
            <div class="form-row">
                <div class="form-group"><label class="form-label required">N° attachement</label><input type="text" class="form-control" name="numero" placeholder="ATT-01" required></div>
                <div class="form-group"><label class="form-label required">Lot</label><select class="form-control" name="lot_id">${lots.map(l => `<option value="${l.id}">${l.code_lot} — ${l.designation}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Période</label><input type="text" class="form-control" name="periode" placeholder="Ex : Juillet 2026"></div>
                <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-control" name="date_attachement" value="${today}"></div>
            </div>
            <div class="form-group"><label class="form-label required">Montant des travaux constatés (DH HT)</label><input type="number" step="0.01" class="form-control" name="montant_travaux" placeholder="0" required></div>
            <div class="form-group"><label class="form-label">Observations</label><textarea class="form-control" name="observations" rows="2"></textarea></div>
        </form>
    `;
    openModal('Nouvel attachement', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitAttachement(${projetId})">Enregistrer</button>
    `, 'lg');
}

async function submitAttachement(projetId) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-attachement')));
    if (!data.numero || !data.montant_travaux) { showToast('Erreur', 'N° et montant requis.', 'danger'); return; }
    // Confirmation avant dépôt (entrée dans le circuit documentaire)
    if (!confirm(`Confirmer le dépôt de l'attachement « ${data.numero} » (${formatCurrency(data.montant_travaux)}) ?\n\nIl entrera dans le circuit documentaire et sera transmis au maître d'ouvrage pour validation.`)) return;
    try {
        const res = await window.api.attachements.create(data);
        closeModal(); showToast('Attachement déposé', 'Enregistré et transmis au MOD. Ajoutez les pièces jointes (bouton trombone).', 'success');
        navigateTo('paiements');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function validateAttachement(id) {
    if (!confirm('Valider cet attachement ?\n\nLe métré constaté est réputé conforme ; l’entreprise pourra établir le décompte correspondant.')) return;
    const acteur = currentUser.nom || 'MOD';
    await window.api.attachements.validate(id, acteur);
    showToast('Attachement validé ✅', 'L’entreprise est notifiée.', 'success');
    navigateTo('paiements');
}

async function requestAttachementRectif(id) {
    const motif = prompt('Motif de la demande de rectification (transmis à l’entreprise) :');
    if (motif === null) return;
    if (!confirm('Renvoyer cet attachement pour rectification ?\n\nIl repasse en brouillon ; l’entreprise devra le corriger puis le re-soumettre.')) return;
    await window.api.attachements.requestRectification(id, motif);
    showToast('Rectification demandée', 'L’entreprise est notifiée du motif.', 'warning');
    navigateTo('paiements');
}

async function resubmitAttachement(id) {
    if (!confirm('Re-soumettre cet attachement corrigé au maître d’ouvrage ?')) return;
    await window.api.attachements.resubmit(id);
    showToast('Re-soumis', 'Attachement corrigé transmis au MOD.', 'success');
    navigateTo('paiements');
}

async function deleteAttachement(id) {
    if (!confirm('Supprimer cet attachement ?')) return;
    await window.api.attachements.delete(id);
    showToast('Supprimé', 'Attachement supprimé.', 'success');
    navigateTo('paiements');
}

// ---- Pièces jointes génériques (réutilisable : attachement, décompte, OS…) ----
function _docFileMeta(dc) {
    const ext = (dc.extension || '').toLowerCase();
    const ic = ['xls', 'xlsx', 'csv'].includes(ext) ? 'file-spreadsheet' : (ext === 'pdf' ? 'file-text' : (['doc', 'docx'].includes(ext) ? 'file-type' : (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext) ? 'image' : 'file')));
    const ko = dc.taille ? (dc.taille < 1024 * 1024 ? Math.max(1, Math.round(dc.taille / 1024)) + ' Ko' : (dc.taille / 1048576).toFixed(1) + ' Mo') : '';
    return { ic, ko };
}
async function showEntityDocs(entiteType, entiteId, projetId, label) {
    const docs = await window.api.documents.getByEntity(entiteType, entiteId);
    const lbl = (label || '').replace(/'/g, '’');
    const rows = docs.length ? docs.map(dc => {
        const m = _docFileMeta(dc);
        return `<div class="d-flex justify-between align-center" style="padding:8px 4px;border-bottom:1px solid var(--border-color);">
            <div class="d-flex align-center gap-sm" style="min-width:0;">
                <i data-lucide="${m.ic}" style="width:18px;height:18px;flex:none;"></i>
                <div style="min-width:0;"><div class="text-sm font-medium" style="overflow:hidden;text-overflow:ellipsis;">${dc.nom}</div>
                <div class="text-xs text-muted">${(dc.extension || '').toUpperCase()}${m.ko ? ' · ' + m.ko : ''} · ${formatDateTime(dc.created_at)}${dc.uploaded_by ? ' · ' + dc.uploaded_by : ''}</div></div>
            </div>
            <div class="btn-group" style="flex:none;">
                <button class="btn btn-ghost btn-sm" title="Ouvrir" onclick="window.api.documents.open(${dc.id})"><i data-lucide="eye"></i></button>
                <button class="btn btn-ghost btn-sm" title="Télécharger" onclick="window.api.documents.saveAs(${dc.id})"><i data-lucide="download"></i></button>
                <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteEntityDoc(${dc.id}, '${entiteType}', ${entiteId}, ${projetId}, '${lbl}')"><i data-lucide="trash-2"></i></button>
            </div>
        </div>`;
    }).join('') : '<div class="empty-state p-md"><p class="text-muted text-sm">Aucune pièce jointe. Ajoutez le fichier source (Excel, PDF, Word) ou la version signée scannée.</p></div>';
    const body = `
        <div class="mb-md text-sm text-muted">Pièces jointes — <strong>${label}</strong>. Formats : Excel, PDF, Word, images (version signée scannée)…</div>
        <div class="card-flat" style="border:1px solid var(--border-color);border-radius:8px;max-height:340px;overflow:auto;padding:0 8px;">${rows}</div>`;
    openModal('Pièces jointes — ' + label, body, `
        <button class="btn btn-ghost" onclick="closeModal()">Fermer</button>
        <button class="btn btn-primary" onclick="uploadEntityDoc('${entiteType}', ${entiteId}, ${projetId}, '${lbl}')"><i data-lucide="upload"></i> Ajouter un fichier</button>`, 'lg');
    if (window.lucide) lucide.createIcons();
}
async function uploadEntityDoc(entiteType, entiteId, projetId, label) {
    const acteur = currentUser.role === 'MOD' ? (currentUser.nom || 'MOD') : (currentUser.raison_sociale || currentUser.role);
    try {
        const res = await window.api.documents.upload({ entite_type: entiteType, entite_id: entiteId, projet_id: projetId, type_document: 'Autre', categorie: 'Pièce jointe', uploaded_by: acteur, uploaded_by_role: currentUser.role });
        if (res && res.canceled) return;
        if (res && res.success) { showToast('Pièce jointe ajoutée', `${res.count || 1} fichier(s) joint(s) et tracé(s).`, 'success'); showEntityDocs(entiteType, entiteId, projetId, label); }
        else showToast('Erreur', (res && res.error) || 'Upload impossible.', 'danger');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}
async function deleteEntityDoc(docId, entiteType, entiteId, projetId, label) {
    if (!confirm('Supprimer cette pièce jointe ?')) return;
    await window.api.documents.delete(docId);
    showToast('Supprimé', 'Pièce jointe supprimée.', 'success');
    showEntityDocs(entiteType, entiteId, projetId, label);
}

async function showNewDecompteModal(projetId, attachementId = null) {
    const lots = await window.api.lots.getByProjet(projetId);
    const attachements = await window.api.attachements.getByProjet(projetId);
    const att = attachementId ? attachements.find(a => a.id === attachementId) : null;
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <form id="form-decompte">
            <input type="hidden" name="projet_id" value="${projetId}">
            <div class="form-row">
                <div class="form-group"><label class="form-label required">N° décompte</label><input type="text" class="form-control" name="numero" placeholder="DEC-01" required></div>
                <div class="form-group"><label class="form-label required">Type</label><select class="form-control" name="type"><option>Provisoire</option><option>Définitif</option></select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label required">Lot</label><select class="form-control" name="lot_id">${lots.map(l => `<option value="${l.id}" ${att && att.lot_id === l.id ? 'selected' : ''}>${l.code_lot} — ${l.designation}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Attachement lié</label><select class="form-control" name="attachement_id"><option value="">— Aucun —</option>${attachements.map(a => `<option value="${a.id}" ${att && att.id === a.id ? 'selected' : ''}>${a.numero} (${formatCurrency(a.montant_travaux)})</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label required">Montant HT (DH)</label><input type="number" step="0.01" class="form-control" name="montant_ht" value="${att ? att.montant_travaux : ''}" oninput="updateDecompteCalc()" required></div>
                <div class="form-group"><label class="form-label">TVA (%)</label><input type="number" step="0.1" class="form-control" name="taux_tva" value="20" oninput="updateDecompteCalc()"></div>
                <div class="form-group"><label class="form-label">Retenue garantie (%)</label><input type="number" step="0.1" class="form-control" name="taux_retenue_garantie" value="7" oninput="updateDecompteCalc()"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Date décompte</label><input type="date" class="form-control" name="date_decompte" value="${today}"></div>
                <div class="form-group"><label class="form-label">Cumul antérieur (DH)</label><input type="number" step="0.01" class="form-control" name="montant_cumule_anterieur" value="0"></div>
            </div>
            <div class="card-flat p-md" style="background:var(--bg-tertiary);border-radius:8px;">
                <div class="d-flex justify-between text-sm"><span class="text-muted">Montant TVA</span><span id="calc-tva" class="font-medium">—</span></div>
                <div class="d-flex justify-between text-sm mt-sm"><span class="text-muted">Montant TTC</span><span id="calc-ttc" class="font-medium">—</span></div>
                <div class="d-flex justify-between text-sm mt-sm"><span class="text-muted">Retenue de garantie</span><span id="calc-rg" class="font-medium">—</span></div>
                <div class="d-flex justify-between mt-sm" style="border-top:1px solid var(--border-color);padding-top:8px;"><span class="font-semibold">Net à payer</span><span id="calc-net" class="font-bold text-info">—</span></div>
            </div>
            <div class="form-group mt-md"><label class="form-label">Observations</label><textarea class="form-control" name="observations" rows="2"></textarea></div>
        </form>
    `;
    openModal('Nouveau décompte', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitDecompte(${projetId})">Établir le décompte</button>
    `, 'lg');
    updateDecompteCalc();
}

function updateDecompteCalc() {
    const f = document.getElementById('form-decompte');
    if (!f) return;
    const ht = parseFloat(f.montant_ht.value) || 0;
    const tva = parseFloat(f.taux_tva.value) || 0;
    const rg = parseFloat(f.taux_retenue_garantie.value) || 0;
    const mtva = ht * tva / 100, ttc = ht + mtva, mrg = ht * rg / 100, net = ttc - mrg;
    document.getElementById('calc-tva').textContent = formatCurrency(mtva);
    document.getElementById('calc-ttc').textContent = formatCurrency(ttc);
    document.getElementById('calc-rg').textContent = '- ' + formatCurrency(mrg);
    document.getElementById('calc-net').textContent = formatCurrency(net);
}

async function submitDecompte(projetId) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-decompte')));
    if (!data.numero || !data.montant_ht) { showToast('Erreur', 'N° et montant HT requis.', 'danger'); return; }
    if (!confirm(`Établir le décompte « ${data.numero} » ?\n\nLe circuit de validation → visa → ordonnancement → visa TGR → paiement sera initié. Vous pourrez y joindre le décompte signé (bouton trombone).`)) return;
    try { await window.api.decomptes.create(data); closeModal(); showToast('Décompte établi', 'Circuit initié (validation → visa → ordonnancement → visa TGR → paiement).', 'success'); navigateTo('paiements'); }
    catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function deleteDecompte(id) {
    if (!confirm('Supprimer ce décompte et son circuit ?')) return;
    await window.api.decomptes.delete(id);
    showToast('Supprimé', 'Décompte supprimé.', 'success');
    navigateTo('paiements');
}

async function showDecompteCircuit(decompteId) {
    const d = await window.api.decomptes.get(decompteId);
    const circuit = await window.api.decomptes.getCircuit(decompteId);
    let events = [];
    try { events = await window.api.decomptes.getEvents(decompteId); } catch (e) {}
    const stepStatusClass = (s) => s === 'Validé' ? 'completed' : (['Avec remarques', 'Rejeté'].includes(s) ? 'failed' : '');
    const dateBadges = [
        d.date_ordonnancement ? `<span class="badge badge-warning">Ordonnancé le ${formatDate(d.date_ordonnancement)}</span>` : '',
        d.num_mandat ? `<span class="badge badge-info">Mandat ${d.num_mandat}</span>` : '',
        d.date_visa_tgr ? `<span class="badge badge-primary">Visa TGR le ${formatDate(d.date_visa_tgr)}</span>` : '',
        d.num_tgr ? `<span class="badge badge-muted">Réf. TGR ${d.num_tgr}</span>` : '',
        d.date_paiement ? `<span class="badge badge-success">Payé le ${formatDate(d.date_paiement)}</span>` : ''
    ].filter(Boolean).join(' ');
    const body = `
        <div class="mb-lg">
            <div class="d-flex justify-between align-center flex-wrap gap-md">
                <div><h4>${d.numero} — ${d.type}</h4><p class="text-sm text-muted">${d.code_lot} · ${d.lot_designation}</p></div>
                <div class="text-right"><div class="font-bold text-lg">${formatCurrency(d.montant_net_a_payer)}</div><div class="text-xs text-muted">Net à payer</div></div>
            </div>
            <div class="mt-sm d-flex align-center flex-wrap gap-sm">${decompteStatutBadge(d.statut)} ${d.phase_paiement ? `<span class="badge badge-info">📍 ${d.phase_paiement}</span>` : ''}</div>
            ${dateBadges ? `<div class="mt-sm d-flex align-center flex-wrap gap-sm">${dateBadges}</div>` : ''}
        </div>
        <div class="workflow-track">
            ${circuit.map(s => `
                <div class="workflow-step ${stepStatusClass(s.statut)}">
                    <div class="workflow-dot"></div>
                    <div class="workflow-step-content">
                        <div class="workflow-step-header">
                            <span class="workflow-step-title">${s.ordre}. ${s.etape}</span>
                            ${roleBadge(s.responsable_type)} ${statusBadge(s.statut)}
                        </div>
                        ${s.commentaire ? `<p class="text-xs text-secondary mt-sm" style="font-style:italic;">« ${s.commentaire} »</p>` : ''}
                        ${s.acteur || s.date_action ? `<div class="text-xs text-muted mt-sm">${s.acteur || ''} ${s.date_action ? '· ' + formatDateTime(s.date_action) : ''}</div>` : ''}
                        ${s.statut !== 'Validé' ? `
                            <div class="btn-group mt-sm">
                                <button class="btn btn-success btn-sm" onclick="actDecompteStep(${s.id}, 'Validé', '${s.etape.replace(/'/g, '’')}', ${decompteId})"><i data-lucide="check"></i> Valider</button>
                                <button class="btn btn-warning btn-sm" onclick="actDecompteStep(${s.id}, 'Avec remarques', '${s.etape.replace(/'/g, '’')}', ${decompteId})"><i data-lucide="message-square"></i> Remarques</button>
                                <button class="btn btn-danger btn-sm" onclick="actDecompteStep(${s.id}, 'Rejeté', '${s.etape.replace(/'/g, '’')}', ${decompteId})"><i data-lucide="x"></i> Rejeter</button>
                            </div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        ${events.length ? `<div class="mt-lg">
            <h5 class="mb-sm"><i data-lucide="history" style="width:16px;height:16px;vertical-align:-3px;"></i> Traçabilité (circuit documentaire)</h5>
            <div class="card-flat" style="border:1px solid var(--border-color);border-radius:8px;max-height:180px;overflow:auto;padding:4px 10px;">
                ${events.map(ev => `<div class="text-xs" style="padding:5px 0;border-bottom:1px solid var(--border-color);"><span class="text-muted">${formatDateTime(ev.created_at)}</span> · <strong>${ev.acteur_type || ''}</strong> — ${ev.action}${ev.details ? ` <span class="text-muted">(${ev.details})</span>` : ''}</div>`).join('')}
            </div>
        </div>` : ''}
    `;
    openModal('Circuit de paiement — ' + d.numero, body, `
        <button class="btn btn-ghost" onclick="closeModal()">Fermer</button>
        <button class="btn btn-secondary" onclick="showEntityDocs('decompte', ${decompteId}, ${d.projet_id}, 'Décompte ${d.numero}')"><i data-lucide="paperclip"></i> Pièces jointes</button>`, 'lg');
    if (window.lucide) lucide.createIcons();
}

async function actDecompteStep(stepId, statut, etape, decompteId) {
    let commentaire = '';
    if (statut !== 'Validé') {
        commentaire = prompt(`${statut} — motif / remarque :`);
        if (commentaire === null) return;
    } else {
        // Confirmation avant de valider une étape du circuit de paiement
        if (!confirm(`Confirmer la validation de l'étape « ${etape} » ?\n\nCette action fait avancer le décompte dans le circuit et est tracée.`)) return;
    }
    // Saisie du n° de mandat à l'ordonnancement / mandatement
    if (statut === 'Validé' && /ordonnancement|mandatement/i.test(etape)) {
        const num = prompt('N° du mandat / ordonnancement de paiement :');
        if (num) await window.api.decomptes.updateMandat(decompteId, num);
    }
    // Saisie de la référence du visa TGR
    if (statut === 'Validé' && /tgr/i.test(etape)) {
        const ref = prompt('Référence du visa TGR (Trésorerie Générale du Royaume) :');
        if (ref) await window.api.decomptes.updateTgr(decompteId, ref);
    }
    const acteur = currentUser.role === 'MOD' ? (currentUser.nom || 'MOD') : (currentUser.raison_sociale || currentUser.role);
    await window.api.decomptes.actStep(stepId, statut, commentaire, acteur);
    showToast('Circuit mis à jour', `${etape} : ${statut}.`, statut === 'Validé' ? 'success' : 'warning');
    showDecompteCircuit(decompteId);
}

// ============================================================
// MÉTÉO / INTEMPÉRIES (→ arrêts/reprises dans les OS)
// ============================================================
function meteoEmoji(cond) {
    cond = (cond || '').toLowerCase();
    if (/orage/.test(cond)) return '⛈️';
    if (/neige/.test(cond)) return '🌨️';
    if (/pluie forte|averses viol|verglaç/.test(cond)) return '🌧️';
    if (/pluie|averses|bruine/.test(cond)) return '🌦️';
    if (/brouillard/.test(cond)) return '🌫️';
    if (/couvert|nuageux/.test(cond)) return '☁️';
    if (/dégagé/.test(cond)) return '☀️';
    return '🌤️';
}

// Widget météo dans l'en-tête (près de la cloche de notifications)
async function updateHeaderWeather() {
    const el = document.getElementById('header-weather');
    if (!el || !currentUser) return;
    try {
        let ville = 'Rabat';
        if (currentUser.role === 'MOD') {
            const ps = await window.api.projets.getAll();
            if (ps && ps[0]) ville = ps[0].wilaya || ps[0].localisation || 'Rabat';
        } else if (currentUser.projet_id) {
            const p = await window.api.projets.get(currentUser.projet_id);
            if (p) ville = p.wilaya || p.localisation || 'Rabat';
        }
        const res = await window.api.meteo.fetch({ ville });
        if (res && res.success && res.data) {
            const d = res.data;
            el.innerHTML = `<span class="hw-emoji">${meteoEmoji(d.condition)}</span><span class="hw-temp">${Math.round(d.temp_max)}°</span><span class="hw-city">${d.ville}</span>`;
            el.title = `${d.condition} · ${Math.round(d.temp_min)}° / ${Math.round(d.temp_max)}° · ${d.ville}${d.arret_travaux ? ' · ⚠ intempérie' : ''}`;
            el.style.display = 'flex';
        } else {
            el.style.display = 'none';
        }
    } catch (e) { el.style.display = 'none'; }
}

async function renderMeteo(container) {
    updatePageTitle('Météo & Intempéries');
    const isM = isMOD();
    const projets = isM ? await window.api.projets.getAll() : [];
    const projetId = isM ? (window._meteoProjet || (projets[0] && projets[0].id)) : currentUser.projet_id;
    if (!projetId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌦️</div><h4>Aucun projet associé</h4></div>'; return; }
    window._meteoProjet = projetId;
    const projet = await window.api.projets.get(projetId);
    const entries = await window.api.meteo.getByProjet(projetId);
    const stats = await window.api.meteo.getStats(projetId);

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Météo & Intempéries</h2><p>Suivi journalier — les jours d'intempéries alimentent les OS d'arrêt/prolongation</p></div>
            <div class="btn-group">
                <button class="btn btn-secondary" onclick="captureMeteoAuto(${projetId}, '${(projet.wilaya || projet.localisation || 'Rabat').replace(/'/g, ' ')}')"><i data-lucide="cloud-download"></i> Capture auto (aujourd'hui)</button>
                <button class="btn btn-primary" onclick="showMeteoManualModal(${projetId})"><i data-lucide="plus"></i> Saisie manuelle</button>
            </div>
        </div>

        ${isM ? `<div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" onchange="window._meteoProjet=parseInt(this.value);navigateTo('meteo')">
                ${projets.map(p => `<option value="${p.id}" ${p.id === projetId ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
            <span class="text-xs text-muted">Ville : <strong>${projet.wilaya || projet.localisation || '—'}</strong></span>
        </div>` : ''}

        <div class="stats-grid animate-fade-in-up delay-1">
            <div class="stat-card stat-info"><div class="stat-icon icon-info"><i data-lucide="calendar-days"></i></div><div class="stat-content"><div class="stat-value">${stats.total}</div><div class="stat-label">Jours enregistrés</div></div></div>
            <div class="stat-card stat-danger"><div class="stat-icon icon-danger"><i data-lucide="cloud-rain-wind"></i></div><div class="stat-content"><div class="stat-value">${stats.intemperies}</div><div class="stat-label">Jours d'intempéries (arrêt)</div></div></div>
            <div class="stat-card stat-warning"><div class="stat-icon icon-warning"><i data-lucide="file-clock"></i></div><div class="stat-content"><div class="stat-value">${stats.intemperies}</div><div class="stat-label">Jours à récupérer (OS)</div></div></div>
            <div class="stat-card stat-primary"><div class="stat-icon icon-primary"><i data-lucide="globe"></i></div><div class="stat-content"><button class="btn btn-ghost btn-sm mt-sm" onclick="window.api.meteo.openOfficial()"><i data-lucide="external-link"></i> marocmeteo.ma</button><div class="stat-label">Confirmation officielle</div></div></div>
        </div>

        ${isM && stats.intemperies > 0 ? `<div class="card card-flat mb-lg animate-fade-in-up delay-2 d-flex justify-between align-center flex-wrap gap-md">
            <div><span class="font-semibold">${stats.intemperies} jour(s) d'intempéries</span> <span class="text-sm text-muted">— générez un OS de prolongation pour récupérer ce délai.</span></div>
            <button class="btn btn-secondary btn-sm" onclick="generateMeteoOS(${stats.intemperies})"><i data-lucide="file-plus"></i> Générer un OS de prolongation</button>
        </div>` : ''}

        <div class="card animate-fade-in-up delay-2"><div class="card-body">
            ${entries.length > 0 ? `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Date</th><th>Conditions</th><th>Temp.</th><th>Précip.</th><th>Vent</th><th>Impact chantier</th><th>Source</th><th></th></tr></thead>
                    <tbody>
                        ${entries.map(m => `
                            <tr>
                                <td class="font-medium">${formatDate(m.date)}</td>
                                <td>${meteoEmoji(m.condition)} ${m.condition || '—'}</td>
                                <td class="text-xs">${m.temp_min != null ? Math.round(m.temp_min) + '° / ' + Math.round(m.temp_max) + '°' : '—'}</td>
                                <td class="text-xs ${m.precipitation_mm >= 15 ? 'text-danger font-bold' : ''}">${m.precipitation_mm != null ? m.precipitation_mm + ' mm' : '—'}</td>
                                <td class="text-xs">${m.vent_kmh != null ? Math.round(m.vent_kmh) + ' km/h' : '—'}</td>
                                <td>${m.arret_travaux ? '<span class="badge badge-danger">Arrêt travaux</span>' : '<span class="badge badge-success">Travaillable</span>'}</td>
                                <td class="text-xs text-muted">${m.source || '—'}</td>
                                <td class="actions"><button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteMeteoEntry(${m.id})"><i data-lucide="trash-2"></i></button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>` : '<div class="empty-state"><div class="empty-state-icon">🌤️</div><h4>Aucun relevé météo</h4><p>Utilisez la capture automatique ou la saisie manuelle.</p></div>'}
        </div></div>
    `;
}

async function captureMeteoAuto(projetId, ville) {
    showToast('Capture en cours', 'Récupération des données météo…', 'info');
    const res = await window.api.meteo.fetch({ ville });
    if (!res.success) { showToast('Capture impossible', res.error || 'Erreur', 'warning'); return; }
    showMeteoManualModal(projetId, res.data);
}

function showMeteoManualModal(projetId, prefill = null) {
    const today = new Date().toISOString().split('T')[0];
    const p = prefill || {};
    const body = `
        <form id="form-meteo">
            <input type="hidden" name="projet_id" value="${projetId}">
            <div class="form-row">
                <div class="form-group"><label class="form-label required">Date</label><input type="date" class="form-control" name="date" value="${p.date || today}" required></div>
                <div class="form-group"><label class="form-label required">Conditions</label><input type="text" class="form-control" name="condition" value="${(p.condition || '').replace(/"/g, '&quot;')}" placeholder="Ex : Pluie forte" required></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Temp. min (°C)</label><input type="number" step="0.1" class="form-control" name="temp_min" value="${p.temp_min ?? ''}"></div>
                <div class="form-group"><label class="form-label">Temp. max (°C)</label><input type="number" step="0.1" class="form-control" name="temp_max" value="${p.temp_max ?? ''}"></div>
                <div class="form-group"><label class="form-label">Précip. (mm)</label><input type="number" step="0.1" class="form-control" name="precipitation_mm" value="${p.precipitation_mm ?? ''}"></div>
                <div class="form-group"><label class="form-label">Vent (km/h)</label><input type="number" step="1" class="form-control" name="vent_kmh" value="${p.vent_kmh ?? ''}"></div>
            </div>
            <div class="form-group">
                <label class="checklist-item"><input type="checkbox" name="arret_travaux" ${p.arret_travaux ? 'checked' : ''}> <span>Journée d'intempéries — <strong>arrêt des travaux</strong> (comptabilisée pour les OS)</span></label>
            </div>
            <div class="form-group"><label class="form-label">Commentaire</label><input type="text" class="form-control" name="commentaire" placeholder="Zone concernée, tâches impactées…"></div>
            ${p.source ? `<input type="hidden" name="source" value="${p.source}"><p class="text-xs text-muted">Source : ${p.source} — confirmez sur <a href="#" onclick="window.api.meteo.openOfficial();return false;">marocmeteo.ma</a>.</p>` : ''}
        </form>
    `;
    openModal(prefill ? 'Confirmer le relevé météo' : 'Saisie météo manuelle', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitMeteo(${projetId})"><i data-lucide="save"></i> Enregistrer</button>
    `, 'lg');
}

async function submitMeteo(projetId) {
    const form = document.getElementById('form-meteo');
    const data = Object.fromEntries(new FormData(form));
    data.arret_travaux = form.querySelector('[name=arret_travaux]').checked ? 1 : 0;
    data.saisi_par = currentUser.role === 'MOD' ? 'MOD' : (currentUser.raison_sociale || currentUser.role);
    data.saisi_par_role = currentUser.role;
    if (!data.date || !data.condition) { showToast('Erreur', 'Date et conditions requises.', 'danger'); return; }
    try {
        await window.api.meteo.create(data);
        closeModal();
        showToast('Enregistré', 'Relevé météo enregistré.', 'success');
        navigateTo('meteo');
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function deleteMeteoEntry(id) {
    if (!confirm('Supprimer ce relevé météo ?')) return;
    await window.api.meteo.delete(id);
    showToast('Supprimé', 'Relevé supprimé.', 'success');
    navigateTo('meteo');
}

function generateMeteoOS(jours) {
    showNewOSModal({
        type_os: 'Prolongation',
        delai_jours: jours,
        objet: `Prolongation du délai pour intempéries (${jours} jour(s) d'arrêt constaté(s))`,
        motif: `Récupération des journées d'intempéries enregistrées dans le journal météo (${jours} jour(s)).`
    });
}

// ============================================================
// HUB DOCUMENTATION (fusion : Documents + Photothèque + Comptes rendus)
// ============================================================
// Hub générique à onglets (fusion de modules de même catégorie)
async function renderTabHub(container, title, tabs) {
    updatePageTitle(title);
    window._hubRenderers = {};
    tabs.forEach(t => { window._hubRenderers[t.pid] = t.render; });
    container.innerHTML = `
        <div class="tabs animate-fade-in-up">
            ${tabs.map((t, i) => `<button class="tab ${i === 0 ? 'active' : ''}" onclick="hubSwitch(this, '${t.pid}')"><i data-lucide="${t.icon}" style="width:15px;height:15px;"></i> ${t.label}</button>`).join('')}
        </div>
        ${tabs.map((t, i) => `<div id="${t.pid}" class="hub-panel"${i === 0 ? ' data-loaded="1"' : ' style="display:none;"'}></div>`).join('')}
    `;
    await tabs[0].render(document.getElementById(tabs[0].pid));
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: container });
}

async function hubSwitch(btn, pid) {
    btn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.hub-panel').forEach(p => p.style.display = 'none');
    const panel = document.getElementById(pid);
    panel.style.display = 'block';
    if (!panel.dataset.loaded) {
        panel.dataset.loaded = '1';
        const fn = (window._hubRenderers || {})[pid];
        if (fn) await fn(panel);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: panel });
}

function renderDocumentationHub(c) {
    return renderTabHub(c, 'Documentation & PV', [
        { pid: 'hub-documents', label: 'Documents', icon: 'folder', render: renderDocuments },
        { pid: 'hub-photos', label: 'Photothèque', icon: 'images', render: renderPhototheque },
        { pid: 'hub-cr', label: 'Comptes rendus & PV', icon: 'clipboard-pen-line', render: renderComptesRendus }
    ]);
}
function renderReportingHub(c) {
    return renderTabHub(c, 'Reporting & journal', [
        { pid: 'hub-reporting', label: 'Reporting', icon: 'bar-chart-3', render: renderReporting },
        { pid: 'hub-journal', label: 'Journal / Traçabilité', icon: 'history', render: renderJournal }
    ]);
}
function renderActeursHub(c) {
    return renderTabHub(c, 'Intervenants & accès', [
        { pid: 'hub-interv', label: 'Intervenants', icon: 'users', render: renderIntervenants },
        { pid: 'hub-sessions', label: 'Sessions intervenants', icon: 'key-round', render: renderSessions },
        { pid: 'hub-modteam', label: 'Équipe MOD', icon: 'user-cog', render: renderModTeam }
    ]);
}
function renderSuiviHub(c) {
    return renderTabHub(c, 'Suivi & contrôle', [
        { pid: 'hub-wf', label: 'Workflow', icon: 'git-branch', render: renderWorkflow },
        { pid: 'hub-illu', label: 'Illustration', icon: 'image', render: renderIllustrationSuivi },
        { pid: 'hub-res', label: 'Réserves', icon: 'alert-triangle', render: renderReserves },
        { pid: 'hub-ess', label: 'Essais labo', icon: 'flask-conical', render: renderEssais },
        { pid: 'hub-hqse', label: 'HQSE & risques', icon: 'shield-alert', render: renderHqse }
    ]);
}
function renderPlanningHub(c) {
    return renderTabHub(c, 'Planning & délais', [
        { pid: 'hub-delais', label: 'Délais & planning', icon: 'calendar-clock', render: renderDelais },
        { pid: 'hub-axe', label: 'Axe de délai', icon: 'gantt-chart', render: renderDelaiAxis },
        { pid: 'hub-os', label: 'Ordres de service', icon: 'file-text', render: renderOrdresService },
        { pid: 'hub-meteo', label: 'Météo & intempéries', icon: 'cloud-sun-rain', render: renderMeteo }
    ]);
}
function renderChantierHub(c) {
    return renderTabHub(c, 'Réunions & permanence', [
        { pid: 'hub-reunions', label: 'Réunions', icon: 'calendar', render: renderReunions },
        { pid: 'hub-perm', label: 'Permanence chantier', icon: 'user-check', render: renderPermanence }
    ]);
}
function renderAdminHub(c) {
    return renderTabHub(c, 'Paramètres & sauvegarde', [
        { pid: 'hub-param', label: 'Paramètres & droits', icon: 'sliders-horizontal', render: renderParametres },
        { pid: 'hub-backup', label: 'Sauvegarde & export', icon: 'database-backup', render: renderBackup }
    ]);
}

// ============================================================
// DOCUMENTS (GED : plans, notes de calcul, fiches techniques…)
// ============================================================
const DOC_TYPES = ['Plan', 'Note de calcul', 'Fiche technique', 'PV', 'Rapport', 'Marché', 'Photo', 'Attestation', 'Autre'];
let _docCtx = null;

function docIcon(ext) {
    ext = (ext || '').toLowerCase();
    if (ext === 'pdf') return 'file-text';
    if (['dwg', 'dxf'].includes(ext)) return 'pen-tool';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tif', 'tiff'].includes(ext)) return 'image';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'file-spreadsheet';
    if (['doc', 'docx'].includes(ext)) return 'file-type';
    if (['zip', 'rar', '7z'].includes(ext)) return 'file-archive';
    return 'file';
}

function docTypeBadge(t) {
    const map = { 'Plan': 'badge-info', 'Note de calcul': 'badge-primary', 'Fiche technique': 'badge-secondary', 'PV': 'badge-warning', 'Rapport': 'badge-primary', 'Marché': 'badge-muted', 'Photo': 'badge-success', 'Attestation': 'badge-success', 'Autre': 'badge-muted' };
    return `<span class="badge ${map[t] || 'badge-muted'}">${t}</span>`;
}

// Tableau de documents réutilisable
function docTableHtml(docs, onDoneName) {
    if (!docs.length) return '<div class="empty-state p-lg"><div class="empty-state-icon">📁</div><p class="text-muted">Aucun document. Cliquez sur « Ajouter un document ».</p></div>';
    return `
        <div class="table-wrapper">
            <table class="data-table">
                <thead><tr><th>Document</th><th>Type</th>${onDoneName === 'documents' ? '<th>Projet</th>' : ''}<th>Taille</th><th>Ajouté par</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                    ${docs.map(d => `
                        <tr>
                            <td><span class="d-flex align-center gap-sm"><i data-lucide="${docIcon(d.extension)}" style="width:16px;height:16px;color:var(--primary-light);"></i> <span class="font-medium">${d.nom}</span></span>${d.description ? `<div class="text-xs text-muted">${d.description}</div>` : ''}</td>
                            <td>${docTypeBadge(d.type_document)}</td>
                            ${onDoneName === 'documents' ? `<td>${d.code_projet ? `<span class="badge badge-info">${d.code_projet}</span>` : '—'}</td>` : ''}
                            <td class="text-xs">${formatBytes(d.taille)}</td>
                            <td class="text-xs text-muted">${d.uploaded_by || '—'}</td>
                            <td class="text-xs text-muted">${formatDate(d.created_at)}</td>
                            <td class="actions">
                                <button class="btn btn-ghost btn-sm" title="Ouvrir" onclick="openDocument(${d.id})"><i data-lucide="external-link"></i></button>
                                <button class="btn btn-ghost btn-sm" title="Enregistrer sous…" onclick="downloadDocument(${d.id})"><i data-lucide="download"></i></button>
                                <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteDocument(${d.id})"><i data-lucide="trash-2"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
}

async function renderDocuments(container) {
    updatePageTitle('Documents');
    const isM = isMOD();
    const projets = isM ? await window.api.projets.getAll() : [];
    const filtreProjet = window._docProjet || '';
    const filtreType = window._docType || '';
    const docs = await window.api.documents.getAll({ projetId: filtreProjet || undefined, type: filtreType || undefined });

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Gestion documentaire</h2><p>Plans, notes de calcul, fiches techniques, PV… — ${docs.length} document(s)</p></div>
            <button class="btn btn-primary" onclick="showUploadDocModal({entite_type:'projet', chooseProjet:true, onDoneName:'documents'})"><i data-lucide="upload"></i> Ajouter un document</button>
        </div>
        <div class="filter-bar animate-fade-in-up delay-1">
            ${isM ? `<select class="form-control" onchange="window._docProjet=this.value;navigateTo('documents')">
                <option value="">Tous les projets</option>
                ${projets.map(p => `<option value="${p.id}" ${String(p.id) === String(filtreProjet) ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>` : ''}
            <select class="form-control" onchange="window._docType=this.value;navigateTo('documents')">
                <option value="">Tous les types</option>
                ${DOC_TYPES.map(t => `<option value="${t}" ${t === filtreType ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
        </div>
        <div class="card animate-fade-in-up delay-2"><div class="card-body">${docTableHtml(docs, 'documents')}</div></div>
    `;
}

const PHOTO_CATS = ['Avancement', 'Conformité', 'Anomalie', 'Réception', 'Annotation', 'Autre'];

function showUploadDocModal(ctx) {
    _docCtx = ctx;
    const typeField = ctx.photo
        ? `<div class="form-group"><label class="form-label required">Catégorie de la photo</label>
                <select class="form-control" name="categorie">${PHOTO_CATS.map(c => `<option ${ctx.defaultCat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>`
        : `<div class="form-group"><label class="form-label required">Type de document</label>
                <select class="form-control" name="type_document">${DOC_TYPES.map(t => `<option ${ctx.defaultType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
    const body = `
        <form id="form-upload-doc">
            ${typeField}
            ${ctx.chooseProjet ? `<div class="form-group"><label class="form-label">Projet associé</label><select class="form-control" name="projet_id" id="doc-projet-select"><option value="">— Aucun (général) —</option></select></div>` : ''}
            <div class="form-group"><label class="form-label">${ctx.photo ? 'Légende / localisation' : 'Description (optionnel)'}</label><input type="text" class="form-control" name="description" placeholder="${ctx.photo ? 'Ex : Ferraillage plancher RDC Bloc A — fissure poteau P12' : 'Ex : Plan de coffrage plancher haut RDC Bloc A'}"></div>
            <p class="text-xs text-muted">Vous pourrez sélectionner un ou plusieurs fichiers${ctx.photo ? ' image (JPG, PNG…)' : ' (PDF, DWG, images, Excel, Word…)'}.</p>
        </form>
    `;
    openModal(ctx.photo ? 'Ajouter des photos' : 'Ajouter un document', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="doUploadDocument()"><i data-lucide="upload"></i> Choisir le(s) fichier(s)…</button>
    `);
    if (ctx.chooseProjet) loadDocProjets();
}

async function loadDocProjets() {
    const projets = await window.api.projets.getAll();
    const sel = document.getElementById('doc-projet-select');
    if (sel) sel.innerHTML = '<option value="">— Aucun (général) —</option>' + projets.map(p => `<option value="${p.id}" ${_docCtx && _docCtx.projet_id === p.id ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('');
}

async function doUploadDocument() {
    const data = Object.fromEntries(new FormData(document.getElementById('form-upload-doc')));
    const meta = {
        type_document: _docCtx.photo ? 'Photo' : data.type_document,
        categorie: data.categorie || null,
        description: data.description,
        entite_type: _docCtx.entite_type || 'projet',
        entite_id: _docCtx.entite_id || null,
        projet_id: data.projet_id ? parseInt(data.projet_id) : (_docCtx.projet_id || null),
        uploaded_by: currentUser.role === 'MOD' ? 'MOD' : (currentUser.raison_sociale || currentUser.role),
        uploaded_by_role: currentUser.role
    };
    const res = await window.api.documents.upload(meta);
    if (res.canceled) return;
    if (res.success) {
        closeModal();
        showToast(_docCtx.photo ? 'Photos ajoutées' : 'Documents ajoutés', `${res.count} fichier(s) importé(s).`, 'success');
        if (_docCtx.onDoneName === 'documents') navigateTo('documents');
        else if (_docCtx.onDoneName === 'phototheque') navigateTo('phototheque');
        else if (_docCtx.onDoneName === 'project-docs') loadProjectDocs(_docCtx.projet_id);
    } else showToast('Erreur', res.error || 'Import impossible.', 'danger');
}

async function openDocument(id) {
    const r = await window.api.documents.open(id);
    if (r && r.error) showToast('Erreur', r.error, 'danger');
}
async function downloadDocument(id) {
    const r = await window.api.documents.saveAs(id);
    if (r && r.success) showToast('Enregistré', 'Document enregistré : ' + r.path, 'success');
}
async function deleteDocument(id) {
    if (!confirm('Supprimer ce document définitivement ?')) return;
    await window.api.documents.delete(id);
    showToast('Supprimé', 'Document supprimé.', 'success');
    if (currentPage === 'project-detail' && window._currentProjetId) loadProjectDocs(window._currentProjetId);
    else navigateTo(currentPage);
}

// Charge les documents d'un projet (onglet Documents du détail projet)
async function loadProjectDocs(projetId) {
    const el = document.getElementById('project-docs-list');
    if (!el) return;
    const docs = await window.api.documents.getByEntity('projet', projetId);
    el.innerHTML = docTableHtml(docs, 'project-docs');
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: el });
}

// ============================================================
// PHOTOTHÈQUE (illustration : avancement, conformité, anomalies)
// ============================================================
function photoCatBadge(c) {
    const map = { 'Avancement': 'badge-info', 'Conformité': 'badge-success', 'Anomalie': 'badge-danger', 'Réception': 'badge-primary', 'Autre': 'badge-muted' };
    return `<span class="badge ${map[c] || 'badge-muted'}">${c || 'Autre'}</span>`;
}

// Volet Illustration intégré au Suivi & contrôle (maîtrise temps réel : avancement / conformité / anomalies)
async function renderIllustrationSuivi(container) {
    const isM = isMOD();
    const projets = isM ? await window.api.projets.getAll() : [];
    const filtreProjet = window._illuProjet != null ? window._illuProjet : (isM ? '' : (currentUser.projet_id || ''));
    const photos = await window.api.photos.getGallery({ projetId: filtreProjet || undefined, limit: 400 });
    window._galleryPhotos = photos;
    const byCat = (c) => photos.filter(p => (p.categorie || 'Autre') === c);
    const idxOf = (ph) => photos.indexOf(ph);
    const groups = [
        { cat: 'Avancement', icon: 'trending-up', cls: 'stat-info' },
        { cat: 'Conformité', icon: 'check-circle-2', cls: 'stat-success' },
        { cat: 'Anomalie', icon: 'alert-octagon', cls: 'stat-danger' },
        { cat: 'Réception', icon: 'clipboard-check', cls: 'stat-primary' }
    ];
    const strip = (cat) => {
        const list = byCat(cat);
        if (!list.length) return `<div class="empty-state p-md"><p class="text-muted text-sm">Aucune illustration « ${cat} » pour le moment.</p></div>`;
        return `<div class="photo-grid">${list.slice(0, 12).map(ph => `
            <div class="photo-card">
                <div class="photo-thumb" onclick="showPhotoLightbox(${idxOf(ph)})">
                    ${ph.dataUrl ? `<img src="${ph.dataUrl}" alt="${ph.nom}" loading="lazy">` : '<div class="photo-missing">🖼️</div>'}
                    <span class="photo-cat">${photoCatBadge(ph.categorie)}</span>
                </div>
                <div class="photo-meta"><div class="text-xs font-medium truncate" title="${ph.description || ph.nom}">${ph.description || ph.nom}</div>
                <div class="text-xs text-muted mt-sm">${ph.code_projet || ''} · ${formatDate(ph.created_at)}</div></div>
            </div>`).join('')}</div>`;
    };
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Illustration — maîtrise en temps réel</h2><p>Avancement, conformités et anomalies illustrés par la photo de chantier</p></div>
            <button class="btn btn-primary" onclick="showUploadDocModal({photo:true, entite_type:'projet', chooseProjet:${isM}, projet_id:${isM ? 'null' : (currentUser.projet_id || 'null')}, onDoneName:'hub-suivi'})"><i data-lucide="camera"></i> Ajouter des photos</button>
        </div>
        ${isM ? `<div class="filter-bar animate-fade-in-up delay-1">
            <select class="form-control" onchange="window._illuProjet=this.value;renderIllustrationSuivi(document.getElementById('hub-illu'))">
                <option value="">Tous les projets</option>
                ${projets.map(p => `<option value="${p.id}" ${String(p.id) === String(filtreProjet) ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>
        </div>` : ''}
        <div class="stats-grid animate-fade-in-up delay-1">
            ${groups.map(g => `<div class="stat-card ${g.cls}"><div class="stat-icon"><i data-lucide="${g.icon}"></i></div><div class="stat-content"><div class="stat-value">${byCat(g.cat).length}</div><div class="stat-label">${g.cat}</div></div></div>`).join('')}
        </div>
        ${byCat('Anomalie').length ? `<div class="card card-flat mb-lg animate-fade-in-up delay-2" style="border-left:3px solid var(--danger);"><div class="card-body"><strong class="text-danger">⚠ ${byCat('Anomalie').length} anomalie(s) illustrée(s)</strong> <span class="text-sm text-muted">— à traiter en priorité.</span></div></div>` : ''}
        ${groups.map(g => `
            <div class="card mt-lg animate-fade-in-up delay-2">
                <div class="card-header"><h4><i data-lucide="${g.icon}" style="width:18px;height:18px;margin-right:8px;vertical-align:-4px;"></i>${g.cat} <span class="text-muted text-sm">(${byCat(g.cat).length})</span></h4></div>
                <div class="card-body">${strip(g.cat)}</div>
            </div>`).join('')}
    `;
    if (window.lucide) lucide.createIcons({ node: container });
}

async function renderPhototheque(container) {
    updatePageTitle('Photothèque');
    const isM = isMOD();
    const projets = isM ? await window.api.projets.getAll() : [];
    const filtreProjet = window._photoProjet || '';
    const filtreCat = window._photoCat || '';
    const photos = await window.api.photos.getGallery({ projetId: filtreProjet || undefined, categorie: filtreCat || undefined });
    window._galleryPhotos = photos;

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Photothèque</h2><p>Illustration de l'avancement, des conformités et anomalies — ${photos.length} photo(s)</p></div>
            <button class="btn btn-primary" onclick="showUploadDocModal({photo:true, entite_type:'projet', chooseProjet:${isM}, projet_id:${isM ? 'null' : (currentUser.projet_id || 'null')}, onDoneName:'phototheque'})"><i data-lucide="camera"></i> Ajouter des photos</button>
        </div>
        <div class="filter-bar animate-fade-in-up delay-1">
            ${isM ? `<select class="form-control" onchange="window._photoProjet=this.value;navigateTo('phototheque')">
                <option value="">Tous les projets</option>
                ${projets.map(p => `<option value="${p.id}" ${String(p.id) === String(filtreProjet) ? 'selected' : ''}>${p.code_projet} — ${p.intitule}</option>`).join('')}
            </select>` : ''}
            <select class="form-control" onchange="window._photoCat=this.value;navigateTo('phototheque')">
                <option value="">Toutes catégories</option>
                ${PHOTO_CATS.map(c => `<option value="${c}" ${c === filtreCat ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
        </div>
        ${photos.length > 0 ? `
        <div class="photo-grid animate-fade-in-up delay-2">
            ${photos.map((ph, i) => `
                <div class="photo-card">
                    <div class="photo-thumb" onclick="showPhotoLightbox(${i})">
                        ${ph.dataUrl ? `<img src="${ph.dataUrl}" alt="${ph.nom}" loading="lazy">` : '<div class="photo-missing">🖼️<br>Image indisponible</div>'}
                        <span class="photo-cat">${photoCatBadge(ph.categorie)}</span>
                    </div>
                    <div class="photo-meta">
                        <div class="text-xs font-medium truncate" title="${ph.description || ph.nom}">${ph.description || ph.nom}</div>
                        <div class="d-flex justify-between align-center mt-sm">
                            <span class="text-xs text-muted">${ph.code_projet || ''} · ${formatDate(ph.created_at)}</span>
                            <button class="btn btn-ghost btn-sm" title="Supprimer" onclick="deleteDocument(${ph.id})"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>` : '<div class="empty-state animate-fade-in-up delay-2"><div class="empty-state-icon">📷</div><h4>Aucune photo</h4><p>Ajoutez des photos de chantier pour illustrer l\'avancement et les contrôles.</p></div>'}
    `;
}

function showPhotoLightbox(index) {
    const photos = window._galleryPhotos || [];
    const ph = photos[index];
    if (!ph) return;
    const body = `
        <div class="text-center">
            ${ph.dataUrl ? `<img src="${ph.dataUrl}" style="max-width:100%; max-height:65vh; border-radius:8px;">` : '<div class="p-xl">Image indisponible</div>'}
            <div class="d-flex justify-between align-center mt-md flex-wrap gap-md">
                <div class="text-left">
                    <div class="font-semibold">${ph.description || ph.nom}</div>
                    <div class="text-xs text-muted">${ph.code_projet || ''} · ${formatDateTime(ph.created_at)} · ${ph.uploaded_by || ''}</div>
                </div>
                <div>${photoCatBadge(ph.categorie)}</div>
            </div>
        </div>
    `;
    openModal('Photo', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Fermer</button>
        <button class="btn btn-secondary" onclick="downloadDocument(${ph.id})"><i data-lucide="download"></i> Enregistrer</button>
    `, 'lg');
}

// ============================================================
// PARAMÈTRES & DROITS (MOD contrôle les accès)
// ============================================================
async function renderParametres(container) {
    updatePageTitle('Paramètres & Droits');
    const s = await window.api.settings.get();
    window.appSettings = s;
    const roles = ['Architecte', 'BET', 'BCT', 'Laboratoire', 'Topographe', 'Entreprise'];
    const modules = [{ id: 'documentation', label: 'Documentation & PV' }, { id: 'meteo', label: 'Météo' }, { id: 'hqse', label: 'HQSE' }];
    const perm = (r, m) => !(s.perms && s.perms[r] && s.perms[r][m] === false); // défaut autorisé
    const attachAllowed = (r) => !!(s.perms && s.perms[r] && s.perms[r].attachements);

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Paramètres & Droits d'accès</h2><p>Vous seul décidez des modules ouverts et des privilèges des intervenants</p></div>
            <button class="btn btn-primary" onclick="saveParametres()"><i data-lucide="save"></i> Enregistrer</button>
        </div>

        <div class="card animate-fade-in-up delay-1">
            <div class="card-header"><h4><i data-lucide="banknote" style="width:18px;height:18px;margin-right:8px;"></i>Volet financier</h4></div>
            <div class="card-body">
                <label class="checklist-item" style="font-size:14px;">
                    <input type="checkbox" id="set-module-paiements" ${s.modules && s.modules.paiements ? 'checked' : ''}>
                    <span><strong>Ouvrir le volet « Décomptes & Paiements »</strong> (attachements, décomptes, circuit de mandatement). Activez-le lorsque la phase de paiement arrive.</span>
                </label>
            </div>
        </div>

        <div class="card mt-lg animate-fade-in-up delay-2">
            <div class="card-header"><h4><i data-lucide="users" style="width:18px;height:18px;margin-right:8px;"></i>Privilèges des intervenants</h4></div>
            <div class="card-body">
                <p class="text-xs text-muted mb-md">Cochez les modules accessibles à chaque intervenant. La colonne « Saisie attachements » n'a d'effet que si le volet financier est ouvert.</p>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Intervenant</th>${modules.map(m => `<th>${m.label}</th>`).join('')}<th>Saisie attachements</th></tr></thead>
                        <tbody>
                            ${roles.map(r => `
                                <tr>
                                    <td>${roleBadge(r)}</td>
                                    ${modules.map(m => `<td><input type="checkbox" class="perm-box" data-role="${r}" data-mod="${m.id}" ${perm(r, m.id) ? 'checked' : ''}></td>`).join('')}
                                    <td><input type="checkbox" class="perm-box" data-role="${r}" data-mod="attachements" ${attachAllowed(r) ? 'checked' : ''} ${r !== 'Entreprise' ? 'disabled title="Réservé aux entreprises"' : ''}></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

async function saveParametres() {
    const cfg = { modules: { paiements: document.getElementById('set-module-paiements').checked }, perms: {} };
    document.querySelectorAll('.perm-box').forEach(box => {
        const r = box.dataset.role, m = box.dataset.mod;
        if (!cfg.perms[r]) cfg.perms[r] = {};
        cfg.perms[r][m] = box.checked;
    });
    await window.api.settings.set(cfg);
    window.appSettings = cfg;
    buildNavigation(currentUser.role); // rafraîchir le menu MOD immédiatement
    showToast('Enregistré', 'Droits et modules mis à jour. Les intervenants les verront à leur prochaine connexion.', 'success');
}

// ============================================================
// SAUVEGARDE & EXPORT (MOD)
// ============================================================
function formatBytes(n) {
    if (!n) return '0 o';
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' Mo';
    if (n >= 1024) return (n / 1024).toFixed(0) + ' Ko';
    return n + ' o';
}

async function renderBackup(container) {
    updatePageTitle('Sauvegarde & Export');
    const autos = await window.api.backup.listAuto();

    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Sauvegarde & Export</h2><p>Protégez et exportez les données de l'application</p></div>
        </div>

        <div class="content-grid-3 animate-fade-in-up delay-1">
            <div class="card">
                <div class="stat-icon icon-primary mb-md"><i data-lucide="save"></i></div>
                <h4 style="font-size:var(--text-md);">Sauvegarder la base</h4>
                <p class="text-sm text-muted mt-sm mb-md">Enregistrez une copie complète de la base (fichier .db) sur votre disque ou un support externe.</p>
                <button class="btn btn-primary w-full" onclick="doBackupSave()"><i data-lucide="download"></i> Sauvegarder maintenant</button>
            </div>
            <div class="card">
                <div class="stat-icon icon-warning mb-md"><i data-lucide="upload"></i></div>
                <h4 style="font-size:var(--text-md);">Restaurer une sauvegarde</h4>
                <p class="text-sm text-muted mt-sm mb-md">Remplacez les données actuelles par une sauvegarde précédente. Une copie de sécurité est faite avant.</p>
                <button class="btn btn-secondary w-full" onclick="doBackupRestore()"><i data-lucide="rotate-ccw"></i> Restaurer…</button>
            </div>
            <div class="card">
                <div class="stat-icon icon-success mb-md"><i data-lucide="file-spreadsheet"></i></div>
                <h4 style="font-size:var(--text-md);">Exporter en CSV (Excel)</h4>
                <p class="text-sm text-muted mt-sm mb-md">Exportez toutes les tables au format CSV, exploitable dans Excel pour vos analyses.</p>
                <button class="btn btn-ghost w-full" onclick="doBackupExportCsv()"><i data-lucide="table"></i> Exporter en CSV</button>
            </div>
        </div>

        <div class="card mt-lg animate-fade-in-up delay-2">
            <div class="card-header">
                <h4><i data-lucide="history" style="width:18px;height:18px;margin-right:8px;"></i>Sauvegardes automatiques</h4>
                <button class="btn btn-ghost btn-sm" onclick="doBackupOpenFolder()"><i data-lucide="folder-open"></i> Ouvrir le dossier</button>
            </div>
            <div class="card-body">
                <p class="text-xs text-muted mb-md">L'application crée automatiquement une sauvegarde à chaque démarrage (10 dernières conservées).</p>
                ${autos.length > 0 ? `
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead><tr><th>Fichier</th><th>Date</th><th>Taille</th></tr></thead>
                            <tbody>
                                ${autos.map(b => `<tr><td class="text-xs"><code>${b.nom}</code></td><td class="text-xs text-muted">${formatDateTime(b.date)}</td><td class="text-xs">${formatBytes(b.taille)}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state p-lg"><p class="text-muted">Aucune sauvegarde automatique pour le moment.</p></div>'}
            </div>
        </div>
    `;
}

async function doBackupSave() {
    const res = await window.api.backup.save();
    if (res.canceled) return;
    if (res.success) showToast('Sauvegarde réussie', 'Base enregistrée : ' + res.path, 'success');
    else showToast('Erreur', res.error || 'Sauvegarde impossible', 'danger');
}

async function doBackupRestore() {
    if (!confirm('Restaurer une sauvegarde va REMPLACER toutes les données actuelles. Une copie de sécurité sera créée automatiquement. Continuer ?')) return;
    const res = await window.api.backup.restore();
    if (res.canceled) return;
    if (res.success) {
        showToast('Restauration réussie', 'Rechargement de l\'application…', 'success');
        setTimeout(() => location.reload(), 1500);
    } else {
        showToast('Erreur', res.error || 'Restauration impossible', 'danger');
    }
}

async function doBackupExportCsv() {
    const res = await window.api.backup.exportCsv();
    if (res.canceled) return;
    if (res.success) showToast('Export réussi', `${res.tables} tables exportées dans : ${res.path}`, 'success');
    else showToast('Erreur', res.error || 'Export impossible', 'danger');
}

async function doBackupOpenFolder() {
    await window.api.backup.openFolder();
}

// ============================================================
// INTERVENANT-SPECIFIC PAGES
// ============================================================
async function renderIntervenantTasks(container, pageId) {
    const roleMap = {
        'taches-arch': 'Architecte',
        'missions-bet': 'BET',
        'validations-bct': 'BCT',
        'implantations': 'Topographe'
    };
    const role = roleMap[pageId] || currentUser.role;
    const titles = {
        'taches-arch': 'Tâches Architecte',
        'missions-bet': 'Missions BET',
        'validations-bct': 'Validations BCT',
        'implantations': 'Attestations d\'Implantation'
    };
    
    updatePageTitle(titles[pageId] || 'Tâches');
    const pending = await window.api.workflow.getPending(role, currentUser.intervenant_id);
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>${titles[pageId]}</h2><p>${pending.length} tâche(s) en attente</p></div>
        </div>
        
        ${pending.length > 0 ? `
            <div class="animate-fade-in-up delay-1">
                ${pending.map(e => `
                    <div class="card mb-md">
                        <div class="d-flex justify-between align-center mb-md">
                            <div>
                                <h4 style="font-size: var(--text-md);">${e.ouvrage_nom}</h4>
                                <div class="text-xs text-muted">${e.projet_nom} — ${e.code_lot} — ${e.bloc || ''} ${e.niveau || ''}</div>
                            </div>
                            ${statusBadge(e.statut)}
                        </div>
                        <p class="text-sm text-muted mb-md">Étape: <strong>${e.type_etape}</strong></p>
                        <div class="btn-group">
                            <button class="btn btn-success btn-sm" onclick="showSubmitAvisModal(${e.id}, '${e.type_etape}', ${e.ouvrage_id})">
                                <i data-lucide="check-circle"></i> Soumettre avis favorable
                            </button>
                            <button class="btn btn-warning btn-sm" onclick="showSubmitAvisModal(${e.id}, '${e.type_etape}', ${e.ouvrage_id}, true)">
                                <i data-lucide="alert-triangle"></i> Avec réserves
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : '<div class="empty-state animate-fade-in-up"><div class="empty-state-icon">✅</div><h4>Toutes les tâches traitées</h4><p>Aucune mission en attente.</p></div>'}
    `;
}

// Grilles de vérification par type de réception
const CHECKLISTS = {
    'Vérification architecte': ['Présence et positionnement des réservations', 'Alignement de l\'ouvrage', 'Respect des dimensions et cotes', 'Conformité aux plans architecte'],
    'Attestation implantation': ['Implantation conforme aux plans', 'Niveaux (altimétrie) vérifiés', 'Axes et angles conformes', 'Report des repères de nivellement'],
    'Réception BET': ['Ferraillage conforme au plan BA', 'Enrobage des armatures respecté', 'Sections et espacements des aciers', 'Stabilité et étanchéité du coffrage'],
    'Contrôle BCT': ['Conformité réglementaire', 'Sécurité et stabilité de l\'ouvrage', 'Validation des produits/matériaux proposés', 'Cohérence avec l\'avis du BET']
};

function showSubmitAvisModal(etapeId, typeEtape, ouvrageId, withReserves = false) {
    const checklist = CHECKLISTS[typeEtape];
    const checklistHtml = checklist ? `
        <div class="form-group">
            <label class="form-label">Grille de vérification</label>
            <div class="checklist">
                ${checklist.map((item, i) => `
                    <label class="checklist-item">
                        <input type="checkbox" class="avis-check" data-label="${item.replace(/"/g, '')}" checked>
                        <span>${item}</span>
                    </label>
                `).join('')}
            </div>
        </div>` : '';
    const body = `
        <form id="form-avis">
            <input type="hidden" name="etape_id" value="${etapeId}">
            <input type="hidden" name="ouvrage_id" value="${ouvrageId}">
            <div class="form-group">
                <label class="form-label required">Type d'avis</label>
                <select class="form-control" name="type_avis">
                    <option ${!withReserves ? 'selected' : ''}>Favorable</option>
                    <option ${withReserves ? 'selected' : ''}>Favorable avec réserves</option>
                    <option>Défavorable</option>
                </select>
            </div>
            ${checklistHtml}
            <div class="form-group">
                <label class="form-label">Commentaire / Observations</label>
                <textarea class="form-control" name="contenu" rows="3" placeholder="Détaillez vos observations (obligatoire en cas de réserve)..."></textarea>
            </div>
        </form>
    `;
    openModal('Soumettre un avis — ' + typeEtape, body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitAvis()"><i data-lucide="send"></i> Soumettre</button>
    `);
}

async function submitAvis() {
    const form = document.getElementById('form-avis');
    const data = Object.fromEntries(new FormData(form));
    data.intervenant_id = currentUser.intervenant_id;

    // Compiler la grille de vérification
    const checks = Array.from(document.querySelectorAll('.avis-check'));
    if (checks.length) {
        data.details_verification = checks.map(c => (c.checked ? '✔ ' : '✗ ') + c.dataset.label).join(' ; ');
    }

    // Garde-fou : réserve/défavorable exige un commentaire
    if (data.type_avis !== 'Favorable' && !(data.contenu || '').trim()) {
        showToast('Commentaire requis', 'Précisez le motif de la réserve ou de l\'avis défavorable.', 'warning');
        return;
    }

    try {
        await window.api.avis.create(data);

        // Mettre à jour le statut de l'étape
        const statut = data.type_avis === 'Favorable' ? 'Favorable' : (data.type_avis === 'Défavorable' ? 'Défavorable' : 'Avec réserves');
        await window.api.workflow.updateStatut(data.etape_id, statut, data.contenu);

        // Si avis défavorable ou avec réserves → créer une réserve pour l'entreprise
        if (data.type_avis !== 'Favorable' && data.ouvrage_id) {
            await window.api.reserves.create({
                etape_id: data.etape_id,
                ouvrage_id: data.ouvrage_id,
                emetteur_id: currentUser.intervenant_id,
                description: data.contenu || 'Réserve émise lors de la réception',
                gravite: data.type_avis === 'Défavorable' ? 'Majeure' : 'Moyenne'
            });
        }

        // Faire avancer le moteur de workflow (débloque le bétonnage si tous favorables)
        let advanceMsg = '';
        if (data.ouvrage_id) {
            const res = await window.api.workflow.advance(parseInt(data.ouvrage_id));
            if (res.status === 'validated') advanceMsg = ' Toutes les réceptions favorables : bétonnage autorisé.';
            else if (res.status === 'blocked') advanceMsg = ' Ouvrage bloqué (réserves à lever).';
            else if (res.status === 'pending') advanceMsg = ` En attente de ${res.remaining} autre(s) réception(s).`;
        }

        closeModal();
        showToast('Avis soumis', 'Votre avis a été enregistré.' + advanceMsg, 'success');
        navigateTo(currentPage);
    } catch (err) {
        showToast('Erreur', err.message, 'danger');
    }
}

async function renderIntervenantHistory(container, pageId) {
    updatePageTitle('Historique');

    // Laboratoire : historique des essais
    if (pageId === 'resultats-labo') {
        const essais = await window.api.essais.getByLabo(currentUser.intervenant_id);
        container.innerHTML = `
            <div class="page-header animate-fade-in-up">
                <div><h2>Résultats d'essais</h2><p>${essais.length} essai(s) enregistré(s)</p></div>
            </div>
            <div class="table-wrapper animate-fade-in-up delay-1">
                <table class="data-table">
                    <thead><tr><th>Projet</th><th>Ouvrage</th><th>Type</th><th>Prélèvement</th><th>Résultat 7j</th><th>Résultat 28j</th><th>Cible</th><th>Conformité</th></tr></thead>
                    <tbody>
                        ${essais.map(e => `
                            <tr>
                                <td class="text-xs">${e.projet_nom}</td>
                                <td class="font-medium text-sm">${e.ouvrage_nom}</td>
                                <td>${e.type_essai}</td>
                                <td>${formatDate(e.date_prelevement)}</td>
                                <td>${e.resultat_7j !== null ? e.resultat_7j + ' ' + (e.unite || 'MPa') : '—'}</td>
                                <td>${e.resultat_28j !== null ? e.resultat_28j + ' ' + (e.unite || 'MPa') : '—'}</td>
                                <td class="text-muted">${e.valeur_cible ? e.valeur_cible + ' ' + (e.unite || 'MPa') : '—'}</td>
                                <td>${statusBadge(e.conformite || 'En attente')}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="8" class="text-center text-muted p-lg">Aucun essai</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        return;
    }

    // Architecte / BET / BCT : historique des avis émis
    const avis = await window.api.avis.getByIntervenant(currentUser.intervenant_id);
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Mes avis</h2><p>${avis.length} avis émis</p></div>
        </div>
        ${avis.length > 0 ? `
            <div class="table-wrapper animate-fade-in-up delay-1">
                <table class="data-table">
                    <thead><tr><th>Date</th><th>Projet</th><th>Ouvrage</th><th>Mission</th><th>Avis</th><th>Observations</th></tr></thead>
                    <tbody>
                        ${avis.map(a => `
                            <tr>
                                <td class="text-xs text-muted">${formatDateTime(a.date_avis)}</td>
                                <td class="text-xs">${a.projet_nom}</td>
                                <td><div class="font-medium text-sm">${a.ouvrage_nom}</div><div class="text-xs text-muted">${a.bloc || ''} ${a.niveau || ''}</div></td>
                                <td class="text-xs">${a.type_etape}</td>
                                <td>${statusBadge(a.type_avis)}</td>
                                <td class="text-xs text-secondary">${a.contenu || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<div class="empty-state animate-fade-in-up delay-1"><div class="empty-state-icon">📋</div><h4>Aucun avis émis</h4><p>Vos avis apparaîtront ici une fois soumis.</p></div>'}
    `;
}

// ============================================================
// LABO-SPECIFIC
// ============================================================
async function renderLaboEssais(container) {
    updatePageTitle('Essais en cours');
    const essais = await window.api.essais.getEnCours(currentUser.intervenant_id);
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Essais en cours</h2><p>${essais.length} essai(s) à traiter</p></div>
        </div>
        
        ${essais.length > 0 ? `
            <div class="animate-fade-in-up delay-1">
                ${essais.map(e => `
                    <div class="card mb-md">
                        <div class="d-flex justify-between align-center mb-md">
                            <div>
                                <h4 style="font-size: var(--text-md);">${e.type_essai}</h4>
                                <div class="text-xs text-muted">${e.projet_nom} — ${e.ouvrage_nom}</div>
                            </div>
                            ${statusBadge(e.conformite || 'En attente')}
                        </div>
                        <div class="d-flex gap-xl text-sm">
                            <div><span class="text-muted">Prélèvement:</span> ${formatDate(e.date_prelevement)}</div>
                            <div class="${isOverdue(e.date_echeance_7j) ? 'text-danger font-bold' : ''}"><span class="text-muted">Échéance 7j:</span> ${formatDate(e.date_echeance_7j)}</div>
                            <div class="${isOverdue(e.date_echeance_28j) ? 'text-danger font-bold' : ''}"><span class="text-muted">Échéance 28j:</span> ${formatDate(e.date_echeance_28j)}</div>
                        </div>
                        <div class="mt-md btn-group">
                            <button class="btn btn-primary btn-sm" onclick="showResultatEssaiModal(${e.id}, '${e.type_essai}')">
                                <i data-lucide="edit-3"></i> Saisir résultats
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : '<div class="empty-state animate-fade-in-up"><div class="empty-state-icon">✅</div><h4>Aucun essai en attente</h4></div>'}
    `;
}

function showResultatEssaiModal(essaiId, typeEssai) {
    const body = `
        <form id="form-resultat-essai">
            <div class="form-row">
                <div class="form-group"><label class="form-label">Résultat 7 jours (MPa)</label><input type="number" step="0.1" class="form-control" name="resultat_7j"></div>
                <div class="form-group"><label class="form-label">Résultat 28 jours (MPa)</label><input type="number" step="0.1" class="form-control" name="resultat_28j"></div>
            </div>
            <div class="form-group">
                <label class="form-label required">Conformité</label>
                <select class="form-control" name="conformite">
                    <option value="En attente">En attente</option>
                    <option value="Conforme">Conforme</option>
                    <option value="Non conforme">Non conforme</option>
                </select>
            </div>
            <div class="form-group"><label class="form-label">Observations</label><textarea class="form-control" name="observations" rows="3"></textarea></div>
        </form>
    `;
    openModal('Résultats — ' + typeEssai, body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitResultatEssai(${essaiId})">Enregistrer</button>
    `);
}

async function submitResultatEssai(essaiId) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-resultat-essai')));
    try {
        await window.api.essais.updateResultat(essaiId, data);
        closeModal();
        showToast('Succès', 'Résultats enregistrés.', 'success');
        navigateTo(currentPage);
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

// ============================================================
// ENTREPRISE-SPECIFIC
// ============================================================
async function renderEntrepriseDeclarations(container) {
    updatePageTitle('Déclarations');
    const pending = await window.api.workflow.getPending('Entreprise', currentUser.intervenant_id);
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Mes Déclarations</h2><p>Déclarez l'achèvement des ouvrages</p></div>
        </div>
        <div class="card animate-fade-in-up delay-1">
            <div class="card-header"><h4>Déclarations en attente</h4></div>
            <div class="card-body">
                ${pending.filter(e => e.type_etape === 'Déclaration achèvement').length > 0 ? 
                    pending.filter(e => e.type_etape === 'Déclaration achèvement').map(e => `
                        <div class="d-flex justify-between align-center p-md" style="border-bottom: 1px solid var(--border-color);">
                            <div>
                                <div class="font-medium">${e.ouvrage_nom}</div>
                                <div class="text-xs text-muted">${e.projet_nom} — ${e.code_lot}</div>
                            </div>
                            <button class="btn btn-success btn-sm" onclick="showDeclarationModal(${e.id}, ${e.ouvrage_id}, '${(e.ouvrage_nom || '').replace(/'/g, ' ')}')">
                                <i data-lucide="check"></i> Déclarer achèvement
                            </button>
                        </div>
                    `).join('') : '<div class="empty-state p-lg"><p class="text-muted">Aucune déclaration en attente</p></div>'}
            </div>
        </div>
    `;
}

function showDeclarationModal(etapeId, ouvrageId, ouvrageNom) {
    const body = `
        <form id="form-declaration">
            <p class="text-sm text-muted mb-lg">Déclarez l'achèvement de l'ouvrage <strong>${ouvrageNom || ''}</strong> (ex : coffrage et ferraillage terminés). Les intervenants concernés (Architecte, Topographe, BET, BCT) seront automatiquement saisis et notifiés.</p>
            <div class="form-group">
                <label class="form-label required">Nature des travaux réalisés</label>
                <textarea class="form-control" name="commentaire" rows="3" placeholder="Ex : Coffrage et ferraillage du plancher haut RDC terminés, prêt pour réception avant bétonnage.">Coffrage et ferraillage terminés</textarea>
            </div>
        </form>
    `;
    openModal("Déclaration d'achèvement", body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-success" onclick="submitDeclaration(${etapeId}, ${ouvrageId})"><i data-lucide="megaphone"></i> Déclarer & notifier</button>
    `);
}

async function submitDeclaration(etapeId, ouvrageId) {
    const form = document.getElementById('form-declaration');
    const commentaire = form ? (new FormData(form)).get('commentaire') : 'Coffrage et ferraillage terminés';
    try {
        const res = await window.api.workflow.declareAchievement(ouvrageId, commentaire);
        closeModal();
        showToast('Déclaration enregistrée', `${res.receptions || 0} intervenant(s) saisi(s) et notifié(s) pour réception.`, 'success');
        navigateTo(currentPage);
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function renderEntrepriseBetonnage(container) {
    updatePageTitle('Bétonnage');
    const pending = await window.api.workflow.getPending('Entreprise', currentUser.intervenant_id);
    const betonnages = pending.filter(e => e.type_etape === 'Déclaration bétonnage');
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Déclaration de Bétonnage</h2><p>Déclarez les dates de bétonnage après avis favorables</p></div>
        </div>
        ${betonnages.length > 0 ? betonnages.map(e => `
            <div class="card mb-md animate-fade-in-up delay-1">
                <div class="d-flex justify-between align-center mb-sm">
                    <h4 style="font-size: var(--text-md);">${e.ouvrage_nom}</h4>
                    <span class="badge badge-success">Bétonnage autorisé</span>
                </div>
                <p class="text-sm text-muted mb-md">${e.projet_nom} — ${e.code_lot} — ${e.bloc || ''} ${e.niveau || ''}</p>
                <button class="btn btn-primary btn-sm" onclick="showBetonnageModal(${e.ouvrage_id}, '${(e.ouvrage_nom || '').replace(/'/g, ' ')}')">
                    <i data-lucide="truck"></i> Déclarer le bétonnage
                </button>
            </div>
        `).join('') : '<div class="empty-state animate-fade-in-up"><div class="empty-state-icon">🏗️</div><h4>Aucun bétonnage en attente</h4><p>Les ouvrages apparaîtront ici une fois toutes les réceptions favorables.</p></div>'}
    `;
}

function showBetonnageModal(ouvrageId, ouvrageNom) {
    const today = new Date().toISOString().split('T')[0];
    const body = `
        <form id="form-betonnage">
            <p class="text-sm text-muted mb-lg">Déclarez le bétonnage de <strong>${ouvrageNom || ''}</strong>. Le laboratoire sera automatiquement saisi pour les essais de résistance à <strong>7 et 28 jours</strong>.</p>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label required">Date de bétonnage</label>
                    <input type="date" class="form-control" name="date_betonnage" value="${today}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Résistance cible (MPa)</label>
                    <input type="number" step="0.5" class="form-control" name="valeur_cible" value="25">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Référence prélèvement</label>
                    <input type="text" class="form-control" name="reference" placeholder="Ex : PV-BET-001">
                </div>
                <div class="form-group">
                    <label class="form-label">Norme de référence</label>
                    <input type="text" class="form-control" name="norme" value="NM 10.1.008">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Observations</label>
                <textarea class="form-control" name="commentaire" rows="2" placeholder="Volume, centrale, conditions..."></textarea>
            </div>
        </form>
    `;
    openModal('Déclaration de bétonnage', body, `
        <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitBetonnage(${ouvrageId})"><i data-lucide="truck"></i> Déclarer & saisir le labo</button>
    `);
}

async function submitBetonnage(ouvrageId) {
    const data = Object.fromEntries(new FormData(document.getElementById('form-betonnage')));
    if (!data.date_betonnage) { showToast('Erreur', 'Date de bétonnage requise.', 'danger'); return; }
    try {
        const res = await window.api.workflow.declareBetonnage(ouvrageId, data);
        closeModal();
        showToast('Bétonnage déclaré', res.essais ? 'Le laboratoire a été saisi pour les essais 7j / 28j.' : 'Bétonnage enregistré.', 'success');
        navigateTo(currentPage);
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function renderEntrepriseReserves(container) {
    updatePageTitle('Réserves à lever');
    const reserves = await window.api.reserves.getOuvertes();
    
    container.innerHTML = `
        <div class="page-header animate-fade-in-up">
            <div><h2>Réserves à Lever</h2><p>${reserves.length} réserve(s) ouverte(s)</p></div>
        </div>
        ${reserves.length > 0 ? `
            <div class="table-wrapper animate-fade-in-up delay-1">
                <table class="data-table">
                    <thead><tr><th>Ouvrage</th><th>Description</th><th>Gravité</th><th>Date</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${reserves.map(r => `
                            <tr>
                                <td>${r.ouvrage_nom}</td>
                                <td>${r.description}</td>
                                <td>${graviteBadge(r.gravite)}</td>
                                <td class="text-xs text-muted">${formatDate(r.date_emission)}</td>
                                <td><button class="btn btn-success btn-sm" onclick="leverReserve(${r.id})"><i data-lucide="check"></i> Lever</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<div class="empty-state animate-fade-in-up"><div class="empty-state-icon">✅</div><h4>Aucune réserve ouverte</h4></div>'}
    `;
}

async function leverReserve(id) {
    const commentaire = prompt('Commentaire sur la levée de réserve :');
    if (commentaire === null) return;
    try {
        await window.api.reserves.lever(id, commentaire || 'Réserve levée');
        showToast('Succès', 'Réserve levée avec succès.', 'success');
        navigateTo(currentPage);
    } catch (err) { showToast('Erreur', err.message, 'danger'); }
}

async function deleteReserve(id) {
    if (!confirm('Supprimer cette réserve ?')) return;
    const res = await window.api.reserves.delete(id);
    if (res.success) { showToast('Supprimée', 'Réserve supprimée.', 'success'); navigateTo(currentPage); }
    else showToast('Erreur', 'Suppression impossible.', 'danger');
}

async function deleteEssai(id) {
    if (!confirm('Supprimer cet essai ?')) return;
    const res = await window.api.essais.delete(id);
    if (res.success) { showToast('Supprimé', 'Essai supprimé.', 'success'); navigateTo(currentPage); }
    else showToast('Erreur', 'Suppression impossible.', 'danger');
}
