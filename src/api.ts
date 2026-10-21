export type Subject = { id: string; name: string; code: string; icon: string };
export type Slot = { id: string; startsAt: string; endsAt: string; booking?: { id: string; name: string; subject: { name: string } } | null };
export type Booking = {
  id: string; name: string; email: string; question: string; subjectId: string; slotId: string;
  slot: Slot; subject: Subject; calendarStatus: string; requestKey: string;
};
export type Material = { id: string; title: string; subjectId: string; approved?: boolean; driveId?: string | null; content?: string };
export type IntegrationStatus = { googleConfigured: boolean; calendar: boolean; classroom: boolean; ai: boolean; model: string };
export type Overview = { today: number; thisWeek: number; totalSlots: number; upcoming: Booking[] };

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly fields: Record<string, string> = {}) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }); }
  catch { throw new ApiError('Could not connect. Check your connection and try again.', 0); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(typeof body.message === 'string' ? body.message : 'Please try again.', response.status, body.fields);
  return body;
}
export function write<T>(path: string, data: unknown, method = 'POST') { return api<T>(path, { method, body: JSON.stringify(data) }); }
export const go = (path: string) => { window.location.hash = path; };
export const TZ = 'Europe/Skopje';
export const dateKey = (value: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export const time = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const dateLabel = (value: string, full = false) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: full ? 'long' : 'short', month: 'short', day: 'numeric', ...(full && { year: 'numeric' }) }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
export const minutes = (slot: Slot) => Math.round((Date.parse(slot.endsAt) - Date.parse(slot.startsAt)) / 60_000);
export const addDays = (day: string, count: number) => new Date(Date.parse(`${day}T12:00:00Z`) + count * 86400_000).toISOString().slice(0, 10);
export const today = () => dateKey(new Date());
