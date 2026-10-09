---
generated_by: osc-newfeature
type: feat
repo: morluto/rea
bulk_run: true
feature_complexity: S
linked_issue: 725
stem: export-shape-property-presence
title: "feat(javascript): report observed export property presence"
dogfooded_general: false
Files:
  - src/domain/javascript/javascriptExportShapeVariants.ts
  - src/domain/javascript/javascriptExportShapeComparison.ts
  - src/domain/javascript/javascriptExportShapeComparisonSchemas.ts
  - src/domain/javascript/javascriptExportShapeComparisonSchemas.test.ts
  - src/domain/javascript/javascriptExportShapeComparisonIdentity.ts
  - src/contracts/applicationToolContracts.ts
  - skill-src/reverse-engineer-anything/references/javascript-applications.md
  - docs/javascript-application-workflows.md
  - tests/boundary/filesystem/javascriptExportShapeComparison.test.ts
  - tests/boundary/mcp/applicationExportShapeMcp.test.ts
  - tests/acceptance/applications/applicationWorkflowCli.test.ts
---

# feat(javascript): report observed export property presence

Implementation plan for [morluto/rea#725](https://github.com/morluto/rea/issues/725). The pull request must link that issue. This extends `compare_javascript_export_shapes` in place: same tool, same selectors, same pairing rules, additive result fields plus a precise presence classification when parent coverage is complete.

## Problem

`compare_javascript_export_shapes` already selects one module/export per side and pairs return variants only by reciprocal unique literal discriminants. That is correct and must stay.

What it does not answer: **which returned property names were observed**, independently of whether their values resolved.

Maintainer evaluation (issue fixture):

- V1 `search` returns `{ matches, count }`.
- V2 `search` returns `{ matches, total, query }`.
- Without a discriminant, variants do not pair (`added=0, removed=0, changed=0, unknown=2`).
- With `kind: "results"` on both objects, variants pair, but `/count`, `/total`, and `/query` are all `unknown` because the values are call expressions / unresolved lengths.

`fieldChangeStatus` in `javascriptExportShapeVariants.ts` currently does:

```ts
if (present.state === "unknown" || !parentsComplete) return "unknown";
return leftField === undefined ? "added" : "removed";
```

So a property name that is clearly present on one variant and absent on the other is labeled `unknown` whenever the *value* did not project to a literal. Pairing confidence, property presence, and value resolution are collapsed into one status.

Analysts comparing two local JS versions therefore cannot see that `count` left the public object and `total`/`query` appeared, even though those names were observed in the AST.

## User-facing behavior

Same CLI/MCP entry points:

```bash
rea compare-javascript-export-shapes ./compare.json --json
```

```json
{
  "name": "compare_javascript_export_shapes",
  "arguments": {
    "left": { "kind": "retained-evidence", "evidence_id": "ev_..." },
    "right": { "kind": "retained-evidence", "evidence_id": "ev_..." },
    "left_selector": { "module_path": "search.js", "export_name": "search" },
    "right_selector": { "module_path": "search.js", "export_name": "search" }
  }
}
```

Observable changes:

1. Each selected variant lists **observed property paths** (JSON Pointers) even when the variant is unpaired or values are unknown.
2. Each change row reports **presence** on left and right: `present` | `absent` | `unknown-coverage`.
3. When parent-property coverage is complete on both paired shapes, a name present on only one side is `added` or `removed` for **presence**, while `left`/`right` value availability may still be `unknown`.
4. Dynamic values stay unknown. Incomplete spreads / partial parent coverage stay unknown (existing tests must keep passing).
5. Variants still pair only by reciprocal unique literal discriminants. Source order never implies correspondence.
6. Unpaired variants remain visible with their property inventories.

Example (tagged control from the issue): both sides return `{ kind: "results", ... }` with unresolved `matches.length` / `query` call expressions.

Before: `summary.unknown` includes `/count`, `/total`, `/query`.

After:

- `/count`: `status: "removed"`, presence left `present` / right `absent`, values unknown.
- `/total` and `/query`: `status: "added"`, values unknown.
- `/matches`: still unknown value if it remains an unresolved expression on both sides (presence `present`/`present`, status `unknown` or omitted if both values are unknown *and* presence is unchanged — prefer a row with `status: "unknown"` only when the caller needs the value gap; do not hide presence).

No execution, no new tools, no extra permission flags.

## API / contract changes

Keep `compare_javascript_export_shapes` name, input schema, and pairing.

Additive result fields (strict object — this is a deliberate output-schema change; regenerate catalog via `npm run build:cached`, do not commit generated files):

```ts
property_inventories: z.array(z.strictObject({
  side: z.enum(["left", "right"]),
  variant_index: z.number().int().nonnegative(),
  discriminant: discriminantSchema.nullable(),
  paired: z.boolean(),
  properties: z.array(jsonPointerSchema), // observed names, including unknown-value fields
  property_coverage: z.array(z.strictObject({
    path: jsonPointerSchema,
    status: z.enum(["complete", "partial"]),
  })),
}))

// on each change:
presence: z.strictObject({
  left: z.enum(["present", "absent", "unknown-coverage"]),
  right: z.enum(["present", "absent", "unknown-coverage"]),
})
```

Classification rules (domain, `fieldChangeStatus` / `diffPair`):

| Parent coverage | Left name | Right name | Value literals | `status` | `presence` |
| --- | --- | --- | --- | --- | --- |
| complete both | yes | no | any | `removed` | present / absent |
| complete both | no | yes | any | `added` | absent / present |
| complete both | yes | yes | both unknown | `unknown` | present / present |
| complete both | yes | yes | literals differ | `changed` | present / present |
| complete both | yes | yes | literals equal | omit row | — |
| partial either | yes | no | any | `unknown` | unknown-coverage on incomplete side |
| unpaired variant | n/a | n/a | n/a | keep unpaired unknown change | inventory still listed |

`summary.added` / `removed` count presence-level added/removed as well as literal value add/remove. `summary.unknown` no longer includes complete-coverage presence-only gaps. Document this in the tool description and `docs/javascript-application-workflows.md` so it is a stated contract clarification, not a silent semantic flip.

Do not add a second tool. Do not change `trace_javascript_semantics`. Update the contract `description` to mention property inventories and presence vs value.

## Files to touch

| Path | Change |
| --- | --- |
| `src/domain/javascript/javascriptExportShapeComparisonSchemas.ts` | `presence`, `property_inventories`; keep `comparisonChangeSchema` strict |
| `src/domain/javascript/javascriptExportShapeVariants.ts` | Split presence from value in `fieldChangeStatus` / `diffPair`; build inventories from each shape’s `fields` + `property_coverage` |
| `src/domain/javascript/javascriptExportShapeComparison.ts` | Pass inventories into the result; include them in `comparison_id` digest inputs so identical presence inventories stay stable |
| `src/domain/javascript/javascriptExportShapeComparisonIdentity.ts` | Canonicalize inventory + presence for digests |
| `src/contracts/applicationToolContracts.ts` | Description + example that shows a presence-only added path with unknown values |
| `docs/javascript-application-workflows.md` | Presence vs value vs pairing |
| `skill-src/reverse-engineer-anything/references/javascript-applications.md` | Instruct agents to read `presence` and `property_inventories` before treating `unknown` as “name not observed” |
| Tests listed below | Issue fixtures + spread-unknown regressions |

Do not touch MCP result encoding, binary diagnostics, or `inspect_analysis_view` files from the sibling plan.

## Tests

Extend `tests/boundary/filesystem/javascriptExportShapeComparison.test.ts`:

1. **Issue untagged control** — `search.js` v1 `{ matches, count }` vs v2 `{ matches, total, query }` with unresolved values and no unique discriminant: inventories list the names; pairing remains unpaired; do not invent a correspondence from property order.
2. **Issue tagged control** — both objects include `kind: "results"`: `/count` removed, `/total` and `/query` added, values unknown, `presence` populated, `summary.unknown` does not absorb those three presence facts.
3. Existing **spread incomplete** (`...dynamic`) cases still `unknown` with `presence` `unknown-coverage`.
4. Existing **literal `/depth` added** parser fixtures still `added` with literal right value.
5. Digest stability: same inputs → same `comparison_id` including inventories.

MCP: `tests/boundary/mcp/applicationExportShapeMcp.test.ts` — structured output includes `property_inventories` and `presence`; advertised output schema still validates after SDK conversion.

CLI: `tests/acceptance/applications/applicationWorkflowCli.test.ts` — one tagged presence case through `compare-javascript-export-shapes`.

Domain schema tests: reject a change object missing `presence`.

After adding tests: `npm run verify:test-discovery`.

## Verification commands

```bash
nvm use
npm ci
npm run test:focused -- \
  src/domain/javascript/javascriptExportShapeComparisonSchemas.test.ts \
  tests/boundary/filesystem/javascriptExportShapeComparison.test.ts \
  tests/boundary/mcp/applicationExportShapeMcp.test.ts \
  tests/acceptance/applications/applicationWorkflowCli.test.ts
npm run check:fast
npm run check
npm run docs:check
npm run verify:test-discovery
```

No Hopper, Ghidra, browser, or pwntools lane. State that in the PR.

## 30–45s demo storyboard

Generated local files only.

1. **0–8s** — Show `search-v1.js` and `search-v2.js` side by side:

```js
// v1
export function search(items, q) {
  const matches = items.filter((item) => item.includes(q));
  return { kind: "results", matches, count: matches.length };
}
// v2
export function search(items, q) {
  const matches = items.filter((item) => item.includes(q));
  return { kind: "results", matches, total: matches.length, query: String(q) };
}
```

2. **8–18s** — `rea analyze-javascript-application` on each directory (or one combined compare input after analysis). Caption: “Static export shapes. No execution.”
3. **18–32s** — `compare_javascript_export_shapes` MCP/CLI JSON. Highlight `property_inventories` (`/count` vs `/total`, `/query`) and change rows `removed /count`, `added /total`, `added /query` with `availability: "unknown"` for values.
4. **32–42s** — Contrast one line of `presence` vs value: “Names changed. Values stay unknown.”
5. **42–45s** — Close on the module path + export name selectors.

## Duplicate-check evidence

Checked 2026-10-09 against `morluto/rea` `main` `283c82f68ce49037a5e3ffdf0cada9208aef69f3`.

| Surface | Result |
| --- | --- |
| Open issues | **#725** is this work, unassigned. `#698` (closed) is container-only shape paths, already in the baseline the issue cites. |
| Open PRs | `#1106`, `#1122` — no export-shape presence work. |
| PR search | `compare_javascript_export_shapes` / “export property presence” — no implementing PR. |
| Recent merges | JavaScript self-import omission (`#1130`), defaults/argv classification, graph indexing — none change `fieldChangeStatus` presence rules. |
| Code | `fieldChangeStatus` still returns `unknown` when `present.state === "unknown"` even if the opposite side lacks the name. |

Not implemented. No competing PR. Implementation PR should link `#725`.
