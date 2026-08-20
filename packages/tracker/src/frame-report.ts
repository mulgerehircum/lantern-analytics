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
  documentElement: { scrollWidth: number; scrollHeight: number };
}

/**
 * Reports this page's real pixel dimensions to whatever iframed it, so a
 * parent-frame overlay (the dashboard's Heatmaps page) can size itself
 * correctly — cross-origin JS can't read an iframe's contentDocument
 * directly, so the embedded page has to volunteer this itself.
 *
 * Only when actually embedded (`win.self !== win.top`) — a normal top-level
 * page load must never post anything. Posts once immediately, then again on
 * a debounced resize so a parent frame stays roughly in sync as content
 * loads/reflows. `"*"` target origin is an accepted tradeoff: the payload is
 * just pixel dimensions, nothing sensitive.
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

  post();

  let timer: ReturnType<typeof setTimeout> | undefined;
  win.addEventListener("resize", () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(post, 250);
  });
}
