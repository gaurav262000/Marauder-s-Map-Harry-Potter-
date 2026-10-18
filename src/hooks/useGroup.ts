import { useCallback, useEffect, useRef, useState } from 'react';
import { connectGroup, type Group, type JoinRequest, type Member } from '../lib/group.ts';
import { fingerprint, newGroupCode, newGroupKey, newIdentity, normalizeCode, type Identity } from '../lib/groupCrypto.ts';

export type Role = 'owner' | 'member' | 'pending' | 'denied';

export interface GroupState {
  code: string;
  ownerFp: string;
  role: Role;
  key: string | null;
  epoch: number;
  sharing: boolean;
  /** owner only: approved members, so a new key can reach them when someone is removed */
  members: { id: string; name: string; pub: JsonWebKey }[];
}

export interface Invite {
  code: string;
  ownerFp: string;
}

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
  const [identity, setIdentity] = useState<Identity | null>(() => load<Identity>('atlas-identity'));
  const [group, setGroup] = useState<GroupState | null>(() => load<GroupState>('atlas-group-v2'));
  const [invite, setInvite] = useState<Invite | null>(() => parseInvite(location.hash));
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [requests, setRequests] = useState<Record<string, JoinRequest>>({});
  const [online, setOnline] = useState(false);
  const ref = useRef<Group | null>(null);
  const latest = useRef({ group, name });
  latest.current = { group, name };

  useEffect(() => {
    if (identity) return;
    void newIdentity().then((id) => {
      save('atlas-identity', id);
      setIdentity(id);
    });
  }, [identity]);

  useEffect(() => save('atlas-group-v2', group), [group]);

  // One relay connection per (group, key). A new key (member removed) reconnects on the new topic.
  const code = group?.code;
  const ownerFp = group?.ownerFp;
  const key = group?.key ?? null;
  const isOwner = group?.role === 'owner';
  useEffect(() => {
    if (!enabled || !identity || !code || !ownerFp) return;
    let cancelled = false;
    let asked = false;
    connectGroup({ code, ownerFp, key, isOwner }, { id: ME_ID, identity }, {
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
      onRequest: (r) => setRequests((all) => ({ ...all, [r.id]: r })),
      onRequestGone: (id) => setRequests((all) => without(all, id)),
      onKey: (k, epoch) => {
        const g = latest.current.group;
        if (!g || (g.key === k && g.role === 'member') || epoch < g.epoch) return;
        if (g.key && g.sharing) ref.current?.hide(); // leave nothing behind on the old topic
        setGroup({ ...g, key: k, epoch, role: 'member' });
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
  }, [enabled, identity, code, ownerFp, key, isOwner]);

  const clearInvite = () => {
    setInvite(null);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };

  const create = useCallback(async () => {
    if (!identity) return;
    setGroup({ code: newGroupCode(), ownerFp: await fingerprint(identity.pub), role: 'owner', key: newGroupKey(), epoch: 1, sharing: true, members: [] });
    clearInvite();
  }, [identity]);

  const join = (inv: Invite) => {
    setGroup({ ...inv, role: 'pending', key: null, epoch: 0, sharing: true, members: [] });
    clearInvite();
  };

  const approve = async (r: JoinRequest) => {
    const g = latest.current.group;
    if (!g?.key || !ref.current) return;
    await ref.current.sendKey(r, g.key, g.epoch);
    setGroup({ ...g, members: [...g.members.filter((m) => m.id !== r.id), { id: r.id, name: r.name, pub: r.pub }] });
  };

  const decline = (r: JoinRequest) => void ref.current?.refuse(r);

  /** Revoke a member: everyone else gets a fresh key, so the removed device can't follow anyone. */
  const remove = async (id: string) => {
    const g = latest.current.group;
    const conn = ref.current;
    if (!g || !conn) return;
    const gone = g.members.find((m) => m.id === id);
    const rest = g.members.filter((m) => m.id !== id);
    const k = newGroupKey();
    const epoch = g.epoch + 1;
    for (const m of rest) await conn.sendKey(m, k, epoch);
    if (gone) await conn.refuse(gone);
    if (g.sharing) conn.hide();
    setGroup({ ...g, key: k, epoch, members: rest });
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
