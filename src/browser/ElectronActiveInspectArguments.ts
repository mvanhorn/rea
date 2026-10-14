import type { ElectronFusePort } from "../application/electron/ElectronFusePort.js";
import { BrowserObservationError } from "../domain/browserObservationError.js";
import {
  AnalysisCancelledError,
  AnalysisUnsupportedTargetError,
} from "../domain/analysisErrorCore.js";
import type { ElectronFuseReport } from "../domain/electron/electronFuses.js";

const OPERATION = "capture_electron_scenario" as const;
const INSPECT_ARGUMENTS_FUSE = "EnableNodeCliInspectArguments";
/** Packaged macOS Electron stores the fuse sentinel in the .app's Electron Framework. */
const MACOS_APP_EXECUTABLE = /^(.*\.app)\/Contents\/MacOS\/[^/]+$/u;

const electronFuseInspectionPath = (
  executablePath: string,
  platform: NodeJS.Platform = process.platform,
): string => {
  if (platform !== "darwin") return executablePath;
  return MACOS_APP_EXECUTABLE.exec(executablePath)?.[1] ?? executablePath;
};

/**
 * Active capture attaches through Node inspector arguments. When every observed
 * EnableNodeCliInspectArguments wire is not honored, Electron ignores those
 * arguments and the startup deadline would elapse with no inspector. Missing,
 * honored, unknown, or unreadable wires keep today's launch. Cancellation is
 * not an unreadable wire.
 */
export const refuseDisabledInspectArguments = async (
  fuses: ElectronFusePort | undefined,
  executablePath: string,
  signal: AbortSignal | undefined,
): Promise<AnalysisUnsupportedTargetError | undefined> => {
  if (fuses === undefined) return undefined;
  let inspected: Awaited<ReturnType<ElectronFusePort["inspect"]>>;
  try {
    inspected = await fuses.inspect(
      { path: electronFuseInspectionPath(executablePath) },
      signal === undefined ? undefined : { signal },
    );
  } catch (cause: unknown) {
    if (isInspectionCancellation(cause, signal)) throw cause;
    return undefined;
  }
  if (!inspected.ok) {
    if (isInspectionCancellation(inspected.error, signal))
      throw inspected.error;
    return undefined;
  }
  if (signal?.aborted === true)
    throw new BrowserObservationError(OPERATION, "cancelled");
  if (!inspectArgumentsDisabled(inspected.value)) return undefined;
  return new AnalysisUnsupportedTargetError(
    OPERATION,
    executablePath,
    `${INSPECT_ARGUMENTS_FUSE} is disabled or removed, so Electron ignores Node inspector arguments and active capture cannot attach.`,
    {
      remediationAction:
        "Use passive CDP tools, or a stock Electron runtime with the extracted app.",
    },
  );
};

const inspectArgumentsDisabled = (report: ElectronFuseReport): boolean => {
  const implications = report.runtime_implications.filter(
    (implication) => implication.subject === "node_cli_inspect_arguments",
  );
  return (
    implications.length > 0 &&
    implications.every((implication) => implication.outcome === "not_honored")
  );
};

const isInspectionCancellation = (
  cause: unknown,
  signal: AbortSignal | undefined,
): boolean =>
  signal?.aborted === true ||
  cause instanceof AnalysisCancelledError ||
  (cause instanceof Error && cause.name === "AbortError");
