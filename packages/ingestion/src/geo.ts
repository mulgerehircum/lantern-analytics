/**
 * Resolves country from the `CloudFront-Viewer-Country` header, injected
 * automatically by the CloudFront distribution sitting in front of the API
 * Gateway endpoint (see infra/lib/lantern-stack.ts's IngestCdn distribution
 * + origin request policy). This replaces the earlier stub: CloudFront
 * resolves geo at the edge for free, with no added latency and no bundled
 * geo-IP database or third-party API call in the ingest hot path.
 *
 * Falls back to "unknown" when the header is absent — e.g. a request that
 * hits the raw API Gateway URL directly, bypassing CloudFront (local
 * testing, or the endpoint from before this change).
 */
export function resolveCountry(viewerCountryHeader: string | undefined): string {
  const trimmed = viewerCountryHeader?.trim();
  return trimmed ? trimmed.toUpperCase() : "unknown";
}
