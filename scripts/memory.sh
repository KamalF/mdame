#!/bin/sh
# Prints the memory of each process given, with its children, as PSS in MB.
# PSS splits each page that processes share between them, so a program of
# several processes, such as VS Code, counts its shared libraries once.
# Run it with sudo: Chromium and VS Code hide the memory of their sandboxed
# processes from the account that runs them. Linux only.
set -eu

tree() {
    echo "$1"
    for child in $(ps -o pid= --ppid "$1"); do
        tree "$child"
    done
}

total=0
for root in "$@"; do
    if [ -z "$root" ] || ! [ -d "/proc/$root" ]; then
        echo "no process with the ID '$root'"
        exit 1
    fi
    kb=0
    for pid in $(tree "$root"); do
        # A child may exit between the listing and the read.
        pss=$(awk '/^Pss:/ { print $2 }' "/proc/$pid/smaps_rollup" 2>/dev/null) || pss=0
        kb=$((kb + ${pss:-0}))
    done
    echo "$root $(ps -o comm= -p "$root"): $((kb / 1024)) MB"
    total=$((total + kb))
done
if [ $# -gt 1 ]; then
    echo "total: $((total / 1024)) MB"
fi
