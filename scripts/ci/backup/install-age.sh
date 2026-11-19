#!/usr/bin/env bash
# Install the same verified upstream release on the hosted and fixture runners.
set -euo pipefail

version=v1.3.2
# https://github.com/FiloSottile/age/releases/tag/v1.3.2
sha256=cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10
work=$(mktemp -d "${RUNNER_TEMP:?}/backup-age.XXXXXX")
asset="age-$version-linux-amd64.tar.gz"

curl --fail --silent --show-error --location \
  --connect-timeout 10 --max-time 30 --retry 4 --retry-all-errors --retry-max-time 90 \
  --output "$work/$asset" "https://github.com/FiloSottile/age/releases/download/$version/$asset"
printf '%s  %s\n' "$sha256" "$work/$asset" | sha256sum --check
tar -xzf "$work/$asset" -C "$work" age/age age/age-keygen
"$work/age/age" --version
printf '%s\n' "$work/age" >> "${GITHUB_PATH:?}"
