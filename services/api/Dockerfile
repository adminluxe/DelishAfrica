FROM node:18
WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./
RUN npm install  # ou pnpm install si vous utilisez pnpm

# Copie du reste du code
COPY . .

EXPOSE 3010
# Commande pour démarrer l’API (adaptez selon vos scripts)
CMD ["npm", "run", "dev"]
