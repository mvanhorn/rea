# Android OTA payload inspector demo

Captured against a local `rea` CLI built from this change and, for the
before case, a worktree of upstream `main` at `25b1c42ce`.

## What was run

`commands.log` records the exact commands, exit codes, stdout and stderr.

- **Before:** upstream `main` `inspect-artifact` on a synthesized CrAU v2
  fixture reports `unsupported binary format`.
- **After:** the same file is `android-ota-payload`. Human and `--json`
  output show the v2 header, full/delta kind, partition table with sizes,
  hashes and operation counts, dynamic groups, apex_info, and
  `signatures_verified: false`.
- **Extract:** REPLACE/ZERO reconstruction writes `boot.img` whose prefix
  is `BOOTIMG`. A delta payload inventories `vendor.img` and extract fails
  with `Inventoried source bytes are unavailable for vendor.img`.
- **Refusals:** a v1 header is an unsupported-version failure. Bad magic
  stays an unsupported binary format.
- **Truncation:** cutting the fixture after the blob offset keeps the
  partition table and sets `blob_truncated: true`.

## Public OTA prefix

GrapheneOS `bluejay-ota_update-2026111300.zip`:

- URL: `https://releases.grapheneos.org/bluejay-ota_update-2026111300.zip`
- `payload.bin` is stored (ZIP method 0) at local-file data offset 4282
- HTTP range `bytes=4282-132551` (128270 bytes): 24-byte header + 127722-byte
  manifest + 523-byte metadata signature + 1 blob byte
- Saved file SHA-256:
  `549511763adf903ed426d46621c2ac1ee88dda502567d26b9db3521ca2db190f`
- Inspect reports `payload_kind: full`, `security_patch_level: 2026-11-01`,
  `signatures_verified: false`, `blob_truncated: true`, and the partition
  inventory from the complete manifest.

## Media

`out.mp4` is a 24 s, 1920×1080, 30 fps H.264 replay of those captured
lines. `preview.gif` is derived from it (720×405, 12 fps, 24 s). The
on-screen label is `Animated replay of real captured command output`.
See `logs/ffprobe.txt`.
