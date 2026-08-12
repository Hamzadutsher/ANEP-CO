-- ============================================
-- ANEP MOD - Schéma de Base de Données
-- Gestion de la Maîtrise d'Ouvrage Déléguée
-- ============================================

-- Table des projets
CREATE TABLE IF NOT EXISTS projets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_projet TEXT NOT NULL UNIQUE,
    intitule TEXT NOT NULL,
    maitre_ouvrage TEXT NOT NULL,
    nature_projet TEXT DEFAULT 'Construction',
    localisation TEXT,
    wilaya TEXT,
    montant_marche REAL DEFAULT 0,
    date_debut DATE,
    date_fin_prevue DATE,
    duree_mois INTEGER DEFAULT 0,
    statut TEXT DEFAULT 'En cours' CHECK(statut IN ('En préparation', 'En cours', 'Arrêté', 'Réceptionné', 'Clôturé')),
    taux_avancement REAL DEFAULT 0,
    observations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des lots (allotissement)
CREATE TABLE IF NOT EXISTS lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    code_lot TEXT NOT NULL,
    designation TEXT NOT NULL,
    nature TEXT NOT NULL CHECK(nature IN ('Gros Œuvre & Étanchéité', 'Électricité', 'Fluides', 'VRD', 'Menuiserie Aluminium', 'Menuiserie Bois', 'Peinture & Revêtements', 'Ascenseurs', 'Climatisation & Chauffage', 'Sécurité Incendie', 'Aménagement Extérieur', 'Autre')),
    entreprise_id INTEGER,
    montant REAL DEFAULT 0,
    duree_jours INTEGER DEFAULT 0,
    date_os_commencement DATE,
    date_fin_contractuelle DATE,
    delai_consomme INTEGER DEFAULT 0,
    taux_avancement REAL DEFAULT 0,
    statut TEXT DEFAULT 'En attente' CHECK(statut IN ('En attente', 'En cours', 'Arrêté', 'Terminé', 'Réceptionné')),
    observations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
    FOREIGN KEY (entreprise_id) REFERENCES intervenants(id)
);

-- Table des intervenants
CREATE TABLE IF NOT EXISTS intervenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_role TEXT NOT NULL CHECK(type_role IN ('Architecte', 'BET', 'BCT', 'Laboratoire', 'Topographe', 'Entreprise')),
    raison_sociale TEXT NOT NULL,
    contact_nom TEXT,
    contact_prenom TEXT,
    email TEXT,
    telephone TEXT,
    adresse TEXT,
    ville TEXT,
    specialite TEXT,
    numero_agrement TEXT,
    avatar TEXT,
    actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Association intervenants-projets
CREATE TABLE IF NOT EXISTS intervenants_projet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    intervenant_id INTEGER NOT NULL,
    lot_id INTEGER,
    role_specifique TEXT,
    date_attribution DATE DEFAULT CURRENT_DATE,
    actif INTEGER DEFAULT 1,
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
    FOREIGN KEY (intervenant_id) REFERENCES intervenants(id),
    FOREIGN KEY (lot_id) REFERENCES lots(id),
    UNIQUE(projet_id, intervenant_id, lot_id)
);

-- Comptes nominatifs de l'équipe MOD (chef de projet, chefs de service, techniciens…)
CREATE TABLE IF NOT EXISTS mod_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    fonction TEXT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    actif INTEGER DEFAULT 1,
    derniere_connexion DATETIME,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions d'accès (gérées par le MOD)
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intervenant_id INTEGER NOT NULL,
    projet_id INTEGER NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    actif INTEGER DEFAULT 1,
    derniere_connexion DATETIME,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (intervenant_id) REFERENCES intervenants(id),
    FOREIGN KEY (projet_id) REFERENCES projets(id)
);

-- Ouvrages (éléments de construction)
CREATE TABLE IF NOT EXISTS ouvrages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL,
    designation TEXT NOT NULL,
    bloc TEXT,
    niveau TEXT,
    phase TEXT CHECK(phase IN ('Fondations', 'Infrastructure', 'Superstructure', 'Étanchéité', 'Second Œuvre', 'Finitions')),
    description TEXT,
    statut TEXT DEFAULT 'Non commencé' CHECK(statut IN ('Non commencé', 'En cours', 'En validation', 'Validé', 'Bétonnage planifié', 'Bétonné', 'Essais en cours', 'Terminé')),
    date_debut DATE,
    date_fin DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE
);

-- Étapes du workflow de validation
CREATE TABLE IF NOT EXISTS workflow_etapes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ouvrage_id INTEGER NOT NULL,
    etape_numero INTEGER NOT NULL,
    type_etape TEXT NOT NULL CHECK(type_etape IN (
        'Déclaration achèvement',
        'Vérification architecte',
        'Attestation implantation',
        'Réception BET',
        'Contrôle BCT',
        'Validation produits',
        'Synthèse avis',
        'Déclaration bétonnage',
        'Bétonnage effectué',
        'Essai 7 jours',
        'Essai 28 jours',
        'Clôture'
    )),
    responsable_type TEXT CHECK(responsable_type IN ('Architecte', 'BET', 'BCT', 'Laboratoire', 'Topographe', 'Entreprise', 'MOD')),
    responsable_id INTEGER,
    statut TEXT DEFAULT 'En attente' CHECK(statut IN ('En attente', 'En cours', 'Favorable', 'Défavorable', 'Avec réserves', 'Terminé')),
    date_debut DATETIME,
    date_fin DATETIME,
    commentaire TEXT,
    pieces_jointes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ouvrage_id) REFERENCES ouvrages(id) ON DELETE CASCADE
);

-- Avis des intervenants
CREATE TABLE IF NOT EXISTS avis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    etape_id INTEGER NOT NULL,
    intervenant_id INTEGER NOT NULL,
    type_avis TEXT NOT NULL CHECK(type_avis IN ('Favorable', 'Favorable avec réserves', 'Défavorable')),
    contenu TEXT,
    details_verification TEXT,
    statut TEXT DEFAULT 'Émis' CHECK(statut IN ('Émis', 'Pris en compte', 'Archivé')),
    date_avis DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (etape_id) REFERENCES workflow_etapes(id) ON DELETE CASCADE,
    FOREIGN KEY (intervenant_id) REFERENCES intervenants(id)
);

-- Réserves
CREATE TABLE IF NOT EXISTS reserves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    etape_id INTEGER,
    ouvrage_id INTEGER NOT NULL,
    emetteur_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    localisation_reserve TEXT,
    gravite TEXT DEFAULT 'Moyenne' CHECK(gravite IN ('Mineure', 'Moyenne', 'Majeure', 'Bloquante')),
    statut TEXT DEFAULT 'Ouverte' CHECK(statut IN ('Ouverte', 'En cours de levée', 'Levée', 'Annulée')),
    date_emission DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_levee DATETIME,
    commentaire_levee TEXT,
    FOREIGN KEY (etape_id) REFERENCES workflow_etapes(id),
    FOREIGN KEY (ouvrage_id) REFERENCES ouvrages(id) ON DELETE CASCADE,
    FOREIGN KEY (emetteur_id) REFERENCES intervenants(id)
);

-- Ordres de service
CREATE TABLE IF NOT EXISTS ordres_service (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id INTEGER NOT NULL,
    numero_os TEXT NOT NULL,
    type_os TEXT NOT NULL CHECK(type_os IN ('Commencement', 'Arrêt', 'Reprise', 'Prolongation', 'Résiliation')),
    objet TEXT NOT NULL,
    date_notification DATE NOT NULL,
    date_effet DATE NOT NULL,
    delai_jours INTEGER DEFAULT 0,
    date_fin_effet DATE,
    motif TEXT,
    observations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE
);

-- Essais laboratoire
CREATE TABLE IF NOT EXISTS essais_labo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ouvrage_id INTEGER NOT NULL,
    labo_id INTEGER NOT NULL,
    type_essai TEXT NOT NULL CHECK(type_essai IN ('Résistance béton', 'Compactage', 'Granulométrie', 'Équivalent de sable', 'Essai Proctor', 'Essai CBR', 'Autre')),
    reference_prelevement TEXT,
    date_prelevement DATE NOT NULL,
    date_echeance_7j DATE,
    date_echeance_28j DATE,
    resultat_7j REAL,
    resultat_28j REAL,
    valeur_cible REAL,
    unite TEXT DEFAULT 'MPa',
    conformite TEXT CHECK(conformite IN ('Conforme', 'Non conforme', 'En attente')),
    norme_reference TEXT,
    observations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ouvrage_id) REFERENCES ouvrages(id) ON DELETE CASCADE,
    FOREIGN KEY (labo_id) REFERENCES intervenants(id)
);

-- Réunions de chantier
CREATE TABLE IF NOT EXISTS reunions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    numero_reunion TEXT NOT NULL,
    type_reunion TEXT DEFAULT 'Ordinaire' CHECK(type_reunion IN ('Ordinaire', 'Extraordinaire', 'Coordination', 'Réception')),
    date_reunion DATETIME NOT NULL,
    lieu TEXT,
    ordre_jour TEXT,
    compte_rendu TEXT,
    pv_path TEXT,
    statut TEXT DEFAULT 'Planifiée' CHECK(statut IN ('Planifiée', 'En cours', 'Terminée', 'Annulée')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE
);

-- Invitations aux réunions
CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reunion_id INTEGER NOT NULL,
    intervenant_id INTEGER NOT NULL,
    moyen_envoi TEXT CHECK(moyen_envoi IN ('Email', 'WhatsApp', 'Les deux')),
    statut TEXT DEFAULT 'Non envoyée' CHECK(statut IN ('Non envoyée', 'Envoyée', 'Confirmée', 'Déclinée')),
    date_envoi DATETIME,
    FOREIGN KEY (reunion_id) REFERENCES reunions(id) ON DELETE CASCADE,
    FOREIGN KEY (intervenant_id) REFERENCES intervenants(id)
);

-- Notifications internes
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destinataire_type TEXT NOT NULL,
    destinataire_id INTEGER,
    projet_id INTEGER,
    titre TEXT NOT NULL,
    message TEXT NOT NULL,
    type_notif TEXT DEFAULT 'info' CHECK(type_notif IN ('info', 'alerte', 'urgent', 'succes')),
    lue INTEGER DEFAULT 0,
    lien TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projet_id) REFERENCES projets(id)
);

-- Documents (plans, notes de calcul, fiches techniques, PV…)
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    nom_fichier TEXT NOT NULL,
    type_document TEXT DEFAULT 'Autre' CHECK(type_document IN ('Plan', 'Note de calcul', 'Fiche technique', 'PV', 'Rapport', 'Marché', 'Photo', 'Attestation', 'Autre')),
    entite_type TEXT NOT NULL DEFAULT 'projet',
    entite_id INTEGER,
    projet_id INTEGER,
    taille INTEGER DEFAULT 0,
    extension TEXT,
    description TEXT,
    categorie TEXT,
    uploaded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projet_id) REFERENCES projets(id)
);

-- Registre de permanence / présence sur chantier (responsabilité des intervenants)
CREATE TABLE IF NOT EXISTS permanences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    intervenant_id INTEGER NOT NULL,
    role TEXT,
    date DATE NOT NULL,
    present INTEGER DEFAULT 1,
    heure_arrivee TEXT,
    heure_depart TEXT,
    observations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(projet_id, intervenant_id, date),
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
    FOREIGN KEY (intervenant_id) REFERENCES intervenants(id)
);

-- Comptes rendus / PV (réunions, chantier) + responsabilités
CREATE TABLE IF NOT EXISTS comptes_rendus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    reunion_id INTEGER,
    type TEXT DEFAULT 'CR Chantier' CHECK(type IN ('CR Réunion', 'CR Chantier', 'PV Réception', 'Note', 'Observation')),
    objet TEXT NOT NULL,
    contenu TEXT,
    redige_par TEXT,
    redige_par_role TEXT,
    date_cr DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE
);

-- Actions / décisions d'un compte rendu (responsabilité par intervenant)
CREATE TABLE IF NOT EXISTS cr_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cr_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    responsable TEXT,
    delai DATE,
    statut TEXT DEFAULT 'À faire' CHECK(statut IN ('À faire', 'En cours', 'Fait')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cr_id) REFERENCES comptes_rendus(id) ON DELETE CASCADE
);

-- Paramètres / permissions (gérés par le MOD)
CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur TEXT
);

-- HQSE (Hygiène, Qualité, Sécurité, Environnement) — évaluation & anticipation des risques
CREATE TABLE IF NOT EXISTS hqse (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    lot_id INTEGER,
    date DATE,
    domaine TEXT DEFAULT 'Sécurité' CHECK(domaine IN ('Sécurité', 'Hygiène', 'Qualité', 'Environnement')),
    type_fiche TEXT DEFAULT 'Observation' CHECK(type_fiche IN ('Observation', 'Risque identifié', 'Presqu''accident', 'Non-conformité', 'Accident', 'Action préventive')),
    gravite INTEGER DEFAULT 2,
    probabilite INTEGER DEFAULT 2,
    description TEXT NOT NULL,
    localisation TEXT,
    action_corrective TEXT,
    responsable_action TEXT,
    delai DATE,
    statut TEXT DEFAULT 'Ouvert' CHECK(statut IN ('Ouvert', 'En cours', 'Traité', 'Clôturé')),
    saisi_par TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
    FOREIGN KEY (lot_id) REFERENCES lots(id)
);

-- Attachements (métré / constatation des travaux exécutés)
CREATE TABLE IF NOT EXISTS attachements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    lot_id INTEGER NOT NULL,
    numero TEXT NOT NULL,
    periode TEXT,
    date_attachement DATE,
    montant_travaux REAL DEFAULT 0,
    statut TEXT DEFAULT 'Soumis' CHECK(statut IN ('Brouillon', 'Soumis', 'Validé', 'Rejeté')),
    observations TEXT,
    motif_rectification TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
    FOREIGN KEY (lot_id) REFERENCES lots(id)
);

-- Décomptes (situations de paiement) + circuit de mandatement
CREATE TABLE IF NOT EXISTS decomptes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    lot_id INTEGER NOT NULL,
    attachement_id INTEGER,
    numero TEXT NOT NULL,
    type TEXT DEFAULT 'Provisoire' CHECK(type IN ('Provisoire', 'Définitif')),
    date_decompte DATE,
    montant_ht REAL DEFAULT 0,
    taux_tva REAL DEFAULT 20,
    montant_tva REAL DEFAULT 0,
    montant_ttc REAL DEFAULT 0,
    montant_cumule_anterieur REAL DEFAULT 0,
    taux_retenue_garantie REAL DEFAULT 7,
    montant_retenue REAL DEFAULT 0,
    montant_net_a_payer REAL DEFAULT 0,
    statut TEXT DEFAULT 'Établi' CHECK(statut IN ('Établi', 'Validé technique', 'Visé', 'Mandaté', 'Payé', 'Rejeté')),
    phase_paiement TEXT,
    observations TEXT,
    num_mandat TEXT,
    num_tgr TEXT,
    date_mandatement DATE,
    date_ordonnancement DATE,
    date_visa_tgr DATE,
    date_paiement DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
    FOREIGN KEY (lot_id) REFERENCES lots(id)
);

-- Circuit de validation/visa/mandatement/paiement d'un décompte
CREATE TABLE IF NOT EXISTS decompte_circuit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decompte_id INTEGER NOT NULL,
    ordre INTEGER NOT NULL,
    etape TEXT NOT NULL,
    responsable_type TEXT,
    statut TEXT DEFAULT 'En attente' CHECK(statut IN ('En attente', 'Validé', 'Avec remarques', 'Rejeté')),
    commentaire TEXT,
    acteur TEXT,
    date_action DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (decompte_id) REFERENCES decomptes(id) ON DELETE CASCADE
);

-- Interfaces / dépendances entre lots (ex : réservations & baies GO → lots secondaires)
CREATE TABLE IF NOT EXISTS lot_interfaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    lot_source_id INTEGER NOT NULL,
    lot_cible_id INTEGER NOT NULL,
    type_interface TEXT DEFAULT 'Réservations' CHECK(type_interface IN ('Réservations', 'Baies', 'Support / Dalle', 'Étanchéité préalable', 'Alimentation / Attente', 'Trémie', 'Scellement', 'Autre')),
    description TEXT,
    statut TEXT DEFAULT 'En attente' CHECK(statut IN ('En attente', 'Prêt', 'Livré', 'Bloqué')),
    date_prevue DATE,
    date_reelle DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
    FOREIGN KEY (lot_source_id) REFERENCES lots(id),
    FOREIGN KEY (lot_cible_id) REFERENCES lots(id)
);

-- Journal météo (intempéries → arrêts/reprises dans les OS)
CREATE TABLE IF NOT EXISTS meteo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    date DATE NOT NULL,
    condition TEXT,
    temp_min REAL,
    temp_max REAL,
    precipitation_mm REAL DEFAULT 0,
    vent_kmh REAL DEFAULT 0,
    arret_travaux INTEGER DEFAULT 0,
    source TEXT DEFAULT 'Saisie manuelle',
    commentaire TEXT,
    saisi_par TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(projet_id, date),
    FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE
);

-- Journal des événements (traçabilité / audit)
CREATE TABLE IF NOT EXISTS evenements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    acteur_type TEXT,
    acteur_id INTEGER,
    action TEXT NOT NULL,
    cible_type TEXT,
    cible_id INTEGER,
    projet_id INTEGER,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes pour performances
CREATE INDEX IF NOT EXISTS idx_lots_projet ON lots(projet_id);
CREATE INDEX IF NOT EXISTS idx_ouvrages_lot ON ouvrages(lot_id);
CREATE INDEX IF NOT EXISTS idx_workflow_ouvrage ON workflow_etapes(ouvrage_id);
CREATE INDEX IF NOT EXISTS idx_avis_etape ON avis(etape_id);
CREATE INDEX IF NOT EXISTS idx_reserves_ouvrage ON reserves(ouvrage_id);
CREATE INDEX IF NOT EXISTS idx_essais_ouvrage ON essais_labo(ouvrage_id);
CREATE INDEX IF NOT EXISTS idx_os_lot ON ordres_service(lot_id);
CREATE INDEX IF NOT EXISTS idx_sessions_intervenant ON sessions(intervenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dest ON notifications(destinataire_type, destinataire_id);
CREATE INDEX IF NOT EXISTS idx_intervenants_projet ON intervenants_projet(projet_id, intervenant_id);
CREATE INDEX IF NOT EXISTS idx_evenements_projet ON evenements(projet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evenements_acteur ON evenements(acteur_type, acteur_id);
CREATE INDEX IF NOT EXISTS idx_avis_intervenant ON avis(intervenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_entite ON documents(entite_type, entite_id);
CREATE INDEX IF NOT EXISTS idx_documents_projet ON documents(projet_id);

-- Compte administrateur MOD (mot de passe par défaut: admin)
INSERT OR IGNORE INTO intervenants (id, type_role, raison_sociale, contact_nom, email)
VALUES (0, 'Architecte', 'ANEP - MOD', 'Administrateur', 'admin@anep.ma');
