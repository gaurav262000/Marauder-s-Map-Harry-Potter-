import { Copy, LogOut, Radio, Share2, Users, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { distance, type LngLat } from '../lib/geo.ts';
import type { Member } from '../lib/group.ts';

export interface GroupState {
  code: string;
  sharing: boolean;
}

interface Props {
  group: GroupState | null;
  invite: string | null;
  online: boolean;
  members: Member[];
  youAt: LngLat;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onToggleShare: () => void;
  onLeave: () => void;
  onFocus: (m: Member) => void;
  onClose: () => void;
}

export const inviteLink = (code: string) => `${location.origin}${location.pathname}#g=${code}`;

const ago = (t: number) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};
const far = (m: number) => (m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`);

export function GroupPanel(p: Props) {
  const [code, setCode] = useState(p.invite ?? '');
  const [copied, setCopied] = useState(false);

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) p.onJoin(code);
  };

  const share = async () => {
    const url = inviteLink(p.group!.code);
    try {
      if (navigator.share) return await navigator.share({ title: 'The Enchanted Atlas', text: 'Join my group on the Enchanted Atlas', url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* share sheet dismissed or clipboard refused: the code is shown on screen to copy by hand */
    }
  };

  return (
    <aside className="panel" aria-label="Your group">
      <div className="panel-grip" aria-hidden />
      <button className="icon-btn panel-close" onClick={p.onClose} aria-label="Close group panel">
        <X aria-hidden />
      </button>
      <h2>
        <Users aria-hidden /> Your group
      </h2>

      {!p.group ? (
        <>
          {p.invite && <p className="invite">You were invited to a group. Join to see your friends on the map.</p>}
          <form className="join" onSubmit={join}>
            <label htmlFor="group-code">Group code</label>
            <input id="group-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="xxxxx-xxxxx-xxxxx" autoComplete="off" spellCheck={false} />
            <button className="btn primary" type="submit" disabled={!code.trim()}>
              Join &amp; share my location
            </button>
          </form>
          <p className="or">or</p>
          <button className="btn" onClick={p.onCreate}>
            Start a new group
          </button>
          <p className="fine">
            Your location is encrypted on this device with the group code and only people with the code can read it. You can stop sharing at any time.
          </p>
        </>
      ) : (
        <>
          <div className="code-row">
            <code>{p.group.code}</code>
            <button className="btn" onClick={share}>
              {'share' in navigator ? <Share2 aria-hidden /> : <Copy aria-hidden />} {copied ? 'Link copied' : 'Invite friends'}
            </button>
          </div>

          <button className="btn share-toggle" aria-pressed={p.group.sharing} onClick={p.onToggleShare}>
            <Radio aria-hidden /> {p.group.sharing ? 'Sharing my location — tap to stop' : 'Not sharing — tap to share my location'}
          </button>
          <p className="fine">{p.online ? 'Connected to the relay.' : 'Connecting to the relay…'}</p>

          <h3>On the map</h3>
          {p.members.length === 0 ? (
            <p className="fine">No one else yet. Send the invite link to your friends.</p>
          ) : (
            <ul className="members">
              {p.members.map((m) => (
                <li key={m.id}>
                  <button className="member" onClick={() => p.onFocus(m)}>
                    <span className="m-name">
                      {m.name} {m.live && <span className="tag">live</span>}
                    </span>
                    <span className="m-where">
                      {m.dest ? `going to ${m.dest.name}` : 'standing still'} · {far(distance(p.youAt, m.at))} · {ago(m.t)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button className="btn leave" onClick={p.onLeave}>
            <LogOut aria-hidden /> Leave group
          </button>
        </>
      )}
    </aside>
  );
}
