/* ============================================================
   ANEP MOD — Adaptateur Web de window.api
   Reproduit l'interface Electron (preload) via des appels HTTP.
   Ne s'active QUE dans le navigateur (si window.api absent).
   ============================================================ */
(function () {
    if (window.api) return; // Electron : l'API IPC est déjà fournie par preload.js

    let _token = sessionStorage.getItem('anep_token') || null;
    const tokenQS = () => _token ? ('?t=' + encodeURIComponent(_token)) : '';

    function sessionExpired() {
        _token = null;
        sessionStorage.removeItem('anep_token');
        sessionStorage.removeItem('currentUser');
        alert('Votre session a expiré. Veuillez vous reconnecter.');
        location.reload();
    }

    async function rpc(channel, ...args) {
        const r = await fetch('/api/rpc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': _token || '' },
            body: JSON.stringify({ channel, args })
        });
        if (r.status === 401) { sessionExpired(); throw new Error('Session expirée'); }
        if (!r.ok) {
            let e = {}; try { e = await r.json(); } catch (_) {}
            throw new Error(e.error || ('Erreur serveur ' + r.status));
        }
        return (await r.json()).result;
    }

    // Sélecteur de fichiers (navigateur) → [{ name, dataUrl }]
    function pickFiles(opts = {}) {
        return new Promise(resolve => {
            const inp = document.createElement('input');
            inp.type = 'file';
            if (opts.accept) inp.accept = opts.accept;
            if (opts.multiple) inp.multiple = true;
            inp.style.display = 'none';
            document.body.appendChild(inp);
            inp.addEventListener('change', () => {
                const files = Array.from(inp.files || []);
                inp.remove();
                if (!files.length) return resolve(null);
                Promise.all(files.map(f => new Promise(res => {
                    const rd = new FileReader();
                    rd.onload = () => res({ name: f.name, dataUrl: rd.result });
                    rd.readAsDataURL(f);
                }))).then(resolve);
            });
            inp.click();
        });
    }
    function downloadBlob(content, filename, mime) {
        const blob = new Blob([content], { type: mime || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    window.api = {
        auth: {
            login: async (u, p) => {
                const user = await rpc('auth:login', u, p);
                if (user && user._token) { _token = user._token; sessionStorage.setItem('anep_token', _token); delete user._token; }
                return user;
            },
            logout: async () => { try { await rpc('auth:logout'); } catch (e) {} _token = null; sessionStorage.removeItem('anep_token'); }
        },
        projets: {
            getAll: () => rpc('projets:getAll'), get: id => rpc('projets:get', id),
            create: d => rpc('projets:create', d), update: (id, d) => rpc('projets:update', id, d),
            delete: id => rpc('projets:delete', id), getStats: id => rpc('projets:getStats', id)
        },
        lots: {
            getByProjet: id => rpc('lots:getByProjet', id), get: id => rpc('lots:get', id),
            create: d => rpc('lots:create', d), update: (id, d) => rpc('lots:update', id, d), delete: id => rpc('lots:delete', id)
        },
        intervenants: {
            getAll: r => rpc('intervenants:getAll', r), get: id => rpc('intervenants:get', id),
            create: d => rpc('intervenants:create', d), update: (id, d) => rpc('intervenants:update', id, d),
            delete: id => rpc('intervenants:delete', id), getByProjet: id => rpc('intervenants:getByProjet', id),
            setAvatar: (id, dataUrl) => rpc('intervenants:setAvatar', id, dataUrl), getAvatar: id => rpc('intervenants:getAvatar', id)
        },
        sessions: {
            getAll: () => rpc('sessions:getAll'), getByProjet: id => rpc('sessions:getByProjet', id),
            create: d => rpc('sessions:create', d), toggle: (id, a) => rpc('sessions:toggle', id, a),
            updatePassword: (id, p) => rpc('sessions:updatePassword', id, p), delete: id => rpc('sessions:delete', id)
        },
        modteam: {
            getAll: () => rpc('modteam:getAll'), create: d => rpc('modteam:create', d),
            update: (id, d) => rpc('modteam:update', id, d), updatePassword: (id, p) => rpc('modteam:updatePassword', id, p),
            toggle: (id, a) => rpc('modteam:toggle', id, a), delete: id => rpc('modteam:delete', id)
        },
        events: { get: f => rpc('events:get', f) },
        ouvrages: {
            getByLot: id => rpc('ouvrages:getByLot', id), getByProjet: id => rpc('ouvrages:getByProjet', id),
            get: id => rpc('ouvrages:get', id), create: d => rpc('ouvrages:create', d),
            updateStatut: (id, s) => rpc('ouvrages:updateStatut', id, s), update: (id, d) => rpc('ouvrages:update', id, d), delete: id => rpc('ouvrages:delete', id)
        },
        workflow: {
            getByOuvrage: id => rpc('workflow:getByOuvrage', id), createEtape: d => rpc('workflow:createEtape', d),
            updateStatut: (id, s, c) => rpc('workflow:updateStatut', id, s, c), getPending: (r, i) => rpc('workflow:getPending', r, i),
            declareAchievement: (id, c) => rpc('workflow:declareAchievement', id, c), advance: id => rpc('workflow:advance', id),
            declareBetonnage: (id, d) => rpc('workflow:declareBetonnage', id, d)
        },
        avis: { getByEtape: id => rpc('avis:getByEtape', id), create: d => rpc('avis:create', d), getByIntervenant: id => rpc('avis:getByIntervenant', id) },
        reserves: {
            getByOuvrage: id => rpc('reserves:getByOuvrage', id), getOuvertes: id => rpc('reserves:getOuvertes', id),
            create: d => rpc('reserves:create', d), lever: (id, c) => rpc('reserves:lever', id, c), delete: id => rpc('reserves:delete', id)
        },
        os: {
            getByLot: id => rpc('os:getByLot', id), getByProjet: id => rpc('os:getByProjet', id),
            getDependentLots: id => rpc('os:getDependentLots', id),
            create: d => rpc('os:create', d), update: (id, d) => rpc('os:update', id, d), delete: id => rpc('os:delete', id)
        },
        timeline: { axis: id => rpc('timeline:axis', id) },
        avenants: {
            getByProjet: id => rpc('avenants:getByProjet', id), create: d => rpc('avenants:create', d),
            updateStatut: (id, s) => rpc('avenants:updateStatut', id, s), delete: id => rpc('avenants:delete', id)
        },
        gpa: {
            getByProjet: id => rpc('gpa:getByProjet', id), create: d => rpc('gpa:create', d),
            close: id => rpc('gpa:close', id), delete: id => rpc('gpa:delete', id),
            addDesordre: d => rpc('gpa:addDesordre', d), getDesordres: id => rpc('gpa:getDesordres', id),
            resolveDesordre: id => rpc('gpa:resolveDesordre', id), deleteDesordre: id => rpc('gpa:deleteDesordre', id)
        },
        budget: { get: id => rpc('budget:get', id) },
        planpins: {
            getByPlan: id => rpc('planpins:getByPlan', id), create: d => rpc('planpins:create', d),
            update: (id, d) => rpc('planpins:update', id, d), delete: id => rpc('planpins:delete', id),
            stats: id => rpc('planpins:stats', id)
        },
        signalements: {
            getByProjet: id => rpc('signalements:getByProjet', id), create: d => rpc('signalements:create', d),
            updateStatut: (id, s) => rpc('signalements:updateStatut', id, s), delete: id => rpc('signalements:delete', id),
            stats: id => rpc('signalements:stats', id)
        },
        constats: {
            getByProjet: id => rpc('constats:getByProjet', id), create: d => rpc('constats:create', d), delete: id => rpc('constats:delete', id)
        },
        checklist: {
            get: t => rpc('checklist:get', t), add: d => rpc('checklist:add', d), delete: id => rpc('checklist:delete', id)
        },
        essais: {
            getByOuvrage: id => rpc('essais:getByOuvrage', id), getEnCours: id => rpc('essais:getEnCours', id),
            create: d => rpc('essais:create', d), updateResultat: (id, d) => rpc('essais:updateResultat', id, d),
            getByLabo: id => rpc('essais:getByLabo', id), delete: id => rpc('essais:delete', id)
        },
        reunions: {
            getByProjet: id => rpc('reunions:getByProjet', id), get: id => rpc('reunions:get', id),
            create: d => rpc('reunions:create', d), update: (id, d) => rpc('reunions:update', id, d), delete: id => rpc('reunions:delete', id)
        },
        invitations: { create: d => rpc('invitations:create', d), getByReunion: id => rpc('invitations:getByReunion', id) },
        notifications: {
            get: (r, i) => rpc('notifications:get', r, i), markRead: id => rpc('notifications:markRead', id),
            unreadCount: (r, i) => rpc('notifications:unreadCount', r, i), create: d => rpc('notifications:create', d)
        },
        dashboard: { getStats: () => rpc('dashboard:getStats') },
        interfaces: {
            getByProjet: id => rpc('interfaces:getByProjet', id), getStats: id => rpc('interfaces:getStats', id),
            create: d => rpc('interfaces:create', d), updateStatut: (id, s) => rpc('interfaces:updateStatut', id, s), delete: id => rpc('interfaces:delete', id)
        },
        hqse: {
            getByProjet: id => rpc('hqse:getByProjet', id), getStats: id => rpc('hqse:getStats', id),
            create: d => rpc('hqse:create', d), updateStatut: (id, s) => rpc('hqse:updateStatut', id, s), delete: id => rpc('hqse:delete', id)
        },
        attachements: {
            getByProjet: id => rpc('attachements:getByProjet', id), create: d => rpc('attachements:create', d),
            updateStatut: (id, s) => rpc('attachements:updateStatut', id, s),
            validate: (id, ac) => rpc('attachements:validate', id, ac),
            requestRectification: (id, m) => rpc('attachements:requestRectification', id, m),
            resubmit: id => rpc('attachements:resubmit', id),
            delete: id => rpc('attachements:delete', id)
        },
        decomptes: {
            getByProjet: id => rpc('decomptes:getByProjet', id), get: id => rpc('decomptes:get', id),
            getCircuit: id => rpc('decomptes:getCircuit', id), create: d => rpc('decomptes:create', d),
            actStep: (s, st, c, ac) => rpc('decomptes:actStep', s, st, c, ac), updateMandat: (id, n) => rpc('decomptes:updateMandat', id, n),
            updateTgr: (id, n) => rpc('decomptes:updateTgr', id, n), getEvents: id => rpc('decomptes:getEvents', id),
            delete: id => rpc('decomptes:delete', id), getStats: id => rpc('decomptes:getStats', id)
        },
        cr: {
            getByProjet: id => rpc('cr:getByProjet', id), get: id => rpc('cr:get', id), getActions: id => rpc('cr:getActions', id),
            create: d => rpc('cr:create', d), updateActionStatut: (id, s) => rpc('cr:updateActionStatut', id, s), delete: id => rpc('cr:delete', id)
        },
        permanence: {
            getByProjet: id => rpc('permanence:getByProjet', id), getByIntervenant: (i, p) => rpc('permanence:getByIntervenant', i, p),
            getToday: (i, p, d) => rpc('permanence:getToday', i, p, d), getStats: id => rpc('permanence:getStats', id),
            create: d => rpc('permanence:create', d), delete: id => rpc('permanence:delete', id)
        },
        settings: { get: () => rpc('settings:get'), set: o => rpc('settings:set', o) },
        meteo: {
            getByProjet: id => rpc('meteo:getByProjet', id), getStats: id => rpc('meteo:getStats', id),
            create: d => rpc('meteo:create', d), delete: id => rpc('meteo:delete', id), fetch: p => rpc('meteo:fetch', p),
            openOfficial: () => { window.open('https://www.marocmeteo.ma/', '_blank'); return Promise.resolve({ success: true }); }
        },
        external: {
            openEmail: ({ to, subject, body }) => { window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`); return Promise.resolve(); },
            openWhatsApp: ({ phone, message }) => { const c = (phone || '').replace(/[^0-9+]/g, '').replace('+', ''); window.open(`https://wa.me/${c}?text=${encodeURIComponent(message)}`, '_blank'); return Promise.resolve(); }
        },
        docs: {
            generate: async d => { const r = await rpc('docs:generate', d); if (r && r.url) window.open(r.url + tokenQS(), '_blank'); return r; },
            printPdf: async d => { const r = await rpc('docs:printPdf', d); if (r && r.url) window.open(r.url + tokenQS(), '_blank'); return r; }
        },
        documents: {
            getByEntity: (t, id) => rpc('documents:getByEntity', t, id), getAll: f => rpc('documents:getAll', f),
            upload: async meta => { const files = await pickFiles({ accept: meta && meta.photo ? 'image/*' : undefined, multiple: true }); if (!files || !files.length) return { canceled: true }; return rpc('documents:uploadWeb', { files, meta }); },
            open: id => { window.open('/api/docfile/' + id + tokenQS(), '_blank'); return Promise.resolve({ success: true }); },
            saveAs: id => { window.open('/api/docfile/' + id + '?dl=1' + (_token ? '&t=' + encodeURIComponent(_token) : ''), '_blank'); return Promise.resolve({ success: true }); },
            delete: id => rpc('documents:delete', id),
            saveDataUrl: (dataUrl, meta) => rpc('documents:saveDataUrl', { dataUrl, meta }),
            uploadData: (payload) => rpc('documents:uploadData', payload)
        },
        photos: { getGallery: f => rpc('photos:getGallery', f) },
        backup: {
            save: async () => { window.open('/api/backup/download' + tokenQS(), '_blank'); return { success: true, path: 'téléchargé par le navigateur' }; },
            restore: async () => { const files = await pickFiles({ accept: '.db' }); if (!files || !files.length) return { canceled: true }; return rpc('backup:restoreWeb', files[0].dataUrl); },
            exportCsv: async () => { const r = await rpc('backup:exportCsv'); if (r && r.tables) r.tables.forEach(t => downloadBlob(t.csv, t.name + '.csv', 'text/csv;charset=utf-8')); return { success: true, tables: (r && r.tables || []).length, path: 'téléchargés par le navigateur' }; },
            listAuto: () => rpc('backup:listAuto'), openFolder: () => rpc('backup:openFolder')
        }
    };
    console.log('ANEP MOD — mode web (API HTTP) activé');
})();
