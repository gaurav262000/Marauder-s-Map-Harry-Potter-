import { useState, type FormEvent } from 'react';
import { makeLock, opens, type Lock } from '../lib/lock.ts';
import { Quip } from './InkLetter.tsx';

const QUIPS = [
  'The parchment does not open for a nameless stranger.',
  'Still no name? The map is patient, but it is not a fool.',
  'A map that keeps every footstep would like to know whose they are.',
];
const WRONG = [
  'Those are not the words. The parchment stays blank.',
  'Wrong again. The map has a long memory and a short temper.',
  'Nice try. Whoever you are, this map is not yours.',
];

interface Props {
  name: string;
  /** set when the map is locked with secret words */
  lock: Lock | null;
  onOpen: (name: string, lock?: Lock) => void;
  onForget: () => void;
}

/** The closed parchment: it opens only once the reader writes their name (and, if locked, the secret words). */
export function Intro({ name, lock, onOpen, onForget }: Props) {
  const [value, setValue] = useState(name);
  const [words, setWords] = useState('');
  const [locking, setLocking] = useState(false);
  const [quip, setQuip] = useState<{ n: number; text: string } | null>(null);
  const say = (list: string[]) => setQuip((q) => ({ n: (q?.n ?? 0) + 1, text: list[(q?.n ?? 0) % list.length] }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return say(QUIPS);
    if (lock) return (await opens(lock, words)) ? onOpen(value.trim()) : say(WRONG);
    onOpen(value.trim(), locking && words.trim() ? await makeLock(words) : undefined);
  };

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <form className="intro-sheet" onSubmit={submit}>
        <p className="intro-ribbon" aria-hidden>
          Itinerarium · Mundi
        </p>
        <p className="intro-script">The Cartographers of the Quiet Hour humbly present</p>
        <h1 id="intro-title">The Enchanted Atlas</h1>
        <p className="intro-sub">a living map of every street in the world, and of the footsteps upon them</p>
        <label htmlFor="reader-name">Write thy name upon the parchment</label>
        <input id="reader-name" value={value} maxLength={28} autoComplete="given-name" placeholder="Your name" onChange={(e) => setValue(e.target.value)} />
        {(lock || locking) && (
          <>
            <label htmlFor="secret-words">{lock ? 'Speak the secret words' : 'Choose secret words to lock this map'}</label>
            <input id="secret-words" type="password" value={words} autoComplete={lock ? 'current-password' : 'new-password'} onChange={(e) => setWords(e.target.value)} />
          </>
        )}
        {quip && <Quip key={quip.n}>{quip.text}</Quip>}
        <button className="btn primary" type="submit">
          I swear to wander wisely — reveal the map
        </button>
        {lock ? (
          <button type="button" className="link-btn" onClick={() => confirm('Forget the secret words? This also clears your name and your group from this phone.') && onForget()}>
            Forgot the words?
          </button>
        ) : (
          <label className="lock-choice">
            <input type="checkbox" checked={locking} onChange={(e) => setLocking(e.target.checked)} /> Lock this map with secret words
          </label>
        )}
        <p className="intro-fine">Your name appears only on your own map.</p>
      </form>
    </div>
  );
}
