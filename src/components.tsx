import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Clock3, Code2, Database, Globe2, Mail, Network, RefreshCw, Sparkles, UserRound, X, type LucideIcon } from 'lucide-react';
import { dateLabel, go, minutes, time, type Booking, type Slot, type Subject } from './api';

export const icons: Record<string, LucideIcon> = { database: Database, network: Network, code: Code2, book: BookOpen };
export function SubjectIcon({ icon, small = false }: { icon: string; small?: boolean }) {
  const Icon = icons[icon] || BookOpen;
  return <span className={`subject-icon ${icon} ${small ? 'small' : ''}`}><Icon strokeWidth={1.8} aria-hidden="true" /></span>;
}
export function Logo({ light = false }: { light?: boolean }) {
  return <a href="#/" className={`logo ${light ? 'light' : ''}`} aria-label="ConsultAI home"><span className="logo-mark"><CalendarDays size={23} strokeWidth={2} /></span><span>Consult<span className="brand-ai">AI</span></span></a>;
}
export function Header({ back = false }: { back?: boolean }) {
  return <header className="student-header"><div className="header-inner"><div className="flex items-center gap-5">{back && <button className="icon-button" onClick={() => history.back()} aria-label="Go back"><ArrowLeft size={21} /></button>}<Logo /></div><div className="header-actions"><span className="timezone"><Globe2 size={16} /><span>Europe/Skopje</span></span><a className="professor-link" href="#/professor">Professor area <ArrowRight size={14} /></a></div></div></header>;
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-notice" role="alert"><span>{message}</span>{retry && <button onClick={retry}><RefreshCw size={15} /> Try again</button>}</div>;
}
export function Empty({ icon: Icon = CalendarDays, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={27} strokeWidth={1.6} /></span><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}
export function Loading() { return <div className="loading-state" role="status"><span className="spinner" />Loading…</div>; }
export function Button({ children, onClick, secondary = false, disabled = false, type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean; type?: 'button' | 'submit'; className?: string }) {
  return <button type={type} className={`${secondary ? 'button-secondary' : 'button-primary'} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function SubjectHeader({ subject, tab }: { subject: Subject; tab: 'book' | 'study' }) {
  return <><div className="subject-heading"><button className="icon-button subject-back" onClick={() => go('/')} aria-label="Back to subjects"><ArrowLeft size={20} /></button><SubjectIcon icon={subject.icon} /><div><span className="eyebrow">YOUR SUBJECT</span><h1>{subject.name}</h1><span className="muted">{subject.code}</span></div></div><nav className="tabs" aria-label="Subject options"><a href={`#/subjects/${subject.id}`} aria-current={tab === 'book' ? 'page' : undefined}><CalendarDays size={17} />Book a slot</a><a href={`#/subjects/${subject.id}/study`} aria-current={tab === 'study' ? 'page' : undefined}><Sparkles size={17} />Study with AI</a></nav></>;
}
export function SlotSummary({ subject, slot, booking }: { subject: Subject; slot: Slot; booking?: Booking }) {
  const rows = [
    { icon: CalendarDays, label: 'Date', value: dateLabel(slot.startsAt, true) },
    { icon: Clock3, label: 'Time', value: `${time(slot.startsAt)} – ${time(slot.endsAt)}` },
    ...(booking ? [{ icon: UserRound, label: 'Student', value: booking.name }, { icon: Mail, label: 'Email', value: booking.email }] : [
      { icon: Clock3, label: 'Duration', value: `${minutes(slot)} minutes` },
      { icon: Globe2, label: 'Timezone', value: 'Europe/Skopje' },
    ]),
  ];
  return <div className="summary"><div className="summary-subject"><SubjectIcon icon={subject.icon} small /><div><h3>{subject.name}</h3><span className="muted">{subject.code}</span></div></div><dl>{rows.map(({ icon: Icon, label, value }) => <div key={label}><dt><Icon size={18} />{label}</dt><dd>{value}</dd></div>)}</dl></div>;
}
export function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current!; node.showModal(); return () => node.close(); }, []);
  return <dialog className={`modal ${wide ? 'wide' : ''}`} ref={dialog} onCancel={close} onClick={(event) => { if (event.target === dialog.current) close(); }}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={20} /></button></div>{children}</dialog>;
}
export function Pill({ children, success = false }: { children: ReactNode; success?: boolean }) { return <span className={`pill ${success ? 'success' : ''}`}>{success ? <Check size={12} /> : <span className="status-dot" />}{children}</span>; }
export function SelectArrow() { return <ChevronDown size={15} aria-hidden="true" />; }
