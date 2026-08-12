# ANEP MOD — Guide de déploiement (mode Web)

Le serveur web (`server.js`) héberge l'interface + l'API et partage une base centralisée (`data/`).
Trois options de déploiement selon votre contexte.

---

## 1. Démarrage simple (test / usage immédiat)

```bash
npm run serve
```
Accès : `http://localhost:3000` (poste serveur) · `http://<IP-du-serveur>:3000` (postes du réseau).

---

## 2. HTTPS (connexion chiffrée)

1. Générer un certificat auto-signé (couvre localhost + IP locales, valable 10 ans) :
   ```bash
   npm run gen-cert
   ```
2. Relancer le serveur :
   ```bash
   npm run serve
   ```
   → HTTPS disponible sur `https://<IP-du-serveur>:3443` (en plus du HTTP).

> Avec un certificat **auto-signé**, le navigateur affiche un avertissement à accepter une fois (« Continuer vers le site »).
> Pour un vrai domaine public, remplacez `data/certs/server.key` et `server.crt` par un certificat officiel (Let's Encrypt, etc.).

---

## 3. Démarrage automatique sous Windows

Pour que le serveur démarre **tout seul** (poste/serveur Windows du réseau) :

- **Installer** : double-cliquez sur **`install-autostart-windows.bat`**
  → crée un raccourci de démarrage ; le serveur se lance à chaque ouverture de session.
- **Lancer manuellement** : double-cliquez sur **`start-anep-web.bat`**.
- **Désinstaller** : double-cliquez sur **`uninstall-autostart-windows.bat`**.

> Pré-requis : **Node.js** installé sur le poste serveur (https://nodejs.org).
> Pour un démarrage **sans session ouverte** (au boot, serveur dédié), utilisez le Planificateur de tâches Windows (déclencheur « Au démarrage », exécuter `start-anep-web.bat`, « Exécuter même si l'utilisateur n'est pas connecté »), ou un gestionnaire de service comme **NSSM**.

---

## 4. Docker (serveur / cloud / portabilité)

Pré-requis : Docker + Docker Compose.

```bash
docker compose up -d --build
```
Accès : `http://<hôte>:3000` (et `:3443` en HTTPS si certificat).
Les données persistent dans le dossier `./data` (monté en volume).

Arrêt : `docker compose down` · Logs : `docker compose logs -f`.

---

## 5. AWS (cloud)

> ⚠️ **AWS Amplify Hosting ne convient PAS.** Amplify héberge des sites **statiques** (ou SSR). ANEP MOD est un **serveur Node.js persistant** (`server.js`) avec base SQLite et fichiers sur disque : il faut un service qui **exécute un serveur/conteneur** avec **stockage persistant**. `npm start` lance Electron (desktop) — sur un serveur, la commande est toujours `node server.js`.

### 5.a — Lightsail ou EC2 + Docker (recommandé : conserve le modèle « un serveur, un dossier `data/` »)

C'est l'équivalent cloud exact de votre serveur local — **les données persistent** dans `./data` (volume Docker), aucune modification de code.

1. Créez une instance **Amazon Lightsail** (ou EC2) Linux (Ubuntu), 1–2 Go RAM suffisent.
2. Installez Docker :
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. Récupérez le projet et lancez-le :
   ```bash
   git clone https://github.com/Hamzadutsher/ANEP-CO.git && cd ANEP-CO
   npm run gen-cert            # (optionnel) HTTPS auto-signé
   docker compose up -d --build
   ```
4. Ouvrez les ports **3000** (et **3443**) dans le pare-feu Lightsail/EC2 (Security Group).
5. Accès : `http://<IP-publique>:3000`. Les données restent dans `./data` sur le disque de l'instance (pensez aux snapshots).

> Pour un nom de domaine + HTTPS Let's Encrypt, placez **Caddy** ou **Nginx** devant (reverse proxy).

### 5.b — AWS App Runner (entièrement managé, à partir du `Dockerfile`)

Le plus simple à mettre en ligne, mais **le stockage est éphémère** : la base et les fichiers repartent à zéro à chaque redéploiement.

1. Console **App Runner** → *Create service* → Source : **GitHub** → dépôt `ANEP-CO`.
2. Build : **Use a Dockerfile** (le `Dockerfile` du dépôt).
3. **Port : 3000**. Déployez.

> ✅ Idéal pour une **démo / préversion** publique.
> ❌ Pour un usage réel, migrez la base vers **RDS (PostgreSQL)** et les fichiers vers **S3** (le pont RPC de `server.js` le permet sans toucher au frontend), ou utilisez plutôt l'option **5.a**.

### 5.c — Elastic Beanstalk (plateforme Node.js)

Le fichier **`Procfile`** (`web: node server.js`) est fourni pour qu'EB lance le serveur (et non Electron).

1. Console **Elastic Beanstalk** → *Create application* → plateforme **Node.js**.
2. Téléversez un zip du projet (sans `node_modules`/`data`) ou connectez le dépôt.
3. EB installe les dépendances et exécute le `Procfile`. Le port est fourni via `process.env.PORT` (déjà géré).

> Stockage local persistant seulement tant que l'instance n'est pas reconstruite → pour les données durables, préférez **5.a** ou migrez vers RDS/S3.

---

## Notes de production

- **Sauvegardes** : le serveur crée une sauvegarde automatique de la base à chaque démarrage (`data/backups/`, 10 dernières). Pensez aussi à sauvegarder le dossier `data/` (base + documents).
- **Pare-feu** : autorisez les ports **3000** (HTTP) et **3443** (HTTPS) sur le poste serveur pour l'accès réseau.
- **Sécurité de l'API** : l'API web est **protégée par jeton** — chaque appel exige un jeton délivré à la connexion (valable 12 h, prolongation glissante). Sans jeton valide → `401`. Les fichiers (documents, sauvegarde, PV générés) exigent aussi le jeton (`?t=`). Combinez avec **HTTPS** pour chiffrer le transport.
- **Montée en charge** : pour de nombreux utilisateurs simultanés, migrez la base de `sql.js` vers `better-sqlite3` ou PostgreSQL — le pont RPC (`server.js`) le permet **sans modifier le frontend**.
- **Reverse proxy** (recommandé en production Internet) : placez Nginx/Caddy devant le serveur Node pour gérer HTTPS (Let's Encrypt) et le nom de domaine.
