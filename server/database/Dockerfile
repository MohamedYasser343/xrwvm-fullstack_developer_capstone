FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node app.js dealership.js inventory.js review.js ./
COPY --chown=node:node data ./data
USER node
EXPOSE 3030
CMD ["node", "app.js"]
