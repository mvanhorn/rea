# Demo: inventory macOS flat installer packages

`out.mp4` and `preview.gif` replay the exact lines in `commands.log`. The banner
reads **Animated replay of real captured command output**. Each scene is held
on screen; full graph dumps are omitted.

## What was run

1. SHA-256 of the synthetic fixtures and of the public MacPorts installer.
2. Upstream main (`5579890dd5f916eeab6a468ae6cdc10b358c2ae1`)
   `inspect-artifact --json` on `fixture.pkg`: format `pkg`, `node_count` 1,
   limitation `PKG root hash is observed; child inventory requires a native macOS adapter.`
3. This branch on the same file: `node_count` 9, `archive_kind` `product`,
   Distribution title `REA Fixture`, gzip cpio Scripts with preinstall and
   postinstall (3 members), gzip cpio Payload (6 members), signature
   `not_verified`.
4. pbzx Payload: `unsupported-compression` refusal, stored Payload kept.
5. Truncated header: `truncated-header` refusal, coverage `unknown`.
6. Public MacPorts 2.10.5 Sequoia installer (URL and digest in `commands.log`):
   product archive, gzip cpio Payload and Scripts, Bom by size, CMS signature
   with Developer ID Installer subject CN, `verification: not_verified`.

Media: `out.mp4` 1920x1080 30 fps 24 s 720 frames H.264 yuv420p;
`preview.gif` 960x540 10 fps 24 s 240 frames, under 5 MiB.
