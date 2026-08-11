import { MAX_SESSION_DURATION_MS, SESSION_INACTIVITY_TIMEOUT_MS } from "@lantern/shared";

const SESSION_ID_KEY = "lantern_session_id";
const SESSION_STARTED_KEY = "lantern_session_started";
const SESSION_LAST_ACTIVE_KEY = "lantern_session_last_active";
const SESSION_PAGE_COUNT_KEY = "lantern_session_page_count";

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RandomIdSource {
  randomUUID(): string;
}

export interface SessionState {
  sessionId: string;
  startedAt: string;
}

/**
 * Tab-scoped (sessionStorage, never localStorage) session lifecycle — a
 * session survives across pageviews and SPA route changes as long as it's
 * been active within SESSION_INACTIVITY_TIMEOUT_MS and hasn't run past
 * MAX_SESSION_DURATION_MS; otherwise a fresh session starts. Deliberately not
 * a persistent cross-session identity — same principle behind the tracker's
 * cookieless design (see ignore.ts's `lantern_ignore` flag for the project's
 * one other such narrow, documented exception).
 *
 * Environment is injected (storage + a random-id source) so this is
 * unit-testable without a real browser, matching spa.ts's pattern.
 */
export function getOrCreateSession(
  storage: SessionStorageLike,
  random: RandomIdSource,
  now: number = Date.now(),
): SessionState {
  const existingId = storage.getItem(SESSION_ID_KEY);
  const existingStarted = Number(storage.getItem(SESSION_STARTED_KEY));
  const lastActive = Number(storage.getItem(SESSION_LAST_ACTIVE_KEY));

  const isFresh =
    existingId !== null &&
    Number.isFinite(existingStarted) &&
    Number.isFinite(lastActive) &&
    now - lastActive < SESSION_INACTIVITY_TIMEOUT_MS &&
    now - existingStarted < MAX_SESSION_DURATION_MS;

  storage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));

  if (isFresh) {
    return { sessionId: existingId as string, startedAt: new Date(existingStarted).toISOString() };
  }

  const sessionId = random.randomUUID().replace(/-/g, "");
  storage.setItem(SESSION_ID_KEY, sessionId);
  storage.setItem(SESSION_STARTED_KEY, String(now));
  storage.setItem(SESSION_PAGE_COUNT_KEY, "0");
  return { sessionId, startedAt: new Date(now).toISOString() };
}

export function getPageCount(storage: SessionStorageLike): number {
  const raw = Number(storage.getItem(SESSION_PAGE_COUNT_KEY));
  return Number.isFinite(raw) ? raw : 0;
}

/**
 * Bumps the persisted page counter for this session — called alongside every
 * trackPageview() call site in index.ts (initial load and each SPA route
 * change). Also mutates the live `window.__lanternRecordConfig` if recording
 * is active: that object is the only channel to the separately-bundled
 * recorder chunk (see enableSessionRecording below and recorder-entry.ts),
 * which reads `pageCount` from it at metadata-heartbeat time.
 */
export function notifyPageview(storage: SessionStorageLike): void {
  const next = getPageCount(storage) + 1;
  storage.setItem(SESSION_PAGE_COUNT_KEY, String(next));

  if (window.__lanternRecordConfig) {
    window.__lanternRecordConfig.pageCount = next;
  }
}

export interface RecordingTrackerConfig {
  siteId: string;
  endpoint: string;
  scriptSrc: string;
  recordEndpoint?: string;
  recordToken?: string;
  recordScript?: string;
}

declare global {
  interface Window {
    __lanternRecordConfig?: {
      siteId: string;
      sessionId: string;
      startedAt: string;
      pageCount: number;
      recordEndpoint: string;
      recordToken: string;
      metaEndpoint: string;
    };
  }
}

/**
 * Injects the lazy rrweb chunk (tracker-recorder.js), handing it everything
 * it needs via `window.__lanternRecordConfig` — the base bundle and the
 * recorder chunk are two separate esbuild outputs sharing no module scope,
 * only `window`. See docs/design.md: rrweb must be a separate script tag,
 * never bundled into the base tracker, so sites that don't opt into
 * recording never pay for it.
 *
 * `metaEndpoint` is derived from the same CDN endpoint the base tracker
 * already posts pageviews to (`/events`), resolved against the sibling
 * `/session-recordings/meta` path the CDK stack outputs alongside it — see
 * packages/ingestion/infra/lib/lantern-stack.ts's CfnOutputs. This avoids
 * requiring a second `data-*` endpoint attribute for the common case where
 * both live behind the same CloudFront distribution.
 */
export function enableSessionRecording(
  config: RecordingTrackerConfig,
  session: SessionState,
  pageCount: number,
): void {
  if (!config.recordEndpoint || !config.recordToken) return; // readConfig() already gates this; stay defensive

  // config.endpoint must be absolute for this to resolve (it always is in
  // practice — see the CDK stack's CdnIngestEndpoint output). Guard anyway:
  // a malformed data-endpoint must degrade to "no recording", never an
  // uncaught error surfaced into the host page's console.
  let metaEndpoint: string;
  try {
    metaEndpoint = new URL("session-recordings/meta", config.endpoint).toString();
  } catch {
    return;
  }

  window.__lanternRecordConfig = {
    siteId: config.siteId,
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    pageCount,
    recordEndpoint: config.recordEndpoint,
    recordToken: config.recordToken,
    metaEndpoint,
  };

  const scriptSrc = config.recordScript ?? config.scriptSrc.replace(/tracker\.js(\?.*)?$/, "tracker-recorder.js$1");

  const script = document.createElement("script");
  script.src = scriptSrc;
  script.async = true;
  document.head.appendChild(script);
}
