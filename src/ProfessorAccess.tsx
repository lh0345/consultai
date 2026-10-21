import type { ReactNode } from "react";
import { Empty, ErrorNotice } from "./components";
import { useStudentSession } from "./session";

export default function ProfessorAccess({
  children,
}: {
  children: (options: { signOut: () => void }) => ReactNode;
}) {
  const { role, error, signOut } = useStudentSession();
  if (role !== "professor")
    return (
      <main className="student-content">
        <Empty title="Course creator access">
          <a href="#/">Return to subjects</a>
        </Empty>
      </main>
    );
  return (
    <>
      {error && <ErrorNotice message={error} />}
      {children({ signOut })}
    </>
  );
}
