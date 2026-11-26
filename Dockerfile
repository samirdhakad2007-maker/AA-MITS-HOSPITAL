FROM node:22-bookworm-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js seed-admin.js ./
COPY client ./client

ENV HOST=0.0.0.0
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
