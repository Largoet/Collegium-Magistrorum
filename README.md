# Collegium Magistrorum

🎮 **Gamifier l’apprentissage, pratiquer le DevOps, progresser en continu.**

**Collegium Magistrorum** est un projet personnel qui transforme les séances de travail en un jeu RPG sur Discord.  
Chaque session de focus devient une quête avec XP, guildes, inventaire et récompenses.  

Le projet a deux vocations :  
- **Auto-motivation** : ancrer des habitudes de concentration et de régularité.  
- **Laboratoire technique** : mettre en pratique du **Node.js / TypeScript**, du **Docker**, du **CI/CD** et de l’**administration système**.  

---

## ⚙️ Fonctionnement

- **Interface** : Discord (slash commands + panneaux interactifs).  
- **Bot** : gère XP, guildes, quêtes journalières, boutique, inventaire, leaderboards.  
- **Base** : SQLite (migration PostgreSQL prévue).  
- **Déploiement** : Docker + CI/CD GitHub Actions sur serveur personnel (*Kinto Cloud*).  

---

## 🎯 Fonctionnalités actuelles (MVP)

- `/focus` → lance une session (1 à 60 min) avec validation XP.  
- `/profile` → affiche progression (XP, niveaux, titres, guilde).  
- `/daily` → génère une quête journalière.  
- `/shop` + `/buy` → boutique aléatoire quotidienne (objets communs → uniques).  
- `/leaderboard` → classement global.  
- **Panneaux permanents** dans les canaux Discord : focus, guilde, boutique, quêtes, profil.  
- Inventaire par utilisateur.  
- Titres de guilde évolutifs (XP → progression de rangs).  

---

## 🛠️ Stack technique

### Développement
- **Discord.js** (Node.js/TypeScript).  
- Architecture modulaire : progression, guildes, boutique, inventaire, quêtes.  
- Embeds Discord + panneaux interactifs.  

### Hébergement & DevOps
- Serveur **Debian** auto-hébergé (*Kinto Cloud*).  
- **Docker Compose** : isolation & persistance.  
- **CI/CD GitHub Actions** : build image → push GHCR → déploiement automatisé via SSH.  
- Secrets en variables d’environnement.  

---

## 🚀 Roadmap

- [x] MVP (XP, guildes, boutique, quêtes journalières, panels interactifs).  
- [x] CI/CD + Docker déployé sur serveur.  
- [ ] Migration PostgreSQL + sauvegardes automatisées.  
- [ ] Statistiques avancées (XP par compétence, temps par semaine).  
- [ ] Saisons et défis hebdomadaires.  
- [ ] Monitoring/alerting (Prometheus + Grafana).  
- [ ] Visualisations graphiques (progression, historique XP).  

---

## 🧭 Philosophie

Ce projet explore la **gamification saine** :  
- Pas de grind infini ni de compétition toxique.  
- Progression personnelle et coopération avant tout.  
- Dopamine liée à de vrais objectifs atteints.  
- Usage **domestique / pédagogique** (pas de RH, pas de management par le jeu).  

---

## 📜 Licence & contributions

Projet personnel, évolutif.  
