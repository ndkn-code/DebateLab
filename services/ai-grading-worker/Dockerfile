FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV NODE_OPTIONS=--conditions=react-server
ENV PORT=8080

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --ignore-scripts

COPY apps/web/src apps/web/src
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY packages/shared packages/shared
COPY services/ai-grading-worker services/ai-grading-worker

USER node
EXPOSE 8080

CMD ["./node_modules/.bin/tsx", "--tsconfig", "apps/web/tsconfig.json", "services/ai-grading-worker/src/server.ts"]
