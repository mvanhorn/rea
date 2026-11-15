# Demo: `inspect-deb-package`

This branch holds a recorded replay of real CLI output from `feat/deb-package-metadata` (`c36b62e85baf6b0b598384d0d95184a8f487b9be`). The clip is silent: it is a command-output replay, not a narrated film.

## Label

The video banner is exactly: `Animated replay of real captured command output`.

## Captured commands

`commands.log` is stdout/stderr and exit codes from these invocations (cwd `/workspace`, Node v24.22.1):

```
node scripts/rea.mjs inspect-deb-package --help
node scripts/rea.mjs inspect-deb-package /tmp/deb-demo/hello-fixture.deb
node scripts/rea.mjs inspect-deb-package --json /tmp/deb-demo/hello-fixture.deb
node scripts/rea.mjs inspect-deb-package /tmp/deb-demo/hello-zstd.deb
node scripts/rea.mjs inspect-deb-package /tmp/deb-demo/hello-2.4-3.deb
node scripts/rea.mjs inspect-deb-package /tmp/deb-demo/truncated.deb
node scripts/rea.mjs inspect-deb-package /tmp/deb-demo/not-a-package.bin
node scripts/rea.mjs inspect-deb-package /tmp/deb-demo/hello.deb
```

Fixture `.deb` files were written with `src/deb/DebPackage.fixture.ts` (gzip, zstd, xz, truncated ar member, non-ar bytes). The replay text is the captured log, not a restyled summary.

## Public packages

| File | Source | SHA-256 | Result |
| --- | --- | --- | --- |
| `hello-2.4-3.deb` (`hello_2.4-3_amd64.deb`) | https://snapshot.debian.org/archive/debian/20100110T000000Z/pool/main/h/hello/hello_2.4-3_amd64.deb | `1f3b78a1959a45ec61984ae4dc96f31ac7880a87187f0ac1e6c56a54b37d3f50` | gzip control/data; inspect completed, exit 0 |
| `hello.deb` (`hello_2.10-3_amd64.deb`) | http://ftp.debian.org/debian/pool/main/h/hello/hello_2.10-3_amd64.deb | `2e6e2f1a0007dc43bc91c273fd36e91e40a4f1c2765a03eca68b70a42103878a` | xz control/data; inspect completed, coverage complete, exit 0 |

No `.deb` files were already on disk in this environment. Both public files were fetched for this capture.

## Media

- `out.mp4`: HyperFrames 0.9.47 HTML composition of `commands.log`, 1920×1080, 30 fps, 720 frames, 24.0 s, H.264 yuv420p.
- `preview.gif`: ffmpeg `fps=12,scale=720:405` plus 64-color paletteuse from `out.mp4`. 288 frames, 24.0 s, 7.5 MB. The last ~2 s of the 24 s timeline holds the successful xz inspect (`hello_2.10-3_amd64.deb`, coverage complete, exit 0).
- `screenshots/`: stills from `out.mp4` at help, fixture control, `--json`, public gzip inventory, truncated refusal, xz members, and xz success.
- `logs/ffprobe-mp4.json`, `logs/ffprobe-gif.json`: ffprobe JSON for both media files.

## Checks recorded under `logs/`

- `logs/checks.txt`: Node v24.22.1; vitest decoder/parser/service/CLI/MCP/filesystem (7 files, 40 passed); `npm run test:focused` (12 files, 182 passed); `check:fast`; `format:check` (8059 files); `metadata:check`; `docs:check` including `licenses:check` fingerprint `0683afc489101481e2474d7f118bc734409cbcc22b8f62f4158190e82a8184c1` (202 runtime packages); public xz inspect of `hello_2.10-3_amd64.deb` (exit 0).
- `logs/test-changed.txt`: `npm run test:changed -- --base upstream/main` (29917 passed, 3 failed, 21 skipped). The three failures are `NodeSeaArtifactReader` post-classification mutation and `PyInstallerBoundaries` cached carrier freshness; they fail in isolation on this tree and are not the Debian reader.
- `logs/check-pr.txt`: `npm run check:pr` ran `test:run` (8 failed, 49798 passed, 295 skipped). Failures are unrelated integrity/mtime and environment tests, not the Debian reader.
