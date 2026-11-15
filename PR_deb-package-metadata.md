Title: feat(artifacts): inspect Debian package control metadata and contents

## Summary

Add `inspect-deb-package` / `inspect_deb_package`: a local, read-only inspection of a Debian `.deb` as typed Evidence. The reader parses the SysV ar container (`debian-binary`, `control.tar.*`, `data.tar.*`), reports control metadata and relationships, inventories data members, and cross-checks `md5sums` paths. It does not install the package or run maintainer scripts.

This change adds the runtime dependency `@napi-rs/lzma@1.5.3` so `control.tar.xz` and `data.tar.xz` can be decoded in-process. Current Debian/Ubuntu packages ship those members as xz; gzip and zstd already had in-tree decoders, and xz needs a native decoder to inspect those archives under the same size budgets.

No tracking issue exists for this change.

## Problem and expected behavior

Operators need to inspect a `.deb` they already hold without installing it. The existing desktop Debian helper shells out to `dpkg-deb` for capture work and is a different authority; it is not a typed inspect tool.

Expected outcome: given a local path, the CLI and MCP tool return Evidence whose `normalized_result` includes ar members, parsed control fields, relationship alternatives (operators and arch qualifiers), conffiles/md5sums presence, maintainer-script interpreter and byte length, a bounded data inventory, and an md5sums path cross-check. Gzip, zstd, xz, and uncompressed tars succeed. Bad ar magic, truncated members, tar checksum failures, truncated/corrupt/oversized xz, and oversize counts refuse with typed errors and partial observations rather than silent zeros. If the xz native binding cannot load, the refusal is typed `unsupported_target` rather than a process crash. Missing optional control fields are `null`, not empty strings.

## Change and scope

New dedicated inspect tool on the existing contract path: domain schema and Debian version/relationship parsers, ar/tar reader, xz decoder via `@napi-rs/lzma`, provider, application port/service, composition, CLI `registerContractCommand`, MCP evidence handler, analysis-view summary, docs, and catalog wording in authored skill references.

The `@napi-rs/lzma` pin is exact (`1.5.3`). License inventory, runtime notices, and the documented MIT-notice gap for that package and its same-release prebuilt family are updated with `npm run licenses:generate` / `licenses:check`.

Intentionally not included: bzip2 and lzma (legacy `.lzma`) decompression, debsig/dpkg-sig verification, hashing file contents for md5sums, returning maintainer-script text, installing packages, or executing scripts.

Contribution scope: this is a local shipped-artifact read. It does not execute the target, inject, mutate bytes, or recover protections. No additional maintainer execution/injection decision is required for that reason.

Follow the [contribution scope](https://github.com/morluto/rea/blob/main/CONTRIBUTING.md#contribution-scope).
Unresolved scope, authority, side effects, or required verification block
integration. Link the required maintainer scope decision for new providers or
capabilities involving target execution, injection, mutation, or protection
recovery; ordinary fixes within existing boundaries may state "not applicable".
Draft PRs may leave the scope decision pending and the readiness and merge checklists
unchecked. Maintainers can help resolve open questions.

## Contract and boundary impact

- Semantic owner and earliest changed stage: `src/deb/DebPackageParser.ts` owns ar/tar/control/data facts. `src/deb/xzDecoder.ts` owns xz inflate, uncompressed-size pre-check, and native-binding load. Consumers (`DebPackageProvider`, `DebPackageService`, CLI, MCP, `debPackageView`) use those parsed fields; they do not re-parse raw ar/tar bytes or reinterpret xz errors. No superseded inspect path was removed. Desktop `dpkg-deb` capture remains a separate authority.
- Contribution scope fit and linked maintainer decision: not applicable (local file read; no target execution, injection, mutation, or protection recovery).
- CLI and MCP/tool-catalog contract: new operation `inspect_deb_package`, CLI `inspect-deb-package`, family `artifact`, effect `evidence`. Input schema includes `path` plus the documented byte/member/entry limits. Catalog JSON is generated in CI; authored skill text names the command.
- Provider, bridge, target-format, or platform compatibility: reads SysV ar `.deb` with `control.tar` / `.gz` / `.zst` / `.xz` and the same for `data.tar`. bzip2 and lzma are typed unsupported targets. Requires Node zlib gzip and zstd (already in-tree) plus `@napi-rs/lzma` for xz. A missing native addon is `unsupported_target`.
- Evidence, artifact, provenance, or reconstruction contract: `createEvidence` + `completeProviderEvidence`; subject digest is the selected file; locations include artifact path and byte range; limitations list the no-install, no-signature, no-script-text, and no-content-hash rules.
- Target selection, authority, upstream behavior, and cleanup details (if applicable): caller-selected local path only. No child process, no install, no cleanup of foreign files. Truncated/malformed inputs keep `partial` / `partial_observation`.
- Generated metadata (`docs/public/product-catalog.json`), package, or installation impact (CI generates and validates ignored catalogs and `skills/`; edit authored instructions in `.agents/skills/reverse-engineer-anything/` and never commit build outputs): authored skill references and docs/index catalog wording updated; generated catalogs not committed. New runtime dependency `@napi-rs/lzma@1.5.3` (MIT) plus its optional platform packages; third-party notices and the runtime fingerprint are updated.

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

Parser, domain, service, filesystem, CLI, and MCP tests use in-code ar+tar fixtures, including xz control members (valid, truncated, oversized) and an unavailable native binding. Executed CLI on those fixtures plus two public `hello` packages (gzip success; xz success). Source-derived: Debian ar/tar/control field shapes. No Hopper/Ghidra/browser provider run.

- Tests added or updated: `src/domain/deb/debPackage.test.ts`, `src/deb/DebPackageParser.test.ts`, `src/deb/xzDecoder.test.ts`, `src/application/deb/DebPackageService.test.ts`, `tests/acceptance/debPackageCli.test.ts`, `tests/boundary/mcp/debPackageMcp.test.ts`, `tests/boundary/filesystem/debPackage.test.ts`, plus registrations in local-path admission, stable parser-failure CLI, local tool contracts, CLI integer arguments, and absolute local path MCP tests.
- Base reproduction or other evidence: before this change, `rea inspect-deb-package` was not a command. After, fixture inspect returns package `hello`, epoch/upstream/revision, Depends alternatives with operators and arch restrictions, six maintainer scripts at 17 bytes `/bin/sh`, and a seven-entry data inventory. Truncated members and non-ar files exit 1 with `invalid_request` / `invalid_format` and a partial file snapshot. Public `hello_2.10-3_amd64.deb` (`control.tar.xz` / `data.tar.xz`) inspects with exit 0 and coverage complete.
- User-visible CLI/MCP output (if applicable): recorded in the demo branch `demo/deb-package-metadata` (`commands.log`, `out.mp4`, `preview.gif`). Representative human and `--json` output for the gzip fixture; public gzip `hello_2.4-3_amd64.deb`; truncated and non-ar refusals; successful xz inspect of `hello_2.10-3_amd64.deb`.
- Remaining proof gaps: package signatures (debsig/dpkg-sig) are not verified; bzip2/lzma members remain unsupported; native xz addon load is covered by a test double rather than every optional platform package; no real-world corpus beyond the fixtures and the two public `hello` packages that were actually run.

Boundary regressions covered: malformed input (bad magic, truncated member, tar checksum, oversize limits), typed unsupported compression, truncated/corrupt/oversized xz, unavailable xz binding, permission/path admission via existing local-path tests, and identity preservation on parser failure (partial snapshot hash). Lifecycle regressions: not applicable (no owned child process or session cleanup).

For evidence-bearing changes:

- [ ] Observed, derived, and inferred claims remain distinguishable.
- [ ] Artifact identity, source provenance, and failed attempts remain preserved.
- [ ] Unsupported, incomplete, unavailable, or uncertain outcomes remain visible.

## Validation performed

- `npx vitest run src/deb/xzDecoder.test.ts src/deb/DebPackageParser.test.ts src/domain/deb/debPackage.test.ts src/application/deb/DebPackageService.test.ts tests/acceptance/debPackageCli.test.ts tests/boundary/mcp/debPackageMcp.test.ts tests/boundary/filesystem/debPackage.test.ts` — 7 files, 40 passed.
- `npm run test:focused --` those files plus `tests/acceptance/localPathAdmissionCli.test.ts`, `tests/acceptance/stableArtifactParserFailureCli.test.ts`, `tests/acceptance/tools/localToolContracts.test.ts`, `tests/boundary/cli/cliIntegerArguments.test.ts`, `tests/boundary/mcp/absoluteLocalPathTools.test.ts` — 12 files, 182 passed.
- `npm run check:fast` — typecheck and lint passed.
- `npm run format:check` — passed (8059 files).
- `npm run metadata:check` — passed.
- `npm run docs:check` — passed, including `licenses:check` fingerprint `0683afc489101481e2474d7f118bc734409cbcc22b8f62f4158190e82a8184c1`.
- `npm run test:changed -- --base upstream/main` — 29917 passed, 3 failed, 21 skipped. Failures are `src/artifacts/NodeSeaArtifactReader.test.ts` (post-classification carrier mutation) and `src/artifacts/pyinstaller/PyInstallerBoundaries.test.ts` (cached carrier freshness). They fail in isolation on this tree and are not the Debian reader.
- `npm run check:pr` — `test:run` 8 failed, 49798 passed, 295 skipped. Failures: `nativeVerifierPreflightOwnership`, `advertisedDialect`, `packageCatalogVerification`, `NodeSeaArtifactReader` malformed-blob mutation, `Uf2ArtifactReader` forged region, `DenoStandaloneArtifactReader` carrier mutation, `inesArtifact` header overwrite, `mutationWorkflow` empty stderr (`PS1` unbound). None are the Debian reader.
- Real CLI: `node scripts/rea.mjs inspect-deb-package` on gzip/zstd/xz fixtures (exit 0), truncated and non-ar inputs (exit 1), public `hello_2.4-3_amd64.deb` gzip (exit 0), public `hello_2.10-3_amd64.deb` xz (exit 0). SHA-256 values are in `commands.log` on `demo/deb-package-metadata`.

## Compatibility, safety, and release

- Breaking changes or migration steps: none. New command and MCP tool only. Adds runtime dependency `@napi-rs/lzma@1.5.3`.
- Real Hopper/Ghidra, browser, or OS coverage: not applicable; this tool does not use those providers. Public Debian `hello` packages were read as local files.
- Package or release metadata impact: new docs page `docs/deb-package.md`, catalog wording, authored skill references, lockfile, and third-party notices for `@napi-rs/lzma`. CI remains the owner of generated catalogs and `skills/` build output.
- Security, privacy, process, or containment review: reads caller-selected local bytes only. Maintainer-script bodies are not returned. Network is not contacted by the inspector. Default limits cap file, member, entry, and decompressed tar sizes. xz uncompressed size is checked against `max_control_bytes` / `max_data_bytes` before inflate.

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

![demo](https://raw.githubusercontent.com/mvanhorn/pr-demo-assets/main/osc-bulk-1114/deb-package-metadata/preview.gif)

<video src="https://raw.githubusercontent.com/mvanhorn/pr-demo-assets/main/osc-bulk-1114/deb-package-metadata/out.mp4" controls width="720"></video>
