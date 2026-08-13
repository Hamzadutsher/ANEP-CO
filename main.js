const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const AppDatabase = require('./database/db');

// Codes météo WMO → libellé + intempérie (arrêt de chantier probable)
const WMO = {
    0: { label: 'Ciel dégagé', arret: false }, 1: { label: 'Peu nuageux', arret: false }, 2: { label: 'Partiellement nuageux', arret: false }, 3: { label: 'Couvert', arret: false },
    45: { label: 'Brouillard', arret: false }, 48: { label: 'Brouillard givrant', arret: false },
    51: { label: 'Bruine légère', arret: false }, 53: { label: 'Bruine', arret: false }, 55: { label: 'Bruine dense', arret: true },
    61: { label: 'Pluie légère', arret: false }, 63: { label: 'Pluie modérée', arret: true }, 65: { label: 'Pluie forte', arret: true },
    66: { label: 'Pluie verglaçante', arret: true }, 67: { label: 'Pluie verglaçante forte', arret: true },
    71: { label: 'Neige légère', arret: true }, 73: { label: 'Neige', arret: true }, 75: { label: 'Neige forte', arret: true }, 77: { label: 'Grains de neige', arret: true },
    80: { label: 'Averses légères', arret: false }, 81: { label: 'Averses', arret: true }, 82: { label: 'Averses violentes', arret: true },
    85: { label: 'Averses de neige', arret: true }, 86: { label: 'Averses de neige fortes', arret: true },
    95: { label: 'Orage', arret: true }, 96: { label: 'Orage avec grêle', arret: true }, 99: { label: 'Orage violent avec grêle', arret: true }
};

// Police Jost embarquée (base64) pour les documents générés — rendu Futura hors contexte app
let _embeddedFontCss = null;
function getEmbeddedFontCss() {
    if (_embeddedFontCss !== null) return _embeddedFontCss;
    try {
        const dir = path.join(__dirname, 'src', 'vendor', 'fonts');
        const b4 = fs.readFileSync(path.join(dir, 'cairo-400.woff2')).toString('base64');
        const b7 = fs.readFileSync(path.join(dir, 'cairo-700.woff2')).toString('base64');
        _embeddedFontCss = `@font-face{font-family:'Cairo';font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${b4}) format('woff2');}@font-face{font-family:'Cairo';font-weight:700;font-display:swap;src:url(data:font/woff2;base64,${b7}) format('woff2');}`;
    } catch (e) { _embeddedFontCss = ''; }
    return _embeddedFontCss;
}
function embedFont(html) {
    return typeof html === 'string' ? html.replace('<style>', '<style>' + getEmbeddedFontCss()) : html;
}

function httpGetJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'ANEP-MOD-App' } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

let mainWindow;
let db;
let dbPath;
let docsDir;

// Rendu logiciel : corrige le curseur invisible / la saisie impossible dans les champs
// sur certaines cartes/pilotes graphiques Windows (bug de composition GPU).
app.disableHardwareAcceleration();

// Une seule instance de l'application (évite les fenêtres fantômes qui volent le focus clavier)
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Sauvegarde automatique de la base au démarrage (conserve les 10 dernières)
function autoBackup(dbFile) {
    try {
        if (!dbFile || !fs.existsSync(dbFile)) return;
        const dir = path.join(app.getPath('userData'), 'backups');
        fs.mkdirSync(dir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        fs.copyFileSync(dbFile, path.join(dir, `auto_anep_mod_${stamp}.db`));
        const files = fs.readdirSync(dir).filter(f => f.startsWith('auto_') && f.endsWith('.db')).sort();
        while (files.length > 10) fs.unlinkSync(path.join(dir, files.shift()));
    } catch (e) { console.error('autoBackup error', e); }
}

// Convertit un tableau d'objets en CSV (séparateur ; + BOM pour Excel FR)
function toCsv(rows) {
    if (!rows || !rows.length) return '﻿';
    const cols = Object.keys(rows[0]);
    const esc = v => {
        if (v === null || v === undefined) return '';
        v = String(v);
        return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const lines = [cols.join(';')];
    for (const r of rows) lines.push(cols.map(c => esc(r[c])).join(';'));
    return '﻿' + lines.join('\r\n');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        title: 'ANEP MOD — Gestion de la Maîtrise d\'Ouvrage Déléguée',
        icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
        frame: true,
        backgroundColor: '#eef2f8',
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
        mainWindow.focus();
    });

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

function setupIPC() {
    // ---- Authentication ----
    ipcMain.handle('auth:login', (event, username, password) => {
        return db.authenticate(username, password);
    });

    // ---- Projets ----
    ipcMain.handle('projets:getAll', () => db.getAllProjets());
    ipcMain.handle('projets:get', (event, id) => db.getProjet(id));
    ipcMain.handle('projets:create', (event, data) => db.createProjet(data));
    ipcMain.handle('projets:update', (event, id, data) => db.updateProjet(id, data));
    ipcMain.handle('projets:getStats', (event, id) => db.getProjectStats(id));

    // ---- Lots ----
    ipcMain.handle('lots:getByProjet', (event, projetId) => db.getLotsByProjet(projetId));
    ipcMain.handle('lots:get', (event, id) => db.getLot(id));
    ipcMain.handle('lots:create', (event, data) => db.createLot(data));

    // ---- Intervenants ----
    ipcMain.handle('intervenants:getAll', (event, typeRole) => db.getAllIntervenants(typeRole));
    ipcMain.handle('intervenants:get', (event, id) => db.getIntervenant(id));
    ipcMain.handle('intervenants:create', (event, data) => db.createIntervenant(data));
    ipcMain.handle('intervenants:getByProjet', (event, projetId) => db.getIntervenantsByProjet(projetId));

    // ---- Sessions ----
    ipcMain.handle('sessions:getAll', () => db.getAllSessions());
    ipcMain.handle('sessions:getByProjet', (event, projetId) => db.getSessionsByProjet(projetId));
    ipcMain.handle('sessions:create', (event, data) => db.createSession(data));
    ipcMain.handle('sessions:toggle', (event, id, actif) => db.toggleSession(id, actif));
    ipcMain.handle('sessions:updatePassword', (event, id, newPassword) => db.updateSessionPassword(id, newPassword));

    // ---- Équipe MOD (comptes nominatifs) ----
    ipcMain.handle('modteam:getAll', () => db.getModUsers());
    ipcMain.handle('modteam:create', (event, data) => db.createModUser(data));
    ipcMain.handle('modteam:update', (event, id, data) => db.updateModUser(id, data));
    ipcMain.handle('modteam:updatePassword', (event, id, pwd) => db.updateModUserPassword(id, pwd));
    ipcMain.handle('modteam:toggle', (event, id, actif) => db.toggleModUser(id, actif));
    ipcMain.handle('modteam:delete', (event, id) => db.deleteModUser(id));

    // ---- Journal / Historique ----
    ipcMain.handle('events:get', (event, filters) => db.getEvenements(filters));
    ipcMain.handle('avis:getByIntervenant', (event, intervenantId) => db.getAvisByIntervenant(intervenantId));
    ipcMain.handle('essais:getByLabo', (event, laboId) => db.getEssaisByLabo(laboId));

    // ---- Ouvrages ----
    ipcMain.handle('ouvrages:getByLot', (event, lotId) => db.getOuvragesByLot(lotId));
    ipcMain.handle('ouvrages:getByProjet', (event, projetId) => db.getOuvragesByProjet(projetId));
    ipcMain.handle('ouvrages:get', (event, id) => db.getOuvrage(id));
    ipcMain.handle('ouvrages:create', (event, data) => db.createOuvrage(data));
    ipcMain.handle('ouvrages:updateStatut', (event, id, statut) => db.updateOuvrageStatut(id, statut));

    // ---- Workflow ----
    ipcMain.handle('workflow:getByOuvrage', (event, ouvrageId) => db.getWorkflowByOuvrage(ouvrageId));
    ipcMain.handle('workflow:createEtape', (event, data) => db.createWorkflowEtape(data));
    ipcMain.handle('workflow:updateStatut', (event, id, statut, commentaire) => db.updateEtapeStatut(id, statut, commentaire));
    ipcMain.handle('workflow:getPending', (event, role, intervenantId) => db.getEtapesPendingForRole(role, intervenantId));
    // Moteur de workflow automatisé
    ipcMain.handle('workflow:declareAchievement', (event, ouvrageId, commentaire) => db.declareAchievement(ouvrageId, commentaire));
    ipcMain.handle('workflow:advance', (event, ouvrageId) => db.advanceWorkflow(ouvrageId));
    ipcMain.handle('workflow:declareBetonnage', (event, ouvrageId, data) => db.declareBetonnage(ouvrageId, data));

    // ---- Avis ----
    ipcMain.handle('avis:getByEtape', (event, etapeId) => db.getAvisByEtape(etapeId));
    ipcMain.handle('avis:create', (event, data) => db.createAvis(data));

    // ---- Réserves ----
    ipcMain.handle('reserves:getByOuvrage', (event, ouvrageId) => db.getReservesByOuvrage(ouvrageId));
    ipcMain.handle('reserves:getOuvertes', (event, projetId) => db.getReservesOuvertes(projetId));
    ipcMain.handle('reserves:create', (event, data) => db.createReserve(data));
    ipcMain.handle('reserves:lever', (event, id, commentaire) => db.leverReserve(id, commentaire));

    // ---- Ordres de Service ----
    ipcMain.handle('os:getByLot', (event, lotId) => db.getOSByLot(lotId));
    ipcMain.handle('os:getByProjet', (event, projetId) => db.getOSByProjet(projetId));
    ipcMain.handle('os:getDependentLots', (event, lotId) => db.getDependentLots(lotId));
    ipcMain.handle('timeline:axis', (event, projetId) => db.getDelaiAxis(projetId));
    ipcMain.handle('avenants:getByProjet', (event, projetId) => db.getAvenantsByProjet(projetId));
    ipcMain.handle('avenants:create', (event, data) => db.createAvenant(data));
    ipcMain.handle('avenants:updateStatut', (event, id, statut) => db.updateAvenantStatut(id, statut));
    ipcMain.handle('avenants:delete', (event, id) => db.deleteAvenant(id));
    ipcMain.handle('gpa:getByProjet', (event, projetId) => db.getGpaByProjet(projetId));
    ipcMain.handle('gpa:create', (event, data) => db.createGpa(data));
    ipcMain.handle('gpa:close', (event, id) => db.closeGpa(id));
    ipcMain.handle('gpa:delete', (event, id) => db.deleteGpa(id));
    ipcMain.handle('gpa:addDesordre', (event, data) => db.addGpaDesordre(data));
    ipcMain.handle('gpa:getDesordres', (event, gpaId) => db.getGpaDesordres(gpaId));
    ipcMain.handle('gpa:resolveDesordre', (event, id) => db.resolveGpaDesordre(id));
    ipcMain.handle('gpa:deleteDesordre', (event, id) => db.deleteGpaDesordre(id));
    ipcMain.handle('budget:get', (event, projetId) => db.getProjetBudget(projetId));
    ipcMain.handle('planpins:getByPlan', (event, planDocId) => db.getPlanPins(planDocId));
    ipcMain.handle('planpins:create', (event, data) => db.createPlanPin(data));
    ipcMain.handle('planpins:update', (event, id, data) => db.updatePlanPin(id, data));
    ipcMain.handle('planpins:delete', (event, id) => db.deletePlanPin(id));
    ipcMain.handle('planpins:stats', (event, projetId) => db.getPlanPinStats(projetId));
    ipcMain.handle('signalements:getByProjet', (event, projetId) => db.getSignalementsByProjet(projetId));
    ipcMain.handle('signalements:create', (event, data) => db.createSignalement(data));
    ipcMain.handle('signalements:updateStatut', (event, id, statut) => db.updateSignalementStatut(id, statut));
    ipcMain.handle('signalements:delete', (event, id) => db.deleteSignalement(id));
    ipcMain.handle('signalements:stats', (event, projetId) => db.getSignalementStats(projetId));
    ipcMain.handle('constats:getByProjet', (event, projetId) => db.getConstatsByProjet(projetId));
    ipcMain.handle('constats:create', (event, data) => db.createConstat(data));
    ipcMain.handle('constats:delete', (event, id) => db.deleteConstat(id));
    ipcMain.handle('checklist:get', (event, typeReception) => db.getChecklistItems(typeReception));
    ipcMain.handle('checklist:add', (event, data) => db.addChecklistItem(data));
    ipcMain.handle('checklist:delete', (event, id) => db.deleteChecklistItem(id));
    ipcMain.handle('os:create', (event, data) => db.createOS(data));

    // ---- Essais Labo ----
    ipcMain.handle('essais:getByOuvrage', (event, ouvrageId) => db.getEssaisByOuvrage(ouvrageId));
    ipcMain.handle('essais:getEnCours', (event, laboId) => db.getEssaisEnCours(laboId));
    ipcMain.handle('essais:create', (event, data) => db.createEssai(data));
    ipcMain.handle('essais:updateResultat', (event, id, data) => db.updateEssaiResultat(id, data));

    // ---- Réunions ----
    ipcMain.handle('reunions:getByProjet', (event, projetId) => db.getReunionsByProjet(projetId));
    ipcMain.handle('reunions:get', (event, id) => db.getReunion(id));
    ipcMain.handle('reunions:create', (event, data) => db.createReunion(data));
    ipcMain.handle('invitations:create', (event, data) => db.createInvitation(data));
    ipcMain.handle('invitations:getByReunion', (event, reunionId) => db.getInvitationsByReunion(reunionId));

    // ---- Notifications ----
    ipcMain.handle('notifications:get', (event, role, intervenantId) => db.getNotifications(role, intervenantId));
    ipcMain.handle('notifications:markRead', (event, id) => db.markNotificationRead(id));
    ipcMain.handle('notifications:unreadCount', (event, role, intervenantId) => db.getUnreadCount(role, intervenantId));
    ipcMain.handle('notifications:create', (event, data) => db.createNotification(data));

    // ---- CRUD : édition & suppression (droits MOD) ----
    ipcMain.handle('projets:delete', (event, id) => db.deleteProjet(id));
    ipcMain.handle('lots:update', (event, id, data) => db.updateLot(id, data));
    ipcMain.handle('lots:delete', (event, id) => db.deleteLot(id));
    ipcMain.handle('ouvrages:update', (event, id, data) => db.updateOuvrage(id, data));
    ipcMain.handle('ouvrages:delete', (event, id) => db.deleteOuvrage(id));
    ipcMain.handle('intervenants:update', (event, id, data) => db.updateIntervenant(id, data));
    ipcMain.handle('intervenants:delete', (event, id) => db.deleteIntervenant(id));
    ipcMain.handle('sessions:delete', (event, id) => db.deleteSession(id));
    ipcMain.handle('os:update', (event, id, data) => db.updateOS(id, data));
    ipcMain.handle('os:delete', (event, id) => db.deleteOS(id));
    ipcMain.handle('reunions:update', (event, id, data) => db.updateReunion(id, data));
    ipcMain.handle('reunions:delete', (event, id) => db.deleteReunion(id));
    ipcMain.handle('reserves:delete', (event, id) => db.deleteReserve(id));
    ipcMain.handle('essais:delete', (event, id) => db.deleteEssai(id));

    // ---- Dashboard ----
    ipcMain.handle('dashboard:getStats', () => db.getDashboardStats());

    // ---- External ----
    ipcMain.handle('external:openEmail', (event, { to, subject, body }) => {
        const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        shell.openExternal(mailto);
    });

    ipcMain.handle('external:openWhatsApp', (event, { phone, message }) => {
        const cleanPhone = phone.replace(/[^0-9+]/g, '').replace('+', '');
        const wa = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        shell.openExternal(wa);
    });

    // ---- Génération de documents (lettres, rapports) ----
    // Écrit un document HTML autonome dans Documents/ANEP-MOD et l'ouvre
    // (l'utilisateur peut alors l'imprimer ou l'enregistrer en PDF via Ctrl+P)
    ipcMain.handle('docs:generate', (event, { html, filename, subdir }) => {
        try {
            const baseDir = path.join(app.getPath('documents'), 'ANEP-MOD', subdir || 'Documents');
            fs.mkdirSync(baseDir, { recursive: true });
            const safeName = (filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = path.join(baseDir, safeName.endsWith('.html') ? safeName : safeName + '.html');
            fs.writeFileSync(filePath, embedFont(html), 'utf-8');
            shell.openPath(filePath);
            return { success: true, path: filePath };
        } catch (e) {
            console.error('docs:generate error', e);
            return { success: false, error: e.message };
        }
    });

    // Impression directe en PDF via une fenêtre cachée
    ipcMain.handle('docs:printPdf', async (event, { html, filename, subdir }) => {
        try {
            const baseDir = path.join(app.getPath('documents'), 'ANEP-MOD', subdir || 'Documents');
            fs.mkdirSync(baseDir, { recursive: true });
            const safeName = (filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
            const pdfPath = path.join(baseDir, safeName.endsWith('.pdf') ? safeName : safeName + '.pdf');
            const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
            await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(embedFont(html)));
            const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
            fs.writeFileSync(pdfPath, pdf);
            win.close();
            shell.openPath(pdfPath);
            return { success: true, path: pdfPath };
        } catch (e) {
            console.error('docs:printPdf error', e);
            return { success: false, error: e.message };
        }
    });

    // ---- Sauvegarde / Restauration / Export ----

    // Sauvegarde manuelle : copie la base vers un emplacement choisi
    ipcMain.handle('backup:save', async () => {
        try {
            const stamp = new Date().toISOString().slice(0, 10);
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Sauvegarder la base de données',
                defaultPath: `anep_mod_sauvegarde_${stamp}.db`,
                filters: [{ name: 'Base ANEP MOD', extensions: ['db'] }]
            });
            if (canceled || !filePath) return { canceled: true };
            db.save();
            fs.copyFileSync(dbPath, filePath);
            return { success: true, path: filePath };
        } catch (e) { return { success: false, error: e.message }; }
    });

    // Restauration : remplace la base courante par une sauvegarde
    ipcMain.handle('backup:restore', async () => {
        try {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
                title: 'Restaurer une sauvegarde',
                properties: ['openFile'],
                filters: [{ name: 'Base ANEP MOD', extensions: ['db'] }]
            });
            if (canceled || !filePaths || !filePaths[0]) return { canceled: true };
            const src = filePaths[0];
            // Vérifier l'entête SQLite
            const fd = fs.openSync(src, 'r');
            const buf = Buffer.alloc(16);
            fs.readSync(fd, buf, 0, 16, 0);
            fs.closeSync(fd);
            if (buf.toString('utf8', 0, 15) !== 'SQLite format 3') {
                return { success: false, error: 'Fichier invalide : ce n\'est pas une base ANEP MOD.' };
            }
            autoBackup(dbPath); // sécuriser l'état courant avant écrasement
            db.close();
            fs.copyFileSync(src, dbPath);
            db = new AppDatabase(dbPath);
            await db.initialize();
            return { success: true, reload: true };
        } catch (e) { return { success: false, error: e.message }; }
    });

    // Export CSV (Excel) des principales tables
    ipcMain.handle('backup:exportCsv', async () => {
        try {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
                title: 'Choisir le dossier d\'export',
                properties: ['openDirectory', 'createDirectory']
            });
            if (canceled || !filePaths || !filePaths[0]) return { canceled: true };
            const dir = path.join(filePaths[0], 'export_anep_' + new Date().toISOString().slice(0, 10));
            fs.mkdirSync(dir, { recursive: true });
            const data = db.exportData();
            let count = 0;
            for (const [name, rows] of Object.entries(data)) {
                fs.writeFileSync(path.join(dir, name + '.csv'), toCsv(rows), 'utf8');
                count++;
            }
            shell.openPath(dir);
            return { success: true, path: dir, tables: count };
        } catch (e) { return { success: false, error: e.message }; }
    });

    // Liste des sauvegardes automatiques
    ipcMain.handle('backup:listAuto', () => {
        try {
            const dir = path.join(app.getPath('userData'), 'backups');
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir).filter(f => f.endsWith('.db')).sort().reverse().map(f => {
                const st = fs.statSync(path.join(dir, f));
                return { nom: f, taille: st.size, date: st.mtime.toISOString() };
            });
        } catch (e) { return []; }
    });

    // Ouvrir le dossier des sauvegardes automatiques
    ipcMain.handle('backup:openFolder', () => {
        const dir = path.join(app.getPath('userData'), 'backups');
        fs.mkdirSync(dir, { recursive: true });
        shell.openPath(dir);
        return { success: true, path: dir };
    });

    // ---- Documents (GED : plans, notes de calcul, fiches techniques…) ----
    ipcMain.handle('documents:upload', async (event, meta = {}) => {
        try {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
                title: 'Choisir un ou plusieurs documents',
                properties: ['openFile', 'multiSelections']
            });
            if (canceled || !filePaths || !filePaths.length) return { canceled: true };
            let count = 0;
            for (const src of filePaths) {
                const base = path.basename(src);
                const ext = path.extname(src).replace('.', '');
                const stored = `${Date.now()}_${Math.floor(Math.random() * 100000)}_${base.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                fs.copyFileSync(src, path.join(docsDir, stored));
                const size = fs.statSync(path.join(docsDir, stored)).size;
                db.createDocument({
                    nom: base, nom_fichier: stored, type_document: meta.type_document || 'Autre',
                    entite_type: meta.entite_type || 'projet', entite_id: meta.entite_id || null,
                    projet_id: meta.projet_id || null, taille: size, extension: ext,
                    description: meta.description || null, categorie: meta.categorie || null, uploaded_by: meta.uploaded_by || null
                });
                count++;
            }
            db.logEvent({ acteur_type: meta.uploaded_by_role || 'MOD', action: 'Document(s) ajouté(s)', cible_type: meta.entite_type, cible_id: meta.entite_id, projet_id: meta.projet_id, details: `${count} fichier(s) — ${meta.type_document || 'Autre'}` });
            return { success: true, count };
        } catch (e) { return { success: false, error: e.message }; }
    });

    ipcMain.handle('documents:getByEntity', (event, entiteType, entiteId) => db.getDocumentsByEntity(entiteType, entiteId));
    ipcMain.handle('documents:getAll', (event, filters) => db.getAllDocuments(filters));

    ipcMain.handle('documents:open', (event, id) => {
        const doc = db.getDocument(id);
        if (!doc) return { success: false, error: 'Document introuvable.' };
        const p = path.join(docsDir, doc.nom_fichier);
        if (!fs.existsSync(p)) return { success: false, error: 'Fichier absent du stockage.' };
        shell.openPath(p);
        return { success: true };
    });

    ipcMain.handle('documents:saveAs', async (event, id) => {
        const doc = db.getDocument(id);
        if (!doc) return { success: false };
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: 'Enregistrer le document', defaultPath: doc.nom });
        if (canceled || !filePath) return { canceled: true };
        fs.copyFileSync(path.join(docsDir, doc.nom_fichier), filePath);
        return { success: true, path: filePath };
    });

    ipcMain.handle('documents:delete', (event, id) => {
        const doc = db.deleteDocumentRecord(id);
        if (doc) { try { fs.unlinkSync(path.join(docsDir, doc.nom_fichier)); } catch (e) {} }
        return { success: true };
    });

    // ---- Avatars des intervenants ----
    const AV_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    ipcMain.handle('intervenants:setAvatar', (event, id, dataUrl) => {
        try {
            const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(dataUrl || '');
            if (!m) return { success: false, error: 'Image invalide.' };
            const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
            const dir = path.join(docsDir, 'avatars');
            fs.mkdirSync(dir, { recursive: true });
            const fn = `avatar_${id}.${ext}`;
            fs.writeFileSync(path.join(dir, fn), Buffer.from(m[2], 'base64'));
            db.setIntervenantAvatar(id, fn);
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    });
    ipcMain.handle('intervenants:getAvatar', (event, id) => {
        try {
            const it = db.getIntervenant(id);
            if (!it || !it.avatar) return null;
            const p = path.join(docsDir, 'avatars', it.avatar);
            if (!fs.existsSync(p)) return null;
            const ext = (it.avatar.split('.').pop() || 'png').toLowerCase();
            return `data:${AV_MIME[ext] || 'image/png'};base64,` + fs.readFileSync(p).toString('base64');
        } catch (e) { return null; }
    });

    // ---- Photothèque : galerie d'images avec vignettes (data URLs) ----
    const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };
    ipcMain.handle('photos:getGallery', (event, filters) => {
        const photos = db.getPhotos(filters || {});
        return photos.map(ph => {
            let dataUrl = null;
            try {
                const p = path.join(docsDir, ph.nom_fichier);
                if (fs.existsSync(p)) {
                    const ext = (ph.extension || '').toLowerCase();
                    const b64 = fs.readFileSync(p).toString('base64');
                    dataUrl = `data:${MIME[ext] || 'image/jpeg'};base64,${b64}`;
                }
            } catch (e) { /* image illisible */ }
            return { ...ph, dataUrl };
        });
    });

    // ---- Météo / Intempéries ----
    ipcMain.handle('meteo:getByProjet', (event, projetId) => db.getMeteoByProjet(projetId));
    ipcMain.handle('meteo:getStats', (event, projetId) => db.getMeteoStats(projetId));
    ipcMain.handle('meteo:create', (event, data) => db.createMeteo(data));
    ipcMain.handle('meteo:delete', (event, id) => db.deleteMeteo(id));

    // Capture automatique via Open-Meteo (service météo ouvert) pour une ville + date
    ipcMain.handle('meteo:fetch', async (event, { ville, date }) => {
        try {
            const geo = await httpGetJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville || 'Rabat')}&count=1&country=MA&language=fr`);
            if (!geo.results || !geo.results.length) return { success: false, error: `Ville « ${ville} » introuvable pour le géocodage.` };
            const { latitude, longitude, name } = geo.results[0];
            const d = date || new Date().toISOString().slice(0, 10);
            const w = await httpGetJson(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${d}&end_date=${d}`);
            const daily = w.daily;
            if (!daily || !daily.time || !daily.time.length) return { success: false, error: 'Données météo indisponibles pour cette date.' };
            const code = daily.weathercode[0];
            const info = WMO[code] || { label: 'Conditions indéterminées', arret: false };
            const precip = daily.precipitation_sum[0] || 0;
            const vent = daily.windspeed_10m_max[0] || 0;
            const arret = info.arret || precip >= 15 || vent >= 60;
            return { success: true, data: { ville: name, date: d, condition: info.label, temp_min: daily.temperature_2m_min[0], temp_max: daily.temperature_2m_max[0], precipitation_mm: precip, vent_kmh: vent, arret_travaux: arret ? 1 : 0, source: 'Open-Meteo (auto)' } };
        } catch (e) {
            return { success: false, error: 'Connexion internet requise pour la capture automatique. (' + e.message + ')' };
        }
    });

    // Ouvrir le site officiel marocmeteo.ma pour confirmation
    ipcMain.handle('meteo:openOfficial', () => { shell.openExternal('https://www.marocmeteo.ma/'); return { success: true }; });

    // ---- Permanence / présence chantier ----
    ipcMain.handle('permanence:getByProjet', (event, projetId) => db.getPermanencesByProjet(projetId));
    ipcMain.handle('permanence:getByIntervenant', (event, intervenantId, projetId) => db.getPermanencesByIntervenant(intervenantId, projetId));
    ipcMain.handle('permanence:getToday', (event, intervenantId, projetId, date) => db.getPermanenceToday(intervenantId, projetId, date));
    ipcMain.handle('permanence:getStats', (event, projetId) => db.getPermanenceStats(projetId));
    ipcMain.handle('permanence:create', (event, data) => db.createPermanence(data));
    ipcMain.handle('permanence:delete', (event, id) => db.deletePermanence(id));

    // ---- Comptes rendus / PV ----
    ipcMain.handle('cr:getByProjet', (event, projetId) => db.getCRByProjet(projetId));
    ipcMain.handle('cr:get', (event, id) => db.getCR(id));
    ipcMain.handle('cr:getActions', (event, crId) => db.getCRActions(crId));
    ipcMain.handle('cr:create', (event, data) => db.createCR(data));
    ipcMain.handle('cr:updateActionStatut', (event, id, statut) => db.updateCRActionStatut(id, statut));
    ipcMain.handle('cr:delete', (event, id) => db.deleteCR(id));

    // ---- Enregistrer un croquis / annotation (data URL image) comme document ----
    ipcMain.handle('documents:saveDataUrl', (event, { dataUrl, meta }) => {
        try {
            const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(dataUrl || '');
            if (!m) return { success: false, error: 'Format image invalide.' };
            const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
            const buf = Buffer.from(m[2], 'base64');
            const stored = `${Date.now()}_${Math.floor(Math.random() * 100000)}_croquis.${ext}`;
            fs.writeFileSync(path.join(docsDir, stored), buf);
            db.createDocument({
                nom: (meta && meta.nom) || ('Croquis.' + ext), nom_fichier: stored, type_document: 'Photo',
                entite_type: (meta && meta.entite_type) || 'projet', entite_id: (meta && meta.entite_id) || null,
                projet_id: (meta && meta.projet_id) || null, taille: buf.length, extension: ext,
                description: (meta && meta.description) || null, categorie: (meta && meta.categorie) || 'Annotation',
                uploaded_by: (meta && meta.uploaded_by) || null
            });
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    });

    // Upload de fichiers déjà lus (base64) — ex : pièce jointe choisie dans un formulaire
    ipcMain.handle('documents:uploadData', (event, payload) => {
        const { files, meta } = payload || {};
        let count = 0;
        (files || []).forEach(f => {
            const m = /^data:([^;]+);base64,(.+)$/.exec(f.dataUrl || '');
            if (!m) return;
            const base = (f.name || 'fichier').replace(/[^a-zA-Z0-9._-]/g, '_');
            const ext = (base.split('.').pop() || '').toLowerCase();
            const stored = `${Date.now()}_${Math.floor(Math.random() * 100000)}_${base}`;
            fs.writeFileSync(path.join(docsDir, stored), Buffer.from(m[2], 'base64'));
            const size = fs.statSync(path.join(docsDir, stored)).size;
            db.createDocument({
                nom: f.name || 'fichier', nom_fichier: stored, type_document: (meta && meta.type_document) || 'Autre',
                categorie: (meta && meta.categorie) || null, entite_type: (meta && meta.entite_type) || 'projet',
                entite_id: (meta && meta.entite_id) || null, projet_id: (meta && meta.projet_id) || null,
                taille: size, extension: ext, description: (meta && meta.description) || null, uploaded_by: (meta && meta.uploaded_by) || null
            });
            count++;
        });
        if (count && meta) db.logEvent({ acteur_type: meta.uploaded_by_role || 'MOD', action: 'Document(s) ajouté(s)', cible_type: meta.entite_type, cible_id: meta.entite_id, projet_id: meta.projet_id, details: `${count} fichier(s)` });
        return { success: true, count };
    });

    // ---- Paramètres / permissions ----
    ipcMain.handle('settings:get', () => db.getConfig());
    ipcMain.handle('settings:set', (event, obj) => db.setConfig(obj));

    // ---- HQSE ----
    ipcMain.handle('hqse:getByProjet', (event, projetId) => db.getHqseByProjet(projetId));
    ipcMain.handle('hqse:getStats', (event, projetId) => db.getHqseStats(projetId));
    ipcMain.handle('hqse:create', (event, data) => db.createHqse(data));
    ipcMain.handle('hqse:updateStatut', (event, id, statut) => db.updateHqseStatut(id, statut));
    ipcMain.handle('hqse:delete', (event, id) => db.deleteHqse(id));

    // ---- Attachements & Décomptes (circuit de paiement) ----
    ipcMain.handle('attachements:getByProjet', (event, projetId) => db.getAttachementsByProjet(projetId));
    ipcMain.handle('attachements:create', (event, data) => db.createAttachement(data));
    ipcMain.handle('attachements:updateStatut', (event, id, statut) => db.updateAttachementStatut(id, statut));
    ipcMain.handle('attachements:validate', (event, id, acteur) => db.validateAttachement(id, acteur));
    ipcMain.handle('attachements:requestRectification', (event, id, motif) => db.requestAttachementRectification(id, motif));
    ipcMain.handle('attachements:resubmit', (event, id) => db.resubmitAttachement(id));
    ipcMain.handle('attachements:delete', (event, id) => db.deleteAttachement(id));
    ipcMain.handle('decomptes:getByProjet', (event, projetId) => db.getDecomptesByProjet(projetId));
    ipcMain.handle('decomptes:get', (event, id) => db.getDecompte(id));
    ipcMain.handle('decomptes:getCircuit', (event, decompteId) => db.getDecompteCircuit(decompteId));
    ipcMain.handle('decomptes:create', (event, data) => db.createDecompte(data));
    ipcMain.handle('decomptes:actStep', (event, stepId, statut, commentaire, acteur) => db.actOnDecompteStep(stepId, statut, commentaire, acteur));
    ipcMain.handle('decomptes:updateMandat', (event, id, numMandat) => db.updateDecompteMandat(id, numMandat));
    ipcMain.handle('decomptes:updateTgr', (event, id, numTgr) => db.updateDecompteTgr(id, numTgr));
    ipcMain.handle('decomptes:getEvents', (event, decompteId) => db.getDecompteEvents(decompteId));
    ipcMain.handle('decomptes:delete', (event, id) => db.deleteDecompte(id));
    ipcMain.handle('decomptes:getStats', (event, projetId) => db.getPaiementStats(projetId));

    // ---- Interfaces / dépendances entre lots ----
    ipcMain.handle('interfaces:getByProjet', (event, projetId) => db.getInterfacesByProjet(projetId));
    ipcMain.handle('interfaces:getStats', (event, projetId) => db.getInterfaceStats(projetId));
    ipcMain.handle('interfaces:create', (event, data) => db.createInterface(data));
    ipcMain.handle('interfaces:updateStatut', (event, id, statut) => db.updateInterfaceStatut(id, statut));
    ipcMain.handle('interfaces:delete', (event, id) => db.deleteInterface(id));
}

app.whenReady().then(async () => {
    // Base de données dans un dossier inscriptible (compatible app installée)
    // En dev on garde la base locale du projet ; en production on utilise userData.
    dbPath = app.isPackaged
        ? path.join(app.getPath('userData'), 'anep_mod.db')
        : path.join(__dirname, 'data', 'anep_mod.db');
    db = new AppDatabase(dbPath);
    await db.initialize();
    autoBackup(dbPath);
    // Dossier de stockage des documents (plans, notes de calcul…)
    docsDir = app.isPackaged
        ? path.join(app.getPath('userData'), 'documents')
        : path.join(__dirname, 'data', 'documents');
    fs.mkdirSync(docsDir, { recursive: true });
    setupIPC();
    createWindow();
});

app.on('window-all-closed', () => {
    if (db) db.close();
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
