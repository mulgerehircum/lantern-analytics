/**
 * SPA route tracking (opt-in via `data-spa` on the script tag).
 *
 * Fires a pageview when the route changes through history navigation
 * (pushState/replaceState or popstate). Only the pathname is tracked, so a
 * navigation that keeps the same pathname (e.g. a query-string change) is
 * treated as the same page — consistent with the initial-load pageview.
 *
 * The environment is injected so the logic is unit-testable without a DOM;
 * index.ts wires it to the real `window`.
 */
export interface SpaNavEnv {
  history: Pick<History, "pushState" | "replaceState">;
  location: { pathname: string };
  addEventListener: (type: "popstate", listener: () => void) => void;
}

export function enableSpaTracking(
  env: SpaNavEnv,
  trackPageview: (path: string) => void,
  canTrack: () => boolean,
): void {
  // The initial-load pageview already counted this path; dedupe against it so
  // a first pushState to the same pathname can't double-count.
  let lastPath = env.location.pathname;

  const fire = (): void => {
    if (env.location.pathname === lastPath) return;
    lastPath = env.location.pathname;
    if (!canTrack()) return;
    trackPageview(lastPath);
  };

  for (const method of ["pushState", "replaceState"] as const) {
    const original = env.history[method];
    env.history[method] = function (this: History, ...args) {
      const result = original.apply(this, args);
      // Deferred so a framework that touches history again within the same
      // tick can't make us observe a transient path.
      setTimeout(fire, 0);
      return result;
    };
  }

  env.addEventListener("popstate", fire);
}
