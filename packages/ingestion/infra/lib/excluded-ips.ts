/**
 * Owner self-exclusion: IPs/CIDRs whose events are dropped at ingest. The
 * ingest Lambda's EXCLUDED_IPS env var is assembled at synth time from this
 * list plus any deployment-time override (see lantern-stack.ts). Add your own
 * egress IPs/CIDRs here so they survive redeploys.
 */
export const EXCLUDED_IPS: string[] = ["185.198.47.133"];
