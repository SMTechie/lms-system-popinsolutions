# POPIN LMS

School operations workspace built with Next.js, React, Prisma, and PostgreSQL.

## Stack

- Next.js 15
- React 18
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL / Neon

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## Environment Variables

The web app requires these values in production:

```text
DATABASE_URL=postgresql://...
AUTH_SECRET=...
NEXT_PUBLIC_AUTH_BYPASS=false
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
APP_URL=https://your-domain.vercel.app
```

`NEXT_PUBLIC_AUTH_BYPASS` is optional and should stay `false` in production.

Optional integrations:

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_WHATSAPP_FROM=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
PAYSTACK_SECRET_KEY=
```

Use [.env.example](C:/Users/LENOVO/Documents/GitHub/popin-LMS/.env.example) as the deployment template.

## Database

### Local PostgreSQL with Docker

Start the local database:

```bash
docker compose up -d db
```

Use `.env.docker` for local Docker database commands, then apply the schema and seed demo users:

```bash
make db-migrate
make db-seed
```

The Docker database is persisted in the `popin_lms_postgres_data` volume. The existing `.env` remains configured for Neon.

Generate Prisma client:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

Seed demo data:

```bash
npm run db:seed
```

## Vercel Deployment

This repo is ready to deploy to Vercel.

Use these project settings:

- Root Directory: `.`
- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`

Set these environment variables in Vercel:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_AUTH_BYPASS=false`
- `NEXT_PUBLIC_APP_URL`
- `APP_URL`

If you are enabling live integrations, also set:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_WHATSAPP_FROM`
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_SECRET_KEY`

Notes:

- Prisma client generation is automated during `postinstall`, which is Vercel-safe.
- Run `npm run db:migrate` against the production database before the first production deploy, or from your release pipeline.
- Run `npm run db:seed` only if you intentionally want seeded records in that environment.
- Set the Paystack callback to `https://your-domain.vercel.app/parent-portal/payment-callback` or a custom domain equivalent.
- Set the Twilio status callback to `https://your-domain.vercel.app/api/webhooks/twilio/status`.
- Set the Paystack webhook to `https://your-domain.vercel.app/api/webhooks/paystack`.

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
```




admin@popin.school / ChangeMe123!
parent@popin.school / ChangeMe123!
teacher@popin.school / ChangeMe123!
