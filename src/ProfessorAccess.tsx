import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { api, write } from "./api";
import { Button, Empty, ErrorNotice, Loading, Logo } from "./components";

type Access = { authenticated: boolean; mode: "local" | "password" };

export default function ProfessorAccess({
  children,
}: {
  children: (options: { local: boolean; signOut: () => void }) => ReactNode;
}) {
  const [access, setAccess] = useState<Access>();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let current = true;
    const abort = new AbortController();
    const expired = () => {
      setAccess({ authenticated: false, mode: "password" });
      setError("Your session ended. Sign in again.");
    };
    window.addEventListener("consultai:professor-expired", expired);
    setError("");
    api<Access>("/auth/professor", { signal: abort.signal })
      .then((result) => {
        if (current) setAccess(result);
      })
      .catch((err: Error) => {
        if (current) setError(err.message);
      });
    return () => {
      current = false;
      abort.abort();
      window.removeEventListener("consultai:professor-expired", expired);
    };
  }, [version]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      setAccess(await write<Access>("/auth/professor", { password }));
      setPassword("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    try {
      setAccess(await write<Access>("/auth/professor/logout", {}));
      setPassword("");
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (access?.authenticated)
    return (
      <>
        {error && <ErrorNotice message={error} />}
        {children({ local: access.mode === "local", signOut })}
      </>
    );
  return (
    <div className="sign-in-page">
      <header className="sign-in-header">
        <Logo />
        <a href="#/">
          Student view <ArrowRight size={14} />
        </a>
      </header>
      <main className="panel sign-in-card">
        {!access ? (
          error ? (
            <ErrorNotice
              message={error}
              retry={() => setVersion((value) => value + 1)}
            />
          ) : (
            <Loading />
          )
        ) : access.mode === "local" ? (
          <Empty title="Local workspace">
            Open ConsultAI on the server computer.
          </Empty>
        ) : (
          <>
            <span className="sign-in-symbol">
              <LockKeyhole size={28} strokeWidth={1.7} />
            </span>
            <h1>Professor sign-in</h1>
            <form className="professor-sign-in-form" onSubmit={signIn}>
              <label>
                Password
                <input
                  aria-label="Professor password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={512}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {error && <ErrorNotice message={error} />}
              <Button type="submit" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
                <ArrowRight size={17} />
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
