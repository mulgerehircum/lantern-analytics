"use client";

import { useEffect, useState } from "react";

/**
 * Renders an ISO timestamp in whoever is looking at THIS page's own local
 * timezone - not the server's. Every timestamp this dashboard stores
 * (session startedAt, event timestamps) is UTC; a Server Component calling
 * `.toLocaleString()` runs on Vercel's Lambda, which formats in the
 * function's runtime timezone (UTC), not the actual person viewing the
 * dashboard. That's rarely who anyone means by "when did this happen."
 *
 * SSRs the raw ISO string (stable, no hydration mismatch), then swaps to
 * the browser-local formatted string after mount - the standard pattern for
 * any value that depends on the client's own locale/timezone.
 */
export function LocalDateTime({ iso }: { iso: string }) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    setFormatted(new Date(iso).toLocaleString());
  }, [iso]);

  return <>{formatted ?? iso}</>;
}
