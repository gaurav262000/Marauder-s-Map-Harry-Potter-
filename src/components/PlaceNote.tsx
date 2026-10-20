import { Feather, Flag, Footprints, MapPinned, X } from 'lucide-react';
import { useState } from 'react';
import type { LngLat } from '../lib/geo.ts';
import type { Place } from '../lib/services.ts';

export const formatCoord = ([lng, lat]: LngLat) =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;

interface Props {
  at: LngLat;
  place: Place | null | undefined;
  onWalk: () => void;
  onAppear: () => void;
  /** given only while in a group: hide a note here for friends to find */
  onLeaveNote?: (text: string) => void;
  /** given only while in a group: make this the group's meeting place */
  onMeet?: () => void;
  onClose: () => void;
}

/** The little note that appears where the reader taps the parchment. */
export function PlaceNote({ at, place, onWalk, onAppear, onLeaveNote, onMeet, onClose }: Props) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  return (
    <div className="note">
      <button className="icon-btn note-close" onClick={onClose} aria-label="Close note">
        <X aria-hidden />
      </button>
      <h2 className="ink-write">{place ? place.name : 'A spot on the map'}</h2>
      {place?.detail && <p className="note-detail">{place.detail}</p>}
      <p className="note-coord">{formatCoord(at)}</p>
      <div className="actions">
        <button className="btn primary" onClick={onWalk}>
          <Footprints aria-hidden /> Walk here
        </button>
        <button className="btn" onClick={onAppear}>
          <MapPinned aria-hidden /> Appear here
        </button>
        {onMeet && (
          <button className="btn" onClick={onMeet}>
            <Flag aria-hidden /> Meet here
          </button>
        )}
        {onLeaveNote && !writing && (
          <button className="btn" onClick={() => setWriting(true)}>
            <Feather aria-hidden /> Hide a secret note
          </button>
        )}
      </div>
      {onLeaveNote && writing && (
        <form
          className="reply"
          onSubmit={(e) => {
            e.preventDefault();
            onLeaveNote(text);
          }}
        >
          <label htmlFor="secret-text">Your group will only read it standing here</label>
          <textarea id="secret-text" value={text} maxLength={280} rows={2} autoFocus onChange={(e) => setText(e.target.value)} />
          <button className="btn primary" type="submit" disabled={!text.trim()}>
            Seal it here
          </button>
        </form>
      )}
    </div>
  );
}
