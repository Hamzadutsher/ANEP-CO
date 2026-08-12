# ANEP MOD — Gestion de la Maîtrise d'Ouvrage Déléguée

Application de gestion des projets de construction en **maîtrise d'ouvrage déléguée** pour l'ANEP
(Agence Nationale des Équipements Publics). Disponible en **application desktop (Windows)** et en
**application web** (accès partagé multi-utilisateurs depuis un navigateur).

## Fonctionnalités clés

- **Interfaces cloisonnées par rôle** : MOD (maître d'ouvrage), Architecte, BET, BCT, Laboratoire, Topographe, Entreprise — chaque intervenant ne voit que ses tâches.
- **Moteur de workflow automatisé** : déclaration d'achèvement → réceptions (Architecte/Topo/BET/BCT) → validation → bétonnage → essais labo 7j/28j → clôture.
- **Suivi & contrôle** : workflow (Kanban), réserves, essais laboratoire, HQSE (matrice de criticité).
- **Planning & délais** : Gantt par lot, ordres de service, interfaces entre lots, météo/intempéries (Open-Meteo) → OS de prolongation.
- **Décomptes & Paiements** : attachements, décomptes (HT/TVA/retenue/net), circuit de mandatement (validation → visa → mandatement → paiement).
- **Documentation & PV** : GED (plans, notes de calcul…), photothèque, comptes rendus/PV imprimables, outil de croquis.
- **Gestion** : équipe MOD nominative, sessions intervenants, permissions par module, permanence chantier, journal d'audit.
- **Reporting** : tableaux de bord, export PDF/CSV, sauvegarde/restauration de la base.

## Démarrage rapide

```bash
npm install
```

**Mode Web** (recommandé — accès partagé) :
```bash
npm run serve        # http://localhost:3000  (HTTPS : npm run gen-cert puis :3443)
```

**Mode Desktop** (Electron / Windows) :
```bash
npm start
```

Comptes de démonstration et détails d'utilisation : voir **[GUIDE.md](GUIDE.md)**.
Déploiement (HTTPS, auto-start Windows, Docker) : voir **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Architecture

- **Cœur métier commun** : `database/db.js` (SQLite via `sql.js`, schéma `database/schema.sql`).
- **Frontend** : SPA JavaScript vanilla (`src/`) — thème clair, police Cairo, charte ANEP.
- **Desktop** : Electron (`main.js` / `preload.js`, IPC).
- **Web** : serveur Express (`server.js`) exposant une API HTTP **authentifiée par jeton** ; l'adaptateur `src/js/api-web.js` reproduit l'interface `window.api` — **le frontend est commun aux deux modes**.

## Sécurité

- Mots de passe **chiffrés (bcrypt)**.
- API web protégée par **jeton** (délivré à la connexion, requis pour chaque appel et téléchargement).
- Support **HTTPS** (certificat auto-signé fourni via `npm run gen-cert`).

---

© ANEP — Agence Nationale des Équipements Publics. Usage interne.
