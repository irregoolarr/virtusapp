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

## Deploying on Your Own Server (Production)

VirtusMS runs as one always-on Node.js process (`next start`) next to PostgreSQL. The process also runs the
background scheduler every 60 seconds (reminder emails, Corrective SLA, Preventive visits, go-live and POC
review checks), so it must stay running — use a service manager such as systemd.

### 1. Install and configure (once)
Follow **Prerequisites & Installation** and **Setup** above, then set at least these in `.env.local`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your PostgreSQL database, e.g. `postgresql://virtus:<password>@localhost:5432/virtusapp` |
| `SESSION_SECRET` | Random string, e.g. `openssl rand -hex 32` |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The first Super Admin created by `pnpm db:setup` |
| `COOKIE_SECURE` | Leave unset behind HTTPS. Set `"false"` only if users reach the app over plain HTTP |
| `SMTP_*`, `GOOGLE_DRIVE_*` | Optional (SMTP can also be set in the app's **Settings** page) |

`drizzle-kit` and the seed/test scripts don't read `.env.local` by themselves — load it into the shell first,
otherwise they fall back to `localhost:5432` with the default credentials:
```bash
set -a && . ./.env.local && set +a
pnpm install
pnpm db:setup        # = drizzle-kit push + create roles and the first Super Admin
pnpm build
```

To wipe the database and start from zero again (all data is lost — back it up first with `pg_dump`):
```bash
CONFIRM_RESET=yes pnpm db:reset
```

### 2. Run it as a service (starts at boot)
Example systemd **user** service, `~/.config/systemd/user/virtusapp.service` (adjust the path):
```ini
[Unit]
Description=VirtusMS
After=network-online.target

[Service]
WorkingDirectory=/home/<user>/virtusapp
Environment=NODE_ENV=production
# Behind a reverse proxy, listen on localhost only. next start reads .env.local.
ExecStart=/home/<user>/virtusapp/node_modules/.bin/next start --hostname 127.0.0.1 --port 3000
Restart=on-failure

[Install]
WantedBy=default.target
```
```bash
sudo loginctl enable-linger "$USER"          # once: start user services at boot
systemctl --user daemon-reload
systemctl --user enable --now virtusapp
journalctl --user -u virtusapp -f            # logs
curl -s http://127.0.0.1:3000/api/health     # {"ok":true,"database":"postgresql","schedulerActive":true,...}
```

### 3. HTTPS
Put a reverse proxy with a TLS certificate in front of port 3000, for example Caddy:
```
vms.example.com {
    reverse_proxy 127.0.0.1:3000
}
```
With HTTPS in place leave `COOKIE_SECURE` unset, so the session cookie is `Secure`.

### 4. Deploying updates
```bash
cd ~/virtusapp && set -a && . ./.env.local && set +a
git switch main && git pull --ff-only
pnpm install --frozen-lockfile
pg_dump "$DATABASE_URL" -Fc -f ~/virtusapp-backups/virtusapp-$(date +%F-%H%M).dump   # before schema changes
pnpm db:push                                  # only if src/db/schema.ts changed (additive changes apply in place)
pnpm build
systemctl --user restart virtusapp
curl -s http://127.0.0.1:3000/api/health
```

### Dev workflow
```bash
git checkout -b feature/my-change    # develop with pnpm dev (stop the service first, or use a second clone:
                                     # both use port 3000 and the .next folder)
pnpm typecheck && pnpm build && pnpm test
git switch main && git merge --ff-only feature/my-change && git push origin main
# then deploy with step 4
```

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

## Preventive Maintenance workflow

- **Visits** have a category and item type (Firewall, UPS, Backup Verification, …). New plans get that type's **standard checklist** pre-filled (editable).
- **Lifecycle:** Scheduled → In Progress → Verification → **Complete** (findings & actions required; warns about unticked checklist steps; optional PM report email to the customer; optionally **schedules the next visit** from the frequency — Monthly +1, Quarterly +3, Semi-Annual +6, Annual +12 months, same day, checklist reset). Completed visits are not reopened — a problem found later is a new visit or a Corrective ticket; the completion report stays editable.
- **Schedule tracking:** the list shows *Due in …*, *Due today*, *Overdue …*, *Done on time / late*. The engineer gets a reminder email 24 hours before the visit, and the engineer plus managers get an overdue alert once the scheduled day has passed (each sent once per date; rescheduling re-arms them).
- Same as Corrective: service list filtered by customer, attachments with preview, Activity History, centered window, ESC / unsaved-changes prompt.

## Implementations & POC workflow

- **Implementations:** project type, phases Kickoff → Configuration → UAT / Staging, milestones (ticking them moves progress), and a **Blocker** field — saving a blocker emails the lead and managers. **Go-Live** finishes the project: handover notes required, progress 100%, milestones closed, optional customer email. Target go-live countdown with a reminder to the lead 7 days before and a one-time alert to lead + managers when it slips.
- **POC:** success criteria, score, review date countdown (reminder 3 days before, alert when the review passes undecided). **Decide** records the outcome: **Success** (→ Approved, optional pipeline deal in Negotiation with the deal value in IDR), **Extend** (new review date, alerts re-armed) or **Drop**; optional customer email.
- Both: attachments with preview, Activity History, centered window. Finished records (live / decided) are not reopened.

## Attachments & Google Drive

Corrective Maintenance tickets accept attachments. Executable/HTML/SVG files are refused, and downloads always go through the app, so access stays permission-checked.
PDFs, images and text files can be **previewed** in the app (served inline with a locked-down content policy; other types always download).

- **Size limits:** 25 MB per file through the app. With Google Drive connected, larger files (up to 100 MB)
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
5. Set in `.env.local`: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`
   (optional `GOOGLE_DRIVE_FOLDER_ID` — only works with the full `drive` scope; with `drive.file` the app creates its own folder). Restart the service.

The `drive.file` scope only lets the app see files it created — it cannot read the rest of the Drive.
Files uploaded before Drive was connected stay in the database; new uploads go to Drive.
