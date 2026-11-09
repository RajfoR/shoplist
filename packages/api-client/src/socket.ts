// Klient WebSocket dla jednej listy: handshake auth, ping, reconnect z backoffem.
// Działa w przeglądarce i w React Native (oba mają globalny WebSocket).
import {
  CLOSE_NOT_FOUND,
  CLOSE_UNAUTHORIZED,
  type ListEvent,
  type ServerMessage,
} from "./events";

export interface ListSocketOptions {
  baseUrl: string; // np. "wss://api.example.com" albo "ws://localhost:8000"
  listId: string;
  token: string;
  /** Wołane po każdym (re)connect — tu klient pobiera snapshot GET /lists/{id}. */
  onReady: () => void;
  onEvent: (event: ListEvent) => void;
  /** Kod 4401/4404: koniec, bez reconnectu. */
  onFatal?: (code: number) => void;
  onStatus?: (status: "connecting" | "open" | "closed") => void;
}

const PING_INTERVAL_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

export class ListSocket {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private stopped = false;

  constructor(private readonly opts: ListSocketOptions) {}

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.ws?.close(1000);
    this.ws = null;
  }

  private open(): void {
    const { baseUrl, listId, token } = this.opts;
    this.opts.onStatus?.("connecting");
    const ws = new WebSocket(`${baseUrl}/ws/lists/${listId}`);
    this.ws = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));

    ws.onmessage = (msg) => {
      let data: ServerMessage;
      try {
        data = JSON.parse(String(msg.data)) as ServerMessage;
      } catch {
        return;
      }
      if (data.type === "ready") {
        this.attempt = 0;
        this.opts.onStatus?.("open");
        this.startPing();
        this.opts.onReady();
      } else if (data.type !== "pong") {
        this.opts.onEvent(data);
      }
    };

    ws.onclose = (ev) => {
      this.clearTimers();
      this.opts.onStatus?.("closed");
      if (this.stopped) return;
      if (ev.code === CLOSE_UNAUTHORIZED || ev.code === CLOSE_NOT_FOUND) {
        this.opts.onFatal?.(ev.code);
        return;
      }
      const delay = Math.min(1000 * 2 ** this.attempt, MAX_BACKOFF_MS);
      this.attempt += 1;
      this.retryTimer = setTimeout(() => this.open(), delay);
    };
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }

  private clearTimers(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pingTimer = null;
    this.retryTimer = null;
  }
}
