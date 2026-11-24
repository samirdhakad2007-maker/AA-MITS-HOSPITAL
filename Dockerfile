FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json server.js index.html portal.js hospital-login.png ./
RUN npm install

ENV HOST=0.0.0.0
ENV NODE_ENV=production
EXPOSE 4173

CMD ["node", "server.js"]
