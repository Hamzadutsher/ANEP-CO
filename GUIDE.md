# ANEP MOD — Guide d'utilisation

Application desktop (Windows 10/11) de gestion des projets en **Maîtrise d'Ouvrage Déléguée**.
Interface **mode clair moderne** (charte ANEP, police Inter), fonctionnement **100 % hors-ligne**.

## 🌐 Mode Web (accès partagé depuis navigateur — recommandé)

L'application peut fonctionner en **application web** : un seul serveur, une **base centralisée partagée**, et tout le monde y accède depuis son **navigateur** (aucune installation sur les postes).

**Démarrer le serveur** (sur le poste/serveur qui héberge) :
```bash
npm run serve
```
Puis ouvrir dans un navigateur :
- Sur le poste serveur : **http://localhost:3000**
- Depuis les autres postes du réseau : **http://<IP-du-serveur>:3000** (ex. `http://192.168.1.36:3000`)

> La base de données, les documents, photos et sauvegardes sont **partagés** côté serveur (`data/`). Chaque utilisateur se connecte avec son propre compte.
>
> Pour un déploiement Internet (hors réseau local), hébergez le serveur (VPS/cloud) derrière HTTPS.

**Sécurité** : l'API web est **protégée par jeton** (délivré à la connexion, requis pour tout appel et tout téléchargement de fichier). Associez-la au **HTTPS** (`npm run gen-cert`) pour chiffrer les échanges. Pour une forte montée en charge, la base peut migrer vers `better-sqlite3`/PostgreSQL sans refonte du frontend (pont RPC).

## Installer / Lancer (mode Desktop)

**Option 1 — Installateur (recommandé pour déploiement)**
Double-cliquez sur `dist-installer/ANEP MOD Setup 1.0.0.exe` : installe l'application (raccourci bureau + menu Démarrer), sans besoin de Node.js. La base de données de chaque poste est stockée dans `%APPDATA%\anep-mod-app\`.

**Option 2 — Version portable**
Le dossier `dist-installer/win-unpacked/` contient `ANEP MOD.exe` exécutable directement (copiable sur clé USB).

**Option 3 — Mode développement**
```bash
npm start
```

Pour régénérer l'installateur : `npm run dist` (sortie dans `dist-installer/`).

## Comptes de connexion

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| **MOD** (vous — administrateur) | `admin` | `admin2026` |
| Architecte | `arch_bennani` | `arch2026` |
| Bureau d'Études Techniques (BET) | `bet_betec` | `bet2026` |
| Bureau de Contrôle Technique (BCT) | `bct_veritas` | `bct2026` |
| Laboratoire | `labo_lpee` | `labo2026` |
| Topographe | `topo_geotopo` | `topo2026` |
| Entreprise | `ent_tgcc` | `ent2026` |

> Le MOD crée et gère lui-même les sessions de chaque intervenant depuis le menu **Sessions**.
>
> 🔒 **Sécurité** : les mots de passe sont désormais **chiffrés (bcrypt)** en base — ils ne sont plus visibles. Le MOD peut les **réinitialiser** (bouton clé dans la page Sessions) ; le nouveau mot de passe s'affiche une seule fois pour être communiqué à l'intervenant.

## Le moteur de workflow automatisé

L'enchaînement décrit dans votre cahier des charges est automatisé de bout en bout :

1. **Entreprise** déclare l'achèvement (coffrage/ferraillage) d'un ouvrage
   → l'app saisit et **notifie automatiquement** Architecte, Topographe, BET et BCT.
2. Chaque intervenant émet son **avis** (favorable / avec réserves / défavorable) depuis sa propre interface.
   - Un avis défavorable ou avec réserves crée une **réserve** et **bloque** le bétonnage.
3. Quand **tous les avis sont favorables** (et réserves levées) → l'ouvrage est **validé** et le **bétonnage est autorisé** pour l'entreprise.
4. **Entreprise** déclare la date de bétonnage → le **Laboratoire est saisi automatiquement** pour les essais **7 jours et 28 jours** (échéances calculées selon les normes).
5. Le labo saisit ses résultats. Si **conformes à 28 j** → l'ouvrage est **clôturé** et le MOD est notifié.

### Scénario de démonstration (votre exemple)

L'ouvrage **« Plancher haut RDC Bloc A »** (projet Centre Hospitalier) est prêt en phase de validation :
- Connectez-vous en **Architecte**, **Topographe**, **BET** puis **BCT** → soumettez un avis favorable pour chacun.
- Reconnectez-vous en **Entreprise** → l'étape « Déclarer le bétonnage » apparaît.
- Déclarez le bétonnage → connectez-vous en **Laboratoire** → saisissez les résultats.

## Fonctionnalités par module (interface MOD)

- **Dashboard / Reporting** : indicateurs interactifs + **export du rapport de synthèse** (PDF/impression) pour votre hiérarchie.
- **Projets / Lots / Ouvrages** : allotissement, création d'ouvrages (déclenche le workflow).
- **Délais & Planning** : diagramme de Gantt par lot, délai consommé/restant, **alertes de dépassement**, export du planning.
- **Ordres de Service** : OS de commencement, arrêt, reprise, prolongation par lot.
- **Réserves / Essais Labo** : suivi transverse.
- **Réunions** : ajout des invités, envoi par **email** et **WhatsApp**, et génération de la **lettre de convocation officielle** (imprimable / PDF).
- **Journal / Traçabilité** : historique horodaté de toutes les actions (connexions, déclarations, avis, réserves, bétonnages…) pour l'audit.

## Nouveautés interfaces intervenants

- **Workflow — vue Kanban** : les ouvrages sont répartis en colonnes (À déclarer → En réception → Validé/Bétonnage → Contrôle labo → Terminé).
- **Grilles de vérification** : lors d'un avis (Architecte/BET/BCT/Topographe), une checklist adaptée au type de réception (réservations, alignement, ferraillage, enrobage…) est pré-remplie et enregistrée.
- **Historique** : chaque intervenant retrouve « Mes avis » ; le laboratoire retrouve ses résultats d'essais.

## Droits complets du MOD (création / modification / suppression)

En tant que MOD, vous disposez de **tous les privilèges CRUD** sur l'ensemble des modules :
- **Projets, Lots, Ouvrages, Intervenants, Ordres de service, Réunions** : boutons ✏️ **Modifier** et 🗑️ **Supprimer** sur chaque élément.
- **Sessions** : créer, réinitialiser le mot de passe, activer/désactiver, supprimer.
- **Réserves, Essais** : lever / supprimer.
- La suppression d'un projet ou d'un lot supprime aussi tous ses éléments liés (ouvrages, workflow, essais…). Un intervenant référencé ne peut être supprimé (désactivez-le) pour préserver l'intégrité des données.

## Modules avancés

- **Délais & Planning** : Gantt par lot, alertes de dépassement, + **Interfaces entre lots** (les réservations/baies du Gros Œuvre conditionnent les lots secondaires — fluides, CVC, courants forts/faibles, menuiserie, revêtements, faux plafonds ; statut Prêt/Livré/Bloqué).
- **Météo & Intempéries** : relevé journalier (saisie manuelle ou **capture automatique** via Open-Meteo selon la ville du projet, + lien de confirmation vers marocmeteo.ma). Les jours d'intempéries se comptabilisent et **génèrent un OS de prolongation** en un clic.
- **Décomptes & Paiements** : attachements (constat des travaux), décomptes (calcul auto HT/TVA/retenue de garantie/net à payer) et **circuit complet** : Validation technique (BET) → Vérification (Architecte) → Visa contrôle (BCT) → Visa MOD → **Mandatement** → **Paiement**, avec validation/remarques/rejet et n° de mandat à chaque étape.
- **Documents (GED)** : plans, notes de calcul, fiches techniques, PV, marchés… par projet, avec ouverture/téléchargement. Onglet Documents dans chaque projet.
- **Photothèque** : galerie de photos de chantier catégorisées (Avancement, Conformité, Anomalie, Réception), intégrées au **rapport de synthèse** pour les services supérieurs.
- **HQSE & Risques** : fiches Hygiène/Qualité/Sécurité/Environnement avec **matrice de criticité** (gravité × probabilité). L'entreprise saisit ; le MOD est **alerté automatiquement** sur les risques élevés/critiques et les accidents — anticipation avant non-conformité/accident.
- **Journal / Traçabilité** : audit horodaté de toutes les actions.
- **Documentation & PV (hub)** : un seul menu regroupe **Documents**, **Photothèque** et **Comptes rendus & PV** en onglets. Comptes rendus/PV avec **actions & responsabilités** par intervenant et **génération du PV imprimable**. Outil **croquis / annotation** (dessin sur plan) enregistré dans la photothèque.
- **Permanence chantier** : chaque intervenant **atteste sa présence** quotidienne (horaires, observations) ; le MOD suit la permanence de tous — traçabilité de la responsabilité.
- **Paramètres & Droits** (Administration) : **vous seul** ouvrez le volet financier (Décomptes & Paiements) au bon moment et accordez à chaque intervenant l'accès aux modules (Documentation, Météo, HQSE) et le droit de **saisir les attachements**.
- **Espaces intervenants enrichis** : chaque rôle (Architecte, BET, BCT, Laboratoire, Topographe, Entreprise) dispose d'un tableau de bord dédié avec sa **mission**, sa **présence du jour**, ses indicateurs et des **raccourcis métier**.

## Organisation du menu

Le menu MOD est regroupé par catégories : **Pilotage** · **Projets & Acteurs** · **Suivi technique** · **Planning & délais** · **Chantier & communication** · **Finances** · **Administration**.

## Sauvegarde & Export (menu Administration)

- **Sauvegarder la base** : enregistre une copie complète (`.db`) où vous voulez.
- **Restaurer** : remplace les données par une sauvegarde (copie de sécurité automatique avant).
- **Exporter en CSV (Excel)** : toutes les tables exportées pour analyse.
- **Sauvegardes automatiques** : créées à chaque démarrage (10 dernières conservées dans `%APPDATA%\anep-mod-app\backups\`).

## Où sont enregistrés les documents générés ?

Dans `Documents\ANEP-MOD\` (sous-dossiers `Lettres`, `Plannings`, `Rapports`).
Chaque document s'ouvre dans le navigateur : `Ctrl+P` → « Enregistrer au format PDF » ou imprimer.

## Architecture technique

- **Electron 33** (desktop Windows) + **sql.js** (base SQLite locale `data/anep_mod.db`).
- Isolation par rôle : chaque intervenant ne voit **que ses tâches**.
- Sauvegardes automatiques des fichiers modifiés dans `*.bak` / `database.bak` / `src.bak`.
