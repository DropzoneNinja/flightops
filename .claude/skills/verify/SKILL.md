---
name: verify
description: How to drive the flightops backend/frontend stack locally to verify a change end-to-end
---

# Verifying flightops backend changes

## Stack

`docker compose` runs 3 containers: `flightops-postgres`, `flightops-backend`, `flightops-frontend`.

- **Backend has no host port mapping** (by design — production only exposes it inside the Docker network via nginx). You cannot `curl localhost:3000` from the host.
- **Frontend's nginx** is the only way in from the host: `http://localhost:5174` (or whatever `FRONTEND_PORT` is), proxying `location /api/ { proxy_pass http://backend:3000/; }` — hit `http://localhost:5174/api/<route>`, not `/api/health` on the backend port directly.
- The running containers here use the **production build** (`node dist/main`, image built from `backend/Dockerfile` via `docker-compose.override.yml` for arm64), not `docker-compose.dev.yml`'s hot-reload setup — there is no source volume mount. **Source edits require a rebuild + restart**, they don't hot-reload:
  ```bash
  docker compose build backend && docker compose up -d backend
  ```
  Watch `docker logs flightops-backend --tail 20` for `Nest application successfully started` before testing.

## Making requests to the backend

- `curl` isn't installed in the backend container, but `wget` (busybox) and `node` are. `wget` doesn't preserve the response body on non-2xx status — for a 4xx/5xx body, use Node's `http` module inline instead (see anything using this skill for a snippet), or just curl through nginx from the host (`localhost:5174/api/...`) where curl works fine and sees the real body regardless of status.

## Database

- Despite `POSTGRES_DB`/compose defaults suggesting `flightops`, the actual dev database is **`flightops_dev`** (check `docker exec flightops-backend printenv DATABASE_NAME` if unsure). `psql -U flightops -d flightops` will connect but find zero tables — always pass `-d flightops_dev`.
  ```bash
  docker exec flightops-postgres psql -U flightops -d flightops_dev -c "..."
  ```
- This is real local dev data (test users, real uploaded flights/media) — if a test needs a temporary mutation (e.g. linking a media row to a flight to test a code path), do it with an explicit `UPDATE`, verify, then `UPDATE` it back immediately. Don't leave test mutations in place.

## Authenticating as a specific user without their password

You won't have test users' passwords. Mint a JWT directly instead — same shape the backend itself produces (`{ sub: user.id, email }`, HS256, signed with `JWT_SECRET`):

```bash
docker exec flightops-backend printenv JWT_SECRET   # e.g. dev-secret-key-change-in-production
docker exec flightops-postgres psql -U flightops -d flightops_dev -t -c "select id, email from users limit 5;"
docker exec flightops-backend node -e "
  const jwt = require('jsonwebtoken');
  console.log(jwt.sign({ sub: '<user-id>', email: '<email>' }, '<JWT_SECRET>', { expiresIn: '1h' }));
"
```
Then `curl -H "Authorization: Bearer <token>" http://localhost:5174/api/...`. The `JwtStrategy` does a live DB lookup on `sub`, so the user ID must be real.

## Gotchas encountered

- `app.enableCors()` has no `allowedHeaders`/`exposedHeaders` by default — a custom response header (e.g. `X-API-Version`) is present on the wire but invisible to browser `fetch`/`XHR` JS unless added to `exposedHeaders`. Native clients (no CORS) are unaffected either way.
- Nest controllers returning `null` (e.g. media endpoints with no linked flight) send `200` with `Content-Length: 0`, not a literal `"null"` body or `204` — don't assert on body content for that case, assert on status + empty body.
