import { chmod, mkdir, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "vitest";

import { runDoctorOwned } from "./application/Doctor.js";
import { DOCTOR_PROVIDER_IDS } from "./application/DoctorProviderIds.js";
import { providerRegistrationEnvironment } from "./application/SetupRegistrationEnvironment.js";
import { CLI_COMMANDS } from "./cliCommandNames.js";
import { logCliCommand } from "./cliLogging.js";
import { createSystemDoctorHost } from "./doctorRuntime.js";
import { silentLogger } from "./logger.js";
import { createTestTempDirectory } from "../tests/fixtures/temporaryDirectory.js";
import { writeJadxJarInventory } from "../tests/fixtures/android/jadxJar.js";

const it = test.skipIf(process.platform === "win32");

it("exposes jadx through the doctor provider selector", () => {
  expect(DOCTOR_PROVIDER_IDS).toContain("jadx");
});

it("carries a validated REA_JADX_MCP_JAR into the provider registration environment", async () => {
  const root = await createTestTempDirectory("rea-jadx-registration-");
  const jar = join(root, "jadx-headless-mcp.jar");
  const javaHome = await createFakeJdk(root);
  await writeJadxJarInventory(jar);

  const host = createSystemDoctorHost({
    REA_JADX_MCP_JAR: jar,
    JAVA_HOME: javaHome,
  });
  const inspections = await host.providerInspections?.();
  expect(inspections?.map(({ id }) => id)).toContain("jadx");

  const environment = providerRegistrationEnvironment(inspections ?? []);
  expect(environment).toMatchObject({
    REA_JADX_MCP_JAR: await realpath(jar),
  });
});

it("omits REA_JADX_MCP_JAR from the provider registration environment when it is not configured", async () => {
  const host = createSystemDoctorHost({});
  const inspections = await host.providerInspections?.();

  const environment = providerRegistrationEnvironment(inspections ?? []);
  expect(environment).not.toHaveProperty("REA_JADX_MCP_JAR");
});

test("exits nonzero when scoped hopper readiness rejects a startup timeout of 0", async () => {
  const root = await createTestTempDirectory("rea-doctor-config-");
  const report = await runDoctorOwned(
    undefined,
    createSystemDoctorHost({
      HOME: root,
      USERPROFILE: root,
      REA_HOPPER_STARTUP_TIMEOUT_MS: "0",
    }),
    { providers: ["hopper"] },
  );
  const configuration = report.scope_checks.find(
    ({ name }) => name === "configuration",
  );

  expect(report.healthy).toBe(false);
  expect(configuration).toMatchObject({
    ok: false,
    classification: "config_drift",
    detail: expect.stringContaining("REA_HOPPER_STARTUP_TIMEOUT_MS"),
  });
  expect(JSON.stringify(configuration)).not.toContain('"0"');
  expect(report.informational_checks.map(({ name }) => name)).not.toContain(
    "configuration",
  );
  const previousExitCode = process.exitCode;
  try {
    await logCliCommand(silentLogger, CLI_COMMANDS.doctor, async () => report);
    expect(process.exitCode).toBe(1);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test("accepts a 120000 Hopper startup timeout without a configuration failure", async () => {
  const root = await createTestTempDirectory("rea-doctor-config-");
  const report = await runDoctorOwned(
    undefined,
    createSystemDoctorHost({
      HOME: root,
      USERPROFILE: root,
      REA_HOPPER_STARTUP_TIMEOUT_MS: "120000",
    }),
    { providers: ["hopper"] },
  );

  expect(report.checks.map(({ name }) => name)).not.toContain("configuration");
});

const createFakeJdk = async (root: string): Promise<string> => {
  const javaHome = join(root, "fake-jdk");
  const bin = join(javaHome, "bin");
  const java = join(bin, "java");
  await mkdir(bin, { recursive: true });
  await writeFile(
    java,
    "#!/bin/sh\nprintf 'java.base@21\\njdk.compiler@21\\n'\n",
  );
  await chmod(java, 0o700);
  return javaHome;
};
