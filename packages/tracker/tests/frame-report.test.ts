import { describe, it, expect, vi } from "vitest";
import { reportFrameDimensions, reportFrameScroll } from "../src/frame-report";

function makeWindow(framed: boolean, scrollY = 0) {
  const listeners: Record<string, () => void> = {};
  const listenerOptions: Record<string, { passive?: boolean } | undefined> = {};
  const postMessage = vi.fn();
  const win = {
    self: {},
    top: framed ? {} : undefined,
    scrollY,
    parent: { postMessage },
    addEventListener: (type: string, listener: () => void, options?: { passive?: boolean }) => {
      listeners[type] = listener;
      listenerOptions[type] = options;
    },
  };
  // self === top when not framed
  if (!framed) win.top = win.self;
  return { win, postMessage, listeners, listenerOptions };
}

/** Fake requestAnimationFrame: captures scheduled callbacks without auto-running them, for deterministic throttle tests. */
function makeRaf() {
  const pending: Array<() => void> = [];
  const raf = (cb: () => void) => {
    pending.push(cb);
  };
  const flush = () => {
    const callbacks = pending.splice(0);
    callbacks.forEach((cb) => cb());
  };
  return { raf, flush };
}

function makeDoc(readyState: string, scrollWidth: number, scrollHeight: number) {
  return { readyState, documentElement: { scrollWidth, scrollHeight } };
}

describe("reportFrameDimensions", () => {
  it("does nothing when not embedded (self === top)", () => {
    const { win, postMessage } = makeWindow(false);
    reportFrameDimensions(win, makeDoc("complete", 1000, 2000));
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("posts dimensions immediately when embedded and the document is already complete", () => {
    const { win, postMessage } = makeWindow(true);
    reportFrameDimensions(win, makeDoc("complete", 1000, 2000));
    expect(postMessage).toHaveBeenCalledWith(
      { source: "lantern-tracker", type: "dimensions", width: 1000, height: 2000 },
      "*",
    );
  });

  it("waits for the load event before posting when the document isn't complete yet", () => {
    const { win, postMessage, listeners } = makeWindow(true);
    // A bare "loading" scrollHeight — the SPA app bundle (a deferred/module
    // script) hasn't mounted anything into the DOM yet at this point.
    const doc = makeDoc("loading", 1000, 50);
    reportFrameDimensions(win, doc);
    expect(postMessage).not.toHaveBeenCalled();

    // Simulates the app finishing its mount and growing the page before `load` fires.
    doc.documentElement.scrollHeight = 3000;
    listeners.load();
    expect(postMessage).toHaveBeenCalledWith(
      { source: "lantern-tracker", type: "dimensions", width: 1000, height: 3000 },
      "*",
    );
  });

  it("posts only once at load, not again after a delay (a page with a running animation could drift worse, not better)", () => {
    vi.useFakeTimers();
    const { win, postMessage, listeners } = makeWindow(true);
    const doc = makeDoc("loading", 1000, 50);
    reportFrameDimensions(win, doc);

    listeners.load();
    postMessage.mockClear();
    doc.documentElement.scrollHeight = 4000; // e.g. an animated background still moving
    vi.advanceTimersByTime(5000);

    expect(postMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("re-posts on a debounced resize", () => {
    vi.useFakeTimers();
    const { win, postMessage, listeners } = makeWindow(true);
    const doc = makeDoc("complete", 1000, 2000);
    reportFrameDimensions(win, doc);
    postMessage.mockClear();

    doc.documentElement.scrollHeight = 3000;
    listeners.resize();
    listeners.resize(); // rapid second resize should not double-fire
    vi.advanceTimersByTime(250);

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      { source: "lantern-tracker", type: "dimensions", width: 1000, height: 3000 },
      "*",
    );
    vi.useRealTimers();
  });
});

describe("reportFrameScroll", () => {
  it("does nothing when not embedded (self === top)", () => {
    const { win, postMessage } = makeWindow(false);
    const { raf } = makeRaf();
    reportFrameScroll(win, raf);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("posts the initial scroll position immediately when embedded", () => {
    const { win, postMessage } = makeWindow(true, 120);
    const { raf } = makeRaf();
    reportFrameScroll(win, raf);
    expect(postMessage).toHaveBeenCalledWith({ source: "lantern-tracker", type: "scroll", scrollY: 120 }, "*");
  });

  it("registers the scroll listener as passive", () => {
    const { win, listenerOptions } = makeWindow(true);
    const { raf } = makeRaf();
    reportFrameScroll(win, raf);
    expect(listenerOptions.scroll).toEqual({ passive: true });
  });

  it("throttles rapid scroll events to one post per animation frame", () => {
    const { win, postMessage, listeners } = makeWindow(true, 0);
    const { raf, flush } = makeRaf();
    reportFrameScroll(win, raf);
    postMessage.mockClear();

    win.scrollY = 50;
    listeners.scroll();
    win.scrollY = 100;
    listeners.scroll(); // rapid second scroll before the frame fires should not schedule a second one
    expect(postMessage).not.toHaveBeenCalled(); // still waiting on the animation frame

    flush();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ source: "lantern-tracker", type: "scroll", scrollY: 100 }, "*");
  });

  it("allows another post after the animation frame fires", () => {
    const { win, postMessage, listeners } = makeWindow(true, 0);
    const { raf, flush } = makeRaf();
    reportFrameScroll(win, raf);
    postMessage.mockClear();

    win.scrollY = 50;
    listeners.scroll();
    flush();

    win.scrollY = 200;
    listeners.scroll();
    flush();

    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenLastCalledWith({ source: "lantern-tracker", type: "scroll", scrollY: 200 }, "*");
  });
});
