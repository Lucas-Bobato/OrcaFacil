# NEEDS VALIDATION — OrcaFacil run-1

Prioritized leads without severity. Not confirmed vulnerabilities. Source: findings.json at commit 2b304d1.

## Anonymous signup and login run bcryptjs on the shared event loop with no rate or concurrency limit

Fingerprint: `apps/api/auth:bcryptjs-main-thread-without-rate-limit`

An anonymous client can send small POST /api/auth/cadastro requests with fresh emails, or POST /api/auth/login requests naming any existing account, and each one forces a cost-10 bcrypt computation. bcryptjs is pure JavaScript and runs on the same thread that serves every other request. Yielding through setImmediate lets other work interleave but does not reduce total CPU, and nothing in the repository caps request rate or concurrent hashes. Source predicts that enough concurrent or sustained traffic degrades API latency for all accounts. The rate needed and the severity of the degradation have not been measured. Signup also leaves a persistent usuario row per successful request, with no email verification step on this path. The latency impact should end when traffic stops, while those rows remain until an operator removes them.

**Claimed root cause:** Expensive password hashing runs before any rate or concurrency gate, on the single thread that serves all tenants, because the API uses a main-thread JavaScript bcrypt and configures no limiter, worker pool or per-identity or per-IP budget.

**Source trace**

- entrypoint: `apps/api/src/routes.ts:20` (POST /auth/cadastro): Anonymous route with no auth or limiter middleware; POST /auth/login at line 23 has the same shape.
- propagation: `apps/api/src/app.ts:29` (criarApp): The 100 KB JSON body limit bounds request size but not request frequency; helmet and cors on lines 27-28 do not limit rate, and no rate limiter is mounted.
- propagation: `apps/api/src/services/authService.ts:31` (authService.cadastrar): A valid signup with an unused email reaches bcrypt.hash at cost 10 and then a persistent insert; line 40 runs bcrypt.compare in login for any existing account.
- sink: `node_modules/bcryptjs/index.js:993` (_crypt next): Key-schedule rounds run in JavaScript on the main thread; the loop yields through setImmediate only when a slice exceeds about 100 ms or the rounds finish.

**Evidence**

- `apps/api/src/app.ts:27`: Lines 27-29 mount helmet, cors and express.json as the global middleware; the only other mounts before the API routes are the Swagger docs and OpenAPI JSON on lines 31-34. None is a rate limiter.
- `apps/api/src/services/authService.ts:40`: Unknown emails short-circuit before bcrypt, so login needs a known account; this is the strongest source-visible control, and anonymous signup at line 31 provides such an account.
- `apps/api/src/services/authService.ts:26`: An already-used email returns 409 before hashing, so signup hashing requires a fresh email for each request; this adds no meaningful cost because no verification or quota limits new addresses.
- `node_modules/bcryptjs/index.js:995`: The loop breaks when a slice exceeds MAX_EXECUTION_TIME so it can yield, which shares the same thread rather than offloading the work.
- `node_modules/bcryptjs/index.js:529`: MAX_EXECUTION_TIME is 100 ms, so a single uninterrupted slice can occupy the event loop for about that long.
- `node_modules/bcryptjs/index.js:335`: The yield mechanism is setImmediate on the same event loop.
- `apps/api/src/server.ts:16`: A single process listens, with no cluster, worker or connection limits configured in the repository.
- `packages/shared/src/schemas.ts:37`: Signup bounds the password to 72 characters, but no schema limits how often hashing is requested.

**Blockers**

- no-os-sandbox: target code may not be executed on this host
- Measured CPU per bcrypt on the deployment host is not source-visible, so the request rate needed for shared impact is unknown.
- Upstream rate limiting or WAF behaviour on the API host is not in the repository (ADR-006 only names candidate hosts).

**Validation plan**

- Local: In an approved sandbox with no external network and strict CPU, memory and time limits, use criarContexto() from apps/api/tests/helpers.ts with dummy data and create one account with criarConta. Because supertest shares the process and event loop with the app, also record event-loop delay with perf_hooks monitorEventLoopDelay, or send requests from a separate client process over loopback. Time one GET /api/health as a baseline, then again while 1, 2 and 4 concurrent POST /api/auth/login requests with the dummy account and a wrong password are in flight. Stop at 4. Expected: 401 responses, health latency and event-loop delay grow with in-flight hashes, and no 429 is ever returned. Also confirm a POST with an unknown email returns 401 quickly, showing the short circuit. Regression test after the fix: repeated login and signup attempts receive 429 once the budget is spent, and hashing no longer runs on the main thread or is capped by a concurrency limit.
- Owner-observed: The owner checks whether the production host, proxy or WAF applies request-rate limits to /api/auth/login and /api/auth/cadastro, and records vCPU allocation and whether the API runs one instance. Do not load-test production.

## Login has no application-level limit on password guesses against an account

Fingerprint: `apps/api/auth:login-no-attempt-limit`

An anonymous client who knows or guesses an account email can keep submitting passwords to POST /api/auth/login. The application never counts failures, locks an account, or adds backoff. Its signup policy only requires 8 to 72 characters, so dictionary-style passwords such as the seed's demo1234 are accepted. Guessing speed is limited only by bcrypt cost 10, the network, and any upstream control, so the application does not cap the total guesses over time. A correct guess returns a normal session. That session exposes the account's data, including the profile and client personal data where they exist, and allows irreversible account deletion with no re-authentication. This root cause is separate from bcrypt event-loop availability: moving bcrypt off the event loop or capping concurrency would not bound guesses against one account over time. A reverse proxy or hosting platform could mitigate this, but the repository contains no such configuration, so whether a deployed limit exists is unknown. Runtime behavior was not observed in this run; the claim rests on source review.

**Claimed root cause:** The credential check in authService.entrar has no per-account or per-source attempt state, no limiter middleware is attached to the app or the login route, and the signup policy does not reject weak passwords.

**Source trace**

- entrypoint: `apps/api/src/routes.ts:23` (POST /api/auth/login): The anonymous route, mounted under /api, has no auth or limiter middleware.
- propagation: `apps/api/src/services/authService.ts:37` (authService.entrar): loginSchema checks only the shape of email and senha.
- propagation: `apps/api/src/services/authService.ts:38` (authService.entrar): The user is loaded by email, and the row has no attempt or lock state.
- propagation: `apps/api/src/services/authService.ts:40` (authService.entrar): bcrypt.compare runs on every attempt against an existing account. On failure, line 41 throws a 401 and nothing is recorded.
- sink: `apps/api/src/services/authService.ts:43` (authService.entrar): A correct guess returns a normal session token for the victim's account.

**Evidence**

- `apps/api/src/app.ts:27`: The global middleware on lines 27-29 is helmet, cors and express.json. No limiter is present before the routes are mounted on line 35.
- `apps/api/src/repositories/usuarios.ts:4`: UsuarioRow has only id, email, senha_hash and criado_em, with no failed-attempt, lock or last-failure field.
- `apps/api/src/db/migrations/001_inicial.sql:6`: The usuario table has the same four columns, so no attempt state is persisted.
- `packages/shared/src/schemas.ts:37`: The signup password policy is length 8 to 72 only, with no blocklist or strength check.
- `apps/api/src/db/seed.ts:16`: The seed registers the dictionary-style password demo1234 through authService.cadastrar, which shows that the policy accepts it.
- `apps/api/src/routes.ts:29`: The resulting session can call DELETE /conta with no re-authentication. The account routes on lines 20-32 include no password-change route, so the source offers no way to rotate a guessed password.
- `apps/api/src/services/authService.ts:26`: Signup answers 409 EMAIL_EM_USO for an existing email, so an attacker can check that a target email has an account even though login errors are uniform.
- `docs/adr/ADR-006-api-rest-sqlite-contas.md:45`: The API is intended for a service such as Render, Railway or Fly.io. The repository has no proxy or platform configuration, so any upstream rate limit is not source-visible.

**Blockers**

- no-os-sandbox: target code may not be executed on this host
- Whether a reverse proxy or platform applies a login rate limit in the deployment is not source-visible.

**Validation plan**

- Local: In an approved sandbox, write one test using apps/api/tests/helpers.ts: call criarContexto(), then criarConta(ctx, 'alvo@teste.com') with its default password senha1234. Send 10 sequential POST /api/auth/login requests with distinct wrong dummy passwords and assert each returns 401 with erro.codigo CREDENCIAIS_INVALIDAS and none returns 429. Then send the correct password and assert 200 with a token that passes GET /api/auth/me. Keep the count at 10 and do not stress the service. Regression case: after a limiter is added, attempts past the chosen threshold for that account return 429, while a different account can still log in. If the fix uses a hard per-account lock, also decide and test how it avoids letting a third party lock out the victim.
- Owner-observed: The owner reviews their own proxy or hosting configuration, without sending guessing traffic to a live service, for a rate rule on POST /api/auth/login. They confirm that it applies per account as well as per IP and that it uses a trustworthy client address. The app sets no Express trust proxy value, so any app-level per-IP limiter added behind a proxy must configure it.

## Anonymous clients can determine whether an email has an account

Fingerprint: `apps/api/authService:account-existence-oracle`

The comment at authService.ts:39 states that login uses the same message for an unknown email and a wrong password so that it does not reveal existing accounts. Two paths still disclose existence. First, POST /api/auth/cadastro returns 409 EMAIL_EM_USO with a field message for a registered email once the schema accepts the body (valid email, password of 8-72 characters). This is visible in source and pinned by an existing test, and docs/06-api.md and openapi.yaml document it as API behavior. The signup path is not side-effect free: for an unused email the same request creates a persistent account and returns a token, so a probe of an unregistered address leaves a record. Second, POST /api/auth/login returns identical 401 bodies but calls bcrypt.compare only when the user exists, so an unknown email is predicted to respond faster. That path has no side effect, but its size and remote observability have not been measured. The application has no rate limiter, and whether a deployment proxy adds one is not visible in the repository. The predicted result is disclosure of account existence for a chosen email, and nothing more. No password, hash, or account data is exposed: the publico function strips senhaHash from the returned user. No login bypass follows from this alone.

**Claimed root cause:** Signup reports email uniqueness directly to an unauthenticated caller, and login short-circuits before the password hash comparison for unknown emails, so the login comment's non-disclosure goal is not applied across all doors to the same identity.

**Source trace**

- entrypoint: `apps/api/src/routes.ts:20` (POST /auth/cadastro): An anonymous client submits a chosen email and a schema-valid password; the route has no authentication middleware and is mounted under /api.
- propagation: `apps/api/src/services/authService.ts:26` (authService.cadastrar): After schema parsing, the service looks up the normalized email with no authentication.
- sink: `apps/api/src/services/authService.ts:27` (authService.cadastrar): A distinct 409 EMAIL_EM_USO error is raised for an existing account, and the error handler returns its code and field message to the caller.

**Evidence**

- `apps/api/src/services/authService.ts:39`: The comment states that login uses the same message for an unknown email and a wrong password so that it does not reveal existing accounts.
- `apps/api/src/services/authService.ts:40`: The short-circuit skips bcrypt.compare for an unknown email, which is the source of the predicted timing difference; the 401 at line 41 is identical on both branches.
- `apps/api/src/services/authService.ts:31`: For an unused email, signup hashes the password and creates the account at lines 31-33, so a signup probe of an unregistered address has a persistent side effect.
- `apps/api/src/middleware/error.ts:32`: The error handler serializes the AppError code, message, and extra field details into the response body.
- `apps/api/tests/auth-perfil.test.ts:27`: The existing test at lines 27-32 pins the 409 EMAIL_EM_USO response for a registered email, including a case variant of it.
- `packages/shared/src/schemas.ts:37`: The signup password must be 8-72 characters; because parsing precedes the lookup, an invalid body gets 400 and does not reach the oracle.
- `docs/06-api.md:75`: EMAIL_EM_USO is documented as a normal 409 API result (also apps/api/openapi.yaml:19), so the signup disclosure is a documented behavior that conflicts with the login comment's stated goal.
- `apps/api/src/app.ts:24`: The middleware chain at lines 24-39 contains no rate limiter, and a repository search found none elsewhere in the source.

**Blockers**

- no-os-sandbox: target code may not be executed on this host
- The size and remote observability of the login timing difference require a runtime measurement; the signup 409 path does not depend on this measurement.

**Validation plan**

- Local: In an approved OS-enforced sandbox, write a vitest test using apps/api/tests/helpers.ts: criarContexto (in-memory SQLite) and criarConta with a dummy account such as registrado@teste.com. POST /api/auth/cadastro with the registered email and senha1234 and expect 409 EMAIL_EM_USO. POST it with an unused dummy email and expect 201. Then send 10 POST /api/auth/login requests each, interleaved after one discarded warm-up request, for the registered email with a wrong password and for an unknown email. Expect identical 401 bodies, and compare median latency; the source predicts a clearly higher median for the registered email, since bcrypt is not mocked and the stored hash has cost 10. A regression test for the login path should perform a comparison against a fixed dummy hash on the unknown-email branch and assert that medians no longer separate. The signup disclosure needs a separate product decision, because the application has no outbound email channel for a uniform signup response; rate limiting would reduce bulk probing but would not remove the signal.
- Owner-observed: Owner-observed and non-destructive, on an environment the owner controls, using only the owner's own dummy account: check whether the proxy or platform in front of the API applies per-IP limits to /api/auth/cadastro and /api/auth/login. Check this by reviewing the proxy configuration and, if a request test is wanted, by sending a small bounded number of login requests with a wrong password for that dummy account. Do not probe signup with unregistered addresses on a production database, because each 201 creates an account. Record the login latency medians only if the owner wants to assess remote observability.

## Session tokens stay valid after logout and cannot be revoked by the user

Fingerprint: `apps/api/authService:jwt-no-server-side-revocation`

Logout in the web client only removes the browser's token and clears local state. The API has no logout, revocation, password-change or password-reset route, and verification keeps no session state, so a copy of a token obtained before logout keeps working until exp, which is 7 days by default and configurable through JWT_EXPIRES_IN. The predicted boundary result is that a token captured before logout is still accepted afterwards. Because every protected route uses the same middleware, the holder keeps the full account capability: reading profile, clients, quotes and PDFs, changing data, and irreversibly deleting the account through DELETE /api/conta. A user who suspects exposure can end the session only by deleting the whole account; the operator can invalidate tokens only for all users, by rotating JWT_SECRET. The attacker must already hold a copy of the token. This flaw extends that access and does not grant it. Source review found no token-leak path: the web source has no raw HTML sink, the API has no request logger, and logout removes the stored copy from a shared device. Token exposure is therefore a precondition, not something this candidate demonstrates.

**Claimed root cause:** Authentication is purely stateless: tokens carry only sub, iat and exp, with no jti, token version or session record, so the server has nothing to invalidate, and logout is implemented only on the client.

**Source trace**

- entrypoint: `apps/api/src/routes.ts:26` (GET /auth/me): A network client replays a copied Bearer token to a protected route after the user has logged out. This route is the minimal example; the other protected routes use the same middleware.
- propagation: `apps/api/src/middleware/auth.ts:25` (autenticar): The Bearer value is passed directly to verification, with no session or revocation lookup.
- propagation: `apps/api/src/services/authService.ts:50` (verificar): jwt.verify checks signature and expiry only, and logout leaves no server-side state that could affect the result.
- sink: `apps/api/src/services/authService.ts:56` (verificar): The user is returned as authenticated, because the only post-signature check at line 54 is that the user exists, so the replayed token is accepted.

**Evidence**

- `apps/web/src/pages/MeuPerfil.tsx:131`: The logout button calls sair directly.
- `apps/web/src/auth/AuthContext.tsx:28`: sair runs only tokenStorage.limpar, setToken(null) and qc.clear, with no server call.
- `apps/api/src/routes.ts:20`: The account routes at lines 20-32 are signup, login, me and delete only. The rest of the router, lines 35-106, has profile, client and quote routes and no logout or credential change.
- `apps/api/openapi.yaml:89`: The documented auth and account paths are /auth/cadastro, /auth/login, /auth/me and /conta, which matches the router: no logout, revocation or password path is documented.
- `apps/api/src/services/authService.ts:17`: jwt.sign receives an empty payload with subject and expiresIn only, so the token has no revocable identifier.
- `apps/api/src/services/authService.ts:54`: The only post-signature check is user existence, which rejects deleted accounts but not logged-out sessions.
- `apps/api/tests/auth-perfil.test.ts:64`: An existing test expects 401 for a token after account deletion. No test covers logout, because the API has no logout operation.
- `apps/api/src/config.ts:16`: Token lifetime comes from JWT_EXPIRES_IN and defaults to 7d, and server.ts:12 passes it to criarApp.
- `node_modules/jsonwebtoken/verify.js:185`: The library enforces exp by default, so the exposure is bounded by the configured token lifetime.
- `apps/api/src/routes.ts:29`: DELETE /conta requires only the same Bearer authentication, with no password re-entry, so a retained token can also delete the account irreversibly.

**Blockers**

- no-os-sandbox: target code may not be executed on this host

**Validation plan**

- Local: Inside an approved OS-enforced sandbox, write a vitest test using apps/api/tests/helpers.ts criarContexto and criarConta with dummy data. Keep the returned Authorization header and model logout by performing no server action, because the source shows logout makes no API call. Call GET /api/auth/me again with the stored header; the source predicts 200 with the same user. As a control, call DELETE /api/conta and confirm the same header then returns 401, as auth-perfil.test.ts:64 does. Stop there. A regression test for a fix should expect 401 for the old header after a new server logout or revocation route is called, while a separately issued session follows the chosen revocation semantics.
- Owner-observed: Without replaying any token, the owner reads the deployed JWT_EXPIRES_IN value to establish the real exposure window; if unset, it is 7 days. This sets the window only and does not change the source-derived behavior.

## API accepts forged tokens signed with a committed secret when production mode or a real secret is not configured

Fingerprint: `apps/api/config:jwt-secret-committed-fallback`

If the API runs without NODE_ENV=production and without JWT_SECRET, it signs and verifies sessions with a literal committed in config.ts. If apps/api/.env was copied from .env.example (README section 6, whose comment calls this optional in development), and the API then starts with NODE_ENV=production and no JWT_SECRET in the process environment, the committed placeholder satisfies the presence-only guard. Anyone who knows the committed value can then sign an HS256/HS384/HS512 token that jwt.verify accepts, including one with no exp. Unsigned tokens are still rejected. Impact is limited by the per-request user lookup: the attacker must know the victim's random UUID. Source review found no response that exposes another user's id: public user fields are id, email and criadoEm for the caller only, and the professional mapper omits usuario_id. Blind forgery against an arbitrary account is therefore not predicted. The predicted boundary result is that a forged token for a known id, for example the sub read from an old or expired token, authenticates as that user with no expiry and reaches that account's data. This is predicted from source and has not been observed. The documented production command at README.md:151 supplies its own secret and is not affected if the operator uses a strong value. No deployment is shown to use either committed value.

**Claimed root cause:** The secret guard is conditional on NODE_ENV and checks presence only, while config.ts supplies a committed fallback and .env.example supplies a committed placeholder. Nothing rejects known values at startup.

**Source trace**

- entrypoint: `apps/api/src/routes.ts:26` (GET /auth/me): A protected route accepts a client-supplied bearer token through the auth middleware.
- propagation: `apps/api/src/middleware/auth.ts:25` (autenticar): The token and the configured secret are passed to authService.verificar.
- propagation: `apps/api/src/config.ts:15` (config.jwtSecret): The secret resolves to the committed literal when JWT_SECRET is unset, which the guard only permits outside production.
- propagation: `apps/api/src/services/authService.ts:50` (verificar): jwt.verify, with no pinned algorithm, issuer or audience, accepts any token HMAC-signed with that key and returns its sub.
- sink: `apps/api/src/services/authService.ts:54` (verificar): The attacker-chosen sub selects the user that becomes res.locals.usuario, provided that id exists.

**Evidence**

- `apps/api/src/config.ts:8`: The guard requires production mode and checks only that JWT_SECRET is non-empty.
- `apps/api/src/config.ts:15`: Committed fallback secret literal.
- `apps/api/.env.example:8`: Committed placeholder secret that passes the presence-only guard. The comment on line 7 tells operators to use a long random value in production.
- `README.md:124`: Install instructions copy .env.example to .env. The comment on line 123 marks this as optional in development.
- `README.md:151`: The documented production command sets NODE_ENV=production and an explicit JWT_SECRET placeholder for the operator to replace.
- `apps/api/package.json:8`: The start script loads .env when it exists. The root start script delegates to this workspace (package.json:17).
- `apps/api/src/server.ts:11`: The running server uses config.jwtSecret directly.
- `node_modules/jsonwebtoken/verify.js:185`: exp is only checked when present, so a forged token without exp does not expire.
- `node_modules/jsonwebtoken/verify.js:108`: A token with no signature is rejected when a secret is configured, so the forgery requires knowing the key.
- `apps/api/src/services/authService.ts:31`: User ids are randomUUID values, which limits forgery to ids the attacker already knows.
- `apps/api/src/services/authService.ts:14`: Public user objects expose id only in the caller's own auth responses.
- `apps/api/src/repositories/profissionais.ts:16`: The professional mapper omits usuario_id, so profile responses do not reveal the owning user's id.

**Blockers**

- no-os-sandbox: target code may not be executed on this host
- The deployed NODE_ENV and JWT_SECRET values are not source-visible, so it is unknown whether any deployment uses a committed value.
- The repository's public visibility is not established from source, although README.md:119 and the git origin name a GitHub URL. The committed values are known at least to anyone with repository read access.

**Validation plan**

- Local: In a sandboxed vitest file, unset JWT_SECRET with NODE_ENV=test, reset modules, import apps/api/src/config.ts and assert jwtSecret equals the literal at config.ts:15. Build an app with criarApp({db, jwtSecret: literal}) using abrirBanco(':memory:') and migrar as in apps/api/tests/helpers.ts criarContexto. Register a dummy account and read usuario.id. Sign jwt.sign({}, literal, {subject: id}) with no expiry and call GET /api/auth/me. The source predicts 200 with the dummy account's email. As controls, a token for a random unknown UUID and an unsigned token should both return 401. Then set NODE_ENV=production and JWT_SECRET=troque-este-segredo, reset modules, and confirm the config import does not throw.
- Owner-observed: The owner checks each deployment's process configuration, without printing the secret, and confirms NODE_ENV=production and that the SHA-256 of JWT_SECRET differs from the SHA-256 of both committed values. Rotate the secret if either matches. The owner also confirms whether the repository is publicly readable.

## One free account can repeatedly run PDF rendering on the event loop shared by all tenants

Fingerprint: `apps/api/emitir:pdf-render-on-event-loop-without-concurrency-gate`

Any client can sign up without verification, create a profile and one complete quote, then replay POST /api/orcamentos/:id/emitir with no body. Each call runs pdfmake layout, per-document font parsing, font subsetting, synchronous deflate, SHA-256 and a blocking better-sqlite3 transaction on the main thread of the one API process that source defines. Source shows no rate limit, per-account or global concurrency gate, queue, worker or deadline, and nothing in the path observes a client disconnect, so work already dispatched is not cancelled. Layout and page rendering run in one synchronous turn. Final font subsetting runs later in a promise continuation, also on the main thread, so a render may not be a single uninterrupted block, but other requests, including /api/health, wait during each blocked period. If per-render CPU time is significant relative to the request rate, one account could occupy much of the process's CPU time and raise latency for all users. That magnitude is unmeasured. Per-request work is bounded, so any effect requires sustained volume. It lasts while requests continue and should recover when they stop, apart from the BLOB rows each call leaves behind, which are tracked under apps/api/emitir:unbounded-documento_pdf-retention. Severity depends on the measured render time and on deployed gateway limits and replica count.

**Claimed root cause:** emitir runs CPU-bound rendering in-process on the main thread, with no worker isolation and no per-account or global admission control, and re-emission is unconditionally allowed. Tenant-controlled request volume therefore drives event-loop occupancy shared by all tenants, to a degree that has not been measured.

**Source trace**

- entrypoint: `apps/api/src/routes.ts:96` (POST /orcamentos/:id/emitir): An authenticated route guarded only by auth and profile checks awaits orcamentoService.emitir, with no rate or concurrency middleware.
- propagation: `apps/api/src/services/orcamentoService.ts:256` (orcamentoService.emitir): After the completeness check at line 249, which ignores current status and prior emissions, the service calls gerarPdf on every request.
- propagation: `apps/api/src/pdf/gerarPdf.ts:205` (gerarPdf): The module-level printer's createPdfKitDocument is called synchronously on the main thread. doc.end() at line 211 then triggers finalization on the same thread.
- sink: `node_modules/pdfmake/src/printer.js:162` (PdfPrinter.createPdfKitDocument): layoutDocument, followed by renderPages at line 180, runs in the same synchronous turn, so other requests on the event loop wait until the call returns. How long this lasts is unmeasured.

**Evidence**

- `apps/api/src/app.ts:29`: The only generic request-size control is the 100 KB JSON body limit, which is irrelevant because emitir needs no body. The middleware chain at lines 27-37 has no limiter or concurrency control.
- `apps/api/src/server.ts:16`: A single app.listen in one process, with no cluster or worker setup and no server timeout configuration. A search of apps/api found no limiter, worker, cluster, timeout or AbortSignal use.
- `apps/api/package.json:8`: The start script runs one tsx process on server.ts, and the repository defines no supervisor or multi-instance setup.
- `apps/api/src/services/authService.ts:31`: Signup creates an account directly after schema validation and the duplicate-email check, with no email verification, so the path is reachable from an anonymous starting point.
- `apps/api/src/services/orcamentoService.ts:249`: The only precondition is completeness of the quote. Nothing rejects a quote that is already EMITIDO and unchanged.
- `apps/api/tests/orcamentos.test.ts:247`: The test suite re-emits a quote with no request body as intended behavior, after an edit returned it to RASCUNHO. Line 259 shows the same flow. The tests do not cover replay of an unchanged EMITIDO quote, which the absence of a status check at orcamentoService.ts line 249 permits.
- `node_modules/pdfmake/src/printer.js:153`: A new FontProvider is built for each document, and provideFont (fontProvider.js line 62) loads the fonts into that pdfkit document, so font work recurs on every call.
- `node_modules/@foliojs-fork/pdfkit/js/pdfkit.js:2869`: Each font load into a new document parses the font buffer through fontkit.create. The cache at line 2935 is per document. Base64 decoding itself happens only once, at module load (gerarPdf.ts line 24).
- `node_modules/@foliojs-fork/pdfkit/js/pdfkit.js:238`: PDF references are compressed with zlib.deflateSync, which is synchronous on the main thread.
- `node_modules/@foliojs-fork/pdfkit/js/pdfkit.js:2727`: Font subsetting and encoding run in-process through encodeStream, with no worker.
- `node_modules/@foliojs-fork/fontkit/index.js:29841`: The subset encode runs in a promise continuation after doc.end(), not inside the synchronous createPdfKitDocument turn. It remains on the main thread, but a render is not proven to be one uninterrupted block.
- `apps/api/src/services/orcamentoService.ts:272`: The BLOB insert and status update run through blocking better-sqlite3 on the same thread, with the SHA-256 at line 278 inside the transaction, on the single connection opened at apps/api/src/db/connection.ts line 17.
- `packages/shared/src/orcamento.ts:5`: LIMITE_ITENS = 50, enforced at orcamentoService.ts line 192, together with text limits such as schemas.ts lines 101, 141 and 142, bounds per-call work. Impact therefore requires sustained repetition rather than one oversized request.

**Blockers**

- no-os-sandbox: target code may not be executed on this host
- Per-render event-loop block time is unmeasured, and it decides whether the shared effect is meaningful at a modest request rate
- The deployed gateway or proxy rate limits, replica count, CPU allocation and health-probe restart policy are not source-visible

**Validation plan**

- Local: Inside an OS-enforced sandbox with no network, low CPU, memory and wall-clock limits, and dummy data only, write a vitest fixture using criarContexto(), criarContaComPerfil() and criarOrcamentoCompleto(ctx, auth, itens) from apps/api/tests/helpers.ts. Pass 50 dummy items, each with a 120-character description, then PUT /api/orcamentos/:id with a 500-character condicoesPagamento and a 1000-character observacoes, because the helper does not set those fields. Start perf_hooks.monitorEventLoopDelay, then run 5 sequential POST /api/orcamentos/:id/emitir calls and record each duration and the maximum loop delay. Record an idle baseline for GET /api/health and for GET /api/auth/me from a second dummy account. Then send 4 concurrent emitir calls while issuing those same two requests once each, and record their latency. Stop there and do not ramp up load. Separately, start the app on an ephemeral loopback port, send one emitir with node:http, destroy the socket right after dispatch, wait for the work to settle, and check through ctx.db whether a new documento_pdf row appeared. Count the shared effect as demonstrated only if the second account's latency measurably tracks the render queue and the measured block time is material against the idle baseline, and report the measured values. If renders are short enough that the added latency is negligible, downgrade this to hardening. A regression test for a fix must show a 429 or queue rejection beyond the configured per-account concurrency, and bounded health latency during rendering.
- Owner-observed: The owner should check, without load-testing production, whether any proxy or gateway in front of the API rate-limits POST /api/orcamentos/*/emitir per account or IP, how many API replicas share the persistent SQLite disk (likely one), what CPU allocation the process has, and whether a health probe on /api/health can restart the process when latency rises.

## Repeating emitir appends superseded PDF BLOBs to the shared database without any aggregate limit

Fingerprint: `apps/api/emitir:unbounded-documento_pdf-retention`

Any account with a profile and one complete quote can repeat POST /api/orcamentos/:id/emitir with no body. Each call regenerates the PDF and inserts a new BLOB row, even if the quote is already EMITIDO and nothing changed. The 3 MB check applies per file only. No API route or query reads a superseded row's content, because both documentosRepo readers select only the newest row, and RF12 only asks to download the last PDF again. The database file is shared by all tenants, so source predicts that sustained calls grow it until the volume fills or the operator intervenes. Writes for every account would then be expected to fail, although this has not been observed. Each call also spends main-thread CPU on PDF layout. The attacker can free the space by deleting the quote or account, and an operator can delete rows with SQL. No other source-visible recovery exists. With auto_vacuum unset and the bundled SQLite build not overriding the default, freed pages are reused but the file does not shrink without VACUUM. Signup is unlimited in source, so accounts can multiply this, and duplicating quotes also yields more quotes to emit. The fill rate is unknown because stored bytes per emission have not been measured and are probably far below the 3 MB cap for typical content. The UI does show 'Gerar PDF' on an EMITIDO quote, and re-emission can legitimately change the output, since the emission date and current profile data are re-read. The defect is therefore the missing budget and retention rule, not re-emission itself.

**Claimed root cause:** PDF snapshots have only a per-object size limit. No per-quote or per-account storage budget, retention rule, or rate limit applies to emitir, and nothing deletes superseded rows. The documents do not clearly require deletion: RN10 says the prior PDF stays in history until a new one is generated, while docs/05-modelagem-dados.md models 1:0..N PDFs per quote. The missing aggregate bound on a shared store is the root cause, not a clear breach of RN10. Removing superseded rows alone would not close the issue, because quote and account counts are also unbounded.

**Source trace**

- entrypoint: `apps/api/src/routes.ts:96` (POST /orcamentos/:id/emitir): Route guarded by auth and profile middleware only. It reads no body, and no rate limiter exists in the app or route chain.
- propagation: `apps/api/src/services/orcamentoService.ts:249` (orcamentoService.emitir): The only precondition is completeness; current status and unchanged content are not checked, so an EMITIDO quote passes again.
- propagation: `apps/api/src/services/orcamentoService.ts:256` (orcamentoService.emitir): The PDF is regenerated on each call; line 268 enforces only the per-file 3 MB limit.
- propagation: `apps/api/src/services/orcamentoService.ts:273` (orcamentoService.emitir): A new documento_pdf row is inserted in the transaction, with no deletion of prior rows and no aggregate check.
- sink: `apps/api/src/repositories/orcamentos.ts:259` (documentosRepo.inserir): The BLOB is persisted in the single SQLite database used for all accounts.

**Evidence**

- `apps/api/src/db/migrations/001_inicial.sql:83`: The size CHECK applies per row; the table at lines 79-87 has no UNIQUE on orcamento_id and nothing bounds rows per quote.
- `apps/api/src/repositories/orcamentos.ts:247`: conteudoAtual selects only the newest row with LIMIT 1. The sibling reader atual at line 237 does the same, and a search of apps/api finds no other content read, so superseded BLOBs cannot be retrieved through the API.
- `docs/01-requisitos-funcionais.md:27`: RF12 specifies downloading the last PDF again, so the requirements name no use for retrieving older snapshots.
- `docs/01-requisitos-funcionais.md:146`: RN10 keeps the prior PDF in history until a new one is generated. This suggests but does not clearly require removal, and it sets no storage bound.
- `docs/05-modelagem-dados.md:107`: The data model documents 1:0..N PDFs per quote, each emission generating one, which shows accumulation is an accepted design rather than an accident. It sets no bound.
- `apps/api/tests/orcamentos.test.ts:250`: The test asserts two rows after re-emission, so accumulation is current behaviour. It covers re-emission after an edit, not an unchanged repeat.
- `apps/api/src/db/connection.ts:18`: Only WAL and foreign_keys pragmas are set at lines 18-19. No max_page_count or auto_vacuum appears in apps/api.
- `node_modules/better-sqlite3/deps/defines.gypi:13`: The bundled SQLite compile defines (lines 5-40) set no default auto_vacuum or maximum page count, so nothing in the build adds a cap or automatic shrink.
- `apps/web/src/pages/Revisar.tsx:113`: The EMITIDO banner shares the page with the enabled 'Gerar PDF' button (lines 99-109), so an unchanged re-emission is a reachable product flow, not only an API-level one.
- `apps/api/src/services/orcamentoService.ts:179`: duplicar adds up to 51 small rows per POST (one quote and up to 50 items) with no quote-count limit. It stores no BLOB itself, but it supplies more quotes to emit, so a per-quote retention fix alone would not bound storage.

**Blockers**

- no-os-sandbox: target code may not be executed on this host
- Actual stored size per emission (bounded by 50 items and the text limits, with embedded Roboto fonts) and achievable emission rate have not been measured, so calls-to-fill and time-to-fill cannot be stated.
- Production disk size, upstream rate limiting, monitoring and operator recovery process are not in the repository.

**Validation plan**

- Local: In an approved sandbox with strict disk, CPU and time limits, use criarContexto(), criarContaComPerfil() and criarOrcamentoCompleto() from apps/api/tests/helpers.ts with dummy data. POST /api/orcamentos/:id/emitir 3 times with no edits between calls and stop. Expected: 200 each time; SELECT COUNT(*), SUM(tamanho_bytes) FROM documento_pdf WHERE orcamento_id = ? returns 3 rows and the total bytes; GET /api/orcamentos/:id/pdf returns only the newest. Record bytes per call and elapsed time once for a 50-item fixture with maximum-length text. Regression tests after the fix: after any re-emission, superseded rows for that quote are removed or held within a stated retention bound; a re-emission after a profile change or on a later date still produces a new current PDF; and an account over its aggregate byte budget receives a 4xx, including when it spreads emissions across duplicated quotes.
- Owner-observed: The owner checks the API volume size, any upstream rate limit on the API, free-space alerting, whether disk-full recovery is documented, and current per-account row counts and bytes in documento_pdf using a read-only operator query. Do not fill a production volume.

## Unpaginated client and quote lists run synchronously over rows with no per-account limit

Fingerprint: `apps/api/listagens:unpaginated-sync-list-without-row-quota`

An account can create clients and quotes without a count limit, then request GET /api/clientes or GET /api/orcamentos. Each request reads all of the account's matching rows into memory through synchronous better-sqlite3, maps them to objects, runs the JS normalizar callback per scanned row when busca is set, and serialises the whole array. All of this happens on the single thread of the single API process that serves every tenant. Source predicts per-request blocking and memory that grow linearly with the requester's stored rows, delaying other accounts during each request, and memory pressure if the row count is large enough. The rows persist until the owner deletes them, so a small GET can be repeated at low cost after setup. Setup needs one POST per row and an account with a profile, although signup is open and no rate limiter exists in the repository. Queries are correctly scoped to the requester's profissional_id, so the shared effect is availability only and no cross-tenant read is involved. The cost is linear, not superlinear. The row count at which the stall becomes material, and any resulting process failure, is predicted from source and has not been observed.

**Claimed root cause:** List endpoints have no pagination or result cap, and the data model has no per-account row budget, while the database driver and JSON serialisation are synchronous on the shared event loop.

**Source trace**

- entrypoint: `apps/api/src/routes.ts:44` (GET /clientes): Authenticated list requiring a token and a profile, with optional busca and no page or limit parameter. GET /orcamentos at line 63 has the same shape, with busca and status filters.
- propagation: `apps/api/src/services/clienteService.ts:9` (clienteService.listar): Only busca is forwarded and no cap is applied. orcamentoService.listar at line 77 likewise passes only busca and status.
- propagation: `apps/api/src/db/connection.ts:21` (abrirBanco): normalizar is a JS callback that runs on the main thread for each of the account's scanned rows when busca is set. Its cost per row is linear in a name of at most 80 characters, so it multiplies the list cost by a constant factor.
- sink: `apps/api/src/repositories/clientes.ts:33` (clientesRepo.listar): .all() materialises every matching row synchronously (line 34 is the equivalent without busca), and line 35 maps them. orcamentos.ts:106 does the same for quotes before the routes serialise the full array with res.json.

**Evidence**

- `apps/api/src/repositories/clientes.ts:34`: The query has no LIMIT and returns all of the account's rows ordered by name.
- `apps/api/src/repositories/orcamentos.ts:105`: The quote list query has no LIMIT. It selects o.* and c.nome plus an EXISTS on documento_pdf, so PDF BLOBs are not materialised and each quote row is small.
- `apps/api/src/services/clienteService.ts:21`: Client creation inserts with no count check against the account.
- `apps/api/src/services/orcamentoService.ts:101`: Quote creation inserts with no count check against the account, and it accepts an empty body with no client.
- `packages/shared/src/numeracao.ts:7`: formatarNumero only pads to four digits and does not cap the sequence. The numero CHECK at 001_inicial.sql:45 ends in a wildcard, so the quote numbering does not implicitly bound the row count.
- `apps/api/src/db/migrations/001_inicial.sql:31`: The schema bounds field length per row, not the number of rows per profissional. This is the strongest source-visible control, and it bounds row size only.
- `apps/api/src/app.ts:29`: The 100 KB JSON limit bounds each request body, not the accumulated rows or the list response size. No rate-limiting middleware is present in the assembled app, and a repository search found no limiter.
- `apps/api/src/server.ts:16`: The API starts one listener in one process, with no cluster or worker use found in the API source, so a stalled event loop affects every tenant served by that process.

**Blockers**

- no-os-sandbox: target code may not be executed on this host
- The row count at which blocking becomes material depends on host CPU and heap limits, and has not been measured.
- Upstream write-rate limits that would slow row accumulation are outside the repository.

**Validation plan**

- Local: In an approved sandbox with strict CPU, memory and time limits, use criarContexto() and criarContaComPerfil() from apps/api/tests/helpers.ts. Read the dummy account's id with ctx.db (SELECT id FROM profissional) and seed dummy cliente rows directly through ctx.db, using dummy values at the schema's maximum field lengths, at growth points of 1,000, 5,000 and 10,000, and stop there. At each point, time GET /api/clientes and GET /api/clientes?busca=a once, record body length, and record the event-loop delay during the request with perf_hooks.monitorEventLoopDelay. Repeat the row seeding for dummy orcamento rows and time GET /api/orcamentos once at each point. Expected: every row is returned, time and size grow about linearly, and a page or limit query parameter does not change the response. Report the measured per-row cost and treat any larger row count as extrapolation only. Regression test after the fix: responses never exceed the page cap, and creation over the per-account budget returns a 4xx.
- Owner-observed: The owner checks whether a proxy or platform applies write-rate limits to POST /api/clientes and POST /api/orcamentos, what heap and CPU the API instance has, whether a supervisor restarts it, and the current maximum rows per profissional using a read-only operator query such as SELECT profissional_id, COUNT(*) FROM cliente GROUP BY profissional_id ORDER BY 2 DESC LIMIT 5, plus the same query on orcamento. Do not stress production.

## Logout or account switch in one tab leaves the previous account's cached quotes, PDF and profile form usable in another open tab under narrower conditions

Fingerprint: `apps/web/AuthContext:no-cross-tab-session-sync`

Logout, login and account deletion update auth state and clear the React Query cache only in the acting tab. A second open tab keeps autenticado=true and its in-memory cache. Source narrows the hunters' claims in three ways.

1) Logout with no new login: tab B does not generally keep showing data. Once a stale /perfil query refetches without a token, it gets 401 NAO_AUTENTICADO and the query status becomes error. ExigePerfil (App.tsx:26) then replaces every /, /orcamentos/:id/* route with an error card, and MeuPerfil (line 71) hides its form the same way. That refetch fires on visibilitychange, or when a usePerfil observer mounts, if the data is older than the 10 s staleTime. Data therefore stays visible only while no such refetch has happened: tab B is in a window that stays visible, so no visibilitychange fires, or its /perfil data is under 10 s old, or the browser is offline, which is the query library's default network mode and was not traced here. Tab B also never redirects to /entrar in this case.

2) Account switch: if a second account with a profile logs in through tab A, tab B's /perfil refetch succeeds and the gate reopens. On /orcamentos/:id/*, the first account's quote then stays rendered, including the client's name, address, phone and email, because comum.tsx:21 renders retained consulta.data even after the refetch error. The cached PDF blob (staleTime Infinity) can still be downloaded with no request. The preview's professional block then shows the new account's profile, so the first account's CPF/CNPJ appears there only before the /perfil refetch; the PDF file itself is the first account's. After the gate has closed, this data can return when the gate reopens, as long as the query has not been garbage-collected (default gcTime; not read in this review).

3) Cross-account write: tab B's profile form can save the first account's values into the second account. This happens only if the user presses Save and either the second account has no profile (perfil.data null, so the form is not reset, MeuPerfil.tsx:36) or no refetch has occurred. If the second account has a profile and a refetch ran, the form resets to that account's data. Quote and client writes from stale ids should be rejected, because the lookup is scoped by tenant (orcamentoService.ts:41-42).

The attacker must use the same browser profile while the old tab is still open, and the exposure ends on reload or tab close because there is no persister. No server authorization is bypassed. This is a limited local-exposure and data-integrity issue.

**Claimed root cause:** AuthProvider reads the shared localStorage token once at mount and clears only its own tab's QueryClient, and no storage or BroadcastChannel listener exists, while requests read the current shared token each time. Cache keys are not scoped by account, client.ts treats only SESSAO_INVALIDA with a sent token as session loss, and comum.tsx and PdfPronto.tsx render or use retained query data after a refetch error. The ExigePerfil error gate limits this only incidentally.

**Source trace**

- entrypoint: `apps/web/src/pages/MeuPerfil.tsx:131` (MeuPerfil 'Sair da conta' in tab A): The user logs out in tab A. Privacidade.tsx:15 reaches the same sair after account deletion. The later actor is another person using the same browser profile.
- propagation: `apps/web/src/auth/AuthContext.tsx:29` (AuthProvider.sair in tab A): sair removes the origin-wide token. Its qc.clear at line 31 reaches only tab A's QueryClient.
- propagation: `apps/web/src/auth/AuthContext.tsx:17` (AuthProvider in tab B): Tab B read token state once at mount, and nothing updates it when storage changes.
- propagation: `apps/web/src/api/client.ts:51` (requisitar in tab B): Each request reads the current shared token, which is now missing or belongs to the account that logged in through tab A.
- propagation: `apps/web/src/api/client.ts:73` (requisitar in tab B): Client logout runs only when a token was sent and the code is SESSAO_INVALIDA. A no-token 401 NAO_AUTENTICADO or a 404 under the new token leaves tab B's auth state and cache untouched.
- propagation: `apps/web/src/App.tsx:19` (ExigeLogin in tab B): The guard keeps rendering protected routes from stale autenticado state. ExigePerfil at line 26 is the only gate left, and it opens again when the /perfil refetch succeeds under the new account's token.
- propagation: `node_modules/@tanstack/query-core/src/query.ts:987` (Query reducer error case): A failed refetch sets status to error while ...state at line 980 keeps the existing data.
- propagation: `apps/web/src/pages/comum.tsx:21` (ComOrcamento in tab B): The page renders consulta.data before checking the error state, so the first account's quote stays rendered after the second account's refetch fails.
- sink: `apps/web/src/pages/PdfPronto.tsx:40` (Pronto.baixar in tab B): The cached PDF blob, held with staleTime Infinity at line 35, can be saved through salvarArquivo with no API request.

**Evidence**

- `apps/web/src/main.tsx:11`: The QueryClient is in-memory per tab with no persister. Line 14 sets staleTime to 10 s, and the 4xx rule at line 16 means a 401 or 404 is not retried.
- `apps/web/src/auth/AuthContext.tsx:21`: iniciarSessao clears only the acting tab's cache on login, and sair at line 31 does the same on logout.
- `apps/api/src/middleware/auth.ts:23`: A request without a bearer token gets 401 NAO_AUTENTICADO, not SESSAO_INVALIDA. auth-perfil.test.ts:47 asserts this code.
- `apps/web/src/App.tsx:26`: Mitigating control the hunters omitted: perfil.isError replaces the Outlet with an error card, including on a background refetch error with retained data. No-token refetches therefore hide quote and PDF routes.
- `apps/web/src/pages/MeuPerfil.tsx:71`: perfil.isError hides the profile form after a no-token refetch, so tab B's form is not shown once the /perfil refetch fails.
- `apps/web/src/pages/MeuPerfil.tsx:36`: The form resets only when perfil.data is truthy. A null result for an account with no profile leaves the first account's values in the form, and a non-null result replaces them.
- `apps/web/src/api/hooks.ts:39`: Profile saves go to the account of whichever token is stored, whatever account's data the form displays. perfilService.ts:18-24 creates or updates that account's profile.
- `node_modules/@tanstack/query-core/src/focusManager.ts:28`: The installed version 5.104.3 listens only to visibilitychange, not window focus. A window that stays visible therefore gets no focus refetch, and a stale hidden tab refetches when shown (queryObserver.ts:153-158).
- `apps/web/src/pages/PdfPronto.tsx:35`: staleTime Infinity keeps the PDF blob fresh, so it is never refetched under the new token.
- `apps/web/src/components/PreviaPdf.tsx:40`: The preview renders the client's name, and line 41 renders address, phone and email from the cached quote. The CPF/CNPJ at line 28 comes from the separately refetched perfil query.
- `apps/api/src/services/orcamentoService.ts:42`: The quote lookup is scoped by profissionalId, so the second account's token should not read the first account's quote. Only the client-side cache keeps it visible.
- `apps/web/src/components/Dialogo.tsx:11`: A search of apps/web/src found this keydown listener as the only addEventListener, and no BroadcastChannel or storage listener.

**Blockers**

- no-os-sandbox: target code may not be executed on this host
- Source settles the render logic, but the real browser sequence still needs observation: storage sharing between pages, visibilitychange and mount-triggered refetch timing, how long data stays on screen before the ExigePerfil gate closes, and whether the gate reopens on retained data after an account switch.

**Validation plan**

- Local: In an approved sandbox, use only dummy accounts and a disposable local database. First use apps/api/tests/helpers.ts criarContexto() with supertest to confirm that GET /api/perfil without Authorization returns 401 NAO_AUTENTICADO and that GET /api/orcamentos/<A's id> with dummy account B's token returns 404.

Then run the existing Playwright setup with local API and web servers, using two pages in one BrowserContext.

Case 1, logout: log in as A, create and issue a quote with a dummy client, and open /orcamentos/<id>/pdf in page 2 until the PDF is ready. Log out in page 1 through /perfil. Without changing page 2's visibility, confirm it still shows the dummy client's name. Wait more than 10 s and dispatch a real visibility change by bringing page 2 back from hidden, or navigate inside it. The source predicts the error card with 'Entre na sua conta para continuar', no client text, and no redirect to /entrar.

Case 2, account switch: log in as B, who has a profile, in page 1, and refocus page 2 or use 'Tentar novamente'. The source predicts /perfil returns 200, GET /orcamentos/<id> returns 404, A's client name stays displayed, the preview header shows B's profile, and 'Baixar' saves A's PDF with no new /pdf request.

Case 3, profile form: with page 2 on /perfil showing A's data, log out and sign up a new dummy account C with no profile in page 1, refocus page 2, and press Save. The source predicts C's profile receives A's dummy values. Repeat with B, who has a profile: after a refetch the form should show B's values, and A's values should be written only if Save is pressed before any refetch.

Regression test for a fix: after logout or a login with a different identity in page 1, page 2 clears its cache and leaves the previous identity's screens, and no private text from the previous account remains.

## Irreversible account deletion page has no source-visible frame protection

Fingerprint: `apps/web:privacidade-delete-account-no-frame-protection`

If the deployed web page sets no frame protection, an attacker's page could frame /privacidade and trick a logged-in user into the two clicks that delete the account and all its data. The repository tracks no hosting configuration and the app has no client-side framing defence. The action needs no re-authentication. Reachability is limited and unproven: the session lives only in localStorage, so a browser that partitions third-party storage should show a cross-site frame as logged out and redirect it to /entrar, which stops the attack. Remaining exposure is same-site framing, which requires control of a page on the same registrable site, or a browser that does not partition storage, which may include older versions in the project's support matrix. None of this has been observed at runtime.

**Claimed root cause:** The web deployment configuration that would set X-Frame-Options or CSP frame-ancestors is absent from the repository, the app has no client-side framing defence, and the destructive action relies only on two clicks with no re-authentication or typed confirmation.

**Source trace**

- entrypoint: `apps/web/src/App.tsx:45` (App routes): An attacker's page can use /privacidade as an iframe URL, subject to deployed headers. The route renders only if the ExigeLogin guard at line 19 finds a token.
- propagation: `apps/web/src/auth/AuthContext.tsx:17` (AuthProvider): Session state is read only from localStorage, so a framed page is authenticated only if its storage partition holds the token.
- propagation: `apps/web/src/pages/Privacidade.tsx:41` (Privacidade): The first click on 'Apagar todos os meus dados' opens the confirmation dialog.
- propagation: `apps/web/src/components/Dialogo.tsx:59` (Confirmacao): The second click on 'Apagar tudo' confirms. This is the first button in the panel, so line 12 focuses it and Enter or Space can also confirm once the frame has focus.
- propagation: `apps/web/src/api/client.ts:52` (requisitar): The bearer token from storage is attached to DELETE /conta, sent by the mutation at Privacidade.tsx line 15.
- sink: `apps/api/src/routes.ts:30` (DELETE /conta): The account is deleted with only a valid bearer token and no re-authentication.

**Evidence**

- `apps/web/index.html:3`: The document head has no CSP or framing control, and a meta CSP could not set frame-ancestors anyway.
- `docs/adr/ADR-005-hospedagem-vercel.md:26`: A vercel.json with security headers is planned, but git ls-files at 2b304d1 lists no vercel.json, _headers, netlify.toml or proxy configuration.
- `docs/adr/ADR-005-hospedagem-vercel.md:27`: The planned initial domain is orcafacil.vercel.app. vercel.app is a public suffix, so other vercel.app projects should be cross-site. Same-site framing therefore becomes relevant mainly with a custom domain.
- `docs/02-requisitos-nao-funcionais.md:64`: The RNF20 header target lists CSP default-src 'self', nosniff and Referrer-Policy. frame-ancestors does not fall back to default-src and no X-Frame-Options is listed, so meeting this target would not block framing.
- `docs/02-requisitos-nao-funcionais.md:72`: RNF23 supports Chrome Android 110 or later and Samsung Internet 21 or later. These floors may predate default third-party storage partitioning, so the localStorage limit cannot be assumed across the supported range and needs browser observation.
- `apps/api/src/app.ts:27`: Helmet's default X-Frame-Options applies to API responses only (node_modules/helmet/index.mjs lines 473-476). The API does not serve the app's pages (its only HTML is Swagger UI at /api/docs, line 31), and the static web bundle deploys separately (README.md line 154).
- `apps/web/src/api/client.ts:22`: The token is read from localStorage with no cookie or requestStorageAccess call, which is the strongest visible limit on framed reachability.
- `apps/web/src/pages/Privacidade.tsx:15`: The delete mutation sends no password or other proof of intent.

**Blockers**

- no-os-sandbox: target code may not be executed on this host
- Deployed response headers for /privacidade (X-Frame-Options, CSP frame-ancestors) are not source-visible because no hosting configuration is tracked.
- Whether a framed page can read the first-party token depends on the browser's third-party storage partitioning and on whether the framing origin is same-site; this requires a browser observation across the supported browser range.

**Validation plan**

- Local: In an approved sandbox only, with no external network and dummy data. API step: use apps/api/tests/helpers.ts, call criarContexto() and criarConta(), send DELETE /api/conta with only the returned Authorization header, expect 204, then expect 401 from GET /api/auth/me with the same header. Browser step: run a local web build with vite preview at http://localhost:4173, proxied to a local API with a dummy account and a throwaway database, and log in first-party. Serve a test page containing an iframe to http://localhost:4173/privacidade from http://127.0.0.1:8080 (cross-site), then from http://localhost:8080 (same-site, cross-origin). In each case record the browser name and version and whether the frame renders the authenticated page or redirects to /entrar. Test the current browser and, where available, the RNF23 floor versions. Only if the frame is authenticated, click both buttons and confirm the dummy account is deleted, then stop. Regression cases: the framing test is refused once frame protection is added, and DELETE /api/conta fails without the current password once the server requires it.
- Owner-observed: The owner inspects, without performing any deletion, the response headers of their own deployed /privacidade page, and confirms whether the SPA fallback path returns X-Frame-Options: DENY or CSP frame-ancestors 'none'. The check covers production and any preview deployment that holds real sessions. If a custom domain is used, the owner also lists sibling subdomains on that registrable site, because those could frame the app same-site with shared storage.
