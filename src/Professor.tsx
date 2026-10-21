import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Home,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import {
  addDays,
  api,
  dateKey,
  dateLabel,
  time,
  today,
  write,
  type Booking,
  type Overview,
  type Slot,
  type Subject,
} from "./api";
import {
  Button,
  Empty,
  ErrorNotice,
  Loading,
  Logo,
  Modal,
  Pill,
  SlotSummary,
  SubjectIcon,
} from "./components";
import { useData } from "./useData";
import Integrations from "./Integrations";
import Materials from "./Materials";

type SlotDraft = { date: string; slot?: Slot };
export default function Professor({
  page,
  subjects,
  refreshSubjects,
}: {
  page: string;
  subjects: Subject[];
  refreshSubjects: () => void;
}) {
  const [draft, setDraft] = useState<SlotDraft>();
  const [version, setVersion] = useState(0);
  const [booking, setBooking] = useState<Booking>();
  const navigation = [
    { name: "Overview", path: "overview", icon: Home },
    { name: "Subjects", path: "subjects", icon: BookOpen },
    { name: "Availability", path: "availability", icon: CalendarDays },
    { name: "Bookings", path: "bookings", icon: FileText },
  ];
  const integrations = [
    { name: "Google Calendar", path: "calendar", icon: CalendarDays },
    { name: "Classroom", path: "classroom", icon: LayoutDashboard },
    { name: "AI & materials", path: "ai", icon: Sparkles },
  ];
  function updated() {
    setDraft(undefined);
    setVersion((value) => value + 1);
  }
  return (
    <div className="professor-shell">
      <aside className="sidebar">
        <Logo />
        <span className="sidebar-caption">PROFESSOR WORKSPACE</span>
        <nav aria-label="Professor navigation">
          {navigation.map(({ name, path, icon: Icon }) => (
            <a
              key={path}
              href={`#/professor/${path}`}
              aria-current={page === path ? "page" : undefined}
            >
              <Icon size={18} />
              {name}
            </a>
          ))}
          <a
            className="mobile-settings"
            href="#/professor/settings"
            aria-current={page === "settings" ? "page" : undefined}
          >
            <Settings size={18} />
            Settings
          </a>
        </nav>
        <div className="sidebar-divider" />
        <span className="sidebar-caption">INTEGRATIONS</span>
        <nav aria-label="Integration navigation">
          {integrations.map(({ name, path, icon: Icon }) => (
            <a
              key={path}
              href={`#/professor/${path}`}
              aria-current={page === path ? "page" : undefined}
            >
              <Icon size={18} />
              {name}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a className="sidebar-setting" href="#/professor/settings">
            <Settings size={18} />
            Settings
          </a>
          <a href="#/" className="student-view">
            <ArrowLeft size={14} />
            Student view <ExternalLink size={12} />
          </a>
          <span className="local-label">
            <LockKeyhole size={11} />
            Local demonstration
          </span>
        </div>
      </aside>
      <div className="professor-main">
        <div className="professor-topbar">
          <span>
            <span className="breadcrumb">Workspace</span>
            <span className="breadcrumb-separator">/</span>
            {navigation.find((item) => item.path === page)?.name ||
              integrations.find((item) => item.path === page)?.name ||
              "Settings"}
          </span>
          <span className="workspace-profile">
            <span className="status-dot" />
            Professor workspace<span className="profile-avatar">P</span>
          </span>
        </div>
        <main className="professor-content">
          {page === "overview" ? (
            <Dashboard
              key={version}
              newSlot={() => setDraft({ date: today() })}
              viewBooking={setBooking}
            />
          ) : page === "availability" ? (
            <Availability
              key={version}
              newSlot={(date) => setDraft({ date })}
              editSlot={(slot) =>
                setDraft({ date: dateKey(slot.startsAt), slot })
              }
              onRemoved={updated}
            />
          ) : page === "subjects" ? (
            <SubjectManagement subjects={subjects} refresh={refreshSubjects} />
          ) : page === "bookings" ? (
            <BookingList key={version} viewBooking={setBooking} />
          ) : page === "ai" ? (
            <Materials subjects={subjects} />
          ) : (
            <Integrations page={page} refreshSubjects={refreshSubjects} />
          )}
        </main>
        <footer className="professor-footer">
          <span>ConsultAI</span>
          <span>Europe/Skopje</span>
        </footer>
      </div>
      {draft && (
        <SlotEditor
          draft={draft}
          close={() => setDraft(undefined)}
          saved={updated}
        />
      )}
      {booking && (
        <BookingDetails booking={booking} close={() => setBooking(undefined)} />
      )}
    </div>
  );
}

function Dashboard({
  newSlot,
  viewBooking,
}: {
  newSlot: () => void;
  viewBooking: (booking: Booking) => void;
}) {
  const overview = useData<Overview>("/admin/overview");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
        </div>
        <Button onClick={newSlot}>
          <Plus size={17} />
          New slot
        </Button>
      </div>
      {overview.error ? (
        <ErrorNotice message={overview.error} retry={overview.refresh} />
      ) : overview.loading ? (
        <Loading />
      ) : (
        overview.data && (
          <>
            <div className="stat-grid">
              {[
                {
                  label: "Consultations today",
                  value: overview.data.today,
                  icon: CalendarDays,
                  color: "blue",
                },
                {
                  label: "Bookings this week",
                  value: overview.data.thisWeek,
                  icon: UsersRound,
                  color: "purple",
                },
                {
                  label: "Upcoming slots",
                  value: overview.data.totalSlots,
                  icon: Clock3,
                  color: "orange",
                },
              ].map(({ label, value, icon: Icon, color }) => (
                <div className="stat-card" key={label}>
                  <span className={`stat-icon ${color}`}>
                    <Icon size={24} strokeWidth={1.7} />
                  </span>
                  <div>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                </div>
              ))}
            </div>
            <section className="panel consultation-panel">
              <div className="section-heading">
                <div>
                  <h2>Upcoming consultations</h2>
                </div>
                <a className="text-link" href="#/professor/bookings">
                  View all <ArrowRight size={15} />
                </a>
              </div>
              {overview.data.upcoming.length ? (
                <ConsultationRows
                  bookings={overview.data.upcoming}
                  viewBooking={viewBooking}
                />
              ) : (
                <Empty title="No upcoming consultations" />
              )}
            </section>
          </>
        )
      )}
    </>
  );
}

function ConsultationRows({
  bookings,
  viewBooking,
}: {
  bookings: Booking[];
  viewBooking: (booking: Booking) => void;
}) {
  return (
    <div className="consultation-rows">
      {bookings.map((booking) => (
        <button
          className="consultation-row"
          key={booking.id}
          onClick={() => viewBooking(booking)}
          aria-label={`View booking for ${booking.name}`}
        >
          <span className="consultation-time">
            <strong>{time(booking.slot.startsAt)}</strong>
            <span>{dateLabel(booking.slot.startsAt)}</span>
          </span>
          <span className="consultation-person">
            <span className="student-avatar">
              {booking.name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((word) => word[0])
                .join("")}
            </span>
            <span>
              <strong>{booking.name}</strong>
              <span>{booking.email}</span>
            </span>
          </span>
          <span className="consultation-subject">
            <SubjectIcon icon={booking.subject.icon} small />
            <span>{booking.subject.name}</span>
          </span>
          <span className="consultation-question">
            {booking.question || "No question added"}
          </span>
          <ChevronRight size={17} />
        </button>
      ))}
    </div>
  );
}

function BookingList({
  viewBooking,
}: {
  viewBooking: (booking: Booking) => void;
}) {
  const bookings = useData<Booking[]>("/admin/bookings");
  const [filter, setFilter] = useState("upcoming");
  const [query, setQuery] = useState("");
  const filtered = (bookings.data || []).filter(
    (booking) =>
      (filter === "all" || Date.parse(booking.slot.endsAt) > Date.now()) &&
      `${booking.name} ${booking.email} ${booking.subject.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Bookings</h1>
        </div>
        <Pill>{filtered.length} consultations</Pill>
      </div>
      <div className="list-toolbar">
        <div className="segmented">
          <button
            aria-pressed={filter === "upcoming"}
            onClick={() => setFilter("upcoming")}
          >
            Upcoming
          </button>
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All bookings
          </button>
        </div>
        <label className="compact-search">
          <Search size={16} />
          <input
            placeholder="Find a student or subject…"
            aria-label="Search bookings"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <section className="panel consultation-panel">
        {bookings.loading ? (
          <Loading />
        ) : bookings.error ? (
          <ErrorNotice message={bookings.error} retry={bookings.refresh} />
        ) : filtered.length ? (
          <ConsultationRows bookings={filtered} viewBooking={viewBooking} />
        ) : (
          <Empty title="No consultations here yet">
            Confirmed bookings will appear here with student details and
            questions.
          </Empty>
        )}
      </section>
    </>
  );
}

function BookingDetails({
  booking,
  close,
}: {
  booking: Booking;
  close: () => void;
}) {
  return (
    <Modal title="Consultation details" close={close}>
      <SlotSummary
        subject={booking.subject}
        slot={booking.slot}
        booking={booking}
      />
      <div className="question-detail">
        <span className="eyebrow">STUDENT’S QUESTION</span>
        <p>{booking.question || "No question was added to this booking."}</p>
      </div>
      <div className="modal-actions">
        <Button secondary onClick={close}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

function Availability({
  newSlot,
  editSlot,
  onRemoved,
}: {
  newSlot: (date: string) => void;
  editSlot: (slot: Slot) => void;
  onRemoved: () => void;
}) {
  const monday = (date: string) =>
    addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
  const [week, setWeek] = useState(monday(today()));
  const [removing, setRemoving] = useState<Slot>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const slots = useData<Slot[]>(
    `/admin/slots?from=${week}&to=${addDays(week, 6)}`,
  );
  async function remove() {
    if (!removing || pending) return;
    setPending(true);
    setError("");
    try {
      await api(`/admin/slots/${removing.id}`, { method: "DELETE" });
      setRemoving(undefined);
      slots.refresh();
      onRemoved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Availability</h1>
          <p>Shared across all subjects.</p>
        </div>
        <Button onClick={() => newSlot(today())}>
          <Plus size={17} />
          New slot
        </Button>
      </div>
      <section className="panel weekly-panel">
        <div className="week-toolbar">
          <div>
            <button
              className="icon-button"
              aria-label="Previous week"
              onClick={() => setWeek(addDays(week, -7))}
            >
              <ChevronLeft size={18} />
            </button>
            <strong>
              {dateLabel(week)} – {dateLabel(addDays(week, 6))}
            </strong>
            <button
              className="icon-button"
              aria-label="Next week"
              onClick={() => setWeek(addDays(week, 7))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            className="text-link"
            onClick={() => setWeek(monday(today()))}
          >
            This week
          </button>
        </div>
        {slots.loading ? (
          <Loading />
        ) : slots.error ? (
          <ErrorNotice message={slots.error} retry={slots.refresh} />
        ) : (
          <div className="weekly-rows">
            {Array.from({ length: 7 }, (_, index) => addDays(week, index)).map(
              (day) => (
                <div
                  key={day}
                  className={`weekly-row ${day === today() ? "is-today" : ""}`}
                >
                  <div className="weekly-day">
                    <strong>
                      {new Intl.DateTimeFormat("en-GB", {
                        weekday: "short",
                      }).format(new Date(`${day}T12:00:00Z`))}
                      {day === today() && <span className="today-dot" />}
                    </strong>
                    <span>
                      {new Intl.DateTimeFormat("en-GB", {
                        month: "short",
                        day: "numeric",
                      }).format(new Date(`${day}T12:00:00Z`))}
                    </span>
                  </div>
                  <div className="weekly-slots">
                    {slots.data
                      ?.filter((slot) => dateKey(slot.startsAt) === day)
                      .map((slot) => (
                        <div
                          className={`weekly-slot ${slot.booking ? "booked" : ""}`}
                          key={slot.id}
                        >
                          <button
                            onClick={() => !slot.booking && editSlot(slot)}
                            disabled={
                              !!slot.booking ||
                              Date.parse(slot.startsAt) <= Date.now()
                            }
                            aria-label={
                              slot.booking
                                ? `Booked by ${slot.booking.name}`
                                : `Edit slot ${time(slot.startsAt)} on ${dateLabel(day)}`
                            }
                          >
                            <Clock3 size={13} />
                            <span>
                              {time(slot.startsAt)} – {time(slot.endsAt)}
                            </span>
                            {slot.booking && (
                              <span className="slot-booked-dot" />
                            )}
                          </button>
                          {!slot.booking && (
                            <button
                              className="remove-slot"
                              onClick={() => setRemoving(slot)}
                              aria-label={`Remove slot ${time(slot.startsAt)} on ${dateLabel(day)}`}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    {!slots.data?.some(
                      (slot) => dateKey(slot.startsAt) === day,
                    ) && <span className="no-slots">No availability</span>}
                  </div>
                  <button
                    className="add-day-slot"
                    onClick={() => newSlot(day)}
                    disabled={day < today()}
                  >
                    <Plus size={14} />
                    <span>Add slot</span>
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </section>
      {removing && (
        <Modal
          title="Remove this slot?"
          close={() => !pending && setRemoving(undefined)}
        >
          <p>
            This will remove the unbooked slot on{" "}
            <strong>{dateLabel(removing.startsAt)}</strong>,{" "}
            <strong>
              {time(removing.startsAt)} – {time(removing.endsAt)}
            </strong>
            , from every subject.
          </p>
          {error && <ErrorNotice message={error} />}
          <div className="modal-actions">
            <Button
              secondary
              onClick={() => setRemoving(undefined)}
              disabled={pending}
            >
              Keep slot
            </Button>
            <Button onClick={remove} disabled={pending}>
              {pending ? "Removing…" : "Remove slot"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function SlotEditor({
  draft,
  close,
  saved,
}: {
  draft: SlotDraft;
  close: () => void;
  saved: () => void;
}) {
  const [values, setValues] = useState({
    date: draft.date,
    startTime: draft.slot ? time(draft.slot.startsAt) : "09:00",
    duration: draft.slot
      ? Math.round(
          (Date.parse(draft.slot.endsAt) - Date.parse(draft.slot.startsAt)) /
            60_000,
        )
      : 30,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await write(
        `/admin/slots${draft.slot ? `/${draft.slot.id}` : ""}`,
        values,
        draft.slot ? "PATCH" : "POST",
      );
      saved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title={draft.slot ? "Edit slot" : "New slot"}
      close={() => !pending && close()}
    >
      <form onSubmit={submit}>
        <label>
          Date
          <input
            type="date"
            required
            min={today()}
            value={values.date}
            onChange={(event) =>
              setValues({ ...values, date: event.target.value })
            }
          />
        </label>
        <div className="form-two-columns">
          <label>
            Start time
            <input
              type="time"
              required
              value={values.startTime}
              onChange={(event) =>
                setValues({ ...values, startTime: event.target.value })
              }
            />
          </label>
          <label>
            Duration
            <select
              value={values.duration}
              onChange={(event) =>
                setValues({ ...values, duration: Number(event.target.value) })
              }
            >
              {[15, 30, 45, 60, 90, 120, 180].map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-info">
          <Link2 size={15} />
          Available for all subjects <span>Europe/Skopje</span>
        </div>
        {error && <ErrorNotice message={error} />}
        <div className="modal-actions">
          <Button secondary onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save time slot"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SubjectManagement({
  subjects,
  refresh,
}: {
  subjects: Subject[];
  refresh: () => void;
}) {
  const [editing, setEditing] = useState<Partial<Subject>>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing || pending) return;
    setPending(true);
    setError("");
    try {
      await write(
        `/admin/subjects${editing.id ? `/${editing.id}` : ""}`,
        {
          name: editing.name,
          code: editing.code,
          icon: editing.icon || "book",
        },
        editing.id ? "PATCH" : "POST",
      );
      setEditing(undefined);
      refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Subjects</h1>
        </div>
        <Button
          onClick={() => {
            setEditing({ name: "", code: "", icon: "book" });
            setError("");
          }}
        >
          <Plus size={17} />
          Add subject
        </Button>
      </div>
      <div className="managed-subjects">
        {subjects.map((subject) => (
          <section className="panel managed-subject" key={subject.id}>
            <SubjectIcon icon={subject.icon} />
            <span className="course-code">{subject.code}</span>
            <h2>{subject.name}</h2>
            <div>
              <span>Shared consultation schedule</span>
              <button
                className="icon-button"
                aria-label={`Edit ${subject.name}`}
                onClick={() => {
                  setEditing(subject);
                  setError("");
                }}
              >
                <Pencil size={15} />
              </button>
            </div>
          </section>
        ))}
      </div>
      {!subjects.length && (
        <Empty icon={BookOpen} title="Add your first subject">
          Students will see your subjects on the home page.
        </Empty>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit subject" : "Add a subject"}
          close={() => !pending && setEditing(undefined)}
        >
          <form onSubmit={submit}>
            <label>
              Subject name
              <input
                required
                minLength={2}
                maxLength={100}
                placeholder="e.g. Data Structures"
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </label>
            <label>
              Course code
              <input
                required
                minLength={2}
                maxLength={20}
                pattern="[a-zA-Z0-9 _\-]+"
                placeholder="e.g. CS101"
                value={editing.code}
                onChange={(event) =>
                  setEditing({ ...editing, code: event.target.value })
                }
              />
            </label>
            <label>
              Subject icon
              <select
                value={editing.icon}
                onChange={(event) =>
                  setEditing({ ...editing, icon: event.target.value })
                }
              >
                <option value="database">Database</option>
                <option value="network">Algorithms</option>
                <option value="code">Development</option>
                <option value="book">Book</option>
              </select>
            </label>
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions">
              <Button
                secondary
                onClick={() => setEditing(undefined)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save subject"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
