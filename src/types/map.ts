export type Point = [number, number];

export type Category =
  | 'great hall'
  | 'tower'
  | 'chamber'
  | 'library'
  | 'corridor'
  | 'courtyard'
  | 'garden'
  | 'stairwell'
  | 'service'
  | 'gate'
  | 'hidden chamber'
  | 'secret passage';

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'path'; points: Point[] };

/** Interior drawing used by the illustrator — keeps art and data in sync. */
export type Decor =
  | 'hall'
  | 'shelves'
  | 'clock'
  | 'desks'
  | 'cauldrons'
  | 'tables'
  | 'hearth'
  | 'crates'
  | 'stairs'
  | 'garden'
  | 'courtyard'
  | 'gate'
  | 'tower'
  | 'stars'
  | 'scrolls'
  | 'tomb'
  | 'none';

export interface MapLocation {
  id: string;
  name: string;
  description: string;
  category: Category;
  shape: Shape;
  /** Anchor used for markers, labels, camera focus and route endpoints. */
  center: Point;
  decor: Decor;
  secret?: boolean;
  /** Short handwritten note drawn on the map near the location. */
  annotation?: string;
  /** Corridors and passages are walked through, not stopped at. */
  passThrough?: boolean;
  label?: { at?: Point; rotate?: number; size?: number };
}

export interface MapEdge {
  a: string;
  b: string;
  /** Waypoints from a to b so routes follow corridors instead of cutting walls. */
  via: Point[];
  secret?: boolean;
}

export interface AmbientWalker {
  id: string;
  name: string;
  /** Location ids visited in order; the route loops back to the first. */
  stops: string[];
  /** Map units per second. */
  speed: number;
}

export type MapMode = 'explore' | 'secrets' | 'tracking' | 'clean';

export interface Layers {
  labels: boolean;
  footprints: boolean;
  secrets: boolean;
  markers: boolean;
}

export interface Route {
  ids: string[];
  points: Point[];
}
