import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from './generated/prisma/client';
import { Database } from './database';
import { GoogleService } from './google.service';
import { bookingInput, dateRange, localDate, parse, slotInput, slotTimes, subjectInput, uuid } from './validation';

const bookingDetails = { slot: true, subject: true } as const;

@Injectable()
export class BookingService {
  constructor(readonly db: Database, private readonly google: GoogleService) {}

  subjects() { return this.db.subject.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, code: true, icon: true } }); }

  async saveSubject(body: unknown, id?: string) {
    const data = parse(subjectInput, body);
    try {
      return id ? await this.db.subject.update({ where: { id: parse(uuid, id) }, data }) : await this.db.subject.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A subject with this course code already exists.');
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Subject not found.');
      throw error;
    }
  }

  async slots(from?: string, to?: string, admin = false) {
    const range = dateRange(from, to);
    const rows = await this.db.slot.findMany({
      where: { startsAt: range.startsAt, ...(!admin && { booking: null, endsAt: { gt: new Date() } }) },
      orderBy: { startsAt: 'asc' },
      ...(admin && { include: { booking: { select: { id: true, name: true, subject: { select: { name: true } } } } } }),
    });
    const candidates = rows.filter((slot) => localDate(slot.startsAt) >= range.from && localDate(slot.startsAt) <= range.to && (admin || slot.startsAt > new Date()));
    if (admin) return candidates;
    const busy = await this.google.busy(candidates);
    return candidates.filter((slot) => !busy.some((range) => Date.parse(range.start) < slot.endsAt.getTime() && Date.parse(range.end) > slot.startsAt.getTime()));
  }

  async saveSlot(body: unknown, id?: string) {
    const times = slotTimes(parse(slotInput, body));
    try {
      return await this.db.$transaction(async (tx) => {
        if (id) {
          parse(uuid, id);
          const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Slot" WHERE id = ${id}::uuid FOR UPDATE`;
          if (!rows.length) throw new NotFoundException('Slot not found.');
          if (await tx.booking.findUnique({ where: { slotId: id } })) throw new ConflictException('A booked slot cannot be changed.');
        }
        const overlap = await tx.slot.findFirst({ where: { startsAt: { lt: times.endsAt }, endsAt: { gt: times.startsAt }, ...(id && { id: { not: id } }) } });
        if (overlap) throw new ConflictException('This overlaps an existing slot. All subjects share one schedule.');
        return id ? tx.slot.update({ where: { id }, data: times }) : tx.slot.create({ data: times });
      });
    } catch (error) { this.translateConstraint(error, 'This overlaps an existing slot. Choose another time.'); }
  }

  async removeSlot(id: string) {
    parse(uuid, id);
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Slot" WHERE id = ${id}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Slot not found.');
      if (await tx.booking.findUnique({ where: { slotId: id } })) throw new ConflictException('A booked slot cannot be removed.');
      await tx.slot.delete({ where: { id } });
      return { removed: true };
    });
  }

  async book(body: unknown) {
    const input = parse(bookingInput, body);
    const existing = await this.db.booking.findUnique({ where: { requestKey: input.requestKey }, include: bookingDetails });
    if (existing) return this.sameRequest(existing, input);
    const candidate = await this.db.slot.findUnique({ where: { id: input.slotId } });
    if (!candidate) throw new NotFoundException('This slot no longer exists.');
    if ((await this.google.busy([candidate])).length) throw new ConflictException('Your professor is busy at this time. Choose another slot.');
    try {
      const confirmed = await this.db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Slot" WHERE id = ${input.slotId}::uuid FOR UPDATE`;
        if (!rows.length) throw new NotFoundException('This slot no longer exists.');
        const slot = await tx.slot.findUniqueOrThrow({ where: { id: input.slotId }, include: { booking: true } });
        if (slot.startsAt <= new Date()) throw new ConflictException('This slot has already started. Choose another time.');
        if (slot.booking) {
          if (slot.booking.requestKey === input.requestKey) {
            const previous = await tx.booking.findUniqueOrThrow({ where: { requestKey: input.requestKey }, include: bookingDetails });
            return this.sameRequest(previous, input);
          }
          throw new ConflictException('Someone just booked this slot. Please choose another time.');
        }
        if (!await tx.subject.findUnique({ where: { id: input.subjectId } })) throw new NotFoundException('Subject not found.');
        return tx.booking.create({ data: input, include: bookingDetails });
      });
      return await this.google.sync(confirmed);
    } catch (error) { this.translateConstraint(error, 'This slot was just booked. Please choose another time.'); }
  }

  private sameRequest<T extends { name: string; email: string; slotId: string; subjectId: string; question: string }>(previous: T, input: { name: string; email: string; slotId: string; subjectId: string; question: string }): T {
    if (['name', 'email', 'slotId', 'subjectId', 'question'].some((key) => previous[key as keyof typeof input] !== input[key as keyof typeof input])) throw new ConflictException('This request has already been used for another booking.');
    return previous;
  }

  private translateConstraint(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2004', 'P2010', 'P2034'].includes(error.code)) throw new ConflictException(message);
    throw error;
  }

  bookings() { return this.db.booking.findMany({ orderBy: { slot: { startsAt: 'asc' } }, include: bookingDetails, take: 500 }); }

  async overview() {
    const today = localDate();
    const day = new Date(`${today}T12:00:00Z`);
    const monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * 86400_000).toISOString().slice(0, 10);
    const nextMonday = new Date(Date.parse(`${monday}T12:00:00Z`) + 7 * 86400_000).toISOString().slice(0, 10);
    const [bookings, totalSlots] = await Promise.all([
      this.db.booking.findMany({ where: { slot: { startsAt: { gte: new Date(Date.now() - 8 * 86400_000) } } }, orderBy: { slot: { startsAt: 'asc' } }, include: bookingDetails }),
      this.db.slot.count({ where: { startsAt: { gt: new Date() } } }),
    ]);
    return {
      today: bookings.filter((row) => localDate(row.slot.startsAt) === today).length,
      thisWeek: bookings.filter((row) => localDate(row.slot.startsAt) >= monday && localDate(row.slot.startsAt) < nextMonday).length,
      totalSlots, upcoming: bookings.filter((row) => row.slot.startsAt > new Date()).slice(0, 5),
    };
  }
}
