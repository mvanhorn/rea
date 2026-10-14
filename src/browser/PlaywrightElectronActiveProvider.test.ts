import { afterEach, expect, it, vi } from "vitest";
import { dirname } from "node:path";

import type { ElectronFusePort } from "../application/electron/ElectronFusePort.js";
import * as processOwnership from "../process/ProcessOwnership.js";
import * as electronActions from "./PlaywrightElectronActiveActions.js";
import { createElectronScenarioProvider } from "../composition/electronScenario.js";
import {
  AnalysisCancelledError,
  AnalysisInputError,
  AnalysisUnsupportedTargetError,
} from "../domain/analysisErrorCore.js";
import type { ElectronFuseReport } from "../domain/electron/electronFuses.js";
import { electronActiveObservationInputSchema } from "../domain/javascript/electronActiveObservation.js";
import type { CanonicalElectronActiveObservationInput } from "../application/javascript/ElectronActiveObservationPort.js";
import type { OwnedProcessGroup } from "../process/ProcessOwnership.js";
import { err, ok, type Result } from "../domain/result.js";
import type { AnalysisError } from "../domain/analysisErrorBase.js";
import {
  cleanupElectronProcesses,
  PlaywrightElectronActiveProvider,
  safeElectronEnvironment,
  type ElectronActiveLaunch,
} from "./PlaywrightElectronActiveProvider.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("passes the selected environment and ownership token to Electron launch", async () => {
  vi.stubEnv("LANG", "ambient-language");
  let launchedEnvironment: unknown;
  const provider = new PlaywrightElectronActiveProvider(
    {
      LANG: "selected-language",
      PATH: "/selected/bin",
      REA_PRIVATE_VALUE: "not-a-launch-setting",
    },
    async (options) => {
      launchedEnvironment = options?.env;
      throw new Error("launch boundary reached");
    },
  );
  const result = await provider.capture({
    ...electronActiveObservationInputSchema.parse({
      executable_path: process.execPath,
      application_path: process.execPath,
    }),
    application_root: dirname(process.execPath),
  });

  expect(result.ok).toBe(false);
  expect(launchedEnvironment).toEqual({
    LANG: "selected-language",
    PATH: "/selected/bin",
    REA_PROCESS_RUN_ID: expect.any(String),
  });
});

it("passes required Windows runtime variables without inheriting unrelated values", () => {
  expect(
    safeElectronEnvironment(
      {
        SYSTEMROOT: "C:\\Windows",
        LOCALAPPDATA: "C:\\Users\\analyst\\AppData\\Local",
        USERPROFILE: "C:\\Users\\analyst",
        APP_SECRET: "must-not-pass",
      },
      "run-id",
      "win32",
    ),
  ).toEqual({
    SYSTEMROOT: "C:\\Windows",
    LOCALAPPDATA: "C:\\Users\\analyst\\AppData\\Local",
    USERPROFILE: "C:\\Users\\analyst",
    REA_PROCESS_RUN_ID: "run-id",
  });
});

const ownership = {
  runId: "run",
  leaderPid: 4242,
  processGroupId: 4242,
  expectedParentPid: 1,
} satisfies OwnedProcessGroup;

const emptyHookSnapshot = () => ({
  events: [],
  retention_budget_bytes: 0,
  estimated_retained_bytes: 0,
  event_serialized_byte_upper_bound: 0,
  retained: 0,
  dropped: 0,
  dropped_ipc: 0,
  dropped_runtime: 0,
  dropped_event_families: [],
  dropped_event_roles: [],
  observed: 0,
  observed_ipc: 0,
  observed_runtime: 0,
  hook_error: false,
});

it("does not signal a Windows Electron PID when lineage is unavailable", async () => {
  const terminateTree = vi.fn(async () => ({
    cleaned: true as const,
    signaled: true,
  }));
  const result = await cleanupElectronProcesses(
    ownership,
    {
      status: "unavailable",
      observedAt: "2026-10-10T00:00:00.000Z",
      runId: ownership.runId,
      launcherPid: ownership.leaderPid,
      processGroupId: ownership.processGroupId,
      reason: "owned launcher is not live",
    },
    { platform: "win32", terminateTree },
  );

  expect(terminateTree).not.toHaveBeenCalled();
  expect(result).toEqual({
    cleaned: false,
    reason:
      "owned Electron lineage was unavailable; helper cleanup was not proven",
  });
});

it("signals a Windows Electron tree only after lineage is verified", async () => {
  const terminateTree = vi.fn(async () => ({
    cleaned: true as const,
    signaled: true,
  }));
  const result = await cleanupElectronProcesses(
    ownership,
    {
      status: "verified",
      observedAt: "2026-10-10T00:00:00.000Z",
      lineage: {
        runId: ownership.runId,
        launcherPid: ownership.leaderPid,
        launcherParentPid: 1,
        processGroupId: ownership.processGroupId,
        descendants: [
          {
            pid: 4343,
            parentPid: ownership.leaderPid,
            processGroupId: ownership.processGroupId,
          },
        ],
      },
    },
    { platform: "win32", terminateTree },
  );

  expect(terminateTree).toHaveBeenNthCalledWith(1, 4242);
  expect(terminateTree).toHaveBeenNthCalledWith(2, 4343);
  expect(result).toEqual({ cleaned: true, signaled: true });
});

it("retains the partial capture without taskkill when Windows lineage is unavailable", async () => {
  // Exercise the Windows decision branch; this is not native Windows coverage.
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: "win32" });
  const terminateTree = vi
    .spyOn(processOwnership, "cleanupWindowsProcessTree")
    .mockResolvedValue({ cleaned: true, signaled: true });
  vi.spyOn(electronActions, "readApplicationState").mockResolvedValue({
    windows: [],
    metrics: [],
    electronVersion: "44.0.0",
    hookSnapshot: emptyHookSnapshot(),
  });
  const application = {
    process: () => ({ pid: 424242 }),
    close: vi.fn(async () => undefined),
    windows: () => [],
  };
  const provider = new PlaywrightElectronActiveProvider(
    {},
    async () =>
      application as unknown as Awaited<
        ReturnType<typeof import("playwright-core")._electron.launch>
      >,
  );

  try {
    const result = await provider.capture({
      ...electronActiveObservationInputSchema.parse({
        executable_path: process.execPath,
        application_path: process.execPath,
      }),
      application_root: dirname(process.execPath),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected unverified cleanup to fail");
    expect(terminateTree).not.toHaveBeenCalled();
    expect(result.error).toMatchObject({
      _tag: "BrowserObservationError",
      reason: "cleanup_failed",
      cleanup: {
        reason:
          "owned Electron lineage was unavailable; helper cleanup was not proven",
      },
      partialObservation: {
        kind: "electron-active-observation",
        capture: {
          application: {
            cleanup: "unverified",
          },
        },
      },
    });
  } finally {
    if (originalPlatform !== undefined)
      Object.defineProperty(process, "platform", originalPlatform);
  }
});

it("retains the initial snapshot when the final state read fails", async () => {
  const initialState = {
    windows: [],
    metrics: [],
    electronVersion: "44.0.0",
    hookSnapshot: emptyHookSnapshot(),
  };
  vi.spyOn(electronActions, "readApplicationState")
    .mockResolvedValueOnce(initialState)
    .mockRejectedValueOnce(new Error("final renderer state unavailable"));
  const application = {
    process: () => ({ pid: 424242 }),
    close: vi.fn(async () => undefined),
    windows: () => [],
  };
  const provider = new PlaywrightElectronActiveProvider(
    {},
    async () =>
      application as unknown as Awaited<
        ReturnType<typeof import("playwright-core")._electron.launch>
      >,
  );

  const result = await provider.capture({
    ...electronActiveObservationInputSchema.parse({
      executable_path: process.execPath,
      application_path: process.execPath,
      actions: [],
    }),
    application_root: dirname(process.execPath),
  });

  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected final state capture to fail");
  const partialObservation = result.error.partialObservation;
  expect(partialObservation).toMatchObject({
    kind: "electron-active-observation",
    capture: {
      application: { electron_version: "44.0.0" },
      limitations: expect.arrayContaining([
        expect.stringContaining("initial pre-action snapshot"),
      ]),
    },
  });
});

const FUSE_READER_IDENTITY = {
  id: "recording-electron-fuses",
  name: "Recording Electron fuse reader",
  version: "1",
} as const;

const captureInput = (
  executable = process.execPath,
): CanonicalElectronActiveObservationInput => ({
  executable_path: executable,
  application_path: executable,
  application_root: dirname(executable),
  args: [],
  actions: [],
});

const fuseReport = (
  implications: readonly {
    readonly subject: "node_cli_inspect_arguments" | "electron_run_as_node";
    readonly outcome: "honored" | "not_honored" | "unknown";
  }[],
): ElectronFuseReport =>
  ({
    runtime_implications: implications.map((implication, index) => ({
      relationship: "derivation",
      subject: implication.subject,
      fuse_index: implication.subject === "node_cli_inspect_arguments" ? 3 : 0,
      outcome: implication.outcome,
      slice_index: index,
      sentinel_offset: index,
    })),
  }) as ElectronFuseReport;

const fuseReader = (
  inspect: ElectronFusePort["inspect"],
): ElectronFusePort => ({
  identity: FUSE_READER_IDENTITY,
  inspect,
});

const recordLaunch = (): {
  readonly launch: ElectronActiveLaunch;
  readonly calls: Parameters<ElectronActiveLaunch>[0][];
} => {
  const calls: Parameters<ElectronActiveLaunch>[0][] = [];
  return {
    calls,
    launch: async (options) => {
      calls.push(options);
      throw new Error("launch boundary reached");
    },
  };
};

const withPlatform = async (
  platform: NodeJS.Platform,
  run: () => Promise<void>,
): Promise<void> => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: platform });
  try {
    await run();
  } finally {
    if (originalPlatform !== undefined)
      Object.defineProperty(process, "platform", originalPlatform);
  }
};

const expectInspectArgumentsRefusal = (
  result: Result<unknown, AnalysisError>,
  executable: string,
): void => {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected fuse refusal");
  expect(result.error).toBeInstanceOf(AnalysisUnsupportedTargetError);
  expect(result.error).toMatchObject({
    _tag: "AnalysisUnsupportedTargetError",
    operation: "capture_electron_scenario",
    path: executable,
    reason:
      "EnableNodeCliInspectArguments is disabled or removed, so Electron ignores Node inspector arguments and active capture cannot attach.",
    remediationAction:
      "Use passive CDP tools, or a stock Electron runtime with the extracted app.",
  });
};

const refusedReport = (): ElectronFuseReport =>
  fuseReport([
    { subject: "node_cli_inspect_arguments", outcome: "not_honored" },
  ]);

it("refuses active capture before launch when EnableNodeCliInspectArguments is disabled", async () => {
  const { launch, calls } = recordLaunch();
  const provider = new PlaywrightElectronActiveProvider(
    {},
    launch,
    fuseReader(async () => ok(refusedReport())),
  );
  const executable = process.execPath;
  const result = await provider.capture(captureInput(executable));

  expect(calls).toEqual([]);
  expectInspectArgumentsRefusal(result, executable);
});

it("refuses active capture before launch when EnableNodeCliInspectArguments is removed", async () => {
  const { launch, calls } = recordLaunch();
  const provider = new PlaywrightElectronActiveProvider(
    {},
    launch,
    fuseReader(async () =>
      ok(
        fuseReport([
          { subject: "node_cli_inspect_arguments", outcome: "not_honored" },
          { subject: "electron_run_as_node", outcome: "honored" },
        ]),
      ),
    ),
  );
  const executable = process.execPath;
  const result = await provider.capture(captureInput(executable));

  expect(calls).toEqual([]);
  expectInspectArgumentsRefusal(result, executable);
});

it.each([
  {
    label: "enabled",
    inspected: async () =>
      ok(
        fuseReport([
          { subject: "node_cli_inspect_arguments", outcome: "honored" },
        ]),
      ),
  },
  {
    label: "unknown",
    inspected: async () =>
      ok(
        fuseReport([
          { subject: "node_cli_inspect_arguments", outcome: "not_honored" },
          { subject: "node_cli_inspect_arguments", outcome: "unknown" },
        ]),
      ),
  },
  {
    label: "mixed across slices",
    inspected: async () =>
      ok(
        fuseReport([
          { subject: "node_cli_inspect_arguments", outcome: "not_honored" },
          { subject: "node_cli_inspect_arguments", outcome: "honored" },
        ]),
      ),
  },
  {
    label: "absent",
    inspected: async () =>
      ok(
        fuseReport([
          { subject: "electron_run_as_node", outcome: "not_honored" },
        ]),
      ),
  },
  {
    label: "an inspection error",
    inspected: async () =>
      err(new AnalysisInputError("inspect_electron_fuses")),
  },
  {
    label: "a thrown inspection error",
    inspected: async () => {
      throw new Error("unreadable fuse wire");
    },
  },
])(
  "launches when the inspect-arguments fuse state is $label",
  async ({ label, inspected }) => {
    const { launch, calls } = recordLaunch();
    const provider = new PlaywrightElectronActiveProvider(
      {},
      launch,
      fuseReader(inspected),
    );
    const executable = process.execPath;
    const result = await provider.capture(captureInput(executable));

    expect(calls).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected launch boundary");
    expect(result.error._tag).not.toBe("AnalysisUnsupportedTargetError");
    if (label === "enabled")
      expect(calls[0]).toEqual(
        expect.objectContaining({
          executablePath: executable,
          cwd: dirname(executable),
          args: [
            "-r",
            expect.stringContaining("electron-active-hook.cjs"),
            executable,
          ],
        }),
      );
  },
);

it("passes a macOS executable inside an app bundle to the fuse reader as the enclosing .app", async () => {
  const executable = "/Applications/Example.app/Contents/MacOS/Example";
  const inspected: string[] = [];
  const { launch, calls } = recordLaunch();
  const provider = new PlaywrightElectronActiveProvider(
    {},
    launch,
    fuseReader(async (input) => {
      inspected.push(input.path);
      return ok(refusedReport());
    }),
  );

  await withPlatform("darwin", async () => {
    const result = await provider.capture(captureInput(executable));
    expect(inspected).toEqual(["/Applications/Example.app"]);
    expect(calls).toEqual([]);
    expectInspectArgumentsRefusal(result, executable);
  });
});

it("passes the executable itself when the host is not macOS", async () => {
  const executable = "/Applications/Example.app/Contents/MacOS/Example";
  const inspected: string[] = [];
  const { launch, calls } = recordLaunch();
  const provider = new PlaywrightElectronActiveProvider(
    {},
    launch,
    fuseReader(async (input) => {
      inspected.push(input.path);
      return ok(refusedReport());
    }),
  );

  await withPlatform("linux", async () => {
    const result = await provider.capture(captureInput(executable));
    expect(inspected).toEqual([executable]);
    expect(calls).toEqual([]);
    expectInspectArgumentsRefusal(result, executable);
  });
});

it("does not launch when fuse inspection is cancelled", async () => {
  const { launch, calls } = recordLaunch();
  const controller = new AbortController();
  const provider = new PlaywrightElectronActiveProvider(
    {},
    launch,
    fuseReader(async () => {
      controller.abort();
      return err(new AnalysisCancelledError("inspect_electron_fuses"));
    }),
  );
  const result = await provider.capture(captureInput(), {
    signal: controller.signal,
  });

  expect(calls).toEqual([]);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected cancellation");
  expect(result.error).toMatchObject({
    _tag: "BrowserObservationError",
    reason: "cancelled",
    operation: "capture_electron_scenario",
  });
});

it("wires the electron scenario fuse reader and refuses before launch", async () => {
  const inspected: string[] = [];
  const { launch, calls } = recordLaunch();
  const executable = process.execPath;
  const provider = createElectronScenarioProvider(
    {},
    {
      launch,
      fuses: fuseReader(async (input) => {
        inspected.push(input.path);
        return ok(refusedReport());
      }),
    },
  );
  const result = await provider.capture(captureInput(executable));

  expect(inspected).toEqual([executable]);
  expect(calls).toEqual([]);
  expectInspectArgumentsRefusal(result, executable);
});
