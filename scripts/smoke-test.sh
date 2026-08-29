#!/usr/bin/env bash
# Runs one built image, points it at a tiny real image, and checks it
# actually indexes AND features that image - not just that the process
# starts. A container that boots fine but can't decode anything (a missing
# native shared library Magick.NET dynamically links against, say) would
# pass a plain healthcheck and still be useless; features.json only reaches
# "featured":1 if the whole decode -> resize -> encode -> hash pipeline
# actually ran. Used for both linux/amd64 (native on the GitHub runner) and
# linux/arm64 (under QEMU emulation - slower, but arm64 is the actual
# deployment target this project cares about, so it is worth the CI minutes).
#
# Usage: smoke-test.sh <image-tag> <platform> <host-port>
set -euo pipefail

IMAGE="$1"
PLATFORM="$2"
PORT="$3"
NAME="smoke-$$"

docker run -d --name "$NAME" --platform "$PLATFORM" -p "$PORT:8080" \
  -e INDEX_INTERVAL_SECS=2 -e FEATURES_INTERVAL_SECS=2 \
  -v /tmp/smoke/references:/references:ro \
  "$IMAGE" >/dev/null

cleanup() {
  echo "--- container logs ($PLATFORM) ---"
  docker logs "$NAME" 2>&1 | tail -50
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

ok=0
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:$PORT/healthz" 2>/dev/null | grep -q '"status":"ok"'; then ok=1; break; fi
  sleep 1
done
if [ "$ok" != 1 ]; then
  echo "::error::[$PLATFORM] container never became healthy"
  exit 1
fi

featured=0
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:$PORT/features.json" 2>/dev/null | grep -q '"featured":1'; then featured=1; break; fi
  sleep 1
done
if [ "$featured" != 1 ]; then
  echo "::error::[$PLATFORM] features.json never reported the test image as featured"
  exit 1
fi

echo "[$PLATFORM] smoke test passed"
