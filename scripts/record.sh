#!/bin/sh
set -eu
OUT=/tmp/vsix-demo
rm -f "$OUT/out.mp4" "$OUT/preview.gif" "$OUT/palette.png"

if [ -e /tmp/.X11-unix/X97 ]; then
  echo "display :97 already in use" >&2
  exit 1
fi

Xvfb :97 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset >"$OUT/xvfb.log" 2>&1 &
XPID=$!
sleep 0.5
DISPLAY=:97 xsetroot -solid "#111111"

ffmpeg -y -nostdin \
  -f x11grab -video_size 1920x1080 -framerate 30 -draw_mouse 0 -i :97 \
  -c:v libx264 -pix_fmt yuv420p -profile:v high -preset fast -crf 18 \
  -movflags +faststart \
  "$OUT/out.mp4" >"$OUT/ffmpeg.log" 2>&1 &
FPID=$!
echo "$FPID" > "$OUT/ffmpeg.pid"
sleep 0.8

DISPLAY=:97 LANG=C.UTF-8 xterm \
  -geometry 168x42+48+48 \
  -fa "DejaVu Sans Mono" -fs 16 \
  -bg "#111111" -fg "#e8e8e8" -cr "#e8e8e8" \
  +sb -b 8 \
  -xrm "*allowBoldFonts: true" \
  -xrm "*termName: xterm-256color" \
  -u8 \
  -e /bin/sh "$OUT/demo-session.sh"

sleep 0.4
kill -INT "$FPID" 2>/dev/null || true
wait "$FPID" || true
kill "$XPID" 2>/dev/null || true
wait "$XPID" 2>/dev/null || true

echo "recorded $OUT/out.mp4"
ls -l "$OUT/out.mp4"
ffprobe -hide_banner "$OUT/out.mp4" 2>&1 | tail -20
