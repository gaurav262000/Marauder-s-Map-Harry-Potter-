import type { LngLat } from './geo.ts';
import { fingerprint, groupKeys, lobbyKeys, seal, sealTo, unseal, unsealFrom, type Identity } from './groupCrypto.ts';

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
  t: number;
}

// Free public MQTT relays. Every message goes to all of them, so a group keeps
// working if one is down and members never end up split across relays.
const BROKERS: string[] = String(import.meta.env.VITE_MQTT_BROKERS ?? 'wss://broker.hivemq.com:8884/mqtt,wss://broker.emqx.io:8084/mqtt').split(',');
const PREFIX = 'enchanted-atlas/v2';
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const publicPart = (k: JsonWebKey): JsonWebKey => ({ kty: 'EC', crv: 'P-256', x: k.x, y: k.y });

const isCoord = (v: unknown): v is LngLat =>
  Array.isArray(v) && v.length === 2 && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90 && v.every(Number.isFinite);
const isPub = (v: unknown): v is JsonWebKey => !!v && typeof (v as JsonWebKey).x === 'string' && typeof (v as JsonWebKey).y === 'string';

/** Messages are encrypted, but every member holds the key and could send anything: check the shape. */
export function asMember(v: unknown, id: string): Member | null {
  const m = v as Partial<Member> | null;
  if (!m || m.id !== id || typeof m.name !== 'string' || !isCoord(m.at) || !Number.isFinite(m.t)) return null;
  const dest = m.dest && typeof m.dest.name === 'string' && isCoord(m.dest.at) ? { name: m.dest.name.slice(0, 60), at: m.dest.at } : null;
  return { id, name: m.name.slice(0, 28) || 'A Wanderer', at: m.at, dest, live: !!m.live, t: m.t! };
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
  isOwner: boolean;
}

export interface Handlers {
  onStatus: (online: boolean) => void;
  onMember?: (m: Member) => void;
  onGone?: (id: string) => void;
  /** owner only: someone asked to join */
  onRequest?: (r: JoinRequest) => void;
  onRequestGone?: (id: string) => void;
  /** members: the owner sent (or replaced) the group key */
  onKey?: (key: string, epoch: number) => void;
  onDenied?: () => void;
}

export interface Group {
  publish(me: Member): Promise<boolean>;
  /** Removes your last position from the relay (others stop seeing you). */
  hide(): void;
  requestJoin(name: string): Promise<void>;
  /** owner: hand `key` to a member, sealed so only that member can read it */
  sendKey(to: { id: string; pub: JsonWebKey }, key: string, epoch: number): Promise<void>;
  /** owner: refuse or revoke a member, and clear their request */
  refuse(to: { id: string; pub: JsonWebKey }): Promise<void>;
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

  const clients = BROKERS.map((url) =>
    mqtt.connect(url, { clientId: `atlas-${me.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`, reconnectPeriod: 5000, connectTimeout: 10_000 }),
  );
  const status = () => h.onStatus(clients.some((c) => c.connected));
  const send = (topic: string, payload: Uint8Array | string) => {
    const up = clients.filter((c) => c.connected);
    for (const c of up) c.publish(topic, payload as Buffer, { retain: true, qos: 1 });
    return up.length > 0;
  };

  const onPresence = async (id: string, payload: Uint8Array) => {
    if (id === me.id) return;
    if (!payload.length) return h.onGone?.(id);
    const m = asMember(await unseal(presence!.key, payload), id);
    if (m) h.onMember?.(m);
  };

  const onRequest = async (id: string, payload: Uint8Array) => {
    if (!payload.length) return h.onRequestGone?.(id);
    const r = (await unseal(lobby.key, payload)) as Partial<JoinRequest> | null;
    if (r && r.id === id && typeof r.name === 'string' && isPub(r.pub) && Number.isFinite(r.t))
      h.onRequest?.({ id, name: r.name.slice(0, 28) || 'Someone', pub: publicPart(r.pub), t: r.t! });
  };

  /** Only a key sealed by the owner whose fingerprint is in the invite link is accepted. */
  const onInbox = async (payload: Uint8Array) => {
    if (!payload.length) return;
    let env: { owner?: JsonWebKey; box?: string };
    try {
      env = JSON.parse(dec.decode(payload));
    } catch {
      return;
    }
    if (!isPub(env.owner) || (await fingerprint(env.owner)) !== link.ownerFp) return;
    if (typeof env.box !== 'string') return;
    const v = (await unsealFrom(me.identity.priv, env.owner, unb64(env.box))) as { key?: string; epoch?: number; denied?: boolean } | null;
    if (v?.denied) h.onDenied?.();
    else if (v && typeof v.key === 'string' && Number.isFinite(v.epoch)) h.onKey?.(v.key, v.epoch!);
  };

  for (const c of clients) {
    c.on('connect', () => {
      if (presenceBase) c.subscribe(`${presenceBase}/+`);
      if (link.isOwner) c.subscribe(`${lobbyBase}/+`);
      else c.subscribe(`${inboxBase}/${me.id}`);
      status();
    });
    c.on('close', status);
    c.on('error', () => {}); // reconnects on its own; status() reflects it
    c.on('message', (topic, buf) => {
      const payload = new Uint8Array(buf);
      const id = topic.slice(topic.lastIndexOf('/') + 1);
      if (presenceBase && topic.startsWith(presenceBase + '/')) void onPresence(id, payload);
      else if (topic.startsWith(lobbyBase + '/')) void onRequest(id, payload);
      else if (topic === `${inboxBase}/${me.id}`) void onInbox(payload);
    });
  }

  const envelope = (body: object) => enc.encode(JSON.stringify({ owner: publicPart(me.identity.pub), ...body }));

  return {
    async publish(m) {
      return !!presenceBase && send(`${presenceBase}/${me.id}`, await seal(presence!.key, m));
    },
    hide() {
      if (presenceBase) send(`${presenceBase}/${me.id}`, '');
    },
    async requestJoin(name) {
      // Kept on the relay, so the owner sees it even if they open the map later.
      send(`${lobbyBase}/${me.id}`, await seal(lobby.key, { id: me.id, name, pub: publicPart(me.identity.pub), t: Date.now() }));
    },
    async sendKey(to, key, epoch) {
      send(`${inboxBase}/${to.id}`, envelope({ box: b64(await sealTo(me.identity.priv, to.pub, { key, epoch })) }));
      send(`${lobbyBase}/${to.id}`, '');
    },
    async refuse(to) {
      send(`${inboxBase}/${to.id}`, envelope({ box: b64(await sealTo(me.identity.priv, to.pub, { denied: true })) }));
      send(`${lobbyBase}/${to.id}`, '');
    },
    leave() {
      for (const c of clients) c.end();
    },
  };
}
