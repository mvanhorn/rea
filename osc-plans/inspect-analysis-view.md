---
generated_by: osc-newfeature
type: feat
repo: morluto/rea
bulk_run: true
feature_complexity: M
linked_issue: 1050
stem: inspect-analysis-view
title: "feat(mcp): select views of retained analysis results"
dogfooded_general: false
Files:
  - src/domain/analysisView/analysisView.ts
  - src/domain/analysisView/analysisView.test.ts
  - src/domain/analysisView/binaryLayoutView.ts
  - src/domain/analysisView/javascriptApplicationView.ts
  - src/application/analysisView/AnalysisViewService.ts
  - src/application/analysisView/AnalysisViewService.test.ts
  - src/contracts/analysisViewToolContracts.ts
  - src/contracts/toolContracts.ts
  - src/contracts/toolEffects.ts
  - src/contracts/toolOutputSchemaGroups.ts
  - src/contracts/promptContracts.ts
  - src/contracts/toolContracts.test.ts
  - src/server/registerAnalysisViewTool.ts
  - src/server/createServer.ts
  - src/cliCommandNames.ts
  - src/cli/analysisViewCommands.ts
  - src/cli.ts
  - src/application/CapabilityInventory.ts
  - skill-src/reverse-engineer-anything/SKILL.md
  - skill-src/reverse-engineer-anything/references/evidence-workflows.md
  - skill-src/reverse-engineer-anything/references/javascript-applications.md
  - skill-src/reverse-engineer-anything/references/native-and-artifacts.md
  - docs/mcp-contracts.md
  - docs/javascript-artifact-reconstruction.md
  - docs/binary-diagnostics.md
  - tests/boundary/mcp/analysisViewMcp.test.ts
  - tests/boundary/cli/analysisViewCli.test.ts
  - tests/boundary/mcp/binaryDiagnosticsMcp.test.ts
  - tests/boundary/mcp/retainedApplicationEvidenceMcp.test.ts
---

# feat(mcp): select views of retained analysis results

Implementation plan for [morluto/rea#1050](https://github.com/morluto/rea/issues/1050). The pull request must link that issue (`Fixes #1050` or `Refs #1050` plus the template checkbox). Scope is already agreed in the issue; this PR implements the smallest shared application workflow, not a query language and not catalog truncation.

## Problem

Complete analysis results are correct and must stay available, but they are hard for MCP clients to consume. A source-generated ELF with a canonical extended section-name index produced 65,281 section rows: the CLI succeeded, while an MCP client with an enlarged receive buffer still spent most of a 120-second budget on transfer. A 300-function source-owned JavaScript tree completes on the CLI and closes a default SDK stdio client (`ReadBuffer exceeded maximum size of 10485760 bytes`).

Today:

- Default tool results still embed `result`, `evidence.normalized_result`, text, and structured content.
- Oversized MCP delivery already retains Evidence and returns a typed transport constraint (`#1088`). Recovery then points at `export_evidence_bundle` or `trace_application_feature`.
- `get_evidence_bundle` returns the entire session bundle, which is larger than the failed tool result.
- CLI `--filter-output` is a post-serialization field filter, has no MCP equivalent, and still constructs the complete analysis first.
- `trace_application_feature` can follow one seed through a JavaScript graph, but only after the caller already knows a module, route, or string. There is no summary, stable page, section, symbol, or mitigation view of a retained record.
- `inspect_binary_layout` has no follow-up inspect primitive at all.

Agents therefore re-run expensive analysis or lose the session instead of reading the one object they asked for.

## User-facing behavior

Add one inspect tool, `inspect_analysis_view` (CLI `inspect-analysis-view`), that projects a caller-selected view of **already completed** analysis Evidence.

### MCP

1. Caller runs `inspect_binary_layout` or `analyze_javascript_application` as today. The complete default schema is unchanged. If the MCP frame cannot carry the complete payload, the existing transport constraint still includes `evidence_reference: { kind: "retained-evidence", evidence_id }`.
2. Caller then calls:

```json
{
  "name": "inspect_analysis_view",
  "arguments": {
    "source": { "kind": "retained-evidence", "evidence_id": "ev_<64 hex>" },
    "view": { "kind": "summary" }
  }
}
```

3. The result is useful inline: artifact identity, parent Evidence ID, a **view digest of the projected bytes** (never the parent record digest), the selected facts, coverage, limitations, and unknowns. No second opaque lookup is required to understand the answer.
4. Follow-up views of the same retained record (one section, one module, a stable page) do not re-run the provider.

### CLI

Same workflow over a saved Evidence JSON file (one-shot CLI has no MCP session):

```bash
rea inspect-binary-layout ./selected.elf --json > layout.json
rea inspect-analysis-view --json <<'EOF'
{"source":{"kind":"inline","evidence": <layout.json Evidence record>},
 "view":{"kind":"item","collection":"sections","selector":{"name":".text"}}}
EOF
```

CLI also accepts a path to a JSON file, matching other application-graph commands.

### Views in the first PR

Supported source operations only:

| Source `operation` | `view.kind` | Selector | Inline facts |
| --- | --- | --- | --- |
| `inspect_binary_layout` | `summary` | none | artifact path/sha256/bytes, format, arch, image type, entry, counts of sections/segments/symbols/relocations, limitation count |
| `inspect_binary_layout` | `facet` | `mitigations` or `linkage` | existing mitigation object, or needed libraries / interpreters / GOT/PLT display names |
| `inspect_binary_layout` | `item` | `sections` by `index` or exact `name`; `symbols` by exact `name` | the one row plus its original ranges |
| `inspect_binary_layout` | `page` | `sections` or `symbols`, caller `offset` + `limit` | stable index order, `next_offset` or `exhausted` |
| `analyze_javascript_application` | `summary` | none | input path/format, root digest, `statistics`, Electron `summary` counts, limitation count — **not** `graph` or `semantic_graph` |
| `analyze_javascript_application` | `page` | `modules`, caller `offset` + `limit` | `{ node_id, kind, path }` only |
| `analyze_javascript_application` | `item` | `modules` by exact `path` or `node_id` | that node’s identity, exports, hashes, source ranges — **omit source text** |

Default complete tool results stay on the original tools. This tool never silently truncates a complete schema.

### Failures (typed, not empty)

- Unknown / stale `evidence_id`, or Evidence from another session: same recovery shape as other retained-reference tools (ID + export/re-analyze guidance).
- Evidence whose `operation` is not one of the two supported producers: unsupported-target with the actual operation name.
- Ambiguous section/module name: actionable list of candidate indexes/ids; do not pick one.
- Page `offset` past the collection: empty `items` with `exhausted: true` and the actual count.
- Malformed view object: input validation, distinct from unsupported producer.

No extra approval flags. Selecting the view is the intent. No new process, network, or mutation authority. Do not re-run pwntools, JADX, or JavaScript reconstruction.

## API / contract changes

New canonical tool. Do not change `inspect_binary_layout` or `analyze_javascript_application` input/output schemas.

```ts
// inspect_analysis_view
input: z.strictObject({
  source: z.discriminatedUnion("kind", [
    retainedEvidenceReferenceSchema, // { kind: "retained-evidence", evidence_id }
    z.strictObject({ kind: z.literal("inline"), evidence: evidenceSchema }),
  ]),
  view: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("summary") }),
    z.strictObject({
      kind: z.literal("facet"),
      facet: z.enum(["mitigations", "linkage"]),
    }),
    z.strictObject({
      kind: z.literal("item"),
      collection: z.enum(["sections", "symbols", "modules"]),
      selector: z.union([
        z.strictObject({ index: z.number().int().nonnegative() }),
        z.strictObject({ name: z.string().min(1) }),
        z.strictObject({ path: z.string().min(1) }),
        z.strictObject({ node_id: z.string().min(1) }),
      ]),
    }),
    z.strictObject({
      kind: z.literal("page"),
      collection: z.enum(["sections", "symbols", "modules"]),
      offset: z.number().int().nonnegative(),
      limit: z.number().int().positive().max(MEASURED_PAGE_LIMIT),
    }),
  ]),
})
```

`MEASURED_PAGE_LIMIT` is not a fashion cap. Measure encoded bytes of a representative section/module identity row plus the view envelope against the pinned SDK 10 MiB stdio budget and Node’s single-string limit; pick the largest `limit` that keeps a worst-case page inside that budget with headroom for Evidence wrapping. Document the measured bound in the contract description. Caller `limit` is required for `page` views so agents choose the page; do not invent a default that looks like silent truncation.

Output (wrapped with `evidenceResultOf`):

- `parent_evidence_id`
- `parent_operation`
- `parent_digest` (complete record identity; informational only)
- `view` (echo of the request)
- `view_digest` (SHA-256 of canonical projected JSON — **must change when projected content changes**)
- `artifact` identity (path + sha256 from the parent record)
- `items` / `facet` / `summary` payload
- `coverage`: `{ status: "complete-within-view" | "page" | "empty", examined, total, next_offset, exhausted }`
- `limitations` and explicit unknowns copied or narrowed from the parent (never dropped)

Catalog / wiring:

- Append the contract to `TOOL_CONTRACTS` (new group file, same pattern as binary diagnostics).
- `toolEffects`: session Evidence write, no process/network. `kind: "application"`.
- `promptContracts`: after oversized `analyze_javascript_application` / `inspect_binary_layout`, prefer `inspect_analysis_view` with the retained ID; `trace_application_feature` remains the relationship tracer once a seed is known.
- Skill text in `skill-src/` only. Never commit `skills/`, `src/generatedMcpToolCatalog.ts`, or `docs/public/product-catalog.json`.
- `docs:check` after contract/metadata edits.

Nearest existing tools (do not overload them):

- `trace_application_feature` — relationship walk, JavaScript-only, needs a seed.
- `get_evidence_bundle` / `export_evidence_bundle` — complete bundle, not a selected object.
- CLI `--filter-output` — field names, not object/facet identity.

## Files to touch

| Area | Path | Change |
| --- | --- | --- |
| Domain | `src/domain/analysisView/analysisView.ts` | View request/result schemas, view digest, dispatcher |
| Domain | `src/domain/analysisView/binaryLayoutView.ts` | Project layout `normalized_result` |
| Domain | `src/domain/analysisView/javascriptApplicationView.ts` | Project application graph without source text |
| Application | `src/application/analysisView/AnalysisViewService.ts` | Resolve retained/inline Evidence via existing `EvidenceInputResolver`, authenticate, project, wrap Evidence |
| Contracts | `src/contracts/analysisViewToolContracts.ts` | Named contract, examples |
| Contracts | `src/contracts/toolContracts.ts`, `toolEffects.ts`, `toolOutputSchemaGroups.ts`, `promptContracts.ts`, `toolContracts.test.ts` | Inventory, effects, output group, prompts, name floor |
| MCP | `src/server/registerAnalysisViewTool.ts`, `createServer.ts` | Register with session Evidence writer |
| CLI | `src/cliCommandNames.ts`, `src/cli/analysisViewCommands.ts`, `src/cli.ts` | `inspect-analysis-view` |
| Availability | `src/application/CapabilityInventory.ts` | Advertise without requiring an open deep-analysis target |
| Authored docs/skills | `skill-src/...`, `docs/mcp-contracts.md`, `docs/javascript-artifact-reconstruction.md`, `docs/binary-diagnostics.md` | Replace “compact views are tracked in #1050” with the shipped workflow |
| Tests | see below | |

Do not edit provider/bridge code. Do not change `src/server/toolResult.ts` default complete encoding in this PR.

## Tests

Focused module tests (domain/application):

- Summary/item/page projections for both producers using existing fixtures (`tests/fixtures/binaryDiagnostics/layout.js`, JavaScript application graphs from `JavaScriptApplicationService`).
- View digest changes when the selected row changes; view digest differs from parent Evidence digest when content is a subset.
- Ambiguous names, missing indexes, stale IDs, unsupported parent operations.
- JavaScript module item omits source text even when the parent graph has it.
- Page exhaustion and stable ordering.

Boundary MCP (in-memory SDK client, same style as `tests/boundary/mcp/binaryDiagnosticsMcp.test.ts` and `retainedApplicationEvidenceMcp.test.ts`):

- Advertised input/output schemas valid after SDK conversion.
- `inspect_binary_layout` records Evidence; `inspect_analysis_view` with that ID returns one section inline; CLI/MCP payloads match.
- `analyze_javascript_application` retained reference → summary view without `graph` / `semantic_graph`.
- Invalid/stale references, schema reject of extra properties (`approval`, unknown view kinds).
- Oversized-delivery recovery: reuse the existing transport-constraint fixture path so `details.evidence_reference` is accepted as `source`.

CLI:

- JSON file input; malformed JSON; missing source.

Do not put the 65,281-section complete MCP transfer in the default lane. Keep that in `npm run verify:binary:layout` / the optional large MCP lane. Add a **small** generated ELF or the existing layout fixture for ordinary CLI/MCP views. A 20–40 function generated JS tree is enough to show summary vs complete size.

After adding tests: `npm run verify:test-discovery`.

## Verification commands

```bash
nvm use   # Node 24.18.x, npm 11.16.x
npm ci
npm run test:focused -- \
  src/domain/analysisView/analysisView.test.ts \
  src/application/analysisView/AnalysisViewService.test.ts \
  tests/boundary/mcp/analysisViewMcp.test.ts \
  tests/boundary/cli/analysisViewCli.test.ts
npm run check:fast
npm run check
npm run docs:check
npm run verify:test-discovery
```

If pwntools is available (same profile as `inspect_binary_layout`):

```bash
npm run verify:binary:layout
```

Real Hopper/Ghidra are not required and should not be claimed. State that in the PR Validation section.

## 30–45s demo storyboard

Use a **generated** JavaScript tree only (no third-party application, no proprietary binary). Optional ELF clip is extra, not required for the video.

1. **0–8s** — Terminal: write `fixture/monolith.js` with ~40 `function selected_N` bodies. Caption: “Complete analysis is kept. Agents need one view.”
2. **8–18s** — `rea analyze-javascript-application ./fixture --json | wc -c` (or `jq 'keys'`) showing a large complete document and `statistics.parsed_javascript_files`.
3. **18–28s** — MCP: `analyze_javascript_application` then `inspect_analysis_view` `{ kind: "summary" }`. Show `statistics`, `parent_evidence_id`, `view_digest`, and that `graph` is absent. Highlight byte count vs step 2.
4. **28–40s** — MCP: `{ kind: "item", collection: "modules", selector: { path: "monolith.js" } }` returning path, exports, ranges. Caption: “Same Evidence. One module. No re-analysis.”
5. **40–45s** — One-line close: complete result still available on the original tool / `export_evidence_bundle`.

If the renderer has gcc + the documented pwntools profile, a second take can show `.text` from `inspect_binary_layout` Evidence. Do not use vendor binaries.

## Duplicate-check evidence

Checked 2026-10-09 against `morluto/rea` `main` `283c82f68ce49037a5e3ffdf0cada9208aef69f3` (fork `mvanhorn/rea` matches).

| Surface | Result |
| --- | --- |
| Open PRs | `#1106` release bot, `#1122` unrelated draft. None implement selected views. |
| Open issues | **#1050 is this work** (unassigned). `#1065` T1 (transport retain) is done; selected-view continuation still open. `#723` is discovery/result *repetition*, not object/facet views. |
| Merges last two weeks | `#1088` retain complete results on transport limits; `#1055` large-ASAR analysis; `#1024` CLI stream large JSON. Docs still say compact MCP views are `#1050`. |
| Code search | No `inspect_analysis_view` / `result_view` / caller-selected view API. |
| Closed PRs linking views | `#1088` recovery only. |

Not implemented. No competing PR. Implementation PR should link `#1050`.
