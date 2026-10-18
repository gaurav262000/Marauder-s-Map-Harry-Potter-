import type { LngLat } from './geo.ts';
import { groupKeys, seal, unseal } from './groupCrypto.ts';

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

// Free public MQTT relays. Every message goes to all of them, so a group keeps
// working if one is down and members never end up split across relays.
const BROKERS: string[] = String(import.meta.env.VITE_MQTT_BROKERS ?? 'wss://broker.hivemq.com:8884/mqtt,wss://broker.emqx.io:8084/mqtt').split(',');
const PREFIX = 'enchanted-atlas/v1';

const isCoord = (v: unknown): v is LngLat =>
  Array.isArray(v) && v.length === 2 && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90 && v.every(Number.isFinite);

/** Messages are encrypted, but anyone holding the code can send anything: check the shape. */
export function asMember(v: unknown, id: string): Member | null {
  const m = v as Partial<Member> | null;
  if (!m || m.id !== id || typeof m.name !== 'string' || !isCoord(m.at) || !Number.isFinite(m.t)) return null;
  const dest = m.dest && typeof m.dest.name === 'string' && isCoord(m.dest.at) ? { name: m.dest.name.slice(0, 60), at: m.dest.at } : null;
  return { id, name: m.name.slice(0, 28) || 'A Wanderer', at: m.at, dest, live: !!m.live, t: m.t! };
}

export interface Group {
  /** Resolves false when no relay is connected yet (nothing sent). */
  publish(me: Member): Promise<boolean>;
  /** Removes your last position from the relay (others stop seeing you). */
  hide(): void;
  leave(): void;
}

export async function joinGroup(
  code: string,
  meId: string,
  { onMember, onGone, onStatus }: { onMember: (m: Member) => void; onGone: (id: string) => void; onStatus: (online: boolean) => void },
): Promise<Group> {
  const [{ key, topic }, { default: mqtt }] = await Promise.all([groupKeys(code), import('mqtt')]);
  const base = `${PREFIX}/${topic}`;
  const mine = `${base}/${meId}`;
  const clients = BROKERS.map((url) =>
    mqtt.connect(url, { clientId: `atlas-${meId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`, reconnectPeriod: 5000, connectTimeout: 10_000 }),
  );
  const status = () => onStatus(clients.some((c) => c.connected));

  for (const c of clients) {
    c.on('connect', () => {
      c.subscribe(`${base}/+`);
      status();
    });
    c.on('close', status);
    c.on('error', () => {}); // reconnects on its own; status() reflects it
    c.on('message', async (t, payload) => {
      const id = t.slice(base.length + 1);
      if (id === meId) return;
      if (!payload.length) return onGone(id);
      const m = asMember(await unseal(key, new Uint8Array(payload)), id);
      if (m) onMember(m);
    });
  }

  return {
    async publish(me) {
      const bytes = await seal(key, me);
      const up = clients.filter((c) => c.connected);
      for (const c of up) c.publish(mine, bytes as Buffer, { retain: true, qos: 0 });
      return up.length > 0;
    },
    hide() {
      for (const c of clients) if (c.connected) c.publish(mine, '', { retain: true, qos: 0 });
    },
    leave() {
      for (const c of clients) c.end();
    },
  };
}
