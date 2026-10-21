# Progress

## 1 · Foundation

- Inspected all seven screens and the design kit. Established the requested React/Vite/Tailwind + NestJS/Prisma/PostgreSQL stack.
- Added typed configuration, relational schema, environment example, and a persistent local PostgreSQL helper.
- Runtime verified: Node 24.20.0 / npm 11.19.0. Installed dependencies, generated Prisma 7.10.1 client, and applied the initial PostgreSQL migration. Dependency audit: zero vulnerabilities.
- No hosting, remote push, external connections, or credentials required.

## 2 · Core API

- Foundation commit: `72df0c4`. Type checks and initial production build passed.
- Added public subject/availability/booking endpoints and separate loopback-only professor endpoints. Validates inputs, date ranges, DST transitions, future times, and course codes.
- Bookings use a unique slot, row lock, transaction, and idempotency key. Editing/removing a booked slot is rejected.
- Applied migration, seeded three subjects and 40 future slots, and passed both frontend/backend type checks. Next: direct database constraints and concurrent integration tests.

## 3 · Database guarantees

- API commit: `5774583`. Applied GiST exclusion constraint, duration/content checks, future-booking trigger, and booked-slot protection.
- Fixed raw-query search paths and made trigger lookups schema-safe after the isolated-database test exposed the mismatch.
- Five PostgreSQL integration tests passed: full booking/retry/restart, 12 simultaneous HTTP bookings across subjects (one winner), direct concurrent SQL writes, validation/privacy/origin checks, and Skopje DST handling.
- Tests create isolated schemas and retain their records; they never reset existing data. No UI-dependent rules or credentials are needed for these guarantees.

## 4 · Student booking screens

- Database-protection commit: `d65a722`. Built subject search, date/time selection, validated booking form, and persistent-session confirmation using the reference layouts and design tokens.
- Browser-tested search → subject → time → form → confirmed booking. Retained the explicit `Browser QA Student` booking in the local demo database. Confirmation has no horizontal overflow at 390px.
- Found and fixed a PostgreSQL session-timezone mismatch; connections now force UTC and an integration assertion verifies exact stored/read timestamps. All five tests and frontend/backend type checks passed.
- Compared layout structure, components, colors, and typography to the source images. Ego screenshots timed out twice, so pixel-level comparison remains unverified. Next: professor screens.

## 5 · Professor workspace

- Student-flow commit: `9ce547c`. Added overview counts, upcoming bookings and details, subject creation/editing, seven-day availability, compact slot creation/editing, and confirmed removal of unbooked slots.
- Browser-verified real dashboard data, new-slot form/save, weekly view, and no horizontal overflow at 390px. Booked slots render locked; database tests cover rejected changes/removal.
- Type checks passed. Browser print-to-PDF works, providing a visual inspection path after screenshot capture timed out. Local QA booking and availability remain saved.
- Next: optional Calendar OAuth/free-busy/synchronization, then AI and Classroom.

## 6 · Optional Calendar

- Professor-workspace commit: `fb6e580`. Added Google OAuth with state/cookie/PKCE, encrypted refresh tokens, free-busy checks, post-commit calendar events, and persisted pending/failed sync with safe retries.
- Integration settings show real configured/connected states. No credentials or tokens are sent to the frontend; no email delivery is claimed or attempted.
- Type checks and six integration tests passed, including simulated provider-check failure (no booking) and sync failure (booking retained and idempotent).
- Google credentials are absent: live consent, busy checks, and event creation remain unverified. Core behavior remains independent of all providers.

## 7 · Study assistant & materials

- Calendar commit: `b32cf91`. Added one grounded Gemini endpoint, professor material editing/approval, and the student two-panel study screen.
- Public APIs expose only approved titles/IDs. Source quotes require exact matches in stored material; private source text and keys stay on the server. Missing credentials, quotas, failures, and loading/empty states are explicit.
- Seven integration tests passed, adding approval/privacy, missing-key behavior, and rejection of invented source quotes. Frontend/backend type checks passed.
- Browser-tested adding an explicitly labeled sample lecture, approval, and the student lecture list with AI correctly disabled. No Gemini request was made; live answers remain unverified without credentials.

## 8 · Classroom & Drive

- Study-assistant commit: `6ceb750`. Added teacher-course import, published Drive references, authorized Google Docs/plain-text loading, explicit review/approval, and repeatable imports.
- Migration scopes Drive references per subject, allowing a shared source to be reviewed independently. Imported content is private and unapproved; refreshing it clears approval.
- Type checks and eight integration tests passed, including imports repeated across two subjects, private text loading, and public metadata exclusion. The provider boundary is controlled in tests; no Google connection is fabricated.
- Live OAuth, Classroom, Drive, and Gemini still require credentials. Next: final visual review, run-command verification, and cleanup.
