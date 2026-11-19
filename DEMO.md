# Demo: inspect OCI image layouts offline

Real xterm session recorded on Xvfb `:42` (1920x1080, 30 fps, H.264 yuv420p).
`skopeo`, `buildah`, and `docker` were not installed on this host, so the
layout was assembled by `fixtures/assemble-oci-layout.py` (directory form only).

## What the recording shows

1. Title: directory-form inspect, no tar input.
2. Before: untouched `upstream/main` (`ebd709c`) `rea inspect-oci-image-layout`
   returns `COMMAND_NOT_FOUND`.
3. After: `feat/oci-image-layout` inventories `/tmp/oci-demo/busybox.oci`
   (`layout_version` 1.0.0, linux/amd64, Env values null, layer present).
4. Tamper: overwrite the layer blob with 17 different bytes.
5. Re-inspect: `digest_mismatch` finding, exit 0.

Each key moment is held about 3 s. The last frame is held about 3 s.

## Files

- `out.mp4` — 1920x1080, 30 fps, 22.53 s, 676 frames
- `preview.gif` — 1280x720, 10 fps, 537468 bytes
- `commands.log` — `script(1)` capture of the same commands
- `screenshots/` — frames from the MP4
- `logs/ffprobe.txt` — ffprobe for both media files
- `logs/validation-summary.txt` — test and lint commands that ran

## Reproduce the session

```bash
python3 fixtures/assemble-oci-layout.py
# before (upstream/main worktree)
node /tmp/rea-oci-baseline/scripts/rea.mjs inspect-oci-image-layout /tmp/oci-demo/busybox.oci --json
# after
node scripts/rea.mjs inspect-oci-image-layout /tmp/oci-demo/busybox.oci --json
```
