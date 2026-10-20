import type { LngLat } from './geo.ts';
import { b64, fingerprint, groupKeys, isPub, lobbyKeys, publicPart, seal, sealTo, sign, unb64, unseal, unsealFrom, verify, type Identity } from './groupCrypto.ts';

export interface Member {
  id: string;
  name: string;
  at: LngLat;
  dest: { name: string; at: LngLat } | null;
  /** true when the position comes from the device's GPS */
  live: boolean;
  /** ms since epoch, sender's clock */
  t: number;
}

export interface JoinRequest {
  id: string;
  name: string;
  pub: JsonWebKey;
  signPub: JsonWebKey;
  t: number;
}

/** Who may post positions, as signed by the owner. Names come from here, not from members. */
export interface Roster {
  epoch: number;
  /** pub (ECDH) lets members seal owls to each other; older owners don't send it */
  members: { id: string; name: string; signPub: JsonWebKey; pub?: JsonWebKey }[];
}

/** A letter carried by owl, readable only by its one recipient. */
export interface Owl {
  from: string;
  name: string;
  text: string;
  t: number;
}

/**
 * A note left at a place for the group, shown when someone stands close to it.
 * The group's meeting place travels the same way, flagged `meet` (the newest wins; empty text clears it).
 */
export interface SecretNote {
  key: string;
  from: string;
  name: string;
  at: LngLat;
  text: string;
  t: number;
  meet?: boolean;
}

// MQTT relays (list in vite.config.ts). Every message goes to all of them, so a group keeps
// working if one is down and members never end up split across relays.
const BROKERS: string[] = String(import.meta.env.VITE_MQTT_BROKERS).split(',');
const PREFIX = 'enchanted-atlas/v3';
const ROSTER = '_roster';
const enc = new TextEncoder();
const dec = new TextDecoder();

const isCoord = (v: unknown): v is LngLat =>
  Array.isArray(v) && v.length === 2 && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90 && v.every(Number.isFinite);

/** Even signed messages are checked for shape before use. */
export function asMember(v: unknown, id: string): Member | null {
  const m = v as Partial<Member> | null;
  if (!m || m.id !== id || typeof m.name !== 'string' || !isCoord(m.at) || !Number.isFinite(m.t)) return null;
  const dest = m.dest && typeof m.dest.name === 'string' && isCoord(m.dest.at) ? { name: m.dest.name.slice(0, 60), at: m.dest.at } : null;
  return { id, name: m.name.slice(0, 28) || 'A Wanderer', at: m.at, dest, live: !!m.live, t: m.t! };
}

function asRoster(v: unknown): Roster | null {
  const r = v as Partial<Roster> | null;
  if (!r || !Number.isFinite(r.epoch) || !Array.isArray(r.members)) return null;
  const members = r.members.filter((m) => m && typeof m.id === 'string' && typeof m.name === 'string' && isPub(m.signPub));
  return {
    epoch: r.epoch!,
    members: members.map((m) => ({ id: m.id, name: m.name.slice(0, 28), signPub: publicPart(m.signPub), ...(isPub(m.pub) && { pub: publicPart(m.pub) }) })),
  };
}

export interface Me {
  id: string;
  identity: Identity;
}

export interface GroupLink {
  code: string;
  ownerFp: string;
  /** null until the owner has approved this device */
  key: string | null;
  epoch: number;
  isOwner: boolean;
  /** owner's signing key, learned from the owner's sealed key message */
  ownerSignPub: JsonWebKey | null;
}

export interface Handlers {
  onStatus: (online: boolean) => void;
  onMember?: (m: Member) => void;
  onGone?: (id: string) => void;
  /** owner only: someone asked to join */
  onRequest?: (r: JoinRequest) => void;
  onRequestGone?: (id: string) => void;
  /** members: the owner sent (or replaced) the group key */
  onKey?: (key: string, epoch: number, ownerSignPub: JsonWebKey) => void;
  onDenied?: () => void;
  onOwl?: (o: Owl) => void;
  onNote?: (n: SecretNote) => void;
  onNoteGone?: (key: string) => void;
}

export interface Group {
  publish(me: Member): Promise<boolean>;
  /** Removes your last position from the relay (others stop seeing you). */
  hide(): void;
  requestJoin(name: string): Promise<void>;
  /** owner: hand the group key to a member, sealed so only that member can read it */
  sendKey(to: { id: string; pub: JsonWebKey }, key: string, epoch: number): Promise<void>;
  /** owner: refuse or revoke a member, and clear their request */
  refuse(to: { id: string; pub: JsonWebKey }): Promise<void>;
  /** owner: publish who is allowed to post positions */
  publishRoster(r: Roster): Promise<boolean>;
  /** false when the recipient's key isn't known (not on the roster, or an older owner's roster) */
  sendOwl(to: string, text: string): Promise<boolean>;
  leaveNote(id: string, at: LngLat, text: string, meet?: boolean): Promise<boolean>;
  removeNote(id: string): void;
  leave(): void;
}

export async function connectGroup(link: GroupLink, me: Me, h: Handlers): Promise<Group> {
  const [lobby, presence, { default: mqtt }] = await Promise.all([
    lobbyKeys(link.code),
    link.key ? groupKeys(link.key) : Promise.resolve(null),
    import('mqtt'),
  ]);
  const lobbyBase = `${PREFIX}/l/${lobby.topic}`;
  const inboxBase = `${PREFIX}/i/${lobby.topic}`;
  const presenceBase = presence && `${PREFIX}/p/${presence.topic}`;
  const owlBase = presenceBase && `${presenceBase}/o`;
  const noteBase = presenceBase && `${presenceBase}/n`;

  const clients = BROKERS.map((url) =>
    mqtt.connect(url, { clientId: `atlas-${Math.random().toString(36).slice(2, 12)}`, reconnectPeriod: 5000, connectTimeout: 10_000 }),
  );
  const status = () => h.onStatus(clients.some((c) => c.connected));
  // Everything this device keeps on the relays, re-sent to any relay that (re)connects later,
  // so friends who can only reach that relay still get the key, roster and positions.
  const kept = new Map<string, Uint8Array | string>();
  const send = (topic: string, payload: Uint8Array | string) => {
    kept.set(topic, payload);
    const up = clients.filter((c) => c.connected);
    for (const c of up) c.publish(topic, payload as Buffer, { retain: true, qos: 1 });
    return up.length > 0;
  };

  // ——— Positions: accepted only when signed by a roster member, for the current key ———
  let roster: Roster | null = null;
  const waiting = new Map<string, unknown>(); // signed positions that arrived before the roster

  const check = async (id: string) => {
    const signed = waiting.get(id);
    const entry = roster?.members.find((m) => m.id === id);
    if (!signed || !entry) return;
    const v = (await verify(entry.signPub, signed)) as (Member & { epoch?: number }) | null;
    if (v?.epoch !== link.epoch) return; // replayed message from an older key
    const m = asMember(v, id);
    if (m) h.onMember?.({ ...m, name: entry.name });
  };

  // Owls and notes are checked against the roster too; ones that arrive before it wait here.
  const owls = new Map<string, Uint8Array>();
  const notes = new Map<string, Uint8Array>();
  const member = (id: string) => roster?.members.find((m) => m.id === id);

  const openOwl = async (from: string) => {
    const entry = member(from);
    const payload = owls.get(from);
    if (!entry?.pub || !payload) return;
    const v = (await unsealFrom(me.identity.priv, entry.pub, payload)) as Partial<Owl> | null;
    if (typeof v?.text === 'string' && Number.isFinite(v.t)) h.onOwl?.({ from, name: entry.name, text: v.text.slice(0, 280), t: v.t! });
  };

  const openNote = async (key: string) => {
    const from = key.slice(0, key.indexOf('/'));
    const entry = member(from);
    const payload = notes.get(key);
    if (!entry || !payload) return;
    const v = (await verify(entry.signPub, await unseal(presence!.key, payload))) as Partial<SecretNote> & { epoch?: number } | null;
    if (v?.epoch === link.epoch && typeof v.text === 'string' && isCoord(v.at) && Number.isFinite(v.t))
      h.onNote?.({ key, from, name: entry.name, at: v.at, text: v.text.slice(0, 280), t: v.t!, ...(v.meet === true && { meet: true }) });
  };

  const onPresence = async (id: string, payload: Uint8Array) => {
    if (id === me.id) return;
    if (!payload.length) {
      waiting.delete(id);
      return h.onGone?.(id);
    }
    const opened = await unseal(presence!.key, payload);
    if (id === ROSTER) {
      const r = link.ownerSignPub && asRoster(await verify(link.ownerSignPub, opened));
      if (!r || r.epoch !== link.epoch) return;
      roster = r;
      // Anyone no longer on the roster disappears; everyone waiting is re-checked.
      for (const id of waiting.keys()) if (!r.members.some((m) => m.id === id)) h.onGone?.(id);
      for (const id of waiting.keys()) void check(id);
      for (const from of owls.keys()) void openOwl(from);
      for (const key of notes.keys()) void openNote(key);
      return;
    }
    waiting.set(id, opened);
    void check(id);
  };

  const onRequest = async (id: string, payload: Uint8Array) => {
    if (!payload.length) return h.onRequestGone?.(id);
    const r = (await unseal(lobby.key, payload)) as Partial<JoinRequest> | null;
    if (r && r.id === id && typeof r.name === 'string' && isPub(r.pub) && isPub(r.signPub) && Number.isFinite(r.t))
      h.onRequest?.({ id, name: r.name.slice(0, 28) || 'Someone', pub: publicPart(r.pub), signPub: publicPart(r.signPub), t: r.t! });
  };

  /** Only a box sealed by the owner whose fingerprint is in the invite link is accepted. */
  const onInbox = async (payload: Uint8Array) => {
    if (!payload.length) return;
    let env: { owner?: JsonWebKey; box?: string };
    try {
      env = JSON.parse(dec.decode(payload));
    } catch {
      return;
    }
    if (!isPub(env.owner) || typeof env.box !== 'string' || (await fingerprint(env.owner)) !== link.ownerFp) return;
    const v = (await unsealFrom(me.identity.priv, env.owner, unb64(env.box))) as { key?: string; epoch?: number; ownerSignPub?: JsonWebKey; denied?: boolean } | null;
    if (v?.denied) h.onDenied?.();
    else if (v && typeof v.key === 'string' && Number.isFinite(v.epoch) && isPub(v.ownerSignPub)) h.onKey?.(v.key, v.epoch!, publicPart(v.ownerSignPub));
  };

  for (const c of clients) {
    c.on('connect', () => {
      if (presenceBase) c.subscribe([`${presenceBase}/+`, `${owlBase}/${me.id}/+`, `${noteBase}/+/+`]);
      if (link.isOwner) c.subscribe(`${lobbyBase}/+`);
      else c.subscribe(`${inboxBase}/${me.id}`);
      for (const [topic, payload] of kept) c.publish(topic, payload as Buffer, { retain: true, qos: 1 });
      status();
    });
    c.on('close', status);
    c.on('error', () => {}); // reconnects on its own; status() reflects it
    c.on('message', (topic, buf) => {
      const payload = new Uint8Array(buf);
      const id = topic.slice(topic.lastIndexOf('/') + 1);
      if (owlBase && topic.startsWith(`${owlBase}/${me.id}/`)) {
        if (!payload.length) return;
        owls.set(id, payload);
        void openOwl(id);
      } else if (noteBase && topic.startsWith(noteBase + '/')) {
        const key = topic.slice(noteBase.length + 1);
        if (!payload.length) {
          notes.delete(key);
          return h.onNoteGone?.(key);
        }
        notes.set(key, payload);
        void openNote(key);
      } else if (presenceBase && topic.startsWith(presenceBase + '/')) void onPresence(id, payload);
      else if (topic.startsWith(lobbyBase + '/')) void onRequest(id, payload);
      else if (topic === `${inboxBase}/${me.id}`) void onInbox(payload);
    });
  }

  const envelope = async (to: JsonWebKey, body: object) =>
    enc.encode(JSON.stringify({ owner: me.identity.pub, box: b64(await sealTo(me.identity.priv, to, body)) }));

  return {
    async publish(m) {
      if (!presenceBase) return false;
      return send(`${presenceBase}/${me.id}`, await seal(presence!.key, await sign(me.identity.signPriv, { ...m, epoch: link.epoch })));
    },
    hide() {
      if (presenceBase) send(`${presenceBase}/${me.id}`, '');
    },
    async requestJoin(name) {
      // Kept on the relay, so the owner sees it even if they open the map later.
      send(`${lobbyBase}/${me.id}`, await seal(lobby.key, { id: me.id, name, pub: me.identity.pub, signPub: me.identity.signPub, t: Date.now() }));
    },
    async sendKey(to, key, epoch) {
      send(`${inboxBase}/${to.id}`, await envelope(to.pub, { key, epoch, ownerSignPub: me.identity.signPub }));
      send(`${lobbyBase}/${to.id}`, '');
    },
    async refuse(to) {
      send(`${inboxBase}/${to.id}`, await envelope(to.pub, { denied: true }));
      send(`${lobbyBase}/${to.id}`, '');
    },
    async publishRoster(r) {
      if (!presenceBase) return false;
      return send(`${presenceBase}/${ROSTER}`, await seal(presence!.key, await sign(me.identity.signPriv, r)));
    },
    async sendOwl(to, text) {
      const pub = member(to)?.pub;
      if (!owlBase || !pub) return false;
      return send(`${owlBase}/${to}/${me.id}`, await sealTo(me.identity.priv, pub, { text, t: Date.now() }));
    },
    async leaveNote(id, at, text, meet = false) {
      if (!noteBase) return false;
      return send(`${noteBase}/${me.id}/${id}`, await seal(presence!.key, await sign(me.identity.signPriv, { at, text, t: Date.now(), epoch: link.epoch, meet })));
    },
    removeNote(id) {
      if (noteBase) send(`${noteBase}/${me.id}/${id}`, '');
    },
    leave() {
      for (const c of clients) c.end();
    },
  };
}
