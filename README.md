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

## Setup & Local Development

1. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
2. Start PostgreSQL (either local PostgreSQL service or `docker compose up -d`).
3. Install dependencies, push schema, and seed demo data:
   ```bash
   pnpm install
   pnpm db:push
   pnpm db:seed
   ```
4. Start the app:
   ```bash
   pnpm dev
   ```

## Demo Login Profiles

All seeded users use password **`virtus123`** (or click any profile card on `/login`):

- `iona@virtusms.io` — **Super Admin**
- `sandra@virtusms.io` — **Service Manager**
- `jamal@virtusms.io` — **Field Engineer**
- `antony@virtusms.io` — **Account Lead**
- `marcus@virtusms.io` — **Viewer** (read-only)
