Title: feat(artifacts): inventory OCI image layouts offline

## Summary

Analysts receive OCI image-layout directories (`oci-layout`, `index.json`,
`blobs/<alg>/<hex>`) as evidence and previously had to walk the JSON by hand.
This adds `inspect_oci_image_layout` / `inspect-oci-image-layout` for the
**directory form only**. It reports layout version, index entries (media type,
digest, size, platform, annotations such as `org.opencontainers.image.ref.name`),
nested indexes within a bounded depth, image config facts, layers, and streamed
SHA-256 (and SHA-512 when declared) verification of present referenced blobs.
Env values stay omitted unless `include_env_values` is selected. Missing blobs,
digest and size mismatches, unreferenced blobs, unknown media types, unsupported
digest algorithms, symlink blobs, nested-index depth, malformed nested JSON, and
blob oversize are findings, not crashes. Layer contents are not decompressed
(follow-up). Tar image layouts are out of scope.

## Problem and expected behavior

An operator-selected local directory that is an OCI image layout should be
inventoried offline without executing the image, contacting a registry, following
child symbolic links, or leaving the selected root. Oversize or malformed
`oci-layout` / `index.json` should refuse with partial facts when the layout
file was readable. Present referenced blobs should be hashed under a byte
budget. Defects in the layout should remain visible as findings.

## Change and scope

A dedicated read-only artifact tool following the existing NuGet-style inspect
path: domain schema, directory-admitted parser, provider/port, application
service, CLI contract command, MCP binding, advertised schema, analysis view,
acceptance/MCP/conformance/lifecycle coverage, and the authored skill text.
Admission uses `DirectoryArtifactReader` and the stable-root helpers so child
symlinks and paths that leave the root are refused. JSON documents, hashed
blobs, directory entries, and nested index depth are bounded with named
allowances. Directory form only; tar input and layer decompression are not
included.

Follow the [contribution scope](https://github.com/morluto/rea/blob/main/CONTRIBUTING.md#contribution-scope).
Unresolved scope, authority, side effects, or required verification block
integration. Link the required maintainer scope decision for new providers or
capabilities involving target execution, injection, mutation, or protection
recovery; ordinary fixes within existing boundaries may state "not applicable".
Draft PRs may leave the scope decision pending and the readiness and merge checklists
unchecked. Maintainers can help resolve open questions.

## Contract and boundary impact

- Semantic owner and earliest changed stage:
  `src/oci/OciImageLayoutParser.ts` produces the inventory. Consumers are the
  OCI image-layout provider, application service, CLI command, MCP tool, and
  analysis-view projection. No superseded path is removed.
- Contribution scope fit and linked maintainer decision:
  Read-only static inspection within existing artifact boundaries; no target
  execution, injection, mutation or protection recovery. Not applicable.
- CLI and MCP/tool-catalog contract:
  New CLI `inspect-oci-image-layout <dir>` and MCP `inspect_oci_image_layout`.
  Advertised schema is under `scripts/verify/advertised-schemas/tools/inspect_oci_image_layout.json`.
- Provider, bridge, target-format, or platform compatibility:
  In-process built-in reader. Directory form of the OCI image layout
  (`imageLayoutVersion` 1.0.0). No bridge, no registry, no daemon.
- Evidence, artifact, provenance, or reconstruction contract:
  Evidence format `directory` with `snapshot_sha256` over layout version and
  the SHA-256 of `oci-layout` and `index.json`. Summary delivery requires
  `--evidence_output`.
- Target selection, authority, upstream behavior, and cleanup details (if applicable):
  Caller-selected local directory. Child symlinks are not followed. No owned
  process and no host extraction outside the existing reader.
- Generated metadata (`docs/public/product-catalog.json`), package, or installation impact (CI generates and validates ignored catalogs and `skills/`; edit authored instructions in `.agents/skills/reverse-engineer-anything/` and never commit build outputs):
  Authored skill text updated. Generated `skills/` and `docs/public/product-catalog.json` are not in this commit.

Expected effects (check known effects; use documentation-only on its own).
Unchecked items do not establish absence; leave uncertainties visible.

The workflow reads an operator-selected local directory through the existing
directory admission helpers and records Evidence through the existing delivery
path. It does not launch a process, inject instrumentation, mutate the target,
contact the network, or recover protected code.

- [ ] Read existing files or captured data.
- [ ] Launch or attach to a process.
- [ ] Inject instrumentation or run scripts/code.
- [ ] Change process memory, registers, files, or configuration.
- [ ] Contact network services.
- [ ] Recover protected code or work around protections.
- [ ] Documentation or usability only; no target interaction.
- [ ] Not sure yet; investigation or maintainer guidance needed.

## Evidence and regression coverage

Source-derived plus executed tests on Linux x64, Node v24.22.3.

- Tests added or updated:
  Synthetic layouts in `src/oci/OciImageLayoutParser.test.ts` (valid
  single-platform, `include_env_values`, multi-platform index, missing blob,
  digest mismatch, size mismatch, symlink blob, oversize index JSON, nested
  index depth, malformed index JSON, unreferenced blob / unknown media type /
  unsupported digest). Service path/cancellation tests, analysis-view test,
  CLI acceptance, MCP boundary, absolute-path contract, conformance case, and
  in-process lifecycle coverage.
- Base reproduction or other evidence:
  On untouched `upstream/main` (`ebd709cef51ee0791ef9cf935da974fd51374e5d`)
  `rea inspect-oci-image-layout` returns `COMMAND_NOT_FOUND`. After this change
  the same directory inventories `layout_version` 1.0.0; tampering one layer
  blob records `digest_mismatch`.
- User-visible CLI/MCP output (if applicable):
  See the demo recording. Compact CLI JSON reports layout version, index
  entries, redacted Env, present layers, and findings.
- Remaining proof gaps:
  Tar image-layout input and layer-content listing are out of scope. Hosts
  without `skopeo`/`buildah`/`docker` used a scripted tiny layout. Windows
  unverified. Full `npm run check:pr` (typed lint, jscpd, knip:production,
  python tests, docs:check) was not run.

For boundary fixes, identify the applicable [boundary regressions](https://github.com/morluto/rea/blob/main/docs/development/testing.md#boundary-regressions)
and [lifecycle regressions](https://github.com/morluto/rea/blob/main/docs/development/testing.md#lifecycle-regressions)
covered by the evidence above, and explain relevant gaps.

MCP advertise + absolute-path refusal, CLI/MCP observation match, and
late-cancellation Evidence retention are covered. Launch/handshake/cleanup/retry
are not applicable for this in-process reader.

For evidence-bearing changes:

- [ ] Observed, derived, and inferred claims remain distinguishable.
- [ ] Artifact identity, source provenance, and failed attempts remain preserved.
- [ ] Unsupported, incomplete, unavailable, or uncertain outcomes remain visible.

## Validation performed

Linux 6.12.113+ x86_64, Node v24.22.3, npm 11.19.1. Feature
`270cb2196be2d9514772244eb106c900874d9db8` branched from
`ebd709cef51ee0791ef9cf935da974fd51374e5d`.

- `npm ci` — pass (Node 24.22.3; host Node 22.23.2 is below engines)
- `npm run check:fast` — pass (typecheck+lint; architecture guards 2908 files; 21.6 s)
- `npm run verify:test-discovery` — pass (3817 files discovered exactly once)
- `npm run format:check` — pass (8827 files)
- `npx vitest run src/oci/OciImageLayoutParser.test.ts src/application/oci/OciImageLayoutService.test.ts src/domain/analysisView/ociImageLayoutView.test.ts` — 3 files, 19 passed
- `npx vitest run --project acceptance tests/acceptance/ociImageLayoutCli.test.ts tests/acceptance/tools/localToolContracts.test.ts` — 2 files, 15 passed
- `npx vitest run --project mcp-boundary tests/boundary/mcp/ociImageLayoutMcp.test.ts tests/boundary/mcp/absoluteLocalPathTools.test.ts` — 2 files, 4 passed
- `npx vitest run --project cli-boundary` (contract parity, schema parity, tool coverage, help, manifests, JSON input, required inputs) — 7 files, 1120 passed
- `npx vitest run --project conformance tests/conformance/providerCapabilityConformance.test.ts` — 1 file, 80 passed
- `npm run test:changed` — 4 failed / 15744 passed / 25 skipped across 862 files. The four failures were `Uf2ArtifactReader`, `WebBundleAnalysisWorker`, and `PyInstallerBoundaries` (unrelated). Re-run of those three files: 86 passed
- `npm run knip` — pass aside from two pre-existing unresolved worker imports (`#web-bundle-analysis-worker`, `#javascript-analysis-worker`)
- `npm run verify:advertised-schemas -- --update-summary` — pass (`inspect_oci_image_layout` added)
- `node scripts/verify-grok-client.mjs` — pass (`catalogChecked` true, `catalogSize` 261, `schemasChecked` 261)

Untouched upstream/main baseline (`/tmp/rea-oci-baseline` at `ebd709c`):

- `npm run check:fast` — pass (architecture guards 2898 files; 20.9 s)
- `npm run verify:test-discovery` — pass (3812 files)
- `npm run format:check` — pass (8806 files)
- `npx vitest run src/nuget/NugetNupkgParser.test.ts src/application/nuget/NugetNupkgService.test.ts` — 2 files, 42 passed
- `rea inspect-oci-image-layout` — `COMMAND_NOT_FOUND`, exit 1

## Compatibility, safety, and release

- Breaking changes or migration steps:
  None. New CLI command and MCP tool only.
- Real Hopper/Ghidra, browser, or OS coverage:
  Not applicable. Built-in directory reader. Demo layout assembled by script
  because `skopeo`/`buildah`/`docker` were not installed.
- Package or release metadata impact:
  Authored skill text under `.agents/skills/reverse-engineer-anything/` and
  `.cursor-plugin/skills/`. Generated `skills/` and `docs/public/product-catalog.json`
  are not committed.
- Security, privacy, process, or containment review:
  Read-only. Child symlinks are not followed. Env values default to null.
  Blob hashing is streamed under `max_blob_bytes`. JSON reads under
  `max_json_bytes`. Directory enumeration under `max_entries`. Nested indexes
  under `max_index_depth`.

## Author readiness

Human owner: @mvanhorn

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

![demo](https://raw.githubusercontent.com/mvanhorn/pr-demo-assets/main/osc-bulk-1119/oci-image-layout/preview.gif)

Full recording (MP4): https://raw.githubusercontent.com/mvanhorn/pr-demo-assets/main/osc-bulk-1119/oci-image-layout/out.mp4
