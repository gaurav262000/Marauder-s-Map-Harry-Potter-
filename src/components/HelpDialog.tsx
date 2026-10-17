import { X } from 'lucide-react';
import type { Ref } from 'react';

export function HelpDialog({ ref }: { ref: Ref<HTMLDialogElement> }) {
  return (
    <dialog ref={ref} className="help" aria-labelledby="help-title" onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
      <form method="dialog">
        <h2 id="help-title">Reading the Atlas</h2>
        <ul>
          <li><b>Move</b> — drag the parchment, or use the arrow keys when the map is focused.</li>
          <li><b>Zoom</b> — scroll, pinch, the + / − buttons, or the + and − keys.</li>
          <li><b>Rooms</b> — click or tap a room to read about it; Tab through rooms and press Enter.</li>
          <li><b>Find</b> — type in “Seek a place…” and choose a result.</li>
          <li><b>Travel</b> — select a room, then “Navigate here”. Footprints walk the route from where you are.</li>
          <li><b>Secrets</b> — the key button or Secrets mode reveals hidden passages and chambers.</li>
          <li><b>Modes</b> — Explore, Secrets, Tracking (footprints prominent) and Clean (architecture only).</li>
        </ul>
        <button className="btn primary" value="close">
          <X aria-hidden /> Fold the parchment
        </button>
      </form>
    </dialog>
  );
}
