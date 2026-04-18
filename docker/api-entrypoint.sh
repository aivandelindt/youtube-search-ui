#!/bin/sh
set -e
# Named volumes mount as root:root; app runs as uid 1001 (nodejs). Fix ownership once at start.
mkdir -p /data
chown -R nodejs:nodejs /data
exec gosu nodejs "$@"
