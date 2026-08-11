# @lantern/recorder-receiver

Self-hosted receiver for rrweb session-recording blobs (Phase 2). Runs on the
project owner's own Mac mini, reached over the internet only via a Cloudflare
Tunnel — no inbound router ports are ever opened (see the repo root's
`docs/decisions.md` for the full rationale).

This is the one Phase 2 piece with no CDK/Vercel deploy story. It's a plain
long-running Node process, manually installed and operated.

## Why this exists, and why not DynamoDB/S3

A single rrweb session recording is commonly hundreds of KB to several MB —
well past DynamoDB's 400KB/item limit. Rather than adding S3 (which would
mean AWS owns 100% of the storage story, undercutting the reason this project
splits AWS-native pieces from self-hosted ones — see repo-root
`docs/decisions.md`), the recording blobs live on owned hardware. DynamoDB
still owns the *queryable* metadata (session list, chronological order, see
`packages/ingestion/docs/dynamodb-schema.md`); this service only ever answers
"give me the blob for `(siteId, sessionId)`" — an exact-key lookup, never a
query — which is why storage here is flat JSON-Lines files, not a database.
See `src/storage.ts` for the format.

## Auth: two tokens, two different trust levels

- **`WRITE_TOKEN`** is baked into the *publicly shipped*
  `tracker-recorder.js` chunk (see `packages/tracker/src/recorder-entry.ts`)
  so a visitor's browser can POST recording batches directly to this
  service. Anyone can view-source it out of the tracker JS — **it is not a
  secrecy boundary**. Its only job is to stop anonymous internet scanners
  from hitting the tunnel hostname with zero credential at all. The real
  defense against a targeted abuser who reads the token out of the JS is the
  per-IP rate limit (`src/rate-limit.ts`) and the per-session file-size cap
  (`src/storage.ts`) — both bound worst-case abuse to "a bit of wasted disk,"
  not "disk fill."
- **`READ_TOKEN`** is a real secret. It is configured only as a server-side
  Vercel env var (`RECORDING_READ_TOKEN`) on the dashboard and used
  exclusively by the dashboard's own server-side API route
  (`apps/dashboard/src/app/api/recordings/route.ts`) — it never reaches a
  browser. This is where the actual security value lives.

Generate both with something like `openssl rand -hex 32`. Never reuse one
value for both.

## Local development

```bash
cp .env.example .env   # then fill in WRITE_TOKEN / READ_TOKEN
npm install
npm run build
npm start
```

`GET /healthz` should return `{"status":"ok"}`.

## Deploying to the Mac mini

1. Copy this package (or `git clone` the whole monorepo) onto the Mac mini.
2. `npm install && npm run build` (from the repo root, or scoped to this
   workspace).
3. Create a real `.env` from `.env.example` with freshly generated tokens.
4. Run it as a `launchd` service so it survives reboots — create
   `~/Library/LaunchAgents/com.lantern.recorder-receiver.plist` pointing at
   `node <path-to-repo>/packages/recorder-receiver/dist/server.cjs`, with the
   `.env` values passed via the plist's `EnvironmentVariables` dict (launchd
   services don't inherit a shell's `.env` file automatically). Alternatively,
   run it under `pm2` if that's already installed (`pm2 start dist/server.cjs
   --name recorder-receiver`).

## Cloudflare Tunnel setup

1. Install `cloudflared` on the Mac mini.
2. `cloudflared tunnel login` (one-time browser auth against your Cloudflare
   account).
3. `cloudflared tunnel create lantern-recordings`.
4. `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <tunnel-uuid>
   credentials-file: /Users/<you>/.cloudflared/<tunnel-uuid>.json
   ingress:
     - hostname: lantern-recordings.<your-domain>.com
       service: http://localhost:4000
     - service: http_status:404
   ```
5. `cloudflared tunnel route dns lantern-recordings
   lantern-recordings.<your-domain>.com` (the domain must already be on
   Cloudflare).
6. `cloudflared service install` to run the tunnel as a launchd service too —
   both it and the receiver need to survive reboots independently.

No inbound port is ever opened on the router; the tunnel makes an outbound
connection to Cloudflare's edge, which is the entire point (residential IPs
are dynamic and exposing anything directly would be a real risk).

## Verifying the whole path end to end

From a machine that is **not** the Mac mini (to prove the tunnel actually
works, not just localhost):

```bash
curl -X POST https://lantern-recordings.<your-domain>.com/recordings/test-site/abc12345 \
  -H "Authorization: Bearer $WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"seq":0,"events":[{"foo":1}]}'
# expect: 204 No Content

curl https://lantern-recordings.<your-domain>.com/recordings/test-site/abc12345 \
  -H "Authorization: Bearer $READ_TOKEN"
# expect: {"events":[{"foo":1}]}
```

Also worth confirming directly:
- A request with a missing/wrong token gets `401`.
- A path-traversal-shaped `siteId`/`sessionId` (e.g. `../../etc`) gets `400`
  before any filesystem access happens.
- Hammering the write endpoint past ~30 requests/minute from one IP gets
  `429`.

## Data layout

```
<DATA_DIR>/<siteId>/<sessionId>.jsonl
```

One JSON line per received upload batch:
`{"seq":3,"receivedAt":"2026-...","events":[...]}`. `readSession` reassembles
these in `seq` order and tolerates a torn trailing line (the one thing a
crash mid-append can produce).
