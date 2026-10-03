# CampusFind — Interview & Resume Guide

This guide describes the code currently in this repository. It does not claim a production deployment, user count, recovery metric, or measured AI accuracy. Treat Gemini matches as candidate ranking; the claim workflow is how a person verifies ownership.

## Resume entry

**CampusFind — AI-Assisted Campus Lost & Found | React, Node.js, Express, MongoDB, Gemini, Cloudinary, Docker**

- Built a React and Express lost-and-found app with JWT authentication, role-based admin access, validated item CRUD, search, pagination, and Cloudinary image uploads.
- Implemented explainable lost/found candidate matching using category, location, date, and text signals, with schema-validated Gemini assessment and heuristic fallback.
- Designed a claim workflow with duplicate-pending protection, single-winner item resolution, and contact disclosure only after approval; added recipient-scoped notifications.
- Added admin analytics and auditable moderation, plus Docker/Nginx deployment configuration and GitHub Actions checks for lint, tests, frontend build, Compose validation, and image builds.

### Short ATS version

React, Node.js, Express, MongoDB, Mongoose, REST API, JWT, RBAC, Zod, Gemini API, Cloudinary, Multer, Docker, Nginx, GitHub Actions, Vitest, React Testing Library, Supertest, ESLint.

Keep this entry tied to your own contribution and do not add impact numbers unless you measure them.

## 30–45 second pitch

“CampusFind is a campus lost-and-found application I built to make reports easier to connect while keeping ownership verification in human hands. Students can post lost or found items with photos, and the app ranks opposite-type reports using explainable category, location, date, and text signals, with Gemini as an additional assessment and a rules-based fallback. A possible match is not proof: the finder reviews a claim, and contact details are only shown after approval. I also built in-app notifications, admin analytics and moderation, and Docker and GitHub Actions configuration. The API is Express with MongoDB, and the client is React.”

## Two-minute explanation

“CampusFind addresses a simple but frustrating campus problem: lost and found reports are often scattered, hard to search, and difficult to connect. I built a React single-page client and an Express JSON API backed by MongoDB and Mongoose. The browser handles the user experience; the API owns validation, authorization, business rules, and integrations. Docker Compose serves the production frontend through Nginx and keeps the API on a private network, while MongoDB remains an external service.

Students register as students and sign in with a JWT. Passwords are bcrypt-hashed. On protected requests the API loads the current user from MongoDB, so the database role and account status control access; the browser’s protected routes are only a usability layer. Students can create, search, update, and resolve lost or found reports, with optional Cloudinary images and a Gemini description assistant. AI suggestions are structured and validated, and the user reviews them before applying.

For matching, the server first compares opposite-type active reports using category, location token overlap, date proximity, and shared title/description terms. It ranks a bounded set and can ask Gemini to assess the best candidates. The final score blends heuristic and Gemini scores when available; if Gemini fails, the heuristic score remains. The result is still only a candidate.

For found items, a student can submit a claim. The owner or an admin can approve or reject it, and the claimant can cancel. Approval resolves the item and closes other pending claims. Email addresses are withheld from ordinary item and claim views; an approved participant can access the other participant’s contact through a separate API. In-app notifications keep both sides informed.

Admins see aggregate analytics and can review reports, hide listings, or suspend accounts. Moderation scoring prioritizes human review and does not take automatic action. The repository also has Dockerfiles, Compose/Nginx configuration, and a GitHub Actions workflow. The test suites mock external services, so they validate application rules but do not represent a live deployment or measured real-world match accuracy.”

## Architecture and security talking points

```text
React / Vite browser
  └── Axios API client + auth context + protected-route UX
        └── Express API: routes → middleware → controllers/services
              ├── Mongoose models and MongoDB
              ├── Gemini (description and candidate assessment)
              └── Cloudinary (item images)
```

- **Authentication:** bcrypt password hashes; signed bearer JWT; protected middleware reads the user from MongoDB on each request. Role claims in the token are not authoritative.
- **Authorization:** endpoint checks use current user identity, role, item ownership, claim participation, or notification recipient as appropriate. UI route protection does not replace API checks.
- **Validation:** Zod request/output validation, allow-listed filters/sorts, bounded pagination, Multer limits, declared MIME checks, and image signature checks.
- **Privacy:** item and pre-approval claim projections omit email. A dedicated approved-claim endpoint allows contact access to authorized participants. Analytics return aggregate counts.
- **Resilience:** Gemini failures fall back to deterministic match scoring; notification writes and Cloudinary cleanup are best-effort. Report creation and item CRUD do not require Gemini.
- **Moderation:** deterministic signals rank report priority; admins make the decision. Account suspension checks current database status, cascades to active workflows, and preserves history.
- **Deployment boundary:** Docker Compose routes browser `/api` requests through Nginx to the private API service. MongoDB is external. CI builds but does not push or deploy.

## Interview questions and concise answers

### Project understanding

**1. Why did you build CampusFind, and what problem does it solve?**  
It gives a campus community one place to publish and search lost/found reports, connect likely pairs, and process ownership claims with controlled contact sharing. The matching assists discovery; people still verify ownership.

**2. What was your role and the hardest engineering problem?**  
Describe your actual contribution. A defensible technical challenge in this codebase is coordinating the workflow boundaries: a candidate match must not reveal contact data, and simultaneous claims must not result in multiple approvals. Explain the specific implementation you worked on rather than claiming sole ownership of every feature.

### React and API

**3. Why React and Vite?**  
React supports reusable pages and components for forms, claims, notifications, and admin views. Vite provides the client development server and production build. The application uses React Router and context for auth/toast state.

**4. How are protected routes implemented? Are they a security boundary?**  
`ProtectedRoute` uses the client’s auth state to guide navigation and hide admin screens from non-admin users. It is only UX. The Express API independently authenticates requests and checks roles, ownership, and participant access.

**5. How are state and API calls handled?**  
Auth and toast state use React context. The Axios service attaches the bearer token and centralizes API calls. Page/component state handles local form, query, and loading state; forms use React Hook Form with Zod schemas.

### Node, Express, and MongoDB

**6. What does Express middleware do here, and how are errors handled?**  
Middleware composes request processing: security/CORS/body parsing, authentication, role checks, upload/rate limits, then routes. Async handlers forward failures to a centralized error handler that returns controlled API errors and avoids leaking database details in production.

**7. Why MongoDB and Mongoose?**  
The app stores related report and workflow documents with flexible image/history fields and uses Mongoose models, indexes, validation, and references. MongoDB aggregation is used for admin analytics. This is the project’s implementation choice, not a claim that document storage is always superior to relational modeling.

**8. What are the main collections and how are references handled?**  
Users own Items; Matches refer to two items; Claims refer to an item, claimant, and owner; Notifications refer to recipients and related records; Reports point at moderation targets. Mongoose refs are populated selectively, and responses are projected/serialized to avoid exposing private fields.

**9. Where are aggregation pipelines used?**  
The admin analytics service aggregates item totals, lost-item recovery ratio, UTC-week activity, categories, and normalized lost-item locations. It returns aggregate values, not item descriptions or personal details.

### Authentication and security

**10. How does authentication and RBAC work?**  
Registration hashes the password with bcrypt and always assigns the student role. Login signs a JWT. Protected middleware validates the token, loads the current user, rejects inactive accounts, and role middleware checks the database role for admin routes.

**11. How does the app prevent IDOR and protect contact data?**  
Controllers/services scope reads and writes to the authenticated owner, claimant, item owner, notification recipient, or admin as required. Contact data is only returned by the dedicated endpoint after an approved claim and after participant/admin authorization.

**12. How are passwords, provider keys, and AI responses protected?**  
Passwords are bcrypt hashes and excluded from safe user projections. Gemini and Cloudinary secrets are server environment variables, not browser variables. Gemini structured responses are validated with Zod before use; no AI output is treated as trusted ownership evidence.

**13. What other security controls are present, and what is a limitation?**  
The API uses Helmet, exact CORS origins, request size limits, validation, rate limits, safe projections, and sanitized production errors. Rate limits are process-local. The client stores JWTs in `localStorage`, so a same-origin XSS could expose a token; a cookie design needs CSRF analysis.

### Gemini and matching

**14. Why Gemini, and why call it from the backend?**  
It drafts descriptions and assesses a small number of promising match candidates. The backend keeps the API key private, constrains inputs/outputs, and can apply fallback behavior without trusting the browser to enforce those rules.

**15. How does matching work, and why combine rules with AI?**  
The rules score category (25), location (up to 20), date (up to 25), and text overlap (up to 30), then filter and rank the opposite item type. Gemini assesses up to 10 top candidates. With valid AI output the configured default blend is 40% heuristic and 60% Gemini; otherwise it uses the heuristic score. Rules provide explainable evidence and a fallback; AI contributes contextual assessment.

**16. How are duplicate matches prevented, and does a high score mean recovered?**  
An unordered key for the item pair has a unique index, and upserts reuse that pair. A high score only surfaces a candidate for review. The owner must review a claim and verify ownership; the app does not measure AI accuracy or infer recovery from the score.

### Claims, moderation, and delivery

**17. How does the claim state machine prevent duplicate or competing approvals?**  
Pending claims can be approved/rejected by the owner/admin or cancelled by the claimant. A partial unique index allows one pending claim per claimant/item pair. Approval conditionally resolves only an active item; other pending claims are then rejected. The item’s active-state check is the single-winner gate, and the implementation does not assume MongoDB transactions.

**18. How does moderation flagging work, and why not auto-suspend?**  
Deterministic report-count, reporter-frequency, and reason signals raise priority for human review. Auto-flagging does not hide or suspend; an admin reviews evidence and chooses an action. This keeps noisy signals from directly penalizing a user.

**19. What do Docker, Nginx, and CI do?**  
Docker uses a production dependency API image and a multi-stage client build served by Nginx. Nginx serves the SPA and proxies `/api` to the backend container over the private Compose network. GitHub Actions runs installs, lint, backend/frontend tests, frontend build, Compose validation, and container builds; it does not deploy.

**20. Why Supertest/Vitest, and is Jest used?**  
The backend uses Node’s built-in test runner with Supertest for HTTP-level API tests. The client uses Vitest and React Testing Library. Jest is not configured in this repository. The suites mock MongoDB and external providers, and coverage is not configured.

## Common “why this choice?” prompts

- **MongoDB over SQL:** The implementation uses MongoDB documents and Mongoose references/indexes for reports and workflow records, with aggregation pipelines for analytics. In a system requiring extensive cross-record transactions or relational constraints, I would reevaluate the choice.
- **JWT over server sessions:** The API accepts bearer tokens and checks current user state in MongoDB. This fits the existing separate client/API setup, though localStorage has an XSS tradeoff; HttpOnly cookies and CSRF controls are a possible improvement.
- **React / Express:** React provides reusable client components and routing; Express composes the API middleware and route handlers with a small, explicit service layer.
- **Gemini:** It adds optional natural-language drafting and candidate assessment. It is constrained and non-authoritative; standard reporting and heuristic matching still have a path when it is unavailable.
- **Cloudinary:** It stores report images outside the API container. The server validates files and stores the returned URL/public ID; cleanup is best-effort.
- **Docker / GitHub Actions:** Docker makes the client/API runtime layout reproducible. Actions automates the checks and image builds on pushes and pull requests without deploying.
- **Mongo aggregation / Zod:** Aggregation computes admin summaries close to the data; Zod gives explicit runtime validation for untrusted input and model output.
- **Testing libraries:** Node test runner + Supertest cover API behavior, while Vitest + Testing Library cover UI behavior. Jest is not used.

## Common trick questions

**“If Gemini says the items match, is the item recovered?”**  
No. It is a suggested candidate, not proof. A claimant submits a claim, and the found-item owner or admin reviews it. The app records a recovery-like state only when the claim is approved and the item is resolved.

**“What happens if Gemini is down?”**  
Description assistance returns a controlled failure and the report form remains usable. Matching catches assessment failures and retains its heuristic score and signals.

**“Can a student access admin APIs by changing the URL?”**  
No. Hiding the admin route in React is not the control; the API loads the current user and requires the database role to be admin.

**“Can a suspended user keep using an old JWT?”**  
The token can remain cryptographically unexpired, but protected requests load the current account and reject an inactive user. Login also rejects inactive users.

**“Why not show the owner’s email on the item?”**  
Public item views should support discovery without exposing personal contact information. The dedicated contact route releases email only after an approved claim and an authorization check.

**“Why not use AI for everything?”**  
Deterministic signals are inspectable and continue to work when Gemini is unavailable. AI is useful as an extra assessment, but can be wrong and should not control claims, contact disclosure, or moderation actions by itself.

## Demo checklist

Use two student accounts and a trusted admin account in a seeded/local database. Gemini and Cloudinary are optional for a reduced demo; explain when a step is unavailable due to missing credentials.

1. Register/sign in and show the dashboard.
2. Create a lost report; add images if Cloudinary is configured.
3. Show the optional description helper, review its suggestion, and apply it only deliberately.
4. Create a complementary found report with matching category/location/date/description details.
5. Open the report owner’s detail page and show the candidate/evidence. Mention matching runs in the background and may take time.
6. From the claimant account, submit a claim to the found item.
7. As the owner, review and approve or reject it; show the resulting notification and item status.
8. Before approval, show that emails are absent. After approval, show the authorized contact view with the approved participant account.
9. Show notification read state and the admin analytics aggregates.
10. Submit an eligible report and review it as admin; demonstrate report priority and reversible item hiding if appropriate.
11. Demonstrate account suspension only in a safe local environment; explain current-token rejection and last-admin protection.
12. Show Dockerfiles, Compose proxy layout, and CI workflow. If Docker is unavailable, present the configuration without claiming a successful image build.

## Hardest part and improvement answer

**“What would you improve with more time?”**

“I’d first move background match generation and rate-limit state to durable shared infrastructure so multiple API instances can process work consistently. I’d add operational observability and a production-grade session review, including an HttpOnly cookie option with CSRF protection. Then I’d evaluate semantic or image similarity against a labeled dataset before making any accuracy claims. Email or push notifications could improve follow-up. Those are future improvements; this implementation uses in-process match scheduling, process-local limits, in-app notifications, and text/category/location/date matching.”

Other future ideas: a mobile client, richer analytics, caching, and more advanced moderation review tooling. None of these are represented as implemented features.
