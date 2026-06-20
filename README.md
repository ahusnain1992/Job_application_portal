# Job Application Operations Portal

A full-stack internal operations portal for managing manual job applications across multiple client profiles. It is designed for non-technical team members: the app queues prioritized jobs, guides each manual application, tracks proof, prevents duplicate work, supports resume rewrite handoff, and can generate copyable cover letters. It never auto-applies to jobs.

## Stack

- Next.js App Router
- React
- Prisma
- PostgreSQL
- Tailwind CSS
- Cookie-based authentication with bcrypt password hashes
- Vitest test suite

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set `DATABASE_URL`.

For a local PostgreSQL database:

```bash
docker compose up -d
```

3. Create the database schema and seed demo data:

```bash
npm run db:push
npm run db:seed
```

4. Start the app:

```bash
npm run dev
```

Demo users:

- Admin: `admin@portal.test` / `password123`
- Team member: `maria@portal.test` / `password123`
- Team member: `jamal@portal.test` / `password123`

## MVP Notes

The Apify integration is intentionally provider-based. The current route accepts normalized job imports and includes an Apify provider class stub that can be wired to actor runs once credentials and actor input shapes are confirmed. The portal never stores job-board passwords and never auto-applies to jobs.

## Verification

Run these before deploying:

```bash
npm run build
npm run lint
npm run test
```

## Railway Deployment

1. Push the repository to GitHub.
2. Create a Railway project from the GitHub repo.
3. Add a Railway Postgres database and set `DATABASE_URL`.
4. Add required environment variables:

```bash
DATABASE_URL=
AUTH_SECRET=
APP_URL=
CRON_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
JSEARCH_API_KEY=
APIFY_API_TOKEN=
N8N_RESUME_WEBHOOK_URL=
```

`AUTH_SECRET`, `APP_URL`, `CRON_SECRET`, and `DATABASE_URL` are required in production. Gmail/job provider/N8N variables are optional unless those features are used.

Railway uses `railway.toml`:

- Build: `npm ci && npm run build`
- Pre-deploy migration: `npx prisma migrate deploy`
- Start: `npm run start`

Do not run `prisma db push --accept-data-loss` in production. Schema changes should go through Prisma migrations.

Use `npm run db:seed` only for demo/staging data, not for production client data.

## First Production Admin

For production, do not use the demo seed unless the database is disposable. The demo seed deletes existing data.

Instead, set these Railway variables temporarily:

```bash
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-long-unique-password
ADMIN_NAME="Your Name"
```

Then run:

```bash
npm run db:bootstrap-admin
```

This safely creates or updates one admin user without deleting clients, jobs, or applications. After the admin is created, remove or rotate `ADMIN_PASSWORD` in Railway.
