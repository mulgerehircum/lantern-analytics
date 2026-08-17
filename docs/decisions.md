# Architecture Decisions

## Why AI-native, not dashboard-first
Every existing competitor (PostHog, Plausible, Simple Analytics, Vercel Analytics) is
dashboard-first. Scored low on uniqueness (2.5/5) as a plain clone. Leading with a
natural-language query interface over the data is the differentiator.

## Why Lambda + DynamoDB stay on AWS despite owning free hardware
The project exists specifically to build AWS signal (identified gap: AWS appears in
25 evaluated job reports). Moving the DB to self-hosted hardware would undercut the
reason for the project. Split instead: keep the AWS-native pieces that are the actual
skill target (Lambda ingestion, DynamoDB aggregates) on AWS; put the heaviest, least
AWS-differentiated storage (session recording blobs) on owned hardware.

## Why session recordings don't go in DynamoDB
DynamoDB has a 400KB per-item limit. A single rrweb session recording is commonly
hundreds of KB to several MB. Blob storage (S3, or here, self-hosted) is the correct
fit; DynamoDB/metadata-index pattern for anything queryable (session ID, page,
duration, pointer to the blob).

## Why Cloudflare Tunnel, not port-forwarding, for the Mac mini
Residential IPs are dynamic and exposing a DB directly to the internet is a real
security risk. A tunnel avoids opening inbound ports entirely.

## Privacy positioning constraint
The pitch is "privacy-first." Session recording input masking (passwords, sensitive
fields) must be on by default — PostHog's own default — or the positioning is
self-contradicting on the riskiest feature.

## Why direct Gemini API calls, not Firebase AI Logic
Firebase AI Logic was considered for the Phase 3 AI query layer since it
wraps Gemini with less client-side plumbing. Rejected: the AI call is already
server-side (Next.js route handler), so Firebase's main value — hiding an API
key from a browser — is moot here. Adding it would mean a whole new
Google-stack dependency (Firebase project, SDK, its own auth model) for zero
benefit over calling `@google/genai` directly with a server-only
`GEMINI_API_KEY`.
