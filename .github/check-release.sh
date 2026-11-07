#!/bin/sh
# Starts the mdame at $1 on an empty folder, then asks it for /api/state
# with its token. The release workflow runs it after each install.
set -eu

mdame=$1
dir=$(mktemp -d)
# Away from the config and the token of the user who runs it.
export XDG_CONFIG_HOME="$dir/config" XDG_STATE_HOME="$dir/state"
mkdir "$dir/notes"

"$mdame" --version
"$mdame" --no-open --port 4891 "$dir/notes" &
pid=$!
trap 'kill "$pid"' EXIT

token="$XDG_STATE_HOME/mdame/token"
for _ in $(seq 50); do
    if [ -s "$token" ] && curl --silent --output /dev/null http://127.0.0.1:4891/; then
        break
    fi
    sleep 0.2
done

state=$(curl --fail --silent --show-error "http://127.0.0.1:4891/api/state?t=$(cat "$token")")
echo "$state"
case "$state" in
    *'/notes"'*) ;;
    *) echo "/api/state does not name the folder"; exit 1 ;;
esac
