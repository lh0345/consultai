import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, GraduationCap, LockKeyhole, Mail, MessageSquare, Search, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { addDays, ApiError, dateKey, dateLabel, go, minutes, time, today, write, type Booking, type Slot, type Subject } from './api';
import { Button, Empty, ErrorNotice, Header, Loading, SlotSummary, SubjectHeader, SubjectIcon } from './components';
import { useData } from './useData';

export function Subjects({ subjects }: { subjects: Subject[] }) {
  const [query, setQuery] = useState('');
  const filtered = subjects.filter((subject) => `${subject.name} ${subject.code}`.toLowerCase().includes(query.toLowerCase()));
  return <><Header /><main className="subjects-page"><span className="intro-chip"><GraduationCap size={15} /> A LITTLE GUIDANCE GOES A LONG WAY</span><h1>What subject do you<br className="mobile-break" /> need help with?</h1><p className="intro-description">Good questions lead to great understanding.<br />Find your subject and make time to connect.</p><label className="search-field"><Search size={21} /><input aria-label="Search subjects" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by subject or course code…" /><kbd>/</kbd></label><div className="subject-grid">{filtered.map((subject) => <a key={subject.id} className={`subject-card ${subject.icon}`} href={`#/subjects/${subject.id}`}><SubjectIcon icon={subject.icon} /><div className="subject-card-copy"><span className="course-code">{subject.code}</span><h2>{subject.name}</h2><p>Explore consultation times</p></div><span className="card-arrow"><ArrowRight size={20} /></span></a>)}</div>{!filtered.length && <Empty icon={BookOpen} title={subjects.length ? 'No subjects found' : 'Subjects are on their way'}>{subjects.length ? 'Try a different name or course code.' : 'Your professor hasn’t added any subjects yet.'}</Empty>}<div className="subjects-note"><Clock3 size={15} /><span>A focused conversation. A clearer way forward.</span></div></main><footer className="student-footer"><span>Built for curious minds.</span><span>ConsultAI <span className="footer-dot">·</span> University consultations</span></footer></>;
}

export function TimeSelection({ subject }: { subject: Subject }) {
  const slots = useData<Slot[]>(`/slots?from=${today()}&to=${addDays(today(), 62)}`);
  const [start, setStart] = useState(today());
  const [day, setDay] = useState(today());
  const [selected, setSelected] = useState<Slot>();
  const initialized = useRef(false);
  useEffect(() => {
    if (slots.data?.length && !initialized.current) {
      const first = dateKey(slots.data[0].startsAt);
      setStart(first); setDay(first); initialized.current = true;
    }
  }, [slots.data]);
  const days = Array.from({ length: 5 }, (_, index) => addDays(start, index));
  const available = slots.data?.filter((slot) => dateKey(slot.startsAt) === day) || [];
  function move(amount: number) { const next = addDays(start, amount); setStart(next); setDay(next); setSelected(undefined); }
  return <><Header /><main className="student-content"><a className="back-link" href="#/"><ArrowLeft size={15} />All subjects</a><section className="panel subject-panel"><SubjectHeader subject={subject} tab="book" /><div className="booking-intro"><div><h2>Let’s find a time that works.</h2><p className="muted">Choose a day, then pick your consultation time.</p></div><span className="subtle-label"><Clock3 size={14} />All times in Skopje</span></div><div className="date-toolbar"><span>{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${start}T12:00:00Z`))}</span><div><button className="icon-button" aria-label="Previous five days" disabled={start <= today()} onClick={() => move(-5)}><ChevronLeft size={18} /></button><button className="icon-button" aria-label="Next five days" disabled={addDays(start, 5) > addDays(today(), 58)} onClick={() => move(5)}><ChevronRight size={18} /></button></div></div><div className="date-grid">{days.map((date) => <button key={date} className={`date-card ${date === day ? 'selected' : ''}`} aria-pressed={date === day} onClick={() => { setDay(date); setSelected(undefined); }}><span>{new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(new Date(`${date}T12:00:00Z`))}</span><strong>{new Date(`${date}T12:00:00Z`).getUTCDate()}</strong><span className={`availability-dot ${slots.data?.some((slot) => dateKey(slot.startsAt) === date) ? 'has-slots' : ''}`} /></button>)}</div><div className="slot-section-heading"><span>AVAILABLE TIMES</span><span>{available.length} slots</span></div>{slots.error ? <ErrorNotice message={slots.error} retry={slots.refresh} /> : slots.loading ? <Loading /> : available.length ? <div className="time-grid">{available.map((slot) => <button key={slot.id} className={`time-card ${selected?.id === slot.id ? 'selected' : ''}`} aria-pressed={selected?.id === slot.id} onClick={() => setSelected(slot)}>{selected?.id === slot.id && <Check className="time-check" size={14} />}<strong>{time(slot.startsAt)}</strong><span>{minutes(slot)} min</span></button>)}</div> : <Empty title="No available times this day">Choose another day to find an open consultation.</Empty>}<div className="slot-actions"><p><ShieldCheck size={17} />Your time, set aside for you.</p><Button disabled={!selected || slots.loading} onClick={() => selected && go(`/book/${subject.id}/${selected.id}`)}>Continue <ArrowRight size={17} /></Button></div></section></main></>;
}

export function BookingForm({ subject, slotId, onConfirmed }: { subject: Subject; slotId: string; onConfirmed: (booking: Booking) => void }) {
  const slots = useData<Slot[]>(`/slots?from=${today()}&to=${addDays(today(), 62)}`);
  const slot = slots.data?.find((value) => value.id === slotId);
  const [values, setValues] = useState({ name: '', email: '', question: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  const lock = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!slot || lock.current) return;
    lock.current = true; setPending(true); setError(''); setFields({});
    try { onConfirmed(await write<Booking>('/bookings', { ...values, name: values.name.trim(), email: values.email.trim(), subjectId: subject.id, slotId, requestKey: requestKey.current })); }
    catch (error) {
      setError((error as Error).message);
      if (error instanceof ApiError) { setFields(error.fields); if ([404, 409].includes(error.status)) setConflict(true); }
    } finally { lock.current = false; setPending(false); }
  }
  const change = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return <><Header /><main className="booking-page"><a className="back-link" href={`#/subjects/${subject.id}`}><ArrowLeft size={15} />Choose another time</a>{slots.loading ? <Loading /> : slots.error ? <ErrorNotice message={slots.error} retry={slots.refresh} /> : !slot ? <div className="panel"><Empty title="This time is no longer available">Someone may have booked it. There are other times to connect.</Empty><Button onClick={() => go(`/subjects/${subject.id}`)}>View available times <ArrowRight size={17} /></Button></div> : <div className="booking-columns"><section className="panel booking-form"><span className="eyebrow">ONE STEP TO A CLEARER UNDERSTANDING</span><h1>Book this slot</h1><p className="muted">A few details, and you’re all set.</p><div className="booking-recap"><SubjectIcon icon={subject.icon} small /><div><strong>{subject.name}</strong><span>{subject.code}</span></div><div className="recap-time"><CalendarDays size={18} /><div><strong>{dateLabel(slot.startsAt)}</strong><span>{time(slot.startsAt)} – {time(slot.endsAt)}</span></div></div></div><form onSubmit={submit}><label>Your name<div className="input-with-icon"><UserRound size={18} /><input required minLength={2} maxLength={100} autoComplete="name" placeholder="Your full name" value={values.name} onChange={(event) => change('name', event.target.value)} aria-invalid={!!fields.name} /></div>{fields.name && <span className="field-error">{fields.name}</span>}</label><label>Your email<div className="input-with-icon"><Mail size={18} /><input required type="email" maxLength={254} autoComplete="email" placeholder="you@university.edu" value={values.email} onChange={(event) => change('email', event.target.value)} aria-invalid={!!fields.email} /></div>{fields.email && <span className="field-error">{fields.email}</span>}</label><label>What would you like to discuss? <span className="muted label-optional">Optional</span><div className="input-with-icon textarea"><MessageSquare size={18} /><textarea maxLength={2000} rows={4} placeholder="A concept, a question, a problem you’re working on…" value={values.question} onChange={(event) => change('question', event.target.value)} /></div><span className="field-hint">Help your professor prepare for your conversation.</span></label>{error && <ErrorNotice message={error} />}{conflict ? <Button onClick={() => go(`/subjects/${subject.id}`)}>Choose another time <ArrowRight size={17} /></Button> : <Button type="submit" disabled={pending}>{pending ? 'Confirming…' : 'Confirm booking'}{!pending && <ArrowRight size={18} />}</Button>}<p className="privacy-note"><LockKeyhole size={13} />Your details are shared only with your professor.</p></form></section><aside className="panel booking-sidebar"><h2>Booking summary</h2><SlotSummary subject={subject} slot={slot} /><div className="summary-note"><CalendarCheck2 size={18} /><p>A little preparation makes a big difference. Bring your questions.</p></div></aside></div>}</main></>;
}

export function Confirmation({ booking }: { booking: Booking }) {
  return <><Header /><main className="confirmation-page"><span className="success-mark"><Check size={34} strokeWidth={2.4} /></span><span className="eyebrow">YOU’RE ALL SET</span><h1>Booking confirmed</h1><p className="muted">Your consultation is confirmed. We’ll see you there.</p><section className="panel confirmation-card"><SlotSummary subject={booking.subject} slot={booking.slot} booking={booking} /></section>{booking.calendarStatus === 'synced' && <div className="success-notice"><CalendarCheck2 size={17} />Added to your professor’s Google Calendar.</div>}<div className="confirmation-actions"><Button onClick={() => go('/')}>Back to subjects <ArrowRight size={17} /></Button><Button secondary onClick={() => go(`/subjects/${booking.subject.id}/study`)}><Sparkles size={17} />Study before you meet</Button></div></main></>;
}
