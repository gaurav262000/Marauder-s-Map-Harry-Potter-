import type { Point } from '../types/map.ts';

/** Purely decorative architecture and ornament — never interactive. */

/** Curtain wall of the inner keep. */
export const KEEP_WALL: Point[] = [
  [372, 382],
  [1085, 382],
  [1315, 382],
  [2072, 382],
  [2072, 1124],
  [372, 1124],
];

/** Outer bailey wall enclosing the gardens and courtyard; gap at the gatehouse. */
export const BAILEY_WALL_LEFT: Point[] = [[440, 1124], [440, 1480], [1130, 1480]];
export const BAILEY_WALL_RIGHT: Point[] = [[1270, 1480], [1800, 1480], [1800, 1124]];

export const TURRETS: { cx: number; cy: number; r: number }[] = [
  { cx: 2072, cy: 382, r: 44 },
  { cx: 2072, cy: 1124, r: 44 },
  { cx: 372, cy: 1124, r: 40 },
  { cx: 440, cy: 1480, r: 34 },
  { cx: 1800, cy: 1480, r: 34 },
];

/** Small unnamed cells that fill the gaps between named rooms. */
export const MINOR_ROOMS: [number, number, number, number][] = [
  [450, 450, 60, 148],
  [775, 450, 110, 70],
  [775, 528, 110, 70],
  [1240, 430, 70, 168],
  [1318, 430, 70, 168],
  [1630, 450, 40, 148],
  [892, 700, 56, 120],
  [892, 880, 56, 150],
  [1452, 680, 76, 150],
  [1452, 900, 76, 140],
  [1520, 1340, 110, 120],
  [1640, 1340, 120, 120],
  [880, 1150, 80, 140],
  [1440, 1150, 60, 140],
];

/** Faint clues near concealed entrances: [x, y, kind, note]. */
export const CLUES: { at: Point; kind: 'keyhole' | 'gear' | 'arrow'; note: string; rotate?: number }[] = [
  { at: [505, 975], kind: 'keyhole', note: 'behind the shelf?', rotate: -8 },
  { at: [1590, 452], kind: 'gear', note: 'a quarter to thirteen', rotate: -12 },
  { at: [1130, 1355], kind: 'arrow', note: 'rungs go down', rotate: 10 },
];

/** Lake to the south-west of the keep. */
export const LAKE: Point[] = [
  [120, 1520], [260, 1470], [380, 1510], [450, 1600], [400, 1700], [250, 1740], [130, 1690], [90, 1600],
];

/** The old road winding south from the gatehouse. */
export const ROAD: Point[] = [[1200, 1600], [1230, 1660], [1330, 1690], [1460, 1680], [1560, 1720], [1640, 1790]];

export const TREES: Point[] = [
  [2200, 520], [2260, 600], [2180, 680], [2290, 760], [2230, 860], [2150, 1260], [2250, 1220],
  [160, 420], [110, 520], [200, 1180], [120, 1300], [260, 1380],
  [1900, 1600], [1980, 1680], [2080, 1620], [880, 1680], [960, 1740],
];

export const STAINS: { cx: number; cy: number; r: number; o: number }[] = [
  { cx: 340, cy: 260, r: 120, o: 0.1 },
  { cx: 1880, cy: 1360, r: 160, o: 0.08 },
  { cx: 2210, cy: 260, r: 70, o: 0.12 },
  { cx: 900, cy: 1630, r: 90, o: 0.09 },
  { cx: 1500, cy: 880, r: 60, o: 0.06 },
  { cx: 140, cy: 980, r: 80, o: 0.1 },
  { cx: 2300, cy: 1700, r: 110, o: 0.12 },
  { cx: 1040, cy: 210, r: 50, o: 0.07 },
];

/** Fold creases across the sheet. */
export const FOLDS: [Point, Point][] = [
  [[800, 0], [806, 1800]],
  [[1600, 0], [1596, 1800]],
  [[0, 900], [2400, 906]],
];

export const MOTTO = 'CAVTE AMBVLA · QVOD VIDES NON TOTVM EST · CAVTE AMBVLA · QVOD VIDES NON TOTVM EST · ';
export const ROAD_TEXT = 'The old road to Brackenford · mind the toll-troll ·';
