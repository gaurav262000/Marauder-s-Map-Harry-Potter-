import type { AmbientWalker } from '../types/map.ts';

/** Fictional residents of Ravenmoor Keep who wander the map on loops. */
export const AMBIENT_WALKERS: AmbientWalker[] = [
  {
    id: 'caretaker',
    name: 'Old Brannoch',
    stops: ['gatehouse', 'grand-hall', 'kitchens', 'undercroft-stores', 'apothecary', 'moonlit-courtyard'],
    speed: 34,
  },
  {
    id: 'librarian',
    name: 'Mistress Varrow',
    stops: ['old-library', 'scriptorium', 'north-tower', 'clock-chamber', 'alchemy-room'],
    speed: 28,
  },
  {
    id: 'kitchen-boy',
    name: 'Pip Hollowell',
    stops: ['refectory', 'eastern-stairwell', 'herb-gardens', 'raven-tower', 'kitchens'],
    speed: 46,
  },
];
