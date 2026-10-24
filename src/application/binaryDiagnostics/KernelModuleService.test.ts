import { expect, it } from "vitest";
import { KernelModuleService } from "./KernelModuleService.js";
import { KERNEL_MODULE_PROVIDER } from "../../domain/investigationProviders.js";
import type { KernelModule } from "../../domain/native/kernelModule.js";
import { ok } from "../../domain/result.js";
import {
  AnalysisCancelledError,
  AnalysisInputError,
  AnalysisOutputError,
} from "../../domain/analysisErrorCore.js";

const identity = KERNEL_MODULE_PROVIDER;
const digest = "a".repeat(64);
const report: KernelModule = {
  artifact: { path: "/artifacts/demo.ko", sha256: digest, bytes: 512 },
  format: "elf64",
  byte_order: "little",
  machine: 62,
  type: 1,
  type_name: "relocatable",
  applicability: "applicable",
  compression: null,
  next_probe: null,
  modinfo: {
    status: "present",
    location: { offset: 64, bytes: 0 },
    sha256: digest,
    entries: [],
    reason: null,
  },
  versions: {
    status: "absent",
    layout: "elf64_unsigned_long_name56",
    entry_bytes: 64,
    location: null,
    sha256: null,
    entries: [],
    reason: null,
  },
  this_module: {
    status: "absent",
    location: null,
    layout: "unknown",
  },
  ksymtab: { status: "observed", sections: [] },
  init_text: {
    status: "absent",
    location: null,
    bytes: null,
    compressed: null,
  },
  exit_text: {
    status: "absent",
    location: null,
    bytes: null,
    compressed: null,
  },
  signature: {
    status: "absent",
    magic: null,
    info: null,
    pkcs7: null,
    reason: null,
  },
  coverage: { status: "complete", examined_entries: 0 },
  limitations: ["Kernel module metadata was not executed."],
};

it("rejects a relative path and extra arguments before reading", async () => {
  let calls = 0;
  const service = new KernelModuleService({
    identity,
    inspect: () => {
      calls += 1;
      return Promise.resolve(ok(report));
    },
  });
  const relative = await service.inspect({ path: "demo.ko" });
  const extra = await service.inspect({
    path: report.artifact.path,
    extra: true,
  });
  expect(relative.ok).toBe(false);
  expect(extra.ok).toBe(false);
  if (!relative.ok) expect(relative.error).toBeInstanceOf(AnalysisInputError);
  if (!extra.ok) expect(extra.error).toBeInstanceOf(AnalysisInputError);
  expect(calls).toBe(0);
});

it("records an applicable module and its x86_64 architecture", async () => {
  const result = await new KernelModuleService({
    identity,
    inspect: () => Promise.resolve(ok(report)),
  }).inspect({ path: report.artifact.path });
  expect(result.ok).toBe(true);
  if (!result.ok) throw result.error;
  expect(result.value).toMatchObject({
    confidence: "observed",
    subject: { format: "elf", architecture: "x86_64" },
    normalized_result: report,
  });
});

it("rejects a report whose entry count does not match the examined sections", async () => {
  const result = await new KernelModuleService({
    identity,
    inspect: () =>
      Promise.resolve(
        ok({
          ...report,
          coverage: { status: "complete", examined_entries: 1 },
        }),
      ),
  }).inspect({ path: report.artifact.path });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBeInstanceOf(AnalysisOutputError);
});

it("discards an observation if the caller cancels while the provider completes", async () => {
  const controller = new AbortController();
  const service = new KernelModuleService({
    identity,
    inspect: () => {
      controller.abort();
      return Promise.resolve(ok(report));
    },
  });
  const result = await service.inspect(
    { path: report.artifact.path },
    { signal: controller.signal },
  );
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBeInstanceOf(AnalysisCancelledError);
});
