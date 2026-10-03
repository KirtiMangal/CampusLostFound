# CampusFind

CampusFind is a campus lost-and-found web application. Students publish lost or found item reports, review candidate matches, and use a claim workflow to verify ownership. The app also provides private in-app notifications, contact disclosure after claim approval, and administrative analytics and moderation tools.

> **Project status:** implementation and final documentation are complete through Phase 10 (Docker, CI, and deployment configuration). No public deployment or production usage is claimed.

## What it does

- Student registration and sign-in, with database-backed authorization and admin roles.
- Create, browse, search, filter, update, and resolve lost/found item reports.
- Upload up to five JPEG, PNG, or WebP images per report to Cloudinary.
- Optionally ask Gemini to suggest a title, description, and category; users review and apply suggestions themselves.
- Generate explainable match candidates from category, location, date, and text signals, with Gemini assessment and heuristic fallback.
- Submit and review ownership claims. Contact details are disclosed only to approved claim participants (and administrators).
- Deliver in-app notifications and show aggregate admin analytics.
- Report abuse, prioritize reports for human review, hide listings, and suspend/reactivate accounts with audit history.

Matches and AI suggestions are decision support. They do not confirm that an item was recovered or establish ownership.

## Architecture

```text
Browser (React + Vite)
      │ same-origin /api in Compose, configurable API URL in development
      ▼
Nginx (frontend container) ── private Compose network ── Express API
                                                        ├── MongoDB
                                                        ├── Gemini API (optional)
                                                        └── Cloudinary (optional)
```

The client is a React single-page application. Express exposes a JSON API; Mongoose stores users, items, matches, claims, notifications, moderation reports, and admin mutation leases in MongoDB. Shared item categories live in `shared/itemConstants.js`. The Docker Compose setup expects an external MongoDB URI rather than starting a database container. In local development Vite serves the client and the API runs separately.

## Stack

- **Client:** React 18, Vite 7, React Router, Tailwind CSS 3, React Hook Form, Zod, Axios, Lucide React, Recharts.
- **API:** Node.js 24 LTS, Express 4, Mongoose 8, MongoDB, JWT (`jsonwebtoken`), `bcryptjs`, Zod, Multer, `express-rate-limit`, Helmet.
- **Integrations:** Google Gemini through `@google/genai`; Cloudinary for image storage.
- **Quality and delivery:** Node test runner, Supertest, Vitest, React Testing Library, ESLint, Docker, Nginx, GitHub Actions.

## Repository layout

```text
client/                 React UI, pages, components, context, schemas, API client
server/src/              Express app, routes, controllers, models, services, middleware
server/test/             API, service, security, and lifecycle tests
shared/                  Constants shared by client and API
.github/workflows/ci.yml GitHub Actions verification workflow
docker-compose.yml       Frontend and API services; MongoDB is external
```

## Run locally

Prerequisites: Node.js 24 LTS, npm, and a reachable MongoDB instance. Use the lockfiles checked in at the root, `client`, and `server`.

```bash
npm ci
npm ci --prefix server
npm ci --prefix client
```

Copy the environment examples and set local values:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Set `MONGO_URI` and a private `JWT_SECRET` in `server/.env`. Cloudinary and Gemini credentials are optional until those integrations are used. Keep all secrets in the server environment; do not put secrets in `VITE_*` variables.

```bash
npm run dev
```

The client is served at `http://localhost:5173`; the API is at `http://localhost:5000`. The health route is `GET http://localhost:5000/api/health`. Alternatively, run `npm run server` and `npm run client` in separate terminals.

Production startup requires `MONGO_URI`, `CLIENT_URL` (comma-separated exact trusted origins), and a `JWT_SECRET` of at least 32 bytes. Cloudinary and Gemini settings are optional. See `server/.env.example` for all backend options and defaults.

## Main API routes

All routes below are under `/api`. Routes marked **auth** require a bearer token; **admin** additionally requires the persisted admin role. Request schemas are validated server-side.

| Area | Routes |
| --- | --- |
| Health | `GET /health` |
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Items (**auth**) | `POST /items`, `GET /items`, `GET /items/:id`, `PUT /items/:id`, `DELETE /items/:id`, `GET /items/:id/matches` |
| AI description (**auth**) | `POST /ai/describe` |
| Claims (**auth**) | `POST /items/:itemId/claims`, `GET /items/:itemId/claims`, `GET /claims/mine`, `GET /claims/received`, `GET /claims/:claimId`, `PATCH /claims/:claimId/approve`, `/reject`, `/cancel`, `GET /claims/:claimId/contact` |
| Notifications (**auth**) | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:notificationId/read`, `PATCH /notifications/read-all`, `DELETE /notifications/:notificationId` |
| Reports (**auth**) | `POST /reports` |
| Admin (**admin**) | `GET /admin/reports`, `GET /admin/reports/:reportId`, `PATCH /admin/reports/:reportId/review`, `PATCH /admin/items/:itemId/moderation`, `GET /admin/users`, `PATCH /admin/users/:userId/suspend`, `/unsuspend` |
| Admin analytics (**admin**) | `GET /admin/analytics/overview`, `/trends`, `/categories`, `/locations` |

Item browse supports type, category, location, status, search, sort, page, limit, and `mine` filters. Its page size is capped at 50. Admin list endpoints are also paginated. See route validators and controllers under `server/src/` for request and response schemas.

## Data model and core workflows

- **User:** normalized unique email, bcrypt password hash (cost 12), student/admin role, active/suspended state, and bounded suspension history.
- **Item:** lost/found type, title, description, shared category, location, event date, active/resolved state, images, owner, and moderation visibility/history. A text index supports item search.
- **Match:** unordered unique item pair, heuristic breakdown, optional Gemini assessment, final score, classification, and evidence signals.
- **Claim:** claimant, item owner, message, status, and reviewer timestamps. A partial unique index permits one pending claim per claimant/item pair.
- **Notification:** recipient-scoped event, related records, read state, and deduplication key.
- **Report:** target, reason, priority, review state, deterministic flag signals, and bounded admin review history.
- **AdminMutationLock:** short MongoDB lease used to coordinate last-active-admin protections.

Claims can move from pending to approved, rejected, or cancelled. Only the found-item owner or an admin can approve/reject; only the claimant can cancel. Approval conditionally resolves an active item and rejects its other pending claims. Contact details are available from the dedicated contact endpoint only after approval and only to an authorized participant or admin. Historical records are retained.

## Matching and AI

Matching considers active, visible items of the opposite lost/found type. A deterministic score uses category (25 points), location token overlap (up to 20), date proximity (up to 25), and title/description token Jaccard similarity (up to 30). The default heuristic threshold is 45. The service examines at most 200 reports in its candidate pool and assesses at most 10 ranked candidates with Gemini.

When Gemini responds with valid output, the default final score combines heuristic score (40%) and Gemini confidence (60%). Default classifications are strong candidate (80+), possible candidate (60+), weak candidate (40+), and unlikely (below 40). If Gemini fails or output is invalid, matching falls back to the heuristic score. Match generation is scheduled in-process after report creation or relevant edits; item writes do not wait for it. A unique unordered pair key prevents duplicate stored pairs. Candidate scores are not measured accuracy and do not prove ownership.

The description assistant sends relevant report fields to Gemini from the backend and validates the structured response with Zod. The Gemini key is server-only. Users decide whether to apply any suggestion. AI functionality can be skipped; a Gemini outage does not prevent ordinary item reporting or heuristic matching.

## Security and privacy

- Passwords are bcrypt-hashed; bearer JWTs are checked against the current MongoDB user record on protected requests. The current database role and active status control authorization, so suspension invalidates existing tokens for API access.
- Public registration always creates students. Admin APIs independently enforce role checks on the server.
- Zod schemas, bounded pagination, allow-listed sorts, file signature checks, selected response fields, and ownership/participant checks limit invalid input and unauthorized access.
- Helmet, exact CORS origin allowlists, request-body limits, sanitized production errors, and rate limits protect API boundaries. Rate limits are process-local.
- Item, match, and pre-approval claim responses do not expose email addresses. Contact details are released through the approved-claim endpoint. Analytics return aggregates.
- The browser stores its JWT in `localStorage`, which is accessible to JavaScript on the site. A production deployment should assess an HttpOnly/Secure/SameSite cookie design and its CSRF requirements.
- In-memory rate limits and in-process match scheduling are not shared across API instances. Production multi-instance deployments need shared rate-limit and job infrastructure.

Automatic moderation scores only prioritize reports for human review; they do not automatically hide content or suspend accounts. Admin actions retain bounded audit history. A MongoDB lease helps prevent concurrent operations from suspending the last active administrator.

## Docker and CI

To run Compose, install Docker with the Compose plugin, copy the root example, and set real development database credentials:

```powershell
Copy-Item .env.example .env
```

```bash
docker compose config
docker compose build
docker compose up
```

Open `http://localhost:8080`. Compose builds a production-only, non-root API image and a multi-stage frontend image served by Nginx. Nginx proxies `/api` to the API over the private Compose network; the API port is not published to the host. MongoDB remains external. Never commit a populated `.env` file.

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes and pull requests. It uses Node 24, installs all three npm projects with `npm ci`, runs lint and both test suites, builds the client, validates Compose, and builds both container images. It uses local placeholder values and does not push images or deploy.

## Verification

Run the configured checks from the repository root:

```bash
npm run lint
npm test
npm run test:client
npm run build
```

Tests mock MongoDB, Gemini, and Cloudinary operations; they do not verify a live deployment or provider integration. Coverage is not configured. In the Phase 11 workspace verification, all 100 backend tests and all 33 frontend tests passed, lint passed, and the Vite production build passed with a large-chunk warning (824.41 kB minified JS). Docker and Docker Compose commands could not run because Docker is not installed in the environment. See [docs/INTERVIEW_GUIDE.md](docs/INTERVIEW_GUIDE.md) for a demo flow, resume bullets, architecture explanation, interview questions, and future improvements.

## Known limits

- No deployment, production user base, or measured recovery/AI-accuracy metric is claimed.
- Notifications are in-app only; there is no email, SMS, or push delivery.
- Rate limiting and background match scheduling are process-local.
- Gemini suggestions and match assessments may be wrong; users must review reports and verify ownership through claims.
- Cloudinary cleanup is best-effort; failed remote deletions may leave orphaned assets.
- Analytics describe current persisted records and do not establish real-world recovery outcomes beyond the recorded claim/item state.
- The full client development dependency audit has five high findings through Tailwind CSS 3's transitive `braces` dependency. The upstream advisory does not list a patched release; npm's suggested fix upgrades Tailwind to v4, which is a breaking migration. Production dependency audit was clean at the previous Phase 10 check.
- The client production bundle currently triggers Vite's advisory that a minified JavaScript chunk exceeds 500 kB. Docker builds and Compose validation remain unverified in this workspace because Docker is unavailable.

## Future improvements

Potential next steps, not implemented features: shared Redis rate-limit storage, durable background jobs, email/push notifications, stronger semantic and image similarity, richer observability, expanded analytics, and a secure cookie-based browser session. A Tailwind v4 migration should be handled and verified separately.

## Repository metadata

No Git remote or public repository URL is configured in this workspace. Add the actual repository URL and any badges only after publishing/configuring the repository; no fake metrics or deployment badges are included.
