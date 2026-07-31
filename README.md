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

The web app expects these values:

```text
DATABASE_URL=postgresql://...
AUTH_SECRET=...
NEXT_PUBLIC_AUTH_BYPASS=false
```

`NEXT_PUBLIC_AUTH_BYPASS` is optional and should stay `false` in production.

## Database

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

Notes:

- Prisma client generation is automated during install and build.
- Run `npm run db:migrate` against the production database before the first production deploy, or from your release pipeline.
- Run `npm run db:seed` only if you want demo data in that environment.

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
