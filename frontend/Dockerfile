FROM node:18-alpine

WORKDIR /app

# Copia os manifests primeiro (cache inteligente)
COPY package*.json ./

# Instala tudo (inclusive devDependencies, necessárias pro Vite)
RUN npm install

# Copia o restante do projeto
COPY . .

# Adiciona o diretório de binários do npm ao PATH
ENV PATH=/app/node_modules/.bin:$PATH

# Garante que os módulos sejam visíveis pro TypeScript e Vite
ENV NODE_PATH=/app/node_modules

# Expõe a porta padrão do Vite
EXPOSE 5173

# Roda o servidor dev do Vite (usa o npm script, não o vite direto)
CMD ["npm", "run", "dev", "--", "--host"]