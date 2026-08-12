# ANEP MOD — image serveur web
FROM node:20-slim

WORKDIR /app

# Dépendances de production uniquement (exclut electron/electron-builder)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Code applicatif
COPY database ./database
COPY src ./src
COPY server.js ./
COPY scripts ./scripts

ENV PORT=3000
ENV HTTPS_PORT=3443

# Données partagées (base, documents, sauvegardes) → volume persistant
VOLUME ["/app/data"]

EXPOSE 3000 3443

CMD ["node", "server.js"]
