import { describe, expect, it } from "vitest";
import { runWithTimeout } from "@/lib/import/timeout";

describe("cooperative parse timeout", () => {
  it("returns the value when the parser finishes in time", async () => {
    await expect(runWithTimeout(Promise.resolve("parsed"), 50)).resolves.toEqual({
      kind: "value",
      value: "parsed",
    });
  });

  it("returns the error instead of throwing", async () => {
    const failure = new Error("parser failed");

    await expect(runWithTimeout(Promise.reject(failure), 50)).resolves.toEqual({
      kind: "error",
      error: failure,
    });
  });

  it("stops waiting for a parser that never settles", async () => {
    await expect(
      runWithTimeout(new Promise<string>(() => {}), 10),
    ).resolves.toEqual({ kind: "timeout" });
  });
});
