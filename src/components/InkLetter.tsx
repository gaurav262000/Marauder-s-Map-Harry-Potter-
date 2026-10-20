import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { scratch } from '../lib/sfx.ts';

interface Props {
  title: string;
  text: string;
  onClose: () => void;
  /** offers a reply box when given */
  onReply?: (text: string) => void;
  children?: ReactNode;
}

/** A letter or note that writes itself onto parchment, line by line. */
export function InkLetter({ title, text, onClose, onReply, children }: Props) {
  const [reply, setReply] = useState('');
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    onReply!(reply);
    onClose();
  };
  return (
    <div className="letter note-emerge" role="dialog" aria-label={title}>
      <button className="icon-btn note-close" onClick={onClose} aria-label="Close">
        <X aria-hidden />
      </button>
      <h2 className="ink-write">{title}</h2>
      <p className="letter-text ink-write slow">{text}</p>
      {children}
      {onReply && (
        <form className="reply" onSubmit={send}>
          <label htmlFor="owl-reply">Send an owl back</label>
          <textarea id="owl-reply" value={reply} maxLength={280} rows={2} onChange={(e) => setReply(e.target.value)} />
          <button className="btn primary" type="submit" disabled={!reply.trim()}>
            Send the owl
          </button>
        </form>
      )}
    </div>
  );
}

/** The map answering back, in its own hand (you can hear the quill). */
export function Quip({ children }: { children: ReactNode }) {
  useEffect(() => scratch(6), []);
  return (
    <p className="quip ink-write" role="status">
      {children}
    </p>
  );
}
