import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect } from "vitest";

import { createTestTempDirectory } from "../fixtures/temporaryDirectory.js";
import { cliTest } from "../support/cli/cliFixture.js";

const REJECTED_SYMBOL = "main";

cliTest(
  "identifies a rejected objdump symbol field in the public full error envelope",
  async ({ cli }) => {
    const root = await createTestTempDirectory("rea-objdump-input-");
    const fixture = Buffer.from("not-elf");
    expect(fixture).toHaveLength(7);
    const path = join(root, "sample.txt");
    await writeFile(path, fixture);
    const result = await cli.run({
      arguments: [
        "inspect-with-objdump",
        path,
        "symbols",
        "--symbol",
        REJECTED_SYMBOL,
        "--json",
        "--full-output",
      ],
    });

    expect(result.exitCode, result.stderr).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.json).toMatchObject({
      ok: false,
      error: {
        code: "invalid_request",
        category: "invalid_input",
        retryable: false,
        recovery: {
          kind: "inspect_input_contract",
          operation: "inspect_with_objdump",
        },
        details: {
          operation: "inspect_with_objdump",
          issues: [{ path: ["symbol"], reason: "unknown_argument" }],
        },
      },
    });
    const response = result.json;
    if (
      typeof response !== "object" ||
      response === null ||
      !("error" in response) ||
      typeof response.error !== "object" ||
      response.error === null ||
      !("details" in response.error)
    )
      throw new Error("expected public diagnostic details");
    expect(JSON.stringify(response.error.details)).not.toContain(
      REJECTED_SYMBOL,
    );
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("ZodError");
    expect(serialized).not.toContain('"cause"');
    expect(serialized).not.toContain("unrecognized_keys");
  },
);
