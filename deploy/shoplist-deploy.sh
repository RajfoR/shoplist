#!/usr/bin/env bash
# Deploy Shoplist na VPS. Instalowany jako /usr/local/bin/shoplist-deploy (root:root, 755)
# i podpięty jako wymuszona komenda klucza CI w ~deploy/.ssh/authorized_keys:
#
#   restrict,command="/usr/local/bin/shoplist-deploy" ssh-ed25519 AAAA... shoplist-ci
#
# CI wywołuje:  ssh deploy@vps "<pełny SHA> <github-actor>"  z tokenem GHCR na stdin.
# Klucz CI nie daje shella. Pozwala tylko wdrożyć commit, który jest na main.
#
# Ręcznie (jako deploy):  shoplist-deploy <sha> [<github-user>]  < /dev/null
# (bez tokenu: pull zadziała tylko dla publicznego obrazu albo po własnym docker login)
set -euo pipefail

APP_DIR=/opt/shoplist
REPO="$APP_DIR/repo"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="$APP_DIR/backups"
KEEP_BACKUPS=10

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "BŁĄD: $*" >&2; exit 1; }

read -r SHA GH_USER EXTRA <<<"${SSH_ORIGINAL_COMMAND:-$*}" || true
[[ "${SHA:-}" =~ ^[0-9a-f]{40}$ ]] || die "oczekiwano pełnego SHA (40 znaków hex)"
[[ -z "${GH_USER:-}" || "$GH_USER" =~ ^[A-Za-z0-9-]{1,39}$ ]] || die "niepoprawna nazwa użytkownika"
[[ -z "${EXTRA:-}" ]] || die "nadmiarowe argumenty"
[[ -r "$ENV_FILE" ]] || die "brak $ENV_FILE"

# Dwa deploye naraz (push + ręczny rollback) czekają na siebie.
exec 9>"$APP_DIR/.deploy.lock"
flock -w 600 9 || die "inny deploy trwa za długo"

# Token GHCR (GITHUB_TOKEN joba) z stdin. Trzymamy go w tymczasowym DOCKER_CONFIG,
# więc nie zostaje na dysku po zakończeniu skryptu.
GHCR_TOKEN=""
if [[ ! -t 0 ]]; then IFS= read -r GHCR_TOKEN || true; fi
DOCKER_CONFIG="$(mktemp -d)"
export DOCKER_CONFIG
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
if [[ -n "$GHCR_TOKEN" ]]; then
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GH_USER:-ci}" --password-stdin >/dev/null
  unset GHCR_TOKEN
fi

log "commit $SHA"
cd "$REPO"
git fetch --quiet origin main
git merge-base --is-ancestor "$SHA" origin/main 2>/dev/null \
  || die "commit $SHA nie należy do historii main"
git -c advice.detachedHead=false checkout --quiet --detach "$SHA"

export IMAGE_TAG="$SHA"
compose() { docker compose -f "$REPO/deploy/compose.prod.yml" --env-file "$ENV_FILE" "$@"; }

# Migracje lecą przy starcie backendu i nie mają automatycznego downgrade'u,
# więc przed każdym deployem robimy dump (o ile baza już działa).
if [[ -n "$(compose ps -q --status running db)" ]]; then
  mkdir -p "$BACKUP_DIR"
  dump="$BACKUP_DIR/pre-$(date -u +%Y%m%dT%H%M%SZ)-${SHA:0:12}.dump"
  log "backup bazy → $dump"
  compose exec -T db pg_dump -U shoplist -d shoplist --format=custom >"$dump.part"
  mv "$dump.part" "$dump"
  find "$BACKUP_DIR" -name 'pre-*.dump' -printf '%T@ %p\n' | sort -rn \
    | tail -n +$((KEEP_BACKUPS + 1)) | cut -d' ' -f2- | xargs -r rm --
fi

log "pull obrazów"
compose pull --quiet

log "start (czekam na healthchecki)"
if ! compose up -d --remove-orphans --wait --wait-timeout 180; then
  compose ps
  compose logs --tail 80 backend
  die "kontenery nie wstały zdrowe"
fi

# Nowy Caddyfile z checkoutu. Przy niezmienionym configu reload nic nie robi.
compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

echo "$SHA" >"$APP_DIR/DEPLOYED_SHA"
# Zostawiamy obrazy z ostatniego tygodnia, żeby rollback nie musiał nic ściągać.
docker image prune -af --filter "until=168h" >/dev/null || true

log "OK: $SHA"
