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

The seed creates three editable demo subjects and 40 future slots once; no bookings or connected services are fabricated. All displayed data comes from PostgreSQL. Slots belong to the professor and are shared by all subjects. The server validates inputs and locks a slot before booking or editing it.

PostgreSQL enforces one booking per slot and excludes overlapping availability ranges. Adjacent slots are valid. Database triggers reject past bookings and edits to booked slots. Tests exercise the actual engine, including concurrent HTTP and direct database writes, in newly created test schemas (retained to avoid destructive cleanup).

Students can search subjects, select a date/time, book with a question, and see confirmation. Open **Professor area** to manage subjects, add/edit unbooked slots, and review appointments. No application login is required. Availability includes weekends, and all times display in Europe/Skopje.

Stage progress and verification are tracked in `docs/PROGRESS.md`. Optional integrations and final production-run instructions will be documented as implemented. Professor administration is a **local demonstration without accounts**; it is not suitable for public hosting. The API binds to loopback and rejects remote professor requests and cross-origin writes.
