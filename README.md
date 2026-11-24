# VirtusMS — Management Service Team Platform

Full-stack operational workspace for Managed Service Teams, powered by **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Drizzle ORM**, and **PostgreSQL**.

## Included Capabilities

- **Executive Dashboard**: Real-time KPI summary, weekly workload paired bar chart, radial SLA compliance gauge, active incidents, upcoming PM schedules, and alert dispatch stream.
- **Corrective Maintenance**: Incident tracking (`Reported` -> `Diagnosing` -> `In Repair` -> `Resolved`) with severity levels, root cause analysis, resolution notes, SLA due dates, Board & Table views, and activity notes.
- **Preventive Maintenance**: Recurring PM schedules (`Monthly`, `Quarterly`, `Semi-Annual`, `Annual`) with interactive inspection checklists.
- **Implementation Status**: Project rollout tracking (`Kickoff` -> `Configuration` -> `UAT / Staging` -> `Go-Live`), completion percentage, milestones, and blocker tracking.
- **POC Status**: Proof-of-concept funnel (`Scoping` -> `Active Trial` -> `Evaluation` -> `Approved`) with success criteria and evaluation scorecards.
- **Customer & Business Partner Info**: Enterprise customer accounts, primary/escalation contacts, vendor/principal/integrator partners, and account managers.
- **Service Number List**: Unique contract/circuit registry (`SRV-*`), SLA tiers, monthly recurring fees, expiry alerts, and one-click reminder scheduling.
- **Product & Solution Catalog**: Managed service SKUs, target SLAs, vendor mapping, pricing models, and active deployment counts.
- **Pipeline Info**: Deal tracking (`Contacted` -> `Negotiation` -> `Offer Sent` -> `Deal Closed`) with deal values and win probabilities.
- **Event Management & Reporting**: Scheduled reminders (one-time or recurring `Daily`/`Weekly`/`Monthly`) with a background PostgreSQL worker (`src/instrumentation.ts`), live SMTP email alerting (`nodemailer`) + Sandbox Outbox audit log, CSV exports, and email digest dispatch.
- **Team & RBAC**: User management (`Super Admin`, `Service Manager`, `Field Engineer`, `Account Lead`, `Viewer`) and live interactive Role-Based Access Control permission matrix.

## Prerequisites & Installation

Before running **VirtusMS** on a local machine or server, ensure the following tools are installed:

| Tool | Version | Purpose |
| --- | --- | --- |
| **Git** | `2.x+` | Clone the repository and pull updates |
| **Node.js** | `20+` required (`22 LTS` recommended) | Next.js 15 / React 19 runtime |
| **pnpm** | `10+` (latest recommended) | Package manager (`pnpm-lock.yaml`, `pnpm-workspace.yaml`) |
| **PostgreSQL** or **Docker + Docker Compose** | PostgreSQL `16+` (`postgres:16-alpine` in `docker-compose.yml`) | Database backend |

### Install Commands by OS

#### Ubuntu / Debian (Linux Server / WSL)

1. Install base utilities (`git`, `curl`, CA certificates):
   ```bash
   sudo apt-get update && sudo apt-get install -y git curl ca-certificates
   ```
2. Install **Node.js 22 LTS** via NodeSource:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
   ```
3. Install **pnpm** via the official installer:
   ```bash
   curl -fsSL https://get.pnpm.io/install.sh | sh -
   source ~/.bashrc
   ```
4. Install a database backend (**choose one**):
   - **Choice A — Native PostgreSQL:**
     ```bash
     sudo apt-get install -y postgresql postgresql-client
     sudo systemctl enable --now postgresql
     ```
     *(If running inside WSL without systemd, use `sudo service postgresql start` instead of `systemctl`.)*
   - **Choice B — Docker Engine + Compose plugin:**
     ```bash
     sudo apt-get install -y docker.io docker-compose-plugin
     sudo systemctl enable --now docker
     ```
     *(Optional, to run Docker without `sudo`: `sudo usermod -aG docker "$USER"`, then re-open your shell.)*

#### macOS (Homebrew)

```bash
brew install git node@22 pnpm
```

Then install **one** database backend:

- **Native PostgreSQL:**
  ```bash
  brew install postgresql@16 && brew services start postgresql@16
  ```
- **Docker Desktop:**
  ```bash
  brew install --cask docker
  ```

#### Windows (PowerShell / winget)

```powershell
winget install Git.Git OpenJS.NodeJS.LTS pnpm.pnpm
```

Then install **one** database backend:

- **Native PostgreSQL:**
  ```powershell
  winget install PostgreSQL.PostgreSQL.16
  ```
- **Docker Desktop:**
  ```powershell
  winget install Docker.DockerDesktop
  ```

### Verify Installations

Run these commands to confirm every prerequisite is ready:

```bash
git --version && node -v && pnpm -v
```

And check whichever database backend you installed:

```bash
psql --version          # If using native PostgreSQL
docker compose version  # If using Docker
```

## Setup & Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/irregoolarr/virtusapp.git
   cd virtusapp
   ```

2. **Create `.env.local` from `.env.example`:**
   ```bash
   cp .env.example .env.local
   ```
   > For production or shared servers, update `SESSION_SECRET` and the database password in `.env.local` (and `DATABASE_URL` accordingly).

3. **Start and initialize PostgreSQL (choose one option):**
   - **Option A — Docker Compose** (automatically creates the `virtus` user and `virtusapp` database matching `.env.example`):
     ```bash
     docker compose up -d
     ```
   - **Option B — Native PostgreSQL** (create the `virtus` role and `virtusapp` database):
     ```bash
     sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
     CREATE ROLE virtus WITH LOGIN PASSWORD 'virtus_dev_pass' CREATEDB;
     CREATE DATABASE virtusapp OWNER virtus;
     \c virtusapp
     GRANT ALL ON SCHEMA public TO virtus;
     SQL
     ```

4. **Install dependencies, push schema, and seed demo data:**
   ```bash
   pnpm install
   pnpm db:push
   pnpm db:seed
   ```

5. **Run the application:**
   - **Development mode:**
     ```bash
     pnpm dev
     ```
   - **Production server:**
     ```bash
     pnpm build
     pnpm start
     ```
   Open `http://localhost:3000/login` in your browser.

### Updating Your Local Server

When new commits are pushed to GitHub, pull and apply changes locally:

```bash
git pull
pnpm install      # Run if package.json or pnpm-lock.yaml changed
pnpm db:push      # Run if src/db/schema.ts changed
```

Then restart the app (`pnpm dev`, or rebuild and restart with `pnpm build && pnpm start` in production). Your `.env.local` configuration and PostgreSQL data are not tracked in git and will remain untouched across `git pull`.

## Deploying to Vercel (Development / Testing)

The repo is Vercel-ready. Vercel builds it from GitHub: every push to `main` updates the **Production** URL, and every other branch or pull request gets its own **Preview** URL for testing fixes.

### 1. Import the GitHub repo
1. Sign in at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project →** import `irregoolarr/virtusapp`. Framework (Next.js), build command and pnpm are detected automatically. Don't deploy yet: add the database first.

### 2. Add a cloud PostgreSQL database
Vercel can't reach `localhost`. In the project go to **Storage → Create Database → Neon (Postgres)** (free tier) and connect it to the project. This injects `DATABASE_URL` into all environments. Supabase or Railway also work; use their **pooled** connection string with `sslmode=require`.

### 3. Set environment variables
**Project → Settings → Environment Variables:**

| Variable | Value |
|---|---|
| `DATABASE_URL` | Added by Neon (or paste your pooled URL) |
| `SESSION_SECRET` | Random string, e.g. `openssl rand -hex 32` |
| `CRON_SECRET` | Random string, e.g. `openssl rand -hex 32` |
| `NEXT_PUBLIC_DEMO_LOGIN` | `false` to hide one-click demo sign-in on the public URL |
| `SMTP_*` | Optional. Can also be set later in the app's **Settings** page |

### 4. Create tables and seed data (once per database)
Run this from your machine, pointing at the cloud database:
```bash
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
SEED_PASSWORD="choose-a-strong-password" \
pnpm db:setup        # = drizzle-kit push + seed
```
> The repo is public and the default demo password is `virtus123`. Use `SEED_PASSWORD` for any internet-reachable deployment.

Then click **Deploy** (or **Redeploy**). Open `https://<project>.vercel.app/login`.

### 5. Scheduled reminders on Vercel
Serverless functions can't keep the 60-second in-process timer alive. On Vercel it's disabled and reminders run through `GET /api/cron/events` (requires `Authorization: Bearer $CRON_SECRET`):
- **Vercel Cron** (`vercel.json`): daily at 01:00 UTC. This is the Hobby-plan limit; on Pro you can change the schedule to `*/5 * * * *`.
- **GitHub Actions** (`.github/workflows/reminder-cron.yml`): every 15 minutes. Enable it by adding repo secrets **Settings → Secrets and variables → Actions**: `APP_URL` (e.g. `https://virtusapp.vercel.app`) and `CRON_SECRET` (same value as on Vercel).
- **Run Due Reminders Now** / **Send Email Now** in the Events page work anytime.

### Dev workflow
```bash
git checkout -b fix/my-change    # work locally with pnpm dev
git push -u origin fix/my-change # Vercel posts a Preview URL on the branch/PR
# test on the Preview URL → merge to main → Production redeploys automatically
```
Tip: give the **Preview** environment its own `DATABASE_URL` (e.g. a Neon branch) so testing never touches production data. Schema changes: re-run `DATABASE_URL=... pnpm db:push` against each cloud database.

## Architecture

One Next.js project, deployed as one app, with a strict frontend / backend split inside it.

```
src/
├── app/                    Frontend pages (all client-side, "use client")
│   └── api/**/route.ts     Backend HTTP layer — thin: auth + validate + call a service
├── components/             UI components (grid, charts, shell) — never touch the database
├── server/                 Backend only
│   ├── http.ts             route() guard, parseBody(), ApiError, serialize()
│   └── services/*.ts       Business logic and database access (one file per module)
├── shared/                 Used by BOTH sides — no server imports
│   ├── constants.ts        Stages, statuses, enums
│   ├── schemas.ts          zod request schemas (API validates with them)
│   └── types.ts            API response types (pages import these)
├── db/                     Drizzle schema, connection, seed
└── lib/                    auth/session, RBAC permission list, mailer, formatting
```

**Rules that keep the split clean**

- Pages and components talk to the backend only through `fetch("/api/...")`. They import from `@/shared/*`, `@/components/*` and `@/lib/utils`/`@/lib/rbac` — never from `@/db`, `@/server` or `@/lib/auth`.
- A route file only does HTTP work. Example:
  ```ts
  export const POST = route("maintenance:write", async ({ req, user }) => {
    const input = await parseBody(req, correctiveCreateSchema, "Invalid corrective maintenance input");
    return created({ item: await createCorrective(input, user.id) });
  });
  ```
  `route()` returns 401/403 before the handler runs; services throw `ApiError` (400/404/409) which becomes `{ "error": "..." }`.
- Services return `Wire<T>` values (dates as ISO strings, exactly what JSON sends), typed against `src/shared/types.ts`. If the database or a service drifts from what the pages expect, `pnpm typecheck` fails.

**Adding a module:** add the table in `src/db/schema.ts` → enums in `shared/constants.ts` → request schema in `shared/schemas.ts` → response type in `shared/types.ts` → `server/services/<module>.ts` → thin `app/api/<module>/route.ts` → page using the shared types.

**Splitting into two projects later:** `src/app` (minus `api`) + `src/components` + `src/shared` become the frontend; `src/server` + `src/db` + `src/lib` + `src/shared` + the route files become the backend. The frontend already only speaks HTTP.

## Demo Login Profiles

All seeded users use password **`virtus123`** (or the `SEED_PASSWORD` you seeded with). Locally you can also click any profile card on `/login`:

- `iona@virtusms.io` — **Super Admin**
- `sandra@virtusms.io` — **Service Manager**
- `jamal@virtusms.io` — **Field Engineer**
- `antony@virtusms.io` — **Account Lead**
- `marcus@virtusms.io` — **Viewer** (read-only)
