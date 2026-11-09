#!/usr/bin/env python3
"""Smoke test po deployu: API (/health, WebSocket przez proxy) i web (SPA, config, Storybook).

Test WS przechodzi pełną ścieżkę: TLS → Caddy → Upgrade → uvicorn → aplikacja.
Wysyła auth ze złym tokenem i oczekuje zamknięcia kodem 4401 (CONTRACT.md),
więc nie potrzebuje konta ani nie zostawia danych w bazie.

Sama biblioteka standardowa, żeby działał na czystym runnerze i na VPS.

Użycie: python3 deploy/smoke.py https://api.example.pl [--web https://example.pl] [--attempts 20]
"""

import argparse
import base64
import hashlib
import json
import os
import socket
import ssl
import struct
import sys
import time
import urllib.request
import uuid
from urllib.parse import urlsplit

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
CLOSE_UNAUTHORIZED = 4401


class SmokeError(Exception):
    pass


def check_health(base: str) -> None:
    with urllib.request.urlopen(f"{base}/health", timeout=10) as resp:  # noqa: S310
        body = json.load(resp)
    if body != {"status": "ok"}:
        raise SmokeError(f"/health zwrócił {body!r}")


def fetch(url: str) -> tuple[int, dict[str, str], str]:
    with urllib.request.urlopen(url, timeout=10) as resp:  # noqa: S310
        headers = {k.lower(): v for k, v in resp.headers.items()}
        return resp.status, headers, resp.read().decode("utf-8", "replace")


def check_web(web: str, api: str) -> None:
    status, headers, body = fetch(f"{web}/")
    if status != 200 or 'id="root"' not in body:
        raise SmokeError("strona główna nie zwraca aplikacji")
    if "content-security-policy" not in headers:
        raise SmokeError("brak nagłówka CSP na stronie aplikacji")
    # Deep link z QR musi dostać index.html (fallback SPA), nie 404.
    status, _, body = fetch(f"{web}/join/smoke-test")
    if status != 200 or 'id="root"' not in body:
        raise SmokeError("brak fallbacku SPA dla /join/...")
    _, _, body = fetch(f"{web}/config.js")
    if f'"{api}"' not in body:
        raise SmokeError(f"/config.js nie wskazuje na {api}: {body.strip()[:120]}")
    status, _, body = fetch(f"{web}/storybook/")
    if status != 200 or "storybook" not in body.lower():
        raise SmokeError("Storybook nie odpowiada pod /storybook/")


class Conn:
    def __init__(self, sock: socket.socket) -> None:
        self.sock = sock
        self.buf = b""

    def read_exact(self, n: int) -> bytes:
        while len(self.buf) < n:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise SmokeError("połączenie zamknięte przed końcem odpowiedzi")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def read_headers(self) -> bytes:
        while b"\r\n\r\n" not in self.buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise SmokeError("brak odpowiedzi na Upgrade")
            self.buf += chunk
        head, self.buf = self.buf.split(b"\r\n\r\n", 1)
        return head


def send_text(sock: socket.socket, text: str) -> None:
    payload = text.encode()
    mask = os.urandom(4)
    header = bytes([0x81])  # FIN + text
    n = len(payload)
    if n < 126:
        header += bytes([0x80 | n])
    else:
        header += bytes([0x80 | 126]) + struct.pack("!H", n)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    sock.sendall(header + mask + masked)


def check_websocket(base: str) -> None:
    url = urlsplit(base)
    secure = url.scheme == "https"
    host = url.hostname or ""
    port = url.port or (443 if secure else 80)

    sock = socket.create_connection((host, port), timeout=10)
    if secure:
        # Domyślny kontekst weryfikuje certyfikat; ALPN pusty → HTTP/1.1, jak przeglądarka przy WS.
        sock = ssl.create_default_context().wrap_socket(sock, server_hostname=host)
    conn = Conn(sock)
    try:
        key = base64.b64encode(os.urandom(16)).decode()
        path = f"/ws/lists/{uuid.uuid4()}"
        sock.sendall(
            (
                f"GET {path} HTTP/1.1\r\nHost: {url.netloc}\r\n"
                "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
            ).encode()
        )
        head = conn.read_headers().decode("latin-1")
        status = head.split("\r\n", 1)[0]
        if " 101 " not in f"{status} ":
            raise SmokeError(f"Upgrade nie przeszedł: {status!r}")
        expected = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()  # noqa: S324
        if f"sec-websocket-accept: {expected.lower()}" not in head.lower():
            raise SmokeError("zły Sec-WebSocket-Accept")

        send_text(sock, json.dumps({"type": "auth", "token": "smoke-test-invalid-token"}))

        b0, b1 = conn.read_exact(2)
        opcode, length = b0 & 0x0F, b1 & 0x7F
        if length == 126:
            (length,) = struct.unpack("!H", conn.read_exact(2))
        elif length == 127:
            (length,) = struct.unpack("!Q", conn.read_exact(8))
        payload = conn.read_exact(length)
        if opcode != 0x8 or len(payload) < 2:
            raise SmokeError(f"oczekiwano ramki close, dostałem opcode={opcode:#x}")
        (code,) = struct.unpack("!H", payload[:2])
        if code != CLOSE_UNAUTHORIZED:
            raise SmokeError(f"oczekiwano kodu {CLOSE_UNAUTHORIZED}, dostałem {code}")
    finally:
        sock.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url", help="API, np. https://api.example.pl")
    parser.add_argument("--web", help="frontend, np. https://example.pl")
    parser.add_argument("--attempts", type=int, default=20)
    parser.add_argument("--delay", type=float, default=3.0)
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    # Ponawiamy, bo przy pierwszym deployu Caddy może jeszcze kończyć ACME.
    for attempt in range(1, args.attempts + 1):
        try:
            check_health(base)
            print(f"OK  {base}/health")
            check_websocket(base)
            scheme = "wss" if base.startswith("https") else "ws"
            host = urlsplit(base).netloc
            print(f"OK  {scheme}://{host}/ws/lists/<id> → close {CLOSE_UNAUTHORIZED}")
            if args.web:
                check_web(args.web.rstrip("/"), base)
                print(f"OK  {args.web} (SPA, /config.js, /storybook/, CSP)")
            return 0
        except (OSError, SmokeError, ValueError) as exc:
            print(f"[{attempt}/{args.attempts}] {exc}", file=sys.stderr)
            if attempt < args.attempts:
                time.sleep(args.delay)
    return 1


if __name__ == "__main__":
    sys.exit(main())
