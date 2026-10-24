import { describe, expect, it } from "vitest";
import {
  inspectPeLoadConfigInputSchema,
  peLoadConfigSchema,
} from "../../domain/native/peLoadConfig.js";
import {
  parsePeLoadConfig,
  PeLoadConfigLimitFailure,
} from "./PeLoadConfigParser.js";
import {
  peLoadConfigImage,
  type PeLoadConfigFixtureOptions,
} from "./PeLoadConfig.fixture.js";

const parse = (
  options: PeLoadConfigFixtureOptions = {},
  max_callbacks = 64,
) => {
  const bytes = peLoadConfigImage(options);
  return parsePeLoadConfig(
    bytes,
    { path: "/sample.exe", sha256: "a".repeat(64), bytes: bytes.length },
    inspectPeLoadConfigInputSchema.parse({
      path: "/sample.exe",
      max_callbacks,
    }),
  );
};
describe.each([32, 64] as const)("PE%s load configuration", (bits) => {
  it("locates callbacks and separates flag claims", async () => {
    const report = await parse({ bits });
    expect(peLoadConfigSchema.safeParse(report).success).toBe(true);
    expect(report.tls?.callbacks).toHaveLength(3);
    expect(report.tls?.callbacks[0]).toMatchObject({
      rva: 0x2000,
      file_offset: 0x1600,
      section: ".text",
    });
    expect(report.tls?.callbacks[2]).toMatchObject({
      rva: 0x9000,
      file_offset: null,
      section: null,
    });
    expect(report.load_config?.guard_flags?.raw).toBe(0x500);
    expect(report.load_config?.inferences[0]?.evidence_kind).toBe("inferred");
    expect(report.load_config?.se_handler_count).toBe(bits === 32 ? 2 : null);
  });
  it("honors Size even when directory bytes contain newer fields", async () => {
    const report = await parse({
      bits,
      loadConfigSize: 64,
      loadConfigDirectorySize: 320,
    });
    expect(report.load_config?.guard_flags).toBeNull();
    expect(report.load_config?.security_cookie === null).toBe(bits === 64);
  });
  it.each(["empty", "absent"] as const)(
    "accepts %s callbacks",
    async (callbacks) => {
      expect((await parse({ bits, callbacks })).tls?.callbacks).toEqual([]);
    },
  );
  it("accepts exactly the callback budget and rejects overflow", async () => {
    expect(
      (await parse({ bits, callbackCount: 1 }, 1)).examined_callbacks,
    ).toBe(1);
    await expect(parse({ bits }, 1)).rejects.toBeInstanceOf(
      PeLoadConfigLimitFailure,
    );
  });
  it("reports absent directories", async () => {
    expect(await parse({ bits, tls: false, loadConfig: false })).toMatchObject({
      tls: null,
      load_config: null,
    });
  });
  it.each([
    "tls-unmapped",
    "tls-truncated",
    "tls-half",
    "load-config-oversize",
    "load-config-truncated",
    "load-config-half",
    "raw-data-inverted",
    "callback-unterminated",
    "ambiguous-section",
  ] as const)("rejects %s", async (malformed) => {
    await expect(parse({ bits, malformed })).rejects.toThrow();
  });
});

it("reads Size bytes past a legacy 64-byte PE32 directory", async () => {
  const report = await parse({ bits: 32, loadConfigDirectorySize: 64 });
  expect(report.load_config?.directory.size).toBe(64);
  expect(report.load_config?.size).toBeGreaterThan(64);
  expect(report.load_config?.se_handler_count).toBe(2);
  expect(report.load_config?.guard_flags?.raw).toBe(0x500);
});

it("preserves pointer precision and unknown flag bits", async () => {
  const bytes = peLoadConfigImage();
  // PE64 load config at 0x640; XFG slot at +280, GuardFlags at +144.
  bytes.writeBigUInt64LE(0xfedcba9876543210n, 0x640 + 280);
  bytes.writeUInt32LE(0xf0200100, 0x640 + 144);
  const report = await parsePeLoadConfig(
    bytes,
    { path: "/sample.exe", sha256: "a".repeat(64), bytes: bytes.length },
    inspectPeLoadConfigInputSchema.parse({ path: "/sample.exe" }),
  );
  expect(report.load_config?.guard_xfg_check_function_pointer).toEqual({
    va: "0xfedcba9876543210",
    rva: null,
    file_offset: null,
    section: null,
  });
  expect(report.load_config?.guard_flags).toMatchObject({
    unrecognized: 0x200000,
    cf_function_table_stride: 19,
  });
});

it("honors cancellation before parsing", async () => {
  const bytes = peLoadConfigImage();
  await expect(
    parsePeLoadConfig(
      bytes,
      { path: "/sample.exe", sha256: "a".repeat(64), bytes: bytes.length },
      inspectPeLoadConfigInputSchema.parse({ path: "/sample.exe" }),
      AbortSignal.abort(),
    ),
  ).rejects.toThrow();
});

it("retains a callback in virtual-only section storage with unknown file offset", async () => {
  expect(
    (await parse({ zeroFillCallback: true })).tls?.callbacks[0],
  ).toMatchObject({ rva: 0x2200, file_offset: null, section: ".text" });
});
