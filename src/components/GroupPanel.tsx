import { Bird, Check, Copy, EyeOff, Flag, LogOut, Radio, Share2, ShieldAlert, ShieldCheck, Tent, UserMinus, Users, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { GroupState, Invite, RequestView } from '../hooks/useGroup.ts';
import { inviteLink, parseInvite } from '../hooks/useGroup.ts';
import { distance, type LngLat } from '../lib/geo.ts';
import type { Member, SecretNote } from '../lib/group.ts';
import { safetyNumber } from '../lib/groupCrypto.ts';
import { Quip } from './InkLetter.tsx';

interface Props {
  group: GroupState | null;
  invite: Invite | null;
  online: boolean;
  members: Member[];
  requests: RequestView[];
  /** this device's public keys, for its own safety number */
  myKeys: { pub: JsonWebKey; signPub: JsonWebKey } | null;
  youAt: LngLat;
  onCreate: () => void;
  onJoin: (inv: Invite) => void;
  onApprove: (r: RequestView) => void;
  onDecline: (r: RequestView) => void;
  onRemove: (id: string) => void;
  onToggleShare: () => void;
  onLeave: () => void;
  onFocus: (m: Member) => void;
  onSendOwl: (m: Member, text: string) => void;
  /** ms since epoch the cloak lasts until, 0 when off */
  cloakedUntil: number;
  onCloak: () => void;
  meeting: SecretNote | null;
  onClearMeeting: () => void;
  /** ms since epoch you stay in the open field until, 0 when out of it */
  fieldUntil: number;
  fieldPeople: number;
  onField: (on: boolean) => void;
  onClose: () => void;
}

/** Rough walking time: 80 m a minute, as the crow flies. */
const eta = (m: number) => (m < 40 ? 'there' : `about ${Math.max(1, Math.round(m / 80))} min away`);

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ago = (t: number) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};
const far = (m: number) => (m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`);

function Safety({ keys }: { keys: { pub: JsonWebKey; signPub: JsonWebKey } | null }) {
  const [n, setN] = useState('');
  useEffect(() => {
    if (keys) void safetyNumber(keys.pub, keys.signPub).then(setN);
  }, [keys]);
  return <span className="safety">{n || '····· ····· ····· ·····'}</span>;
}

export function GroupPanel(p: Props) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [owlTo, setOwlTo] = useState<string | null>(null);
  const [owlText, setOwlText] = useState('');
  const [fieldAsk, setFieldAsk] = useState(false);
  const typed = parseInvite(text);
  const g = p.group;

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (typed) p.onJoin(typed);
  };

  const share = async () => {
    const url = inviteLink(g!);
    try {
      if (navigator.share) return await navigator.share({ title: 'The Enchanted Atlas', text: 'Ask to join my group on the Enchanted Atlas', url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* share sheet dismissed or clipboard refused: the link is shown on screen to copy by hand */
    }
  };

  const yourNumber = (
    <p className="fine">
      Your safety number is <Safety keys={p.myKeys} />. The owner sees the same number next to your request; read all 20 digits to them on a call so they know it is really you.
    </p>
  );

  return (
    <aside className="panel" aria-label="Your group">
      <div className="panel-grip" aria-hidden />
      <button className="icon-btn panel-close" onClick={p.onClose} aria-label="Close group panel">
        <X aria-hidden />
      </button>
      <h2>
        <Users aria-hidden /> Your group
      </h2>

      {!g && (
        <>
          {p.invite ? (
            <>
              <p className="invite">You were invited to a group. The owner must approve you before you can see anyone, or anyone can see you.</p>
              <button className="btn primary" onClick={() => p.onJoin(p.invite!)}>
                Ask to join
              </button>
              {yourNumber}
            </>
          ) : (
            <>
              <button className="btn primary" onClick={p.onCreate} disabled={!p.myKeys}>
                Start a new group
              </button>
              <p className="or">or join with an invite</p>
              <form className="join" onSubmit={join}>
                <label htmlFor="group-invite">Paste the invite link</label>
                <input id="group-invite" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…#g=…" autoComplete="off" spellCheck={false} />
                {text && !typed && <Quip>This map does not speak to strangers. That is not a whole invite link.</Quip>}
                <button className="btn" type="submit" disabled={!typed}>
                  Ask to join
                </button>
              </form>
            </>
          )}
          <p className="fine">
            <ShieldCheck aria-hidden className="inline-icon" /> Only people the group owner approves can see locations. Everything is encrypted on your phone before it leaves it.
          </p>
        </>
      )}

      {g?.role === 'pending' && (
        <>
          <p className="invite">Waiting for the group owner to approve you…</p>
          {yourNumber}
          <p className="fine">{p.online ? 'Your request has been sent.' : 'Connecting to the relay…'}</p>
          <button className="btn leave" onClick={p.onLeave}>
            Cancel request
          </button>
        </>
      )}

      {g?.role === 'denied' && (
        <>
          <Quip>The keeper of this map does not know you. Off you go, and mind the stairs.</Quip>
          <p className="fine">The group owner has not approved this device, or has removed it.</p>
          <button className="btn leave" onClick={p.onLeave}>
            OK
          </button>
        </>
      )}

      {(g?.role === 'owner' || g?.role === 'member') && (
        <>
          {g.role === 'owner' && (
            <div className="code-row">
              <button className="btn" onClick={share}>
                {'share' in navigator ? <Share2 aria-hidden /> : <Copy aria-hidden />} {copied ? 'Link copied' : 'Invite friends'}
              </button>
              <p className="fine">Anyone with the link can only ask to join. You approve each person.</p>
            </div>
          )}

          {g.role === 'owner' && p.requests.length > 0 && (
            <>
              <h3>Asking to join</h3>
              <ul className="members">
                {p.requests.map((r) => (
                  <li key={r.id} className={`request${r.changed ? ' is-changed' : ''}`}>
                    <span className="m-name">{r.name}</span>
                    {r.changed ? (
                      <span className="m-where warn-text">
                        <ShieldAlert aria-hidden className="inline-icon" /> This request's keys changed since it first arrived. Someone may be pretending to be {r.name}. Decline, and ask them to send a new request.
                      </span>
                    ) : (
                      <span className="m-where">
                        Safety number <Safety keys={r} /> — all 20 digits must match their screen
                      </span>
                    )}
                    <span className="req-actions">
                      <button className="btn primary" onClick={() => p.onApprove(r)} disabled={r.changed}>
                        <Check aria-hidden /> Approve
                      </button>
                      <button className="btn" onClick={() => p.onDecline(r)}>
                        Decline
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button className="btn share-toggle" aria-pressed={g.sharing} onClick={p.onToggleShare}>
            <Radio aria-hidden /> {g.sharing ? 'Sharing my location — tap to stop' : 'Not sharing — tap to share my location'}
          </button>
          <p className="fine">{p.online ? 'Connected. Locations are end-to-end encrypted.' : 'Connecting to the relay…'}</p>
          {g.sharing && (
            <button className="btn cloak" aria-pressed={p.cloakedUntil > 0} onClick={p.onCloak}>
              <EyeOff aria-hidden /> {p.cloakedUntil ? `Under the cloak until ${clock(p.cloakedUntil)} — take it off` : 'Wear the cloak for 30 minutes'}
            </button>
          )}

          {p.meeting && (
            <section className="meeting">
              <h3>
                <Flag aria-hidden className="inline-icon" /> Meeting at {p.meeting.text}
              </h3>
              <ul className="eta">
                <li>
                  You — {eta(distance(p.youAt, p.meeting.at))}
                </li>
                {p.members.map((m) => (
                  <li key={m.id}>
                    {m.name} — {eta(distance(m.at, p.meeting!.at))}
                  </li>
                ))}
              </ul>
              <button className="btn small" onClick={p.onClearMeeting}>
                Cancel the meeting
              </button>
            </section>
          )}

          <h3>On the map</h3>
          {p.members.length === 0 ? (
            <p className="fine">No one else is sharing yet.</p>
          ) : (
            <ul className="members">
              {p.members.map((m) => (
                <li key={m.id} className="member-row">
                  <button className="member" onClick={() => p.onFocus(m)}>
                    <span className="m-name">
                      {m.name} {m.live && <span className="tag">live</span>}
                    </span>
                    <span className="m-where">
                      {m.dest ? `going to ${m.dest.name}` : 'standing still'} · {far(distance(p.youAt, m.at))} · {ago(m.t)}
                    </span>
                  </button>
                  <button className="btn small" aria-expanded={owlTo === m.id} onClick={() => setOwlTo(owlTo === m.id ? null : m.id)} aria-label={`Send an owl to ${m.name}`}>
                    <Bird aria-hidden /> Owl
                  </button>
                  {owlTo === m.id && (
                    <form
                      className="reply"
                      onSubmit={(e) => {
                        e.preventDefault();
                        p.onSendOwl(m, owlText);
                        setOwlText('');
                        setOwlTo(null);
                      }}
                    >
                      <label htmlFor="owl-text">A letter for {m.name} — only they can read it</label>
                      <textarea id="owl-text" value={owlText} maxLength={280} rows={2} autoFocus onChange={(e) => setOwlText(e.target.value)} />
                      <button className="btn primary" type="submit" disabled={!owlText.trim()}>
                        Send the owl
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          {g.role === 'owner' && g.members.length > 0 && (
            <>
              <h3>Approved members</h3>
              <ul className="members">
                {g.members.map((m) => (
                  <li key={m.id} className="approved">
                    <span className="m-name">{m.name}</span>
                    <button className="btn small" onClick={() => p.onRemove(m.id)} aria-label={`Remove ${m.name} from the group`}>
                      <UserMinus aria-hidden /> Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p className="fine">Removing someone gives everyone else a new key, so the removed phone can no longer see the group.</p>
            </>
          )}

          <button className="btn leave" onClick={p.onLeave}>
            <LogOut aria-hidden /> {g.role === 'owner' ? 'Close my group' : 'Leave group'}
          </button>
        </>
      )}
      <section className="field">
        <h3>
          <Tent aria-hidden className="inline-icon" /> The open field
        </h3>
        {p.fieldUntil ? (
          <>
            <p className="fine">
              You are in the open field until {clock(p.fieldUntil)}. {p.fieldPeople ? `${p.fieldPeople} ${p.fieldPeople === 1 ? 'other wanderer is' : 'others are'} here with you.` : 'No one else is here yet.'}
            </p>
            <button className="btn" onClick={() => p.onField(false)}>
              Leave the open field
            </button>
          </>
        ) : fieldAsk ? (
          <>
            <p className="fine warn-text">
              Anyone within about 10 km who is also in the open field will see your name and where you are (rounded to about 100 m). Strangers too. You leave it by yourself after an hour.
            </p>
            <div className="req-actions">
              <button className="btn primary" onClick={() => (setFieldAsk(false), p.onField(true))}>
                Yes, step into the field
              </button>
              <button className="btn" onClick={() => setFieldAsk(false)}>
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="fine">A public square: everyone who chooses to step in sees each other nearby. Only those who step in.</p>
            <button className="btn" onClick={() => setFieldAsk(true)}>
              Step into the open field…
            </button>
          </>
        )}
      </section>
    </aside>
  );
}
