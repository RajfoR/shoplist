# Produkcja: VPS + Caddy + CD z GHCR

```
push na main ─► CI (testy backendu, pakiety TS, build obrazu)
                 └─► push ghcr.io/<owner>/shoplist-{backend,web}:<sha>
                      └─► deploy.yml ─ssh─► shoplist-deploy <sha>   (wymuszona komenda)
                                             ├─ git checkout <sha> (tylko commit z main)
                                             ├─ pg_dump przed migracjami
                                             ├─ compose pull && up --wait
                                             └─ caddy reload
                           smoke.py: API /health, wss:// → 4401, web, /config.js, /storybook/
```

Na VPS:

```
Internet ──443/80──► caddy ─(edge)─┬─► backend:8000 ─(internal)─► db:5432
                      TLS, HTTP/3, CSP └─► web:8080 (SPA, /storybook/, /config.js)
```

Pliki:

| Plik | Rola |
|---|---|
| `compose.prod.yml` | caddy + backend + web (obrazy z GHCR) + postgres, bez publikowania portu bazy |
| `caddy/Caddyfile` | HTTPS z Let's Encrypt, reverse proxy z WebSocketami, CSP dla weba |
| `shoplist-deploy.sh` | skrypt deployu po stronie VPS, wymuszona komenda klucza CI |
| `smoke.py` | test po deployu: TLS, `/health`, upgrade WS przez proxy, web, Storybook, CSP |
| `.env.example` | wzór `/opt/shoplist/.env` |

## Jednorazowy setup

### 1. DNS

Rekordy `A` (i `AAAA`, jeśli VPS ma IPv6) dla `API_DOMAIN` i `WEB_DOMAIN` → IP VPS.
Muszą działać **przed** pierwszym startem Caddy'ego, inaczej walidacja ACME się nie
uda, a Let's Encrypt po kilku nieudanych próbach na godzinę blokuje kolejne.

```bash
dig +short api.example.pl   # musi zwrócić IP VPS
```

Bez własnej domeny: DuckDNS (`twojanazwa.duckdns.org` + `api.twojanazwa.duckdns.org`).
Nie używaj sslip.io/nip.io: limity Let's Encrypt są tam wspólne dla wszystkich i często wyczerpane.

### 2. VPS

Ubuntu 24.04, najlepiej 2 GB RAM (przy 1 GB dodaj swap). Jako admin (sudo):

```bash
# firewall: Docker omija ufw dla publikowanych portów, ale publikujemy tylko 80/443
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
sudo ufw enable

# Docker Engine + compose plugin z oficjalnego repo Dockera:
# https://docs.docker.com/engine/install/ubuntu/

# użytkownik deploy (bez hasła, logowanie tylko kluczem CI)
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy   # grupa docker = de facto root, stąd wymuszona komenda niżej
sudo install -d -o deploy -g deploy -m 750 /opt/shoplist
```

W `/etc/ssh/sshd_config` upewnij się, że jest `PasswordAuthentication no`.

### 3. Repo i sekrety na VPS

```bash
sudo -iu deploy

# Repo prywatne: klucz tylko do odczytu, dodany w GitHub → Settings → Deploy keys
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C "shoplist-vps-read"
cat ~/.ssh/id_ed25519.pub
ssh -T git@github.com   # zaakceptuj klucz hosta GitHuba

# Sam katalog deploy/, bez reszty monorepo
git clone --filter=blob:none --sparse git@github.com:OWNER/REPO.git /opt/shoplist/repo
git -C /opt/shoplist/repo sparse-checkout set deploy
# (repo publiczne: https://github.com/OWNER/REPO.git i bez deploy key)

cp /opt/shoplist/repo/deploy/.env.example /opt/shoplist/.env
chmod 600 /opt/shoplist/.env
nano /opt/shoplist/.env   # domeny, e-mail, BACKEND_IMAGE i WEB_IMAGE małymi literami, 2× openssl rand -hex 32
exit
```

Skrypt deployu instalujesz jako root, poza checkoutem. Push do repo nie podmieni
punktu wejścia klucza CI. Po zmianie skryptu w repo instalujesz go ponownie ręcznie:

```bash
sudo install -m 755 -o root -g root /opt/shoplist/repo/deploy/shoplist-deploy.sh /usr/local/bin/shoplist-deploy
```

### 4. Klucz CI z wymuszoną komendą

Na swoim komputerze (klucz prywatny trafi tylko do sekretów GitHuba):

```bash
ssh-keygen -t ed25519 -N "" -f shoplist-ci -C "shoplist-ci"
```

Na VPS, w `/home/deploy/.ssh/authorized_keys` (właściciel deploy, 600), jedna linia:

```
restrict,command="/usr/local/bin/shoplist-deploy" ssh-ed25519 AAAA...zawartość shoplist-ci.pub... shoplist-ci
```

`restrict` wyłącza pty, forwarding portów i agenta, a `command=` sprawia, że
niezależnie od tego, co klient wyśle, wykona się tylko skrypt deployu. Wysłana
komenda trafia do niego jako `$SSH_ORIGINAL_COMMAND` i jest walidowana.

Klucz hosta do przypięcia w CI:

```bash
ssh-keyscan -t ed25519 TWOJ_VPS > known_hosts_vps
# porównaj odcisk z tym, co pokazuje VPS (konsola dostawcy):
ssh-keygen -lf known_hosts_vps
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub    # na VPS
```

### 5. GitHub

Settings → Environments → **New environment: `production`**:

| Typ | Nazwa | Wartość |
|---|---|---|
| secret | `DEPLOY_HOST` | IP albo hostname VPS |
| secret | `DEPLOY_SSH_KEY` | zawartość pliku `shoplist-ci` (prywatny) |
| secret | `DEPLOY_KNOWN_HOSTS` | zawartość `known_hosts_vps` |
| variable | `API_URL` | `https://api.example.pl` (bez `/` na końcu) |
| variable | `WEB_URL` | `https://example.pl` (bez `/` na końcu) |

W tym samym ekranie: *Deployment branches* → **Selected branches** → `main`.

Settings → Actions → General → *Workflow permissions*: wystarczy domyślne
„Read repository contents”. Joby same podnoszą sobie `packages: write/read`.

### 6. Pierwszy deploy

Push na `main` (albo Actions → Deploy → Run workflow). Pierwszy start trwa dłużej:
Caddy wystawia dwa certyfikaty, a backend robi `alembic upgrade head` na pustej bazie.
Smoke test ponawia próby przez ~60 s.

Po deployu w GitHub → Packages pojawią się `shoplist-backend` i `shoplist-web`.
Mogą zostać prywatne, bo deploy loguje się do GHCR tokenem joba.

## Operacje

Wygodny alias na VPS (jako `deploy`):

```bash
alias sl='IMAGE_TAG=$(cat /opt/shoplist/DEPLOYED_SHA) docker compose -f /opt/shoplist/repo/deploy/compose.prod.yml --env-file /opt/shoplist/.env'

sl ps
sl logs -f backend
sl logs caddy | grep -i acme          # problemy z certyfikatem
sl exec db psql -U shoplist shoplist
```

**Rollback:** Actions → Deploy → Run workflow → SHA wcześniejszego commita z main.
Obrazy z ostatnich 7 dni są na VPS, starsze ściągnie z GHCR. Uwaga: migracje nie
cofają się same. Jeśli nowsza wersja zmieniła schemat, przywróć dump sprzed deployu:

```bash
ls -t /opt/shoplist/backups/
sl stop backend
sl exec -T db pg_restore -U shoplist -d shoplist --clean --if-exists < /opt/shoplist/backups/pre-....dump
```

i dopiero potem uruchom rollback z GitHuba.

**Zmiana `JWT_SECRET`** wylogowuje wszystkich (tokeny przestają być ważne).
**Zmiana `POSTGRES_PASSWORD`** w `.env` nie zmienia hasła w istniejącej bazie,
potrzebny jest też `ALTER USER shoplist PASSWORD '...'`.

## Ograniczenia, świadomie

- Jedna replika backendu: `realtime.py` trzyma pokoje WS w pamięci procesu. Druga
  replika wymaga Redis pub/sub (opisane w docstringu modułu).
- Restart przy deployu zrywa WebSockety, a klienci reconnectują się z backoffem
  i pobierają snapshot (CONTRACT.md, pkt 6). Requesty REST w tym czasie Caddy wstrzymuje
  do 30 s (`lb_try_duration`), zamiast od razu zwracać 502.
- `/docs` (Swagger) jest publiczny, przydaje się na demo.

## Web i Storybook

Kontener `web` to Caddy z buildem Vite (`/srv/app`) i statycznym Storybookiem
(`/srv/storybook`), nasłuchujący na 8080 bez TLS. Caddy brzegowy dokłada TLS,
kompresję i CSP. Storybook jest pod ścieżką `/storybook/`, więc nie potrzebuje
osobnej domeny ani certyfikatu.

`/config.js` generuje Caddy w kontenerze z `API_URL`/`WS_URL` (ustawiane
w `compose.prod.yml` z `API_DOMAIN`). Ten sam obraz działa więc na każdym
środowisku, a adresu API nie trzeba wypiekać w build.

CSP pozwala łączyć się tylko z własnym originem i `API_DOMAIN` (`https://` i `wss://`).
Storybook jest z niego wyłączony, bo używa inline skryptów.
