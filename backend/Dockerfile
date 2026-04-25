FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nodeuser \
  && chown -R nodeuser:nodejs /app

USER nodeuser
EXPOSE 5000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
