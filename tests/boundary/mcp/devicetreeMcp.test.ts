import { advertisedMcpToolSchemas } from "../../fixtures/advertisedMcpTool.js";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "vitest";
import { toolContract } from "../../../src/contracts/toolContracts.js";
import { EvidenceMcpServer } from "../../../src/server/EvidenceMcpServer.js";
import { registerDevicetreeTool } from "../../../src/server/registerDevicetreeTool.js";
import { registerAnalysisViewTool } from "../../../src/server/registerAnalysisViewTool.js";
import { createToolResultDelivery } from "../../../src/server/toolResult.js";
import { DevicetreeProvider } from "../../../src/firmware/devicetree/DevicetreeProvider.js";
import { DevicetreeService } from "../../../src/application/binaryDiagnostics/DevicetreeService.js";
import { silentLogger } from "../../../src/logger.js";
import type { Evidence } from "../../../src/domain/evidence.js";
import { onTestFinished } from "vitest";
import { createTestBinarySession } from "../../fixtures/binarySession.js";
import { parseMcpToolError } from "../../fixtures/mcpToolError.js";
import { devicetreeFixture } from "../../../src/firmware/devicetree/Devicetree.fixture.js";
import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import { mcpTest } from "../../support/mcp/mcpFixture.js";

const createDtbServer = (
  session: ReturnType<typeof createTestBinarySession>,
) => {
  const service = new DevicetreeService(new DevicetreeProvider());
  onTestFinished(() => service.close());
  const record = (evidence: Evidence) => session.recordEvidence(evidence);
  const lookup = (id: string) => session.evidenceById(id);
  const server = new EvidenceMcpServer(
    { name: "dtb-boundary", version: "1" },
    {},
    record,
    createToolResultDelivery(undefined),
  );
  registerDevicetreeTool(server, service, silentLogger, record, lookup);
  registerAnalysisViewTool(server, silentLogger, lookup, record);
  return server;
};

mcpTest(
  "inspects DTB and pages retained properties without reopening the file",
  async ({ mcp }) => {
    const session = createTestBinarySession(() => {
      throw new Error("DTB inspection must not start an engine");
    });
    const client = await mcp.connect(createDtbServer(session));
    try {
      const schemas = await advertisedMcpToolSchemas(
        client,
        "inspect_devicetree",
      );
      const root = await createTestTempDirectory("rea-dtb-mcp-");
      const path = join(root, "board.dtb");
      await writeFile(path, devicetreeFixture());
      const response = await client.callTool({
        name: "inspect_devicetree",
        arguments: { path, detail: "summary" },
      });
      expect(response.isError, JSON.stringify(response)).not.toBe(true);
      expect(
        schemas.ajv.validate(schemas.outputSchema, response.structuredContent),
        JSON.stringify(schemas.ajv.errors),
      ).toBe(true);
      const result = toolContract("inspect_devicetree").outputSchema.parse(
        response.structuredContent,
      ).normalized_result;
      if (!("parent_evidence_id" in result))
        throw new Error("Expected summary view");
      expect(result.summary.unresolved_reference_count).toBe(1);
      await unlink(path);
      const page = await client.callTool({
        name: "inspect_analysis_view",
        arguments: {
          source: {
            kind: "retained-evidence",
            evidence_id: result.parent_evidence_id,
          },
          view: {
            kind: "devicetree",
            collection: "properties",
            path: "/serial@1000",
            offset: 0,
            limit: 1,
          },
        },
      });
      expect(page.isError, JSON.stringify(page)).not.toBe(true);
      expect(page.structuredContent).toMatchObject({
        normalized_result: {
          kind: "devicetree",
          items: [
            {
              name: "reg",
              source_index: 0,
              derived: {
                confidence: "derived",
                reg: [{ address: "0x1000", size: "0x100" }],
              },
            },
          ],
        },
      });
    } finally {
      await session.close();
    }
  },
  // Includes SDK schema conversion, dialect validation and two public calls.
  60_000,
);
mcpTest("rejects relative paths and unsupported versions", async ({ mcp }) => {
  const session = createTestBinarySession(() => {
    throw new Error("No engine");
  });
  const client = await mcp.connect(createDtbServer(session));
  try {
    const response = await client.callTool({
      name: "inspect_devicetree",
      arguments: { path: "board.dtb" },
    });
    expect(parseMcpToolError(response).error).toMatchObject({
      code: "invalid_request",
    });
    const root = await createTestTempDirectory("rea-dtb-mcp-version-");
    const path = join(root, "board.dtb");
    await writeFile(path, devicetreeFixture(undefined, 18));
    const unsupported = await client.callTool({
      name: "inspect_devicetree",
      arguments: { path },
    });
    expect(parseMcpToolError(unsupported).error).toMatchObject({
      code: "unsupported_target",
    });
  } finally {
    await session.close();
  }
});
