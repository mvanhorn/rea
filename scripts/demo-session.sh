#!/bin/sh
# Live xterm session: real CLI on baseline vs feat/vsix-package.
set -eu
export PATH="/tmp/vsix-demo/bin:/home/box/.local/node-v24/bin:$PATH"
export NODE_NO_WARNINGS=1
export FORCE_COLOR=1
unset NO_COLOR
export LANG=C.UTF-8
export TERM=xterm-256color
cd /tmp/vsix-demo
FILTER=confidence,normalized_result.vsix_identity,normalized_result.package_identity,normalized_result.engine,normalized_result.activation_events,normalized_result.signatures,normalized_result.coverage,normalized_result.limitations

C0=$(printf '\033[0m')
C1=$(printf '\033[1;37m')
C2=$(printf '\033[1;32m')
C3=$(printf '\033[1;33m')
C4=$(printf '\033[1;31m')
CD=$(printf '\033[2m')

pause() { sleep "${1:-3}"; }

banner() {
  printf '%s%s%s\n' "$C3" "$1" "$C0"
}

run_cmd() {
  printf '%s$ %s%s\n' "$C1" "$*" "$C0"
  set +e
  # shellcheck disable=SC2086
  "$@"
  code=$?
  set -e
  if [ "$code" -eq 0 ]; then
    printf '%sexit %s%s\n' "$C2" "$code" "$C0"
  else
    printf '%sexit %s%s\n' "$C4" "$code" "$C0"
  fi
}

printf '\033[2J\033[H'
printf '%sREA  inspect-vsix-package%s\n' "$C1" "$C0"
printf 'Inspect a local VS Code .vsix without install or network\n'
printf '%supstream/main  1ba93c8    feat/vsix-package  2419bd7%s\n' "$CD" "$C0"
pause 3

printf '\033[2J\033[H'
banner "1/5  upstream/main — command is missing"
run_cmd rea-main inspect-vsix-package demo.hello-1.2.3.vsix
pause 3

printf '\033[2J\033[H'
banner "2/5  this branch — inspect-vsix-package --help"
run_cmd rea inspect-vsix-package --help
pause 3

printf '\033[2J\033[H'
banner "3/5  synthetic fixture  demo.hello-1.2.3.vsix"
run_cmd rea inspect-vsix-package demo.hello-1.2.3.vsix --filter-output "$FILTER"
pause 3

printf '\033[2J\033[H'
banner "4/5  public Microsoft extension  ms-vscode.references-view 0.0.89"
printf '%sOpen VSX download; file is outside the repo and is not committed.%s\n' "$CD" "$C0"
run_cmd rea inspect-vsix-package ms-vscode.references-view-0.0.89.vsix --filter-output "$FILTER"
pause 3

printf '\033[2J\033[H'
banner "5/5  refusal — not a ZIP"
run_cmd rea inspect-vsix-package not-an-extension.vsix
pause 3

printf '\033[2J\033[H'
banner "malformed vsixmanifest — inventory kept, limitation recorded"
run_cmd rea inspect-vsix-package broken.vsix --filter-output "$FILTER"
pause 3
# Stop the recorder while this frame is still on screen.
if [ -f /tmp/vsix-demo/ffmpeg.pid ]; then
  kill -INT "$(cat /tmp/vsix-demo/ffmpeg.pid)" 2>/dev/null || true
fi
pause 1
