#!/bin/sh
# Derive nginx client_max_body_size from MAX_UPLOAD_SIZE (bytes → MB).
BYTES=${MAX_UPLOAD_SIZE:-2147483648}
MB=$(( BYTES / 1024 / 1024 ))
export NGINX_CLIENT_MAX_BODY_SIZE="${MB}M"
envsubst '${NGINX_CLIENT_MAX_BODY_SIZE}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
