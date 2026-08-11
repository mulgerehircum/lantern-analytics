import { describe, expect, it } from "vitest";
import { checkBearer } from "../src/auth";

describe("checkBearer", () => {
  it("accepts a matching bearer token", () => {
    expect(checkBearer("Bearer secret-token", "secret-token")).toBe(true);
  });

  it("rejects a mismatched token", () => {
    expect(checkBearer("Bearer wrong-token", "secret-token")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(checkBearer(undefined, "secret-token")).toBe(false);
  });

  it("rejects a header missing the Bearer prefix", () => {
    expect(checkBearer("secret-token", "secret-token")).toBe(false);
  });

  it("rejects an empty expected token (misconfiguration should never pass)", () => {
    expect(checkBearer("Bearer ", "")).toBe(false);
    expect(checkBearer("Bearer anything", "")).toBe(false);
  });

  it("rejects tokens of different lengths without throwing", () => {
    expect(checkBearer("Bearer short", "a-much-longer-secret-token")).toBe(false);
  });
});
