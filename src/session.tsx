import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, go, write } from "./api";

type Role = "student" | "professor";
type Profile = { id: string; name: string; email: string };
type DemoAccount = Profile & { role: Role };
type DemoSession = {
  profile: Profile | null;
  role: Role | null;
  demo: true;
  accounts: DemoAccount[];
};
type StudentSession = {
  profile: Profile | null;
  role: Role | null;
  accounts: DemoAccount[];
  loading: boolean;
  error: string;
  refresh: () => void;
  signIn: (accountId: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const Session = createContext<StudentSession | null>(null);

export function StudentSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let current = true;
    const abort = new AbortController();
    const expired = () => {
      current = false;
      abort.abort();
      setSession((previous) =>
        previous ? { ...previous, profile: null, role: null } : undefined,
      );
      setLoading(false);
      setError("Your session ended. Choose an account.");
    };
    window.addEventListener("consultai:professor-expired", expired);
    setLoading(true);
    setError("");
    api<DemoSession>("/auth/session", { signal: abort.signal })
      .then((result) => {
        if (current) setSession(result);
      })
      .catch((err: Error) => {
        if (current) setError(err.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      abort.abort();
      window.removeEventListener("consultai:professor-expired", expired);
    };
  }, [version]);

  async function signIn(accountId: string) {
    const result = await write<DemoSession>("/auth/demo", { accountId });
    setSession(result);
    setError("");
    if (result.role === "professor") go("/professor");
    else if (!location.hash || location.hash.startsWith("#/professor")) go("/");
  }

  async function signOut() {
    try {
      setSession(await write<DemoSession>("/auth/logout", {}));
      setError("");
      try {
        sessionStorage.removeItem("consultai-confirmation");
      } catch {
        /* In-memory state still clears. */
      }
      go("/");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Session.Provider
      value={{
        profile: session?.profile || null,
        role: session?.role || null,
        accounts: session?.accounts || [],
        loading,
        error,
        refresh: () => setVersion((value) => value + 1),
        signIn,
        signOut,
      }}
    >
      {children}
    </Session.Provider>
  );
}

export function useStudentSession() {
  const session = useContext(Session);
  if (!session) throw new Error("StudentSessionProvider is required.");
  return session;
}
