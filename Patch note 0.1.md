Collegium Magistrorum — Patch Notes (MVP + Guildes)

✅ Fonctionnel

⚔️ Slash-commands

/focus : lance une session (1, 15, 25, 30, 45, 60 min) avec boutons Valider / Interrompre.

XP créditée à la validation (1 minute = 1 XP).

Anti-“interaction expirée” : on n’édite plus le message éphémère après échéance ; la validation est bloquée tant que le temps n’est pas écoulé.

/profile : affiche

Niveau global (30 j) + barre de progression.

XP par guilde (30 j) avec barres et titres de guilde (ex. Archimage), calculés à partir des XP taguées.

/houses-panel : publie un sélecteur de guilde (avec émojis).

Guilde unique : le bot retire l’ancienne et ajoute la nouvelle.

👥 Onboarding

À l’arrivée d’un membre : envoie le panneau de guilde en DM, sinon fallback vers un salon d’accueil configuré.

💾 Données & persistance

SQLite (better-sqlite3) avec migrations auto (ajout house_role_id).

Chaque session et log d’XP est tagué avec la guilde active au moment du focus → historique fidèle même après changement de guilde.

Requêtes prêtes : totalXP30d, totalSessions30d, topSkills30d, xpByHouse30d, totalXPAll.

🔐 Config & sécurité

Secrets via .env (validés avec zod).

Server Members Intent activé.

Rôle du bot avec Manage Roles, placé au-dessus des rôles de guilde.

Intégrations Discord configurées pour Use Application Commands dans les salons voulus.

🧰 Tech

Node.js + TypeScript / discord.js, better-sqlite3.

Structure propre (commands/lib), gestion d’erreurs et réponses éphémères.

✨ Qualité de vie ajoutée

Option 1 minute dans /focus pour tests rapides.

Sélecteur de guilde robuste (émoji optionnel, pas d’appel setEmoji si vide).

🚀 Projets futurs

🎯 Gamification avancée

Système de grades par guilde (progression interne : Novice → Maître).

Rangs universels en plus des guildes (ex. Apprenti, Maître du Collegium).

Succès / hauts faits (badges visuels affichés dans /profile).

🕒 Expérience utilisateur

Notifications de fin de focus (DM ou notification de salon).

Option sonore ou visuelle à la fin d’un timer.

Mode automatique : enchaîner plusieurs sessions (ex. Pomodoro 25+5).

📊 Statistiques et suivi

Commandes de stats globales (/leaderboard, /stats-serveur).

Export CSV/JSON des sessions personnelles.

Vue calendrier des focus validés (heatmap).

⚙️ Tech & persistance

Migration vers PostgreSQL (plus robuste pour le multi-serveur).

Dockerisation complète du bot (déploiement simplifié).

API REST interne pour exposer les stats (futur dashboard web).

🌐 Intégrations externes

Dashboard web : visualisation des profils, guildes et stats.

Connexion avec Notion / Trello pour synchroniser des tâches.

Intégration GitHub (ex. tagger du temps de dev en XP).

🎨 Cosmétiques & immersion

Cartes de profil personnalisées (images, couleurs par guilde).

Émojis/illustrations uniques pour les rôles et titres.

Ambiance medieval-fantasy renforcée (textes narratifs, lore).
