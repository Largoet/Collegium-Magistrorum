# Cahier des charges – MVP *Collegium*

> **But** : un bot Discord simple qui transforme des sessions de travail/étude en progression RPG (XP, niveaux). Déploiement sur **mon serveur Kinto Cloud** dans **Docker**.

---

## 1) Périmètre MVP

**Inclus (v1)**

* Slash‑commands de base :

  * `/ping` (test)
  * `/focus start` (timer Pomodoro + boutons *Valider / Interrompu*)
  * `/profile` (fiche personnage synthétique)
  * `/stats` (totaux jour/semaine/30j)
* **Compétences réelles** : sélection d’une compétence par session (catalogue court, éditable).
* **XP simple et saine** : 1 XP / minute validée (+ éventuel bonus streak quotidien *débrayable*).
* **Persistance légère** : SQLite (fichier monté en volume Docker).
* **Hébergement** : conteneur Docker, redémarrage auto, **pas de ports entrants**.

**Exclus (post-MVP)**

* Coop (timers partagés), leaderboards publics, badges/loot, rôles automatiques, DB PostgreSQL, CI/CD, monitoring avancé.

---

## 2) Exigences fonctionnelles

### 2.1 Commandes & comportements

* `/focus start minutes:<10|15|25|30|45|60> skill:<texte> sujet:<texte?>`

  * Démarre un *timer* et poste un **embed** avec : durée, compétence, sujet, heure de fin, boutons **désactivés**.
  * À la fin : le bot *ping* l’utilisateur, active les boutons :

    * **✅ Valider** → crée une **session** (durée réelle), crédite l’**XP** et met à jour les stats.
    * **❌ Interrompu** → log « abandonné », pas d’XP.
* `/profile` → embed **fiche personnage** : XP total, niveau global, **Top 5 compétences (30j)**, streak du jour.
* `/stats range:<today|7d|30d>` → temps cumulé, nb de sessions, XP cumulé, répartition par compétences.
* **Accessibilité** : offrir des **boutons rapides** (15/25/30) et un **menu** de sélection de compétence pour éviter la saisie.

### 2.2 Règles XP / niveau (MVP)

* **Base** : 1 XP / minute **validée** (prorata si ≠ 25 min).
* **Niveau global** : palier tous les 200 XP (linéaire pour MVP).
* **Streak (option)** : +1% / jour consécutif (cap 30%) ; **désactivable** via préférence utilisateur.

### 2.3 Modèle de compétences (sobre)

* **Catalogue court** par défaut (éditable) : `Linux`, `Docker`, `Réseau`, `Python`, `Lecture`, `Maths`.
* Profondeur **max 2** (ex. Réseau → DNS) pour éviter l’explosion des données.

---

## 3) Exigences non‑fonctionnelles

* **Disponibilité** : >95% / semaine (reboot nocturne accepté). Redémarrage automatique du conteneur.
* **Sécurité** :

  * Token Discord **en variable d’environnement** (jamais dans le code).
  * Bot en **utilisateur non‑root** dans le conteneur ; intents Discord **minimaux**.
  * Journaux sans secrets.
* **Performance** : bot réactif (< 200 ms pour une réponse simple hors fin de timer).
* **Coût** : **0 € supplémentaire** (serveur existant), pas de service tiers obligatoire.
* **Éthique** : usage **personnel/familial**, pas de classement public par défaut.

---

## 4) Architecture & déploiement

### 4.1 Schéma

* **Discord** (Gateway) ⇄ **Bot Prométhée** (container Node.js) ⇄ **SQLite** (volume Docker)
* **Sortants uniquement** (HTTPS 443 vers Discord). Aucun **port entrant** requis.

### 4.2 Docker (exigences)

* Image **légère** (node\:alpine), `NODE_ENV=production`.
* **Healthcheck** simple (ping interne) ; `restart: unless-stopped`.
* Volume `./data:/app/data` pour `bot.db`.

### 4.3 Déploiement (MVP)

* **Manuel** : `docker compose up -d` sur **Kinto Cloud**.
* Logs : `docker logs -f promethee-bot`.
* Sauvegarde : copie hebdo de `/app/data/bot.db`.

---

## 5) Données & schéma minimal (SQLite)

* `users(discord_id PK, prefs_json)`
* `skills(id PK, name, parent_id NULLABLE, active BOOL)` – *catalogue global court*
* `sessions(id PK, user_id, started_at, duration_min, status ENUM('done','aborted'), skill_id, subject TEXT)`
* `xp_log(id PK, user_id, skill_id, delta_xp, at_ts)`
* `streaks(user_id PK, current INT, best INT, last_day DATE)`

**Principe** : 1 **ligne par session**, agrégats calculés à la volée pour 7/30 jours. Pas d’événements à la minute.

---

## 6) Tests d’acceptation (DoD MVP)

1. **/ping** répond « *Pong* » (éphémère) en < 200 ms.
2. **/focus start 25 skill\:Linux sujet:"TP permissions"** → embed affiché avec boutons **désactivés**.
3. À 25:00, le bot **ping** ; **✅ Valider** crée `session(done, 25)` + `xp_log(+25)` ; `/profile` montre XP et top compétences.
4. **❌ Interrompu** crée `session(aborted)` sans `xp_log`.
5. **/stats 7d** retourne : total minutes, nb sessions, XP par compétence.
6. Reboot du serveur → conteneur **revient** et `/ping` fonctionne ; la DB est intacte.
7. Token absent → le bot **ne démarre pas** et logue une erreur explicite.

---

## 7) Exploitation (runbook minimal)

* **Démarrer** : `docker compose up -d`
* **Arrêter** : `docker compose down`
* **Logs** : `docker logs -f promethee-bot`
* **Sauvegarde** : `cp data/bot.db backups/bot_$(date +%F).db`
* **Restauration** : `docker compose down && cp backups/<file>.db data/bot.db && docker compose up -d`

---

## 8) Post‑MVP (priorité)

1. **Rôles automatiques** par paliers d’XP (couleurs dans Discord).
2. **Badges sobres** (peu nombreux, signifiants) + petites surprises (loot visuel).
3. **Coop** : timers partagés / bonus si tous valident.
4. **Leaderboards** *opt‑in* (privés par défaut).
5. **CI/CD** (GitHub Actions) + **PostgreSQL** + monitoring léger (Loki/Grafana optionnel).

---

## 9) Conformité au “contrat serveur”

* **Toujours en ligne** hors redémarrage nocturne ⇒ OK via Docker + `restart`.
* **Pas de service payant** ⇒ hébergement **Kinto Cloud** existant.
* **Sécurité** ⇒ secrets hors code, privilèges minimaux, aucun port entrant.
* **Formation** ⇒ conteneurisation, déploiement, logs, sauvegardes (Admin/DevOps).
