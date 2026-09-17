#!/usr/bin/env bash
# Compile the phone UI's JSX to plain JS.
#
# The browser used to do this itself with Babel standalone on every launch —
# a 3 MB script to parse plus ~60 KB of JSX to transpile, on a phone, every
# single open. Compiling once here removes all of that from startup.
#
# The compiled .js files are committed alongside the .jsx sources so the app
# runs from a plain checkout and the packages need no Node. Run this after
# editing any .jsx; build-deb.sh and build-rpm.sh refuse to package stale
# output.
set -euo pipefail

cd "$(dirname "$0")/web/static"

# Pinned so the output is reproducible. npx fetches it on first use; nothing
# is installed into the project.
ESBUILD="npx -y esbuild@0.24.2"

for src in glide-ui glide-setup glide-controller glide-connect glide-desktop; do
  # No bundling and no module wrapper: each file stays a classic script whose
  # top-level declarations are shared globals, exactly as the JSX was loaded.
  $ESBUILD "$src.jsx" \
    --loader:.jsx=jsx \
    --jsx=transform \
    --jsx-factory=React.createElement \
    --jsx-fragment=React.Fragment \
    --target=safari15 \
    --outfile="$src.js" \
    --log-level=warning
  printf '  %-22s → %s (%s KB)\n' "$src.jsx" "$src.js" "$(( $(wc -c < "$src.js") / 1024 ))"
done

echo "done"
