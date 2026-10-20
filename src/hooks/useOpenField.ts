import { useEffect, useRef, useState } from 'react';
import { distance, type LngLat } from '../lib/geo.ts';
import type { Identity } from '../lib/groupCrypto.ts';
import { blur, FIELD_STALE_MS, joinField, type Stranger } from '../lib/openField.ts';

const TICK_MS = 5000;
const HEARTBEAT_MS = 60_000;
const MAX_SHOWN = 60;

/** While `active`, you stand in the open field: you see the others there, and they see you. */
export function useOpenField(identity: Identity | null, active: boolean, where: () => LngLat | null, name: string) {
  const [people, setPeople] = useState<Record<string, Stranger>>({});
  const latest = useRef({ where, name });
  latest.current = { where, name };

  useEffect(() => {
    if (!identity || !active) return;
    let cancelled = false;
    let field: Awaited<ReturnType<typeof joinField>> | null = null;
    let sent: { at: LngLat; t: number; name: string } | null = null;
    const tick = () => {
      const at = latest.current.where();
      const nm = latest.current.name || 'A Wanderer';
      if (!field || !at) return;
      const now = Date.now();
      if (sent && distance(blur(at), sent.at) < 1 && sent.name === nm && now - sent.t < HEARTBEAT_MS) return;
      sent = { at: blur(at), t: now, name: nm };
      void field.move(at, nm);
      // drop people who went quiet
      setPeople((all) => Object.fromEntries(Object.entries(all).filter(([, s]) => now - s.t < FIELD_STALE_MS)));
    };
    void joinField(
      identity,
      (s) => setPeople((all) => ((all[s.id]?.t ?? 0) >= s.t ? all : { ...all, [s.id]: s })),
      (id) => setPeople((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== id))),
    ).then((f) => {
      if (cancelled) return f.leave();
      field = f;
      tick();
    });
    const timer = setInterval(tick, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      field?.leave();
      setPeople({});
    };
  }, [identity, active]);

  // the nearest few, so a crowded square stays readable
  const here = where();
  const list = Object.values(people);
  if (here) list.sort((a, b) => distance(here, a.at) - distance(here, b.at));
  return list.slice(0, MAX_SHOWN);
}
