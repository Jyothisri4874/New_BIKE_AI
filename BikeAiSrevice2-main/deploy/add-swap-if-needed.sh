#!/usr/bin/env bash
set -euo pipefail

MIN_SWAP_MB="${MIN_SWAP_MB:-2048}"
SWAPFILE="${SWAPFILE:-/swapfile}"

current_swap_mb="$(free -m | awk '/^Swap:/ {print $2}')"
if [ "${current_swap_mb:-0}" -ge "$MIN_SWAP_MB" ]; then
  echo "Swap already available: ${current_swap_mb} MB"
  exit 0
fi

if [ -f "$SWAPFILE" ]; then
  echo "$SWAPFILE exists but active swap is below ${MIN_SWAP_MB} MB"
  swapon "$SWAPFILE" || true
else
  fallocate -l "${MIN_SWAP_MB}M" "$SWAPFILE" || dd if=/dev/zero of="$SWAPFILE" bs=1M count="$MIN_SWAP_MB"
  chmod 600 "$SWAPFILE"
  mkswap "$SWAPFILE"
  swapon "$SWAPFILE"
fi

if ! grep -qE "^[^#].*${SWAPFILE}[[:space:]]+none[[:space:]]+swap" /etc/fstab; then
  echo "${SWAPFILE} none swap sw 0 0" >> /etc/fstab
fi

sysctl vm.swappiness=10
if ! grep -q "^vm.swappiness=10" /etc/sysctl.conf; then
  echo "vm.swappiness=10" >> /etc/sysctl.conf
fi

free -h
