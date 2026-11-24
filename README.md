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

4. **Install dependencies, create the tables and the first admin:**
   ```bash
   pnpm install
   pnpm db:push
   ADMIN_EMAIL="you@company.com" ADMIN_PASSWORD="at-least-8-chars" ADMIN_NAME="Your Name" pnpm db:seed
   ```
   The database starts **empty**: only the 5 default roles and this one Super Admin are created.
   Add your team in **User Management** after signing in.
   You can also put `ADMIN_*` in `.env.local` and load it with `set -a; . ./.env.local; set +a`.

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
| `GOOGLE_DRIVE_*` | Optional. Store attachments in Google Drive (see **Attachments & Google Drive**) |
| `SMTP_*` | Optional. Can also be set later in the app's **Settings** page |

### 4. Create tables and seed data (once per database)
Run this from your machine, pointing at the cloud database:
```bash
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
ADMIN_EMAIL="you@company.com" ADMIN_PASSWORD="a-strong-password" ADMIN_NAME="Your Name" \
pnpm db:setup        # = drizzle-kit push + create roles and the first Super Admin
```

To wipe a database and start from zero again (all data is lost — back it up first with `pg_dump`):
```bash
DATABASE_URL="..." CONFIRM_RESET=yes ADMIN_EMAIL="..." ADMIN_PASSWORD="..." pnpm db:reset
```

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

## Currency

All amounts (deal value, monthly fee, unit price, MRR) are stored and shown in **Rupiah (IDR)**, as whole rupiah in `bigint` columns.
The dashboard shows a USD/IDR reference line from **Bank Indonesia — Kurs Transaksi BI** (`wskursbi.asmx`, middle of buy/sell),
cached for 6 hours, with `open.er-api.com` as a labelled fallback when BI cannot be reached. USD is information only.

## Corrective Maintenance workflow

- **Lifecycle:** Reported → Diagnosing → In Repair → **Resolve** (resolution detail required, optional email to the customer contact) → **Close** (after the customer confirms). **Reopen** (reason required) sends a resolved/closed ticket back to Diagnosing with a fresh SLA target.
- **Category / subcategory and source** (Phone, Email, Portal, WhatsApp, Monitoring Alert, Walk-in) on every ticket; Reports shows incidents by category and the SLA-met rate.
- **SLA:** target defaults from priority (Critical 4h, High 8h, Medium 24h, Low 72h) and can be changed per ticket. The list shows a live countdown (on track / at risk / breached).
  - A Critical ticket open longer than **Critical Escalation (Minutes)** in **Settings** emails all Super Admins and Service Managers once.
  - A ticket past its SLA target emails the owner and managers once.
  - These checks run with the reminder scheduler (local), the cron endpoint, **Run Due Reminders**, and automatically when the Dashboard or Corrective list is opened (at most once a minute).
- **Service number** list is filtered by the selected customer, and the API rejects a service that belongs to another customer.
- Every change, email and file is recorded in the ticket's **Activity History**.
- Record codes (CM-2026-001…) come from the database sequence, so they are unique and never reused after a delete.

> **Database tooling note:** PostgreSQL 18 needs `drizzle-kit` ≥ 0.31 (older versions try to drop PG18's named NOT NULL constraints on `db:push`).

## Attachments & Google Drive

Corrective Maintenance tickets accept attachments. Executable/HTML/SVG files are refused, and downloads always go through the app, so access stays permission-checked.
PDFs, images and text files can be **previewed** in the app (served inline with a locked-down content policy; other types always download).

- **Size limits:** 4 MB per file through the app (Vercel's request limit). With Google Drive connected, larger files (up to 100 MB)
  are uploaded **directly from the browser to Google Drive** using a resumable upload session that the server creates in the ticket's folder; the server then verifies the file before recording it.

- **Without Google Drive configured** files are stored in the database (`attachments.content`). Fine for testing.
- **With Google Drive** files go to `VirtusMS Attachments/Corrective Maintenance/<CM code>/` in the connected Google account.

**Connect Google Drive (one-time, ~10 minutes):**
1. [Google Cloud Console](https://console.cloud.google.com/) → create a project → **APIs & Services → Library** → enable **Google Drive API**.
2. **OAuth consent screen** → External (or Internal for Workspace) → add your account as a test user → add scope `https://www.googleapis.com/auth/drive.file`.
   Publish the app to *In production* afterwards, otherwise refresh tokens of "Testing" apps expire after 7 days.
3. **Credentials → Create credentials → OAuth client ID** → *Web application* → authorized redirect URI `https://developers.google.com/oauthplayground`. Copy the client ID and secret.
4. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) → ⚙️ → *Use your own OAuth credentials* (paste ID/secret) →
   scope `https://www.googleapis.com/auth/drive.file` → **Authorize APIs** with the Google account that should own the files → **Exchange authorization code for tokens** → copy the **refresh token**.
5. Set on Vercel (and in `.env.local` for local dev): `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`
   (optional `GOOGLE_DRIVE_FOLDER_ID` — only works with the full `drive` scope; with `drive.file` the app creates its own folder). Redeploy.

The `drive.file` scope only lets the app see files it created — it cannot read the rest of the Drive.
Files uploaded before Drive was connected stay in the database; new uploads go to Drive.
