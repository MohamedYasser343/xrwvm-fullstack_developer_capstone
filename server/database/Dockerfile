FROM node:18.12.1-bullseye-slim

RUN npm install -g npm@9.1.3

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY app.js dealership.js review.js ./
COPY data ./data

EXPOSE 3030

CMD [ "node", "app.js" ]
