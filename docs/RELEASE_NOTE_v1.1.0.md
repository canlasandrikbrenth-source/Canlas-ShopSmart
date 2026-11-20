# ShopSmart v1.1.0 — Hosted classroom release (AWS, single EC2)

**Date:** 20 November 2026 · **Branch:** `aws-deploy` · **Deployed commit:** `030ee33`
**URL:** https://16-179-144-238.sslip.io (AWS `ap-southeast-2`, EC2 `i-055fca61871c712be`)
**Release type:** Hosted. Fictional customer data and simulated checkout only; no real payments.

## New
- Customer sign-in: create a test account, sign in, sign out (`/signin`, `/account`).
- *My account* lists your own simulated orders; each order has a detail page.
- Checkout requires sign-in and pre-fills your name and email.
- Assistant answers show whether they came from a live AI provider or the rule-based fallback.

## Changed
- Orders are private: the API returns an order only to the customer who placed it (guest 401, other customer 403).
- If the database is unavailable the API returns 503 instead of silently using temporary in-memory data.
- `/api/health` now checks PostgreSQL and reports the deployed version.
- API binds to `127.0.0.1` behind Nginx in production; CORS allows credentials for the configured frontend origin only.

## Database
- New migration `20261120090000_add_users_sessions_order_owner` (User, Session, `Order.userId`). Apply with `npm run db:migrate:deploy`.
- New `npm run db:seed:initial` inserts sample products only into an empty catalog. **Do not run `npm run db:seed` on a deployed database** — it deletes orders.

## Deployment files
- `deploy/ec2/bootstrap.sh` (first-time setup), `deploy/ec2/release.sh` (updates, installed as `shopsmart-release`), `deploy/ec2/nginx-shopsmart.conf`, `deploy/ec2/shopsmart-api.service`.

## Known limitations
- Single instance, no database backups (fictional data only). Stopping/starting the instance changes its IP and hostname; re-run `bootstrap.sh` afterwards.
- No live AI key is configured; the assistant uses the labeled rule-based fallback.
- Product administration (Week 4 admin role) is not included.

## Local development after pulling this release
```
npm install
npm run db:generate
npm run db:migrate      # applies the new migration locally
npm run dev
```
`backend/.env` needs no new values for local use (cookies are not marked Secure unless `NODE_ENV=production` or `COOKIE_SECURE=true`).
