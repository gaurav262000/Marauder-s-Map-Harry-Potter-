// The open field: a public square on the map. Anyone who chooses to step in
// sees everyone else who did, nearby (about 10 km). Nothing here is secret:
// positions are signed (so nobody can post under someone else's id) but not
// encrypted, and are rounded to about 100 m before they leave the phone.
import type { MqttClient } from 'mqtt';
import type { LngLat } from './geo.ts';
import { fingerprint, isPub, publicPart, sign, verify, type Identity } from './groupCrypto.ts';

const PREFIX = 'enchanted-atlas/v3/f';
/** People not heard from for this long have left the field. */
export const FIELD_STALE_MS = 10 * 60_000;
const dec = new TextDecoder();

export interface Stranger {
  id: string;
  name: string;
  at: LngLat;
  t: number;
}

// ——— geohash cells (~4.9 km at 5 characters) ———
const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';
export function geohash([lng, lat]: LngLat, len = 5): string {
  let [lo1, hi1, lo2, hi2] = [-180, 180, -90, 90];
  let out = '';
  let bits = 0;
  let ch = 0;
  let even = true;
  while (out.length < len) {
    if (even) {
      const mid = (lo1 + hi1) / 2;
      ch = (ch << 1) | (lng >= mid ? 1 : 0);
      if (lng >= mid) lo1 = mid;
      else hi1 = mid;
    } else {
      const mid = (lo2 + hi2) / 2;
      ch = (ch << 1) | (lat >= mid ? 1 : 0);
      if (lat >= mid) lo2 = mid;
      else hi2 = mid;
    }
    even = !even;
    if (++bits === 5) {
      out += B32[ch];
      bits = 0;
      ch = 0;
    }
  }
  return out;
}

/** Your cell and the eight around it. */
export function nearCells([lng, lat]: LngLat): string[] {
  const step = 0.044; // one 5-character cell is 0.0439° on each side
  const cells = new Set<string>();
  for (const dy of [-step, 0, step]) for (const dx of [-step, 0, step]) cells.add(geohash([lng + dx, Math.max(-89.9, Math.min(89.9, lat + dy))]));
  return [...cells];
}

/** About 100 m: enough to find each other in a park, not enough to find a front door. */
export const blur = ([lng, lat]: LngLat): LngLat => [Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000];

export interface Field {
  /** Publishes where you are (already blurred) and listens around it. */
  move(at: LngLat, name: string): Promise<void>;
  leave(): void;
}

export async function joinField(identity: Identity, onStranger: (s: Stranger) => void, onGone: (id: string) => void): Promise<Field> {
  const { default: mqtt } = await import('mqtt');
  const id = await fingerprint(identity.signPub);
  const brokers = String(import.meta.env.VITE_MQTT_BROKERS).split(',');
  const clients: MqttClient[] = brokers.map((url) => mqtt.connect(url, { clientId: `atlas-f-${Math.random().toString(36).slice(2, 12)}`, reconnectPeriod: 5000, connectTimeout: 10_000 }));
  let cells: string[] = [];
  let mine: string | null = null; // the topic currently holding my position
  let last: { topic: string; payload: string } | null = null;

  const subscribe = (c: MqttClient) => c.connected && cells.length && c.subscribe(cells.map((cell) => `${PREFIX}/${cell}/+`));
  for (const c of clients) {
    c.on('connect', () => {
      subscribe(c);
      if (last) c.publish(last.topic, last.payload, { retain: true, qos: 1 });
    });
    c.on('error', () => {});
    c.on('message', async (topic, buf) => {
      const from = topic.slice(topic.lastIndexOf('/') + 1);
      if (from === id) return;
      if (!buf.length) return onGone(from);
      try {
        const env = JSON.parse(dec.decode(new Uint8Array(buf))) as { signPub?: JsonWebKey; s?: unknown };
        // the id is the signing key's fingerprint, so nobody can post as someone else
        if (!isPub(env.signPub) || (await fingerprint(env.signPub)) !== from) return;
        const v = (await verify(publicPart(env.signPub), env.s)) as Partial<Stranger> | null;
        const at = v?.at;
        if (!v || v.id !== from || typeof v.name !== 'string' || !Array.isArray(at) || !at.every(Number.isFinite) || !Number.isFinite(v.t)) return;
        if (Date.now() - v.t! > FIELD_STALE_MS || v.t! - Date.now() > 120_000) return;
        onStranger({ id: from, name: v.name.slice(0, 28) || 'A Wanderer', at: blur(at as LngLat), t: v.t! });
      } catch {
        /* not ours */
      }
    });
  }
  const send = (topic: string, payload: string) => {
    for (const c of clients) if (c.connected) c.publish(topic, payload, { retain: true, qos: 1 });
  };

  return {
    async move(at, name) {
      const spot = blur(at);
      const next = nearCells(spot);
      if (next.join() !== cells.join()) {
        for (const c of clients) if (c.connected && cells.length) c.unsubscribe(cells.map((cell) => `${PREFIX}/${cell}/+`));
        cells = next;
        clients.forEach(subscribe);
      }
      const topic = `${PREFIX}/${geohash(spot)}/${id}`;
      if (mine && mine !== topic) send(mine, ''); // moved into another cell: leave nothing behind
      mine = topic;
      const payload = JSON.stringify({ signPub: identity.signPub, s: await sign(identity.signPriv, { id, name, at: spot, t: Date.now() }) });
      last = { topic, payload };
      send(topic, payload);
    },
    leave() {
      if (mine) send(mine, '');
      last = null;
      // let the clearing message go out before closing
      setTimeout(() => clients.forEach((c) => c.end()), 500);
    },
  };
}
