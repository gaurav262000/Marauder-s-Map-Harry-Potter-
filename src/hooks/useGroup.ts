import { useCallback, useEffect, useRef, useState } from 'react';
import { connectGroup, type Group, type JoinRequest, type Member } from '../lib/group.ts';
import { fingerprint, newGroupCode, newGroupKey, normalizeCode, samePub, type Identity } from '../lib/groupCrypto.ts';
import { deviceIdentity } from '../lib/keystore.ts';

export type Role = 'owner' | 'member' | 'pending' | 'denied';

export interface GroupState {
  code: string;
  ownerFp: string;
  role: Role;
  key: string | null;
  epoch: number;
  sharing: boolean;
  /** owner's signing key; members learn it from the owner's sealed key message */
  ownerSignPub: JsonWebKey | null;
  /** owner only: approved members, so a new key can reach them when someone is removed */
  members: { id: string; name: string; pub: JsonWebKey; signPub: JsonWebKey }[];
}

export interface Invite {
  code: string;
  ownerFp: string;
}

/** A join request, flagged when its keys differ from an earlier request with the same id. */
export type RequestView = JoinRequest & { changed: boolean };

const GROUP_KEY = 'atlas-group-v3';

function load<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: it just won't be remembered */
  }
}

// Older versions kept an exportable private key in localStorage: wipe it.
save('atlas-identity', null);
save('atlas-group-v2', null);
save('atlas-group', null);

const without = <T,>(all: Record<string, T>, id: string) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== id));

/** Accepts a full invite link or the "code.fingerprint" text inside it. */
export function parseInvite(text: string): Invite | null {
  const m = normalizeCode(text).match(/([a-z2-9]{5}-[a-z2-9]{5}-[a-z2-9]{5})\.([0-9a-f]{20})/);
  return m ? { code: m[1], ownerFp: m[2] } : null;
}

export const inviteLink = (g: { code: string; ownerFp: string }) => `${location.origin}${location.pathname}#g=${g.code}.${g.ownerFp}`;

/** Stable per-device id, so friends see one walker per person. */
export const ME_ID: string = load<string>('atlas-id') ?? crypto.randomUUID();
save('atlas-id', ME_ID);

export function useGroup(enabled: boolean, name: string) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [group, setGroup] = useState<GroupState | null>(() => load<GroupState>(GROUP_KEY));
  const [invite, setInvite] = useState<Invite | null>(() => parseInvite(location.hash));
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [requests, setRequests] = useState<Record<string, RequestView>>({});
  const [online, setOnline] = useState(false);
  const ref = useRef<Group | null>(null);
  /** first keys seen per requesting device: a later request with other keys is suspicious */
  const seenKeys = useRef(new Map<string, JsonWebKey>());
  const latest = useRef({ group, name });
  latest.current = { group, name };

  useEffect(() => {
    void deviceIdentity().then(setIdentity);
  }, []);

  useEffect(() => save(GROUP_KEY, group), [group]);

  // One relay connection per (group, key). A new key (member removed) reconnects on the new topic.
  const code = group?.code;
  const ownerFp = group?.ownerFp;
  const key = group?.key ?? null;
  const epoch = group?.epoch ?? 0;
  const isOwner = group?.role === 'owner';
  const ownerSignPub = isOwner ? (identity?.signPub ?? null) : (group?.ownerSignPub ?? null);
  const ownerSignX = ownerSignPub?.x;
  useEffect(() => {
    if (!enabled || !identity || !code || !ownerFp) return;
    let cancelled = false;
    let asked = false;
    connectGroup({ code, ownerFp, key, epoch, isOwner, ownerSignPub }, { id: ME_ID, identity }, {
      onStatus: (up) => {
        setOnline(up);
        // Waiting devices (re)send their request; it stays on the relay until the owner answers.
        if (up && !asked && latest.current.group?.role === 'pending' && ref.current) {
          asked = true;
          void ref.current.requestJoin(latest.current.name || 'A Wanderer');
        }
      },
      onMember: (m) => setMembers((all) => ((all[m.id]?.t ?? 0) >= m.t ? all : { ...all, [m.id]: m })),
      onGone: (id) => setMembers((all) => without(all, id)),
      onRequest: (r) => {
        const first = seenKeys.current.get(r.id) ?? latest.current.group?.members.find((m) => m.id === r.id)?.pub;
        if (!first) seenKeys.current.set(r.id, r.pub);
        setRequests((all) => ({ ...all, [r.id]: { ...r, changed: !!first && !samePub(first, r.pub) } }));
      },
      onRequestGone: (id) => setRequests((all) => without(all, id)),
      onKey: (k, ep, signPub) => {
        const g = latest.current.group;
        if (!g || (g.key === k && g.role === 'member') || ep < g.epoch) return;
        if (g.key && g.sharing) ref.current?.hide(); // leave nothing behind on the old topic
        setGroup({ ...g, key: k, epoch: ep, role: 'member', ownerSignPub: signPub });
      },
      onDenied: () => {
        if (latest.current.group?.sharing) ref.current?.hide();
        setGroup((g) => g && { ...g, role: 'denied', key: null });
      },
    })
      .then((g) => {
        if (cancelled) return g.leave();
        ref.current = g;
        if (latest.current.group?.role === 'pending') void g.requestJoin(latest.current.name || 'A Wanderer');
      })
      .catch(() => setOnline(false));
    return () => {
      cancelled = true;
      ref.current?.leave();
      ref.current = null;
      setMembers({});
      setRequests({});
      setOnline(false);
    };
    // ownerSignPub is tracked by its x coordinate so a re-created object doesn't reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, identity, code, ownerFp, key, epoch, isOwner, ownerSignX]);

  // Owner: keep the signed roster (who may post, under which name) up to date.
  const approved = group?.members;
  useEffect(() => {
    if (!online || !isOwner || !identity || !ref.current) return;
    void ref.current.publishRoster({
      epoch,
      members: [{ id: ME_ID, name: name || 'A Wanderer', signPub: identity.signPub }, ...(approved ?? []).map(({ id, name, signPub }) => ({ id, name, signPub }))],
    });
  }, [online, isOwner, identity, epoch, approved, name]);

  const clearInvite = () => {
    setInvite(null);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };

  const create = useCallback(async () => {
    if (!identity) return;
    setGroup({ code: newGroupCode(), ownerFp: await fingerprint(identity.pub), role: 'owner', key: newGroupKey(), epoch: 1, sharing: true, ownerSignPub: null, members: [] });
    clearInvite();
  }, [identity]);

  const join = (inv: Invite) => {
    setGroup({ ...inv, role: 'pending', key: null, epoch: 0, sharing: true, ownerSignPub: null, members: [] });
    clearInvite();
  };

  const approve = async (r: RequestView) => {
    const g = latest.current.group;
    if (!g?.key || !ref.current || r.changed) return;
    await ref.current.sendKey(r, g.key, g.epoch);
    setGroup({ ...g, members: [...g.members.filter((m) => m.id !== r.id), { id: r.id, name: r.name, pub: r.pub, signPub: r.signPub }] });
  };

  const decline = (r: RequestView) => void ref.current?.refuse(r);

  /** Revoke a member: everyone else gets a fresh key, so the removed device can't follow anyone. */
  const remove = async (id: string) => {
    const g = latest.current.group;
    const conn = ref.current;
    if (!g || !conn) return;
    const gone = g.members.find((m) => m.id === id);
    const rest = g.members.filter((m) => m.id !== id);
    const k = newGroupKey();
    const ep = g.epoch + 1;
    for (const m of rest) await conn.sendKey(m, k, ep);
    if (gone) await conn.refuse(gone);
    if (g.sharing) conn.hide();
    setGroup({ ...g, key: k, epoch: ep, members: rest });
  };

  const toggleShare = () => {
    if (group?.sharing) ref.current?.hide();
    setGroup((g) => g && { ...g, sharing: !g.sharing });
  };

  const leave = () => {
    ref.current?.hide();
    setGroup(null);
  };

  return { identity, group, invite, members, requests: Object.values(requests), online, ref, create, join, approve, decline, remove, toggleShare, leave };
}
