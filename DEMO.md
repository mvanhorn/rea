# Demo: `inspect-vsix-package`

This branch holds a live Xvfb + xterm recording of `rea inspect-vsix-package` from `feat/vsix-package` (`2419bd7483237c5c573234bc4b8edacddeb0d271`) against untouched `upstream/main` (`1ba93c8a1bbddab3c775320ac37f8977717b4bca`). The clip is silent. Commands ran on the host; ffmpeg captured display `:97` at 1920×1080 and 30 fps.

## Captured commands

`commands.log` is stdout/stderr and exit codes from these invocations (Node v24.22.3, Linux x86_64):

```
# baseline worktree /tmp/rea-vsix-baseline @ 1ba93c8
node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/demo.hello-1.2.3.vsix
# exit 1, COMMAND_NOT_FOUND

# feature worktree @ 2419bd7
node scripts/rea.mjs inspect-vsix-package --help
node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/demo.hello-1.2.3.vsix
node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/ms-vscode.references-view-0.0.89.vsix
node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/broken.vsix
node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/not-an-extension.vsix
```

The on-screen inspect of the two well-formed packages and the malformed vsixmanifest used `--filter-output` so identity, engine, activation, signatures, coverage and limitations fit one terminal. Full unfiltered output for each path is in `commands.log`.

Synthetic fixtures were written with `scripts/make-fixtures.mjs` (zip.js, same members as `src/vsix/VsixPackage.fixture.ts`). They are not third-party packages.

## Public package

| File | Source | SHA-256 | Result |
| --- | --- | --- | --- |
| `ms-vscode.references-view-0.0.89.vsix` | https://open-vsx.org/api/ms-vscode/references-view/0.0.89/file/ms-vscode.references-view-0.0.89.vsix | `7cae4c9fdcccf18b532a426806a53f7907610c904b9baecd95f9e9fbdb388607` | 36956 bytes; identity `ms-vscode` / `references-view` / `0.0.89`; engine `^1.66.0`; 7 activation events; coverage complete; signatures absent; exit 0 |

The `.vsix` was downloaded to `/tmp/vsix-demo` outside the repository and is not committed.

## Media

- `out.mp4`: live x11grab of xterm on Xvfb `:97`, 1920×1080, 30 fps, 857 frames, 28.57 s, H.264 High yuv420p.
- `preview.gif`: ffmpeg `fps=10,scale=1280:720` plus 64-color paletteuse from `out.mp4`. 286 frames, 28.60 s, 748677 bytes.
- `screenshots/`: stills at title, baseline missing command, help, synthetic inspect, public inspect, non-ZIP refusal, malformed vsixmanifest.
- `logs/ffprobe.txt`: ffprobe for both media files.

Scenes, each held about 3 s after output: upstream/main `COMMAND_NOT_FOUND`; this branch `--help`; synthetic `demo.hello-1.2.3.vsix` (eager `*` / `onStartupFinished`, signatures present); public `ms-vscode.references-view` 0.0.89; non-ZIP `invalid_format` exit 1 with a 9-byte file snapshot; malformed vsixmanifest (`vsix_identity: null`, limitation “not well-formed XML”, inventory kept, exit 0).

## Checks recorded under `logs/`

See `logs/checks.txt`, `logs/focused-vsix.txt`, `logs/wiring.txt`, and `logs/lint.txt`.
