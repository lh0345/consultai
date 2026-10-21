import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ExternalLink,
  Info,
  Link2,
  LockKeyhole,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  dateLabel,
  time,
  write,
  type Booking,
  type IntegrationStatus,
} from "./api";
import { Button, Empty, ErrorNotice, Loading, Modal, Pill } from "./components";
import { useData } from "./useData";

export default function Integrations({
  page,
  refreshSubjects,
}: {
  page: string;
  refreshSubjects: () => void;
}) {
  const status = useData<IntegrationStatus>("/admin/integrations");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const service = page === "classroom" ? "classroom" : "calendar";
  const result = new URLSearchParams(location.hash.split("?")[1]).get("google");
  async function connect() {
    setPending(true);
    setError("");
    try {
      const connection = await write<{ url: string }>(
        "/admin/integrations/google/connect",
        { service },
      );
      location.assign(connection.url);
    } catch (error) {
      setError((error as Error).message);
      setPending(false);
    }
  }
  const settings = page === "settings";
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {settings
              ? "Settings & integrations"
              : service === "calendar"
                ? "Google Calendar"
                : "Google Classroom"}
          </h1>
          <p>
            {settings
              ? "A few useful connections. Always optional."
              : service === "calendar"
                ? "A schedule that works with your day."
                : "Bring your courses and materials together."}
          </p>
        </div>
        <span className="integration-heading-icon">
          {settings ? (
            <Settings size={23} />
          ) : service === "calendar" ? (
            <CalendarDays size={23} />
          ) : (
            <BookOpen size={23} />
          )}
        </span>
      </div>
      {status.loading ? (
        <Loading />
      ) : status.error ? (
        <ErrorNotice message={status.error} retry={status.refresh} />
      ) : (
        status.data && (
          <>
            {result === "connected" && (
              <div className="success-notice">
                <Check size={16} />
                Google permissions were saved.
              </div>
            )}
            {["failed", "declined"].includes(result || "") && (
              <ErrorNotice
                message={
                  result === "declined"
                    ? "Google permissions weren’t granted. You can try again."
                    : "The connection could not be completed. Check the server settings and try again."
                }
              />
            )}
            {settings ? (
              <>
                <div className="settings-cards">
                  {[
                    {
                      title: "Google Calendar",
                      icon: CalendarDays,
                      connected: status.data.calendar,
                      path: "calendar",
                      description:
                        "Check busy times and keep confirmed bookings in sync.",
                    },
                    {
                      title: "Google Classroom",
                      icon: BookOpen,
                      connected: status.data.classroom,
                      path: "classroom",
                      description:
                        "Import your subjects and review materials before sharing with AI.",
                    },
                    {
                      title: "Study assistant",
                      icon: Sparkles,
                      connected: status.data.ai,
                      path: "ai",
                      description:
                        "Help students understand professor-approved course content.",
                    },
                  ].map(
                    ({ title, icon: Icon, connected, path, description }) => (
                      <a
                        href={`#/professor/${path}`}
                        key={title}
                        className="panel settings-card"
                      >
                        <span className="settings-icon">
                          <Icon size={23} />
                        </span>
                        <div>
                          <h2>{title}</h2>
                          <p>{description}</p>
                        </div>
                        <Pill success={connected}>
                          {connected ? "Ready" : "Not connected"}
                        </Pill>
                        <ArrowRight size={15} />
                      </a>
                    ),
                  )}
                </div>
                <div className="local-demo-notice">
                  <LockKeyhole size={18} />
                  <div>
                    <strong>A local workspace</strong>
                    <p>
                      Professor management has no account protection. Use it
                      only on this computer.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <section className="panel connection-panel">
                <div className="connection-title">
                  <span className="settings-icon">
                    {service === "calendar" ? (
                      <CalendarDays size={26} />
                    ) : (
                      <BookOpen size={26} />
                    )}
                  </span>
                  <div>
                    <h2>
                      {service === "calendar"
                        ? "Your calendar, connected"
                        : "Your teaching, in one place"}
                    </h2>
                    <Pill success={status.data[service]}>
                      {status.data[service] ? "Connected" : "Not connected"}
                    </Pill>
                  </div>
                </div>
                <p className="connection-description">
                  {service === "calendar"
                    ? "Busy times on your primary calendar stay out of student availability. Confirmed consultations are added to your calendar."
                    : "Import courses you teach, then choose which materials the study assistant can use."}
                </p>
                <div className="connection-benefits">
                  {(service === "calendar"
                    ? [
                        "Hide calendar conflicts before booking",
                        "Create an event for each confirmed consultation",
                        "Retry failed syncs without duplicate events",
                      ]
                    : [
                        "Import your subjects from Classroom",
                        "Review Drive references in a private workspace",
                        "Approve materials before students can use them with AI",
                      ]
                  ).map((text) => (
                    <div key={text}>
                      <Check size={14} />
                      {text}
                    </div>
                  ))}
                </div>
                {!status.data.googleConfigured && (
                  <div className="setup-notice">
                    <Info size={17} />
                    <div>
                      <strong>Server setup needed</strong>
                      <p>
                        Add the Google OAuth credentials and encryption key in
                        your server environment, then restart. Setup steps are
                        in the project README.
                      </p>
                    </div>
                  </div>
                )}
                {error && <ErrorNotice message={error} />}
                <Button
                  disabled={pending || !status.data.googleConfigured}
                  onClick={connect}
                >
                  <Link2 size={16} />
                  {pending
                    ? "Connecting…"
                    : status.data[service]
                      ? "Reconnect Google"
                      : "Connect Google account"}
                  <ExternalLink size={13} />
                </Button>
                <p className="connection-footnote">
                  <ShieldCheck size={13} />
                  Tokens stay encrypted on the server. Booking works without a
                  connection.
                </p>
              </section>
            )}
            {!settings && service === "calendar" && status.data.calendar && (
              <CalendarRetries />
            )}
            {!settings && service === "classroom" && status.data.classroom && (
              <ClassroomCourses refreshSubjects={refreshSubjects} />
            )}
          </>
        )
      )}
    </>
  );
}

function CalendarRetries() {
  const pending = useData<Booking[]>("/admin/calendar-sync");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  async function retry(id: string) {
    if (working) return;
    setWorking(id);
    setError("");
    try {
      const result = await write<Booking>(`/admin/bookings/${id}/calendar`, {});
      if (result.calendarStatus !== "synced")
        setError(
          "The booking is safe, but Google sync is still unavailable. Please retry later.",
        );
      pending.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setWorking("");
    }
  }
  return (
    <section className="panel sync-panel">
      <div className="section-heading">
        <h2>Calendar sync</h2>
        <Pill>{pending.data?.length || 0} to review</Pill>
      </div>
      {error && <ErrorNotice message={error} />}
      {pending.loading ? (
        <Loading />
      ) : pending.error ? (
        <ErrorNotice message={pending.error} retry={pending.refresh} />
      ) : !pending.data?.length ? (
        <Empty title="All caught up">
          No consultations are waiting for calendar sync.
        </Empty>
      ) : (
        pending.data.map((booking) => (
          <div className="sync-row" key={booking.id}>
            <div>
              <strong>{booking.name}</strong>
              <span>
                {booking.subject.name} · {dateLabel(booking.slot.startsAt)} ·{" "}
                {time(booking.slot.startsAt)}
              </span>
            </div>
            <Button
              secondary
              disabled={!!working}
              onClick={() => retry(booking.id)}
            >
              <RefreshCw size={13} />
              {working === booking.id ? "Retrying…" : "Retry sync"}
            </Button>
          </div>
        ))
      )}
    </section>
  );
}

type Course = {
  id: string;
  name: string;
  section?: string;
  importedSubjectId?: string;
};
function ClassroomCourses({
  refreshSubjects,
}: {
  refreshSubjects: () => void;
}) {
  const courses = useData<Course[]>("/admin/classroom/courses");
  const [course, setCourse] = useState<Course>();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function importCourse(event: FormEvent) {
    event.preventDefault();
    if (!course || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await write("/admin/classroom/courses", { courseId: course.id, code });
      setCourse(undefined);
      courses.refresh();
      refreshSubjects();
      setMessage(
        "Subject imported. You can now import its material references.",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function importMaterials(course: Course) {
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await write<{ imported: number }>(
        "/admin/classroom/materials",
        { subjectId: course.importedSubjectId },
      );
      setMessage(
        `${result.imported} new Drive references imported. Review them in AI & materials before approving.`,
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel sync-panel">
      <div className="section-heading">
        <h2>Your teaching courses</h2>
        <button className="text-link" onClick={courses.refresh}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
      {error && !course && <ErrorNotice message={error} />}
      {message && (
        <div className="success-notice">
          <Check size={15} />
          {message}
        </div>
      )}
      {courses.loading ? (
        <Loading />
      ) : courses.error ? (
        <ErrorNotice message={courses.error} retry={courses.refresh} />
      ) : !courses.data?.length ? (
        <Empty icon={BookOpen} title="No active teaching courses">
          Courses where you are a teacher will appear here.
        </Empty>
      ) : (
        courses.data.map((item) => (
          <div className="sync-row" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>
                {item.section ||
                  (item.importedSubjectId
                    ? "Subject imported"
                    : "Ready to import")}
              </span>
            </div>
            <Button
              secondary
              disabled={pending}
              onClick={() => {
                if (item.importedSubjectId) void importMaterials(item);
                else {
                  setCourse(item);
                  setCode("");
                  setError("");
                }
              }}
            >
              {item.importedSubjectId ? "Import materials" : "Import subject"}
              <ArrowRight size={13} />
            </Button>
          </div>
        ))
      )}
      <p className="connection-footnote">
        <LockKeyhole size={13} />
        Imports are private until you load, review, and approve course text.
      </p>
      {course && (
        <Modal
          title="Import a Classroom subject"
          close={() => !pending && setCourse(undefined)}
        >
          <p className="muted">{course.name}</p>
          <form onSubmit={importCourse}>
            <label>
              Course code
              <input
                required
                minLength={2}
                maxLength={20}
                pattern="[a-zA-Z0-9 _\-]+"
                placeholder="e.g. CS101"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions">
              <Button
                secondary
                onClick={() => setCourse(undefined)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Importing…" : "Import subject"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
