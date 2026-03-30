#!/bin/bash
set -e

BACKEND_HOST=${BACKEND_HOST:-"backend"}

echo "Injecting BACKEND_HOST=${BACKEND_HOST} into nginx config..."
sed -i "s/BACKEND_HOST/${BACKEND_HOST}/g" /etc/nginx/conf.d/default.conf

# Validate nginx config before starting
nginx -t

echo "Frontend ready → proxying /api/* to http://${BACKEND_HOST}:5000"
exec "$@"