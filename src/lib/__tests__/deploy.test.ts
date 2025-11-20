import { existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { createTokenDeployParams } from "../casper";

describe("createTokenDeployParams", () => {
  const wasmPath = join(process.cwd(), "public", "contracts", "cep18.wasm");

  if (!existsSync(wasmPath)) {
    it.skip("skips because cep18.wasm is not available locally", () => {});
    return;
  }

  it("builds an unsigned deploy with a valid hash", () => {
    const dummyPublicKey = "01".repeat(33);
    const { deployHash, deployJson } = createTokenDeployParams({
      projectName: "Test Project",
      symbol: "TEST",
      totalSupply: 1_000_000,
      creatorPublicKey: dummyPublicKey,
    });

    expect(deployHash).toMatch(/^[0-9a-fA-F]+$/);
    expect(deployHash.length).toBeGreaterThan(10);
    expect(deployJson).toBeDefined();
  });
});
