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

## Notes de production

- **Sauvegardes** : le serveur crée une sauvegarde automatique de la base à chaque démarrage (`data/backups/`, 10 dernières). Pensez aussi à sauvegarder le dossier `data/` (base + documents).
- **Pare-feu** : autorisez les ports **3000** (HTTP) et **3443** (HTTPS) sur le poste serveur pour l'accès réseau.
- **Sécurité de l'API** : l'API web est **protégée par jeton** — chaque appel exige un jeton délivré à la connexion (valable 12 h, prolongation glissante). Sans jeton valide → `401`. Les fichiers (documents, sauvegarde, PV générés) exigent aussi le jeton (`?t=`). Combinez avec **HTTPS** pour chiffrer le transport.
- **Montée en charge** : pour de nombreux utilisateurs simultanés, migrez la base de `sql.js` vers `better-sqlite3` ou PostgreSQL — le pont RPC (`server.js`) le permet **sans modifier le frontend**.
- **Reverse proxy** (recommandé en production Internet) : placez Nginx/Caddy devant le serveur Node pour gérer HTTPS (Let's Encrypt) et le nom de domaine.
