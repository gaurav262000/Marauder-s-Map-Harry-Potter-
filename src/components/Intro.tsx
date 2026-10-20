import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { splitOpen, unfold } from './fold.ts';
import { makeLock, opens, type Lock } from '../lib/lock.ts';
import { Quip } from './InkLetter.tsx';
import { IntroBanner, IntroEmblem } from './IntroArt.tsx';

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
  /** play the theme as the map opens */
  music: boolean;
  onMusic: (on: boolean) => void;
  onOpen: (name: string, lock?: Lock) => void;
  onForget: () => void;
}

/** The closed parchment: it opens only once the reader writes their name (and, if locked, the secret words). */
export function Intro({ name, lock, music, onMusic, onOpen, onForget }: Props) {
  const [value, setValue] = useState(name);
  const [words, setWords] = useState('');
  const [locking, setLocking] = useState(false);
  const [quip, setQuip] = useState<{ n: number; text: string } | null>(null);
  const sheet = useRef<HTMLFormElement>(null);
  useEffect(() => unfold(sheet.current!), []);
  const go = (n: string, newLock?: Lock) => {
    splitOpen(sheet.current!);
    onOpen(n, newLock);
  };
  const say = (list: string[]) => setQuip((q) => ({ n: (q?.n ?? 0) + 1, text: list[(q?.n ?? 0) % list.length] }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return say(QUIPS);
    if (lock) return (await opens(lock, words)) ? go(value.trim()) : say(WRONG);
    go(value.trim(), locking && words.trim() ? await makeLock(words) : undefined);
  };

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <form className="intro-sheet" ref={sheet} onSubmit={submit}>
        <IntroBanner />
        <p className="intro-messrs ink-in" style={{ '--d': '0.5s' } as CSSProperties}>
          Messrs.
        </p>
        <p className="intro-makers ink-in" style={{ '--d': '0.8s' } as CSSProperties}>
          The Cartographers <span>of the</span> Quiet Hour
        </p>
        <p className="intro-script ink-in" style={{ '--d': '1.1s' } as CSSProperties}>
          are proud to present
        </p>
        <div className="intro-crest">
          <IntroEmblem />
          <h1 id="intro-title" className="ink-in" style={{ '--d': '1.9s' } as CSSProperties}>
            <span>The</span> Enchanted Atlas
          </h1>
        </div>
        <p className="intro-sub ink-in" style={{ '--d': '2.4s' } as CSSProperties}>
          a living map of every street in the world, and of the footsteps upon them
        </p>
        <div className="intro-fields ink-in" style={{ '--d': '2.7s' } as CSSProperties}>
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
          <label className="lock-choice">
            <input type="checkbox" checked={music} onChange={(e) => onMusic(e.target.checked)} /> ♪ Music
          </label>
          <p className="intro-fine">Your name appears only on your own map.</p>
        </div>
        <p className="intro-latin ink-in" style={{ '--d': '3.1s' } as CSSProperties} aria-hidden>
          Hic sunt viae omnes, et vestigia eorum qui ambulant. Charta haec memor est, sed tacet ei qui nomen non scribit. Ambula sapienter, amice, et vide quod alii non vident; nam qui vagatur non semper perditur.
        </p>
      </form>
    </div>
  );
}
