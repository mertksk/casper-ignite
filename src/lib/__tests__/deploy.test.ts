import { describe, expect, it } from "vitest";
import { deployProjectToken } from "../casper";

describe("deployProjectToken", () => {
  it("returns a mock contract hash", async () => {
    const hash = await deployProjectToken({
      projectName: "Test Project",
      symbol: "TEST",
      totalSupply: 1_000_000,
    });
    expect(hash.startsWith("hash-")).toBe(true);
    expect(hash.length).toBeGreaterThan(10);
  });
});
