#!/bin/bash
D=:93
Xvfb $D -screen 0 1920x1080x24 >/dev/null 2>&1 & XV=$!
sleep 2
DISPLAY=$D xterm -geometry 100x29+0+0 -fa 'DejaVu Sans Mono' -fs 22 -bg '#0b0f17' -fg '#e6e6e6' -b 20 -e bash -c 'printf "\033[1;33mpreparing...\033[0m"; sleep 2.5; bash /workspace/osc-bulk-1119/demo-oci/scene.sh 2>&1 | tee /workspace/osc-bulk-1119/demo-oci/commands-out.txt' &
XT=$!
sleep 2
ffmpeg -loglevel error -y -f x11grab -framerate 30 -video_size 1920x1080 -i $D -c:v libx264 -preset veryfast -pix_fmt yuv420p -r 30 raw.mp4 & FF=$!
wait $XT
sleep 0.3; kill -INT $FF; wait $FF; kill $XV
