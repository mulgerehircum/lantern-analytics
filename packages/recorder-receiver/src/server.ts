import express, { type Request, type Response } from "express";
import { isValidSessionId, isValidSiteIdForPath } from "@lantern/shared";
import { checkBearer } from "./auth";
import { appendBatch, readSession } from "./storage";
import { RateLimiter } from "./rate-limit";

const PORT = Number(process.env.PORT ?? 4000);
const DATA_DIR = process.env.DATA_DIR ?? "./data";
const WRITE_TOKEN = process.env.WRITE_TOKEN ?? "";
const READ_TOKEN = process.env.READ_TOKEN ?? "";

// 20MB/session: generous for a portfolio-scale rrweb recording (typically
// hundreds of KB to a few MB) while bounding worst-case disk usage from any
// one session, malicious or not.
const MAX_SESSION_FILE_BYTES = 20 * 1024 * 1024;

if (!WRITE_TOKEN || !READ_TOKEN) {
  throw new Error("WRITE_TOKEN and READ_TOKEN must both be set — see .env.example");
}

// The write token is shipped inside the public tracker-recorder.js chunk
// (see packages/tracker/src/recorder-entry.ts) so the browser can POST
// directly here — it is NOT a secrecy boundary, anyone can view-source it.
// This rate limit is the actual defense against someone reading it out of
// the JS and hammering this endpoint to fill the disk. 30 req/min covers one
// real visitor's flush cadence (tracker flushes roughly every 10s) with
// headroom for a few concurrent tabs.
const writeLimiter = new RateLimiter(30, 0.5);

const app = express();
app.use(express.json({ limit: "1mb" }));

// The browser POSTs directly here from whatever site embeds the tracker —
// a genuinely cross-origin request, and `Content-Type: application/json`
// makes it non-"simple", so the browser preflights with OPTIONS first. A
// literal wildcard is safe here (unlike packages/ingestion/src/cors.ts's
// reflected-Origin approach): recording-transport.ts uses plain `fetch()`,
// not `sendBeacon()`, so no credentials mode is ever forced — there's no
// CORS-credentials conflict to work around.
app.use((req: Request, res: Response, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/recordings/:siteId/:sessionId", (req: Request, res: Response) => {
  const { siteId, sessionId } = req.params;

  // Validate before anything else touches the filesystem — this endpoint is
  // reachable directly over the tunnel, not only via a trusted caller.
  if (!isValidSiteIdForPath(siteId) || !isValidSessionId(sessionId)) {
    res.status(400).json({ error: "invalid siteId or sessionId" });
    return;
  }
  if (!checkBearer(req.header("authorization"), WRITE_TOKEN)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const clientIp = req.header("cf-connecting-ip") ?? req.ip ?? "unknown";
  if (!writeLimiter.tryConsume(clientIp)) {
    res.status(429).json({ error: "rate limited" });
    return;
  }

  const { seq, events } = req.body ?? {};
  if (typeof seq !== "number" || !Array.isArray(events)) {
    res.status(400).json({ error: "invalid body" });
    return;
  }

  appendBatch(DATA_DIR, siteId, sessionId, { seq, events }, MAX_SESSION_FILE_BYTES)
    .then((result) => {
      if (!result.ok) {
        res.status(413).json({ error: "session too large" });
        return;
      }
      res.status(204).end();
    })
    .catch(() => {
      res.status(500).json({ error: "write failed" });
    });
});

app.get("/recordings/:siteId/:sessionId", (req: Request, res: Response) => {
  const { siteId, sessionId } = req.params;

  if (!isValidSiteIdForPath(siteId) || !isValidSessionId(sessionId)) {
    res.status(400).json({ error: "invalid siteId or sessionId" });
    return;
  }
  // Real secret — only ever configured server-side on the dashboard
  // (RECORDING_READ_TOKEN). See README.md's "Auth" section.
  if (!checkBearer(req.header("authorization"), READ_TOKEN)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  readSession(DATA_DIR, siteId, sessionId)
    .then((result) => {
      if (!result) {
        res.status(404).json({ error: "not found" });
        return;
      }
      res.json(result);
    })
    .catch(() => {
      res.status(500).json({ error: "read failed" });
    });
});

app.listen(PORT, () => {
  console.log(`lantern recorder-receiver listening on :${PORT}, data dir: ${DATA_DIR}`);
});
