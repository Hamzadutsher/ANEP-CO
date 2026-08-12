/* ============================================
   ANEP MOD — Utilitaires
   Formatage, helpers, fonctions communes
   ============================================ */

// Format number with spaces (French style)
function formatNumber(num) {
    if (num === null || num === undefined) return '—';
    return new Intl.NumberFormat('fr-FR').format(num);
}

// Format currency (MAD)
function formatCurrency(amount) {
    if (!amount) return '0 DH';
    if (amount >= 1000000000) return (amount / 1000000000).toFixed(1) + ' Md DH';
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + ' M DH';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + ' K DH';
    return formatNumber(amount) + ' DH';
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateRelative(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return formatDate(dateStr);
}

// Status badge HTML
function statusBadge(statut) {
    const map = {
        'En cours': 'badge-info badge-dot',
        'En préparation': 'badge-muted badge-dot',
        'En attente': 'badge-muted badge-dot',
        'Terminé': 'badge-success badge-dot',
        'Réceptionné': 'badge-success badge-dot',
        'Clôturé': 'badge-muted',
        'Arrêté': 'badge-danger badge-dot',
        'Validé': 'badge-success badge-dot',
        'En validation': 'badge-warning badge-dot',
        'Non commencé': 'badge-muted',
        'Bétonnage planifié': 'badge-info badge-dot',
        'Bétonné': 'badge-primary badge-dot',
        'Essais en cours': 'badge-warning badge-dot',
        'Favorable': 'badge-success',
        'Favorable avec réserves': 'badge-warning',
        'Défavorable': 'badge-danger',
        'Ouverte': 'badge-danger badge-dot',
        'En cours de levée': 'badge-warning badge-dot',
        'Levée': 'badge-success badge-dot',
        'Conforme': 'badge-success',
        'Non conforme': 'badge-danger',
        'En attente': 'badge-muted badge-dot',
        'Planifiée': 'badge-info badge-dot',
        'Annulée': 'badge-muted'
    };
    const cls = map[statut] || 'badge-muted';
    return `<span class="badge ${cls}">${statut || '—'}</span>`;
}

// Role badge
function roleBadge(role) {
    const cls = `badge-role-${(role || '').toLowerCase().replace(/\s+/g, '')}`;
    return `<span class="badge ${cls}">${role}</span>`;
}

// Role icon
function roleIcon(role) {
    const icons = {
        'MOD': 'shield-check',
        'Architecte': 'landmark',
        'BET': 'ruler',
        'BCT': 'search-check',
        'Laboratoire': 'flask-conical',
        'Topographe': 'map-pin',
        'Entreprise': 'hard-hat'
    };
    return icons[role] || 'user';
}

// Role color
function roleColor(role) {
    const colors = {
        'MOD': 'var(--role-mod)',
        'Architecte': 'var(--role-architecte)',
        'BET': 'var(--role-bet)',
        'BCT': 'var(--role-bct)',
        'Laboratoire': 'var(--role-laboratoire)',
        'Topographe': 'var(--role-topographe)',
        'Entreprise': 'var(--role-entreprise)'
    };
    return colors[role] || 'var(--primary)';
}

// Gravité badge
function graviteBadge(gravite) {
    const map = {
        'Mineure': 'badge-info',
        'Moyenne': 'badge-warning',
        'Majeure': 'badge-danger',
        'Bloquante': 'badge-danger'
    };
    return `<span class="badge ${map[gravite] || 'badge-muted'}">${gravite}</span>`;
}

// Progress bar HTML
function progressBar(percent, showText = true) {
    const p = Math.min(100, Math.max(0, percent || 0));
    let color = 'linear-gradient(90deg, var(--primary), var(--secondary))';
    if (p >= 75) color = 'linear-gradient(90deg, var(--success), var(--success-light))';
    else if (p >= 50) color = 'linear-gradient(90deg, var(--primary), var(--accent-teal))';
    else if (p < 25) color = 'linear-gradient(90deg, var(--warning), var(--danger-light))';
    
    return `
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${p}%; background: ${color};"></div>
        </div>
        ${showText ? `<div class="progress-text">${p.toFixed(0)}% d'avancement</div>` : ''}
    `;
}

// Gauge chart HTML
function gaugeChart(percent, label = 'Avancement', size = 120) {
    const p = Math.min(100, Math.max(0, percent || 0));
    const r = (size / 2) - 12;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (p / 100) * circumference;
    
    return `
        <div class="gauge" style="width: ${size}px; height: ${size}px;">
            <svg viewBox="0 0 ${size} ${size}">
                <circle class="gauge-bg" cx="${size/2}" cy="${size/2}" r="${r}"></circle>
                <circle class="gauge-fill" cx="${size/2}" cy="${size/2}" r="${r}" 
                    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                    stroke="url(#gaugeGradient)"></circle>
            </svg>
            <div class="gauge-text">
                <div class="gauge-value">${p.toFixed(0)}%</div>
                <div class="gauge-label">${label}</div>
            </div>
        </div>
    `;
}

// Toast notification
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = {
        success: 'check-circle',
        warning: 'alert-triangle',
        danger: 'alert-circle',
        info: 'info'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} notification-enter`;
    toast.innerHTML = `
        <span class="toast-icon"><i data-lucide="${icons[type] || 'info'}"></i></span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
    `;
    
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: toast });
    
    setTimeout(() => {
        toast.classList.remove('notification-enter');
        toast.classList.add('notification-exit');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Modal management
function openModal(title, bodyHtml, footerHtml = '', size = '') {
    const backdrop = document.getElementById('modal-backdrop');
    const container = document.getElementById('modal-container');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    
    container.className = 'modal' + (size ? ` modal-${size}` : '');
    backdrop.classList.add('active');
    
    if (typeof lucide !== 'undefined') lucide.createIcons({ node: container });
}

function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('modal-backdrop').classList.remove('active');
}

// Avatar initials
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

// Debounce
function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Days between dates
function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}

// Check if date is past
function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Construit un document HTML autonome, imprimable (lettres, rapports, plannings)
function buildDocHtml(title, bodyHtml) {
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>${title}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; color: #1a2332; margin: 0; padding: 40px 48px; font-size: 13px; line-height: 1.55; }
    .doc-header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #1a3a6b; padding-bottom: 16px; margin-bottom: 28px; }
    .doc-header .logo { font-size: 42px; }
    .doc-header .org h2 { margin: 0; color: #1a3a6b; font-size: 20px; letter-spacing: .5px; }
    .doc-header .org p { margin: 2px 0 0; color: #5a7393; font-size: 12px; }
    .doc-header .ref { margin-left: auto; text-align: right; color: #5a7393; font-size: 11px; }
    h1 { color: #1a3a6b; font-size: 19px; margin: 0 0 6px; }
    .meta { color: #5a7393; font-size: 12px; margin: 0 0 20px; }
    .doc-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    .doc-table th { background: #1a3a6b; color: #fff; text-align: left; padding: 8px 10px; }
    .doc-table td { border: 1px solid #d0d8e4; padding: 7px 10px; }
    .doc-table tbody tr:nth-child(even) { background: #f4f7fb; }
    .letter-body { margin: 24px 0; }
    .letter-body p { margin: 10px 0; }
    .signature { margin-top: 48px; text-align: right; }
    .signature .role { font-weight: 600; color: #1a3a6b; }
    .odj { background: #f4f7fb; border-left: 4px solid #d4a843; padding: 12px 18px; margin: 16px 0; }
    .odj h3 { margin: 0 0 8px; color: #1a3a6b; font-size: 14px; }
    .doc-footer { margin-top: 40px; border-top: 1px solid #d0d8e4; padding-top: 12px; color: #8a9bb3; font-size: 10px; text-align: center; }
    .toolbar { text-align: center; margin-bottom: 24px; }
    .toolbar button { background: #1a3a6b; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; cursor: pointer; }
    @media print { .toolbar { display: none; } body { padding: 0; } }
</style></head>
<body>
    <div class="toolbar"><button onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button></div>
    <div class="doc-header">
        <div class="logo">🏛️</div>
        <div class="org"><h2>ANEP</h2><p>Agence Nationale des Équipements Publics — Maîtrise d'Ouvrage Déléguée</p></div>
        <div class="ref">Réf : ANEP/MOD<br>${new Date().toLocaleDateString('fr-FR')}</div>
    </div>
    ${bodyHtml}
    <div class="doc-footer">Document généré par l'application ANEP MOD — Gestion de la Maîtrise d'Ouvrage Déléguée</div>
</body></html>`;
}
