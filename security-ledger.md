# Security ledger

Checklist: the project's 20-item full-stack security checklist (SC-01 to SC-20).
Every "Pass" for an applicable check is backed by an automated test in
`backend/tests/` (run with `npm test`) or a CI step in `.github/workflows/ci.yml`.

Last full review: 2026-10-11, on version 2.0.0.

## Ledger

| Check ID | Result | Files/sections covered | Last checked | Open issues |
|---|---|---|---|---|
| SC-01 | Pass | `routes/*.js` (zod schemas), `middleware/validate.js`, `db.js` (`sanitizeFilter`), `routes/tasks.js` `ownedFilter()` | 2026-10-11 | 0 |
| SC-02 | Pass | All `frontend/src` components (React escaping, no raw HTML), `app.js` (helmet CSP) | 2026-10-11 | 0 |
| SC-03 | Pass | `middleware/csrf.js`, `app.js` (`csrf.protect` on all `/api` routes), `lib/api.js` | 2026-10-11 | 0 |
| SC-04 | Not applicable | No file uploads anywhere | 2026-10-11 | 0 |
| SC-05 | Pass | `routes/tasks.js` (every query scoped by `owner`), `routes/account.js` | 2026-10-11 | 0 |
| SC-06 | Pass | `middleware/rateLimit.js`, `app.js`, `routes/auth.js`, `routes/account.js` | 2026-10-11 | 0 |
| SC-07 | Pass | `config.js` (secret validation), `middleware/session.js` (HS256 pinned, issuer, expiry, token version) | 2026-10-11 | 0 |
| SC-08 | Pass | `frontend/src/**`, `frontend/.env.example`, `backend/.env.example` | 2026-10-11 | 0 |
| SC-09 | Pass | `lib/passwords.js`, `routes/auth.js`, `routes/account.js` | 2026-10-11 | 0 |
| SC-10 | Pass | `lib/mfa.js`, `routes/account.js` (`/mfa/*`), `routes/auth.js` (`/login`), `SettingsPanel.jsx`, `AuthPage.jsx` | 2026-10-11 | 0 |
| SC-11 | Pass | `app.js` (CORS allow-list), `config.js` (`*` refused) | 2026-10-11 | 0 |
| SC-12 | Pass | `middleware/session.js` (httpOnly cookie), `frontend/src/lib/api.js`, `lib/auth.jsx`, `lib/theme.js` | 2026-10-11 | 0 |
| SC-13 | Pass | `app.js`, `routes/tasks.js`, `routes/account.js` (`requireAuth` on every protected route) | 2026-10-11 | 0 |
| SC-14 | Not applicable | MongoDB is only reached by the server; no client has direct DB access | 2026-10-11 | 0 |
| SC-15 | Not applicable | No webhook endpoints | 2026-10-11 | 0 |
| SC-16 | Not applicable | The server makes no outbound HTTP requests | 2026-10-11 | 0 |
| SC-17 | Pass | `frontend/vite.config.js` (`sourcemap: false`), `.gitignore`, CI source-map check | 2026-10-11 | 0 |
| SC-18 | Pass | `config.js`, `backend/.env.example`, `.github/workflows/ci.yml` | 2026-10-11 | 0 |
| SC-19 | Pass | `middleware/requestLog.js`, `middleware/errors.js`, `server.js`, `lib/logger.js` | 2026-10-11 | 0 |
| SC-20 | Pass | `package-lock.json` (root workspace): `npm audit` and `npm audit --omit=dev` report 0 | 2026-10-11 | 0 |

## Findings in the original project (v1) and how they were resolved

| Check | Severity | Original issue | Resolution |
|---|---|---|---|
| SC-05 | Critical | `/api/v2/getTasks/:id`, `updateTask/:id`, `deleteTask/:id` trusted any user ID from the URL or body, so anyone could read, edit or delete any user's tasks. | Server-side sessions; every task query is filtered by `owner: req.user._id`. Foreign IDs return 404. |
| SC-13 | Critical | No authentication on any task route; "logged in" was a user ID in `sessionStorage`. | `requireAuth` middleware on all task and account routes. |
| SC-07 | Critical | No session tokens at all. | Signed HS256 JWT, algorithm pinned, issuer and expiry checked, revocable via token version; secret must be 32+ random chars from the environment. |
| SC-18 | Critical | MongoDB URI hard-coded in `conn/conn.js`. | All configuration from environment; app refuses to start on missing or placeholder secrets. |
| SC-20 | High | 11 backend and 111 frontend known vulnerabilities (Create React App). | Migrated to Vite; dependencies updated; 0 reported. |
| SC-17 | Low | Committed `frontend/build/` contained `.map` files exposing source. | Build folder removed from git, source maps disabled, CI check. |
| SC-11 | Medium | `cors()` allowed every origin. | Explicit allow-list from `CLIENT_ORIGIN`; `*` refused. |
| SC-06 | Medium | No rate limiting on sign-in or sign-up. | General API limiter plus strict limiter on auth, password and 2FA routes. |
| SC-01 | Critical | `findOne({ email: req.body.email })` accepted objects such as `{"$ne": null}`. | Zod validation on every body; `sanitizeFilter` enabled. |
| SC-12 | High | User identifier stored in `sessionStorage` and used as the credential. | Session only in an httpOnly, SameSite cookie; nothing auth-related in browser storage. |
| SC-03 | High | Not applicable in v1 (no cookie auth); applies now. | Signed double-submit CSRF token required on every state-changing request, including login. |
| SC-10 | Medium | No MFA. | Optional TOTP with QR setup, replay protection and 8 hashed single-use recovery codes. |
| SC-19 | Medium | `console.log(error)` and `console.log(response)` dumped full objects. | Access log limited to method, path, status and duration; no bodies, headers, cookies or query strings. |

---

# Security Status: PASS

## Summary
- Critical: 0
- High: 0
- Medium: 0
- Low: 0

## Check Results
| ID | Check | Result | Notes |
|---|---|---|---|
| SC-01 | Check for SQL injection | Pass | Zod rejects non-string fields; `sanitizeFilter` on; IDs validated. Test: `auth.test.js` "query injection", `tasks.test.js` malformed IDs. |
| SC-02 | Block cross-site scripting | Pass | React escaping only, no raw HTML; helmet CSP `default-src 'self'`. Test: `hardening.test.js` headers. |
| SC-03 | Add CSRF protection | Pass | Signed double-submit token on all POST/PATCH/DELETE. Test: `auth.test.js` "CSRF protection" (4 cases). |
| SC-04 | Validate file uploads | Not applicable | No file uploads. |
| SC-05 | Fix broken object-level authorization | Pass | All task queries scoped to owner. Test: `tasks.test.js` "object-level authorization" (5 cases). |
| SC-06 | Add rate limiting | Pass | 300 req/15 min per IP on the API; 10 per 15 min on auth routes. Test: `hardening.test.js` "rate limiting". |
| SC-07 | Secure JWT secrets | Pass | Env-only 32+ char secret, HS256 pinned, expiry, revocation. Test: `auth.test.js` "JWT handling", `hardening.test.js` config. |
| SC-08 | Keep API secrets server-side | Pass | Frontend holds no keys or secrets; only an optional public API URL. |
| SC-09 | Hash passwords securely | Pass | bcrypt cost 12, 72-byte limit enforced, dummy-hash timing equalisation. Test: `auth.test.js` SC-09. |
| SC-10 | Add multi-factor authentication | Pass | Optional TOTP + recovery codes, replay-protected. Test: `mfa.test.js`; also verified in a real browser. |
| SC-11 | Tighten CORS settings | Pass | Allow-list with credentials; unknown origins get no CORS headers. Test: `hardening.test.js` "CORS". |
| SC-12 | Remove auth tokens from local storage | Pass | httpOnly cookie; token never in a response body; `localStorage` holds only the theme. Test: `auth.test.js` SC-12. |
| SC-13 | Enforce permissions server-side | Pass | `requireAuth` on every protected route; no client-side-only gating. Test: `tasks.test.js` "require a session". |
| SC-14 | Enable row-level security | Not applicable | MongoDB is server-only; clients never query the database directly. |
| SC-15 | Verify webhook signatures | Not applicable | No webhook endpoints. |
| SC-16 | Check for SSRF | Not applicable | No server-side outbound requests. |
| SC-17 | Remove exposed source maps | Pass | `sourcemap: false`; `frontend/dist` git-ignored; CI fails if any `.map` is built. |
| SC-18 | Change default credentials | Pass | No credentials in code or examples; placeholder secrets rejected at startup. CI's MongoDB is a throwaway container bound to 127.0.0.1 with test data only. |
| SC-19 | Keep sensitive data out of logs | Pass | Logs contain method, path, status, duration and server error messages only. Test: `hardening.test.js` "logging". |
| SC-20 | Update vulnerable dependencies | Pass | `npm audit` and `npm audit --omit=dev`: 0 vulnerabilities (2026-10-11). Re-checked in CI on every push. |

## Required Fixes
None.

## Files Requiring Changes
None.

## Notes for deployment (not checklist failures)
- The rate limiter keeps counts in memory, so limits are per server instance and reset on restart. That is fine for a single instance; use a shared store (e.g. Redis) if you run several.
- If your MongoDB is reachable from a network (not just localhost), enable authentication with a unique, strong password, or use MongoDB Atlas.
- Set `TRUST_PROXY=1` when running behind a reverse proxy so rate limiting sees real client IPs.
- Tests were run against FerretDB (a MongoDB-compatible server) during development. CI runs them against real MongoDB 7.
