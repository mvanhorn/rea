Title: feat(artifacts): inspect RPM package headers and dependency metadata

<!--
PR title: type(optional-scope): imperative outcome
The title becomes the squash-merge commit subject and generated changelog entry.
-->

## Summary

Add a read-only RPM inspector so a local `.rpm` yields typed Evidence for the
lead, signature header, and main header (identity, dependency sets, scriptlet
presence, and header file inventory) without installing the package.

No GitHub issue exists for this work.

## Problem and expected behavior

Selecting an RPM today does not parse `0xedabeedb` lead or header tags, so
analysts do not get NEVRA, dependency flags, scriptlet presence, or a header
file list from REA. The expected contract is one local-file operation,
`inspect-rpm-package` / `inspect_rpm_package`, that reports those facts as
deterministic Evidence, labels missing optional tags as `null`, and fails with
typed refusals on truncated or out-of-bounds headers while keeping what was
safely read. The payload is not decompressed; listing comes from header tags.

## Change and scope

A dedicated RPM artifact provider reads a stable local file, parses the 96-byte
lead, the signature header, the 8-byte pad, and the main header, then reports
payload offset, size, and declared compressor. Dependency rows render comparison
operators and mark `rpmlib(...)` and scriptlet-only requires. Scriptlet source
text is omitted unless `include_script_text` is set, and is never executed.
Signature blobs are reported as present with trivially decoded algorithm/key-id
bytes when those bytes are in the packet; signatures are not verified and
presence is not trust.

Out of scope: package installation, scriptlet execution, payload cpio
extraction, signature verification, and any process launch or mutation.

Follow the [contribution scope](https://github.com/morluto/rea/blob/main/CONTRIBUTING.md#contribution-scope).
Unresolved scope, authority, side effects, or required verification block
integration. Link the required maintainer scope decision for new providers or
capabilities involving target execution, injection, mutation, or protection
recovery; ordinary fixes within existing boundaries may state "not applicable".
Draft PRs may leave the scope decision pending and the readiness and merge checklists
unchecked. Maintainers can help resolve open questions.

This is a new local format inspector. It does not launch processes, inject
instrumentation, run scripts, mutate targets, or recover protected code. No
issue or maintainer scope decision is linked.

## Contract and boundary impact

- Semantic owner and earliest changed stage:
  `RpmPackageParser` owns RPM byte interpretation. `RpmPackageProvider` owns
  stable-artifact admission and maps parse failures. `RpmPackageService` owns
  Evidence assembly and location records. CLI (`inspect-rpm-package`) and MCP
  (`inspect_rpm_package`) consume that service. `inspect_analysis_view` projects
  a summary. Catalog, capability, tool-effect, and module-boundary tables list
  the new operation once.
- Contribution scope fit and linked maintainer decision:
  Format inspection of a caller-selected local file. No linked maintainer
  scope decision (no issue).
- CLI and MCP/tool-catalog contract:
  Additive `inspect-rpm-package` / `inspect_rpm_package`. CLI resolves relative
  paths against the working directory; MCP requires an absolute path. Budgets:
  `max_file_bytes`, `max_header_index_entries`, `max_files`, `max_script_bytes`.
  `include_script_text` defaults to false. CLI `--detail summary` requires
  `--evidence_output`.
- Provider, bridge, target-format, or platform compatibility:
  Local RPM files with a v3 lead. Signature and main header index/store bounds
  are checked. Payload compressor is reported from header tags, not by
  inspecting compressed bytes. Historic RPM variants beyond the fixture set are
  unverified.
- Evidence, artifact, provenance, or reconstruction contract:
  Complete Evidence includes artifact SHA-256, lead/signature/header/payload
  locations, and coverage. Missing optional tags are `null`. Epoch `0` is
  reported only when the tag is present. Malformed input keeps safely read
  facts in `issues[].observed` and a `file-snapshot-hash` partial observation.
  Foreign magic is `unsupported_target`.
- Target selection, authority, upstream behavior, and cleanup details (if applicable):
  One caller-selected local file; no subprocess, no install, no network. Failed
  cleanup does not apply (no owned child process).
- Generated metadata (`docs/public/product-catalog.json`), package, or installation impact (CI generates and validates ignored catalogs and `skills/`; edit authored instructions in `.agents/skills/reverse-engineer-anything/` and never commit build outputs):
  Authored skill and guide/spec pages name the operation. Cursor plugin skill
  copies are regenerated from `.agents/skills/reverse-engineer-anything/`.
  Product catalog JSON is not committed.

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

- Tests added or updated:
  Domain schema tests; parser tests (binary, source, sparse/null optional tags,
  truncated header, out-of-bounds index, oversize counts); application service
  tests; analysis-view summary tests; CLI acceptance (identity, CLI=MCP,
  relative path, foreign magic, `--include-script-text`); MCP boundary
  (advertise, absolute path, unsupported magic, truncated lead observed);
  catalog patches for artifact consumers, integer CLI arguments, and local path
  admission.
- Base reproduction or other evidence:
  No prior RPM parser on main. Fixtures encode lead + headers in
  `src/rpm/RpmPackage.fixture.ts`. Captured CLI output is in `commands.log` on
  `demo/rpm-package-metadata`.
- User-visible CLI/MCP output (if applicable):
  Binary fixture: name `demo`, version `1.0.0`, release `1`, epoch `2`,
  `requires` include `rpmlib(CompressedFileNames)` `=` and `/bin/sh`
  scriptlet-only and `libc.so.6` `>=` `2.17`; `listing_source` `header`;
  truncated file exit 1 `invalid_request` with observed magic `edabeedb`;
  foreign file exit 1 `unsupported_target`.
- Remaining proof gaps:
  Signature verification is not performed. Payload is not decompressed. No
  real-world corpus beyond the encoded fixtures used in tests and the demo
  capture. `test:changed` against `upstream/main` originally listed
  NodeSeaArtifactReader, ZipArtifactReader, and PyInstallerBoundaries. Those
  three files were re-run with Node v24.22.1 on a clean checkout of
  `upstream/main` (`f3b697da5`) and on `feat/rpm-package-metadata`
  (`2317e800f`), `npm run test:local -- <file>`, three serial iterations
  (outputs in `logs/changed-failures/`). ZipArtifactReader: 39 passed on both
  every iteration. NodeSeaArtifactReader fails on both; the shared case is
  `rejects post-classification carrier mutation before publishing Node SEA
  facts: valid replacement` (`formatMetadata()` still defined). The sibling
  `malformed blob` case is intermittent on feat (2 of 3 iterations).
  PyInstallerBoundaries flakes on both on `binds materialization to the
  inventoried digest and checks cached carrier freshness` (promise resolved
  instead of an integrity reject): main 1 of 3 failed, feat 2 of 3 failed,
  same assertion. The RPM change does not modify those files or readers.

For boundary fixes, identify the applicable [boundary regressions](https://github.com/morluto/rea/blob/main/docs/development/testing.md#boundary-regressions)
and [lifecycle regressions](https://github.com/morluto/rea/blob/main/docs/development/testing.md#lifecycle-regressions)
covered by the evidence above, and explain relevant gaps.

Parser/inventory: lead magic, header index and data-store bounds, type/count
sanity, missing optional tags as `null`, oversize index/file/script budgets.
Snapshot/projection: `file-snapshot-hash` on parse failure; summary view counts
only. Lifecycle: not applicable (no owned child process). Malformed-input,
permission, capacity, and target-identity paths are covered in provider and
catalog tests; cancellation during this inspector is the shared stable-artifact
path, not a dedicated RPM subprocess.

For evidence-bearing changes:

- [ ] Observed, derived, and inferred claims remain distinguishable.
- [ ] Artifact identity, source provenance, and failed attempts remain preserved.
- [ ] Unsupported, incomplete, unavailable, or uncertain outcomes remain visible.

## Validation performed

- `npm ci` — pass (742 packages; Node v22.23.4 during implementation; Node v24.22.1 for the changed-failure comparison)
- `npm run test:local -- src/domain/rpm/package.test.ts src/rpm/RpmPackageParser.test.ts src/application/rpm/RpmPackageService.test.ts src/domain/analysisView/rpmPackageView.test.ts` — 19 passed (4 files)
- `npm run test:focused -- tests/acceptance/rpmPackageCli.test.ts tests/boundary/mcp/rpmPackageMcp.test.ts` — 9 passed (2 files)
- `npm run test:focused --` catalog patches (`localPathAdmissionCli`, `stableArtifactParserFailureCli`, `localToolContracts`, `cliIntegerArguments`, `absoluteLocalPathTools`) — 143 passed (5 files)
- `npm run test:focused -- tests/process-global/stableArtifactConsumers.test.ts` — 221 passed (1 file)
- `npm run check:fast` — pass (typecheck + lint; turbo cache hit on the later replay)
- `npm run format:check` — pass (8058 files)
- `npm run metadata:check` — pass
- `npm run docs:check` — pass, including `readmeConsistency` 10 passed
- `node scripts/generate-cursor-plugin-skill.mjs` — pass (authored skill copies)
- `npm run test:changed -- --base upstream/main` — 3 failed / 11401 passed / 17 skipped in 636 files (Node v22.23.4; full stdout not retained). Follow-up: `npm run test:local --` the three named files on `f3b697da5` and `2317e800f` with Node v24.22.1 — Zip 39 passed both; NodeSea and PyInstaller fail/flake on both checkouts the same way (`logs/changed-failures/`).
- `node scripts/rea.mjs inspect-rpm-package` on the four temp fixtures — captured in `commands.log` (help, human, JSON, script text, source RPM, truncated, unsupported)

## Compatibility, safety, and release

- Breaking changes or migration steps:
  None. Additive CLI command and MCP tool.
- Real Hopper/Ghidra, browser, or OS coverage:
  Not applicable. This operation does not use Hopper, Ghidra, a browser, or a
  live OS target.
- Package or release metadata impact:
  New command and tool names enter generated catalogs in CI. No installer or
  extra runtime dependency.
- Security, privacy, process, or containment review:
  Reads one caller-selected file. Does not execute scriptlets, decompress
  payload, verify cryptographic signatures, or contact the network. Signature
  blob presence is not a trust claim.

## Author readiness

<!-- The human owner completes these declarations before requesting review,
unless the PR author is exempt as listed in CONTRIBUTING.md.
The PR author is the owner by default. A different owner must explicitly accept
ownership on this PR.
AI agents must leave these declarations to a human to dictate to them or there could be catastrophic consequences for many users of REA.
Draft PRs may leave them unchecked. These declarations record initial readiness
when opening the PR for review; later pushes do not require a new human sign-off.
Keep the description and validation evidence current as the work changes.
See CONTRIBUTING.md#pull-request-ownership-and-readiness. -->

Human owner:

- [ ] I reviewed the final diff and relevant existing code, understand the change and its edge cases, and take responsibility for the complete PR, including AI-assisted work.
- [ ] I checked the evidence above, confirmed it supports the current change, and recorded meaningful validation gaps.
- [ ] I declare this PR ready for initial maintainer review.

## Before merge

<!-- Draft PRs may leave pending items unchecked. Resolve material scope and
authority questions before integration. -->

- [ ] This PR addresses a concrete problem or an agreed enhancement.
- [ ] Material scope and authority questions are resolved, and any required maintainer scope decision covers the final diff.
- [ ] The PR has one focused outcome and the title follows `type(scope): outcome`.
- [ ] Related issue is linked, or the reason for not linking one is stated above.
- [ ] Tests cover changed observable behavior and meaningful failure paths.
- [ ] Owning docs, contracts, and generated metadata are updated where needed.
- [ ] User-visible CLI/MCP changes include representative output.
- [ ] I checked the final diff for secrets, unrelated cleanup, and unsupported claims.

## Demo

![demo](https://raw.githubusercontent.com/mvanhorn/pr-demo-assets/main/osc-bulk-1114/rpm-package-metadata/preview.gif)

<video src="https://raw.githubusercontent.com/mvanhorn/pr-demo-assets/main/osc-bulk-1114/rpm-package-metadata/out.mp4" controls width="720"></video>
