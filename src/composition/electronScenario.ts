import type { ElectronFusePort } from "../application/electron/ElectronFusePort.js";
import type { ElectronActiveObservationPort } from "../application/javascript/ElectronActiveObservationPort.js";
import {
  PlaywrightElectronActiveProvider,
  type ElectronActiveLaunch,
} from "../browser/PlaywrightElectronActiveProvider.js";
import { createElectronFuseService } from "./electronFuses.js";

/** Construct a fresh provider without opening a target or acquiring an engine. */
export const createElectronScenarioProvider = (
  environment: Readonly<Record<string, string | undefined>>,
  dependencies: {
    readonly launch?: ElectronActiveLaunch;
    readonly fuses?: ElectronFusePort;
  } = {},
): ElectronActiveObservationPort =>
  new PlaywrightElectronActiveProvider(
    environment,
    dependencies.launch,
    dependencies.fuses ?? createElectronFuseService().provider,
  );
