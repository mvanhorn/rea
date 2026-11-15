Title: feat(artifacts): inventory macOS flat installer packages offline

## Summary

A `.pkg` whose bytes start with `xar!` was already classified as format `pkg`,
but inventory had no reader. Every host reported only the root hash and that
child inventory required a native macOS adapter. This change adds a portable,
read-only XAR reader so `inspect-artifact` / `inspect_artifact` and
`extract-artifact` / `extract_artifact` report what the installer contains
without `pkgutil`, installer JavaScript, or signature verification.

No issue is linked; none exists for this change.

## Problem and expected behavior

`classify.ts` and `BinaryTargetResolver` already return `"pkg"` for a
`.pkg` with `xar!` magic. `artifactFormats.ts` declared
`absentInventory: "platform"` with no `createReader`, so
`inspect-artifact installer.pkg` stopped at one occurrence.

Expected: the same command inventories the XAR header and TOC, product vs
component identity, Scripts and Payload members, Bom presence/size, and
signature metadata marked `not_verified`. Truncated or malformed input keeps
partial facts with named refusals. pbzx payloads keep the stored member and
record `unsupported-compression`.

## Change and scope

`MacosPkgArtifactReader` implements the existing `ArtifactReader` contract
with `format: "pkg"`. Domain constants and allowances live in
`macosPkgFormat.ts`. TOC XML, Distribution/PackageInfo, and gzip odc cpio
parsers live under `src/artifacts/macosPkg/`. `artifactFormats.ts` constructs
the reader, sets `absentInventory: "unavailable"`, and states the limitation
that signatures are not verified and that pbzx, Bom contents, and installer
JavaScript are not decoded or executed.

Zlib/gzip XAR members are decoded against named allowances: 1 MiB for
Distribution/PackageInfo XML, 64 MiB for one Scripts or Payload archive, and
`artifact_limits.expanded_bytes` for extraction. A TOC extracted-size above
that allowance is refused without inflating. A decoded length that disagrees
with the TOC is `extracted-size-mismatch`. `open()` stream-decodes gzip/zlib
members with that expansion budget. Every component Scripts/Payload is
expanded until the budget is exhausted; skipped component archives are named
and coverage is unknown.

No dedicated `inspect-pkg` command: `pkg` is already a classified container,
so inventory stays inside `inspect-artifact`. Extraction writes stored XAR
files and expanded gzip-cpio members into the existing contained output tree.

The workflow reads one caller-selected local file. It does not execute the
target, inject instrumentation, mutate bytes, recover protections, or contact
network services. Contribution scope: not applicable.

## Contract and boundary impact

- Semantic owner and earliest changed stage: `MacosPkgArtifactReader` owns pkg
  inventory and extraction. Consumers read `format_metadata.kind` `macos-pkg`
  / `macos-pkg-entry` from the existing artifact graph. The previous
  platform-adapter limitation for classified pkg roots is removed.
- Contribution scope fit and linked maintainer decision: not applicable
  (read-only local bytes; no execution, injection, mutation, or protection
  recovery).
- CLI and MCP/tool-catalog contract: existing `inspect-artifact` /
  `inspect_artifact` and `extract-artifact` / `extract_artifact`; no new
  tool names. Authored skill
  `.agents/skills/reverse-engineer-anything/references/native-and-artifacts.md`
  documents the workflow.
- Provider, bridge, target-format, or platform compatibility: `pkg` inventory
  is now portable. dmg remains the platform-absent container.
- Evidence, artifact, provenance, or reconstruction contract:
  `artifactFormatMetadata` gains `macos-pkg` and `macos-pkg-entry`. Coverage is
  `complete` or `unknown`. Recorded TOC checksums are values, not verified
  identities. Signature `verification` is always `not_verified`.
- Target selection, authority, upstream behavior, and cleanup details (if applicable):
  one local path; reader close joins member streams and releases the
  descriptor. Lifecycle tests cover positional reads and post-read freshness.
- Generated metadata (`docs/public/product-catalog.json`), package, or installation impact (CI generates and validates ignored catalogs and `skills/`; edit authored instructions in `.agents/skills/reverse-engineer-anything/` and never commit build outputs):
  authored skill and `.cursor-plugin` skill copy updated; catalogs not committed.

Expected effects (check known effects; use documentation-only on its own).
Unchecked items do not establish absence; leave uncertainties visible.

- [ ] Read existing files or captured data.
- [ ] Launch or attach to a process.
- [ ] Inject instrumentation or run scripts/code.
- [ ] Change process memory, registers, files, or configuration.
- [ ] Contact network services.
- [ ] Recover protected code or work around protections.
- [ ] Documentation or usability only; no target interaction.
- [ ] Not sure yet; investigation or maintainer guidance needed.

## Evidence and regression coverage

Synthetic fixtures in `MacosPkg.fixture.ts` cover a product archive, a
multi-component product archive, a component package, a signed TOC, a pbzx
Payload, truncated headers, TOC past EOF, inflate failure, heap overflow,
garbage cpio, an oversize TOC, an oversize declared gzip member, and a
declared-vs-actual extracted-size mismatch. Domain, reader, boundary, compiled
CLI, and compiled MCP tests exercise those cases. `inspect-artifact` on
upstream main still reports the platform limitation; this branch inventories
the same bytes.

A public MacPorts 2.10.5 Sequoia installer was fetched and inventoried:

`https://github.com/macports/macports-base/releases/download/v2.10.5/MacPorts-2.10.5-15-Sequoia.pkg`

SHA-256 `574662c46ae07dc06f5b1bc7fd517c9729163cc3c4a91027a011f794dc46d65c`.
Result: product archive, gzip cpio Payload and Scripts, Bom by size, CMS
signature with subject CN `Developer ID Installer: Joshua Root (QTA3A3B7F3)`,
`verification: not_verified`.

- Tests added or updated: `src/domain/macosPkgFormat.test.ts`,
  `src/artifacts/macosPkg/XarHeader.test.ts`,
  `src/artifacts/MacosPkgArtifactReader.test.ts`,
  `src/artifacts/MacosPkgArtifactReader.boundaries.test.ts`,
  `tests/acceptance/macosPkgCli.test.ts`,
  `tests/boundary/mcp/macosPkgMcp.test.ts`,
  `tests/boundary/filesystem/artifactInventoryRegularRoot.test.ts`,
  `src/artifacts/artifactFormats.test.ts`.
- Base reproduction or other evidence: `commands.log` on
  `demo/macos-flat-package` (upstream main vs this branch on `fixture.pkg`,
  plus pbzx/truncated JSON extracts and the MacPorts installer).
- User-visible CLI/MCP output (if applicable): JSON summaries in that log;
  MCP compact path covered by `tests/boundary/mcp/macosPkgMcp.test.ts`.
- Remaining proof gaps: XAR signatures are not verified; pbzx/xz payloads
  are unsupported; Bom is not decoded; installer JavaScript is never
  evaluated; no locally produced `pkgbuild` / `productbuild` package was
  decoded. Decode allowances (1 MiB metadata XML, 64 MiB per Scripts/Payload
  archive, `artifact_limits.expanded_bytes` for extraction) are resource
  policies, not format maxima. Multi-component product archives expand each
  Scripts/Payload until that budget is exhausted; skipped component archives
  are named and coverage is unknown. That skip path is fixture-covered; a
  real multi-package Apple productbuild archive was not inventoried.

Applicable boundary regressions: parser (XAR header/TOC/XML/cpio), inventory
(pkg children and refusals), projection (`macos-pkg` metadata). Lifecycle:
positional `open()` via `readFileHandleChunks`, stream-decode of gzip/zlib
members, post-read source freshness, close during member streams.

For evidence-bearing changes:

- [ ] Observed, derived, and inferred claims remain distinguishable.
- [ ] Artifact identity, source provenance, and failed attempts remain preserved.
- [ ] Unsupported, incomplete, unavailable, or uncertain outcomes remain visible.

## Validation performed

- `npm run test:focused -- src/domain/macosPkgFormat.test.ts src/artifacts/macosPkg/XarHeader.test.ts src/artifacts/MacosPkgArtifactReader.test.ts src/artifacts/MacosPkgArtifactReader.boundaries.test.ts src/artifacts/artifactFormats.test.ts tests/acceptance/macosPkgCli.test.ts tests/boundary/mcp/macosPkgMcp.test.ts tests/boundary/filesystem/artifactInventoryRegularRoot.test.ts` — 8 files, 50 passed.
- `npm run check:fast` — typecheck, lint, and architecture guards passed after rebase onto upstream `main`.
- `npm run format:check` — passed.
- `npm run metadata:check` — passed.
- `npm run test:changed -- --base upstream/main` — merge base
  `5579890dd5f916eeab6a468ae6cdc10b358c2ae1`: 6 failed / 12013 passed / 12
  skipped (657 files). NodeSeaArtifactReader.test.ts 'post-classification
  carrier mutation' cases fail on clean upstream main as well; the
  Zip/Deno/GpuPayloadCodec failures seen in one environment did not reproduce
  on rerun.
- Compiled CLI `inspect-artifact` on fixtures and on the MacPorts installer —
  exit 0; facts recorded in `commands.log` on `demo/macos-flat-package`.

## Compatibility, safety, and release

- Breaking changes or migration steps: classified `.pkg` roots that previously
  had no children now inventory members. Callers that treated the
  platform-adapter limitation as the only pkg outcome will see children and
  `macos-pkg` metadata instead.
- Real Hopper/Ghidra, browser, or OS coverage: not applicable. Reader is
  portable; Linux host used for CLI and MacPorts bytes.
- Package or release metadata impact: none committed; CI generates catalogs.
- Security, privacy, process, or containment review: local read-only parse;
  script bytes are not executed; signatures are not treated as valid. Declared
  extracted-size above the named decode allowance is refused without inflate.

## Author readiness

Human owner:

- [ ] I reviewed the final diff and relevant existing code, understand the change and its edge cases, and take responsibility for the complete PR, including AI-assisted work.
- [ ] I checked the evidence above, confirmed it supports the current change, and recorded meaningful validation gaps.
- [ ] I declare this PR ready for initial maintainer review.

## Before merge

- [ ] This PR addresses a concrete problem or an agreed enhancement.
- [ ] Material scope and authority questions are resolved, and any required maintainer scope decision covers the final diff.
- [ ] The PR has one focused outcome and the title follows `type(scope): outcome`.
- [ ] Related issue is linked, or the reason for not linking one is stated above.
- [ ] Tests cover changed observable behavior and meaningful failure paths.
- [ ] Owning docs, contracts, and generated metadata are updated where needed.
- [ ] User-visible CLI/MCP changes include representative output.
- [ ] I checked the final diff for secrets, unrelated cleanup, and unsupported claims.

## Demo

![demo](https://raw.githubusercontent.com/mvanhorn/pr-demo-assets/main/osc-bulk-1115/macos-flat-package/preview.gif)

Full recording (MP4): https://raw.githubusercontent.com/mvanhorn/pr-demo-assets/main/osc-bulk-1115/macos-flat-package/out.mp4
