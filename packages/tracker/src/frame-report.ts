export interface FrameDimensionsMessage {
  source: "lantern-tracker";
  type: "dimensions";
  width: number;
  height: number;
}

interface FrameWindow {
  self: unknown;
  top: unknown;
  parent: { postMessage: (message: FrameDimensionsMessage, targetOrigin: string) => void };
  addEventListener: (type: string, listener: () => void) => void;
}

interface FrameDocument {
  readyState: string;
  documentElement: { scrollWidth: number; scrollHeight: number };
}

/**
 * Reports this page's real pixel dimensions to whatever iframed it, so a
 * parent-frame overlay (the dashboard's Heatmaps page) can size itself
 * correctly — cross-origin JS can't read an iframe's contentDocument
 * directly, so the embedded page has to volunteer this itself.
 *
 * Only when actually embedded (`win.self !== win.top`) — a normal top-level
 * page load must never post anything.
 *
 * Waits for the `load` event (or fires immediately if already past it)
 * rather than measuring the instant this function runs: this tracker script
 * is a plain synchronous `<script src>` tag, which on a typical SPA host
 * page sits below a deferred/module app bundle — meaning this can execute
 * *before* the app has mounted anything into the DOM. Measuring immediately
 * would report the height of an essentially empty page.
 *
 * Deliberately posts only once at `load` (plus on resize after that) rather
 * than re-measuring again a moment later: a page with a continuously running
 * animation (e.g. a canvas/SVG background) can have a `scrollHeight` that
 * drifts over time on its own, unrelated to any real layout change — a
 * delayed re-measurement risks sampling a worse number than the first one,
 * not a better one. `"*"` target origin is an accepted tradeoff: the payload
 * is just pixel dimensions, nothing sensitive.
 */
export function reportFrameDimensions(win: FrameWindow, doc: FrameDocument): void {
  if (win.self === win.top) return;

  const post = () => {
    win.parent.postMessage(
      {
        source: "lantern-tracker",
        type: "dimensions",
        width: doc.documentElement.scrollWidth,
        height: doc.documentElement.scrollHeight,
      },
      "*",
    );
  };

  if (doc.readyState === "complete") {
    post();
  } else {
    win.addEventListener("load", post);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  win.addEventListener("resize", () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(post, 250);
  });
}
