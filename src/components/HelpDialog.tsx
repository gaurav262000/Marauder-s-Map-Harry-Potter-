import { X } from 'lucide-react';
import type { Ref } from 'react';

export function HelpDialog({ ref }: { ref: Ref<HTMLDialogElement> }) {
  return (
    <dialog ref={ref} className="help" aria-labelledby="help-title" onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
      <form method="dialog">
        <h2 id="help-title">Reading the Atlas</h2>
        <ul>
          <li><b>Move</b> — drag the parchment; scroll or pinch to zoom; right-drag or two-finger twist to turn it.</li>
          <li><b>Find</b> — type any town, street or landmark in “Seek any place…” and press Enter.</li>
          <li><b>Walk</b> — tap anywhere, then “Walk here”. Your footprints follow real footpaths from where you stand.</li>
          <li><b>Appear</b> — “Appear here” moves you without walking; the target button finds where you really are.</li>
          <li><b>Wanderers</b> — zoom in to street level to see the residents of the parchment walking the streets.</li>
        </ul>
        <p className="help-fine">Map data © OpenStreetMap contributors, tiles by OpenFreeMap, search by Nominatim, walking routes by FOSSGIS OSRM.</p>
        <button className="btn primary" value="close">
          <X aria-hidden /> Back to the map
        </button>
      </form>
    </dialog>
  );
}
