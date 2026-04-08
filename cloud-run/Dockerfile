FROM node:20-slim

WORKDIR /app

COPY package.json package.json
RUN npm install --omit=dev

COPY server.mjs server.mjs

ENV PORT=8080
CMD ["npm", "start"]
