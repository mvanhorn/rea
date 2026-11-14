# Demo: inspect RPM package headers

This branch holds a replay of real `rea inspect-rpm-package` output. The
feature branch is `feat/rpm-package-metadata`.

The inspector reads one local RPM file's lead, signature header, and main
header. It does not install the package, run scriptlets, verify signatures, or
decompress the payload. File listing comes from header tags.

## Capture

Working directory: `/workspace`. CLI: `node scripts/rea.mjs`.

Fixtures written from `src/rpm/RpmPackage.fixture.ts`:

- `/tmp/rpm-demo/demo-1.0.0-1.noarch.rpm` (1899 bytes, SHA-256 `360ebf7d0b7eedb98392bdc784cb19b403ddf12f4162bea1eb6473440c044778`)
- `/tmp/rpm-demo/demo-1.0.0-1.src.rpm` (717 bytes)
- `/tmp/rpm-demo/truncated.rpm` (128 bytes, valid lead, truncated signature header)
- `/tmp/rpm-demo/not-a-package.rpm` (10 bytes, foreign magic)

Commands in `commands.log` (JSON stdout pretty-printed with `python3 -m json.tool`; values unmodified):

1. `inspect-rpm-package --help`
2. Human Evidence for the binary fixture (NEVRA, epoch 2, requires with `>=` / `=` / scriptlet-only `/bin/sh`, `listing_source: header`)
3. `--json` for the same binary (signature blob present, SHA256 header digest, payload offset/size)
4. `--include-script-text --json` (bounded `echo prein` / `echo postin` / trigger text; never executed)
5. `--json` for the source RPM (`type: source`, missing optional tags `null`)
6. Truncated header → `invalid_request` / `invalid_format`, observed lead magic `edabeedb`, `file-snapshot-hash`
7. Foreign magic → `unsupported_target` (magic `6e6f7420`)

No distro `.rpm` was present on disk. None was downloaded.

## Media

`out.mp4` and `preview.gif` are an animated replay of those exact `commands.log`
lines, with the on-screen label `Animated replay of real captured command output`.
The replay scrolls through help, identity, dependencies, scriptlet text, the
source package, the truncated refusal, and the unsupported-target refusal.

- `out.mp4`: 1920×1080, 30 fps, 720 frames, 24.000 s, H.264 yuv420p
- `preview.gif`: 720×405, 12 fps (288 frames), 24.000 s, 9 364 022 bytes
- `screenshots/`: stills of the same replay at the key evidence lines
- `logs/ffprobe.txt`: ffprobe for both media files
- `logs/changed-failures/`: Node v24.22.1 re-run of NodeSeaArtifactReader,
  ZipArtifactReader, and PyInstallerBoundaries on `upstream/main` (`f3b697da5`)
  and `feat/rpm-package-metadata`. Zip passes on both. NodeSea and PyInstaller
  fail or flake on both checkouts the same way.
