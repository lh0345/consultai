# ConsultAI

A university consultation booking platform, built with React, TypeScript, Vite, Tailwind CSS, NestJS, Prisma, and PostgreSQL. The UI follows the eight images in `image-references/`.

Live demo: **[consultai-lh0345.onrender.com](https://consultai-lh0345.onrender.com)**. Use the demo Google account chooser: **Jane Doe** opens the student view; **Alex Morgan**, the demo Classroom course creator, opens the professor workspace automatically.

Repository: [lh0345/consultai](https://github.com/lh0345/consultai). GitHub Actions builds the app and runs the PostgreSQL integration tests on pushes and pull requests. Local environment files, generated output, and database records are excluded from Git.

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

Sign in or sign up with the mock Google account chooser. The server derives the role by matching the selected account ID to the seeded Classroom course owner ID. Both views share an eight-hour HTTP-only server session; no professor password is needed. Booking automatically uses the selected profile and only asks for an optional discussion topic. Google identity and Classroom ownership are explicitly simulated.

Students can search subjects, select a date/time, book, and see confirmation. Open **Professor** to manage subjects, add/edit unbooked slots, and review appointments. Professor access is available to the demo course creator in both local and hosted mode. Availability includes weekends, and all times display in Europe/Skopje.

## Optional Google Calendar

1. Create a Google Cloud OAuth **Web application** client. Enable Calendar API; add your Google account as a test user if the consent screen is in testing.
2. Register `http://localhost:5173/api/admin/integrations/google/callback` as an authorized redirect URI.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `TOKEN_ENCRYPTION_KEY` in `.env`. Generate a 32-byte encryption key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep that key stable so saved tokens remain readable.
4. Restart the server, then use **Professor → Google Calendar → Connect Google account** and grant the requested permissions.

OAuth uses state, an HTTP-only same-site cookie, PKCE, and encrypted refresh tokens. Busy periods on the primary calendar are hidden and rechecked before booking. If a connected calendar cannot be checked, booking pauses with a retryable error. Event sync happens after the database commits, so a sync failure does not lose the booking. **Calendar sync** lists pending/failed events for explicit retry; a deterministic event ID prevents duplicates. No student email or calendar invitation is sent.

Google Calendar changes made outside ConsultAI cannot be atomically locked with a PostgreSQL booking. Local duplicate/overlap prevention is guaranteed by the database. Live OAuth and Google API calls require your credentials and have not been exercised here. See [Google OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server) and [Calendar API](https://developers.google.com/workspace/calendar/api/v3/reference).

## Optional Gemini & course materials

Set `GEMINI_API_KEY` in `.env`, keep the default `GEMINI_MODEL=gemini-2.5-flash` or select a model available to your key, then restart. A free-tier key can be used; no billing setup is performed by the app. See [Gemini API setup](https://ai.google.dev/gemini-api/docs/api-key) and [current model availability](https://ai.google.dev/gemini-api/docs/pricing).

Under **Professor → AI & materials**, add lecture text and explicitly approve it. Students choose a lecture in **Study with AI**. `/api/ai` sends only that approved material and a bounded conversation to Gemini. Unapproved material and raw private file content are not exposed by public endpoints. Source excerpts are displayed only when they match the actual material. AI answers can still be incorrect. The server limits AI to four requests per minute and handles quota/timeouts without losing the typed question. The interface stays usable without a key; no answers or citations are simulated. Live model responses have not been tested without credentials.

## Optional Classroom & Drive

Enable Classroom API and Drive API in the same Google Cloud project. From **Professor → Classroom**, connect Google and grant the read-only course, course-material, and Drive permissions. Import a course you teach with a course code, then import its published Drive references. Repeat imports preserve existing subjects and material approvals.

Open **AI & materials**, review an imported item, and use **Load source text** for Google Docs or `text/plain` files (20–60,000 characters, at most 240 KB). Loading a source resets its approval. For PDFs, slides, or other formats, paste relevant text manually. Review and explicitly approve the text before students can ask about it. The same Drive file can be approved separately for different subjects. Original private files and URLs are never served to students. Non-Drive attachments are not imported. Live imports require credentials; tests verify the workflow using a controlled provider boundary and real PostgreSQL persistence.

## Production build, local run

After `npm run build`, set `APP_ORIGIN=http://localhost:3001` in `.env`, then run `npm start`. Nest serves the built frontend and API together at http://localhost:3001. For optional local Google integration testing, also update `GOOGLE_REDIRECT_URI` and its registered Google redirect to the same port. Use the `localhost` address when connecting Google. For `npm run dev`, restore the original port 5173 environment values. Development watches both frontend and backend files.

Stage progress, commit hashes, and checks are tracked in `docs/PROGRESS.md`. Local development binds to loopback. Professor APIs check the server session and course ownership; unrelated-origin writes are rejected. Local `localhost` and `127.0.0.1` aliases on the configured port are supported.

## Free hosted demo

Run the frontend and Nest API together on a **Render Free web service**, backed by a separate **Supabase Free PostgreSQL project**. The app uses a dedicated database role and the private `consultai` schema, without direct browser access to Supabase tables. Local database records and provider credentials are not copied to hosting.

- Build: `npm ci --include=dev && npm run db:generate && npm run build`
- Start: `npm run start:hosted`
- Set `DATABASE_URL` to the Supabase **session pooler** URL with `schema=consultai&sslmode=verify-full&sslrootcert=server/certs/supabase-ca.crt`, and set a randomly generated `ADMIN_PASSWORD` of at least 24 characters. Keep both in Render's environment settings. The checked-in public CA certificate comes from the Supabase dashboard's certificate download; certificate and hostname verification remain enabled.
- Set `NODE_VERSION=24` and optionally `SEED_DEMO=true` to bootstrap subjects and the initial availability. The startup script applies existing Prisma migrations, then seeds only missing demo data.
- `APP_ORIGIN` defaults to Render's `RENDER_EXTERNAL_URL`. For another host, supply the exact HTTPS origin. Health endpoint: `/api/health`.

Both demo accounts use eight-hour, revocable server sessions in secure HTTP-only cookies. Restarting the hosted server ends sessions; choose the account again. Password access is disabled. Public demo accounts must not be combined with live Google credentials; hosted startup rejects that combination. Real Google/Classroom role detection is not enabled in this demo.

The live demo includes three subjects and 40 initial slots. One clearly labeled hosting verification booking is retained. RLS intentionally has no browser policies: only the owning backend role accesses app tables through Nest API routes.

Free-plan limits apply: [Render sleeps idle services](https://render.com/docs/free), and [Supabase can pause inactive free projects](https://supabase.com/pricing). No paid upgrades, custom domains, Google credentials, or Gemini keys are configured by the deployment.
