#!/usr/bin/env bash
# Static acceptance checks for deploy.sh. Run on any Bash host; no Ubuntu packages are changed.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/deploy.sh"
CONFIG_FILE="$(mktemp)"
trap 'rm -f "$CONFIG_FILE"' EXIT

bash -n "$SCRIPT"
bash "$SCRIPT" --help | grep -Fq 'Usage:'
cat > "$CONFIG_FILE" <<'EOF'
NODE_MAJOR=20
PNPM_VERSION=10
APP_NAME=reborn-snake
DEPLOY_ROOT=/var/www/reborn-snake
HTTP_PORT=80
DISABLE_DEFAULT_NGINX_SITE=true
ASSET_CACHE_DURATION=365d
GIT_REPOSITORY=https://example.com/example/reborn-snake.git
GIT_BRANCH=main
DOMAIN_NAME=''
ENABLE_HTTPS=false
LETSENCRYPT_EMAIL=''
EOF
bash "$SCRIPT" --config "$CONFIG_FILE" --validate-config | grep -Fq 'Configuration is valid'

for required_text in \
  'apt-get install -y ca-certificates curl git nginx' \
  'This script supports Ubuntu only' \
  'pnpm --dir "$source_dir" install --frozen-lockfile' \
  'pnpm --dir "$source_dir" build' \
  'nginx -t' \
  'certbot --nginx --non-interactive --agree-tos --redirect --email' \
  'try_files \$uri \$uri/ /index.html'; do
  grep -Fq "$required_text" "$SCRIPT"
done

printf 'Deployment script static checks passed.\n'
