import { describe, it, expect } from "vitest";
import { buildRowsCsv } from "../src/lib/csv";

describe("buildRowsCsv", () => {
  it("returns just the header for an empty list", () => {
    expect(buildRowsCsv([])).toBe("Key,Count");
  });

  it("builds one line per row, preserving given order", () => {
    const csv = buildRowsCsv([
      { key: "/pricing", count: 12 },
      { key: "/about", count: 5 },
    ]);
    expect(csv).toBe("Key,Count\r\n/pricing,12\r\n/about,5");
  });

  it("quotes a key containing a comma", () => {
    expect(buildRowsCsv([{ key: "about, us", count: 1 }])).toBe('Key,Count\r\n"about, us",1');
  });

  it("quotes and doubles an embedded quote", () => {
    expect(buildRowsCsv([{ key: 'say "hi"', count: 1 }])).toBe('Key,Count\r\n"say ""hi""",1');
  });

  it("quotes a key containing a newline", () => {
    expect(buildRowsCsv([{ key: "line1\nline2", count: 1 }])).toBe('Key,Count\r\n"line1\nline2",1');
  });

  it("leaves a plain key unquoted", () => {
    expect(buildRowsCsv([{ key: "github.com", count: 3 }])).toBe("Key,Count\r\ngithub.com,3");
  });
});
