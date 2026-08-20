import { describe, it, expect, vi } from "vitest";
import { reportFrameDimensions } from "../src/frame-report";

function makeWindow(framed: boolean) {
  const listeners: Record<string, () => void> = {};
  const postMessage = vi.fn();
  const win = {
    self: {},
    top: framed ? {} : undefined,
    parent: { postMessage },
    addEventListener: (type: string, listener: () => void) => {
      listeners[type] = listener;
    },
  };
  // self === top when not framed
  if (!framed) win.top = win.self;
  return { win, postMessage, listeners };
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
