#!/bin/bash
# Real terminal demo for inspect-oci-image-layout. Holds each key moment ~3s.
set +e
export PATH="/home/box/.local/node-v24/bin:$PATH"
export NODE_NO_WARNINGS=1
export NO_COLOR=1
unset FORCE_COLOR
export TERM=xterm-256color
FEATURE=/workspace/osc-bulk-1119/rea/wt-oci-image-layout
BASE=/tmp/rea-oci-baseline
LAYOUT=/tmp/oci-demo/busybox.oci
JQ_FILTER='.normalized_result | {
  layout_version: .artifact.layout_version,
  format: .artifact.format,
  ref_name: .indexes[0].entries[0].annotations,
  platform: .images[0] | {os, architecture, user},
  env: .images[0].env,
  entrypoint: .images[0].entrypoint,
  cmd: .images[0].cmd,
  layers: .images[0].layers,
  findings
}'

python3 /tmp/oci-demo-assets/fixtures/assemble-oci-layout.py >/dev/null

hold() { sleep 3; }

prompt() {
  printf '\n\033[1;36mrea-demo$\033[0m %s\n' "$*"
}

echo
echo "============================================================"
echo "  REA  inspect-oci-image-layout"
echo "  Directory-form OCI image layouts (no tar input)"
echo "  Layout assembled by script: skopeo/buildah/docker absent"
echo "============================================================"
hold

echo
echo "----- before: untouched upstream/main -----"
prompt "rea inspect-oci-image-layout $LAYOUT --json"
(cd "$BASE" && node scripts/rea.mjs inspect-oci-image-layout "$LAYOUT" --json)
echo "exit=$?"
hold

echo
echo "----- after: feat/oci-image-layout -----"
prompt "ls $LAYOUT"
ls -la "$LAYOUT"
echo
prompt "rea inspect-oci-image-layout $LAYOUT --json | jq <inventory>"
(cd "$FEATURE" && node scripts/rea.mjs inspect-oci-image-layout "$LAYOUT" --json | jq "$JQ_FILTER")
echo "exit=$?"
hold

LAYER="$LAYOUT/blobs/sha256/5acc47cb64df692bbd2c80aada9a7ca587ea592c409790473d03f09995fadbca"
echo
echo "----- tamper one layer blob (same 17 bytes, different content) -----"
prompt "python3 -c 'Path(layer).write_bytes(b\"TAMPER-layer-xxx\\n\")'"
python3 -c 'from pathlib import Path; p=Path("'"$LAYER"'"); p.write_bytes(b"TAMPER-layer-xxx\n"); print("wrote", p.stat().st_size, "bytes")'
hold

echo
echo "----- re-inspect: digest mismatch is a finding -----"
prompt "rea inspect-oci-image-layout $LAYOUT --json | jq .normalized_result.findings"
(cd "$FEATURE" && node scripts/rea.mjs inspect-oci-image-layout "$LAYOUT" --json | jq '.normalized_result.findings')
echo "exit=$?"
echo
echo "Done. Layer contents were not decompressed (follow-up)."
hold
hold
