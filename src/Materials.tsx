import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Info,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  write,
  type IntegrationStatus,
  type Material,
  type Subject,
} from "./api";
import { Button, Empty, ErrorNotice, Loading, Modal, Pill } from "./components";
import { useData } from "./useData";

export default function Materials({ subjects }: { subjects: Subject[] }) {
  const materials = useData<Material[]>("/admin/materials");
  const status = useData<IntegrationStatus>("/admin/integrations");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Partial<Material>>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing || pending) return;
    setPending(true);
    setError("");
    try {
      await write(
        `/admin/materials${editing.id ? `/${editing.id}` : ""}`,
        {
          subjectId: editing.subjectId,
          title: editing.title,
          content: editing.content,
          approved: !!editing.approved,
        },
        editing.id ? "PATCH" : "POST",
      );
      setEditing(undefined);
      materials.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function approve(material: Material) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await write(
        `/admin/materials/${material.id}/approval`,
        { approved: !material.approved },
        "PATCH",
      );
      materials.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function loadSource() {
    if (!editing?.id || pending) return;
    setPending(true);
    setError("");
    try {
      setEditing(
        await write<Material>(`/admin/materials/${editing.id}/drive`, {}),
      );
      materials.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  const visible = (materials.data || []).filter(
    (material) => filter === "all" || material.subjectId === filter,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>AI & course materials</h1>
          <p>A thoughtful assistant starts with trusted material.</p>
        </div>
        <Button
          disabled={!subjects.length}
          onClick={() => {
            setEditing({
              subjectId: subjects[0].id,
              title: "",
              content: "",
              approved: false,
            });
            setError("");
          }}
        >
          <Plus size={16} />
          Add material
        </Button>
      </div>
      <div className="ai-status-strip">
        <span className="settings-icon">
          <Sparkles size={20} />
        </span>
        <div>
          <strong>Gemini study assistant</strong>
          <p>
            {status.data?.ai
              ? "Ready to answer questions using approved course text."
              : "Add GEMINI_API_KEY to the server environment to enable student questions."}
          </p>
        </div>
        <Pill success={!!status.data?.ai}>
          {status.data?.ai ? "Configured" : "Not connected"}
        </Pill>
      </div>
      <div className="materials-toolbar">
        <h2>Course library</h2>
        <select
          aria-label="Filter course materials by subject"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </div>
      {error && !editing && <ErrorNotice message={error} />}
      {materials.loading ? (
        <Loading />
      ) : materials.error ? (
        <ErrorNotice message={materials.error} retry={materials.refresh} />
      ) : (
        <section className="panel material-library">
          {!visible.length ? (
            <Empty icon={BookOpen} title="Build a helpful course library">
              Add lecture text, or import materials from Classroom. You decide
              what students can use.
            </Empty>
          ) : (
            visible.map((material) => (
              <div key={material.id} className="material-row">
                <span className="material-file-icon">
                  <FileText size={21} />
                </span>
                <div className="material-row-copy">
                  <strong>{material.title}</strong>
                  <span>
                    {
                      subjects.find(
                        (subject) => subject.id === material.subjectId,
                      )?.name
                    }
                    {material.driveId && " · Google Drive"}
                  </span>
                </div>
                <Pill success={material.approved}>
                  {material.approved ? "Approved" : "Needs review"}
                </Pill>
                <button
                  className="text-link approval-button"
                  onClick={() => approve(material)}
                  disabled={pending}
                >
                  {material.approved ? "Unapprove" : "Approve"}
                </button>
                <button
                  className="icon-button"
                  aria-label={`Edit ${material.title}`}
                  onClick={() => {
                    setEditing(material);
                    setError("");
                  }}
                >
                  <Pencil size={15} />
                </button>
              </div>
            ))
          )}
        </section>
      )}
      <div className="material-privacy-note">
        <ShieldCheck size={17} />
        <p>
          Approving a material allows its text to be sent to Gemini for student
          questions. Only its title and verified source excerpts are shown to
          students. Private Drive files are never served publicly.
        </p>
      </div>
      {editing && (
        <Modal
          wide
          title={editing.id ? "Review course material" : "Add course material"}
          close={() => !pending && setEditing(undefined)}
        >
          <form onSubmit={submit}>
            <div className="form-two-columns">
              <label>
                Subject
                <select
                  required
                  value={editing.subjectId}
                  onChange={(event) =>
                    setEditing({ ...editing, subjectId: event.target.value })
                  }
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lecture title
                <input
                  required
                  minLength={2}
                  maxLength={150}
                  placeholder="e.g. Trees and traversal"
                  value={editing.title}
                  onChange={(event) =>
                    setEditing({ ...editing, title: event.target.value })
                  }
                />
              </label>
            </div>
            {editing.driveId && (
              <div className="drive-source-note">
                <Info size={16} />
                <p>
                  Read Google Docs or plain text from Drive. This replaces the
                  saved copy and requires a fresh approval.
                </p>
                <Button
                  secondary
                  onClick={loadSource}
                  disabled={pending || !status.data?.classroom}
                >
                  {pending ? "Loading…" : "Load source text"}
                </Button>
              </div>
            )}
            <label>
              Course text
              <textarea
                required
                minLength={20}
                maxLength={60_000}
                rows={10}
                placeholder="Paste your lecture notes or the relevant course content…"
                value={editing.content}
                onChange={(event) =>
                  setEditing({ ...editing, content: event.target.value })
                }
              />
              <span className="field-hint">
                Plain text only. Up to 60,000 characters. Review imported
                content before approval.
              </span>
            </label>
            <label className="approval-checkbox">
              <input
                type="checkbox"
                checked={!!editing.approved}
                onChange={(event) =>
                  setEditing({ ...editing, approved: event.target.checked })
                }
              />
              <span>
                Approve this material for student AI questions
                <span>
                  Approved text may be shared with Gemini and quoted in answers.
                </span>
              </span>
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
                {pending ? "Saving…" : "Save material"}
                <ArrowRight size={15} />
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
