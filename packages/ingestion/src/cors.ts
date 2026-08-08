/**
 * Wide open by design. This endpoint receives traffic from arbitrary
 * customer sites embedding the tracker — unlike an app's own API (see the
 * dataroom project's authorizedParties allowlist), an analytics ingestion
 * endpoint can't know its callers' origins ahead of time.
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
