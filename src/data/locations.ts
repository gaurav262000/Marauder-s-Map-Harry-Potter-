import type { MapEdge, MapLocation, Point } from '../types/map.ts';

/**
 * Ravenmoor Keep — an original fictional castle.
 * Virtual canvas is MAP_W × MAP_H map units. Corridors run on fixed axes:
 *   Long Gallery   y = 620   (north spine)
 *   Cloister Walk  y = 1080  (south spine)
 *   Western Passage x = 420
 *   North Corridor  x = 1200
 * Every room door is aligned with its centre so route waypoints stay on those axes.
 */
export const MAP_W = 2400;
export const MAP_H = 1800;

const WHISPERING: Point[] = [[520, 990], [450, 1012], [372, 985], [322, 925]];
const CLOCKWORK: Point[] = [[1580, 450], [1690, 372], [1820, 302], [1935, 258]];
const SUNKEN: Point[] = [[1110, 1380], [990, 1470], [870, 1536], [785, 1562]];

export const SECRET_PATHS = { WHISPERING, CLOCKWORK, SUNKEN };

export const LOCATIONS: MapLocation[] = [
  {
    id: 'grand-hall',
    name: 'The Grand Hall',
    category: 'great hall',
    description:
      'The heart of Ravenmoor Keep. Four long tables run beneath a vaulted ceiling that is said to show tomorrow’s weather an hour early.',
    shape: { kind: 'rect', x: 960, y: 642, w: 480, h: 416 },
    center: [1200, 850],
    decor: 'hall',
    annotation: 'Feasts at the eighth bell',
    label: { at: [1200, 700], size: 30 },
  },
  {
    id: 'north-tower',
    name: 'North Tower',
    category: 'tower',
    description:
      'The tallest of the four towers. Its spiral stair has one hundred and nineteen steps going up and, inexplicably, one hundred and twenty coming down.',
    shape: { kind: 'circle', cx: 1200, cy: 250, r: 115 },
    center: [1200, 250],
    decor: 'tower',
    annotation: 'Count the steps twice',
    label: { size: 24 },
  },
  {
    id: 'raven-tower',
    name: 'Raven Tower',
    category: 'tower',
    description:
      'A squat western tower where the castle ravens roost. Messages left on the sill are delivered by morning, though rarely to whom you intended.',
    shape: { kind: 'circle', cx: 420, cy: 320, r: 100 },
    center: [420, 320],
    decor: 'tower',
    label: { size: 22 },
  },
  {
    id: 'alchemy-room',
    name: 'The Alchemy Room',
    category: 'chamber',
    description:
      'Scorched benches, three cauldrons and a ceiling stained a permanent shade of violet. Lessons in transmutation are held here on wet afternoons.',
    shape: { kind: 'rect', x: 520, y: 430, w: 240, h: 168 },
    center: [640, 514],
    decor: 'cauldrons',
    annotation: 'Mind the violet fumes',
    label: { at: [640, 470], size: 18 },
  },
  {
    id: 'scriptorium',
    name: 'The Scriptorium',
    category: 'chamber',
    description:
      'Rows of slanted desks where apprentices copy maps by candlelight. Unfinished maps here sometimes finish themselves overnight.',
    shape: { kind: 'rect', x: 900, y: 430, w: 240, h: 168 },
    center: [1020, 514],
    decor: 'desks',
    label: { at: [1020, 470], size: 18 },
  },
  {
    id: 'north-corridor',
    name: 'The North Corridor',
    category: 'corridor',
    description:
      'A narrow, draughty corridor joining the Long Gallery to the North Tower stair. Portraits line both walls and pretend to be asleep.',
    shape: { kind: 'rect', x: 1178, y: 365, w: 44, h: 233 },
    center: [1200, 480],
    decor: 'none',
    passThrough: true,
    label: { rotate: -90, size: 13 },
  },
  {
    id: 'clock-chamber',
    name: 'The Clock Chamber',
    category: 'chamber',
    description:
      'The great clockwork that keeps the castle’s bells. Its thirteenth chime is heard only by those who are late.',
    shape: { kind: 'rect', x: 1400, y: 400, w: 220, h: 198 },
    center: [1510, 499],
    decor: 'clock',
    annotation: 'Thirteen chimes?',
    label: { at: [1510, 430], size: 18 },
  },
  {
    id: 'refectory',
    name: 'The Refectory',
    category: 'chamber',
    description:
      'The everyday dining hall, warmer and noisier than the Grand Hall. Breakfast is served from dawn until the porridge gives up.',
    shape: { kind: 'rect', x: 1680, y: 430, w: 220, h: 168 },
    center: [1790, 514],
    decor: 'tables',
    label: { at: [1790, 462], size: 18 },
  },
  {
    id: 'long-gallery',
    name: 'The Long Gallery',
    category: 'corridor',
    description:
      'The castle’s northern spine, running from the Western Passage to the Eastern Stairwell. Most journeys in Ravenmoor begin here.',
    shape: { kind: 'rect', x: 398, y: 598, w: 1542, h: 44 },
    center: [860, 620],
    decor: 'none',
    passThrough: true,
    label: { at: [1340, 620], size: 14 },
  },
  {
    id: 'old-library',
    name: 'The Old Library',
    category: 'library',
    description:
      'Forty shelves of crumbling volumes and one shelf that sighs when touched. The librarian insists the sighing is “the damp”.',
    shape: { kind: 'rect', x: 480, y: 642, w: 400, h: 416 },
    center: [680, 850],
    decor: 'shelves',
    annotation: 'The third shelf sighs',
    label: { at: [680, 700], size: 24 },
  },
  {
    id: 'kitchens',
    name: 'The Kitchens',
    category: 'service',
    description:
      'Two roaring hearths and a larder that refills itself at midnight. Tickling the brass kettle is said to produce biscuits.',
    shape: { kind: 'rect', x: 1540, y: 642, w: 340, h: 200 },
    center: [1710, 742],
    decor: 'hearth',
    label: { at: [1710, 690], size: 18 },
  },
  {
    id: 'undercroft-stores',
    name: 'The Undercroft Stores',
    category: 'service',
    description:
      'Barrels, crates and sacks of flour beneath low arches. A service stair climbs straight up to the Kitchens.',
    shape: { kind: 'rect', x: 1540, y: 880, w: 340, h: 178 },
    center: [1710, 969],
    decor: 'crates',
    label: { at: [1710, 920], size: 17 },
  },
  {
    id: 'eastern-stairwell',
    name: 'The Eastern Stairwell',
    category: 'stairwell',
    description:
      'A long switchback stair joining both great corridors. On Thursdays it prefers to lead somewhere else entirely.',
    shape: { kind: 'rect', x: 1940, y: 560, w: 100, h: 560 },
    center: [1990, 840],
    decor: 'stairs',
    annotation: 'Not on Thursdays',
    label: { rotate: 90, size: 15 },
  },
  {
    id: 'western-passage',
    name: 'The Western Passage',
    category: 'corridor',
    description:
      'A stone passage along the western wall, linking Raven Tower to both great corridors. The draught smells faintly of old paper.',
    shape: { kind: 'rect', x: 398, y: 415, w: 44, h: 687 },
    center: [420, 850],
    decor: 'none',
    passThrough: true,
    label: { rotate: -90, size: 13 },
  },
  {
    id: 'cloister-walk',
    name: 'The Cloister Walk',
    category: 'corridor',
    description:
      'An arcaded walk along the castle’s southern side, open to the courtyards and gardens below.',
    shape: { kind: 'rect', x: 398, y: 1058, w: 1542, h: 44 },
    center: [900, 1080],
    decor: 'none',
    passThrough: true,
    label: { at: [1420, 1080], size: 14 },
  },
  {
    id: 'herb-gardens',
    name: 'The Herb Gardens',
    category: 'garden',
    description:
      'Walled beds of sage, wormwood and moonwort. The sundial in the middle tells the right time only when nobody is looking at it.',
    shape: { kind: 'rect', x: 460, y: 1140, w: 400, h: 320 },
    center: [660, 1300],
    decor: 'garden',
    label: { at: [660, 1180], size: 20 },
  },
  {
    id: 'moonlit-courtyard',
    name: 'The Moonlit Courtyard',
    category: 'courtyard',
    description:
      'An open courtyard around an ancient well. Even at noon its flagstones look silvered, as if by moonlight.',
    shape: { kind: 'rect', x: 980, y: 1140, w: 440, h: 300 },
    center: [1200, 1290],
    decor: 'courtyard',
    annotation: 'The well is deeper than it looks',
    label: { at: [1200, 1180], size: 22 },
  },
  {
    id: 'apothecary',
    name: 'The Apothecary',
    category: 'chamber',
    description:
      'Jars of dried things, some of which were never alive. The castle healer keeps a remedy for everything except curiosity.',
    shape: { kind: 'rect', x: 1520, y: 1140, w: 240, h: 180 },
    center: [1640, 1230],
    decor: 'scrolls',
    label: { at: [1640, 1176], size: 18 },
  },
  {
    id: 'gatehouse',
    name: 'The Gatehouse',
    category: 'gate',
    description:
      'The only honest way in or out of Ravenmoor Keep, guarded by a portcullis and a very opinionated gargoyle.',
    shape: { kind: 'rect', x: 1130, y: 1480, w: 140, h: 120 },
    center: [1200, 1540],
    decor: 'gate',
    label: { at: [1200, 1630], size: 16 },
  },
  // ——— Hidden chambers ———
  {
    id: 'forgotten-archive',
    name: 'The Forgotten Archive',
    category: 'hidden chamber',
    description:
      'A sealed vault of records the castle would rather forget: expulsions, curfew breaches and a ledger of every secret passage ever sworn about.',
    shape: { kind: 'rect', x: 220, y: 700, w: 140, h: 220 },
    center: [290, 810],
    decor: 'scrolls',
    secret: true,
    annotation: 'Speak softly',
    label: { rotate: -90, size: 12 },
  },
  {
    id: 'hidden-observatory',
    name: 'The Hidden Observatory',
    category: 'hidden chamber',
    description:
      'A domed room that does not appear from outside the castle. Its brass telescope shows the sky as it was on the night the keep was founded.',
    shape: { kind: 'circle', cx: 2010, cy: 230, r: 85 },
    center: [2010, 230],
    decor: 'stars',
    secret: true,
    label: { size: 17 },
  },
  {
    id: 'sealed-crypt',
    name: 'The Sealed Crypt',
    category: 'hidden chamber',
    description:
      'Beneath the gardens lies the tomb of the keep’s first cartographer, buried with the only complete map of Ravenmoor.',
    shape: { kind: 'rect', x: 560, y: 1510, w: 220, h: 110 },
    center: [670, 1565],
    decor: 'tomb',
    secret: true,
    label: { at: [670, 1532], size: 16 },
  },
  // ——— Secret passages ———
  {
    id: 'whispering-passage',
    name: 'The Whispering Passage',
    category: 'secret passage',
    description:
      'Behind the sighing shelf of the Old Library, a crawlway winds west beneath the Western Passage. The walls murmur the names of whoever walked here last.',
    shape: { kind: 'path', points: WHISPERING },
    center: WHISPERING[1],
    decor: 'none',
    secret: true,
    passThrough: true,
  },
  {
    id: 'clockwork-stair',
    name: 'The Clockwork Stair',
    category: 'secret passage',
    description:
      'Stop the pendulum of the great clock at a quarter to thirteen and a stair of brass gears unfolds towards the Hidden Observatory.',
    shape: { kind: 'path', points: CLOCKWORK },
    center: CLOCKWORK[2],
    decor: 'none',
    secret: true,
    passThrough: true,
  },
  {
    id: 'sunken-way',
    name: 'The Sunken Way',
    category: 'secret passage',
    description:
      'Rungs inside the courtyard well descend to a damp tunnel that runs beneath the Herb Gardens to the Sealed Crypt.',
    shape: { kind: 'path', points: SUNKEN },
    center: SUNKEN[2],
    decor: 'none',
    secret: true,
    passThrough: true,
  },
];

export const EDGES: MapEdge[] = [
  { a: 'raven-tower', b: 'western-passage', via: [[420, 415]] },
  { a: 'western-passage', b: 'long-gallery', via: [[420, 620]] },
  { a: 'western-passage', b: 'cloister-walk', via: [[420, 1080]] },
  { a: 'alchemy-room', b: 'long-gallery', via: [[640, 620]] },
  { a: 'scriptorium', b: 'long-gallery', via: [[1020, 620]] },
  { a: 'north-corridor', b: 'long-gallery', via: [[1200, 620]] },
  { a: 'north-tower', b: 'north-corridor', via: [[1200, 365]] },
  { a: 'clock-chamber', b: 'long-gallery', via: [[1510, 620]] },
  { a: 'refectory', b: 'long-gallery', via: [[1790, 620]] },
  { a: 'old-library', b: 'long-gallery', via: [[680, 620]] },
  { a: 'old-library', b: 'cloister-walk', via: [[680, 1080]] },
  { a: 'grand-hall', b: 'long-gallery', via: [[1200, 620]] },
  { a: 'grand-hall', b: 'cloister-walk', via: [[1200, 1080]] },
  { a: 'kitchens', b: 'long-gallery', via: [[1710, 620]] },
  { a: 'kitchens', b: 'undercroft-stores', via: [] },
  { a: 'undercroft-stores', b: 'cloister-walk', via: [[1710, 1080]] },
  { a: 'eastern-stairwell', b: 'long-gallery', via: [[1990, 620]] },
  { a: 'eastern-stairwell', b: 'cloister-walk', via: [[1990, 1080]] },
  { a: 'herb-gardens', b: 'cloister-walk', via: [[660, 1080]] },
  { a: 'moonlit-courtyard', b: 'cloister-walk', via: [[1200, 1080]] },
  { a: 'apothecary', b: 'cloister-walk', via: [[1640, 1080]] },
  { a: 'gatehouse', b: 'moonlit-courtyard', via: [] },
  // Secret routes
  { a: 'old-library', b: 'whispering-passage', via: WHISPERING, secret: true },
  { a: 'whispering-passage', b: 'forgotten-archive', via: [], secret: true },
  { a: 'clock-chamber', b: 'clockwork-stair', via: CLOCKWORK, secret: true },
  { a: 'clockwork-stair', b: 'hidden-observatory', via: [], secret: true },
  { a: 'moonlit-courtyard', b: 'sunken-way', via: SUNKEN, secret: true },
  { a: 'sunken-way', b: 'sealed-crypt', via: [], secret: true },
];

export const LOCATION_BY_ID: Record<string, MapLocation> = Object.fromEntries(
  LOCATIONS.map((l) => [l.id, l]),
);

export const START_LOCATION = 'grand-hall';
