import { describe, it, expect } from "vitest";
import { classifyDevice } from "../src/device";

describe("classifyDevice", () => {
  it("classifies iPad as tablet", () => {
    expect(classifyDevice("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
  });

  it("classifies iPhone as mobile", () => {
    expect(classifyDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
  });

  it("classifies Android phone as mobile", () => {
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("mobile");
  });

  it("defaults to desktop for everything else", () => {
    expect(classifyDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });

  it("defaults to desktop for an empty user agent", () => {
    expect(classifyDevice("")).toBe("desktop");
  });
});
