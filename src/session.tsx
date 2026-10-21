import { createContext, useContext, useState, type ReactNode } from "react";
import { go } from "./api";

type StudentProfile = { name: string; email: string };
type StudentSession = {
  profile: StudentProfile | null;
  signIn: () => void;
  signOut: () => void;
};
const Session = createContext<StudentSession | null>(null);
const storageKey = "consultai-demo-profile";
// This is a local UI mock, not a Google identity or server authentication.
const demoProfile: StudentProfile = {
  name: "Jane Doe",
  email: "jane.doe@example.edu",
};

export function StudentSessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile | null>(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      return stored?.name === demoProfile.name &&
        stored?.email === demoProfile.email
        ? demoProfile
        : null;
    } catch {
      return null;
    }
  });
  function signIn() {
    setProfile(demoProfile);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(demoProfile));
    } catch {
      /* The mock session still works in memory when storage is unavailable. */
    }
  }
  function signOut() {
    setProfile(null);
    try {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem("consultai-confirmation");
    } catch {
      /* In-memory access is cleared even when storage is unavailable. */
    }
    go("/");
  }
  return (
    <Session.Provider value={{ profile, signIn, signOut }}>
      {children}
    </Session.Provider>
  );
}

export function useStudentSession() {
  const session = useContext(Session);
  if (!session) throw new Error("StudentSessionProvider is required.");
  return session;
}
