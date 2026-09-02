FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY services/debatelab-ops-mcp/package.json services/debatelab-ops-mcp/package.json
RUN npm ci --ignore-scripts
COPY services/debatelab-ops-mcp services/debatelab-ops-mcp
RUN npm run build -w @thinkfy/debatelab-ops-mcp

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY package.json package-lock.json ./
COPY services/debatelab-ops-mcp/package.json services/debatelab-ops-mcp/package.json
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/services/debatelab-ops-mcp/dist services/debatelab-ops-mcp/dist
USER node
EXPOSE 8080
CMD ["node", "services/debatelab-ops-mcp/dist/server.js"]
