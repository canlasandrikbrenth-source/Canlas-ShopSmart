#!/usr/bin/env bash
# Release (or re-release) ShopSmart on the EC2 host: pull, install, build, migrate, restart, health check.
# Usage: sudo shopsmart-release            (pull latest of the deployed branch)
#        sudo shopsmart-release --no-pull  (rebuild current checkout)
set -euo pipefail
APP_DIR=/opt/shopsmart/app
ENV_FILE=/etc/shopsmart/api.env
# DATABASE_URL is passed through the environment, not the command line, so it never shows in `ps` or logs
as_app() { sudo -u shopsmart -H --preserve-env=DATABASE_URL bash -c "cd $APP_DIR && $*"; }

if [ "${1:-}" != "--no-pull" ]; then
  BRANCH=$(sudo -u shopsmart git -C $APP_DIR rev-parse --abbrev-ref HEAD)
  as_app "git fetch origin $BRANCH && git reset --hard origin/$BRANCH"
fi
COMMIT=$(sudo -u shopsmart git -C $APP_DIR rev-parse --short HEAD)
echo "Releasing commit $COMMIT"

as_app "npm ci --no-audit --no-fund"
as_app "npm run db:generate"
# Same-origin API: the browser calls https://<host>/api, which Nginx forwards to 127.0.0.1:3000
as_app "VITE_API_URL=/api npm run build"

# Apply committed migrations and insert sample products only into an empty catalog (keeps orders and users)
DATABASE_URL=$(grep '^DATABASE_URL=' $ENV_FILE | cut -d= -f2-); export DATABASE_URL
as_app "npm run db:migrate:deploy"
as_app "npm run db:seed:initial"
unset DATABASE_URL

install -d -m 0755 /var/www/shopsmart
# Nginx (www-data) must be able to read the files whatever umask built them
rsync -rlt --delete --chown=root:root --chmod=D755,F644 $APP_DIR/frontend/dist/ /var/www/shopsmart/

sed -i "s|^APP_VERSION=.*|APP_VERSION=$COMMIT|" $ENV_FILE
systemctl enable shopsmart-api >/dev/null
systemctl restart shopsmart-api
sleep 3
curl -fsS http://127.0.0.1:3000/api/health && echo && echo "Release $COMMIT is healthy."
