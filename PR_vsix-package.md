Title: feat(artifacts): inspect VS Code extension packages offline

## Summary

Add `inspect_vsix_package` / `inspect-vsix-package`: a local, read-only inspection of a VS Code `.vsix` as typed Evidence. The reader opens the OPC ZIP, parses `extension.vsixmanifest` and `extension/package.json`, reports identity from both manifests and any disagreement, engine range, target platform, entry points, activation events (with `*` and `onStartupFinished` marked eager), a contributes summary, declared dependencies and pack members, workspace capabilities, API proposals, assets, signature-file presence, and a ZIP inventory that hashes native `.node` addons, `.wasm` modules, executables, shell scripts, and nested archives.

This is the first slice of #3687 (VS Code extension reverse engineering). It does not install the extension, execute it, verify signatures, or contact a marketplace.

## Problem and expected behavior

Operators need to inspect a `.vsix` they already hold without installing it. REA had no owner for that ZIP layout: vsixmanifest identity, package.json activation and contributes, and the member inventory lived nowhere in the catalog.

Expected outcome: given a local path, the CLI and MCP tool return Evidence whose `normalized_result` includes vsix and package identities, identity disagreements, engine ranges, entry-point presence, activation events with eager flags, contribute key counts and a capped command list, dependencies and pack members, untrusted/virtual workspace capabilities, API proposals, assets, signature-file presence, member-kind counts, and hashed interesting members. Missing or malformed manifests return the inventory with limitations. A non-ZIP file, duplicate names, path-traversal names, and oversize archives refuse with typed errors. Signature files are reported present or absent and are not verified.

## Change and scope

New dedicated inspect tool on the existing contract path: domain schema, ZIP reader, provider, application port/service, composition, CLI `registerContractCommand`, MCP evidence handler, analysis-view summary, advertised schema, docs, and authored skill wording.

Intentionally not included: marketplace download, VSIX signature verification, extension install or activation, webview or extension-host reconstruction, and the rest of #3687.

Contribution scope: this is a local shipped-artifact read. It does not execute the target, inject, mutate bytes, or recover protections. No additional maintainer execution/injection decision is required for that reason.

Follow the [contribution scope](https://github.com/morluto/rea/blob/main/CONTRIBUTING.md#contribution-scope).
Unresolved scope, authority, side effects, or required verification block
integration. Link the required maintainer scope decision for new providers or
capabilities involving target execution, injection, mutation, or protection
recovery; ordinary fixes within existing boundaries may state "not applicable".
Draft PRs may leave the scope decision pending and the readiness and merge checklists
unchecked. Maintainers can help resolve open questions.

## Contract and boundary impact

- Semantic owner and earliest changed stage: `src/vsix/VsixPackageParser.ts` owns ZIP, vsixmanifest, and package.json facts. Consumers (`VsixPackageProvider`, `VsixPackageService`, CLI, MCP, `vsixPackageView`) use those parsed fields; they do not re-parse the archive. No superseded inspect path was removed.
- Contribution scope fit and linked maintainer decision: read-only static inspection within existing artifact boundaries; no target execution, injection, mutation or protection recovery. Not applicable for a maintainer execution/injection decision.
- CLI and MCP/tool-catalog contract: new operation `inspect_vsix_package`, CLI `inspect-vsix-package`, family `artifact`, effect `evidence`. Input schema includes `path` plus `max_file_bytes`, `max_entries`, `max_manifest_bytes`, and `max_member_bytes`. Catalog JSON is generated in CI; authored skill text names the command.
- Provider, bridge, target-format, or platform compatibility: reads OPC ZIP `.vsix` with `extension.vsixmanifest` and optional `extension/package.json`. Encrypted ZIP and unsupported compression are typed refusals. Requires the in-tree ZIP reader.
- Evidence, artifact, provenance, or reconstruction contract: `createEvidence` + `completeProviderEvidence`; subject digest is the selected file; locations include artifact path; limitations list the no-install, no-network, no-signature-verify, and kind-from-name rules. Observed vs inferred stays distinguishable.
- Target selection, authority, upstream behavior, and cleanup details (if applicable): caller-selected local path only. No child process, no install, no marketplace contact. Malformed manifests keep `limitations` and the ZIP inventory. Invalid ZIP input fails without partial success aside from the file-snapshot hash.
- Generated metadata (`docs/public/product-catalog.json`), package, or installation impact (CI generates and validates ignored catalogs and `skills/`; edit authored instructions in `.agents/skills/reverse-engineer-anything/` and never commit build outputs): authored skill references and docs/index catalog wording updated; generated catalogs not committed. No new runtime dependency.

Expected effects (check known effects; use documentation-only on its own).
Unchecked items do not establish absence; leave uncertainties visible.

The workflow reads one caller-selected local `.vsix`. It does not launch a process, inject, mutate, contact the network, or recover protections.

- [ ] Read existing files or captured data.
- [ ] Launch or attach to a process.
- [ ] Inject instrumentation or run scripts/code.
- [ ] Change process memory, registers, files, or configuration.
- [ ] Contact network services.
- [ ] Recover protected code or work around protections.
- [ ] Documentation or usability only; no target interaction.
- [ ] Not sure yet; investigation or maintainer guidance needed.

## Evidence and regression coverage

Parser, domain, service, CLI, and MCP tests use in-code ZIP fixtures (no third-party `.vsix` committed), including missing/malformed vsixmanifest, malformed package.json, path traversal, duplicate names, oversize members, and non-ZIP bytes. Executed CLI on those fixtures plus one public Microsoft `references-view` 0.0.89 package downloaded to a scratch directory. Source-derived: vsixmanifest Identity/Assets/Properties and package.json activation/contributes shapes. No Hopper/Ghidra/browser provider run.

- Tests added or updated: `src/domain/vsix/vsixPackage.test.ts`, `src/vsix/VsixPackageParser.test.ts`, `src/application/vsix/VsixPackageService.test.ts`, `src/domain/analysisView/vsixPackageView.test.ts`, `tests/acceptance/vsixPackageCli.test.ts`, `tests/boundary/mcp/vsixPackageMcp.test.ts`, plus registrations in local-path admission, local tool contracts, provider capability cases, provider lifecycle coverage, and stable artifact consumers.
- Base reproduction or other evidence: before this change, `rea inspect-vsix-package` was not a command (`COMMAND_NOT_FOUND` on `upstream/main` 1ba93c8). After, the synthetic fixture reports vsix identity `demo.hello` 1.2.3, package identity `hello`, engine `^1.74.0`, eager `*` and `onStartupFinished`, signatures present, coverage complete. A non-ZIP file exits 1 with `invalid_request` / `invalid_format` and a 9-byte file snapshot. A malformed vsixmanifest keeps the inventory, sets `vsix_identity` to null, and records “The selected extension.vsixmanifest is not well-formed XML.”
- User-visible CLI/MCP output (if applicable): recorded on `demo/vsix-package` (`commands.log`, `out.mp4`, `preview.gif`). Representative human output for the gzip-equivalent synthetic fixture; public `ms-vscode.references-view` 0.0.89; non-ZIP refusal; malformed vsixmanifest limitation.
- Remaining proof gaps: VSIX signatures are not verified; no marketplace corpus beyond the one public 36 KiB `references-view` package that was actually run; nested native addons and wasm hashing are covered by in-code fixtures rather than a large third-party extension.

Boundary regressions covered: malformed input (non-ZIP, malformed XML/JSON, missing manifest, path traversal, duplicate names, oversize members/manifests), typed unsupported compression, permission/path admission via existing local-path tests, and identity preservation on parser failure (partial snapshot hash or inventory with limitations). Lifecycle regressions: in-process provider `rea-vsix-package` is listed in provider lifecycle coverage (no owned child process).

For evidence-bearing changes:

- [ ] Observed, derived, and inferred claims remain distinguishable.
- [ ] Artifact identity, source provenance, and failed attempts remain preserved.
- [ ] Unsupported, incomplete, unavailable, or uncertain outcomes remain visible.

## Validation performed

- `npx vitest run src/domain/vsix/vsixPackage.test.ts src/vsix/VsixPackageParser.test.ts src/application/vsix/VsixPackageService.test.ts src/domain/analysisView/vsixPackageView.test.ts tests/acceptance/vsixPackageCli.test.ts tests/boundary/mcp/vsixPackageMcp.test.ts` — 6 files, 39 passed (Node v24.22.3, Linux x86_64).
- `npx vitest run tests/conformance/providerCapabilityConformance.test.ts tests/boundary/mcp/absoluteLocalPathTools.test.ts tests/process-global/stableArtifactConsumers.test.ts tests/acceptance/tools/localToolContracts.test.ts` — 4 files, 360 passed.
- `npm run check:fast` — typecheck and lint passed; architecture guards passed across 2908 source files (22.1 s).
- `npm run format:check` — passed (8822 files).
- `npm run knip` — passed (no unused exports reported).
- `npm run verify:test-discovery` — 3813 files discovered exactly once.
- `npm run test:changed -- --base upstream/main` — 14886 passed, 2 failed. The two failures are `NodeSeaArtifactReader` post-classification mutation and `Uf2ArtifactReader` forged region; both fail on untouched `upstream/main` 1ba93c8 and are not this reader.
- Public CLI: `rea inspect-vsix-package` on the synthetic fixture (exit 0, coverage complete), Open VSX `ms-vscode.references-view` 0.0.89 (exit 0), `broken.vsix` malformed vsixmanifest (exit 0 with limitation), `not-an-extension.vsix` (exit 1, `invalid_format`). Baseline `rea inspect-vsix-package` on 1ba93c8 exits 1, `COMMAND_NOT_FOUND`.

## Compatibility, safety, and release

- Breaking changes or migration steps: none. New command and MCP tool only.
- Real Hopper/Ghidra, browser, or OS coverage: not applicable (local file read; no native debugger or browser provider).
- Package or release metadata impact: none. No new runtime dependency. Generated `skills/` and `docs/public/product-catalog.json` are not committed.
- Security, privacy, process, or containment review: reads a caller-selected local ZIP under existing byte/entry/manifest budgets. Does not install, execute, or contact a marketplace. Signature files are presence-only. Path-traversal member names are refused.

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

![demo](https://raw.githubusercontent.com/mvanhorn/pr-demo-assets/main/osc-bulk-1119/vsix-package/preview.gif)

Full recording (MP4): https://raw.githubusercontent.com/mvanhorn/pr-demo-assets/main/osc-bulk-1119/vsix-package/out.mp4
