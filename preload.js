const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Authentication
    auth: {
        login: (username, password) => ipcRenderer.invoke('auth:login', username, password)
    },

    // Projets
    projets: {
        getAll: () => ipcRenderer.invoke('projets:getAll'),
        get: (id) => ipcRenderer.invoke('projets:get', id),
        create: (data) => ipcRenderer.invoke('projets:create', data),
        update: (id, data) => ipcRenderer.invoke('projets:update', id, data),
        delete: (id) => ipcRenderer.invoke('projets:delete', id),
        getStats: (id) => ipcRenderer.invoke('projets:getStats', id)
    },

    // Lots
    lots: {
        getByProjet: (projetId) => ipcRenderer.invoke('lots:getByProjet', projetId),
        get: (id) => ipcRenderer.invoke('lots:get', id),
        create: (data) => ipcRenderer.invoke('lots:create', data),
        update: (id, data) => ipcRenderer.invoke('lots:update', id, data),
        delete: (id) => ipcRenderer.invoke('lots:delete', id)
    },

    // Intervenants
    intervenants: {
        getAll: (typeRole) => ipcRenderer.invoke('intervenants:getAll', typeRole),
        get: (id) => ipcRenderer.invoke('intervenants:get', id),
        create: (data) => ipcRenderer.invoke('intervenants:create', data),
        update: (id, data) => ipcRenderer.invoke('intervenants:update', id, data),
        delete: (id) => ipcRenderer.invoke('intervenants:delete', id),
        getByProjet: (projetId) => ipcRenderer.invoke('intervenants:getByProjet', projetId),
        setAvatar: (id, dataUrl) => ipcRenderer.invoke('intervenants:setAvatar', id, dataUrl),
        getAvatar: (id) => ipcRenderer.invoke('intervenants:getAvatar', id)
    },

    // Sessions
    sessions: {
        getAll: () => ipcRenderer.invoke('sessions:getAll'),
        getByProjet: (projetId) => ipcRenderer.invoke('sessions:getByProjet', projetId),
        create: (data) => ipcRenderer.invoke('sessions:create', data),
        toggle: (id, actif) => ipcRenderer.invoke('sessions:toggle', id, actif),
        updatePassword: (id, newPassword) => ipcRenderer.invoke('sessions:updatePassword', id, newPassword),
        delete: (id) => ipcRenderer.invoke('sessions:delete', id)
    },

    // Équipe MOD (comptes nominatifs)
    modteam: {
        getAll: () => ipcRenderer.invoke('modteam:getAll'),
        create: (data) => ipcRenderer.invoke('modteam:create', data),
        update: (id, data) => ipcRenderer.invoke('modteam:update', id, data),
        updatePassword: (id, pwd) => ipcRenderer.invoke('modteam:updatePassword', id, pwd),
        toggle: (id, actif) => ipcRenderer.invoke('modteam:toggle', id, actif),
        delete: (id) => ipcRenderer.invoke('modteam:delete', id)
    },

    // Journal / Historique
    events: {
        get: (filters) => ipcRenderer.invoke('events:get', filters)
    },

    // Ouvrages
    ouvrages: {
        getByLot: (lotId) => ipcRenderer.invoke('ouvrages:getByLot', lotId),
        getByProjet: (projetId) => ipcRenderer.invoke('ouvrages:getByProjet', projetId),
        get: (id) => ipcRenderer.invoke('ouvrages:get', id),
        create: (data) => ipcRenderer.invoke('ouvrages:create', data),
        updateStatut: (id, statut) => ipcRenderer.invoke('ouvrages:updateStatut', id, statut)
    },

    // Workflow
    workflow: {
        getByOuvrage: (ouvrageId) => ipcRenderer.invoke('workflow:getByOuvrage', ouvrageId),
        createEtape: (data) => ipcRenderer.invoke('workflow:createEtape', data),
        updateStatut: (id, statut, commentaire) => ipcRenderer.invoke('workflow:updateStatut', id, statut, commentaire),
        getPending: (role, intervenantId) => ipcRenderer.invoke('workflow:getPending', role, intervenantId),
        declareAchievement: (ouvrageId, commentaire) => ipcRenderer.invoke('workflow:declareAchievement', ouvrageId, commentaire),
        advance: (ouvrageId) => ipcRenderer.invoke('workflow:advance', ouvrageId),
        declareBetonnage: (ouvrageId, data) => ipcRenderer.invoke('workflow:declareBetonnage', ouvrageId, data)
    },

    // Avis
    avis: {
        getByEtape: (etapeId) => ipcRenderer.invoke('avis:getByEtape', etapeId),
        create: (data) => ipcRenderer.invoke('avis:create', data),
        getByIntervenant: (intervenantId) => ipcRenderer.invoke('avis:getByIntervenant', intervenantId)
    },

    // Réserves
    reserves: {
        getByOuvrage: (ouvrageId) => ipcRenderer.invoke('reserves:getByOuvrage', ouvrageId),
        getOuvertes: (projetId) => ipcRenderer.invoke('reserves:getOuvertes', projetId),
        create: (data) => ipcRenderer.invoke('reserves:create', data),
        lever: (id, commentaire) => ipcRenderer.invoke('reserves:lever', id, commentaire),
        delete: (id) => ipcRenderer.invoke('reserves:delete', id)
    },

    // Ordres de Service
    os: {
        getByLot: (lotId) => ipcRenderer.invoke('os:getByLot', lotId),
        getByProjet: (projetId) => ipcRenderer.invoke('os:getByProjet', projetId),
        getDependentLots: (lotId) => ipcRenderer.invoke('os:getDependentLots', lotId),
        create: (data) => ipcRenderer.invoke('os:create', data),
        update: (id, data) => ipcRenderer.invoke('os:update', id, data),
        delete: (id) => ipcRenderer.invoke('os:delete', id)
    },
    timeline: {
        axis: (projetId) => ipcRenderer.invoke('timeline:axis', projetId)
    },
    avenants: {
        getByProjet: (projetId) => ipcRenderer.invoke('avenants:getByProjet', projetId),
        create: (data) => ipcRenderer.invoke('avenants:create', data),
        updateStatut: (id, statut) => ipcRenderer.invoke('avenants:updateStatut', id, statut),
        delete: (id) => ipcRenderer.invoke('avenants:delete', id)
    },
    gpa: {
        getByProjet: (projetId) => ipcRenderer.invoke('gpa:getByProjet', projetId),
        create: (data) => ipcRenderer.invoke('gpa:create', data),
        close: (id) => ipcRenderer.invoke('gpa:close', id),
        delete: (id) => ipcRenderer.invoke('gpa:delete', id),
        addDesordre: (data) => ipcRenderer.invoke('gpa:addDesordre', data),
        getDesordres: (gpaId) => ipcRenderer.invoke('gpa:getDesordres', gpaId),
        resolveDesordre: (id) => ipcRenderer.invoke('gpa:resolveDesordre', id),
        deleteDesordre: (id) => ipcRenderer.invoke('gpa:deleteDesordre', id)
    },
    budget: {
        get: (projetId) => ipcRenderer.invoke('budget:get', projetId)
    },
    planpins: {
        getByPlan: (planDocId) => ipcRenderer.invoke('planpins:getByPlan', planDocId),
        create: (data) => ipcRenderer.invoke('planpins:create', data),
        update: (id, data) => ipcRenderer.invoke('planpins:update', id, data),
        delete: (id) => ipcRenderer.invoke('planpins:delete', id),
        stats: (projetId) => ipcRenderer.invoke('planpins:stats', projetId)
    },
    signalements: {
        getByProjet: (projetId) => ipcRenderer.invoke('signalements:getByProjet', projetId),
        create: (data) => ipcRenderer.invoke('signalements:create', data),
        updateStatut: (id, statut) => ipcRenderer.invoke('signalements:updateStatut', id, statut),
        delete: (id) => ipcRenderer.invoke('signalements:delete', id),
        stats: (projetId) => ipcRenderer.invoke('signalements:stats', projetId)
    },
    constats: {
        getByProjet: (projetId) => ipcRenderer.invoke('constats:getByProjet', projetId),
        create: (data) => ipcRenderer.invoke('constats:create', data),
        delete: (id) => ipcRenderer.invoke('constats:delete', id)
    },
    checklist: {
        get: (typeReception) => ipcRenderer.invoke('checklist:get', typeReception),
        add: (data) => ipcRenderer.invoke('checklist:add', data),
        delete: (id) => ipcRenderer.invoke('checklist:delete', id)
    },
    revision: {
        getFormules: (projetId) => ipcRenderer.invoke('revision:getFormules', projetId),
        createFormule: (data) => ipcRenderer.invoke('revision:createFormule', data),
        deleteFormule: (id) => ipcRenderer.invoke('revision:deleteFormule', id),
        calculer: (data) => ipcRenderer.invoke('revision:calculer', data),
        getCalculs: (projetId) => ipcRenderer.invoke('revision:getCalculs', projetId),
        deleteCalcul: (id) => ipcRenderer.invoke('revision:deleteCalcul', id),
        setIndex: (data) => ipcRenderer.invoke('revision:setIndex', data),
        getIndex: (indexNom) => ipcRenderer.invoke('revision:getIndex', indexNom),
        deleteIndex: (id) => ipcRenderer.invoke('revision:deleteIndex', id)
    },

    // Essais Labo
    essais: {
        getByOuvrage: (ouvrageId) => ipcRenderer.invoke('essais:getByOuvrage', ouvrageId),
        getEnCours: (laboId) => ipcRenderer.invoke('essais:getEnCours', laboId),
        create: (data) => ipcRenderer.invoke('essais:create', data),
        updateResultat: (id, data) => ipcRenderer.invoke('essais:updateResultat', id, data),
        getByLabo: (laboId) => ipcRenderer.invoke('essais:getByLabo', laboId),
        delete: (id) => ipcRenderer.invoke('essais:delete', id)
    },

    // Réunions
    reunions: {
        getByProjet: (projetId) => ipcRenderer.invoke('reunions:getByProjet', projetId),
        get: (id) => ipcRenderer.invoke('reunions:get', id),
        create: (data) => ipcRenderer.invoke('reunions:create', data)
    },

    invitations: {
        create: (data) => ipcRenderer.invoke('invitations:create', data),
        getByReunion: (reunionId) => ipcRenderer.invoke('invitations:getByReunion', reunionId)
    },

    // Notifications
    notifications: {
        get: (role, intervenantId) => ipcRenderer.invoke('notifications:get', role, intervenantId),
        markRead: (id) => ipcRenderer.invoke('notifications:markRead', id),
        unreadCount: (role, intervenantId) => ipcRenderer.invoke('notifications:unreadCount', role, intervenantId),
        create: (data) => ipcRenderer.invoke('notifications:create', data)
    },

    // Dashboard
    dashboard: {
        getStats: () => ipcRenderer.invoke('dashboard:getStats')
    },

    // External
    external: {
        openEmail: (data) => ipcRenderer.invoke('external:openEmail', data),
        openWhatsApp: (data) => ipcRenderer.invoke('external:openWhatsApp', data)
    },

    // Documents (lettres, rapports)
    docs: {
        generate: (data) => ipcRenderer.invoke('docs:generate', data),
        printPdf: (data) => ipcRenderer.invoke('docs:printPdf', data)
    },

    // Paramètres / permissions
    settings: {
        get: () => ipcRenderer.invoke('settings:get'),
        set: (obj) => ipcRenderer.invoke('settings:set', obj)
    },

    // HQSE
    hqse: {
        getByProjet: (projetId) => ipcRenderer.invoke('hqse:getByProjet', projetId),
        getStats: (projetId) => ipcRenderer.invoke('hqse:getStats', projetId),
        create: (data) => ipcRenderer.invoke('hqse:create', data),
        updateStatut: (id, statut) => ipcRenderer.invoke('hqse:updateStatut', id, statut),
        delete: (id) => ipcRenderer.invoke('hqse:delete', id)
    },

    // Attachements & Décomptes (circuit de paiement)
    attachements: {
        getByProjet: (projetId) => ipcRenderer.invoke('attachements:getByProjet', projetId),
        create: (data) => ipcRenderer.invoke('attachements:create', data),
        updateStatut: (id, statut) => ipcRenderer.invoke('attachements:updateStatut', id, statut),
        validate: (id, acteur) => ipcRenderer.invoke('attachements:validate', id, acteur),
        requestRectification: (id, motif) => ipcRenderer.invoke('attachements:requestRectification', id, motif),
        resubmit: (id) => ipcRenderer.invoke('attachements:resubmit', id),
        delete: (id) => ipcRenderer.invoke('attachements:delete', id)
    },
    decomptes: {
        getByProjet: (projetId) => ipcRenderer.invoke('decomptes:getByProjet', projetId),
        get: (id) => ipcRenderer.invoke('decomptes:get', id),
        getCircuit: (decompteId) => ipcRenderer.invoke('decomptes:getCircuit', decompteId),
        create: (data) => ipcRenderer.invoke('decomptes:create', data),
        actStep: (stepId, statut, commentaire, acteur) => ipcRenderer.invoke('decomptes:actStep', stepId, statut, commentaire, acteur),
        updateMandat: (id, numMandat) => ipcRenderer.invoke('decomptes:updateMandat', id, numMandat),
        updateTgr: (id, numTgr) => ipcRenderer.invoke('decomptes:updateTgr', id, numTgr),
        getEvents: (decompteId) => ipcRenderer.invoke('decomptes:getEvents', decompteId),
        delete: (id) => ipcRenderer.invoke('decomptes:delete', id),
        getStats: (projetId) => ipcRenderer.invoke('decomptes:getStats', projetId)
    },

    // Interfaces / dépendances entre lots
    interfaces: {
        getByProjet: (projetId) => ipcRenderer.invoke('interfaces:getByProjet', projetId),
        getStats: (projetId) => ipcRenderer.invoke('interfaces:getStats', projetId),
        create: (data) => ipcRenderer.invoke('interfaces:create', data),
        updateStatut: (id, statut) => ipcRenderer.invoke('interfaces:updateStatut', id, statut),
        delete: (id) => ipcRenderer.invoke('interfaces:delete', id)
    },

    // Météo / Intempéries
    meteo: {
        getByProjet: (projetId) => ipcRenderer.invoke('meteo:getByProjet', projetId),
        getStats: (projetId) => ipcRenderer.invoke('meteo:getStats', projetId),
        create: (data) => ipcRenderer.invoke('meteo:create', data),
        delete: (id) => ipcRenderer.invoke('meteo:delete', id),
        fetch: (params) => ipcRenderer.invoke('meteo:fetch', params),
        openOfficial: () => ipcRenderer.invoke('meteo:openOfficial')
    },

    // Documents (GED)
    documents: {
        upload: (meta) => ipcRenderer.invoke('documents:upload', meta),
        getByEntity: (entiteType, entiteId) => ipcRenderer.invoke('documents:getByEntity', entiteType, entiteId),
        getAll: (filters) => ipcRenderer.invoke('documents:getAll', filters),
        open: (id) => ipcRenderer.invoke('documents:open', id),
        saveAs: (id) => ipcRenderer.invoke('documents:saveAs', id),
        delete: (id) => ipcRenderer.invoke('documents:delete', id),
        saveDataUrl: (dataUrl, meta) => ipcRenderer.invoke('documents:saveDataUrl', { dataUrl, meta }),
        uploadData: (payload) => ipcRenderer.invoke('documents:uploadData', payload)
    },

    // Permanence / présence chantier
    permanence: {
        getByProjet: (projetId) => ipcRenderer.invoke('permanence:getByProjet', projetId),
        getByIntervenant: (intervenantId, projetId) => ipcRenderer.invoke('permanence:getByIntervenant', intervenantId, projetId),
        getToday: (intervenantId, projetId, date) => ipcRenderer.invoke('permanence:getToday', intervenantId, projetId, date),
        getStats: (projetId) => ipcRenderer.invoke('permanence:getStats', projetId),
        create: (data) => ipcRenderer.invoke('permanence:create', data),
        delete: (id) => ipcRenderer.invoke('permanence:delete', id)
    },

    // Comptes rendus / PV
    cr: {
        getByProjet: (projetId) => ipcRenderer.invoke('cr:getByProjet', projetId),
        get: (id) => ipcRenderer.invoke('cr:get', id),
        getActions: (crId) => ipcRenderer.invoke('cr:getActions', crId),
        create: (data) => ipcRenderer.invoke('cr:create', data),
        updateActionStatut: (id, statut) => ipcRenderer.invoke('cr:updateActionStatut', id, statut),
        delete: (id) => ipcRenderer.invoke('cr:delete', id)
    },

    // Photothèque
    photos: {
        getGallery: (filters) => ipcRenderer.invoke('photos:getGallery', filters)
    },

    // Sauvegarde / Restauration / Export
    backup: {
        save: () => ipcRenderer.invoke('backup:save'),
        restore: () => ipcRenderer.invoke('backup:restore'),
        exportCsv: () => ipcRenderer.invoke('backup:exportCsv'),
        listAuto: () => ipcRenderer.invoke('backup:listAuto'),
        openFolder: () => ipcRenderer.invoke('backup:openFolder')
    }
});
