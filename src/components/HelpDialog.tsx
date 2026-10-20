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
          <li><b>Friends</b> — the people button starts or joins a group. Send the invite link; friends ask to join and you approve each one. Everyone approved who shares appears on the map with their name, footprints and where they are heading. Stop sharing or leave the group any time.</li>
          <li><b>Wanderers</b> — zoom in to street level to see the residents of the parchment walking the streets.</li>
          <li><b>Owl post</b> — in your group, tap “Owl” next to a friend to send a letter only they can read. An owl flies it across the map.</li>
          <li><b>Secret notes</b> — tap a spot, then “Hide a secret note”. Your group sees a wax seal there; it opens only for someone standing within 50 m.</li>
          <li><b>The cloak</b> — in the group panel, wear the cloak to vanish from your group for 30 minutes. You leave no footprints.</li>
          <li><b>Candlelight</b> — the moon button darkens the map to candlelight around you, your friends and the wanderers. It comes on by itself after 7 pm.</li>
          <li><b>Over water</b> — no footprints on water: you fly across on a broom.</li>
        </ul>
        <p className="help-fine">Map data © OpenStreetMap contributors, tiles by OpenFreeMap, search by Nominatim, walking routes by FOSSGIS OSRM.</p>
        <button className="btn primary" value="close">
          <X aria-hidden /> Back to the map
        </button>
      </form>
    </dialog>
  );
}
