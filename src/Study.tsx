import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { write, type Material, type Subject } from "./api";
import {
  Empty,
  ErrorNotice,
  Header,
  Loading,
  SubjectHeader,
} from "./components";
import { useData } from "./useData";

type Source = { materialId: string; title: string; quote: string };
type Message = { role: "user" | "assistant"; text: string; sources?: Source[] };
export default function Study({ subject }: { subject: Subject }) {
  const materials = useData<Material[]>(`/subjects/${subject.id}/materials`);
  const capabilities = useData<{ ai: boolean }>("/capabilities");
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected && materials.data?.length) setSelected(materials.data[0].id);
  }, [materials.data, selected]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages, pending]);
  const current = materials.data?.find((material) => material.id === selected);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || !current || lock.current || !capabilities.data?.ai)
      return;
    const text = question.trim();
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const response = await write<{ answer: string; sources: Source[] }>(
        "/ai",
        {
          subjectId: subject.id,
          materialId: selected,
          question: text,
          history: messages
            .slice(-12)
            .map(({ role, text }) => ({ role, text })),
        },
      );
      setMessages((previous) => [
        ...previous,
        { role: "user", text },
        { role: "assistant", text: response.answer, sources: response.sources },
      ]);
      setQuestion("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <Header />
      <main className="study-page">
        <section className="panel study-shell">
          <SubjectHeader subject={subject} tab="study" />
          <div className="study-columns">
            <aside className="materials-sidebar">
              <h2>Course materials</h2>
              <p>Selected by your professor.</p>
              {materials.loading ? (
                <Loading />
              ) : materials.error ? (
                <ErrorNotice
                  message={materials.error}
                  retry={materials.refresh}
                />
              ) : !materials.data?.length ? (
                <Empty icon={BookOpen} title="Materials coming soon">
                  Your professor hasn’t approved any lectures for this subject
                  yet.
                </Empty>
              ) : (
                <div className="lecture-list">
                  {materials.data.map((material, index) => (
                    <button
                      key={material.id}
                      aria-pressed={selected === material.id}
                      disabled={pending}
                      onClick={() => {
                        setSelected(material.id);
                        setMessages([]);
                        setError("");
                        setQuestion("");
                      }}
                    >
                      <FileText size={20} />
                      <span>
                        <strong>Lecture {index + 1}</strong>
                        <span>{material.title}</span>
                      </span>
                      {selected === material.id && <Check size={13} />}
                    </button>
                  ))}
                </div>
              )}
              <div className="materials-note">
                <ShieldCheck size={13} />
                <span>Only approved materials are used.</span>
              </div>
            </aside>
            <section className="chat-panel">
              <div className="chat-heading">
                <span className="assistant-symbol">
                  <Sparkles size={23} />
                </span>
                <div>
                  <h2>AI Study Assistant</h2>
                  <p>
                    {current
                      ? current.title
                      : "A little clarity for your next question."}
                  </p>
                </div>
                <span className="ai-label">COURSE-BASED</span>
              </div>
              <div className="chat-messages" aria-live="polite">
                {!messages.length && !pending && (
                  <div className="chat-welcome">
                    <span className="welcome-sparkles">
                      <Sparkles size={32} strokeWidth={1.5} />
                    </span>
                    <h3>Make sense of what’s next.</h3>
                    <p>
                      {capabilities.data?.ai
                        ? current
                          ? "Ask a question about the selected lecture. We’ll work through it together."
                          : "Choose a lecture to start exploring."
                        : "Your professor hasn’t connected the study assistant yet. You can still book a consultation."}
                    </p>
                    {!capabilities.data?.ai && (
                      <a href={`#/subjects/${subject.id}`}>
                        Find a consultation time <ArrowRight size={14} />
                      </a>
                    )}
                  </div>
                )}
                {messages.map((message, index) => (
                  <div className={`chat-message ${message.role}`} key={index}>
                    <span className="message-avatar">
                      {message.role === "assistant" ? (
                        <Sparkles size={17} />
                      ) : (
                        "You"
                      )}
                    </span>
                    <div>
                      <p>{message.text}</p>
                      {!!message.sources?.length && (
                        <details className="source-reference">
                          <summary>
                            <FileText size={12} />
                            Course sources · {message.sources.length}
                          </summary>
                          {message.sources.map((source, i) => (
                            <blockquote key={i}>
                              <strong>{source.title}</strong>
                              <p>“{source.quote}”</p>
                            </blockquote>
                          ))}
                        </details>
                      )}
                    </div>
                  </div>
                ))}
                {pending && (
                  <div className="assistant-thinking">
                    <Sparkles size={16} />
                    Reading the course material…
                  </div>
                )}
                <div ref={bottom} />
              </div>
              {capabilities.error && (
                <ErrorNotice
                  message={capabilities.error}
                  retry={capabilities.refresh}
                />
              )}
              {error && <ErrorNotice message={error} />}
              <form className="chat-input" onSubmit={submit}>
                <input
                  aria-label="Question about the lecture"
                  placeholder={
                    current
                      ? "Ask a question about this lecture…"
                      : "Select a lecture to get started…"
                  }
                  value={question}
                  maxLength={2000}
                  disabled={pending || !current || !capabilities.data?.ai}
                  onChange={(event) => setQuestion(event.target.value)}
                />
                <button
                  type="submit"
                  aria-label="Send question"
                  disabled={
                    pending ||
                    !question.trim() ||
                    !current ||
                    !capabilities.data?.ai
                  }
                >
                  <Send size={17} />
                </button>
              </form>
              <p className="chat-disclaimer">
                AI can make mistakes. Check explanations against your course
                materials.
              </p>
            </section>
          </div>
        </section>
      </main>
    </>
  );
}
