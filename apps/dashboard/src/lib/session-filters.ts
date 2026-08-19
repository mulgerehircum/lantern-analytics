export interface SessionFilters {
  variant?: string;
  device?: string;
  country?: string;
  /** Inclusive "YYYY-MM-DD" bounds, compared against startedAt's date portion. */
  from?: string;
  to?: string;
}

export function hasActiveSessionFilter(filters: SessionFilters): boolean {
  return Boolean(filters.variant || filters.device || filters.country || filters.from || filters.to);
}

/** AND semantics across whichever filters are set; a session with no matching field on an active filter is excluded. */
export function filterSessions<T extends { startedAt: string; device?: string; country?: string; variant?: string }>(
  sessions: readonly T[],
  filters: SessionFilters,
): T[] {
  return sessions.filter((s) => {
    if (filters.variant && s.variant !== filters.variant) return false;
    if (filters.device && s.device !== filters.device) return false;
    if (filters.country && s.country !== filters.country) return false;
    const day = s.startedAt.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return true;
  });
}
