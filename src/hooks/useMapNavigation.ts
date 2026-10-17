import { useCallback, useEffect, useState } from 'react';
import { LOCATION_BY_ID, START_LOCATION } from '../data/locations.ts';
import { computeRoute } from '../lib/graph.ts';
import type { Route } from '../types/map.ts';

/** Origin, active route and arrival state for destination navigation. */
export function useMapNavigation(secretsRevealed: boolean) {
  const [origin, setOrigin] = useState(START_LOCATION);
  const [route, setRoute] = useState<Route | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [arrived, setArrived] = useState(false);

  const navigate = useCallback(
    (to: string): Route | null => {
      setArrived(false);
      const r = computeRoute(origin, to, secretsRevealed);
      if (!r) {
        setRoute(null);
        const hint = LOCATION_BY_ID[to].secret || LOCATION_BY_ID[origin].secret ? ' Perhaps the secret passages must first be revealed.' : '';
        setMessage(`${LOCATION_BY_ID[to].name} cannot be reached from ${LOCATION_BY_ID[origin].name}.${hint}`);
        return null;
      }
      setRoute(r);
      setMessage(null);
      return r;
    },
    [origin, secretsRevealed],
  );

  const clear = useCallback(() => {
    setRoute(null);
    setMessage(null);
    setArrived(false);
  }, []);

  const onArrive = useCallback(() => setArrived(true), []);

  // Once the footprints arrive, the traveller is at the destination.
  useEffect(() => {
    if (arrived && route) setOrigin(route.ids[route.ids.length - 1]);
  }, [arrived, route]);

  // Concealing secrets drops any route that relied on them.
  useEffect(() => {
    if (secretsRevealed) return;
    if (route?.ids.some((id) => LOCATION_BY_ID[id].secret)) clear();
    if (LOCATION_BY_ID[origin].secret) setOrigin(START_LOCATION);
  }, [secretsRevealed, route, origin, clear]);

  return { origin, setOrigin, route, message, arrived, navigate, clear, onArrive };
}
