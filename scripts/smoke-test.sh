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

# What the app is given to keep (UserStore): a file is stored under its
# hash and served back, a type that could run as a page is refused, a JSON
# document goes in and comes out - and only through the API - and the upload
# joins the library as the Uploads pack on the next index pass.
BASE="http://localhost:$PORT"
fail() { echo "::error::[$PLATFORM] $1"; exit 1; }
up=$(curl -fsS -X POST -H 'Content-Type: image/jpeg' --data-binary @/tmp/smoke/references/Test/a.jpg "$BASE/api/uploads") \
  || fail "upload refused"
url=$(echo "$up" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')
curl -fsS -o /dev/null "$BASE/$url" || fail "upload not served back at /$url"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: text/html' --data '<b>' "$BASE/api/uploads")" = 400 ] \
  || fail "an HTML upload was not refused"
curl -fsS -X PUT -H 'Content-Type: application/json' --data '{"name":"smoke"}' "$BASE/api/items/smoke/one" || fail "item not stored"
curl -fsS "$BASE/api/items/smoke/one" | grep -q '"name":"smoke"' || fail "item not read back"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/.items/smoke/one.json")" = 404 ] || fail "items are served as static files"
# A write that tries to climb out of .items: refused - 400 from the name
# check, or 404 from the rule that no dot-prefixed path is served, either way.
code=$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: application/json' --data '{}' "$BASE/api/items/..%2Fx/one")
case "$code" in 4??) ;; *) fail "a write to a kind with ../ was not refused (HTTP $code)" ;; esac
pack=0
for _ in $(seq 1 30); do
  if curl -fsS "$BASE/index.json" 2>/dev/null | grep -q '"name":"Uploads"'; then pack=1; break; fi
  sleep 1
done
[ "$pack" = 1 ] || fail "the upload never joined the library as the Uploads pack"
# Sorting (js/sort.js decides, UserStore moves): into a folder from the
# server's own list - served by its id after, and in the library under that
# folder's group within seconds - and never into a folder the client names.
id=$(echo "$up" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
curl -fsS -X PUT -H 'Content-Type: application/json' --data '{"folder":"figure"}' "$BASE/api/uploads/$id/folder" \
  | grep -q '"folder":"figure"' || fail "upload not sorted into a folder"
curl -fsS -o /dev/null "$BASE/api/uploads/$id" || fail "a sorted upload is not served by its id"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: application/json' --data '{"folder":"../x"}' "$BASE/api/uploads/$id/folder")" = 400 ] \
  || fail "a folder outside the list was not refused"
group=0
for _ in $(seq 1 30); do
  if curl -fsS "$BASE/index.json" 2>/dev/null | grep -q "/uploads/Figure/$id"; then group=1; break; fi
  sleep 1
done
[ "$group" = 1 ] || fail "the sorted upload never showed in the library under Figure"

echo "[$PLATFORM] smoke test passed"
