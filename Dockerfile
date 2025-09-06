# ---- Build stage ----
FROM node:22-bookworm AS build
WORKDIR /app

# Outils de build pour les modules natifs (better-sqlite3, skia-canvas…)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
 && rm -rf /var/lib/apt/lists/*

# Installe les deps (dev + prod) pour pouvoir builder
COPY package*.json ./
RUN npm ci

# Copie le code et build (TS -> JS)
COPY . .
RUN npm run build

# Passe en deps runtime uniquement (allège node_modules)
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:22-bookworm
WORKDIR /app
ENV NODE_ENV=production

# Copie le build ET les node_modules déjà compilés depuis l’étage build
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./

# Démarrage
CMD ["node", "dist/index.js"]
