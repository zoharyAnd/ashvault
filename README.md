# 🔥 AshVault

**Share a password, API key, or private note through a link that works exactly once — then destroys itself.**

AshVault is a self-destructing secret-sharing vault. Every feature is a security concept made visible: the server stores ciphertext it can't read, a link dies the instant it's opened, and the boundaries are proven by tests rather than claimed in a bullet point.

> **The 10-second demo:** create a secret → open the link → see it → refresh → it's gone forever.

---

## Why it's more than a CRUD app

| Concept | How AshVault proves it |
| --- | --- |
| **Zero-knowledge encryption** | Secrets are encrypted with AES-256-GCM **in the browser**. The key lives in the URL fragment (`#…`), which browsers never send over the wire, so the server only ever receives ciphertext + IV. Not even the operator can read a secret. |
| **One-time / time-boxed access** | Reading a secret is a single **atomic `UPDATE`**. When two people open the last view at once, Postgres row-locking guarantees exactly one winner — the other gets ash. On the final read the ciphertext is **shredded** (nulled) so it's unrecoverable even from a DB dump. |
| **Auth + RBAC** | Anonymous senders are welcome; registered users get a dashboard with an **audit log** (when/where each secret was opened). Roles: `user` sees only their own data, `admin` sees system health + abuse reports. |
| **API + validation + abuse protection** | Clean REST route handlers, **Zod** on every input, salted-hash IP auditing, and a pluggable **rate limiter** (in-memory in dev, Upstash Redis in prod). |
| **Tested boundaries** | Playwright + Vitest prove the claims: the link dies after one read, concurrent reads can't both win, expired secrets are refused, and user A can't read user B's audit log. |

---

## The security model in one picture

```
 SENDER'S BROWSER                    SERVER / DATABASE                RECIPIENT'S BROWSER
 ────────────────                    ────────────────                ───────────────────
 plaintext
   │  AES-256-GCM (Web Crypto)
   ▼
 ciphertext + iv ──── POST ─────►  stores ciphertext + iv only
 key                                (never sees the key)
   │
   └── appended to URL as  https://…/s/<id>#<key>
                                     │
        share link ─────────────────┼───────────────────────────►  reads #<key> from URL
                                     │                                      │
                       POST /reveal  │  atomic claim ─► ciphertext ─────────┤
                                     │  (then shred)                        ▼
                                     ▼                              AES-GCM decrypt in-browser
                              audit log entry                          plaintext
```

The key (`#<key>`) is in the URL **fragment**. Fragments are stripped from every HTTP request by the browser, so the server, its logs, and any proxy in between never see it. That's what makes the encryption genuinely zero-knowledge.

---

## Tech stack

- **Next.js 16** (App Router, Route Handlers) + **React 19** + **TypeScript**
- **Postgres** via **Drizzle ORM** (local Docker in dev; swap the connection string for Neon/Supabase in prod)
- **Auth.js v5** (credentials provider, JWT sessions) + **bcrypt**
- **Web Crypto API** (AES-256-GCM) for zero-knowledge encryption
- **Zod** for validation, **Upstash Redis** (optional) for distributed rate limiting
- **Vitest** (unit) + **Playwright** (e2e)
- Deploys to **Vercel**

---

## Quick start

**Prerequisites:** Node 20+ and Docker.

```bash
# 1. Install dependencies
pnpm install
#   or: npm install

# 2. Create your env file (defaults work out of the box for local dev)
cp .env.example .env
#   then generate a real AUTH_SECRET:  npx auth secret

# 3. Start Postgres (Docker) and set up the schema
pnpm db:up        # boots Postgres on localhost:5433
# or: npm run db:up
pnpm run db:migrate   # applies migrations
# or: npm run db:migrate

# 4. Run the app
pnpm run dev          # http://localhost:3000
# or: npm run dev
```
---

## Testing

```bash
pnpm test         # Vitest unit tests (crypto round-trips, tamper detection, wrong-key rejection)
# or: npm test
pnpm run test:e2e # Playwright boundary tests (needs the DB running)
# or: npm run test:e2e
```

The Playwright suite is the proof of the headline claims:

- **`one-time.spec.ts`** — a link dies after one read; concurrent reveals produce exactly one winner; an N-view link allows exactly N reads.
- **`expiry.spec.ts`** — an expired secret is refused and its ciphertext is swept; a nonexistent id is a 404.
- **`rbac.spec.ts`** — anonymous users are redirected from the dashboard; non-admins can't reach `/admin`; **user A can't read user B's audit log**.

---

## Project layout

```
src/
  app/
    page.tsx                     # landing + create form
    s/[id]/                      # the reveal / burn page
    login, register/             # auth pages
    dashboard/                   # user's secrets + audit logs (RBAC: user)
    admin/                       # system health + abuse reports (RBAC: admin)
    api/
      secrets/                   # create, status (non-consuming), reveal (atomic burn), report
      register/                  # account creation
      auth/[...nextauth]/        # Auth.js handlers
  lib/
    crypto.ts                    # zero-knowledge AES-256-GCM (isomorphic)
    secrets.ts                   # the atomic claim + shred logic
    rate-limit.ts                # pluggable in-memory / Upstash limiter
    validation.ts                # Zod schemas
    env.ts                       # validated environment
  db/
    schema.ts                    # Drizzle schema
  auth.ts, auth.config.ts        # Auth.js (node + edge-safe halves)
  proxy.ts                       # route protection (Next 16 middleware)
e2e/                             # Playwright tests
```

---

## Design decisions worth calling out

- **Reveal is a `POST`, not a `GET`.** Loading the page only *checks status*; it never burns the secret. This stops link-preview bots (Slack, iMessage) and accidental refreshes from destroying a secret before the human reads it.
- **`410 Gone` vs `404`.** A burned or expired secret returns `410 Gone` (it existed and was intentionally destroyed); an unknown id returns `404`. More honest than collapsing both into 404.
- **IPs are never stored raw.** The audit log keeps a salted SHA-256 of the IP — enough to tell repeat opens apart, never enough to recover the address.
- **Two-half auth config.** The Edge middleware imports an adapter-free, bcrypt-free config so route protection stays lightweight; the Node runtime gets the full Drizzle adapter + credentials provider.

---

## License

MIT © Zohary Andrianome
