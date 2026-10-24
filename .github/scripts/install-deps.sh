#!/usr/bin/env bash
# Installs dependencies for the release builds, retrying network downloads that fail transiently.
#
# Every native module (node-pty, @vscode/sqlite3, @vscode/deviceid, ...) runs `node-gyp rebuild`, and each one fetches
# Electron's headers from electronjs.org unless they are already in node-gyp's cache. A single dropped connection there
# used to fail the whole release (read ECONNRESET on SHASUMS256.txt), so the headers are fetched once up front with
# retries, and the full install is retried as a fallback for any other transient download failure.
set -euo pipefail

export ELECTRON_SKIP_BINARY_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

retry() {
	local attempts=$1 delay=$2
	shift 2
	local n
	for ((n = 1; n <= attempts; n++)); do
		if "$@"; then
			return 0
		fi
		if ((n < attempts)); then
			echo "::warning::Attempt $n/$attempts failed: $* - retrying in ${delay}s"
			sleep "$delay"
		fi
	done
	echo "::error::All $attempts attempts failed: $*"
	return 1
}

# Electron target and header URL come from the checked-in .npmrc, the same values npm hands to node-gyp.
target=$(sed -n 's/^target="\(.*\)"/\1/p' .npmrc)
disturl=$(sed -n 's/^disturl="\(.*\)"/\1/p' .npmrc)

# Use npm's bundled node-gyp so the headers land in the same cache directory that `npm install` reads them from.
node_gyp="$(npm root -g)/npm/node_modules/node-gyp/bin/node-gyp.js"
if [[ -n "$target" && -n "$disturl" && -f "$node_gyp" ]]; then
	echo "Prefetching Electron $target headers from $disturl"
	retry 5 15 node "$node_gyp" install --target="$target" --dist-url="$disturl"
else
	echo "::warning::Skipping Electron header prefetch (target='$target', disturl='$disturl', node-gyp at '$node_gyp')"
fi

clean_install() {
	if npm install; then
		return 0
	fi
	# A failed install leaves half-built native modules behind; start the next attempt from a clean tree.
	rm -rf node_modules
	return 1
}

retry 3 30 clean_install
