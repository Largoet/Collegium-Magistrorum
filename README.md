# Collegium Magistrorum

🎮 **Gamifier l’apprentissage, pratiquer le DevOps, progresser en continu.**

Collegium Magistrorum est un projet personnel qui explore la **recherche de dopamine dans le travail** grâce à la **gamification** et à la méthode **Pomodoro**.  
Chaque session de concentration (focus) devient un petit défi clair, limité dans le temps, et récompensé comme dans un jeu vidéo.  
Le but : **réduire la friction mentale pour se mettre au travail** et rendre l’effort immédiatement gratifiant.

Chaque séance est transformée en **quête** avec un cadre clair et des récompenses tangibles.  
À la fin, le joueur reçoit des **récompenses virtuelles** qui stimulent la motivation :  

- **EXP et niveaux** → progression personnelle et titres honorifiques.  
- **Guildes** → appartenance à une maison avec hiérarchie et rôles évolutifs.  
- **Objets collectables** → inventaire unique avec bonus passifs qui influent sur la progression.  
- **Quêtes journalières** → objectifs variés pour introduire de la nouveauté et maintenir l’envie.  

➡️ Résultat : moins de résistance pour se lancer, et une boucle de feedback positive :  
**effort → récompense → progression visible → envie de continuer**.  

---

## ✨ Objectifs

- **Auto-motivation** : ancrer des habitudes de concentration et de régularité.  
- **Laboratoire technique** : mettre en pratique **Node.js / TypeScript**, **Docker**, **CI/CD** et de l’**administration système**.  

---

## ⚙️ Fonctionnement

- **Interface** : Discord (slash commands + panneaux interactifs).  
- **Bot** : gère XP, guildes, quêtes journalières, boutique, inventaire, classements.  
- **Base de données** : SQLite (migration vers PostgreSQL prévue).  
- **Déploiement** : Docker + CI/CD GitHub Actions sur serveur personnel (**Kinto Cloud**).  

---

## 🎯 Fonctionnalités actuelles (MVP)

- `/focus` → lancer une session (1 à 60 min) avec validation d’XP.  
- `/profile` → afficher la progression (XP, niveaux, titres, guilde).  
- `/daily` → générer une quête journalière.  
- `/shop` + `/buy` → boutique quotidienne avec objets de raretés variées.  
- `/leaderboard` → classement global.  
- **Panneaux permanents** dans chaque canal : focus, guilde, boutique, quêtes, profil.  
- **Inventaire par utilisateur**.  
- **Titres évolutifs** par guilde (progression en XP → montée de rangs).  

---

## 🛠️ Stack technique

### Développement
- **Discord.js** (Node.js + TypeScript).  
- Architecture modulaire (progression, guildes, boutique, inventaire, quêtes).  
- Embeds Discord + panneaux interactifs.  

### Hébergement & DevOps
- Serveur **Debian auto-hébergé** (Kinto Cloud).  
- **Docker Compose** : isolation & persistance.  
- **CI/CD GitHub Actions** : build → push GHCR → déploiement automatisé via SSH.  
- Variables d’environnement pour les secrets.  

---

## 🚀 Roadmap

- [x] MVP (XP, guildes, boutique, quêtes journalières, panels interactifs).  
- [x] CI/CD + Docker déployé sur serveur perso.  
- [ ] Migration PostgreSQL + sauvegardes automatisées.  
- [ ] Statistiques avancées (XP par compétence, temps par semaine).  
- [ ] Saisons et défis hebdomadaires.  
- [ ] Monitoring / alerting (**Prometheus + Grafana**).  
- [ ] Visualisations graphiques (progression, historique XP).  

---

## 🧭 Philosophie

Ce projet explore la **gamification saine** :  

- Pas de grind infini ni de compétition toxique.  
- Progression personnelle et coopération avant tout.  
- Dopamine liée à de vrais objectifs atteints.  
- Usage domestique et pédagogique.  

---

## 📜 Licence & contributions
Projet personnel, évolutif.
