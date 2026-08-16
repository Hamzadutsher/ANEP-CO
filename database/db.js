const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

class AppDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(__dirname, '..', 'data', 'anep_mod.db');
        this.db = null;
        this.SQL = null;
    }

    async initialize() {
        // Ensure directory exists
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Initialize sql.js
        this.SQL = await initSqlJs();

        // Load existing DB or create new
        if (fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath);
            this.db = new this.SQL.Database(buffer);
        } else {
            this.db = new this.SQL.Database();
        }

        // Enable foreign keys
        this.db.run('PRAGMA foreign_keys = ON');

        // Execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        // Split by semicolons and execute each statement
        const statements = schema.split(';').filter(s => s.trim().length > 0);
        for (const stmt of statements) {
            try {
                this.db.run(stmt + ';');
            } catch (e) {
                // Ignore errors from IF NOT EXISTS etc.
                if (!e.message.includes('already exists') && !e.message.includes('UNIQUE constraint')) {
                    console.warn('Schema stmt warning:', e.message.substring(0, 80));
                }
            }
        }

        // Migrations légères (colonnes ajoutées après coup)
        this._migrate();

        // Seed initial data
        this.seedData();

        // Save to disk
        this.save();

        console.log('Database initialized successfully');
    }

    save() {
        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(this.dbPath, buffer);
        } catch (e) {
            console.error('Error saving database:', e);
        }
    }

    // Convertit les undefined en null (sql.js n'accepte pas undefined)
    _clean(params) {
        return params.map(p => (p === undefined ? null : p));
    }

    // Ajoute une colonne si absente (migration douce)
    _ensureColumn(table, column, definition) {
        try {
            const cols = this.all(`PRAGMA table_info(${table})`).map(c => c.name);
            if (!cols.includes(column)) this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        } catch (e) { /* table absente ou déjà migrée */ }
    }

    _migrate() {
        this._ensureColumn('documents', 'categorie', 'TEXT');
        this._ensureColumn('intervenants', 'avatar', 'TEXT');
        // Circuit de paiement enrichi (ordonnancement, visa TGR) + traçabilité
        this._ensureColumn('decomptes', 'phase_paiement', 'TEXT');
        this._ensureColumn('decomptes', 'date_ordonnancement', 'DATE');
        this._ensureColumn('decomptes', 'date_visa_tgr', 'DATE');
        this._ensureColumn('decomptes', 'num_tgr', 'TEXT');
        this._ensureColumn('attachements', 'motif_rectification', 'TEXT');
        // Liaison forte entre OS de différents lots (maîtrise du chevauchement)
        this._ensureColumn('ordres_service', 'os_lie_id', 'INTEGER');
        // Sécurité : forçage du changement de mot de passe à la 1re connexion
        this._ensureColumn('sessions', 'must_change_pwd', 'INTEGER DEFAULT 0');
    }

    // Auto-save after write operations
    _write(sql, params = []) {
        try {
            this.db.run(sql, this._clean(params));
            // Lire l'ID et le nb de lignes AVANT save() : export() réinitialise last_insert_rowid
            const result = this.db.exec('SELECT last_insert_rowid() as id');
            const lastId = result.length > 0 ? result[0].values[0][0] : 0;
            const changes = this.db.getRowsModified();
            this.save();
            return { changes, lastInsertRowid: lastId };
        } catch (e) {
            console.error('DB write error:', e && e.message, sql.substring(0, 80));
            return { changes: 0, lastInsertRowid: 0 };
        }
    }

    // ---- Generic query methods ----

    run(sql, params = []) {
        return this._write(sql, params);
    }

    get(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            if (params.length > 0) stmt.bind(this._clean(params));
            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return row;
            }
            stmt.free();
            return null;
        } catch (e) {
            console.error('DB get error:', e.message, sql.substring(0, 80));
            return null;
        }
    }

    all(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            if (params.length > 0) stmt.bind(this._clean(params));
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        } catch (e) {
            console.error('DB all error:', e.message, sql.substring(0, 80));
            return [];
        }
    }

    getScalar(sql, params = []) {
        const row = this.get(sql, params);
        if (!row) return 0;
        return Object.values(row)[0] || 0;
    }

    seedData() {
        // Check if demo data already exists
        const count = this.getScalar('SELECT COUNT(*) as count FROM projets');
        if (count > 0) return;

        // Insert demo project
        this.run(`INSERT INTO projets (code_projet, intitule, maitre_ouvrage, nature_projet, localisation, wilaya, montant_marche, date_debut, date_fin_prevue, duree_mois, statut, taux_avancement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['PRJ-2026-001', 'Construction du Centre Hospitalier Régional', 'Ministère de la Santé', 'Construction', 'Avenue Mohammed V', 'Rabat', 450000000, '2025-01-15', '2028-01-15', 36, 'En cours', 35]);
        this.run(`INSERT INTO projets (code_projet, intitule, maitre_ouvrage, nature_projet, localisation, wilaya, montant_marche, date_debut, date_fin_prevue, duree_mois, statut, taux_avancement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['PRJ-2026-002', 'Université Mohammed VI - Faculté des Sciences', 'Ministère de l\'Enseignement Supérieur', 'Construction', 'Zone Universitaire', 'Tanger', 280000000, '2025-06-01', '2027-12-01', 30, 'En cours', 18]);
        this.run(`INSERT INTO projets (code_projet, intitule, maitre_ouvrage, nature_projet, localisation, wilaya, montant_marche, date_debut, date_fin_prevue, duree_mois, statut, taux_avancement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['PRJ-2026-003', 'Stade Municipal - Mise à niveau', 'Commune Urbaine', 'Réhabilitation', 'Quartier Sportif', 'Marrakech', 120000000, '2026-03-01', '2027-09-01', 18, 'En préparation', 0]);

        // Insert demo intervenants
        this.run(`INSERT INTO intervenants (type_role, raison_sociale, contact_nom, contact_prenom, email, telephone, ville, specialite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Architecte', 'Cabinet Arch. Bennani & Associés', 'Bennani', 'Ahmed', 'a.bennani@cabinet-arch.ma', '+212 661 234 567', 'Rabat', 'Architecture hospitalière']);
        this.run(`INSERT INTO intervenants (type_role, raison_sociale, contact_nom, contact_prenom, email, telephone, ville, specialite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['BET', 'BETEC Ingénierie', 'El Fassi', 'Karim', 'k.elfassi@betec.ma', '+212 662 345 678', 'Casablanca', 'Structures béton armé']);
        this.run(`INSERT INTO intervenants (type_role, raison_sociale, contact_nom, contact_prenom, email, telephone, ville, specialite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['BCT', 'Bureau Véritas Maroc', 'Alami', 'Fatima', 'f.alami@bveritas.ma', '+212 663 456 789', 'Rabat', 'Contrôle technique construction']);
        this.run(`INSERT INTO intervenants (type_role, raison_sociale, contact_nom, contact_prenom, email, telephone, ville, specialite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Laboratoire', 'LPEE - Laboratoire Public', 'Tazi', 'Youssef', 'y.tazi@lpee.ma', '+212 664 567 890', 'Rabat', 'Essais béton et matériaux']);
        this.run(`INSERT INTO intervenants (type_role, raison_sociale, contact_nom, contact_prenom, email, telephone, ville, specialite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Topographe', 'GeoTopo Solutions', 'Mansouri', 'Hassan', 'h.mansouri@geotopo.ma', '+212 665 678 901', 'Rabat', 'Topographie et implantation']);
        this.run(`INSERT INTO intervenants (type_role, raison_sociale, contact_nom, contact_prenom, email, telephone, ville, specialite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Entreprise', 'TGCC - Travaux Généraux', 'Berrada', 'Omar', 'o.berrada@tgcc.ma', '+212 666 789 012', 'Casablanca', 'Gros œuvre et génie civil']);
        this.run(`INSERT INTO intervenants (type_role, raison_sociale, contact_nom, contact_prenom, email, telephone, ville, specialite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Entreprise', 'SNCE Électricité', 'Chaoui', 'Reda', 'r.chaoui@snce.ma', '+212 667 890 123', 'Rabat', 'Électricité courant fort/faible']);

        // Assign intervenants to project 1
        this.run(`INSERT INTO intervenants_projet (projet_id, intervenant_id, role_specifique) VALUES (?, ?, ?)`, [1, 1, 'Architecte principal']);
        this.run(`INSERT INTO intervenants_projet (projet_id, intervenant_id, role_specifique) VALUES (?, ?, ?)`, [1, 2, 'BET Structure']);
        this.run(`INSERT INTO intervenants_projet (projet_id, intervenant_id, role_specifique) VALUES (?, ?, ?)`, [1, 3, 'BCT Contrôle']);
        this.run(`INSERT INTO intervenants_projet (projet_id, intervenant_id, role_specifique) VALUES (?, ?, ?)`, [1, 4, 'Laboratoire essais']);
        this.run(`INSERT INTO intervenants_projet (projet_id, intervenant_id, role_specifique) VALUES (?, ?, ?)`, [1, 5, 'Topographe']);
        this.run(`INSERT INTO intervenants_projet (projet_id, intervenant_id, role_specifique) VALUES (?, ?, ?)`, [1, 6, 'Entreprise GO']);

        // Insert lots for project 1 (avec entreprises adjudicataires)
        this.run(`INSERT INTO lots (projet_id, code_lot, designation, nature, entreprise_id, montant, duree_jours, date_os_commencement, statut, taux_avancement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [1, 'LOT-01', 'Gros Œuvre et Étanchéité', 'Gros Œuvre & Étanchéité', 6, 280000000, 720, '2025-02-01', 'En cours', 42]);
        this.run(`INSERT INTO lots (projet_id, code_lot, designation, nature, entreprise_id, montant, duree_jours, date_os_commencement, statut, taux_avancement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [1, 'LOT-02', 'Électricité Courant Fort et Faible', 'Électricité', 7, 85000000, 600, '2025-06-01', 'En cours', 15]);
        this.run(`INSERT INTO lots (projet_id, code_lot, designation, nature, montant, duree_jours, statut, taux_avancement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [1, 'LOT-03', 'Plomberie et Fluides Médicaux', 'Fluides', 65000000, 540, 'En attente', 0]);
        this.run(`INSERT INTO lots (projet_id, code_lot, designation, nature, montant, duree_jours, statut, taux_avancement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [1, 'LOT-04', 'VRD et Aménagements Extérieurs', 'VRD', 35000000, 360, 'En attente', 0]);

        // Insert demo ouvrages for lot 1
        this.run(`INSERT INTO ouvrages (lot_id, designation, bloc, niveau, phase, statut, date_debut)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [1, 'Fondations superficielles Bloc A', 'Bloc A', 'Fondations', 'Fondations', 'Terminé', '2025-02-15']);
        this.run(`INSERT INTO ouvrages (lot_id, designation, bloc, niveau, phase, statut, date_debut)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [1, 'Poteaux et voiles RDC Bloc A', 'Bloc A', 'RDC', 'Superstructure', 'Terminé', '2025-04-01']);
        this.run(`INSERT INTO ouvrages (lot_id, designation, bloc, niveau, phase, statut, date_debut)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [1, 'Plancher haut RDC Bloc A', 'Bloc A', 'RDC', 'Superstructure', 'En validation', '2025-06-15']);
        this.run(`INSERT INTO ouvrages (lot_id, designation, bloc, niveau, phase, statut)
            VALUES (?, ?, ?, ?, ?, ?)`, [1, 'Poteaux et voiles 1er étage Bloc A', 'Bloc A', '1er Étage', 'Superstructure', 'Non commencé']);
        this.run(`INSERT INTO ouvrages (lot_id, designation, bloc, niveau, phase, statut, date_debut)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [1, 'Fondations Bloc B', 'Bloc B', 'Fondations', 'Fondations', 'En cours', '2025-07-01']);

        // Insert workflow steps for ouvrage 3 (Plancher haut RDC Bloc A - En validation)
        this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, statut, date_debut, date_fin, commentaire)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [3, 1, 'Déclaration achèvement', 'Entreprise', 'Terminé', '2026-07-20 09:00', '2026-07-20 09:00', 'Coffrage et ferraillage terminés']);
        this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, responsable_id, statut, date_debut, commentaire)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [3, 2, 'Vérification architecte', 'Architecte', 1, 'En cours', '2026-07-20 10:00', 'Vérification des réservations et alignement']);
        this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, responsable_id, statut, date_debut)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [3, 3, 'Attestation implantation', 'Topographe', 5, 'En cours', '2026-07-20 10:00']);
        this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, responsable_id, statut)
            VALUES (?, ?, ?, ?, ?, ?)`, [3, 4, 'Réception BET', 'BET', 2, 'En attente']);
        this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, responsable_id, statut)
            VALUES (?, ?, ?, ?, ?, ?)`, [3, 5, 'Contrôle BCT', 'BCT', 3, 'En attente']);
        this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, statut)
            VALUES (?, ?, ?, ?, ?)`, [3, 6, 'Synthèse avis', 'MOD', 'En attente']);
        this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, statut)
            VALUES (?, ?, ?, ?, ?)`, [3, 7, 'Déclaration bétonnage', 'Entreprise', 'En attente']);
        this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, responsable_id, statut)
            VALUES (?, ?, ?, ?, ?, ?)`, [3, 8, 'Essai 7 jours', 'Laboratoire', 4, 'En attente']);
        this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, responsable_id, statut)
            VALUES (?, ?, ?, ?, ?, ?)`, [3, 9, 'Essai 28 jours', 'Laboratoire', 4, 'En attente']);

        // Insert demo ordres de service
        this.run(`INSERT INTO ordres_service (lot_id, numero_os, type_os, objet, date_notification, date_effet, delai_jours)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [1, 'OS-001-2025', 'Commencement', 'Ordre de service de commencement des travaux - Lot GO', '2025-01-25', '2025-02-01', 720]);
        this.run(`INSERT INTO ordres_service (lot_id, numero_os, type_os, objet, date_notification, date_effet, delai_jours)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [2, 'OS-002-2025', 'Commencement', 'Ordre de service de commencement - Lot Électricité', '2025-05-20', '2025-06-01', 600]);

        // Insert demo sessions (mots de passe hachés via createSession)
        [
            [1, 'arch_bennani', 'arch2026'], [2, 'bet_betec', 'bet2026'], [3, 'bct_veritas', 'bct2026'],
            [4, 'labo_lpee', 'labo2026'], [5, 'topo_geotopo', 'topo2026'], [6, 'ent_tgcc', 'ent2026']
        ].forEach(([iid, user, pwd]) => this.createSession({ intervenant_id: iid, projet_id: 1, username: user, password_hash: pwd, must_change_pwd: 0 }));

        // Insert demo notifications
        this.run(`INSERT INTO notifications (destinataire_type, destinataire_id, projet_id, titre, message, type_notif)
            VALUES (?, ?, ?, ?, ?, ?)`, ['Architecte', 1, 1, 'Nouvelle déclaration', 'L\'entreprise TGCC a déclaré l\'achèvement du coffrage/ferraillage - Plancher haut RDC Bloc A', 'urgent']);
        this.run(`INSERT INTO notifications (destinataire_type, destinataire_id, projet_id, titre, message, type_notif)
            VALUES (?, ?, ?, ?, ?, ?)`, ['Topographe', 5, 1, 'Attestation requise', 'Attestation d\'implantation requise pour Plancher haut RDC Bloc A', 'alerte']);
        this.run(`INSERT INTO notifications (destinataire_type, projet_id, titre, message, type_notif)
            VALUES (?, ?, ?, ?, ?)`, ['MOD', 1, 'Avancement projet', 'Le taux d\'avancement du lot GO a atteint 42%', 'info']);

        console.log('Demo data seeded successfully');
    }

    // ---- Projets ----

    getAllProjets() {
        return this.all(`SELECT p.*, 
            (SELECT COUNT(*) FROM lots WHERE projet_id = p.id) as nb_lots,
            (SELECT COUNT(*) FROM intervenants_projet WHERE projet_id = p.id) as nb_intervenants
            FROM projets p ORDER BY p.created_at DESC`);
    }

    getProjet(id) {
        return this.get('SELECT * FROM projets WHERE id = ?', [id]);
    }

    createProjet(data) {
        return this.run(`INSERT INTO projets (code_projet, intitule, maitre_ouvrage, nature_projet, localisation, wilaya, montant_marche, date_debut, date_fin_prevue, duree_mois, statut)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.code_projet, data.intitule, data.maitre_ouvrage, data.nature_projet || 'Construction', data.localisation, data.wilaya, data.montant_marche || 0, data.date_debut, data.date_fin_prevue, data.duree_mois || 0, data.statut || 'En préparation']);
    }

    updateProjet(id, data) {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(data), id];
        return this.run(`UPDATE projets SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
    }

    // ---- Lots ----

    getLotsByProjet(projetId) {
        return this.all(`SELECT l.*, 
            i.raison_sociale as entreprise_nom,
            (SELECT COUNT(*) FROM ouvrages WHERE lot_id = l.id) as nb_ouvrages,
            (SELECT COUNT(*) FROM ordres_service WHERE lot_id = l.id) as nb_os
            FROM lots l
            LEFT JOIN intervenants i ON l.entreprise_id = i.id
            WHERE l.projet_id = ? ORDER BY l.code_lot`, [projetId]);
    }

    getLot(id) {
        return this.get(`SELECT l.*, i.raison_sociale as entreprise_nom
            FROM lots l LEFT JOIN intervenants i ON l.entreprise_id = i.id
            WHERE l.id = ?`, [id]);
    }

    createLot(data) {
        return this.run(`INSERT INTO lots (projet_id, code_lot, designation, nature, entreprise_id, montant, duree_jours, date_os_commencement, statut)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.code_lot, data.designation, data.nature, data.entreprise_id || null, data.montant || 0, data.duree_jours || 0, data.date_os_commencement || null, data.statut || 'En attente']);
    }

    // ---- Intervenants ----

    getAllIntervenants(typeRole) {
        if (typeRole) {
            return this.all('SELECT * FROM intervenants WHERE type_role = ? AND id > 0 ORDER BY raison_sociale', [typeRole]);
        }
        return this.all('SELECT * FROM intervenants WHERE id > 0 ORDER BY type_role, raison_sociale');
    }

    getIntervenant(id) {
        return this.get('SELECT * FROM intervenants WHERE id = ?', [id]);
    }

    setIntervenantAvatar(id, filename) {
        return this.run('UPDATE intervenants SET avatar = ? WHERE id = ?', [filename, id]);
    }

    createIntervenant(data) {
        return this.run(`INSERT INTO intervenants (type_role, raison_sociale, contact_nom, contact_prenom, email, telephone, adresse, ville, specialite, numero_agrement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.type_role, data.raison_sociale, data.contact_nom, data.contact_prenom, data.email, data.telephone, data.adresse, data.ville, data.specialite, data.numero_agrement]);
    }

    getIntervenantsByProjet(projetId) {
        return this.all(`SELECT i.*, ip.role_specifique, ip.lot_id, ip.actif as affectation_active
            FROM intervenants i
            JOIN intervenants_projet ip ON i.id = ip.intervenant_id
            WHERE ip.projet_id = ? ORDER BY i.type_role`, [projetId]);
    }

    // ---- Sessions ----

    // Hache un mot de passe (bcrypt). Renvoie le clair inchangé s'il est déjà haché.
    _hashPassword(pwd) {
        if (typeof pwd === 'string' && pwd.startsWith('$2')) return pwd;
        return bcrypt.hashSync(pwd, 10);
    }

    createSession(data) {
        const hash = this._hashPassword(data.password_hash);
        const mcp = data.must_change_pwd != null ? (data.must_change_pwd ? 1 : 0) : 1; // par défaut : forcer le changement
        return this.run(`INSERT INTO sessions (intervenant_id, projet_id, username, password_hash, actif, must_change_pwd)
            VALUES (?, ?, ?, ?, 1, ?)`, [data.intervenant_id, data.projet_id, data.username, hash, mcp]);
    }

    // Met à jour (réinitialise) le mot de passe d'une session → force le changement à la prochaine connexion
    updateSessionPassword(id, newPassword) {
        return this.run('UPDATE sessions SET password_hash = ?, must_change_pwd = 1 WHERE id = ?', [this._hashPassword(newPassword), id]);
    }
    // Changement de mot de passe par l'intervenant lui-même (lève le forçage)
    setOwnPassword(username, newPassword) {
        const s = this.get('SELECT id FROM sessions WHERE username = ? AND actif = 1', [username]);
        if (!s) return { success: false, error: 'Session introuvable.' };
        this.run('UPDATE sessions SET password_hash = ?, must_change_pwd = 0 WHERE id = ?', [this._hashPassword(newPassword), s.id]);
        this.logEvent({ acteur_type: 'Intervenant', action: 'Mot de passe modifié (self-service)', cible_type: 'session', cible_id: s.id });
        return { success: true };
    }

    // ---- Équipe MOD (comptes nominatifs) ----
    createModUser(data) {
        const hash = this._hashPassword(data.password);
        return this.run(`INSERT INTO mod_users (nom, fonction, username, password_hash, actif) VALUES (?, ?, ?, ?, 1)`,
            [data.nom, data.fonction || null, data.username, hash]);
    }
    getModUsers() {
        return this.all('SELECT id, nom, fonction, username, actif, derniere_connexion, date_creation FROM mod_users ORDER BY nom');
    }
    updateModUser(id, data) {
        return this._updateRow('mod_users', id, { nom: data.nom, fonction: data.fonction, username: data.username });
    }
    updateModUserPassword(id, pwd) {
        return this.run('UPDATE mod_users SET password_hash = ? WHERE id = ?', [this._hashPassword(pwd), id]);
    }
    toggleModUser(id, actif) { return this.run('UPDATE mod_users SET actif = ? WHERE id = ?', [actif ? 1 : 0, id]); }
    deleteModUser(id) { return this._deleteRow('mod_users', id); }

    authenticate(username, password) {
        // MOD admin login (compte principal)
        if (username === 'admin' && password === 'admin2026') {
            this.logEvent({ acteur_type: 'MOD', acteur_id: 0, action: 'Connexion', cible_type: 'session', details: 'Connexion administrateur MOD' });
            return { role: 'MOD', intervenant_id: 0, projet_id: null, is_admin: true, nom: 'Administrateur MOD', fonction: "Maître d'Ouvrage Délégué", raison_sociale: 'ANEP - MOD' };
        }
        // Équipe MOD (comptes nominatifs)
        const mu = this.get('SELECT * FROM mod_users WHERE username = ? AND actif = 1', [username]);
        if (mu) {
            const stored = mu.password_hash || '';
            const ok = stored.startsWith('$2') ? bcrypt.compareSync(password, stored) : (stored === password);
            if (ok) {
                this.run('UPDATE mod_users SET derniere_connexion = CURRENT_TIMESTAMP WHERE id = ?', [mu.id]);
                this.logEvent({ acteur_type: 'MOD', acteur_id: 0, action: 'Connexion', cible_type: 'mod_user', cible_id: mu.id, details: 'Équipe MOD : ' + mu.nom + ' (' + (mu.fonction || '') + ')' });
                return { role: 'MOD', intervenant_id: 0, projet_id: null, is_admin: false, mod_user_id: mu.id, nom: mu.nom, fonction: mu.fonction, raison_sociale: mu.nom };
            }
        }
        const session = this.get(`SELECT s.*, i.type_role, i.raison_sociale, i.contact_nom, i.avatar
            FROM sessions s JOIN intervenants i ON s.intervenant_id = i.id
            WHERE s.username = ? AND s.actif = 1`, [username]);
        if (session) {
            const stored = session.password_hash || '';
            let ok = false;
            if (stored.startsWith('$2')) {
                ok = bcrypt.compareSync(password, stored);
            } else {
                // Ancien mot de passe en clair (legacy) → vérifier puis migrer en haché
                ok = stored === password;
                if (ok) this.run('UPDATE sessions SET password_hash = ? WHERE id = ?', [this._hashPassword(password), session.id]);
            }
            if (ok) {
                this.run('UPDATE sessions SET derniere_connexion = CURRENT_TIMESTAMP WHERE id = ?', [session.id]);
                this.logEvent({ acteur_type: session.type_role, acteur_id: session.intervenant_id, projet_id: session.projet_id, action: 'Connexion', cible_type: 'session', details: `Connexion ${session.raison_sociale}` });
                return { role: session.type_role, intervenant_id: session.intervenant_id, projet_id: session.projet_id, raison_sociale: session.raison_sociale, contact_nom: session.contact_nom, avatar: session.avatar, username: session.username, must_change_pwd: session.must_change_pwd ? 1 : 0 };
            }
        }
        return null;
    }

    getSessionsByProjet(projetId) {
        return this.all(`SELECT s.*, i.type_role, i.raison_sociale, i.contact_nom
            FROM sessions s JOIN intervenants i ON s.intervenant_id = i.id
            WHERE s.projet_id = ? ORDER BY i.type_role`, [projetId]);
    }

    getAllSessions() {
        return this.all(`SELECT s.*, i.type_role, i.raison_sociale, i.contact_nom, p.intitule as projet_intitule
            FROM sessions s 
            JOIN intervenants i ON s.intervenant_id = i.id
            JOIN projets p ON s.projet_id = p.id
            ORDER BY p.intitule, i.type_role`);
    }

    toggleSession(id, actif) {
        return this.run('UPDATE sessions SET actif = ? WHERE id = ?', [actif ? 1 : 0, id]);
    }

    // ---- Ouvrages ----

    getOuvragesByLot(lotId) {
        return this.all('SELECT * FROM ouvrages WHERE lot_id = ? ORDER BY id', [lotId]);
    }

    getOuvragesByProjet(projetId) {
        return this.all(`SELECT o.*, l.code_lot, l.designation as lot_designation
            FROM ouvrages o JOIN lots l ON o.lot_id = l.id
            WHERE l.projet_id = ? ORDER BY l.code_lot, o.id`, [projetId]);
    }

    getOuvrage(id) {
        return this.get(`SELECT o.*, l.code_lot, l.designation as lot_designation, l.projet_id
            FROM ouvrages o JOIN lots l ON o.lot_id = l.id WHERE o.id = ?`, [id]);
    }

    createOuvrage(data) {
        const res = this.run(`INSERT INTO ouvrages (lot_id, designation, bloc, niveau, phase, description, statut)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [data.lot_id, data.designation, data.bloc, data.niveau, data.phase, data.description, data.statut || 'Non commencé']);
        // Auto-créer l'étape 1 (Déclaration d'achèvement) pour l'entreprise du lot
        const ouvrageId = res.lastInsertRowid;
        const lot = this.get('SELECT entreprise_id FROM lots WHERE id = ?', [data.lot_id]);
        this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, responsable_id, statut)
            VALUES (?, 1, 'Déclaration achèvement', 'Entreprise', ?, 'En attente')`,
            [ouvrageId, lot ? lot.entreprise_id : null]);
        return res;
    }

    updateOuvrageStatut(id, statut) {
        return this.run('UPDATE ouvrages SET statut = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [statut, id]);
    }

    // ---- Workflow ----

    getWorkflowByOuvrage(ouvrageId) {
        return this.all(`SELECT we.*, i.raison_sociale as responsable_nom
            FROM workflow_etapes we
            LEFT JOIN intervenants i ON we.responsable_id = i.id
            WHERE we.ouvrage_id = ? ORDER BY we.etape_numero`, [ouvrageId]);
    }

    createWorkflowEtape(data) {
        return this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, responsable_id, statut, date_debut, commentaire)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.ouvrage_id, data.etape_numero, data.type_etape, data.responsable_type, data.responsable_id || null, data.statut || 'En attente', data.date_debut || null, data.commentaire || null]);
    }

    updateEtapeStatut(id, statut, commentaire) {
        if (commentaire) {
            return this.run('UPDATE workflow_etapes SET statut = ?, commentaire = ?, date_fin = CURRENT_TIMESTAMP WHERE id = ?', [statut, commentaire, id]);
        }
        return this.run('UPDATE workflow_etapes SET statut = ?, date_fin = CURRENT_TIMESTAMP WHERE id = ?', [statut, id]);
    }

    getEtapesPendingForRole(role, intervenantId) {
        let sql = `SELECT we.*, o.designation as ouvrage_nom, o.bloc, o.niveau, o.id as ouvrage_id, l.code_lot, p.intitule as projet_nom, p.id as projet_id
            FROM workflow_etapes we
            JOIN ouvrages o ON we.ouvrage_id = o.id
            JOIN lots l ON o.lot_id = l.id
            JOIN projets p ON l.projet_id = p.id
            WHERE we.responsable_type = ? AND we.statut IN ('En attente', 'En cours')`;
        const params = [role];
        if (intervenantId) {
            sql += ' AND we.responsable_id = ?';
            params.push(intervenantId);
        }
        sql += ' ORDER BY we.created_at';
        return this.all(sql, params);
    }

    // ---- Avis ----

    getAvisByEtape(etapeId) {
        return this.all(`SELECT a.*, i.raison_sociale, i.type_role
            FROM avis a JOIN intervenants i ON a.intervenant_id = i.id
            WHERE a.etape_id = ? ORDER BY a.date_avis`, [etapeId]);
    }

    createAvis(data) {
        const res = this.run(`INSERT INTO avis (etape_id, intervenant_id, type_avis, contenu, details_verification)
            VALUES (?, ?, ?, ?, ?)`,
            [data.etape_id, data.intervenant_id, data.type_avis, data.contenu, data.details_verification]);
        const inter = this.getIntervenant(data.intervenant_id);
        this.logEvent({ acteur_type: inter ? inter.type_role : null, acteur_id: data.intervenant_id, action: 'Avis émis',
            cible_type: 'etape', cible_id: data.etape_id, details: `Avis « ${data.type_avis} »${data.contenu ? ' : ' + data.contenu : ''}` });
        return res;
    }

    // ---- Réserves ----

    getReservesByOuvrage(ouvrageId) {
        return this.all(`SELECT r.*, i.raison_sociale as emetteur_nom, i.type_role as emetteur_type
            FROM reserves r JOIN intervenants i ON r.emetteur_id = i.id
            WHERE r.ouvrage_id = ? ORDER BY r.date_emission DESC`, [ouvrageId]);
    }

    getReservesOuvertes(projetId) {
        let sql = `SELECT r.*, i.raison_sociale as emetteur_nom, o.designation as ouvrage_nom, o.bloc, o.niveau
            FROM reserves r
            JOIN intervenants i ON r.emetteur_id = i.id
            JOIN ouvrages o ON r.ouvrage_id = o.id
            JOIN lots l ON o.lot_id = l.id
            WHERE r.statut IN ('Ouverte', 'En cours de levée')`;
        const params = [];
        if (projetId) {
            sql += ` AND l.projet_id = ?`;
            params.push(projetId);
        }
        sql += ' ORDER BY r.date_emission';
        return this.all(sql, params);
    }

    createReserve(data) {
        const res = this.run(`INSERT INTO reserves (etape_id, ouvrage_id, emetteur_id, description, localisation_reserve, gravite)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [data.etape_id || null, data.ouvrage_id, data.emetteur_id, data.description, data.localisation_reserve, data.gravite || 'Moyenne']);
        const inter = this.getIntervenant(data.emetteur_id);
        this.logEvent({ acteur_type: inter ? inter.type_role : null, acteur_id: data.emetteur_id, action: 'Réserve émise',
            cible_type: 'ouvrage', cible_id: data.ouvrage_id, details: `[${data.gravite || 'Moyenne'}] ${data.description}` });
        return res;
    }

    leverReserve(id, commentaire) {
        const reserve = this.get('SELECT * FROM reserves WHERE id = ?', [id]);
        const res = this.run('UPDATE reserves SET statut = ?, date_levee = CURRENT_TIMESTAMP, commentaire_levee = ? WHERE id = ?', ['Levée', commentaire, id]);
        if (reserve) this.logEvent({ acteur_type: 'Entreprise', action: 'Réserve levée', cible_type: 'ouvrage', cible_id: reserve.ouvrage_id, details: commentaire || 'Réserve levée' });
        return res;
    }

    // ---- Ordres de Service ----

    getOSByLot(lotId) {
        return this.all('SELECT * FROM ordres_service WHERE lot_id = ? ORDER BY date_notification', [lotId]);
    }

    getOSByProjet(projetId) {
        return this.all(`SELECT os.*, l.code_lot, l.designation as lot_designation,
            osl.numero_os as os_lie_numero, ll.code_lot as os_lie_lot,
            (SELECT COUNT(*) FROM documents dd WHERE dd.entite_type = 'os' AND dd.entite_id = os.id) as nb_pieces
            FROM ordres_service os JOIN lots l ON os.lot_id = l.id
            LEFT JOIN ordres_service osl ON os.os_lie_id = osl.id
            LEFT JOIN lots ll ON osl.lot_id = ll.id
            WHERE l.projet_id = ? ORDER BY os.date_notification DESC`, [projetId]);
    }

    // Générateur d'axe de délai : extrait OS + décomptes pour déduire le délai restant (par lot + projet)
    getDelaiAxis(projetId) {
        const toDate = s => s ? new Date(String(s).slice(0, 10) + 'T00:00:00Z') : null;
        const daysBetween = (a, b) => Math.round((b - a) / 86400000);
        const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
        const fmt = d => d ? d.toISOString().slice(0, 10) : null;
        const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
        const lots = this.all('SELECT id, code_lot, designation FROM lots WHERE projet_id = ? ORDER BY code_lot', [projetId]);
        const out = { projetId, today: fmt(today), lots: [] };
        for (const lot of lots) {
            const os = this.all('SELECT * FROM ordres_service WHERE lot_id = ? ORDER BY date_effet, id', [lot.id]);
            const decs = this.all("SELECT numero, date_decompte, montant_net_a_payer, statut, date_ordonnancement, date_paiement FROM decomptes WHERE lot_id = ? ORDER BY date_decompte, id", [lot.id]);
            const commence = os.find(o => o.type_os === 'Commencement' && o.date_effet);
            if (!commence) { out.lots.push({ id: lot.id, code_lot: lot.code_lot, designation: lot.designation, hasData: false }); continue; }
            const debut = toDate(commence.date_effet);
            const baseDelai = commence.delai_jours || 0;
            const prolong = os.filter(o => o.type_os === 'Prolongation').reduce((s, o) => s + (o.delai_jours || 0), 0);
            // Périodes d'arrêt (Arrêt → Reprise) : décalent la date de fin
            let suspended = 0; const arrets = [];
            const ar = os.filter(o => ['Arrêt', 'Reprise'].includes(o.type_os) && o.date_effet).sort((a, b) => String(a.date_effet).localeCompare(String(b.date_effet)));
            let open = null;
            for (const o of ar) {
                if (o.type_os === 'Arrêt') { if (!open) open = toDate(o.date_effet); }
                else if (o.type_os === 'Reprise' && open) { const d = daysBetween(open, toDate(o.date_effet)); if (d > 0) { suspended += d; arrets.push({ debut: fmt(open), fin: fmt(toDate(o.date_effet)), jours: d }); } open = null; }
            }
            if (open) { const d = daysBetween(open, today); if (d > 0) { suspended += d; arrets.push({ debut: fmt(open), fin: null, jours: d, enCours: true }); } }
            const resilie = os.find(o => o.type_os === 'Résiliation' && o.date_effet);
            const delaiContractuel = baseDelai + prolong;
            const finPrev = addDays(debut, delaiContractuel + suspended);
            const ecoulesNet = Math.max(0, daysBetween(debut, today) - suspended);
            const restant = daysBetween(today, finPrev);
            const pct = delaiContractuel > 0 ? Math.min(100, Math.round(ecoulesNet / delaiContractuel * 100)) : 0;
            const totalPaye = decs.filter(d => d.statut === 'Payé').reduce((s, d) => s + (d.montant_net_a_payer || 0), 0);
            const dernierPaye = decs.filter(d => d.date_paiement).sort((a, b) => String(b.date_paiement).localeCompare(String(a.date_paiement)))[0] || null;
            out.lots.push({
                id: lot.id, code_lot: lot.code_lot, designation: lot.designation, hasData: true,
                debut: fmt(debut), baseDelai, prolong, suspended, arrets,
                delaiContractuel, finPrev: fmt(finPrev), ecoulesNet, restant, pct,
                enRetard: !resilie && restant < 0, resilie: resilie ? fmt(toDate(resilie.date_effet)) : null,
                nbDecomptes: decs.length, totalPaye, dernierPaiement: dernierPaye ? dernierPaye.date_paiement : null,
                events: [
                    { date: fmt(debut), label: 'Commencement', type: 'os' },
                    ...os.filter(o => o.type_os !== 'Commencement' && o.date_effet).map(o => ({ date: fmt(toDate(o.date_effet)), label: o.type_os + ' (' + o.numero_os + ')', type: 'os' })),
                    ...decs.filter(d => d.date_decompte).map(d => ({ date: fmt(toDate(d.date_decompte)), label: 'Décompte ' + d.numero + (d.statut === 'Payé' ? ' payé' : ''), type: 'decompte', statut: d.statut })),
                    { date: fmt(finPrev), label: 'Fin prévisionnelle', type: 'fin' }
                ].filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date))
            });
        }
        return out;
    }

    // Lots dépendants (cibles) d'un lot source, via les interfaces déclarées
    getDependentLots(lotId) {
        return this.all(`SELECT DISTINCT lc.id, lc.code_lot, lc.designation, li.type_interface
            FROM lot_interfaces li JOIN lots lc ON li.lot_cible_id = lc.id
            WHERE li.lot_source_id = ? ORDER BY lc.code_lot`, [lotId]);
    }

    createOS(data) {
        const res = this.run(`INSERT INTO ordres_service (lot_id, numero_os, type_os, objet, date_notification, date_effet, delai_jours, date_fin_effet, motif, observations, os_lie_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.lot_id, data.numero_os, data.type_os, data.objet, data.date_notification, data.date_effet, data.delai_jours || 0, data.date_fin_effet || null, data.motif, data.observations, data.os_lie_id || null]);
        const lot = this.get('SELECT projet_id FROM lots WHERE id = ?', [data.lot_id]);
        this.logEvent({ acteur_type: 'MOD', action: `OS ${data.type_os} émis`, cible_type: 'os', cible_id: res.lastInsertRowid, projet_id: lot && lot.projet_id, details: `${data.numero_os} — ${data.objet}` });
        return res;
    }

    // ---- Essais Labo ----

    getEssaisByOuvrage(ouvrageId) {
        return this.all(`SELECT el.*, i.raison_sociale as labo_nom
            FROM essais_labo el JOIN intervenants i ON el.labo_id = i.id
            WHERE el.ouvrage_id = ? ORDER BY el.date_prelevement DESC`, [ouvrageId]);
    }

    getEssaisEnCours(laboId) {
        let sql = `SELECT el.*, o.designation as ouvrage_nom, o.bloc, o.niveau, l.code_lot, p.intitule as projet_nom
            FROM essais_labo el
            JOIN ouvrages o ON el.ouvrage_id = o.id
            JOIN lots l ON o.lot_id = l.id
            JOIN projets p ON l.projet_id = p.id
            WHERE el.conformite = 'En attente' OR el.conformite IS NULL`;
        const params = [];
        if (laboId) {
            sql += ` AND el.labo_id = ?`;
            params.push(laboId);
        }
        sql += ' ORDER BY el.date_echeance_7j';
        return this.all(sql, params);
    }

    createEssai(data) {
        const date7j = new Date(data.date_prelevement);
        date7j.setDate(date7j.getDate() + 7);
        const date28j = new Date(data.date_prelevement);
        date28j.setDate(date28j.getDate() + 28);

        return this.run(`INSERT INTO essais_labo (ouvrage_id, labo_id, type_essai, reference_prelevement, date_prelevement, date_echeance_7j, date_echeance_28j, valeur_cible, unite, norme_reference, conformite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En attente')`,
            [data.ouvrage_id, data.labo_id, data.type_essai, data.reference_prelevement, data.date_prelevement, date7j.toISOString().split('T')[0], date28j.toISOString().split('T')[0], data.valeur_cible || null, data.unite || 'MPa', data.norme_reference]);
    }

    updateEssaiResultat(id, data) {
        this.run(`UPDATE essais_labo SET resultat_7j = ?, resultat_28j = ?, conformite = ?, observations = ? WHERE id = ?`,
            [data.resultat_7j ?? null, data.resultat_28j ?? null, data.conformite, data.observations, id]);
        // Faire avancer le workflow selon les résultats
        const essai = this.get('SELECT * FROM essais_labo WHERE id = ?', [id]);
        if (essai) {
            const ouvrage = this.getOuvrage(essai.ouvrage_id);
            if (data.resultat_7j !== null && data.resultat_7j !== undefined && data.resultat_7j !== '') {
                this.run(`UPDATE workflow_etapes SET statut='Terminé', date_fin=CURRENT_TIMESTAMP WHERE ouvrage_id=? AND type_etape='Essai 7 jours'`, [essai.ouvrage_id]);
            }
            if (data.conformite === 'Conforme' && data.resultat_28j !== null && data.resultat_28j !== undefined && data.resultat_28j !== '') {
                this.run(`UPDATE workflow_etapes SET statut='Terminé', date_fin=CURRENT_TIMESTAMP WHERE ouvrage_id=? AND type_etape='Essai 28 jours'`, [essai.ouvrage_id]);
                this._upsertStep(essai.ouvrage_id, 'Clôture', 'MOD', null, 'Terminé', 10);
                this.updateOuvrageStatut(essai.ouvrage_id, 'Terminé');
                if (ouvrage) this.createNotification({ destinataire_type: 'MOD', projet_id: ouvrage.projet_id, titre: 'Ouvrage clôturé', message: `${ouvrage.designation} : essais conformes (28j). Ouvrage terminé.`, type_notif: 'succes' });
            } else if (data.conformite === 'Non conforme') {
                if (ouvrage) this.createNotification({ destinataire_type: 'MOD', projet_id: ouvrage.projet_id, titre: 'Essai NON CONFORME', message: `${ouvrage.designation} : résultats non conformes. Décision requise.`, type_notif: 'urgent' });
            }
        }
        return { success: true };
    }

    // ============================================================
    // MOTEUR DE WORKFLOW (automatisation de l'enchaînement)
    // ============================================================

    // Retourne l'intervenant d'un rôle affecté à un projet
    getProjetIntervenantByRole(projetId, role) {
        return this.get(`SELECT i.id, i.raison_sociale, i.email, i.telephone
            FROM intervenants_projet ip JOIN intervenants i ON ip.intervenant_id = i.id
            WHERE ip.projet_id = ? AND i.type_role = ? AND COALESCE(ip.actif, 1) = 1
            ORDER BY ip.id LIMIT 1`, [projetId, role]);
    }

    // Crée ou met à jour une étape de workflow (idempotent)
    _upsertStep(ouvrageId, type, role, respId, statut, num) {
        const existing = this.get('SELECT id FROM workflow_etapes WHERE ouvrage_id = ? AND type_etape = ?', [ouvrageId, type]);
        if (existing) {
            this.run(`UPDATE workflow_etapes SET statut=?, responsable_type=?, responsable_id=?, date_debut=COALESCE(date_debut, CURRENT_TIMESTAMP) WHERE id=?`,
                [statut, role, respId, existing.id]);
            return existing.id;
        }
        const res = this.run(`INSERT INTO workflow_etapes (ouvrage_id, etape_numero, type_etape, responsable_type, responsable_id, statut, date_debut)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [ouvrageId, num, type, role, respId, statut]);
        return res.lastInsertRowid;
    }

    // ÉTAPE 1→2 : l'entreprise déclare l'achèvement → fan-out des réceptions
    declareAchievement(ouvrageId, commentaire) {
        const ouvrage = this.getOuvrage(ouvrageId);
        if (!ouvrage) return { error: 'Ouvrage introuvable' };
        const projetId = ouvrage.projet_id;
        const lot = this.get('SELECT entreprise_id FROM lots WHERE id = ?', [ouvrage.lot_id]);
        const entrepriseId = lot ? lot.entreprise_id : null;

        // Clôturer la déclaration
        this._upsertStep(ouvrageId, 'Déclaration achèvement', 'Entreprise', entrepriseId, 'Terminé', 1);
        this.run(`UPDATE workflow_etapes SET date_fin=CURRENT_TIMESTAMP, commentaire=? WHERE ouvrage_id=? AND type_etape='Déclaration achèvement'`,
            [commentaire || 'Coffrage et ferraillage terminés', ouvrageId]);

        // Créer/activer les réceptions parallèles pour les rôles présents dans le projet
        const receptions = [
            { type: 'Vérification architecte', role: 'Architecte', num: 2 },
            { type: 'Attestation implantation', role: 'Topographe', num: 3 },
            { type: 'Réception BET', role: 'BET', num: 4 },
            { type: 'Contrôle BCT', role: 'BCT', num: 5 }
        ];
        let created = 0;
        for (const r of receptions) {
            const inter = this.getProjetIntervenantByRole(projetId, r.role);
            if (!inter) continue;
            this._upsertStep(ouvrageId, r.type, r.role, inter.id, 'En cours', r.num);
            this.createNotification({ destinataire_type: r.role, destinataire_id: inter.id, projet_id: projetId,
                titre: 'Nouvelle mission de réception',
                message: `Réception requise : ${ouvrage.designation} (${ouvrage.bloc || ''} ${ouvrage.niveau || ''}) — ${r.type}`,
                type_notif: 'urgent' });
            created++;
        }

        this.updateOuvrageStatut(ouvrageId, 'En validation');
        this.createNotification({ destinataire_type: 'MOD', projet_id: projetId, titre: "Déclaration d'achèvement",
            message: `L'entreprise a déclaré l'achèvement de : ${ouvrage.designation}. ${created} réception(s) en cours.`, type_notif: 'info' });
        this.logEvent({ acteur_type: 'Entreprise', acteur_id: entrepriseId, action: "Déclaration d'achèvement",
            cible_type: 'ouvrage', cible_id: ouvrageId, projet_id: projetId, details: `${ouvrage.designation} — ${created} réception(s) déclenchée(s)` });
        return { success: true, receptions: created };
    }

    // ÉTAPE 2→3 : après chaque avis, vérifier si on peut débloquer le bétonnage
    advanceWorkflow(ouvrageId) {
        const ouvrage = this.getOuvrage(ouvrageId);
        if (!ouvrage) return {};
        const projetId = ouvrage.projet_id;
        const steps = this.all(`SELECT * FROM workflow_etapes WHERE ouvrage_id = ?
            AND type_etape IN ('Vérification architecte','Attestation implantation','Réception BET','Contrôle BCT')`, [ouvrageId]);
        if (steps.length === 0) return { status: 'none' };

        const pending = steps.filter(s => ['En attente', 'En cours'].includes(s.statut));
        if (pending.length > 0) return { status: 'pending', remaining: pending.length };

        const defavorable = steps.filter(s => s.statut === 'Défavorable');
        const openReserves = this.getScalar(`SELECT COUNT(*) FROM reserves WHERE ouvrage_id=? AND statut IN ('Ouverte','En cours de levée')`, [ouvrageId]);

        const lot = this.get('SELECT entreprise_id FROM lots WHERE id = ?', [ouvrage.lot_id]);
        if (defavorable.length > 0 || openReserves > 0) {
            this.updateOuvrageStatut(ouvrageId, 'En cours');
            if (lot && lot.entreprise_id) this.createNotification({ destinataire_type: 'Entreprise', destinataire_id: lot.entreprise_id, projet_id: projetId,
                titre: 'Réserves / avis défavorable', message: `Le bétonnage de ${ouvrage.designation} est bloqué (${openReserves} réserve(s), ${defavorable.length} avis défavorable(s)). Veuillez lever les réserves.`, type_notif: 'alerte' });
            return { status: 'blocked' };
        }

        // Tous favorables → synthèse MOD + déblocage bétonnage
        this._upsertStep(ouvrageId, 'Synthèse avis', 'MOD', null, 'Terminé', 6);
        this._upsertStep(ouvrageId, 'Déclaration bétonnage', 'Entreprise', lot ? lot.entreprise_id : null, 'En cours', 7);
        this.updateOuvrageStatut(ouvrageId, 'Validé');
        if (lot && lot.entreprise_id) this.createNotification({ destinataire_type: 'Entreprise', destinataire_id: lot.entreprise_id, projet_id: projetId,
            titre: 'Bétonnage autorisé ✅', message: `Avis favorables obtenus pour ${ouvrage.designation}. Vous pouvez déclarer la date de bétonnage.`, type_notif: 'succes' });
        this.createNotification({ destinataire_type: 'MOD', projet_id: projetId, titre: 'Ouvrage validé', message: `${ouvrage.designation} : tous les avis favorables — bétonnage autorisé.`, type_notif: 'succes' });
        this.logEvent({ acteur_type: 'MOD', action: 'Ouvrage validé', cible_type: 'ouvrage', cible_id: ouvrageId, projet_id: projetId, details: `${ouvrage.designation} — bétonnage autorisé` });
        return { status: 'validated' };
    }

    // ÉTAPE 7→8 : l'entreprise déclare le bétonnage → création auto des essais labo
    declareBetonnage(ouvrageId, data = {}) {
        const ouvrage = this.getOuvrage(ouvrageId);
        if (!ouvrage) return { error: 'Ouvrage introuvable' };
        const projetId = ouvrage.projet_id;

        this._upsertStep(ouvrageId, 'Déclaration bétonnage', 'Entreprise', null, 'Terminé', 7);
        this.run(`UPDATE workflow_etapes SET date_fin=CURRENT_TIMESTAMP, commentaire=? WHERE ouvrage_id=? AND type_etape='Déclaration bétonnage'`,
            [data.commentaire || ('Bétonnage réalisé le ' + (data.date_betonnage || '')), ouvrageId]);
        this.updateOuvrageStatut(ouvrageId, 'Bétonné');

        const labo = this.getProjetIntervenantByRole(projetId, 'Laboratoire');
        if (labo) {
            const datePrel = data.date_betonnage || new Date().toISOString().split('T')[0];
            this.createEssai({ ouvrage_id: ouvrageId, labo_id: labo.id, type_essai: 'Résistance béton',
                reference_prelevement: data.reference || ('BET-' + ouvrageId + '-' + datePrel), date_prelevement: datePrel,
                valeur_cible: data.valeur_cible || 25, unite: 'MPa', norme_reference: data.norme || 'NM 10.1.008' });
            this._upsertStep(ouvrageId, 'Essai 7 jours', 'Laboratoire', labo.id, 'En cours', 8);
            this._upsertStep(ouvrageId, 'Essai 28 jours', 'Laboratoire', labo.id, 'En attente', 9);
            this.updateOuvrageStatut(ouvrageId, 'Essais en cours');
            this.createNotification({ destinataire_type: 'Laboratoire', destinataire_id: labo.id, projet_id: projetId,
                titre: 'Prélèvement à contrôler', message: `Bétonnage déclaré pour ${ouvrage.designation}. Essais 7j / 28j à réaliser dans les délais.`, type_notif: 'urgent' });
        }
        this.createNotification({ destinataire_type: 'MOD', projet_id: projetId, titre: 'Bétonnage effectué',
            message: `${ouvrage.designation} bétonné. Contrôle qualité laboratoire en cours.`, type_notif: 'info' });
        this.logEvent({ acteur_type: 'Entreprise', action: 'Bétonnage déclaré', cible_type: 'ouvrage', cible_id: ouvrageId, projet_id: projetId, details: `${ouvrage.designation} le ${data.date_betonnage || ''}${labo ? ' — essais labo créés' : ''}` });
        return { success: true, essais: labo ? 1 : 0 };
    }

    getReunion(id) {
        return this.get('SELECT * FROM reunions WHERE id = ?', [id]);
    }

    // ---- Réunions ----

    getReunionsByProjet(projetId) {
        return this.all(`SELECT r.*, 
            (SELECT COUNT(*) FROM invitations WHERE reunion_id = r.id) as nb_invites,
            (SELECT COUNT(*) FROM invitations WHERE reunion_id = r.id AND statut = 'Confirmée') as nb_confirmes
            FROM reunions r WHERE r.projet_id = ? ORDER BY r.date_reunion DESC`, [projetId]);
    }

    createReunion(data) {
        return this.run(`INSERT INTO reunions (projet_id, numero_reunion, type_reunion, date_reunion, lieu, ordre_jour)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.numero_reunion, data.type_reunion || 'Ordinaire', data.date_reunion, data.lieu, data.ordre_jour]);
    }

    createInvitation(data) {
        return this.run(`INSERT INTO invitations (reunion_id, intervenant_id, moyen_envoi)
            VALUES (?, ?, ?)`, [data.reunion_id, data.intervenant_id, data.moyen_envoi || 'Email']);
    }

    getInvitationsByReunion(reunionId) {
        return this.all(`SELECT inv.*, i.raison_sociale, i.contact_nom, i.email, i.telephone, i.type_role
            FROM invitations inv JOIN intervenants i ON inv.intervenant_id = i.id
            WHERE inv.reunion_id = ? ORDER BY i.type_role`, [reunionId]);
    }

    // ---- Notifications ----

    getNotifications(role, intervenantId) {
        let sql = 'SELECT * FROM notifications WHERE destinataire_type = ?';
        const params = [role];
        if (intervenantId) {
            sql += ' AND (destinataire_id = ? OR destinataire_id IS NULL)';
            params.push(intervenantId);
        }
        sql += ' ORDER BY created_at DESC LIMIT 50';
        return this.all(sql, params);
    }

    markNotificationRead(id) {
        return this.run('UPDATE notifications SET lue = 1 WHERE id = ?', [id]);
    }

    getUnreadCount(role, intervenantId) {
        let sql = 'SELECT COUNT(*) as count FROM notifications WHERE destinataire_type = ? AND lue = 0';
        const params = [role];
        if (intervenantId) {
            sql += ' AND (destinataire_id = ? OR destinataire_id IS NULL)';
            params.push(intervenantId);
        }
        return this.getScalar(sql, params);
    }

    createNotification(data) {
        return this.run(`INSERT INTO notifications (destinataire_type, destinataire_id, projet_id, titre, message, type_notif, lien)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [data.destinataire_type, data.destinataire_id || null, data.projet_id || null, data.titre, data.message, data.type_notif || 'info', data.lien || null]);
    }

    // ---- Journal / Traçabilité ----

    logEvent(data) {
        try {
            return this.run(`INSERT INTO evenements (acteur_type, acteur_id, action, cible_type, cible_id, projet_id, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [data.acteur_type || null, data.acteur_id ?? null, data.action, data.cible_type || null, data.cible_id ?? null, data.projet_id ?? null, data.details || null]);
        } catch (e) { return { changes: 0 }; }
    }

    getEvenements(filters = {}) {
        let sql = `SELECT e.*, p.code_projet FROM evenements e LEFT JOIN projets p ON e.projet_id = p.id WHERE 1=1`;
        const params = [];
        if (filters.projetId) { sql += ' AND e.projet_id = ?'; params.push(filters.projetId); }
        if (filters.acteurType) { sql += ' AND e.acteur_type = ?'; params.push(filters.acteurType); }
        sql += ' ORDER BY e.created_at DESC LIMIT ' + (filters.limit || 200);
        return this.all(sql, params);
    }

    getAvisByIntervenant(intervenantId) {
        return this.all(`SELECT a.*, we.type_etape, o.designation as ouvrage_nom, o.bloc, o.niveau,
            l.code_lot, p.intitule as projet_nom
            FROM avis a
            JOIN workflow_etapes we ON a.etape_id = we.id
            JOIN ouvrages o ON we.ouvrage_id = o.id
            JOIN lots l ON o.lot_id = l.id
            JOIN projets p ON l.projet_id = p.id
            WHERE a.intervenant_id = ? ORDER BY a.date_avis DESC`, [intervenantId]);
    }

    // Export de toutes les tables (pour CSV) — sessions sans mots de passe
    exportData() {
        const out = {};
        // Export dynamique de TOUTES les tables (couvre les modules ajoutés), hors mots de passe
        let names = [];
        try { names = this.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(r => r.name); } catch (e) { names = []; }
        for (const t of names) {
            try {
                if (t === 'sessions') { out[t] = this.all('SELECT id, intervenant_id, projet_id, username, actif, derniere_connexion, date_creation FROM sessions'); }
                else if (t === 'mod_users') { out[t] = this.all('SELECT id, nom, fonction, username, actif, derniere_connexion, date_creation FROM mod_users'); }
                else { out[t] = this.all('SELECT * FROM ' + t); }
            } catch (e) { out[t] = []; }
        }
        return out;
    }

    // Historique des essais d'un laboratoire (résultats saisis)
    getEssaisByLabo(laboId) {
        return this.all(`SELECT el.*, o.designation as ouvrage_nom, o.bloc, o.niveau, l.code_lot, p.intitule as projet_nom
            FROM essais_labo el
            JOIN ouvrages o ON el.ouvrage_id = o.id
            JOIN lots l ON o.lot_id = l.id
            JOIN projets p ON l.projet_id = p.id
            WHERE el.labo_id = ? ORDER BY el.date_prelevement DESC`, [laboId]);
    }

    // ---- Dashboard Stats ----

    getDashboardStats() {
        const s = (sql) => { try { return this.getScalar(sql) || 0; } catch (e) { return 0; } };
        return {
            totalProjets: s('SELECT COUNT(*) FROM projets'),
            projetsEnCours: s("SELECT COUNT(*) FROM projets WHERE statut = 'En cours'"),
            totalLots: s('SELECT COUNT(*) FROM lots'),
            lotsEnCours: s("SELECT COUNT(*) FROM lots WHERE statut = 'En cours'"),
            totalIntervenants: s('SELECT COUNT(*) FROM intervenants WHERE id > 0'),
            reservesOuvertes: s("SELECT COUNT(*) FROM reserves WHERE statut IN ('Ouverte', 'En cours de levée')"),
            essaisEnAttente: s("SELECT COUNT(*) FROM essais_labo WHERE conformite = 'En attente' OR conformite IS NULL"),
            montantTotal: s('SELECT COALESCE(SUM(montant_marche), 0) FROM projets'),
            avancementMoyen: s("SELECT COALESCE(AVG(taux_avancement), 0) FROM projets WHERE statut = 'En cours'"),
            alertes: s("SELECT COUNT(*) FROM notifications WHERE lue = 0 AND destinataire_type = 'MOD'"),
            // Points d'attention (modules ajoutés) — cockpit
            signalementsOuverts: s("SELECT COUNT(*) FROM signalements WHERE statut != 'Traité'"),
            planReservesOuvertes: s("SELECT COUNT(*) FROM plan_pins WHERE statut = 'Ouvert'"),
            avenantsProposes: s("SELECT COUNT(*) FROM avenants WHERE statut = 'Proposé'"),
            decomptesCircuit: s("SELECT COUNT(*) FROM decomptes WHERE statut NOT IN ('Payé','Rejeté')"),
            intemperies: s("SELECT COUNT(*) FROM meteo WHERE arret_travaux = 1"),
            gpaDesordresOuverts: s("SELECT COUNT(*) FROM gpa_desordres WHERE statut = 'Ouvert'")
        };
    }

    // Échéances / alertes automatiques (dérivées, non stockées) — projetId optionnel (null = tous)
    getEcheances(projetId) {
        const out = [];
        const where = projetId ? ' AND projet_id = ?' : '';
        const p = projetId ? [projetId] : [];
        const safe = (fn) => { try { fn(); } catch (e) {} };
        safe(() => this.all(`SELECT g.date_fin_gpa, l.code_lot FROM gpa g LEFT JOIN lots l ON g.lot_id = l.id WHERE g.statut = 'En cours' AND g.date_fin_gpa IS NOT NULL AND g.date_fin_gpa <= date('now','+60 day')${projetId ? ' AND g.projet_id = ?' : ''}`, p).forEach(g => out.push({ type: 'GPA', severity: 'warning', label: `Fin de GPA ${g.code_lot || ''} le ${g.date_fin_gpa}`.replace('  ', ' '), date: g.date_fin_gpa })));
        safe(() => { const n = this.getScalar(`SELECT COUNT(*) FROM decomptes WHERE statut NOT IN ('Payé','Rejeté')${where}`, p); if (n > 0) out.push({ type: 'Décompte', severity: 'info', label: `${n} décompte(s) en circuit de paiement`, date: null }); });
        safe(() => { const n = this.getScalar(`SELECT COUNT(*) FROM signalements WHERE statut != 'Traité'${where}`, p); if (n > 0) out.push({ type: 'Signalement', severity: 'warning', label: `${n} signalement(s) non traité(s)`, date: null }); });
        safe(() => { const n = this.getScalar(`SELECT COUNT(*) FROM avenants WHERE statut = 'Proposé'${where}`, p); if (n > 0) out.push({ type: 'Avenant', severity: 'info', label: `${n} avenant(s) à approuver`, date: null }); });
        safe(() => { const n = this.getScalar(`SELECT COUNT(*) FROM gpa_desordres d JOIN gpa g ON d.gpa_id = g.id WHERE d.statut = 'Ouvert'${projetId ? ' AND g.projet_id = ?' : ''}`, p); if (n > 0) out.push({ type: 'GPA', severity: 'danger', label: `${n} désordre(s) GPA ouvert(s)`, date: null }); });
        // Dépassements de délai (via l'axe de délai)
        const projets = projetId ? [{ id: projetId }] : this.all('SELECT id FROM projets');
        for (const pr of projets) safe(() => { const axis = this.getDelaiAxis(pr.id); (axis.lots || []).filter(l => l.hasData && l.enRetard).forEach(l => out.push({ type: 'Délai', severity: 'danger', label: `Lot ${l.code_lot} en dépassement de délai (${-l.restant} j, fin prévue ${l.finPrev})`, date: l.finPrev })); });
        return out;
    }

    // Recherche globale (barre de l'en-tête)
    search(q) {
        if (!q || q.trim().length < 2) return { projets: [], lots: [], intervenants: [], os: [], decomptes: [] };
        const like = '%' + q.trim() + '%';
        const safe = (sql, params) => { try { return this.all(sql, params); } catch (e) { return []; } };
        return {
            projets: safe('SELECT id, code_projet, intitule FROM projets WHERE intitule LIKE ? OR code_projet LIKE ? LIMIT 8', [like, like]),
            lots: safe('SELECT l.id, l.code_lot, l.designation, l.projet_id FROM lots l WHERE l.code_lot LIKE ? OR l.designation LIKE ? LIMIT 8', [like, like]),
            intervenants: safe('SELECT id, raison_sociale, type_role FROM intervenants WHERE raison_sociale LIKE ? AND id > 0 LIMIT 8', [like]),
            os: safe('SELECT os.id, os.numero_os, os.objet, l.projet_id FROM ordres_service os JOIN lots l ON os.lot_id = l.id WHERE os.numero_os LIKE ? OR os.objet LIKE ? LIMIT 8', [like, like]),
            decomptes: safe('SELECT id, numero, projet_id FROM decomptes WHERE numero LIKE ? LIMIT 8', [like])
        };
    }

    getProjectStats(projetId) {
        return {
            nbLots: this.getScalar('SELECT COUNT(*) FROM lots WHERE projet_id = ?', [projetId]),
            lotsEnCours: this.getScalar("SELECT COUNT(*) FROM lots WHERE projet_id = ? AND statut = 'En cours'", [projetId]),
            nbOuvrages: this.getScalar('SELECT COUNT(*) FROM ouvrages o JOIN lots l ON o.lot_id = l.id WHERE l.projet_id = ?', [projetId]),
            ouvragesTermines: this.getScalar("SELECT COUNT(*) FROM ouvrages o JOIN lots l ON o.lot_id = l.id WHERE l.projet_id = ? AND o.statut = 'Terminé'", [projetId]),
            reservesOuvertes: this.getScalar("SELECT COUNT(*) FROM reserves r JOIN ouvrages o ON r.ouvrage_id = o.id JOIN lots l ON o.lot_id = l.id WHERE l.projet_id = ? AND r.statut IN ('Ouverte', 'En cours de levée')", [projetId]),
            nbIntervenants: this.getScalar('SELECT COUNT(DISTINCT intervenant_id) FROM intervenants_projet WHERE projet_id = ?', [projetId])
        };
    }

    // ============================================================
    // CRUD COMPLÉMENTAIRE — édition & suppression (droits MOD)
    // ============================================================

    _updateRow(table, id, data) {
        const keys = Object.keys(data).filter(k => k !== 'id' && data[k] !== undefined);
        if (!keys.length) return { changes: 0 };
        const fields = keys.map(k => `${k} = ?`).join(', ');
        const values = [...keys.map(k => data[k]), id];
        return this.run(`UPDATE ${table} SET ${fields} WHERE id = ?`, values);
    }

    _deleteRow(table, id) {
        const r = this.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
        return { success: r.changes > 0 };
    }

    // Supprime explicitement les descendants d'un ouvrage (cascade manuelle fiable)
    _deleteOuvrageCascade(ouvrageIds) {
        if (!ouvrageIds.length) return;
        const list = ouvrageIds.join(',');
        const etapes = this.all(`SELECT id FROM workflow_etapes WHERE ouvrage_id IN (${list})`).map(r => r.id);
        if (etapes.length) this.run(`DELETE FROM avis WHERE etape_id IN (${etapes.join(',')})`);
        this.run(`DELETE FROM reserves WHERE ouvrage_id IN (${list})`);
        this.run(`DELETE FROM essais_labo WHERE ouvrage_id IN (${list})`);
        this.run(`DELETE FROM workflow_etapes WHERE ouvrage_id IN (${list})`);
        this.run(`DELETE FROM ouvrages WHERE id IN (${list})`);
    }

    // ---- Projets ----
    deleteProjet(id) {
        const ouvrages = this.all('SELECT o.id FROM ouvrages o JOIN lots l ON o.lot_id = l.id WHERE l.projet_id = ?', [id]).map(r => r.id);
        this._deleteOuvrageCascade(ouvrages);
        this.run('DELETE FROM ordres_service WHERE lot_id IN (SELECT id FROM lots WHERE projet_id = ?)', [id]);
        this.run('DELETE FROM lots WHERE projet_id = ?', [id]);
        this.run('DELETE FROM invitations WHERE reunion_id IN (SELECT id FROM reunions WHERE projet_id = ?)', [id]);
        this.run('DELETE FROM reunions WHERE projet_id = ?', [id]);
        this.run('DELETE FROM intervenants_projet WHERE projet_id = ?', [id]);
        this.run('DELETE FROM sessions WHERE projet_id = ?', [id]);
        this.run('DELETE FROM notifications WHERE projet_id = ?', [id]);
        // Nettoyage des modules ajoutés (cascade manuelle, sql.js ne l'assure pas)
        const tryRun = (sql) => { try { this.run(sql, [id]); } catch (e) {} };
        tryRun('DELETE FROM decompte_circuit WHERE decompte_id IN (SELECT id FROM decomptes WHERE projet_id = ?)');
        tryRun('DELETE FROM decomptes WHERE projet_id = ?');
        tryRun('DELETE FROM attachements WHERE projet_id = ?');
        tryRun('DELETE FROM avenants WHERE projet_id = ?');
        tryRun('DELETE FROM gpa_desordres WHERE gpa_id IN (SELECT id FROM gpa WHERE projet_id = ?)');
        tryRun('DELETE FROM gpa WHERE projet_id = ?');
        tryRun('DELETE FROM revision_termes WHERE formule_id IN (SELECT id FROM revision_formules WHERE projet_id = ?)');
        tryRun('DELETE FROM revision_calculs WHERE projet_id = ?');
        tryRun('DELETE FROM revision_formules WHERE projet_id = ?');
        tryRun('DELETE FROM penalites WHERE projet_id = ?');
        tryRun('DELETE FROM plan_pins WHERE projet_id = ?');
        tryRun('DELETE FROM signalements WHERE projet_id = ?');
        tryRun('DELETE FROM constats WHERE projet_id = ?');
        tryRun('DELETE FROM lot_interfaces WHERE projet_id = ?');
        tryRun('DELETE FROM meteo WHERE projet_id = ?');
        tryRun('DELETE FROM documents WHERE projet_id = ?');
        tryRun('DELETE FROM permanences WHERE projet_id = ?');
        tryRun('DELETE FROM cr_actions WHERE cr_id IN (SELECT id FROM comptes_rendus WHERE projet_id = ?)');
        tryRun('DELETE FROM comptes_rendus WHERE projet_id = ?');
        tryRun('DELETE FROM hqse WHERE projet_id = ?');
        tryRun('DELETE FROM evenements WHERE projet_id = ?');
        const r = this.run('DELETE FROM projets WHERE id = ?', [id]);
        this.logEvent({ acteur_type: 'MOD', action: 'Suppression projet', cible_type: 'projet', cible_id: id });
        return { success: r.changes > 0 };
    }

    // ---- Lots ----
    updateLot(id, data) { return this._updateRow('lots', id, data); }
    deleteLot(id) {
        const ouvrages = this.all('SELECT id FROM ouvrages WHERE lot_id = ?', [id]).map(r => r.id);
        this._deleteOuvrageCascade(ouvrages);
        this.run('DELETE FROM ordres_service WHERE lot_id = ?', [id]);
        const r = this.run('DELETE FROM lots WHERE id = ?', [id]);
        return { success: r.changes > 0 };
    }

    // ---- Ouvrages ----
    updateOuvrage(id, data) { return this._updateRow('ouvrages', id, data); }
    deleteOuvrage(id) {
        this._deleteOuvrageCascade([id]);
        return { success: true };
    }

    // ---- Intervenants ----
    updateIntervenant(id, data) { return this._updateRow('intervenants', id, data); }
    deleteIntervenant(id) {
        const refs = this.getScalar(`SELECT
            (SELECT COUNT(*) FROM lots WHERE entreprise_id = ?) +
            (SELECT COUNT(*) FROM sessions WHERE intervenant_id = ?) +
            (SELECT COUNT(*) FROM avis WHERE intervenant_id = ?) +
            (SELECT COUNT(*) FROM intervenants_projet WHERE intervenant_id = ?) +
            (SELECT COUNT(*) FROM essais_labo WHERE labo_id = ?)`, [id, id, id, id, id]);
        if (refs > 0) return { success: false, error: 'Intervenant lié à des projets, lots, avis ou essais. Désactivez-le plutôt que de le supprimer.' };
        const r = this.run('DELETE FROM intervenants WHERE id = ?', [id]);
        return { success: r.changes > 0 };
    }

    // ---- Sessions ----
    deleteSession(id) { return this._deleteRow('sessions', id); }

    // ---- Ordres de service ----
    updateOS(id, data) { return this._updateRow('ordres_service', id, data); }
    deleteOS(id) { return this._deleteRow('ordres_service', id); }

    // ---- Réunions ----
    updateReunion(id, data) { return this._updateRow('reunions', id, data); }
    deleteReunion(id) {
        this.run('DELETE FROM invitations WHERE reunion_id = ?', [id]);
        const r = this.run('DELETE FROM reunions WHERE id = ?', [id]);
        return { success: r.changes > 0 };
    }

    // ---- Réserves / Essais ----
    deleteReserve(id) { return this._deleteRow('reserves', id); }
    deleteEssai(id) { return this._deleteRow('essais_labo', id); }

    // ---- Documents (GED) ----
    createDocument(data) {
        return this.run(`INSERT INTO documents (nom, nom_fichier, type_document, entite_type, entite_id, projet_id, taille, extension, description, categorie, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.nom, data.nom_fichier, data.type_document || 'Autre', data.entite_type || 'projet', data.entite_id || null, data.projet_id || null, data.taille || 0, data.extension || null, data.description || null, data.categorie || null, data.uploaded_by || null]);
    }

    // Photos (photothèque) : documents images
    getPhotos(filters = {}) {
        let sql = `SELECT d.*, p.code_projet FROM documents d LEFT JOIN projets p ON d.projet_id = p.id
            WHERE (d.type_document = 'Photo' OR LOWER(d.extension) IN ('jpg','jpeg','png','gif','bmp','webp'))`;
        const params = [];
        if (filters.projetId) { sql += ' AND d.projet_id = ?'; params.push(filters.projetId); }
        if (filters.categorie) { sql += ' AND d.categorie = ?'; params.push(filters.categorie); }
        if (filters.entiteType) { sql += ' AND d.entite_type = ?'; params.push(filters.entiteType); }
        if (filters.entiteId) { sql += ' AND d.entite_id = ?'; params.push(filters.entiteId); }
        sql += ' ORDER BY d.created_at DESC LIMIT ' + (filters.limit || 300);
        return this.all(sql, params);
    }

    // ---- Réserves épinglées sur plan ----
    createPlanPin(data) {
        const res = this.run(`INSERT INTO plan_pins (projet_id, plan_doc_id, x, y, label, description, gravite, statut, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Ouvert', ?)`,
            [data.projet_id, data.plan_doc_id, data.x, data.y, data.label || null, data.description || null, data.gravite || 'Moyenne', data.created_by || null]);
        this.logEvent({ acteur_type: data.created_by_role || 'MOD', action: 'Réserve sur plan ajoutée', cible_type: 'plan', cible_id: data.plan_doc_id, projet_id: data.projet_id, details: data.description || '' });
        return res;
    }
    getPlanPins(planDocId) { return this.all('SELECT * FROM plan_pins WHERE plan_doc_id = ? ORDER BY id', [planDocId]); }
    updatePlanPin(id, data) {
        if (data.statut === 'Levé') { const today = new Date().toISOString().slice(0, 10); return this.run("UPDATE plan_pins SET statut = 'Levé', date_levee = ? WHERE id = ?", [today, id]); }
        if (data.statut === 'Ouvert') return this.run("UPDATE plan_pins SET statut = 'Ouvert', date_levee = NULL WHERE id = ?", [id]);
        return this.run('UPDATE plan_pins SET description = ?, gravite = ? WHERE id = ?', [data.description || null, data.gravite || 'Moyenne', id]);
    }
    deletePlanPin(id) { return this._deleteRow('plan_pins', id); }
    getPlanPinStats(projetId) {
        return {
            total: this.getScalar('SELECT COUNT(*) FROM plan_pins WHERE projet_id = ?', [projetId]),
            ouverts: this.getScalar("SELECT COUNT(*) FROM plan_pins WHERE projet_id = ? AND statut = 'Ouvert'", [projetId])
        };
    }

    // ---- Signalements (espace exploitant / SAV) ----
    createSignalement(data) {
        const res = this.run(`INSERT INTO signalements (projet_id, lot_id, objet, description, localisation, gravite, statut, signale_par, date_signalement)
            VALUES (?, ?, ?, ?, ?, ?, 'Ouvert', ?, ?)`,
            [data.projet_id, data.lot_id || null, data.objet, data.description || null, data.localisation || null, data.gravite || 'Moyenne', data.signale_par || null, data.date_signalement || new Date().toISOString().slice(0, 10)]);
        this.logEvent({ acteur_type: data.signale_par_role || 'MOD', action: 'Signalement créé', cible_type: 'signalement', cible_id: res.lastInsertRowid, projet_id: data.projet_id, details: data.objet });
        this.createNotification({ destinataire_type: 'MOD', projet_id: data.projet_id, titre: 'Nouveau signalement', message: `${data.objet}${data.localisation ? ' — ' + data.localisation : ''}`, type_notif: 'alerte' });
        return res;
    }
    getSignalementsByProjet(projetId) {
        return this.all('SELECT s.*, l.code_lot FROM signalements s LEFT JOIN lots l ON s.lot_id = l.id WHERE s.projet_id = ? ORDER BY (s.statut = "Traité"), s.date_signalement DESC, s.id DESC', [projetId]);
    }
    updateSignalementStatut(id, statut) {
        const done = statut === 'Traité' ? new Date().toISOString().slice(0, 10) : null;
        this.run('UPDATE signalements SET statut = ?, date_traitement = ? WHERE id = ?', [statut, done, id]);
        const s = this.get('SELECT * FROM signalements WHERE id = ?', [id]);
        if (s) this.logEvent({ acteur_type: 'MOD', action: `Signalement ${statut}`, cible_type: 'signalement', cible_id: id, projet_id: s.projet_id, details: s.objet });
        return { success: true };
    }
    deleteSignalement(id) { return this._deleteRow('signalements', id); }
    getSignalementStats(projetId) {
        return {
            total: this.getScalar('SELECT COUNT(*) FROM signalements WHERE projet_id = ?', [projetId]),
            ouverts: this.getScalar("SELECT COUNT(*) FROM signalements WHERE projet_id = ? AND statut != 'Traité'", [projetId])
        };
    }

    // ---- Constats (état initial / diagnostic / réhabilitation) ----
    createConstat(data) {
        const res = this.run(`INSERT INTO constats (projet_id, lot_id, type, intitule, date_constat, etat_general, observations, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.lot_id || null, data.type || 'Initial', data.intitule, data.date_constat || null, data.etat_general || null, data.observations || null, data.created_by || null]);
        this.logEvent({ acteur_type: 'MOD', action: 'Constat établi', cible_type: 'constat', cible_id: res.lastInsertRowid, projet_id: data.projet_id, details: `${data.type || 'Initial'} — ${data.intitule}` });
        return res;
    }
    getConstatsByProjet(projetId) {
        return this.all(`SELECT c.*, l.code_lot,
            (SELECT COUNT(*) FROM documents d WHERE d.entite_type = 'constat' AND d.entite_id = c.id) as nb_pieces
            FROM constats c LEFT JOIN lots l ON c.lot_id = l.id WHERE c.projet_id = ? ORDER BY c.date_constat DESC, c.id DESC`, [projetId]);
    }
    deleteConstat(id) { return this._deleteRow('constats', id); }

    // ---- Grilles de contrôle configurables ----
    getChecklistItems(typeReception) {
        if (typeReception) return this.all("SELECT * FROM checklist_items WHERE type_reception = ? AND actif = 1 ORDER BY ordre, id", [typeReception]);
        return this.all('SELECT * FROM checklist_items ORDER BY type_reception, ordre, id');
    }
    addChecklistItem(data) {
        const max = this.getScalar('SELECT COALESCE(MAX(ordre),0) FROM checklist_items WHERE type_reception = ?', [data.type_reception]);
        return this.run('INSERT INTO checklist_items (type_reception, libelle, ordre, actif) VALUES (?, ?, ?, 1)', [data.type_reception, data.libelle, (max || 0) + 1]);
    }
    deleteChecklistItem(id) { return this._deleteRow('checklist_items', id); }

    // ============================================================
    // RÉVISION DES PRIX — formules à indices (marchés publics)
    // K = partie fixe + Σ [coefficient × (index actuel / index de base)]
    // ============================================================
    createRevisionFormule(data) {
        const res = this.run(`INSERT INTO revision_formules (projet_id, lot_id, intitule, partie_fixe, mois_base)
            VALUES (?, ?, ?, ?, ?)`,
            [data.projet_id, data.lot_id || null, data.intitule, parseFloat(data.partie_fixe) || 0, data.mois_base || null]);
        const fid = res.lastInsertRowid;
        (data.termes || []).forEach(t => {
            if (!t.index_nom) return;
            this.run('INSERT INTO revision_termes (formule_id, index_nom, coefficient, valeur_base) VALUES (?, ?, ?, ?)',
                [fid, t.index_nom, parseFloat(t.coefficient) || 0, parseFloat(t.valeur_base) || 0]);
        });
        this.logEvent({ acteur_type: 'MOD', action: 'Formule de révision créée', cible_type: 'revision', cible_id: fid, projet_id: data.projet_id, details: data.intitule });
        return res;
    }
    getRevisionFormules(projetId) {
        const formules = this.all('SELECT f.*, l.code_lot FROM revision_formules f LEFT JOIN lots l ON f.lot_id = l.id WHERE f.projet_id = ? ORDER BY f.id DESC', [projetId]);
        return formules.map(f => ({ ...f, termes: this.getRevisionTermes(f.id) }));
    }
    getRevisionTermes(formuleId) { return this.all('SELECT * FROM revision_termes WHERE formule_id = ? ORDER BY id', [formuleId]); }
    getRevisionFormule(id) { const f = this.get('SELECT * FROM revision_formules WHERE id = ?', [id]); if (f) f.termes = this.getRevisionTermes(id); return f; }
    deleteRevisionFormule(id) {
        this.run('DELETE FROM revision_termes WHERE formule_id = ?', [id]);
        this.run('DELETE FROM revision_calculs WHERE formule_id = ?', [id]);
        return this._deleteRow('revision_formules', id);
    }
    // Calcul de révision : valeurs = { terme_id: valeur_index_actuel }
    createRevisionCalcul(data) {
        const formule = this.getRevisionFormule(data.formule_id);
        if (!formule) return { success: false, error: 'Formule introuvable.' };
        const valeurs = data.valeurs || {};
        let k = parseFloat(formule.partie_fixe) || 0;
        const detail = { partie_fixe: k, termes: [] };
        for (const t of formule.termes) {
            // Valeur actuelle : saisie manuelle, sinon recherche dans la base d'index au mois de révision
            let actuel = parseFloat(valeurs[t.id]);
            if (isNaN(actuel) && data.mois_revision) { const v = this.getIndexValue(t.index_nom, data.mois_revision); if (v != null) actuel = parseFloat(v); }
            // Valeur de base : celle de la formule, sinon recherche au mois de base
            let base = parseFloat(t.valeur_base);
            if ((!base || isNaN(base)) && formule.mois_base) { const v = this.getIndexValue(t.index_nom, formule.mois_base); if (v != null) base = parseFloat(v); }
            const ratio = (base && !isNaN(actuel)) ? (actuel / base) : 1;
            const contrib = (parseFloat(t.coefficient) || 0) * ratio;
            k += contrib;
            detail.termes.push({ index_nom: t.index_nom, coefficient: t.coefficient, valeur_base: base, valeur_actuelle: isNaN(actuel) ? null : actuel, ratio: Math.round(ratio * 10000) / 10000, contribution: Math.round(contrib * 10000) / 10000 });
        }
        k = Math.round(k * 10000) / 10000;
        const montant = parseFloat(data.montant_base) || 0;
        const montant_revise = Math.round(montant * k * 100) / 100;
        const ecart = Math.round((montant_revise - montant) * 100) / 100;
        const res = this.run(`INSERT INTO revision_calculs (formule_id, projet_id, decompte_id, libelle, mois_revision, montant_base, coefficient_k, montant_revise, ecart, detail)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.formule_id, formule.projet_id, data.decompte_id || null, data.libelle || null, data.mois_revision || null, montant, k, montant_revise, ecart, JSON.stringify(detail)]);
        this.logEvent({ acteur_type: 'MOD', action: 'Révision de prix calculée', cible_type: 'revision', cible_id: res.lastInsertRowid, projet_id: formule.projet_id, details: `K=${k} · écart ${Math.round(ecart)} DH` });
        return { success: true, id: res.lastInsertRowid, coefficient_k: k, montant_revise, ecart, detail };
    }
    getRevisionCalculs(projetId) {
        return this.all('SELECT c.*, f.intitule as formule_nom FROM revision_calculs c JOIN revision_formules f ON c.formule_id = f.id WHERE c.projet_id = ? ORDER BY c.id DESC', [projetId]);
    }
    deleteRevisionCalcul(id) { return this._deleteRow('revision_calculs', id); }
    // Base d'index (valeurs mensuelles) : sélection par date I0 (mois base) / I (mois révision)
    setRevisionIndex(data) {
        this.run('DELETE FROM revision_index WHERE index_nom = ? AND mois = ?', [data.index_nom, data.mois]);
        return this.run('INSERT INTO revision_index (index_nom, mois, valeur, type) VALUES (?, ?, ?, ?)', [data.index_nom, data.mois, parseFloat(data.valeur) || 0, data.type || 'Définitif']);
    }
    getRevisionIndex(indexNom) {
        if (indexNom) return this.all('SELECT * FROM revision_index WHERE index_nom = ? ORDER BY mois DESC', [indexNom]);
        return this.all('SELECT * FROM revision_index ORDER BY index_nom, mois DESC');
    }
    getIndexValue(nom, mois) { return this.getScalar('SELECT valeur FROM revision_index WHERE index_nom = ? AND mois = ? LIMIT 1', [nom, mois]); }
    deleteRevisionIndex(id) { return this._deleteRow('revision_index', id); }

    // ---- Pénalités de retard (s'appuie sur la fin prévisionnelle de l'axe de délai) ----
    computePenalite(data) {
        // Fin prévisionnelle : depuis l'axe de délai (intègre prolongations + arrêts) si lot fourni
        let finPrev = data.date_fin_prevue || null;
        if (data.lot_id && data.projet_id) {
            try { const axis = this.getDelaiAxis(data.projet_id); const L = (axis.lots || []).find(l => l.id === parseInt(data.lot_id) && l.hasData); if (L && L.finPrev) finPrev = L.finPrev; } catch (e) {}
        }
        const montant = parseFloat(data.montant_base) || 0;
        const taux = parseFloat(data.taux_journalier) || 0;
        const plafondPct = parseFloat(data.plafond_pct); const plafP = isNaN(plafondPct) ? 8 : plafondPct;
        let jours = 0;
        if (finPrev && data.date_achevement) {
            const a = new Date(String(finPrev).slice(0, 10) + 'T00:00:00Z'), b = new Date(String(data.date_achevement).slice(0, 10) + 'T00:00:00Z');
            jours = Math.max(0, Math.round((b - a) / 86400000));
        }
        const brute = montant * taux * jours;
        const plafond = montant * plafP / 100;
        const plafonnee = brute > plafond ? 1 : 0;
        const penalite = Math.round(Math.min(brute, plafond) * 100) / 100;
        const res = this.run(`INSERT INTO penalites (projet_id, lot_id, libelle, montant_base, date_fin_prevue, date_achevement, jours_retard, taux_journalier, plafond_pct, montant_penalite, plafonnee)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.lot_id || null, data.libelle || null, montant, finPrev, data.date_achevement || null, jours, taux, plafP, penalite, plafonnee]);
        this.logEvent({ acteur_type: 'MOD', action: 'Pénalité de retard calculée', cible_type: 'penalite', cible_id: res.lastInsertRowid, projet_id: data.projet_id, details: `${jours} j · ${Math.round(penalite)} DH` });
        return { success: true, id: res.lastInsertRowid, jours_retard: jours, montant_penalite: penalite, date_fin_prevue: finPrev, plafonnee: !!plafonnee };
    }
    getPenalites(projetId) {
        return this.all('SELECT p.*, l.code_lot FROM penalites p LEFT JOIN lots l ON p.lot_id = l.id WHERE p.projet_id = ? ORDER BY p.id DESC', [projetId]);
    }
    deletePenalite(id) { return this._deleteRow('penalites', id); }
    getDocument(id) { return this.get('SELECT * FROM documents WHERE id = ?', [id]); }
    getDocumentsByEntity(entiteType, entiteId) {
        return this.all('SELECT * FROM documents WHERE entite_type = ? AND entite_id = ? ORDER BY created_at DESC', [entiteType, entiteId]);
    }
    getAllDocuments(filters = {}) {
        let sql = 'SELECT d.*, p.code_projet FROM documents d LEFT JOIN projets p ON d.projet_id = p.id WHERE 1=1';
        const params = [];
        if (filters.projetId) { sql += ' AND d.projet_id = ?'; params.push(filters.projetId); }
        if (filters.type) { sql += ' AND d.type_document = ?'; params.push(filters.type); }
        sql += ' ORDER BY d.created_at DESC LIMIT ' + (filters.limit || 500);
        return this.all(sql, params);
    }
    deleteDocumentRecord(id) {
        const doc = this.getDocument(id);
        this.run('DELETE FROM documents WHERE id = ?', [id]);
        return doc;
    }
    getDocCountByProjet(projetId) { return this.getScalar('SELECT COUNT(*) FROM documents WHERE projet_id = ?', [projetId]); }

    // ---- Météo / Intempéries ----
    createMeteo(data) {
        // upsert par (projet, date)
        this.run('DELETE FROM meteo WHERE projet_id = ? AND date = ?', [data.projet_id, data.date]);
        const res = this.run(`INSERT INTO meteo (projet_id, date, condition, temp_min, temp_max, precipitation_mm, vent_kmh, arret_travaux, source, commentaire, saisi_par)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.date, data.condition || null, data.temp_min ?? null, data.temp_max ?? null, data.precipitation_mm || 0, data.vent_kmh || 0, data.arret_travaux ? 1 : 0, data.source || 'Saisie manuelle', data.commentaire || null, data.saisi_par || null]);
        if (data.arret_travaux) this.logEvent({ acteur_type: data.saisi_par_role || 'MOD', action: 'Intempérie enregistrée', cible_type: 'meteo', projet_id: data.projet_id, details: `${data.date} — ${data.condition || ''} (arrêt travaux)` });
        return res;
    }
    getMeteoByProjet(projetId) { return this.all('SELECT * FROM meteo WHERE projet_id = ? ORDER BY date DESC LIMIT 180', [projetId]); }
    getMeteoStats(projetId) {
        return {
            total: this.getScalar('SELECT COUNT(*) FROM meteo WHERE projet_id = ?', [projetId]),
            intemperies: this.getScalar('SELECT COUNT(*) FROM meteo WHERE projet_id = ? AND arret_travaux = 1', [projetId])
        };
    }
    deleteMeteo(id) { return this._deleteRow('meteo', id); }
    // Regroupe les jours d'intempérie consécutifs en périodes d'arrêt (→ OS arrêt/reprise datés)
    getMeteoArretPeriodes(projetId) {
        const rows = this.all("SELECT date, condition, precipitation_mm, vent_kmh FROM meteo WHERE projet_id = ? AND arret_travaux = 1 ORDER BY date", [projetId]);
        const nextDay = d => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
        const periods = []; let cur = null;
        for (const r of rows) {
            if (cur && nextDay(cur.fin) === r.date) { cur.fin = r.date; cur.jours++; cur.jours_detail.push(r); }
            else { if (cur) periods.push(cur); cur = { debut: r.date, fin: r.date, jours: 1, jours_detail: [r] }; }
        }
        if (cur) periods.push(cur);
        // date de reprise = lendemain du dernier jour d'arrêt
        periods.forEach(p => { p.date_reprise = nextDay(p.fin); });
        return periods;
    }

    // ---- Interfaces / dépendances entre lots ----
    createInterface(data) {
        return this.run(`INSERT INTO lot_interfaces (projet_id, lot_source_id, lot_cible_id, type_interface, description, statut, date_prevue)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.lot_source_id, data.lot_cible_id, data.type_interface || 'Réservations', data.description || null, data.statut || 'En attente', data.date_prevue || null]);
    }
    getInterfacesByProjet(projetId) {
        return this.all(`SELECT li.*, ls.code_lot as source_code, ls.designation as source_designation,
            lc.code_lot as cible_code, lc.designation as cible_designation
            FROM lot_interfaces li
            JOIN lots ls ON li.lot_source_id = ls.id
            JOIN lots lc ON li.lot_cible_id = lc.id
            WHERE li.projet_id = ? ORDER BY li.statut, li.date_prevue`, [projetId]);
    }
    updateInterfaceStatut(id, statut) {
        const dateReelle = (statut === 'Livré') ? new Date().toISOString().split('T')[0] : null;
        this.run('UPDATE lot_interfaces SET statut = ?, date_reelle = ? WHERE id = ?', [statut, dateReelle, id]);
        const it = this.get('SELECT li.*, lc.code_lot as cible_code FROM lot_interfaces li JOIN lots lc ON li.lot_cible_id=lc.id WHERE li.id=?', [id]);
        if (it) this.logEvent({ acteur_type: 'MOD', action: 'Interface ' + statut, cible_type: 'interface', cible_id: id, projet_id: it.projet_id, details: `${it.type_interface} → lot ${it.cible_code}` });
        return { success: true };
    }
    deleteInterface(id) { return this._deleteRow('lot_interfaces', id); }
    getInterfaceStats(projetId) {
        return {
            total: this.getScalar('SELECT COUNT(*) FROM lot_interfaces WHERE projet_id = ?', [projetId]),
            enAttente: this.getScalar("SELECT COUNT(*) FROM lot_interfaces WHERE projet_id = ? AND statut IN ('En attente','Bloqué')", [projetId]),
            livrees: this.getScalar("SELECT COUNT(*) FROM lot_interfaces WHERE projet_id = ? AND statut = 'Livré'", [projetId])
        };
    }

    // ============================================================
    // PERMANENCE / PRÉSENCE CHANTIER
    // ============================================================
    createPermanence(data) {
        this.run('DELETE FROM permanences WHERE projet_id = ? AND intervenant_id = ? AND date = ?', [data.projet_id, data.intervenant_id, data.date]);
        const res = this.run(`INSERT INTO permanences (projet_id, intervenant_id, role, date, present, heure_arrivee, heure_depart, observations)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.intervenant_id, data.role || null, data.date, data.present ? 1 : 0, data.heure_arrivee || null, data.heure_depart || null, data.observations || null]);
        this.logEvent({ acteur_type: data.role, acteur_id: data.intervenant_id, action: data.present ? 'Présence chantier' : 'Absence chantier', cible_type: 'permanence', projet_id: data.projet_id, details: data.date });
        return res;
    }
    getPermanencesByProjet(projetId, limit = 200) {
        return this.all(`SELECT pm.*, i.raison_sociale, i.type_role FROM permanences pm JOIN intervenants i ON pm.intervenant_id = i.id
            WHERE pm.projet_id = ? ORDER BY pm.date DESC, i.type_role LIMIT ${limit}`, [projetId]);
    }
    getPermanencesByIntervenant(intervenantId, projetId) {
        return this.all('SELECT * FROM permanences WHERE intervenant_id = ? AND projet_id = ? ORDER BY date DESC LIMIT 120', [intervenantId, projetId]);
    }
    getPermanenceToday(intervenantId, projetId, date) {
        return this.get('SELECT * FROM permanences WHERE intervenant_id = ? AND projet_id = ? AND date = ?', [intervenantId, projetId, date]);
    }
    getPermanenceStats(projetId) {
        return {
            joursPresence: this.getScalar('SELECT COUNT(*) FROM permanences WHERE projet_id = ? AND present = 1', [projetId]),
            parRole: this.all("SELECT i.type_role, COUNT(*) as n FROM permanences pm JOIN intervenants i ON pm.intervenant_id = i.id WHERE pm.projet_id = ? AND pm.present = 1 GROUP BY i.type_role", [projetId])
        };
    }
    deletePermanence(id) { return this._deleteRow('permanences', id); }

    // ============================================================
    // COMPTES RENDUS / PV + responsabilités
    // ============================================================
    createCR(data) {
        const res = this.run(`INSERT INTO comptes_rendus (projet_id, reunion_id, type, objet, contenu, redige_par, redige_par_role, date_cr)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.reunion_id || null, data.type || 'CR Chantier', data.objet, data.contenu || null, data.redige_par || null, data.redige_par_role || null, data.date_cr || null]);
        const crId = res.lastInsertRowid;
        (data.actions || []).forEach(a => {
            if (a && a.description) this.run(`INSERT INTO cr_actions (cr_id, description, responsable, delai, statut) VALUES (?, ?, ?, ?, ?)`,
                [crId, a.description, a.responsable || null, a.delai || null, a.statut || 'À faire']);
        });
        this.logEvent({ acteur_type: data.redige_par_role || 'MOD', acteur_id: null, action: (data.type || 'CR') + ' rédigé', cible_type: 'compte_rendu', cible_id: crId, projet_id: data.projet_id, details: data.objet });
        return res;
    }
    getCRByProjet(projetId) {
        return this.all(`SELECT cr.*, (SELECT COUNT(*) FROM cr_actions WHERE cr_id = cr.id) as nb_actions,
            (SELECT COUNT(*) FROM cr_actions WHERE cr_id = cr.id AND statut = 'Fait') as nb_faites
            FROM comptes_rendus cr WHERE cr.projet_id = ? ORDER BY cr.date_cr DESC, cr.id DESC`, [projetId]);
    }
    getCR(id) { return this.get('SELECT cr.*, p.code_projet, p.intitule as projet_nom FROM comptes_rendus cr JOIN projets p ON cr.projet_id = p.id WHERE cr.id = ?', [id]); }
    getCRActions(crId) { return this.all('SELECT * FROM cr_actions WHERE cr_id = ? ORDER BY id', [crId]); }
    updateCRActionStatut(id, statut) { return this.run('UPDATE cr_actions SET statut = ? WHERE id = ?', [statut, id]); }
    deleteCR(id) {
        this.run('DELETE FROM cr_actions WHERE cr_id = ?', [id]);
        return this._deleteRow('comptes_rendus', id);
    }

    // ============================================================
    // PARAMÈTRES / PERMISSIONS (gérés par le MOD)
    // ============================================================
    getConfig() {
        const defaults = { modules: { paiements: false }, perms: {} };
        const row = this.get("SELECT valeur FROM parametres WHERE cle = 'config'");
        if (!row || !row.valeur) return defaults;
        try {
            const cfg = JSON.parse(row.valeur);
            return { modules: Object.assign({}, defaults.modules, cfg.modules || {}), perms: cfg.perms || {} };
        } catch (e) { return defaults; }
    }
    setConfig(obj) {
        const val = JSON.stringify(obj || {});
        this.run("DELETE FROM parametres WHERE cle = 'config'");
        this.run("INSERT INTO parametres (cle, valeur) VALUES ('config', ?)", [val]);
        this.logEvent({ acteur_type: 'MOD', action: 'Paramètres modifiés', cible_type: 'config', details: 'Permissions / modules mis à jour' });
        return { success: true };
    }

    // ============================================================
    // HQSE — Hygiène, Qualité, Sécurité, Environnement
    // ============================================================
    createHqse(data) {
        const res = this.run(`INSERT INTO hqse (projet_id, lot_id, date, domaine, type_fiche, gravite, probabilite, description, localisation, action_corrective, responsable_action, delai, statut, saisi_par)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.lot_id || null, data.date || null, data.domaine || 'Sécurité', data.type_fiche || 'Observation', data.gravite || 2, data.probabilite || 2, data.description, data.localisation || null, data.action_corrective || null, data.responsable_action || null, data.delai || null, data.statut || 'Ouvert', data.saisi_par || null]);
        const crit = (data.gravite || 2) * (data.probabilite || 2);
        // Alerter le MOD pour les risques élevés/critiques et accidents
        if (crit >= 8 || ['Accident', 'Presqu\'accident', 'Non-conformité'].includes(data.type_fiche)) {
            this.createNotification({ destinataire_type: 'MOD', projet_id: data.projet_id, titre: 'HQSE : ' + (data.type_fiche || 'Risque'), message: `[${data.domaine}] ${data.description} (criticité ${crit})`, type_notif: crit >= 12 || data.type_fiche === 'Accident' ? 'urgent' : 'alerte' });
        }
        this.logEvent({ acteur_type: data.saisi_par_role || 'Entreprise', action: 'Fiche HQSE : ' + (data.type_fiche || ''), cible_type: 'hqse', cible_id: res.lastInsertRowid, projet_id: data.projet_id, details: `[${data.domaine}] ${data.description}` });
        return res;
    }
    getHqseByProjet(projetId) {
        return this.all(`SELECT h.*, l.code_lot FROM hqse h LEFT JOIN lots l ON h.lot_id = l.id WHERE h.projet_id = ? ORDER BY (h.gravite*h.probabilite) DESC, h.date DESC, h.id DESC`, [projetId]);
    }
    updateHqseStatut(id, statut) { return this.run('UPDATE hqse SET statut = ? WHERE id = ?', [statut, id]); }
    deleteHqse(id) { return this._deleteRow('hqse', id); }
    getHqseStats(projetId) {
        return {
            total: this.getScalar('SELECT COUNT(*) FROM hqse WHERE projet_id = ?', [projetId]),
            ouverts: this.getScalar("SELECT COUNT(*) FROM hqse WHERE projet_id = ? AND statut IN ('Ouvert','En cours')", [projetId]),
            critiques: this.getScalar('SELECT COUNT(*) FROM hqse WHERE projet_id = ? AND (gravite*probabilite) >= 12', [projetId]),
            accidents: this.getScalar("SELECT COUNT(*) FROM hqse WHERE projet_id = ? AND type_fiche IN ('Accident','Presqu''accident')", [projetId]),
            parDomaine: this.all('SELECT domaine, COUNT(*) as n FROM hqse WHERE projet_id = ? GROUP BY domaine', [projetId])
        };
    }

    // ============================================================
    // ATTACHEMENTS & DÉCOMPTES — circuit de paiement / mandatement
    // ============================================================

    createAttachement(data) {
        const res = this.run(`INSERT INTO attachements (projet_id, lot_id, numero, periode, date_attachement, montant_travaux, statut, observations)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.lot_id, data.numero, data.periode || null, data.date_attachement || null, data.montant_travaux || 0, data.statut || 'Soumis', data.observations || null]);
        this.logEvent({ acteur_type: 'Entreprise', action: 'Attachement soumis', cible_type: 'attachement', cible_id: res.lastInsertRowid, projet_id: data.projet_id, details: `${data.numero} — ${data.montant_travaux || 0} DH` });
        return res;
    }
    getAttachementsByProjet(projetId) {
        return this.all(`SELECT a.*, l.code_lot FROM attachements a JOIN lots l ON a.lot_id = l.id WHERE a.projet_id = ? ORDER BY a.date_attachement DESC, a.id DESC`, [projetId]);
    }
    updateAttachementStatut(id, statut) { return this.run('UPDATE attachements SET statut = ? WHERE id = ?', [statut, id]); }
    // Validation d'un attachement par le MOD (avec traçabilité + notification)
    validateAttachement(id, acteur) {
        this.run("UPDATE attachements SET statut = 'Validé', motif_rectification = NULL WHERE id = ?", [id]);
        const a = this.get('SELECT * FROM attachements WHERE id = ?', [id]);
        if (a) {
            this.logEvent({ acteur_type: 'MOD', action: 'Attachement validé', cible_type: 'attachement', cible_id: id, projet_id: a.projet_id, details: `${a.numero} — ${acteur || 'MOD'}` });
            this.createNotification({ destinataire_type: 'Entreprise', projet_id: a.projet_id, titre: 'Attachement validé ✅', message: `${a.numero} validé — vous pouvez établir le décompte.`, type_notif: 'succes' });
        }
        return { success: true };
    }
    // Renvoi pour rectification (repasse en brouillon, motif transmis à l'entreprise)
    requestAttachementRectification(id, motif) {
        this.run("UPDATE attachements SET statut = 'Brouillon', motif_rectification = ? WHERE id = ?", [motif || null, id]);
        const a = this.get('SELECT * FROM attachements WHERE id = ?', [id]);
        if (a) {
            this.logEvent({ acteur_type: 'MOD', action: 'Attachement — rectification demandée', cible_type: 'attachement', cible_id: id, projet_id: a.projet_id, details: motif || '' });
            this.createNotification({ destinataire_type: 'Entreprise', projet_id: a.projet_id, titre: 'Attachement à rectifier', message: `${a.numero} — ${motif || 'rectification demandée par le MOD'}`, type_notif: 'alerte' });
        }
        return { success: true };
    }
    // Re-soumission par l'entreprise après rectification
    resubmitAttachement(id) {
        this.run("UPDATE attachements SET statut = 'Soumis' WHERE id = ?", [id]);
        const a = this.get('SELECT * FROM attachements WHERE id = ?', [id]);
        if (a) {
            this.logEvent({ acteur_type: 'Entreprise', action: 'Attachement re-soumis après rectification', cible_type: 'attachement', cible_id: id, projet_id: a.projet_id, details: a.numero });
            this.createNotification({ destinataire_type: 'MOD', projet_id: a.projet_id, titre: 'Attachement re-soumis', message: `${a.numero} corrigé et re-soumis par l'entreprise.`, type_notif: 'info' });
        }
        return { success: true };
    }
    deleteAttachement(id) { return this._deleteRow('attachements', id); }

    createDecompte(data) {
        const ht = parseFloat(data.montant_ht) || 0;
        const tva = parseFloat(data.taux_tva) || 20;
        const rg = parseFloat(data.taux_retenue_garantie) || 7;
        const montant_tva = ht * tva / 100;
        const montant_ttc = ht + montant_tva;
        const montant_retenue = ht * rg / 100;
        const montant_net = montant_ttc - montant_retenue;
        const res = this.run(`INSERT INTO decomptes (projet_id, lot_id, attachement_id, numero, type, date_decompte, montant_ht, taux_tva, montant_tva, montant_ttc, montant_cumule_anterieur, taux_retenue_garantie, montant_retenue, montant_net_a_payer, statut, observations)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Établi', ?)`,
            [data.projet_id, data.lot_id, data.attachement_id || null, data.numero, data.type || 'Provisoire', data.date_decompte || null, ht, tva, montant_tva, montant_ttc, data.montant_cumule_anterieur || 0, rg, montant_retenue, montant_net, data.observations || null]);
        const did = res.lastInsertRowid;
        this.run("UPDATE decomptes SET phase_paiement = 'Décompte établi' WHERE id = ?", [did]);
        const steps = [
            { ordre: 1, etape: 'Validation technique', role: 'BET' },
            { ordre: 2, etape: 'Vérification', role: 'Architecte' },
            { ordre: 3, etape: 'Visa contrôle', role: 'BCT' },
            { ordre: 4, etape: 'Visa MOD (Ordonnateur)', role: 'MOD' },
            { ordre: 5, etape: 'Ordonnancement / Mandatement', role: 'MOD' },
            { ordre: 6, etape: 'Visa TGR (Comptable public)', role: 'TGR' },
            { ordre: 7, etape: 'Mise en paiement', role: 'TGR' }
        ];
        for (const s of steps) this.run(`INSERT INTO decompte_circuit (decompte_id, ordre, etape, responsable_type, statut) VALUES (?, ?, ?, ?, 'En attente')`, [did, s.ordre, s.etape, s.role]);
        this.logEvent({ acteur_type: 'MOD', action: 'Décompte établi', cible_type: 'decompte', cible_id: did, projet_id: data.projet_id, details: `${data.numero} — net à payer ${Math.round(montant_net)} DH` });
        return res;
    }
    getDecomptesByProjet(projetId) {
        return this.all(`SELECT d.*, l.code_lot,
            (SELECT COUNT(*) FROM decompte_circuit WHERE decompte_id = d.id AND statut = 'Validé') as etapes_validees,
            (SELECT COUNT(*) FROM decompte_circuit WHERE decompte_id = d.id) as etapes_total
            FROM decomptes d JOIN lots l ON d.lot_id = l.id WHERE d.projet_id = ? ORDER BY d.date_decompte DESC, d.id DESC`, [projetId]);
    }
    getDecompte(id) {
        return this.get(`SELECT d.*, l.code_lot, l.designation as lot_designation, p.intitule as projet_nom, p.code_projet
            FROM decomptes d JOIN lots l ON d.lot_id = l.id JOIN projets p ON d.projet_id = p.id WHERE d.id = ?`, [id]);
    }
    getDecompteCircuit(decompteId) { return this.all('SELECT * FROM decompte_circuit WHERE decompte_id = ? ORDER BY ordre', [decompteId]); }

    actOnDecompteStep(stepId, statut, commentaire, acteur) {
        this.run('UPDATE decompte_circuit SET statut = ?, commentaire = ?, acteur = ?, date_action = CURRENT_TIMESTAMP WHERE id = ?', [statut, commentaire || null, acteur || null, stepId]);
        const step = this.get('SELECT * FROM decompte_circuit WHERE id = ?', [stepId]);
        if (step) {
            this.logEvent({ acteur_type: step.responsable_type, action: `${step.etape} : ${statut}`, cible_type: 'decompte', cible_id: step.decompte_id, details: commentaire || '' });
            return this.advanceDecompte(step.decompte_id);
        }
        return { success: true };
    }
    advanceDecompte(decompteId) {
        const steps = this.getDecompteCircuit(decompteId);
        const d = this.getDecompte(decompteId);
        if (steps.some(s => ['Avec remarques', 'Rejeté'].includes(s.statut))) {
            this.run("UPDATE decomptes SET statut = 'Rejeté' WHERE id = ?", [decompteId]);
            this.createNotification({ destinataire_type: 'MOD', projet_id: d.projet_id, titre: 'Décompte : remarques', message: `${d.numero} — remarques/rejet dans le circuit.`, type_notif: 'alerte' });
            return { status: 'Rejeté' };
        }
        const ok = {}; steps.forEach(s => ok[s.ordre] = s.statut === 'Validé');
        const today = new Date().toISOString().split('T')[0];
        // statut = résumé (compatibilité) ; phase_paiement = phase détaillée des finances publiques
        let statut = 'Établi', phase = 'Décompte établi';
        if (ok[1]) { statut = 'Validé technique'; phase = 'Validé technique (BET)'; }
        if (ok[1] && ok[2]) phase = 'Vérifié (Architecte)';
        if (ok[1] && ok[2] && ok[3]) phase = 'Visa contrôle (BCT)';
        if (ok[1] && ok[2] && ok[3] && ok[4]) { statut = 'Visé'; phase = 'Visé MOD — bon à ordonnancer'; }
        if (statut === 'Visé' && ok[5]) {
            statut = 'Mandaté'; phase = 'Ordonnancé / Mandaté';
            if (!d.date_ordonnancement) this.run('UPDATE decomptes SET date_ordonnancement = ? WHERE id = ?', [today, decompteId]);
            if (!d.date_mandatement) this.run('UPDATE decomptes SET date_mandatement = ? WHERE id = ?', [today, decompteId]);
        }
        if (statut === 'Mandaté' && ok[6]) {
            phase = 'Visé par la TGR';
            if (!d.date_visa_tgr) this.run('UPDATE decomptes SET date_visa_tgr = ? WHERE id = ?', [today, decompteId]);
        }
        if (statut === 'Mandaté' && ok[6] && ok[7]) {
            statut = 'Payé'; phase = 'Mis en paiement (payé)';
            if (!d.date_paiement) this.run('UPDATE decomptes SET date_paiement = ? WHERE id = ?', [today, decompteId]);
        }
        this.run('UPDATE decomptes SET statut = ?, phase_paiement = ? WHERE id = ?', [statut, phase, decompteId]);
        if (statut === 'Payé') this.createNotification({ destinataire_type: 'MOD', projet_id: d.projet_id, titre: 'Décompte payé ✅', message: `${d.numero} payé (${Math.round(d.montant_net_a_payer)} DH).`, type_notif: 'succes' });
        return { status: statut, phase };
    }
    updateDecompteMandat(id, numMandat) { return this.run('UPDATE decomptes SET num_mandat = ? WHERE id = ?', [numMandat, id]); }
    updateDecompteTgr(id, numTgr) { return this.run('UPDATE decomptes SET num_tgr = ? WHERE id = ?', [numTgr, id]); }
    // Traçabilité : journal des évènements d'un décompte (circuit documentaire)
    getDecompteEvents(decompteId) {
        return this.all("SELECT * FROM evenements WHERE cible_type = 'decompte' AND cible_id = ? ORDER BY created_at DESC, id DESC LIMIT 60", [decompteId]);
    }
    deleteDecompte(id) {
        this.run('DELETE FROM decompte_circuit WHERE decompte_id = ?', [id]);
        return this._deleteRow('decomptes', id);
    }
    getPaiementStats(projetId) {
        return {
            totalDecomptes: this.getScalar('SELECT COUNT(*) FROM decomptes WHERE projet_id = ?', [projetId]),
            montantMandate: this.getScalar("SELECT COALESCE(SUM(montant_net_a_payer),0) FROM decomptes WHERE projet_id = ? AND statut IN ('Mandaté','Payé')", [projetId]),
            montantPaye: this.getScalar("SELECT COALESCE(SUM(montant_net_a_payer),0) FROM decomptes WHERE projet_id = ? AND statut = 'Payé'", [projetId]),
            enCours: this.getScalar("SELECT COUNT(*) FROM decomptes WHERE projet_id = ? AND statut NOT IN ('Payé','Rejeté')", [projetId])
        };
    }

    // ============================================================
    // AVENANTS — modifications de marché (montant / délai)
    // ============================================================
    createAvenant(data) {
        const res = this.run(`INSERT INTO avenants (projet_id, lot_id, numero, objet, montant_avenant, delai_jours, date_avenant, motif, statut)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.projet_id, data.lot_id || null, data.numero, data.objet, parseFloat(data.montant_avenant) || 0, parseInt(data.delai_jours) || 0, data.date_avenant || null, data.motif || null, data.statut || 'Proposé']);
        this.logEvent({ acteur_type: 'MOD', action: 'Avenant établi', cible_type: 'avenant', cible_id: res.lastInsertRowid, projet_id: data.projet_id, details: `${data.numero} — ${Math.round(parseFloat(data.montant_avenant) || 0)} DH / ${parseInt(data.delai_jours) || 0} j` });
        return res;
    }
    getAvenantsByProjet(projetId) {
        return this.all(`SELECT a.*, l.code_lot FROM avenants a LEFT JOIN lots l ON a.lot_id = l.id WHERE a.projet_id = ? ORDER BY a.date_avenant DESC, a.id DESC`, [projetId]);
    }
    updateAvenantStatut(id, statut) {
        this.run('UPDATE avenants SET statut = ? WHERE id = ?', [statut, id]);
        const a = this.get('SELECT * FROM avenants WHERE id = ?', [id]);
        if (a) this.logEvent({ acteur_type: 'MOD', action: `Avenant ${statut}`, cible_type: 'avenant', cible_id: id, projet_id: a.projet_id, details: a.numero });
        return { success: true };
    }
    deleteAvenant(id) { return this._deleteRow('avenants', id); }

    // ============================================================
    // GPA — Garantie de Parfait Achèvement (12 mois après réception)
    // ============================================================
    createGpa(data) {
        let fin = data.date_fin_gpa;
        if (!fin && data.date_reception) { const d = new Date(String(data.date_reception).slice(0, 10) + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 1); fin = d.toISOString().slice(0, 10); }
        const res = this.run(`INSERT INTO gpa (projet_id, lot_id, date_reception, date_fin_gpa, montant_retenue, statut, observations)
            VALUES (?, ?, ?, ?, ?, 'En cours', ?)`,
            [data.projet_id, data.lot_id || null, data.date_reception, fin || null, parseFloat(data.montant_retenue) || 0, data.observations || null]);
        this.logEvent({ acteur_type: 'MOD', action: 'GPA ouverte', cible_type: 'gpa', cible_id: res.lastInsertRowid, projet_id: data.projet_id, details: `réception ${data.date_reception} → fin ${fin || '?'}` });
        return res;
    }
    getGpaByProjet(projetId) {
        return this.all(`SELECT g.*, l.code_lot,
            (SELECT COUNT(*) FROM gpa_desordres d WHERE d.gpa_id = g.id) as nb_desordres,
            (SELECT COUNT(*) FROM gpa_desordres d WHERE d.gpa_id = g.id AND d.statut = 'Ouvert') as nb_ouverts
            FROM gpa g LEFT JOIN lots l ON g.lot_id = l.id WHERE g.projet_id = ? ORDER BY g.date_reception DESC, g.id DESC`, [projetId]);
    }
    closeGpa(id) {
        const ouverts = this.getScalar("SELECT COUNT(*) FROM gpa_desordres WHERE gpa_id = ? AND statut = 'Ouvert'", [id]);
        if (ouverts > 0) return { success: false, error: `${ouverts} désordre(s) encore ouvert(s) — à résoudre avant clôture.` };
        this.run("UPDATE gpa SET statut = 'Clôturée' WHERE id = ?", [id]);
        const g = this.get('SELECT * FROM gpa WHERE id = ?', [id]);
        if (g) this.logEvent({ acteur_type: 'MOD', action: 'GPA clôturée (retenue libérable)', cible_type: 'gpa', cible_id: id, projet_id: g.projet_id, details: '' });
        return { success: true };
    }
    deleteGpa(id) { this.run('DELETE FROM gpa_desordres WHERE gpa_id = ?', [id]); return this._deleteRow('gpa', id); }
    addGpaDesordre(data) {
        const res = this.run(`INSERT INTO gpa_desordres (gpa_id, description, gravite, date_signalement, signale_par, statut)
            VALUES (?, ?, ?, ?, ?, 'Ouvert')`,
            [data.gpa_id, data.description, data.gravite || 'Moyenne', data.date_signalement || null, data.signale_par || null]);
        return res;
    }
    getGpaDesordres(gpaId) { return this.all('SELECT * FROM gpa_desordres WHERE gpa_id = ? ORDER BY statut, date_signalement DESC, id DESC', [gpaId]); }
    resolveGpaDesordre(id) {
        const today = new Date().toISOString().slice(0, 10);
        return this.run("UPDATE gpa_desordres SET statut = 'Résolu', date_resolution = ? WHERE id = ?", [today, id]);
    }
    deleteGpaDesordre(id) { return this._deleteRow('gpa_desordres', id); }

    // ============================================================
    // BUDGET — marché initial + avenants vs engagé/payé (maîtrise des dérives)
    // ============================================================
    getProjetBudget(projetId) {
        const projet = this.get('SELECT montant_marche FROM projets WHERE id = ?', [projetId]);
        const marcheInitial = (projet && projet.montant_marche) || 0;
        const avenantsApprouves = this.getScalar("SELECT COALESCE(SUM(montant_avenant),0) FROM avenants WHERE projet_id = ? AND statut = 'Approuvé'", [projetId]);
        const avenantsDelai = this.getScalar("SELECT COALESCE(SUM(delai_jours),0) FROM avenants WHERE projet_id = ? AND statut = 'Approuvé'", [projetId]);
        const nbAvenants = this.getScalar('SELECT COUNT(*) FROM avenants WHERE projet_id = ?', [projetId]);
        const marcheRevise = marcheInitial + avenantsApprouves;
        const montantTTC = this.getScalar('SELECT COALESCE(SUM(montant_ttc),0) FROM decomptes WHERE projet_id = ?', [projetId]);
        const engage = this.getScalar("SELECT COALESCE(SUM(montant_net_a_payer),0) FROM decomptes WHERE projet_id = ? AND statut NOT IN ('Rejeté')", [projetId]);
        const mandate = this.getScalar("SELECT COALESCE(SUM(montant_net_a_payer),0) FROM decomptes WHERE projet_id = ? AND statut IN ('Mandaté','Payé')", [projetId]);
        const paye = this.getScalar("SELECT COALESCE(SUM(montant_net_a_payer),0) FROM decomptes WHERE projet_id = ? AND statut = 'Payé'", [projetId]);
        const resteAPayer = Math.max(0, marcheRevise - paye);
        const pctPaye = marcheRevise > 0 ? Math.round(paye / marcheRevise * 100) : 0;
        const pctEngage = marcheRevise > 0 ? Math.round(engage / marcheRevise * 100) : 0;
        return {
            marcheInitial, avenantsApprouves, avenantsDelai, nbAvenants, marcheRevise,
            engage, mandate, paye, resteAPayer, pctPaye, pctEngage, montantTTC,
            depassement: engage > marcheRevise && marcheRevise > 0,
            depassementMontant: engage > marcheRevise ? engage - marcheRevise : 0
        };
    }

    close() {
        if (this.db) {
            this.save();
            this.db.close();
        }
    }
}

module.exports = AppDatabase;
