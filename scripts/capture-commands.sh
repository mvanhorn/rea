#!/bin/sh
# Capture exact commands, stdout, stderr, and exit codes for commands.log.
set -u
export PATH="/home/box/.local/node-v24/bin:$PATH"
export NODE_NO_WARNINGS=1
unset FORCE_COLOR
unset NO_COLOR

FEATURE=/workspace/osc-bulk-1119/rea/wt-vsix-package
BASELINE=/tmp/rea-vsix-baseline
LOG=/tmp/vsix-demo/commands.log
FILTER=confidence,normalized_result.vsix_identity,normalized_result.package_identity,normalized_result.identity_disagreements,normalized_result.engine,normalized_result.target_platform,normalized_result.entry_points,normalized_result.activation_events,normalized_result.contributes.keys,normalized_result.signatures,normalized_result.coverage,normalized_result.limitations

: > "$LOG"
run() {
  cwd=$1
  shift
  {
    printf '%s\n' ""
    printf '%s\n' "===== CMD ====="
    printf 'cwd: %s\n' "$cwd"
    printf 'command:'
    for arg in "$@"; do
      printf ' %s' "$arg"
    done
    printf '\n'
    printf '%s\n' "----- stdout+stderr -----"
  } >> "$LOG"
  set +e
  (cd "$cwd" && "$@") >> "$LOG" 2>&1
  code=$?
  set -e
  printf '%s\n' "----- exit ${code} -----" >> "$LOG"
  return 0
}

{
  printf '%s\n' "REA inspect-vsix-package capture"
  printf 'date: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'node: %s\n' "$(node -v)"
  printf 'feature: %s %s\n' "$FEATURE" "$(git -C "$FEATURE" rev-parse --short HEAD)"
  printf 'baseline: %s %s\n' "$BASELINE" "$(git -C "$BASELINE" rev-parse --short HEAD)"
  printf 'host: %s\n' "$(uname -a)"
} >> "$LOG"

run "$BASELINE" node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/demo.hello-1.2.3.vsix
run "$FEATURE" node scripts/rea.mjs inspect-vsix-package --help
run "$FEATURE" node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/demo.hello-1.2.3.vsix
run "$FEATURE" node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/demo.hello-1.2.3.vsix --filter-output "$FILTER"
run "$FEATURE" node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/ms-vscode.references-view-0.0.89.vsix
run "$FEATURE" node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/ms-vscode.references-view-0.0.89.vsix --filter-output "$FILTER"
run "$FEATURE" node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/broken.vsix --filter-output "$FILTER"
run "$FEATURE" node scripts/rea.mjs inspect-vsix-package /tmp/vsix-demo/not-an-extension.vsix

printf 'wrote %s\n' "$LOG"
wc -l "$LOG"
ls -l /tmp/vsix-demo/*.vsix
sha256sum /tmp/vsix-demo/*.vsix
