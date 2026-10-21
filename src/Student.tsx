import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageSquare,
  Search,
  Sparkles,
} from "lucide-react";
import {
  addDays,
  ApiError,
  dateKey,
  go,
  minutes,
  time,
  today,
  write,
  type Booking,
  type Slot,
  type Subject,
} from "./api";
import {
  Button,
  Empty,
  ErrorNotice,
  Header,
  Loading,
  SlotSummary,
  SubjectHeader,
  SubjectIcon,
} from "./components";
import { useData } from "./useData";
import { useStudentSession } from "./session";

export function Subjects({ subjects }: { subjects: Subject[] }) {
  const [query, setQuery] = useState("");
  const filtered = subjects.filter((subject) =>
    `${subject.name} ${subject.code}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <Header />
      <main className="subjects-page">
        <h1>Choose a subject</h1>
        <label className="search-field">
          <Search size={21} />
          <input
            aria-label="Search subjects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search subjects…"
          />
          <kbd>/</kbd>
        </label>
        <div className="subject-grid">
          {filtered.map((subject) => (
            <a
              key={subject.id}
              className={`subject-card ${subject.icon}`}
              href={`#/subjects/${subject.id}`}
            >
              <SubjectIcon icon={subject.icon} />
              <div className="subject-card-copy">
                <span className="course-code">{subject.code}</span>
                <h2>{subject.name}</h2>
              </div>
              <span className="card-arrow">
                <ArrowRight size={20} />
              </span>
            </a>
          ))}
        </div>
        {!filtered.length && (
          <Empty
            icon={BookOpen}
            title={
              subjects.length
                ? "No subjects found"
                : "Subjects are on their way"
            }
          >
            {subjects.length
              ? "Try a different name or course code."
              : "Your professor hasn’t added any subjects yet."}
          </Empty>
        )}
      </main>
    </>
  );
}

export function TimeSelection({ subject }: { subject: Subject }) {
  const slots = useData<Slot[]>(
    `/slots?from=${today()}&to=${addDays(today(), 62)}`,
  );
  const [start, setStart] = useState(today());
  const [day, setDay] = useState(today());
  const [selected, setSelected] = useState<Slot>();
  const initialized = useRef(false);
  useEffect(() => {
    if (slots.data?.length && !initialized.current) {
      const first = dateKey(slots.data[0].startsAt);
      setStart(first);
      setDay(first);
      initialized.current = true;
    }
  }, [slots.data]);
  const days = Array.from({ length: 5 }, (_, index) => addDays(start, index));
  const available =
    slots.data?.filter((slot) => dateKey(slot.startsAt) === day) || [];
  function move(amount: number) {
    const next = addDays(start, amount);
    setStart(next);
    setDay(next);
    setSelected(undefined);
  }
  return (
    <>
      <Header />
      <main className="student-content">
        <a className="back-link" href="#/">
          <ArrowLeft size={15} />
          All subjects
        </a>
        <section className="panel subject-panel">
          <SubjectHeader subject={subject} tab="book" />
          <div className="booking-intro">
            <div>
              <h2>Choose a time</h2>
            </div>
            <span className="subtle-label">
              <Clock3 size={14} />
              Skopje time
            </span>
          </div>
          <div className="date-toolbar">
            <span>
              {new Intl.DateTimeFormat("en-GB", {
                month: "long",
                year: "numeric",
              }).format(new Date(`${start}T12:00:00Z`))}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Previous five days"
                disabled={start <= today()}
                onClick={() => move(-5)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next five days"
                disabled={addDays(start, 5) > addDays(today(), 58)}
                onClick={() => move(5)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="date-grid">
            {days.map((date) => (
              <button
                key={date}
                className={`date-card ${date === day ? "selected" : ""}`}
                aria-pressed={date === day}
                onClick={() => {
                  setDay(date);
                  setSelected(undefined);
                }}
              >
                <span>
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "short",
                  }).format(new Date(`${date}T12:00:00Z`))}
                </span>
                <strong>{new Date(`${date}T12:00:00Z`).getUTCDate()}</strong>
                <span
                  className={`availability-dot ${slots.data?.some((slot) => dateKey(slot.startsAt) === date) ? "has-slots" : ""}`}
                />
              </button>
            ))}
          </div>
          <div className="slot-section-heading">
            <span>AVAILABLE TIMES</span>
            <span>
              {available.length} {available.length === 1 ? "slot" : "slots"}
            </span>
          </div>
          {slots.error ? (
            <ErrorNotice message={slots.error} retry={slots.refresh} />
          ) : slots.loading ? (
            <Loading />
          ) : available.length ? (
            <div className="time-grid">
              {available.map((slot) => (
                <button
                  key={slot.id}
                  className={`time-card ${selected?.id === slot.id ? "selected" : ""}`}
                  aria-pressed={selected?.id === slot.id}
                  onClick={() => setSelected(slot)}
                >
                  {selected?.id === slot.id && (
                    <Check className="time-check" size={14} />
                  )}
                  <strong>{time(slot.startsAt)}</strong>
                  <span>{minutes(slot)} min</span>
                </button>
              ))}
            </div>
          ) : (
            <Empty title="No available times this day">
              Choose another day to find an open consultation.
            </Empty>
          )}
          <div className="slot-actions">
            <Button
              disabled={!selected || slots.loading}
              onClick={() =>
                selected && go(`/book/${subject.id}/${selected.id}`)
              }
            >
              Continue <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      </main>
    </>
  );
}

export function BookingForm({
  subject,
  slotId,
  onConfirmed,
}: {
  subject: Subject;
  slotId: string;
  onConfirmed: (booking: Booking) => void;
}) {
  const { profile } = useStudentSession();
  const slots = useData<Slot[]>(
    `/slots?from=${today()}&to=${addDays(today(), 62)}`,
  );
  const slot = slots.data?.find((value) => value.id === slotId);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  const lock = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!slot || !profile || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    setFields({});
    try {
      onConfirmed(
        await write<Booking>("/bookings", {
          ...profile,
          question: question.trim(),
          subjectId: subject.id,
          slotId,
          expectedStartsAt: slot.startsAt,
          expectedEndsAt: slot.endsAt,
          requestKey: requestKey.current,
        }),
      );
    } catch (error) {
      setError((error as Error).message);
      if (error instanceof ApiError) {
        setFields(error.fields);
        if ([404, 409].includes(error.status)) setConflict(true);
      }
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <Header />
      <main className="booking-page">
        <a className="back-link" href={`#/subjects/${subject.id}`}>
          <ArrowLeft size={15} />
          Choose another time
        </a>
        {slots.loading ? (
          <Loading />
        ) : slots.error ? (
          <ErrorNotice message={slots.error} retry={slots.refresh} />
        ) : !slot ? (
          <div className="panel">
            <Empty title="This time is no longer available">
              Choose another time.
            </Empty>
            <Button onClick={() => go(`/subjects/${subject.id}`)}>
              View available times <ArrowRight size={17} />
            </Button>
          </div>
        ) : (
          <div className="booking-columns">
            <section className="panel booking-form">
              <h1>Book consultation</h1>
              <div className="booking-profile">
                <span className="account-avatar">
                  {profile?.name
                    .split(" ")
                    .map((name) => name[0])
                    .join("")}
                </span>
                <div>
                  <strong>{profile?.name}</strong>
                  <span>{profile?.email}</span>
                </div>
              </div>
              <form onSubmit={submit}>
                <label>
                  What would you like to discuss?{" "}
                  <span className="muted label-optional">Optional</span>
                  <div className="input-with-icon textarea">
                    <MessageSquare size={18} />
                    <textarea
                      maxLength={2000}
                      rows={4}
                      aria-label="What would you like to discuss?"
                      aria-invalid={!!fields.question}
                      placeholder="Topic or question…"
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                    />
                  </div>
                  {fields.question && (
                    <span className="field-error">{fields.question}</span>
                  )}
                </label>
                {error && <ErrorNotice message={error} />}
                {conflict ? (
                  <Button onClick={() => go(`/subjects/${subject.id}`)}>
                    Choose another time <ArrowRight size={17} />
                  </Button>
                ) : (
                  <Button type="submit" disabled={pending}>
                    {pending ? "Confirming…" : "Confirm booking"}
                    {!pending && <ArrowRight size={18} />}
                  </Button>
                )}
              </form>
            </section>
            <aside className="panel booking-sidebar">
              <h2>Booking summary</h2>
              <SlotSummary subject={subject} slot={slot} />
            </aside>
          </div>
        )}
      </main>
    </>
  );
}

export function Confirmation({ booking }: { booking: Booking }) {
  return (
    <>
      <Header />
      <main className="confirmation-page">
        <span className="success-mark">
          <Check size={34} strokeWidth={2.4} />
        </span>
        <h1>Booking confirmed</h1>
        <section className="panel confirmation-card">
          <SlotSummary
            subject={booking.subject}
            slot={booking.slot}
            booking={booking}
          />
        </section>
        {booking.calendarStatus === "synced" && (
          <div className="success-notice">
            <CalendarCheck2 size={17} />
            Added to your professor’s Google Calendar.
          </div>
        )}
        <div className="confirmation-actions">
          <Button onClick={() => go("/")}>
            Subjects <ArrowRight size={17} />
          </Button>
          <Button
            secondary
            onClick={() => go(`/subjects/${booking.subject.id}/study`)}
          >
            <Sparkles size={17} />
            Study with AI
          </Button>
        </div>
      </main>
    </>
  );
}
