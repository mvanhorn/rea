import { symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPeLoadConfigService } from "../../../src/composition/binaryDiagnostics.js";
import { peLoadConfigImage } from "../../../src/native/pe/PeLoadConfig.fixture.js";
import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";

describe("PE import stable filesystem boundary", () => {
  it("reports non-file and malformed PE selections as caller input errors", async () => {
    const root = await createTestTempDirectory("rea-pe-load-config-files-");
    const path = join(root, "app.exe");
    const alias = join(root, "alias.exe");
    const malformed = join(root, "malformed.exe");
    await writeFile(path, peLoadConfigImage());
    await writeFile(malformed, Buffer.from("not a pe"));
    await symlink(path, alias);
    const service = createPeLoadConfigService();
    for (const [candidate, reason] of [
      [root, "invalid_format"],
      [alias, "invalid_format"],
      [malformed, "invalid_format"],
      [join(root, "missing.exe"), "invalid_value"],
      [join(path, "child.exe"), "invalid_value"],
    ] as const) {
      const result = await service.inspect({ path: candidate });
      if (result.ok) throw new Error("Expected file acquisition failure");
      expect(result.error).toMatchObject({
        _tag: "AnalysisInputError",
        operation: "inspect_pe_load_config",
        issues: [
          {
            path: ["path"],
            reason,
            message: expect.any(String),
          },
        ],
      });
    }
  });

  it("returns typed resource and cancellation failures", async () => {
    const root = await createTestTempDirectory("rea-pe-load-config-budget-");
    const path = join(root, "app.exe");
    await writeFile(path, peLoadConfigImage());
    const service = createPeLoadConfigService();
    const tooSmall = await service.inspect({ path, max_file_bytes: 64 });
    if (tooSmall.ok) throw new Error("Expected resource budget failure");
    expect(tooSmall.error._tag).toBe("AnalysisResourceConstraintError");
    const cancelled = await service.inspect(
      { path },
      { signal: AbortSignal.abort() },
    );
    if (cancelled.ok) throw new Error("Expected cancellation");
    expect(cancelled.error._tag).toBe("AnalysisCancelledError");
  });

  it("names the exhausted callback budget", async () => {
    const root = await createTestTempDirectory("rea-pe-config-limit-");
    const path = join(root, "app.exe");
    await writeFile(path, peLoadConfigImage());
    const service = createPeLoadConfigService();
    try {
      const result = await service.inspect({ path, max_callbacks: 1 });
      if (result.ok) throw new Error("Expected callback budget failure");
      expect(result.error).toMatchObject({
        _tag: "AnalysisResourceConstraintError",
        remediationAction: expect.stringContaining(
          "Raise max_callbacks above 1",
        ),
      });
    } finally {
      await service.close();
    }
  });
});
