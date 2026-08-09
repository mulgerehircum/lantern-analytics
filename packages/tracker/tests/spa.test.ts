import { describe, it, expect } from "vitest";
import { enableSpaTracking, type SpaNavEnv } from "../src/spa";

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function makeHarness(initialPath = "/", canTrack: () => boolean = () => true) {
  let pathname = initialPath;
  let popstate: (() => void) | null = null;
  const calls: string[] = [];
  const history = {
    pushState(_data: unknown, _unused: string, url?: string | null) {
      if (url) pathname = new URL(url, "https://example.test" + pathname).pathname;
    },
    replaceState(_data: unknown, _unused: string, url?: string | null) {
      if (url) pathname = new URL(url, "https://example.test" + pathname).pathname;
    },
  };
  const env: SpaNavEnv = {
    history,
    location: {
      get pathname() {
        return pathname;
      },
    },
    addEventListener(type, listener) {
      if (type === "popstate") popstate = listener;
    },
  };
  enableSpaTracking(env, (p) => calls.push(p), canTrack);
  return {
    calls,
    navigate: (p: string) => history.pushState({}, "", p),
    replace: (p: string) => history.replaceState({}, "", p),
    pop: (p: string) => {
      pathname = p;
      popstate?.();
    },
  };
}

describe("enableSpaTracking", () => {
  it("fires a pageview with the new path on pushState", async () => {
    const h = makeHarness();
    h.navigate("/about");
    await flush();
    expect(h.calls).toEqual(["/about"]);
  });

  it("fires a pageview on replaceState", async () => {
    const h = makeHarness();
    h.replace("/docs");
    await flush();
    expect(h.calls).toEqual(["/docs"]);
  });

  it("fires a pageview on popstate", () => {
    const h = makeHarness("/a");
    h.pop("/b");
    expect(h.calls).toEqual(["/b"]);
  });

  it("does not double-count pushState + replaceState for one navigation", async () => {
    const h = makeHarness();
    h.navigate("/about");
    h.replace("/about");
    await flush();
    expect(h.calls).toEqual(["/about"]);
  });

  it("does not fire for a navigation to the initial-load path", async () => {
    const h = makeHarness("/");
    h.navigate("/");
    await flush();
    expect(h.calls).toEqual([]);
  });

  it("does not fire when the pathname is unchanged", async () => {
    const h = makeHarness();
    h.navigate("/about");
    h.replace("?tab=stats");
    await flush();
    expect(h.calls).toEqual(["/about"]);
  });

  it("respects canTrack()", async () => {
    const h = makeHarness("/", () => false);
    h.navigate("/about");
    await flush();
    expect(h.calls).toEqual([]);
  });

  it("re-checks canTrack() per navigation", async () => {
    let allowed = true;
    const h = makeHarness("/", () => allowed);
    h.navigate("/a");
    await flush();
    allowed = false;
    h.navigate("/b");
    await flush();
    expect(h.calls).toEqual(["/a"]);
  });
});
