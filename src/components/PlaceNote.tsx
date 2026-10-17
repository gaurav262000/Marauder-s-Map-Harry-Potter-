import { Footprints, MapPinned, X } from 'lucide-react';
import type { LngLat } from '../lib/geo.ts';
import type { Place } from '../lib/services.ts';

export const formatCoord = ([lng, lat]: LngLat) =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;

interface Props {
  at: LngLat;
  place: Place | null | undefined;
  onWalk: () => void;
  onAppear: () => void;
  onClose: () => void;
}

/** The little note that appears where the reader taps the parchment. */
export function PlaceNote({ at, place, onWalk, onAppear, onClose }: Props) {
  return (
    <div className="note">
      <button className="icon-btn note-close" onClick={onClose} aria-label="Close note">
        <X aria-hidden />
      </button>
      <h2>{place === undefined ? 'Reading the ink…' : place ? place.name : 'An unnamed spot'}</h2>
      {place?.detail && <p className="note-detail">{place.detail}</p>}
      <p className="note-coord">{formatCoord(at)}</p>
      <div className="actions">
        <button className="btn primary" onClick={onWalk}>
          <Footprints aria-hidden /> Walk here
        </button>
        <button className="btn" onClick={onAppear}>
          <MapPinned aria-hidden /> Appear here
        </button>
      </div>
    </div>
  );
}
