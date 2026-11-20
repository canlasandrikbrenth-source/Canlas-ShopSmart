# ShopSmart Hosted Verification Record

**URL tested:** https://16-179-144-238.sslip.io · **Code version:** `030ee33` (branch `aws-deploy`, reported by `/api/health`)
**Host:** EC2 `i-055fca61871c712be`, `ap-southeast-2b` · **Date:** 20 Nov 2026, 09:47–09:54 UTC (17:47–17:54 PHT)
**Data:** fictional test accounts (`verify-a-…@example.com`, `verify-b-…@example.com`) with random, unrecorded passwords; simulated orders only.

Expected results were written before each check. Status codes are the actual responses from the hosted URL.

## 1. Results against the guide's verification table

| # | Check | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | Frontend and direct route | Home loads; direct load/refresh of a React route shows the app | `/` shows 6 product cards. Direct load of `/products/2` shows *Compact Mechanical Keyboard, ₱1,850.00, 8 available*. `http://…/cart` redirects to `https://…/cart` and renders the app | PASS |
| 2 | API connection | Browser calls the HTTPS API on the same origin; health responds | Bundle `index-CIKYd81d.js` uses API base `"/api"` (no `localhost`). `GET /api/health` → **200** `{"status":"ok","database":"ok","version":"030ee33"}` | PASS |
| 3 | Catalog and cart | Current products; search; quantity and totals correct | `GET /api/products` → **200**, 6 products. `?search=keyboard` → 1 result (*Compact Mechanical Keyboard*). UI: Add to cart → `Cart (1)` → cart page → *Proceed to checkout* | PASS |
| 4a | Account — guest | Guest refused private data | `GET /api/orders` → **401** `AUTH_REQUIRED`; `GET /api/orders/1` → **401**; `POST /api/orders` → **401**; UI checkout shows *Sign in to place your simulated order* | PASS |
| 4b | Account — owner | Owner can read own order | Customer A registered (**201**), `GET /api/auth/me` → **200**; `GET /api/orders/1` → **200**; `GET /api/orders` → **200**, 1 order | PASS |
| 4c | Account — other customer | Different customer denied by direct API request | Customer B: `GET /api/orders/1` → **403** `ORDER_FORBIDDEN`; `GET /api/orders` → **200**, 0 orders | PASS |
| 4d | Wrong password | Refused without revealing which field | `POST /api/auth/login` (wrong password) → **401** `INVALID_CREDENTIALS` | PASS |
| 5a | Simulated checkout — valid | Fictional order saved | `POST /api/orders` (Wireless Mouse ×1) → **201**, order #1, total 650, `userId` 1. Mouse stock 12 → 11 | PASS |
| 5b | Simulated checkout — invalid | Invalid input refused | name `A`, email `bad`, address `short` → **422** `INVALID_ORDER` | PASS |
| 5c | Simulated checkout — excess | Over-limit/over-stock refused | quantity 999 → **422** `INVALID_ORDER` (max 20 per line); quantity 12 with 11 in stock → **409** `INSUFFICIENT_STOCK` | PASS |
| 6a | Assistant — match | Claims and links match current records; provider labeled | "Which keyboard is below ₱2,000?" → **200**, product #2 *Compact Mechanical Keyboard* ₱1,850 (matches catalog). `provider: "rule-based-fallback (provider unavailable)"`, shown in UI as *Rule-based fallback answer — no live AI used* | PASS |
| 6b | Assistant — no match | Clear no-match | "Which sneakers are below ₱500?" → **200** "I could not find an in-stock product matching that request.", `provider: "none"`, no products | PASS |
| 6c | Assistant — invalid input | Clear refusal | question `x` → **422** `INVALID_QUESTION` | PASS |
| 7a | Restart and logs | API recovers after restart; errors traceable | `systemctl restart shopsmart-api` → health **200** within 3 s. Log lines carry ISO time + request ID + method + path + status | PASS |
| 7b | Reboot | API and DB start automatically; data persists | `sudo reboot` at 09:52 UTC → 09:53:18 health **200**, version `030ee33`; Mouse stock still **11** (order persisted) | PASS |
| 8a | Secrets | No secret in repo, browser files or logs | Bundle and CSS contain none of `postgresql://`, `DATABASE_URL`, `GEMINI`, `AIza`, `shopsmart_app`. `.env` files are git-ignored. Nginx access log and API journal: 0 matches for password/DB-URL patterns | PASS |
| 8b | Network exposure | Only web ports public | Listening: 80/443 (Nginx, public), 22 (sshd; SG allows only EC2 Instance Connect prefix list), 5432 on **127.0.0.1** only, API on **127.0.0.1:3000** only. SG has no 3000/5432 rule | PASS |
| 8c | Credits | Within plan | Free plan, US$110.70 credits before launch; estimated US$0.30–0.45/day | PASS (monitor) |
| 9 | Unknown API route | JSON 404 | `GET /api/nope` → **404** `ROUTE_NOT_FOUND` | PASS |

**Still to collect by the student (UI evidence with screenshots):** create a fictional account through *Sign in → Create one*, place a simulated order through the checkout form, open *My account → Order #…*, then sign out and confirm `/account` redirects to sign-in. (Claude did not type passwords into the hosted sign-in form; the same flow was verified at the API level above.)

## 2. Two improvements and their retests

### Improvement 1 — Customer sign-in and server-side order ownership
- **Problem:** the hosted guide requires a signed-in test customer and private order records, but the release had no users and orders were write-only and anonymous.
- **Change:** User + Session models (migration `20261120090000_add_users_sessions_order_owner`), scrypt password hashes, random session token stored only as a SHA-256 hash, `HttpOnly; Secure; SameSite=Lax` cookie, checkout requires sign-in, `GET /api/orders` and `GET /api/orders/:id` with ownership check (`orderAccess`: guest 401, other customer 403, owner 200).
- **Retest:** checks 4a–4d and 5a above (hosted), plus unit tests in `backend/test/auth.test.js` (password hashing, token hashing, cookie flags, ownership matrix, registration validation). `npm run check`: 21 backend + 8 frontend tests pass, build succeeds.

### Improvement 2 — Make database failures visible and the health check honest
- **Problem:** if PostgreSQL was unreachable, products/orders/assistant silently fell back to an in-memory store. Checkout returned **201** for orders that vanished on restart, and `/api/health` returned `ok` without touching the database — a broken RDS/local DB connection would look healthy.
- **Change:** removed `memoryDb.js` and all fallbacks; Prisma connection errors return **503** `DATABASE_UNAVAILABLE` with a trace ID; `/api/health` runs `SELECT 1` and returns **503** `{"database":"unavailable"}` on failure, and reports the deployed commit.
- **Retest:** checks 2, 7a and 7b above (health shows `database: ok` and version; data persists across restart and reboot). Failure-path retest (to run in class if required): `sudo systemctl stop postgresql` → `GET /api/health` expected **503** and `GET /api/products` expected **503** `DATABASE_UNAVAILABLE`; then `sudo systemctl start postgresql` → **200** again.

## 3. Problems found during deployment and how they were located

| Symptom | First failed connection | Cause | Fix | Retest |
|---|---|---|---|---|
| `http://…/api/health` returned Nginx's default **404** 10 minutes after launch | Instance boot log (`aws ec2 get-console-output`) | `bootstrap.sh` ran `git rev-parse` as root on a repo owned by `shopsmart` → git "dubious ownership" error stopped the script | Run git as the `shopsmart` user; also scoped `umask 027` to the secrets file and copied web files with 755/644 so Nginx can read them (commit `030ee33`) | Re-ran bootstrap via EC2 Instance Connect → certificate issued, health **200** |
