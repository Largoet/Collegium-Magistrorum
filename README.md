# Collegium Magistrorum

## 1) Intention & origine

**Collegium Magistrorum** est un projet de **gamification de l’apprentissage**. L’idée : transformer des séances de travail/étude en un jeu à progression continue (quêtes, niveaux, récompenses) afin d’augmenter la motivation et la régularité sur le long terme.

Le projet sert un double objectif :

* **Outil personnel** pour ancrer des habitudes de travail profond et gratifiantes (dopamine par la progression).
* **Laboratoire technique** pour pratiquer concrètement **développement**, **administration système** et **pratiques DevOps**.

---

## 2) Comment ça fonctionne (vision fonctionnelle)

* **Plateforme** : Discord comme interface d’interaction quotidienne.
* **Bots** : un (ou plusieurs) bots Discord gèrent la progression (XP), les quêtes, les rôles de “guilde” (ex. Mage, Guerrier, Archer, Voleur) et des retours visuels (embeds, badges).
* **Boucle de feedback** : chaque tâche réelle accomplie → action simple dans Discord → gain d’XP / validation de quête → retour immédiat de progression.
* **Persistance** : une base de données (ex. PostgreSQL) stocke comptes, statistiques, quêtes, récompenses.
* **Extensions possibles** : calendrier d’objectifs, “saisons”, défis hebdomadaires, visualisations.

---

## 3) Objectifs du bot

* **Suivi** : comptabiliser des points d’étude/travail et attribuer de l’XP.
* **Progression** : niveaux, grades, rôles, badges.
* **Guidage** : quêtes et paliers construits à partir d’objectifs réels.
* **Lisibilité** : retours clairs (embeds Discord), commandes simples, ergonomie.

### 3.1 Compétences réelles & fiche personnage

L’évolution du « personnage » reflète des **compétences réelles** (ex. Docker, Python, Réseau, Multiplication, Lecture). Pour éviter une base de données hypertrophiée, on adopte une taxonomie **peu profonde** et **stable** :

* **Domaines** (ex. Informatique, Mathématiques, Langues, Lecture, Sport)
* **Compétences** par domaine (ex. Docker, Python, Réseau ; Multiplications ; Compréhension écrite)
* **Sous‑compétences (facultatives)** si nécessaire (ex. « Docker → Images », « Réseau → DNS »). Profondeur max : 2.

**Fiche personnage (vue synthétique)**

* Niveau global, XP total, **streak** (jours consécutifs)
* **Top 5 compétences** sur 30 jours (XP pondérée temps)
* Dernières quêtes complétées + temps total de focus de la journée
* Badges majeurs (jalons) → peu nombreux, mais signifiants

**Boucle simple** : tâche réelle → commande Discord → enregistrement d’une **session** (durée, compétence(s), note) → XP → mise à jour de la fiche.

---

## 4) MVP (Minimum Viable Product)

* Commande de test (`/ping → pong`).
* Attribution d’un **rôle de guilde** (au choix) via une commande dédiée.
* **Compteur de points** (étude/travail) par utilisateur et **gain d’XP** minimal.
* Persistance simple (fichier/SQLite), logs, et **déploiement** sur l’infrastructure personnelle.

**Commandes MVP (prévision)**

* `/start skill:<compétence> duration:25m note:?` → démarre/log une session de focus (type Pomodoro par défaut)
* `/complete` → clôt une session en cours (ou enregistre rapidement une session terminée)
* `/skill list|add|remove` → gestion basique du catalogue personnel
* `/profile` → fiche personnage (XP, top compétences 30j, streak)
* `/stats range:7d|30d` → synthèse temps/XP

**Après MVP** : utilisation quotidienne sur moi-même, puis **expérimentation familiale** (test pédagogique avec mon fils) pour évaluer l’adhésion et l’impact motivationnel.

---

## 5) Hébergement & architecture : choix assumés

### 5.1 Pourquoi pas seulement sur un PC local ?

* **Disponibilité** : un poste personnel n’est pas 24/7 (veille, redémarrages, usage concurrent).
* **Stabilité** : mises à jour, charge CPU, réseau domestique → déconnexions possibles.
* **Séparation des contextes** : le développement et la “prod” se parasitent facilement.
* **Sécurité** : secrets et dépendances vivent sur une machine d’usage quotidien.

### 5.2 Pourquoi pas un service managé payant (PaaS) ?

* **Contrainte budgétaire** : éviter un coût récurrent pour faire… du travail.
* **Pédagogie** : moins de contact avec l’infrastructure, donc moins d’apprentissage admin/DevOps.

### 5.3 Pourquoi mon **Kinto Cloud** (serveur personnel) **avec Docker** ?

* **Disponibilité maîtrisée** : serveur dédié qui tourne en continu (hors redémarrage planifié nocturne). Au démarrage, les conteneurs sont relancés automatiquement (`restart: unless-stopped`).
* **Isolation & reproductibilité** : images Docker figées → même comportement du dev à la prod.
* **Sécurité** : secrets hors code (variables d’environnement / secrets Docker), utilisateur non‑root, aucun port entrant requis pour le bot (connexion sortante vers l’API Discord).
* **Observabilité** : logs centralisés, redémarrages automatiques, métriques ajoutables.
* **Coût** : le serveur existe déjà → **aucun coût supplémentaire** ; autant l’exploiter.
* **Formation** : pratique réelle de **Linux**, **réseau**, **sécurité**, **déploiement**, **CI/CD**.

---

## 6) Axes techniques

### 6.1 Développement

* Discord.js (Node.js/TypeScript), commandes slash.
* Modèle de données : utilisateurs, XP, quêtes, rôles, badges.
* Conventions : linters/formatters, tests unitaires basiques, gestion d’erreurs structurée.

### 6.2 Administration Système

* Hébergement sur Debian (serveur personnel), exécution sous **Docker**.
* Gestion des **secrets** (.env, secrets Docker / SOPS), journaux, sauvegardes de la base.
* Supervision basique (uptime, logs). Évolution possible vers stack d’observabilité (Prometheus/Grafana/Loki).

### 6.3 DevOps

* **Conteneurisation** (Docker) et orchestration simple (docker‑compose).
* **CI/CD** (GitHub Actions) : build d’image, push registre, déploiement via SSH.
* **Infra as Code** (Ansible) : configuration serveur, services, pare‑feu, sauvegardes.
* **Rollbacks** via tags d’images, déploiements atomiques.

### 6.4 Modèle de compétences & données (MVP → évolutif)

**Entités minimales**

* `users` : profil Discord, préférences
* `skills` : `{ id, parent_id?, domain, name, slug, is_active }` (arbre peu profond)
* `activities` : `{ id, name, default_duration_min, default_xp_rate, type }` (ex. pomodoro, lecture, sport)
* `sessions` : `{ id, user_id, started_at, duration_min, xp_earned, note?, mood? }`
* `session_skills` : lien N\:N `{ session_id, skill_id, weight }` (pondération si multi‑compétences)
* `user_skill_stats` (agrégats) : `{ user_id, skill_id, xp_total, xp_last_30d, last_updated }`

**Principes**

* **Événements sobres** : 1 ligne **par session** (pas par minute). Pas de flux massifs.
* **Agrégats calculés** (cron/job) pour la vue rapide (Top 5, 30j). Les agrégats se recalculent la nuit.
* **Rétention** : conserver les `sessions` brutes 12–18 mois ; au‑delà, garder des agrégats mensuels.
* **Index** : `(user_id, started_at)` sur `sessions`, `(user_id, skill_id)` sur `user_skill_stats`.
* **Tags optionnels** (JSON) si besoin de granularité sans multiplier les colonnes.

**Règle XP (exemple simple)**

* Base : **1 XP / minute de focus** validée.
* Bonus jalons (peu fréquents) : 25 XP tous les 10 pomodoros complétés.
* Pas de ratio variable « casino » : privilégier des règles **prédictibles** et saines.

---

## 7) Expérimentation & amélioration continue

* **Phase 1 – Auto‑usage** : mesurer adhésion, friction, clarté de la boucle de feedback.
* **Phase 2 – Test encadré** : application scolaire (mon fils) pour évaluer l’intérêt pédagogique et la compréhension des mécaniques.
* **Itérations** : ajuster la granularité des quêtes, la fréquence des récompenses, la visualisation de la progression et les notifications afin d’optimiser la motivation **sans sur‑stimulation**.

> Note : l’objectif est de favoriser une **dopamine saine** liée à l’accomplissement d’objectifs réels (pas de “grind” artificiel). Les mécaniques sont pensées pour soutenir la concentration et la constance, pas pour distraire.

---

## 8) Roadmap (évolutive)

* [ ] MVP : commandes de base, rôle de guilde, compteur de points/XP, déploiement Docker.
* [ ] Progression universelle (niveaux, grades, badges).
* [ ] Quêtes liées à des objectifs réels (
  études/projets), validation et historiques.
* [ ] Persistance PostgreSQL + sauvegardes.
* [ ] CI/CD GitHub Actions (build/push/deploy).
* [ ] Monitoring (dashboards) et alerting simple.
* [ ] Saisons/défis hebdo, visualisations.

---

## 9) Mise en route (bientôt)

Une section "Quick Start" sera ajoutée lorsque le premier service sera prêt (image Docker, variables d’environnement, lancement compose).

---

## 10) Éthique & limites de la gamification

**Position** : la ludification est un **outil personnel** d’auto‑motivation, pas un levier RH de compétition. Le design évite les dynamiques délétères (classements agressifs, gratification matérielle, pression sociale).

**Garde‑fous de conception**

* **Opt‑in & privé par défaut** : la progression est personnelle ; pas de classement public.
* **Coopération plutôt que compétition** : objectifs partagés possibles, sans hiérarchie de « meilleurs ».
* **Récompenses sobres** : jalons symboliques et rares ; éviter la sur‑stimulation.
* **Transparence** : règles d’XP simples, visibles ; pas de boucles de récompense opaques.
* **Rythme sain** : intégration de pauses, limites de sessions, respect du repos.
* **Droit au retrait** : désactivation simple des notifications/ressorts ludiques.
* **Contexte** : usage domestique (étude, lecture, sport) ; **non** destiné à encadrer des salariés.

> Le but est d’augmenter la **clarté** et la **constance** de l’effort, pas d’induire une dépendance ou de normaliser une compétition permanente.

---

## 11) Licence & contributions

Projet personnel en phase d’exploration. Ouverture progressive envisagée (issues publiques, contributions ciblées) dès stabilisation du socle.
