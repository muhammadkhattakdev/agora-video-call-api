FROM node:18-alpine AS base

WORKDIR /app

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    dumb-init

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

FROM base AS development

RUN npm ci

COPY . .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

RUN mkdir -p logs uploads uploads/avatars uploads/documents uploads/recordings uploads/temp uploads/thumbnails && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

CMD ["npm", "run", "dev"]

FROM base AS production

COPY --chown=node:node . .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

RUN mkdir -p logs uploads uploads/avatars uploads/documents uploads/recordings uploads/temp uploads/thumbnails && \
    chown -R nodejs:nodejs /app && \
    chmod -R 755 /app

RUN rm -rf .git .gitignore README.md docs tests *.md

USER nodejs

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 5000, path: '/health', timeout: 5000 }; \
    const req = http.request(options, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]

CMD ["npm", "start"]

FROM development AS testing

COPY tests/ ./tests/

RUN npm test

FROM node:18-alpine AS production-optimized

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production --silent && npm cache clean --force

COPY --from=production --chown=node:node /app .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 5000, path: '/health/live', timeout: 5000 }; \
    const req = http.request(options, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

CMD ["node", "server.js"]