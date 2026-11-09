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
"$mdame" --no-open "$dir/notes" >"$dir/out" &
pid=$!
trap 'kill "$pid"' EXIT

# If its port is busy, mdame takes the next free one: the URL that it
# prints names the port.
token="$XDG_STATE_HOME/mdame/token"
address=
for _ in $(seq 50); do
    address=$(sed -n 's|^mdame on http://\([^/]*\)/.*|\1|p' "$dir/out")
    if [ -n "$address" ] && [ -s "$token" ] && curl --silent --output /dev/null "http://$address/"; then
        break
    fi
    sleep 0.2
done
if [ -z "$address" ]; then
    echo "mdame printed no URL"
    cat "$dir/out"
    exit 1
fi

state=$(curl --fail --silent --show-error "http://$address/api/state?t=$(cat "$token")")
echo "$state"
case "$state" in
    *'/notes"'*) ;;
    *) echo "/api/state does not name the folder"; exit 1 ;;
esac
