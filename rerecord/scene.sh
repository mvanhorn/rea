#!/bin/bash
export PATH="/home/box/.local/node-v24/bin:$PATH" NODE_NO_WARNINGS=1 NO_COLOR=1
F=/workspace/osc-bulk-1119/rea/wt-oci-image-layout; B=/tmp/rea-oci-baseline; L=/tmp/oci-demo/busybox.oci
python3 /tmp/oci-demo-assets/fixtures/assemble-oci-layout.py >/dev/null
p(){ printf '\n\033[1;32m$\033[0m %s\n' "$*"; }
h(){ printf '\033[1;33m%s\033[0m\n' "$*"; }
clear; h "rea inspect-oci-image-layout: offline OCI image-layout directory inventory"; echo "Layout: $L (assembled by script; one 17-byte layer)"
p "ls $L $L/blobs/sha256"; ls $L $L/blobs/sha256
echo; h "Before: untouched upstream/main"
p "rea inspect-oci-image-layout $L --json | jq '{code, message}'"
(cd $B && node scripts/rea.mjs inspect-oci-image-layout $L --json > /tmp/o.json; echo "exit=$?" > /tmp/o.rc); jq '{code, message}' /tmp/o.json; cat /tmp/o.rc
sleep 4
clear; h "After: feat/oci-image-layout (Env values omitted by default)"
p "rea inspect-oci-image-layout $L --json | jq -r <key facts>"
(cd $F && node scripts/rea.mjs inspect-oci-image-layout $L --json > /tmp/o.json; echo "exit=$?" > /tmp/o.rc)
jq -r '.normalized_result | "layout_version: \(.artifact.layout_version)", "platform: \(.images[0]|{os,architecture}|tojson)", "env (names only): \(.images[0].env|tojson)", "layers: \([.images[0].layers[]|{size,present}]|tojson)", "coverage: \(.coverage|tojson)", "findings: \(.findings|tojson)"' /tmp/o.json
sleep 4
clear; h "Tamper one layer blob (same 17 bytes, different content)"
LAYER=$(ls $L/blobs/sha256/5acc*)
p "printf 'TAMPER-layer-xxx\n' > blobs/sha256/5acc47cb...  # same size"
printf 'TAMPER-layer-xxx\n' > $LAYER; stat -c '%s bytes' $LAYER
echo; h "Re-inspect: the digest mismatch is a finding"
p "rea inspect-oci-image-layout $L --json | jq '.normalized_result.findings'"
(cd $F && node scripts/rea.mjs inspect-oci-image-layout $L --json > /tmp/o.json; echo "exit=$?" > /tmp/o.rc)
jq '.normalized_result.findings' /tmp/o.json; cat /tmp/o.rc
sleep 5
