import { useState, type FormEvent } from 'react';

/** The closed parchment: it opens only once the reader writes their name. */
export function Intro({ name, onOpen }: { name: string; onOpen: (name: string) => void }) {
  const [value, setValue] = useState(name);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onOpen(value.trim() || 'A Wanderer');
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
        <button className="btn primary" type="submit">
          I swear to wander wisely — reveal the map
        </button>
        <p className="intro-fine">Your name appears only on your own map.</p>
      </form>
    </div>
  );
}
