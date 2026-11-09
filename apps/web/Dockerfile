# syntax=docker/dockerfile:1
# Build z katalogu głównego repo: docker build -f apps/web/Dockerfile .

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
# Najpierw sam lockfile: warstwa z pobranymi paczkami cache'uje się,
# dopóki nie zmienią się zależności.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@shoplist/web..." \
 && pnpm --filter @shoplist/web build \
 && pnpm --filter @shoplist/web build-storybook

FROM caddy:2-alpine
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv/app
COPY --from=build /repo/apps/web/storybook-static /srv/storybook
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
