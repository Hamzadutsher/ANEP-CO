/* ============================================================
   ANEP MOD — Serveur Web (Express)
   Réutilise database/db.js ; expose une API HTTP (pont RPC)
   pour que l'application soit exploitable depuis un navigateur.
   ============================================================ */
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const AppDatabase = require('./database/db');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'anep_mod.db');
const DOCS_DIR = path.join(DATA_DIR, 'documents');
const AVATARS_DIR = path.join(DOCS_DIR, 'avatars');
const GEN_DIR = path.join(DATA_DIR, 'generated');
[DATA_DIR, DOCS_DIR, AVATARS_DIR, GEN_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

const crypto = require('crypto');
const db = new AppDatabase(DB_PATH);

// ---- Authentification par jeton (sécurise l'API en mode web) ----
const SESSIONS = new Map(); // token -> { user, expires }
const TOKEN_TTL = 12 * 60 * 60 * 1000; // 12 h
function newToken(user) {
    const t = crypto.randomBytes(24).toString('hex');
    SESSIONS.set(t, { user, expires: Date.now() + TOKEN_TTL });
    return t;
}
function validToken(t) {
    const s = t && SESSIONS.get(t);
    if (!s) return null;
    if (Date.now() > s.expires) { SESSIONS.delete(t); return null; }
    s.expires = Date.now() + TOKEN_TTL; // prolongation glissante
    return s.user;
}
setInterval(() => { const now = Date.now(); for (const [t, s] of SESSIONS) if (now > s.expires) SESSIONS.delete(t); }, 60 * 60 * 1000);

// ---- Météo (Open-Meteo) ----
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
function httpGetJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'ANEP-MOD-Web' } }, res => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

// ---- Police embarquée (Cairo) pour les documents générés ----
let _fontCss = null;
function embedFont(html) {
    if (_fontCss === null) {
        try {
            const dir = path.join(__dirname, 'src', 'vendor', 'fonts');
            const b4 = fs.readFileSync(path.join(dir, 'cairo-400.woff2')).toString('base64');
            const b7 = fs.readFileSync(path.join(dir, 'cairo-700.woff2')).toString('base64');
            _fontCss = `@font-face{font-family:'Cairo';font-weight:400;src:url(data:font/woff2;base64,${b4}) format('woff2');}@font-face{font-family:'Cairo';font-weight:700;src:url(data:font/woff2;base64,${b7}) format('woff2');}`;
        } catch (e) { _fontCss = ''; }
    }
    return typeof html === 'string' ? html.replace('<style>', '<style>' + _fontCss) : html;
}

function toCsv(rows) {
    if (!rows || !rows.length) return '﻿';
    const cols = Object.keys(rows[0]);
    const esc = v => { if (v === null || v === undefined) return ''; v = String(v); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '﻿' + [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\r\n');
}
const IMG_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };
function storeDataUrl(dataUrl, dir, filename) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
    if (!m) return null;
    fs.writeFileSync(path.join(dir, filename), Buffer.from(m[2], 'base64'));
    return fs.statSync(path.join(dir, filename)).size;
}

// Envoi e-mail automatique (silencieux) sur événement — seulement si SMTP configuré
async function autoEmail(to, subject, text) {
    if (!to) return;
    try {
        const cfg = db.getConfig() || {}; const smtp = cfg.email || {};
        if (!smtp.host || !smtp.user) return;
        const nodemailer = require('nodemailer');
        const transport = nodemailer.createTransport({ host: smtp.host, port: parseInt(smtp.port) || 587, secure: !!smtp.secure, auth: { user: smtp.user, pass: smtp.pass } });
        await transport.sendMail({ from: smtp.from || smtp.user, to, subject, text });
    } catch (e) { /* silencieux : la notification in-app reste */ }
}

// ============================================================
// Pont RPC : channel -> handler (réutilise db.js)
// ============================================================
const H = {
    'auth:login': a => db.authenticate(a[0], a[1]),
    'projets:getAll': () => db.getAllProjets(),
    'projets:get': a => db.getProjet(a[0]),
    'projets:create': a => db.createProjet(a[0]),
    'projets:update': a => db.updateProjet(a[0], a[1]),
    'projets:delete': a => db.deleteProjet(a[0]),
    'projets:getStats': a => db.getProjectStats(a[0]),
    'lots:getByProjet': a => db.getLotsByProjet(a[0]),
    'lots:get': a => db.getLot(a[0]),
    'lots:create': a => db.createLot(a[0]),
    'lots:update': a => db.updateLot(a[0], a[1]),
    'lots:delete': a => db.deleteLot(a[0]),
    'intervenants:getAll': a => db.getAllIntervenants(a[0]),
    'intervenants:get': a => db.getIntervenant(a[0]),
    'intervenants:create': a => db.createIntervenant(a[0]),
    'intervenants:update': a => db.updateIntervenant(a[0], a[1]),
    'intervenants:delete': a => db.deleteIntervenant(a[0]),
    'intervenants:getByProjet': a => db.getIntervenantsByProjet(a[0]),
    'intervenants:setAvatar': a => { const size = storeDataUrl(a[1], AVATARS_DIR, `avatar_${a[0]}.png`); if (size === null) return { success: false }; db.setIntervenantAvatar(a[0], `avatar_${a[0]}.png`); return { success: true }; },
    'intervenants:getAvatar': a => { const it = db.getIntervenant(a[0]); if (!it || !it.avatar) return null; const p = path.join(AVATARS_DIR, it.avatar); if (!fs.existsSync(p)) return null; const ext = (it.avatar.split('.').pop() || 'png').toLowerCase(); return `data:${IMG_MIME[ext] || 'image/png'};base64,` + fs.readFileSync(p).toString('base64'); },
    'sessions:getAll': () => db.getAllSessions(),
    'sessions:getByProjet': a => db.getSessionsByProjet(a[0]),
    'sessions:create': a => db.createSession(a[0]),
    'sessions:toggle': a => db.toggleSession(a[0], a[1]),
    'sessions:updatePassword': a => db.updateSessionPassword(a[0], a[1]),
    'sessions:delete': a => db.deleteSession(a[0]),
    'modteam:getAll': () => db.getModUsers(),
    'modteam:create': a => db.createModUser(a[0]),
    'modteam:update': a => db.updateModUser(a[0], a[1]),
    'modteam:updatePassword': a => db.updateModUserPassword(a[0], a[1]),
    'modteam:toggle': a => db.toggleModUser(a[0], a[1]),
    'modteam:delete': a => db.deleteModUser(a[0]),
    'ouvrages:getByLot': a => db.getOuvragesByLot(a[0]),
    'ouvrages:getByProjet': a => db.getOuvragesByProjet(a[0]),
    'ouvrages:get': a => db.getOuvrage(a[0]),
    'ouvrages:create': a => db.createOuvrage(a[0]),
    'ouvrages:updateStatut': a => db.updateOuvrageStatut(a[0], a[1]),
    'ouvrages:update': a => db.updateOuvrage(a[0], a[1]),
    'ouvrages:delete': a => db.deleteOuvrage(a[0]),
    'workflow:getByOuvrage': a => db.getWorkflowByOuvrage(a[0]),
    'workflow:createEtape': a => db.createWorkflowEtape(a[0]),
    'workflow:updateStatut': a => db.updateEtapeStatut(a[0], a[1], a[2]),
    'workflow:getPending': a => db.getEtapesPendingForRole(a[0], a[1]),
    'workflow:declareAchievement': a => db.declareAchievement(a[0], a[1]),
    'workflow:advance': a => db.advanceWorkflow(a[0]),
    'workflow:declareBetonnage': a => db.declareBetonnage(a[0], a[1]),
    'avis:getByEtape': a => db.getAvisByEtape(a[0]),
    'avis:create': a => db.createAvis(a[0]),
    'avis:getByIntervenant': a => db.getAvisByIntervenant(a[0]),
    'reserves:getByOuvrage': a => db.getReservesByOuvrage(a[0]),
    'reserves:getOuvertes': a => db.getReservesOuvertes(a[0]),
    'reserves:create': async a => { const res = db.createReserve(a[0]); const em = a[0] && a[0].projet_id ? db.getRoleEmail(a[0].projet_id, 'Entreprise') : null; autoEmail(em, 'ANEP MOD — Réserve émise', `Une réserve a été émise${a[0] && a[0].description ? ' : ' + a[0].description : ''}. Merci de la traiter dans les meilleurs délais.`); return res; },
    'reserves:lever': a => db.leverReserve(a[0], a[1]),
    'reserves:delete': a => db.deleteReserve(a[0]),
    'os:getByLot': a => db.getOSByLot(a[0]),
    'os:getByProjet': a => db.getOSByProjet(a[0]),
    'os:getDependentLots': a => db.getDependentLots(a[0]),
    'timeline:axis': a => db.getDelaiAxis(a[0]),
    'avenants:getByProjet': a => db.getAvenantsByProjet(a[0]),
    'avenants:create': a => db.createAvenant(a[0]),
    'avenants:updateStatut': a => db.updateAvenantStatut(a[0], a[1]),
    'avenants:delete': a => db.deleteAvenant(a[0]),
    'gpa:getByProjet': a => db.getGpaByProjet(a[0]),
    'gpa:create': a => db.createGpa(a[0]),
    'gpa:close': a => db.closeGpa(a[0]),
    'gpa:delete': a => db.deleteGpa(a[0]),
    'gpa:addDesordre': a => db.addGpaDesordre(a[0]),
    'gpa:getDesordres': a => db.getGpaDesordres(a[0]),
    'gpa:resolveDesordre': a => db.resolveGpaDesordre(a[0]),
    'gpa:deleteDesordre': a => db.deleteGpaDesordre(a[0]),
    'budget:get': a => db.getProjetBudget(a[0]),
    'planpins:getByPlan': a => db.getPlanPins(a[0]),
    'planpins:create': a => db.createPlanPin(a[0]),
    'planpins:update': a => db.updatePlanPin(a[0], a[1]),
    'planpins:delete': a => db.deletePlanPin(a[0]),
    'planpins:stats': a => db.getPlanPinStats(a[0]),
    'signalements:getByProjet': a => db.getSignalementsByProjet(a[0]),
    'signalements:create': a => db.createSignalement(a[0]),
    'signalements:updateStatut': a => db.updateSignalementStatut(a[0], a[1]),
    'signalements:delete': a => db.deleteSignalement(a[0]),
    'signalements:stats': a => db.getSignalementStats(a[0]),
    'constats:getByProjet': a => db.getConstatsByProjet(a[0]),
    'constats:create': a => db.createConstat(a[0]),
    'constats:delete': a => db.deleteConstat(a[0]),
    'checklist:get': a => db.getChecklistItems(a[0]),
    'checklist:add': a => db.addChecklistItem(a[0]),
    'checklist:delete': a => db.deleteChecklistItem(a[0]),
    'revision:getFormules': a => db.getRevisionFormules(a[0]),
    'revision:createFormule': a => db.createRevisionFormule(a[0]),
    'revision:deleteFormule': a => db.deleteRevisionFormule(a[0]),
    'revision:calculer': a => db.createRevisionCalcul(a[0]),
    'revision:getCalculs': a => db.getRevisionCalculs(a[0]),
    'revision:deleteCalcul': a => db.deleteRevisionCalcul(a[0]),
    'revision:setIndex': a => db.setRevisionIndex(a[0]),
    'revision:getIndex': a => db.getRevisionIndex(a[0]),
    'revision:deleteIndex': a => db.deleteRevisionIndex(a[0]),
    'penalites:compute': a => db.computePenalite(a[0]),
    'penalites:getByProjet': a => db.getPenalites(a[0]),
    'penalites:delete': a => db.deletePenalite(a[0]),
    'os:create': a => db.createOS(a[0]),
    'os:update': a => db.updateOS(a[0], a[1]),
    'os:delete': a => db.deleteOS(a[0]),
    'essais:getByOuvrage': a => db.getEssaisByOuvrage(a[0]),
    'essais:getEnCours': a => db.getEssaisEnCours(a[0]),
    'essais:create': a => db.createEssai(a[0]),
    'essais:updateResultat': a => db.updateEssaiResultat(a[0], a[1]),
    'essais:getByLabo': a => db.getEssaisByLabo(a[0]),
    'essais:delete': a => db.deleteEssai(a[0]),
    'reunions:getByProjet': a => db.getReunionsByProjet(a[0]),
    'reunions:get': a => db.getReunion(a[0]),
    'reunions:create': a => db.createReunion(a[0]),
    'reunions:update': a => db.updateReunion(a[0], a[1]),
    'reunions:delete': a => db.deleteReunion(a[0]),
    'invitations:create': async a => { const res = db.createInvitation(a[0]); if (a[0] && a[0].email) autoEmail(a[0].email, 'ANEP MOD — Convocation à une réunion', `Bonjour${a[0].nom ? ' ' + a[0].nom : ''},\n\nVous êtes convoqué(e) à une réunion de chantier. La lettre de convocation officielle et les détails sont disponibles dans l'application ANEP MOD.`); return res; },
    'invitations:getByReunion': a => db.getInvitationsByReunion(a[0]),
    'notifications:get': a => db.getNotifications(a[0], a[1]),
    'notifications:markRead': a => db.markNotificationRead(a[0]),
    'notifications:unreadCount': a => db.getUnreadCount(a[0], a[1]),
    'notifications:create': a => db.createNotification(a[0]),
    'dashboard:getStats': () => db.getDashboardStats(),
    'search:global': a => db.search(a[0]),
    'echeances:get': a => db.getEcheances(a[0]),
    'auth:setOwnPassword': a => db.setOwnPassword(a[0], a[1]),
    'email:send': async a => {
        const { to, subject, text, html } = a[0] || {};
        try {
            const cfg = db.getConfig() || {};
            const smtp = cfg.email || {};
            if (!smtp.host || !smtp.user) return { success: false, fallback: true, error: 'SMTP non configuré.' };
            const nodemailer = require('nodemailer');
            const transport = nodemailer.createTransport({ host: smtp.host, port: parseInt(smtp.port) || 587, secure: !!smtp.secure, auth: { user: smtp.user, pass: smtp.pass } });
            await transport.sendMail({ from: smtp.from || smtp.user, to, subject: subject || '(sans objet)', text: text || '', html: html || undefined });
            db.logEvent({ acteur_type: 'MOD', action: 'E-mail envoyé', details: `${subject || ''} → ${to}` });
            return { success: true };
        } catch (e) { return { success: false, fallback: true, error: e.message }; }
    },
    'events:get': a => db.getEvenements(a[0]),
    'interfaces:getByProjet': a => db.getInterfacesByProjet(a[0]),
    'interfaces:getStats': a => db.getInterfaceStats(a[0]),
    'interfaces:create': a => db.createInterface(a[0]),
    'interfaces:updateStatut': a => db.updateInterfaceStatut(a[0], a[1]),
    'interfaces:delete': a => db.deleteInterface(a[0]),
    'meteo:getByProjet': a => db.getMeteoByProjet(a[0]),
    'meteo:getStats': a => db.getMeteoStats(a[0]),
    'meteo:create': a => db.createMeteo(a[0]),
    'meteo:delete': a => db.deleteMeteo(a[0]),
    'meteo:fetch': async a => {
        const { ville, date } = a[0] || {};
        try {
            const geo = await httpGetJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville || 'Rabat')}&count=1&country=MA&language=fr`);
            if (!geo.results || !geo.results.length) return { success: false, error: `Ville « ${ville} » introuvable.` };
            const { latitude, longitude, name } = geo.results[0];
            const d = date || new Date().toISOString().slice(0, 10);
            const w = await httpGetJson(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${d}&end_date=${d}`);
            const dl = w.daily; if (!dl || !dl.time || !dl.time.length) return { success: false, error: 'Données indisponibles.' };
            const info = WMO[dl.weathercode[0]] || { label: 'Indéterminé', arret: false };
            const precip = dl.precipitation_sum[0] || 0, vent = dl.windspeed_10m_max[0] || 0;
            return { success: true, data: { ville: name, date: d, condition: info.label, temp_min: dl.temperature_2m_min[0], temp_max: dl.temperature_2m_max[0], precipitation_mm: precip, vent_kmh: vent, arret_travaux: (info.arret || precip >= 15 || vent >= 60) ? 1 : 0, source: 'Open-Meteo (auto)' } };
        } catch (e) { return { success: false, error: 'Connexion internet requise. (' + e.message + ')' }; }
    },
    'meteo:getArretPeriodes': a => db.getMeteoArretPeriodes(a[0]),
    'meteo:fetchRange': async a => {
        const { ville, start_date, end_date, seuil_precip, seuil_vent } = a[0] || {};
        try {
            const geo = await httpGetJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville || 'Rabat')}&count=1&country=MA&language=fr`);
            if (!geo.results || !geo.results.length) return { success: false, error: `Ville « ${ville} » introuvable.` };
            const { latitude, longitude, name } = geo.results[0];
            const sp = seuil_precip != null ? seuil_precip : 15, sv = seuil_vent != null ? seuil_vent : 60;
            const w = await httpGetJson(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&start_date=${start_date}&end_date=${end_date}`);
            const dl = w.daily; if (!dl || !dl.time || !dl.time.length) return { success: false, error: 'Données indisponibles pour cette période.' };
            const days = dl.time.map((t, i) => { const info = WMO[dl.weathercode[i]] || { label: 'Indéterminé', arret: false }; const precip = dl.precipitation_sum[i] || 0, vent = dl.windspeed_10m_max[i] || 0; return { date: t, condition: info.label, temp_min: dl.temperature_2m_min[i], temp_max: dl.temperature_2m_max[i], precipitation_mm: precip, vent_kmh: vent, arret_travaux: (info.arret || precip >= sp || vent >= sv) ? 1 : 0 }; });
            return { success: true, ville: name, days };
        } catch (e) { return { success: false, error: 'Connexion internet requise. (' + e.message + ')' }; }
    },
    'meteo:forecast': async a => {
        const { ville } = a[0] || {};
        try {
            const geo = await httpGetJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville || 'Rabat')}&count=1&country=MA&language=fr`);
            if (!geo.results || !geo.results.length) return { success: false, error: 'Ville introuvable.' };
            const { latitude, longitude, name } = geo.results[0];
            const w = await httpGetJson(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&forecast_days=7`);
            const dl = w.daily; if (!dl || !dl.time) return { success: false, error: 'Prévisions indisponibles.' };
            const days = dl.time.map((t, i) => { const info = WMO[dl.weathercode[i]] || { label: 'Indéterminé', arret: false }; const precip = dl.precipitation_sum[i] || 0, vent = dl.windspeed_10m_max[i] || 0; return { date: t, condition: info.label, temp_min: dl.temperature_2m_min[i], temp_max: dl.temperature_2m_max[i], precipitation_mm: precip, vent_kmh: vent, arret_travaux: (info.arret || precip >= 15 || vent >= 60) ? 1 : 0 }; });
            return { success: true, ville: name, days };
        } catch (e) { return { success: false, error: 'Connexion internet requise. (' + e.message + ')' }; }
    },
    'hqse:getByProjet': a => db.getHqseByProjet(a[0]),
    'hqse:getStats': a => db.getHqseStats(a[0]),
    'hqse:create': a => db.createHqse(a[0]),
    'hqse:updateStatut': a => db.updateHqseStatut(a[0], a[1]),
    'hqse:delete': a => db.deleteHqse(a[0]),
    'attachements:getByProjet': a => db.getAttachementsByProjet(a[0]),
    'attachements:create': a => db.createAttachement(a[0]),
    'attachements:updateStatut': a => db.updateAttachementStatut(a[0], a[1]),
    'attachements:validate': a => db.validateAttachement(a[0], a[1]),
    'attachements:requestRectification': a => db.requestAttachementRectification(a[0], a[1]),
    'attachements:resubmit': a => db.resubmitAttachement(a[0]),
    'attachements:delete': a => db.deleteAttachement(a[0]),
    'decomptes:getByProjet': a => db.getDecomptesByProjet(a[0]),
    'decomptes:get': a => db.getDecompte(a[0]),
    'decomptes:getCircuit': a => db.getDecompteCircuit(a[0]),
    'decomptes:create': async a => { const res = db.createDecompte(a[0]); autoEmail(db.getRoleEmail(a[0].projet_id, 'BET'), 'ANEP MOD — Nouveau décompte à viser', `Un nouveau décompte « ${a[0].numero || ''} » attend votre validation technique (BET).`); return res; },
    'decomptes:actStep': async a => {
        const res = db.actOnDecompteStep(a[0], a[1], a[2], a[3]);
        try {
            if (a[1] === 'Validé') {
                const step = db.get('SELECT decompte_id FROM decompte_circuit WHERE id = ?', [a[0]]);
                if (step) {
                    const d = db.getDecompte(step.decompte_id);
                    const next = db.get("SELECT responsable_type FROM decompte_circuit WHERE decompte_id = ? AND statut = 'En attente' ORDER BY ordre LIMIT 1", [step.decompte_id]);
                    if (d && next && next.responsable_type && !['MOD', 'TGR'].includes(next.responsable_type)) {
                        autoEmail(db.getRoleEmail(d.projet_id, next.responsable_type), 'ANEP MOD — Décompte à traiter', `Le décompte « ${d.numero} » attend votre intervention (${next.responsable_type}).`);
                    }
                }
            }
        } catch (e) {}
        return res;
    },
    'decomptes:updateMandat': a => db.updateDecompteMandat(a[0], a[1]),
    'decomptes:updateTgr': a => db.updateDecompteTgr(a[0], a[1]),
    'decomptes:getEvents': a => db.getDecompteEvents(a[0]),
    'decomptes:delete': a => db.deleteDecompte(a[0]),
    'decomptes:getStats': a => db.getPaiementStats(a[0]),
    'cr:getByProjet': a => db.getCRByProjet(a[0]),
    'cr:get': a => db.getCR(a[0]),
    'cr:getActions': a => db.getCRActions(a[0]),
    'cr:create': a => db.createCR(a[0]),
    'cr:updateActionStatut': a => db.updateCRActionStatut(a[0], a[1]),
    'cr:delete': a => db.deleteCR(a[0]),
    'permanence:getByProjet': a => db.getPermanencesByProjet(a[0]),
    'permanence:getByIntervenant': a => db.getPermanencesByIntervenant(a[0], a[1]),
    'permanence:getToday': a => db.getPermanenceToday(a[0], a[1], a[2]),
    'permanence:getStats': a => db.getPermanenceStats(a[0]),
    'permanence:create': a => db.createPermanence(a[0]),
    'permanence:delete': a => db.deletePermanence(a[0]),
    'settings:get': () => db.getConfig(),
    'settings:set': a => db.setConfig(a[0]),
    'documents:getByEntity': a => db.getDocumentsByEntity(a[0], a[1]),
    'documents:getAll': a => db.getAllDocuments(a[0]),
    'documents:delete': a => { const doc = db.deleteDocumentRecord(a[0]); if (doc) { try { fs.unlinkSync(path.join(DOCS_DIR, doc.nom_fichier)); } catch (e) {} } return { success: true }; },
    'documents:saveDataUrl': a => { const { dataUrl, meta } = a[0] || {}; const m = /^data:image\/(png|jpeg|jpg|webp);base64,/.exec(dataUrl || ''); const ext = m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : 'png'; const stored = `${Date.now()}_${Math.floor(Math.random() * 1e5)}_croquis.${ext}`; const size = storeDataUrl(dataUrl, DOCS_DIR, stored); if (size === null) return { success: false }; db.createDocument({ nom: (meta && meta.nom) || 'Croquis.' + ext, nom_fichier: stored, type_document: 'Photo', entite_type: (meta && meta.entite_type) || 'projet', entite_id: meta && meta.entite_id, projet_id: meta && meta.projet_id, taille: size, extension: ext, description: meta && meta.description, categorie: (meta && meta.categorie) || 'Annotation', uploaded_by: meta && meta.uploaded_by }); return { success: true }; },
    // Upload de fichiers déjà lus (base64) — même traitement que l'upload web
    'documents:uploadData': a => H['documents:uploadWeb'](a),
    // Upload web (fichiers en base64 depuis le navigateur)
    'documents:uploadWeb': a => { const { files, meta } = a[0] || {}; let count = 0; (files || []).forEach(f => { const m = /^data:([^;]+);base64,(.+)$/.exec(f.dataUrl || ''); if (!m) return; const base = (f.name || 'fichier').replace(/[^a-zA-Z0-9._-]/g, '_'); const ext = (base.split('.').pop() || '').toLowerCase(); const stored = `${Date.now()}_${Math.floor(Math.random() * 1e5)}_${base}`; fs.writeFileSync(path.join(DOCS_DIR, stored), Buffer.from(m[2], 'base64')); const size = fs.statSync(path.join(DOCS_DIR, stored)).size; db.createDocument({ nom: f.name || 'fichier', nom_fichier: stored, type_document: (meta && (meta.photo ? 'Photo' : meta.type_document)) || 'Autre', categorie: meta && meta.categorie, entite_type: (meta && meta.entite_type) || 'projet', entite_id: meta && meta.entite_id, projet_id: meta && meta.projet_id, taille: size, extension: ext, description: meta && meta.description, uploaded_by: meta && meta.uploaded_by }); count++; }); if (count && meta) db.logEvent({ acteur_type: meta.uploaded_by_role || 'MOD', action: 'Document(s) ajouté(s)', cible_type: meta.entite_type, cible_id: meta.entite_id, projet_id: meta.projet_id, details: `${count} fichier(s)` }); return { success: true, count }; },
    'photos:getGallery': a => db.getPhotos(a[0] || {}).map(ph => { let dataUrl = null; try { const p = path.join(DOCS_DIR, ph.nom_fichier); if (fs.existsSync(p)) { const ext = (ph.extension || '').toLowerCase(); dataUrl = `data:${IMG_MIME[ext] || 'image/jpeg'};base64,` + fs.readFileSync(p).toString('base64'); } } catch (e) {} return { ...ph, dataUrl }; }),
    // Documents : ouverture/téléchargement gérés par des routes dédiées (voir plus bas)
    'docs:generate': a => { const { html, filename } = a[0] || {}; const safe = (filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_') + '.html'; fs.writeFileSync(path.join(GEN_DIR, safe), embedFont(html), 'utf-8'); return { success: true, url: '/api/generated/' + safe }; },
    'docs:printPdf': a => H['docs:generate'](a),
    'backup:listAuto': () => { try { const dir = path.join(DATA_DIR, 'backups'); if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir).filter(f => f.endsWith('.db')).sort().reverse().map(f => { const st = fs.statSync(path.join(dir, f)); return { nom: f, taille: st.size, date: st.mtime.toISOString() }; }); } catch (e) { return []; } },
    'backup:exportCsv': () => { const data = db.exportData(); return { success: true, tables: Object.entries(data).map(([name, rows]) => ({ name, csv: toCsv(rows) })) }; },
    'backup:restoreWeb': a => { try { const m = /^data:[^;]+;base64,(.+)$/.exec(a[0] || ''); if (!m) return { success: false, error: 'Fichier invalide.' }; const buf = Buffer.from(m[1], 'base64'); if (buf.toString('utf8', 0, 15) !== 'SQLite format 3') return { success: false, error: 'Ce n\'est pas une base ANEP MOD.' }; autoBackup(); db.close(); fs.writeFileSync(DB_PATH, buf); return db.initialize().then(() => ({ success: true, reload: true })); } catch (e) { return { success: false, error: e.message }; } },
    'backup:openFolder': () => ({ success: false, error: 'Non applicable en mode web.' })
};

function autoBackup() {
    try {
        if (!fs.existsSync(DB_PATH)) return;
        const dir = path.join(DATA_DIR, 'backups'); fs.mkdirSync(dir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        fs.copyFileSync(DB_PATH, path.join(dir, `auto_anep_mod_${stamp}.db`));
        const files = fs.readdirSync(dir).filter(f => f.startsWith('auto_') && f.endsWith('.db')).sort();
        while (files.length > 10) fs.unlinkSync(path.join(dir, files.shift()));
    } catch (e) {}
}

// ============================================================
// Serveur Express
// ============================================================
const app = express();
app.use(express.json({ limit: '80mb' }));

// Pont RPC (authentifié par jeton)
app.post('/api/rpc', async (req, res) => {
    const { channel, args } = req.body || {};
    const token = req.headers['x-auth-token'];

    // Connexion : délivre un jeton
    if (channel === 'auth:login') {
        const user = db.authenticate((args || [])[0], (args || [])[1]);
        if (!user) return res.json({ result: null });
        return res.json({ result: { ...user, _token: newToken(user) } });
    }
    // Déconnexion : invalide le jeton
    if (channel === 'auth:logout') {
        if (token) SESSIONS.delete(token);
        return res.json({ result: { success: true } });
    }
    // Toutes les autres opérations nécessitent un jeton valide
    const user = validToken(token);
    if (!user) return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });

    const fn = H[channel];
    if (!fn) return res.status(404).json({ error: 'Canal inconnu : ' + channel });
    try {
        const r = await fn(args || []);
        res.json({ result: r === undefined ? null : r });
    } catch (e) {
        console.error('RPC error', channel, e.message);
        res.status(500).json({ error: e.message });
    }
});

// Contrôle du jeton pour les routes fichiers (jeton passé en ?t=)
function requireToken(req, res, next) {
    if (!validToken(req.query.t)) return res.status(401).send('Non authentifié');
    next();
}

// Documents stockés : ouverture / téléchargement
app.get('/api/docfile/:id', requireToken, (req, res) => {
    const doc = db.getDocument(parseInt(req.params.id));
    if (!doc) return res.status(404).send('Introuvable');
    const p = path.join(DOCS_DIR, doc.nom_fichier);
    if (!fs.existsSync(p)) return res.status(404).send('Fichier absent');
    if (req.query.dl) return res.download(p, doc.nom);
    res.sendFile(p);
});
// Documents générés (lettres, rapports, PV…)
app.get('/api/generated/:name', requireToken, (req, res) => {
    const p = path.join(GEN_DIR, path.basename(req.params.name));
    if (!fs.existsSync(p)) return res.status(404).send('Introuvable');
    res.sendFile(p);
});
// Sauvegarde : téléchargement de la base
app.get('/api/backup/download', requireToken, (req, res) => {
    db.save();
    res.download(DB_PATH, `anep_mod_sauvegarde_${new Date().toISOString().slice(0, 10)}.db`);
});

// Frontend statique
app.use(express.static(path.join(__dirname, 'src')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'src', 'index.html')));

const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const CERT_DIR = path.join(DATA_DIR, 'certs');

(async () => {
    await db.initialize();
    autoBackup();

    http.createServer(app).listen(PORT, () => {
        console.log(`\n  ✅ ANEP MOD — serveur web démarré`);
        console.log(`  ➜  HTTP local :    http://localhost:${PORT}`);
        console.log(`  ➜  HTTP réseau :   http://<IP-du-serveur>:${PORT}`);
    });

    // HTTPS si un certificat est présent (voir : npm run gen-cert)
    const keyP = path.join(CERT_DIR, 'server.key'), crtP = path.join(CERT_DIR, 'server.crt');
    if (fs.existsSync(keyP) && fs.existsSync(crtP)) {
        try {
            https.createServer({ key: fs.readFileSync(keyP), cert: fs.readFileSync(crtP) }, app)
                .listen(HTTPS_PORT, () => {
                    console.log(`  ➜  HTTPS local :   https://localhost:${HTTPS_PORT}`);
                    console.log(`  ➜  HTTPS réseau :  https://<IP-du-serveur>:${HTTPS_PORT}\n`);
                });
        } catch (e) { console.error('  ⚠ HTTPS non démarré :', e.message, '\n'); }
    } else {
        console.log(`  (HTTPS inactif — lancez « npm run gen-cert » pour l'activer)\n`);
    }
})();
