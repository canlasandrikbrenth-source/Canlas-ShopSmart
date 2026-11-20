#!/usr/bin/env bash
# One-time setup of the single-EC2 ShopSmart layout on Ubuntu 24.04 LTS.
# Run as root (EC2 user data does this). Safe to re-run: it keeps the existing database password and data.
# Log: /var/log/shopsmart-bootstrap.log
set -euo pipefail
exec > >(tee -a /var/log/shopsmart-bootstrap.log) 2>&1
echo "=== ShopSmart bootstrap started $(date -Is) ==="

REPO_URL="${REPO_URL:-https://github.com/canlasandrikbrenth-source/Canlas-ShopSmart.git}"
BRANCH="${BRANCH:-aws-deploy}"
APP_HOME=/opt/shopsmart
APP_DIR=$APP_HOME/app
ENV_FILE=/etc/shopsmart/api.env
export DEBIAN_FRONTEND=noninteractive

# 1. Swap: a 1 GiB micro instance needs it for npm install and the Vite build
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. Packages: Nginx, PostgreSQL 16, Git, certbot, Node.js 22 LTS
apt-get update -y
apt-get install -y ca-certificates curl gnupg git rsync nginx postgresql certbot python3-certbot-nginx
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y && apt-get install -y nodejs
fi
node -v && npm -v

# 3. Public hostname: <public-ip-with-dashes>.sslip.io resolves to this instance, so Let's Encrypt can issue a certificate
TOKEN=$(curl -sS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 300')
PUBLIC_IP=$(curl -sS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)
PUBLIC_HOST="${PUBLIC_HOST:-${PUBLIC_IP//./-}.sslip.io}"
echo "Public host: $PUBLIC_HOST"

# 4. Service account and code (exact branch and commit are recorded)
id shopsmart >/dev/null 2>&1 || useradd --system --create-home --home-dir $APP_HOME --shell /usr/sbin/nologin shopsmart
if [ ! -d $APP_DIR/.git ]; then
  sudo -u shopsmart git clone --branch "$BRANCH" "$REPO_URL" $APP_DIR
else
  sudo -u shopsmart git -C $APP_DIR fetch origin "$BRANCH" && sudo -u shopsmart git -C $APP_DIR checkout -B "$BRANCH" "origin/$BRANCH"
fi
COMMIT=$(sudo -u shopsmart git -C $APP_DIR rev-parse --short HEAD)

# 5. PostgreSQL: local only (listen_addresses=localhost is the Ubuntu default). Password generated here, never printed.
install -d -m 0750 -o root -g shopsmart /etc/shopsmart
if [ ! -f $ENV_FILE ]; then
  DB_PASS=$(openssl rand -hex 24)
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE shopsmart_app LOGIN PASSWORD '$DB_PASS';"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE shopsmart OWNER shopsmart_app;"
  ( umask 027
  cat > $ENV_FILE <<ENVEOF
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
TRUST_PROXY=1
COOKIE_SECURE=true
FRONTEND_URL=https://$PUBLIC_HOST
DATABASE_URL=postgresql://shopsmart_app:$DB_PASS@127.0.0.1:5432/shopsmart?schema=public
# GEMINI_API_KEY=   (optional; leave unset to use the labeled rule-based fallback)
ENVEOF
  )
  unset DB_PASS
  chown root:shopsmart $ENV_FILE && chmod 0640 $ENV_FILE
fi
sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$PUBLIC_HOST|" $ENV_FILE
grep -q '^APP_VERSION=' $ENV_FILE && sed -i "s|^APP_VERSION=.*|APP_VERSION=$COMMIT|" $ENV_FILE || echo "APP_VERSION=$COMMIT" >> $ENV_FILE

# 6. Build and migrate (release commands: migrate deploy + non-destructive seed, never `migrate dev` or `db:seed`)
install -m 0755 $APP_DIR/deploy/ec2/release.sh /usr/local/bin/shopsmart-release
install -m 0644 $APP_DIR/deploy/ec2/shopsmart-api.service /etc/systemd/system/shopsmart-api.service
systemctl daemon-reload
/usr/local/bin/shopsmart-release --no-pull

# 7. Nginx site
sed "s|__SERVER_NAME__|$PUBLIC_HOST|" $APP_DIR/deploy/ec2/nginx-shopsmart.conf > /etc/nginx/sites-available/shopsmart
ln -sf /etc/nginx/sites-available/shopsmart /etc/nginx/sites-enabled/shopsmart
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx && systemctl reload nginx

# 8. HTTPS certificate from Let's Encrypt (auto-renewed by certbot.timer); HTTP then redirects to HTTPS
if certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email --redirect -d "$PUBLIC_HOST"; then
  echo "HTTPS ready: https://$PUBLIC_HOST"
else
  echo "WARNING: certificate request failed. Site is HTTP only; do NOT use sign-in until HTTPS works."
fi

echo "=== ShopSmart bootstrap finished $(date -Is) | commit $COMMIT | https://$PUBLIC_HOST ==="
