# Deploying the Lantern Stack

These steps are yours to run — deploying to a real AWS account is exactly the
kind of action that shouldn't happen silently on your behalf.

## Prerequisites (one-time)

1. **An AWS account** with a payment method on file (required even for free-tier
   usage — AWS just won't charge you at the volumes this project stays under).
2. **AWS CLI installed and configured**: `aws configure` (or SSO login if your
   account uses that), so credentials are available locally.
3. **CDK bootstrap** — a one-time setup per AWS account + region, creates the
   S3 bucket/IAM roles CDK itself needs to deploy anything:
   ```bash
   cd "packages/ingestion/infra"
   npx cdk bootstrap
   ```
   Safe to re-run; it's idempotent.

## Every deploy (first time and every update after)

Lambda code must be built **before** the CDK stack references it — infra never
re-bundles application code, it only picks up whatever's already in `dist/`.

```bash
# From the repo root:
npm run --workspace @lantern/ingestion build   # produces dist/handler.js, dist/rollup-handler.js
npm run --workspace @lantern/infra deploy       # deploys/updates the stack
```

`cdk deploy` will print a diff of what's changing and ask for confirmation
before touching anything in your account (add `--require-approval never` only
if you're comfortable skipping that prompt — not recommended while iterating).

## After the first deploy

The command output includes the **HTTP API endpoint URL** (something like
`https://abc123xyz.execute-api.<region>.amazonaws.com`). That's the
`data-endpoint` value the tracker script needs:

```html
<script
  src="tracker.js"
  data-site-id="your-site-id"
  data-endpoint="https://abc123xyz.execute-api.<region>.amazonaws.com/events"
></script>
```

## One thing that won't work yet on its own

The rollup Lambda's `SITE_IDS` environment variable is deployed **empty** —
see `rollup-handler.ts`'s doc comment on why (no real site registry exists in
Phase 1). Until you add your site ID there, pageviews will land in DynamoDB
as raw `EVENT#` items, but the hourly rollup job will skip every site and no
`AGG#` items will ever get written. To fix it for now:

```bash
aws lambda update-function-configuration \
  --function-name <RollupFunction name from the deploy output> \
  --environment "Variables={EVENTS_TABLE_NAME=lantern-events,SITE_IDS=your-site-id}"
```

(This is a manual patch, not part of `cdk deploy`, because `SITE_IDS` isn't
modeled in the stack itself yet — it's plumbing that's honest about being a
placeholder, not a finished feature.)

## Tearing down

```bash
npm run --workspace @lantern/infra -- cdk destroy
```

The DynamoDB table will **not** be deleted even by `cdk destroy` — it's set
to `RemovalPolicy.RETAIN` deliberately (see `lantern-stack.ts`), so analytics
data survives infra teardown/rebuilds. Delete the table manually via the AWS
Console or CLI if you actually want it gone.
