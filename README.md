# ConsultAI

A university consultation booking platform, built with React, TypeScript, Vite, Tailwind CSS, NestJS, Prisma, and PostgreSQL. The UI follows the eight images in `image-references/`.

## Local setup

Requires Node.js 22.12+ and npm. A local PostgreSQL helper is included; no Docker or Google account is needed.

```powershell
npm install
Copy-Item .env.example .env
npm run db:local
```

Leave PostgreSQL running. In another terminal:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:5173. PostgreSQL persists in `.local/postgres`; restarting it retains records. Alternatively, set `DATABASE_URL` to an existing PostgreSQL database and omit `db:local`.

```powershell
npm run check
npm test
npm run build
```

Stage progress and verification are tracked in `docs/PROGRESS.md`. Optional integrations and final production-run instructions will be documented as implemented. Professor administration is a **local demonstration without accounts**; it is not suitable for public hosting.
