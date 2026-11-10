# ShopSmart Quality and Deployment Report

**Laboratory Activity:** PDC50 Final Laboratory Activity — Guided Challenge  
**Candidate Version:** `v1.0.0-rc1` (Commit: `be17c6f`)  
**Lead Developer:** Andrik Brenth Canlas (BSIT 4-A)  
**Date:** November 10, 2026  
**Repository:** [github.com/canlasandrikbrenth-source/Canlas-ShopSmart](https://github.com/canlasandrikbrenth-source/Canlas-ShopSmart.git)

---

## 1. Activity 1: Establish a Baseline

### Baseline Inspection & Check Results
From the project root (`Canlas-ShopSmart`), the baseline check command `npm run check` was executed prior to modifications:

```bash
> shopsmart-starter@1.0.0 check
> npm run lint --workspace frontend && npm run lint --workspace backend && npm run test && npm run build

> shopsmart-frontend@1.0.0 lint (passed)
> shopsmart-backend@1.0.0 lint (passed)
> shopsmart-frontend@1.0.0 test (vitest run: 7 passed)
> shopsmart-backend@1.0.0 test (node --test: 12 passed)
> shopsmart-frontend@1.0.0 build (vite build: dist/index.html 0.50 kB, dist/assets/index.js 274.31 kB)
```

- **API Health Endpoint (`GET /api/health`):** Returned HTTP 200 `{"status": "ok"}`.
- **Authoritative Catalog Route (`GET /api/products`):** Returned 6 active products with formatted prices and stock levels.

### Feature Inventory
| Feature Domain | Current Implementation Status | Notes |
|---|---|---|
| **Catalog Browsing & Search** | Present & Verified | Real-time substring query matching name & description; category filtering; price/name sorting. |
| **Cart Operations** | Present & Verified | In-memory cart with quantity increment/decrement, remove item, subtotal and order total calculation. |
| **Stock Enforcement** | Present & Verified | Cart restricts quantity to available stock; backend enforces 409 Conflict if stock is exceeded. |
| **Simulated Checkout** | Present & Verified | Full name, email format, and delivery address (≥10 chars) validated via Zod; creates simulated order with order ID. |
| **AI Product Assistant** | Present & Grounded | Powered by Google Gemini API (`gemini-3.5-flash`) with budget parsing, candidate filtering, provider timeout guard, anti-hallucination verification, and clickable source badges. |
| **User Authentication / Roles** | Absent | Explicitly out of scope for classroom starter; public catalog and simulated orders only. |
| **Live External AI Provider** | Present with Fallback | Google Gemini API integrated with automatic fallback to deterministic rule engine upon failure/timeout. |

---

## 2. Activity 2: Customer Journey & Failure Test Record

### Test Case 1: Browse and Search
* **Case and starting state:** Clean catalog page loaded at `http://localhost:5173/` with 6 products displayed.
* **Action and test data:**
  1. Typed `"keyboard"` into the Search products input field.
  2. Observed filtered cards.
  3. Typed `"nonexistentgadget99"` into the Search products input field.
* **Expected result:**
  - `"keyboard"` search narrows visible catalog to "Compact Mechanical Keyboard".
  - `"nonexistentgadget99"` renders a clean empty state message: `"No products match your filters."`
* **Observed result and evidence:**
  - Filtering updated instantaneously. Exactly 1 product card appeared for keyboard.
  - Empty query returned 0 products with message: `"No products match your filters."` HTTP 200 returned from `GET /api/products?search=keyboard`.
* **Decision:** **PASS**

### Test Case 2: Cart Operations and Total Accuracy
* **Case and starting state:** User viewing catalog with empty cart (`Cart (0)` in navigation).
* **Action and test data:**
  1. Clicked "Add to cart" on *Wireless Mouse* (₱650, stock: 12).
  2. Clicked "Add to cart" on *USB-C Study Lamp* (₱900, stock: 10).
  3. Navigated to `/cart`.
  4. Clicked `+` on *Wireless Mouse* to increase quantity to 2.
  5. Clicked "Remove" on *USB-C Study Lamp*.
* **Expected result:**
  - Initial cart total: ₱650 + ₱900 = ₱1,550 (Item count: 2).
  - After quantity increase: 2 × ₱650 = ₱1,300 + ₱900 = ₱2,200 (Item count: 3).
  - After removing lamp: Total = ₱1,300 (Item count: 2).
* **Observed result and evidence:**
  - Cart page rendered updated line item subtotal: `₱1,300`.
  - Summary sidebar accurately reported: `Items: 2`, `Total: ₱1,300`. Subtotals match `price * quantity` exactly.
* **Decision:** **PASS**

### Test Case 3: Simulated Checkout Journey
* **Case and starting state:** Cart contains 2 units of *Wireless Mouse* (Subtotal: ₱1,300). User navigates to `/checkout`.
* **Action and test data (Sub-case 3A — Invalid Input Refusal):**
  - Full Name: `A` (1 char; min required: 2)
  - Email: `not-an-email`
  - Delivery Address: `Short` (5 chars; min required: 10)
  - Clicked "Place simulated order".
* **Expected result:** Form submission is blocked by browser HTML5 validation and rejected by backend Zod schema (`HTTP 422 INVALID_ORDER`).
* **Observed result and evidence:** HTML5 validation flagged invalid email and length; direct API invocation returned `HTTP 422 Unprocessable Entity` with `code: "INVALID_ORDER"`.
* **Action and test data (Sub-case 3B — Valid Simulated Checkout):**
  - Full Name: `Maria Santos`
  - Email: `maria.santos@example.com`
  - Delivery Address: `456 Mabini Street, Angeles City, Pampanga 2009`
  - Clicked "Place simulated order".
* **Expected result:** Simulated order accepted; order receipt displayed with simulated order number; cart cleared.
* **Observed result and evidence:** `POST /api/orders` returned `HTTP 201 Created` with payload `{"id": 1001, "customerName": "Maria Santos", "total": 1300, ...}`. Screen transitioned to success card: `"Thank you, Maria Santos! Your simulated order number is #1001."` Cart reset to 0 items.
* **Decision:** **PASS**

### Test Case 4: Stock Constraints Enforcement
* **Case and starting state:** User viewing *Compact Mechanical Keyboard* (Stock: 8).
* **Action and test data:**
  1. In `/cart`, manually entered quantity `9` (exceeding stock limit of 8).
  2. Submitted direct API POST request with quantity `15` for product with stock 10.
* **Expected result:**
  - Frontend blocks quantity change beyond 8 and displays accessible error alert: `"Only 8 unit(s) are available."`
  - Backend API rejects request with `HTTP 409 Conflict` and message `"Only 10 unit(s) of ... are available."`
* **Observed result and evidence:**
  - Frontend cart input rejected change, keeping quantity at 8, and rendered alert banner: `"Only 8 unit(s) are available."`
  - Backend API responded with `HTTP 409 Conflict` (`code: "INSUFFICIENT_STOCK"`). Database and memory store stock counts remained unaltered.
* **Decision:** **PASS**

### Test Case 5: Grounded Product Assistant
* **Case and starting state:** User on `/assistant` page.
* **Action and test data:**
  1. Asked: `"Which keyboard is below ₱2,000?"`
  2. Asked: `"Which sneakers are below ₱500?"`
* **Expected result:**
  1. Keyboard query identifies *Compact Mechanical Keyboard* (₱1,850), grounding answer strictly in catalog facts, displaying clickable product link and source badge `#2`.
  2. Sneakers query honest refusal: `"I could not find an in-stock product matching that request."` Zero hallucinated products or sources.
* **Observed result and evidence:**
  1. Returned `HTTP 200`: `"The Compact Mechanical Keyboard is priced at ₱1,850, which is below ₱2,000, and features hot-swappable tactile switches."` Recommended products: 1 (`/products/2`), Sources: 1 (`Source #2: Compact Mechanical Keyboard`).
  2. Returned `HTTP 200`: `"I could not find an in-stock product matching that request."` Zero recommended products or sources.
* **Decision:** **PASS**

### Test Case 6: Failure & Outage Resilience
* **Case and starting state:** Backend configured with invalid/revoked Gemini key or simulated network timeout (>5000ms).
* **Action and test data:** Submitted question: `"Which keyboard is below ₱2,000?"` on `/assistant`.
* **Expected result:** UI does not freeze in infinite loading state; backend intercepts provider failure, safely suppresses credentials, and executes `buildRuleBasedResponse()` fallback.
* **Observed result and evidence:** Response resolved in <250ms with `HTTP 200`: `"I recommend the Compact Mechanical Keyboard for ₱1,850. It is currently in stock."` Sources array verified with catalog item #2. UI loading indicator cleared cleanly.
* **Decision:** **PASS**

---

## 3. Activity 3: Defect Diagnosis, Resolution, and Verification

### Defect Identified: Inaccessible Alert Feedback on Stock and Cart Constraints
* **Starting State:** Customer on `CartPage`, `ProductsPage`, or `ProductDetailsPage` encounters a validation error (e.g. quantity set to 0 or quantity exceeding available stock).
* **Action:**
  1. On `CartPage`, user cleared input or typed `0`.
  2. On `ProductsPage` or `ProductDetailsPage`, user clicked "Add to cart" after item reached max stock.
* **Actual Result:**
  1. In `CartPage.jsx`, `<StatusMessage type={cartMessage.startsWith('Only') ? 'error' : 'info'}>` was hardcoded to only inspect messages starting with `"Only"`. Setting quantity to `0` returned `"Quantity must be a whole number greater than zero."`, which was styled as a neutral `info` banner rather than `error`, failing accessible alert standards (`role="status"` instead of `role="alert"`).
  2. In `ProductsPage.jsx` and `ProductDetailsPage.jsx`, `<StatusMessage>{cartMessage}</StatusMessage>` omitted `type`, causing stock cap rejections to appear as neutral info rather than critical feedback.
* **Expected Result:**
  All cart validation failures and stock limit violations must consistently emit `type="error"`, applying prominent error styling and assistive `role="alert"` attributes.
* **Root Cause:**
  `CartContext.jsx` only stored a plain text string `cartMessage` without tracking the semantic message category (`info` vs. `error`).

### Smallest Underlying Fix Applied:
1. **`CartContext.jsx`:** Introduced `cartMessageType` state (`'info'` | `'error'`). Explicitly set `cartMessageType = 'error'` when `addProductToCart` or `updateCartQuantity` returns an error, and `'info'` on successful operations.
2. **Page Components:** Updated `CartPage.jsx`, `ProductsPage.jsx`, and `ProductDetailsPage.jsx` to pass `type={cartMessageType}` to `StatusMessage`.
3. **Automated Test Additions:**
   - Added unit test in `frontend/src/utils/cart.test.js`: `prevents adding a product beyond available stock limit`.
   - Added integration validation tests in `backend/test/validation.test.js`: short address rejection, malformed email rejection, and empty cart items rejection.
4. **Production Migration Script:** Added `"db:migrate:deploy": "prisma migrate deploy"` to `backend/package.json` and root `package.json` to enable non-interactive production deployments without wiping existing data.

### Verification Check:
Ran `npm run check`. All 8 frontend Vitest tests and all 15 backend Node.js tests passed without warnings; Vite production build completed in 1.07s.

---

## 4. Activity 4: Four-Tier Deployment Architecture and Plan

### Architecture Diagram

```mermaid
flowchart TD
    subgraph Client ["Client Layer (End User)"]
        Browser["User Web Browser\n(Desktop / Mobile)"]
    end

    subgraph FrontendHosting ["Frontend Hosting (e.g., Vercel / Netlify / Cloudflare Pages)"]
        StaticCDN["Static File CDN / Edge\nVite Production Bundle (HTML, CSS, JS)"]
    end

    subgraph BackendHosting ["Backend API Hosting (e.g., Render / Railway / Fly.io)"]
        APIServer["Node.js / Express Server (Port 3000 / 443)\n- Helmet & CORS Security\n- Zod Request Validators\n- Rate Limiting (20 req/min)\n- Prisma 6 Client"]
    end

    subgraph DatabaseHosting ["Managed Database (e.g., Neon / Supabase / Railway Postgres)"]
        PostgreSQL[("PostgreSQL 16+\nTables: Product, Order, OrderItem\nMigrations: prisma/migrations")]
    end

    subgraph AIProvider ["External AI Cloud"]
        GeminiAPI["Google Gemini API\n(generativelanguage.googleapis.com)\nModel: gemini-3.5-flash"]
    end

    %% Network Connections
    Browser -- "1. HTTPS (Port 443) Cross-Internet" --> StaticCDN
    Browser -- "2. HTTPS REST Calls Cross-Internet\n[VITE_API_URL: https://api.shopsmart.com/api]" --> APIServer
    APIServer -- "3. TLS Encrypted SQL (Port 5432 / pooler)\n[DATABASE_URL with SSL mode=require]" --> PostgreSQL
    APIServer -- "4. Outbound HTTPS (Port 443) via x-goog-api-key\n[GEMINI_API_KEY kept server-side only]" --> GeminiAPI
```

### Seven Deployment Architecture Questions & Solutions

#### 1. Where will the Vite build files be hosted? Which URL will the frontend use for the API?
- **Hosting Location:** Hosted as static assets on a global Edge CDN platform such as **Vercel**, **Netlify**, or **Cloudflare Pages**.
- **Frontend API URL:** The frontend is built using the environment variable `VITE_API_URL=https://api.shopsmart.com/api` (or matching staging URL). Because Vite embeds `VITE_` variables directly into the compiled JavaScript bundle (`dist/assets/*.js`), this variable is strictly public and contains only the API origin.

#### 2. Where will the Express server run, and what public URL will serve `/api/health`?
- **Server Runtime:** Runs as a containerized Node.js (LTS 22) service on a platform like **Render Web Service**, **Railway**, or **Fly.io**.
- **Public Health Endpoint:** Accessible via public HTTPS at `https://api.shopsmart.com/api/health`. Monitoring platforms and load balancers poll this endpoint to verify container readiness and liveness.

#### 3. Where will PostgreSQL run, and how will the server receive `DATABASE_URL` securely?
- **Database Location:** Managed PostgreSQL instance hosted on **Neon**, **Supabase**, or **Railway Postgres** with automated backups and connection pooling.
- **Secure Credential Injection:** The connection string is provided exclusively as a secret environment variable `DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"` through the hosting provider's encrypted dashboard. It is never placed in repository source code or build artifacts.

#### 4. Which origin will be permitted by `FRONTEND_URL` and the API CORS configuration?
- **Permitted Origin:** Set via server environment variable `FRONTEND_URL=https://shopsmart.com` (or the staging frontend domain `https://staging.shopsmart.com`).
- **Express CORS Middleware:** `app.use(cors({ origin: process.env.FRONTEND_URL }))` in `backend/src/app.js` strictly permits cross-origin requests originating only from the trusted frontend client domain, refusing unauthorized third-party origins.

#### 5. Where will a provider key be stored, if present? How will it be kept out of the frontend bundle and repository?
- **Storage Location:** Stored exclusively as an encrypted server secret `GEMINI_API_KEY` on the Express API host.
- **Client & Repo Isolation:** The provider key is never prefixed with `VITE_`, preventing it from being injected into the frontend build. It is listed in `.gitignore` so no `.env` file can be committed. Outbound calls to Google Generative Language API originate strictly from server-to-server HTTPS requests in `backend/src/services/aiProvider.js` using the `x-goog-api-key` header.

#### 6. How will database migrations be applied before first use, without wiping existing orders?
- **Production Migration Command:** Applied using Prisma's dedicated production command:
  ```bash
  npm run db:migrate:deploy
  # executes: prisma migrate deploy
  ```
- **Preservation of Orders & Catalog:** Unlike `prisma migrate dev` (which creates shadow databases and can prompt for table resets during schema drift) and `npm run db:seed` (which executes `deleteMany()` on orders and products), `prisma migrate deploy` executes committed migration SQL files non-interactively without wiping existing orders or customer records.

#### 7. Who can access the staging app, and will only fictional customer data be used?
- **Access Control:** The staging environment is restricted to authorized course evaluators and team members via HTTP Basic Authentication or host access allowlists.
- **Privacy Policy:** Only fictional names (e.g. *Maria Santos*, *Juan Dela Cruz*), synthetic emails (`*@example.com`), and mock delivery addresses are entered during testing and demonstrations. No actual credit card numbers or real personal data are ever captured.

---

## 5. Activity 5: Release Candidate Verification & Release Note

### Release Candidate Verification Checklist

| Release Check | Pass Condition | Observed Verification | Result |
|---|---|---|---|
| **Build and Tests** | `npm run check` completes with 0 errors across both frontend and backend workspaces. | 8 Vitest frontend tests passed; 15 backend Node.js tests passed; production Vite build succeeded. | **PASS** |
| **Health and API** | `/api/health` responds HTTP 200 `{"status": "ok"}` and frontend successfully fetches `/api/products`. | Verified live on `http://localhost:3000/api/health` and `http://localhost:3000/api/products`. | **PASS** |
| **Database** | Products load and simulated orders can be submitted without reseeding or wiping prior data. | Simulated order #1001 created successfully; prior catalog records preserved intact. | **PASS** |
| **Assistant** | Grounded recommendations citing actual catalog products; honest no-match; graceful fallback on timeout. | Returned accurate recommendations with source `#2`; zero hallucinated products; honest no-match for sneakers. | **PASS** |
| **Secrets Hygiene** | No `.env`, `DATABASE_URL`, or `GEMINI_API_KEY` committed to repository or bundled into `dist/`. | `.gitignore` covers all `.env` variants; `git status --ignored` verifies `.env` files are strictly excluded. | **PASS** |
| **Privacy Safeguards** | Only fictional customer and product details utilized in testing and documentation. | Standardized fictional names (*Maria Santos*), dummy addresses, and test emails (*@example.com*) utilized throughout. | **PASS** |

---

## 6. Official Release Note

### Version & Metadata
- **Release Version:** `v1.0.0-rc1` (Local Release Candidate)
- **Commit ID:** `be17c6f`
- **Date:** November 10, 2026

### Working Features
1. **Catalog Explorer & Live Search:** Dynamic product search, category filtering, and multi-mode sorting (price ascending/descending, alphabetical).
2. **Interactive Cart:** Real-time quantity adjustment, subtotal computation, item removal, and stock cap enforcement.
3. **Simulated Checkout:** Comprehensive Zod schema validation (name, email, address length ≥ 10 chars), stock verification, receipt generation with order ID, and automatic cart clearance.
4. **Grounded AI Product Assistant:** Natural language product inquiry parsing, peso budget extraction, candidate ranking, Google Gemini API draft generation, server-side anti-hallucination verification, traceable source badges, and instant rule-based fallback.
5. **Zero-Downtime Data Layer:** Dual-layer architecture utilizing Prisma 6 with PostgreSQL, complemented by an in-memory fallback store ensuring uninterrupted operation.

### Known Limitations
1. **User Authentication:** Sign-in and role-based access control (RBAC) are absent by design for this starter milestone; order placement remains simulated.
2. **Local Release Status:** Release candidate is packaged and verified locally (`http://localhost:5173` and `http://localhost:3000`). Live cloud deployment is staged pending instructor-approved cloud hosting quotas.

### Local Startup Instructions for Evaluators
1. Ensure **Node.js LTS (v20.19+ / v22 recommended)** and **PostgreSQL** are installed.
2. Clone repository and install dependencies:
   ```powershell
   git clone https://github.com/canlasandrikbrenth-source/Canlas-ShopSmart.git
   cd Canlas-ShopSmart
   npm install
   ```
3. Prepare environment files:
   ```powershell
   Copy-Item backend\.env.example backend\.env
   Copy-Item frontend\.env.example frontend\.env
   ```
4. Run automated checks to verify workspace integrity:
   ```powershell
   npm run check
   ```
5. Apply database schema migrations:
   ```powershell
   npm run db:migrate:deploy
   ```
6. Start development servers:
   ```powershell
   npm run dev
   ```
7. Open `http://localhost:5173` in your browser. API health is verified at `http://localhost:3000/api/health`.

### Team Contribution Record
- **Team Member:** Andrik Brenth Canlas (BSIT 4-A)
- **Test Executed:** End-to-end checkout validation and stock constraint stress testing (Test Cases 3 & 4), verifying HTTP 409 Conflict handling on oversold items.
- **Core Contribution:** Refactored cart alert feedback architecture in `CartContext.jsx` to guarantee accessible `role="alert"` status styling; added backend validation regression tests; and created the production `db:migrate:deploy` pipeline.
- **Issue Explained:** Resolved status message semantic ambiguity where stock limit violations in catalog cards and cart inputs previously defaulted to informational badges rather than explicit error alerts, ensuring WCAG compliance and clear user guidance.
