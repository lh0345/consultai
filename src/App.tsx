import { useEffect, useState } from "react";
import { go, type Booking, type Subject } from "./api";
import { Empty, ErrorNotice, Header, Loading } from "./components";
import { BookingForm, Confirmation, Subjects, TimeSelection } from "./Student";
import { useData } from "./useData";
import Professor from "./Professor";
import Study from "./Study";
import SignIn from "./SignIn";
import { useStudentSession } from "./session";
import ProfessorAccess from "./ProfessorAccess";

export default function App() {
  const { profile, loading: sessionLoading } = useStudentSession();
  const [route, setRoute] = useState(location.hash.slice(1) || "/");
  const [booking, setBooking] = useState<Booking | null>(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("consultai-confirmation") || "null",
      );
    } catch {
      return null;
    }
  });
  const subjects = useData<Subject[]>("/subjects");
  useEffect(() => {
    if (
      !sessionLoading &&
      (!profile || (booking && booking.email !== profile.email))
    )
      setBooking(null);
  }, [profile, sessionLoading, booking]);
  useEffect(() => {
    const update = () => {
      setRoute(location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    const slash = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (event.target as HTMLElement).tagName,
        )
      ) {
        const search = document.querySelector<HTMLInputElement>(
          '[aria-label="Search subjects"]',
        );
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    };
    window.addEventListener("keydown", slash);
    return () => window.removeEventListener("keydown", slash);
  }, []);
  const parts = route.split("?")[0].split("/").filter(Boolean);
  const subject = subjects.data?.find((value) => value.id === parts[1]);
  if (sessionLoading) return <Loading />;
  if (!profile) return <SignIn />;
  if (subjects.loading && !subjects.data)
    return (
      <>
        <Header />
        <Loading />
      </>
    );
  if (subjects.error)
    return (
      <>
        <Header />
        <main className="student-content">
          <ErrorNotice message={subjects.error} retry={subjects.refresh} />
        </main>
      </>
    );
  if (!parts.length) return <Subjects subjects={subjects.data || []} />;
  if (parts[0] === "professor")
    return (
      <ProfessorAccess>
        {({ signOut }) => (
          <Professor
            page={parts[1] || "overview"}
            subjects={subjects.data || []}
            refreshSubjects={subjects.refresh}
            signOut={signOut}
          />
        )}
      </ProfessorAccess>
    );
  if (parts[0] === "subjects" && subject) {
    if (parts[2] === "study")
      return <Study key={subject.id} subject={subject} />;
    return <TimeSelection key={subject.id} subject={subject} />;
  }
  if (parts[0] === "book" && subject && parts[2])
    return (
      <BookingForm
        key={`${parts[2]}-${profile?.email}`}
        subject={subject}
        slotId={parts[2]}
        onConfirmed={(result) => {
          setBooking(result);
          try {
            sessionStorage.setItem(
              "consultai-confirmation",
              JSON.stringify(result),
            );
          } catch {
            /* Confirmation still works without browser storage. */
          }
          go("/confirmed");
        }}
      />
    );
  if (parts[0] === "confirmed" && booking)
    return <Confirmation booking={booking} />;
  return (
    <>
      <Header />
      <main className="student-content">
        <Empty title="This page isn’t available">
          <a href="#/">Return to subjects</a>
        </Empty>
      </main>
    </>
  );
}
