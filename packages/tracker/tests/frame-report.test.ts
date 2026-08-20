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

describe("reportFrameDimensions", () => {
  it("does nothing when not embedded (self === top)", () => {
    const { win, postMessage } = makeWindow(false);
    const doc = { documentElement: { scrollWidth: 1000, scrollHeight: 2000 } };
    reportFrameDimensions(win, doc);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("posts dimensions immediately when embedded", () => {
    const { win, postMessage } = makeWindow(true);
    const doc = { documentElement: { scrollWidth: 1000, scrollHeight: 2000 } };
    reportFrameDimensions(win, doc);
    expect(postMessage).toHaveBeenCalledWith(
      { source: "lantern-tracker", type: "dimensions", width: 1000, height: 2000 },
      "*",
    );
  });

  it("re-posts on a debounced resize", () => {
    vi.useFakeTimers();
    const { win, postMessage, listeners } = makeWindow(true);
    const doc = { documentElement: { scrollWidth: 1000, scrollHeight: 2000 } };
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
