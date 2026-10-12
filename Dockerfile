FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY server server
COPY shared shared
COPY src src
COPY api api
COPY index.html vite.config.ts tsconfig.json ./
RUN npm run db:generate && npx tsc -p server/tsconfig.json
ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["npm","run","start:server"]
