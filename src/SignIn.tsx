import { useState } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Logo } from "./components";
import { useStudentSession } from "./session";

export default function SignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const { signIn } = useStudentSession();
  return (
    <div className="sign-in-page">
      <header className="sign-in-header">
        <Logo />
        <a href="#/professor">
          Professor <ArrowRight size={14} />
        </a>
      </header>
      <main className="panel sign-in-card">
        <span className="sign-in-symbol">
          <CalendarDays size={28} strokeWidth={1.7} />
        </span>
        <h1>{mode === "signin" ? "Welcome back" : "Join ConsultAI"}</h1>
        <p className="muted">Book a consultation.</p>
        <div className="segmented sign-in-tabs" aria-label="Account options">
          <button
            aria-pressed={mode === "signin"}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            aria-pressed={mode === "signup"}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>
        <button className="google-sign-in" onClick={signIn}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.33-2.59Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.33 2.59A5.99 5.99 0 0 1 12 5.96Z"
            />
          </svg>
          {mode === "signin" ? "Sign in with Google" : "Sign up with Google"}
        </button>
        <span className="sign-in-demo">Mock Google account · Jane Doe</span>
      </main>
    </div>
  );
}
