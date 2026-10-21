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
