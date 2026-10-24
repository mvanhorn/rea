import { expect, it } from "vitest";
import { PeLoadConfigService } from "./PeLoadConfigService.js";
import { PE_LOAD_CONFIG_PROVIDER } from "../../domain/investigationProviders.js";
import type { PeLoadConfig } from "../../domain/native/peLoadConfig.js";
import { ok } from "../../domain/result.js";

const report: PeLoadConfig = {
  artifact: { path: "/artifacts/app.exe", sha256: "a".repeat(64), bytes: 512 },
  format: "pe32-plus",
  machine: 0x8664,
  bits: 64,
  architecture: "x86_64",
  tls: null,
  load_config: null,
  examined_callbacks: 0,
  limitations: [],
};
const service = (value: PeLoadConfig = report) =>
  new PeLoadConfigService({
    identity: PE_LOAD_CONFIG_PROVIDER,
    inspect: () => Promise.resolve(ok(value)),
  });
it("retains absent directories and artifact provenance", async () => {
  const result = await service().inspect({ path: report.artifact.path });
  expect(result.ok).toBe(true);
  if (!result.ok) throw result.error;
  expect(result.value).toMatchObject({
    confidence: "observed",
    subject: { format: "pe", architecture: "x86_64" },
    normalized_result: report,
  });
});
it("rejects input and cancellation before reading", async () => {
  const boundary = new PeLoadConfigService({
    identity: PE_LOAD_CONFIG_PROVIDER,
    inspect: () => {
      throw new Error("Unexpected read");
    },
  });
  for (const input of [
    { path: "relative.exe" },
    { path: report.artifact.path, extra: true },
    { path: report.artifact.path, max_callbacks: 4097 },
  ]) {
    const result = await boundary.inspect(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error._tag).toBe("AnalysisInputError");
  }
  const result = await boundary.inspect(
    { path: report.artifact.path },
    { signal: AbortSignal.abort() },
  );
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error._tag).toBe("AnalysisCancelledError");
});
it.each([
  { ...report, examined_callbacks: 1 },
  { ...report, bits: 32 as const },
  { ...report, artifact: { ...report.artifact, path: "/another.exe" } },
  { ...report, artifact: { ...report.artifact, bytes: 67108865 } },
])("rejects inconsistent provider output", async (value) => {
  const result = await service(value).inspect({ path: report.artifact.path });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error._tag).toBe("AnalysisOutputError");
});
