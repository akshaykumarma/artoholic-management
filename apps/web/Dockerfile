FROM node:20-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @artoholic/web --include-workspace-root

FROM deps AS build
COPY . .
RUN npm run build -w @artoholic/web

FROM node:20-bookworm-slim
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate -w @artoholic/web && npm run start -w @artoholic/web"]
