import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const TIMEZONE = 'Europe/Skopje';
export const uuid = z.uuid();
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(value);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Choose a valid date.');
export const subjectInput = z.strictObject({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(20).regex(/^[a-zA-Z0-9 _-]+$/).transform((value) => value.toUpperCase()),
  icon: z.enum(['database', 'network', 'code', 'book']).default('book'),
});
export const slotInput = z.strictObject({
  date, startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration: z.number().int().min(15).max(180).multipleOf(15),
});
export const bookingInput = z.strictObject({
  slotId: uuid, subjectId: uuid, requestKey: uuid,
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().max(254).transform((value) => value.toLowerCase()),
  question: z.string().trim().max(2000).default(''),
});
export const materialInput = z.strictObject({
  subjectId: uuid, title: z.string().trim().min(2).max(150),
  content: z.string().trim().min(20).max(60_000), approved: z.boolean().default(false),
});

export function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException({
    message: 'Please check the highlighted details.',
    fields: Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message])),
  });
  return result.data;
}

export function localDate(value: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

export function slotTimes(input: z.infer<typeof slotInput>) {
  const wallClock = `${input.date}T${input.startTime}:00`;
  const utc = new Date(`${wallClock}Z`).getTime();
  // Skopje uses UTC+1 or UTC+2. Match the wall clock to reject missing or repeated DST times.
  const matches = [60, 120].map((offset) => new Date(utc - offset * 60_000)).filter((value) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}` === wallClock;
  });
  if (matches.length !== 1) throw new BadRequestException('This local time is missing or ambiguous because the clocks change. Choose another time.');
  const startsAt = matches[0];
  if (startsAt.getTime() <= Date.now()) throw new BadRequestException('Choose a future time.');
  const endsAt = new Date(startsAt.getTime() + input.duration * 60_000);
  if (localDate(startsAt) !== localDate(endsAt)) throw new BadRequestException('A slot must start and end on the same day.');
  return { startsAt, endsAt };
}

export function dateRange(from?: string, to?: string) {
  const start = parse(date, from || localDate());
  const end = parse(date, to || new Date(new Date(`${start}T12:00:00Z`).getTime() + 31 * 86400_000).toISOString().slice(0, 10));
  const days = (Date.parse(end) - Date.parse(start)) / 86400_000;
  if (days < 0 || days > 62) throw new BadRequestException('Choose a date range of at most 62 days.');
  // Broad UTC bounds, then exact local-day filtering, avoid assumptions about DST.
  return { from: start, to: end, startsAt: { gte: new Date(`${start}T00:00:00+02:00`), lt: new Date(Date.parse(`${end}T00:00:00+01:00`) + 86400_000) } };
}
