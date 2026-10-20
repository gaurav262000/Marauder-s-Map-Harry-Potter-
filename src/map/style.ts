import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';

/** Ink and parchment palette for the map itself (UI colours live in parchment.css). */
const INK = '#2b170a';
const INK_SEPIA = '#5e3b1c';
const INK_FADED = 'rgba(94, 59, 28, 0.45)';
const PAPER = '#f1e2bb';
const HALO = 'rgba(241, 226, 187, 0.9)';

const REGULAR = ['IM Fell English Regular'];
const ITALIC = ['IM Fell English Italic'];
const CAPS = ['IM Fell English SC Regular'];

const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:latin'], ['get', 'name_int'], ['get', 'name']];

const MINOR_CLASSES = ['minor', 'service', 'track'];
const MAJOR_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];

/** Road width in px by zoom: corridors get wider as you lean in. */
type Stops = [number, number][];
const width = (stops: Stops): ExpressionSpecification => ['interpolate', ['exponential', 1.6], ['zoom'], ...stops.flat()];
/** Casing = floor width plus an ink edge that thickens from 0.8px to 2.4px. */
const casing = (stops: Stops) => width(stops.map(([z, w]) => [z, w + Math.min(2.4, Math.max(0.8, 0.8 + (z - 12) * 0.4))]));
const MINOR: Stops = [[12, 0.4], [14, 1.6], [16, 6], [18, 20], [20, 60]];
const MAJOR: Stops = [[8, 0.6], [12, 1.8], [14, 4], [16, 11], [18, 30], [20, 90]];

export function parchmentStyle(glyphs: string): StyleSpecification {
  return {
    version: 8,
    name: 'Enchanted parchment',
    glyphs,
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      prints: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      route: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      friends: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      // Paper shows through: the canvas is transparent, the parchment is CSS.
      { id: 'landcover', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland', 'scrub']]], paint: { 'fill-color': INK_SEPIA, 'fill-opacity': 0.05 } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-pattern': 'trees', 'fill-opacity': 0.55 } },
      { id: 'park-edge', type: 'line', source: 'omt', 'source-layer': 'park', minzoom: 12, paint: { 'line-color': INK_FADED, 'line-width': 1, 'line-dasharray': [3, 2] } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-pattern': 'hatch' } },
      { id: 'water-edge', type: 'line', source: 'omt', 'source-layer': 'water', paint: { 'line-color': INK_SEPIA, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 14, 1.6] } },
      { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': INK_SEPIA, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 16, 2.5] } },
      { id: 'boundary-country', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': INK_SEPIA, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.8, 10, 2.2], 'line-dasharray': [4, 2, 1, 2] } },
      { id: 'boundary-state', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['==', ['get', 'admin_level'], 4], minzoom: 4, paint: { 'line-color': INK_FADED, 'line-width': 0.8, 'line-dasharray': [2, 3] } },

      // Buildings are the rooms.
      { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': '#fff6dc', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.45] } },
      { id: 'building-ink', type: 'line', source: 'omt', 'source-layer': 'building', minzoom: 14, paint: { 'line-color': INK, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.3, 16, 1, 18, 1.8], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.9] } },

      // Streets are the corridors: an ink casing with a parchment floor.
      { id: 'path', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 14, filter: ['==', ['get', 'class'], 'path'], paint: { 'line-color': INK_SEPIA, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 18, 1.6], 'line-dasharray': [2, 2] } },
      { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'rail'], minzoom: 10, paint: { 'line-color': INK, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 2], 'line-dasharray': [4, 1.5] } },
      { id: 'minor-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12, filter: ['in', ['get', 'class'], ['literal', MINOR_CLASSES]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': INK, 'line-width': casing(MINOR) } },
      { id: 'major-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', MAJOR_CLASSES]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': INK, 'line-width': casing(MAJOR) } },
      { id: 'minor-floor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 13.5, filter: ['in', ['get', 'class'], ['literal', MINOR_CLASSES]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': PAPER, 'line-width': width(MINOR) } },
      { id: 'major-floor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11, filter: ['in', ['get', 'class'], ['literal', MAJOR_CLASSES]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': PAPER, 'line-width': width(MAJOR) } },

      // Where friends say they are heading.
      { id: 'friend-route', type: 'line', source: 'friends', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round' }, paint: { 'line-color': INK, 'line-width': 1.6, 'line-opacity': 0.6, 'line-dasharray': [2, 3] } },
      { id: 'friend-dest', type: 'circle', source: 'friends', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': PAPER, 'circle-stroke-color': INK, 'circle-stroke-width': 1.6 } },

      // The walked route and its footprints.
      { id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#7a1d15', 'line-width': 2.6, 'line-opacity': 0.75, 'line-dasharray': [1, 2] } },
      {
        id: 'prints',
        type: 'symbol',
        source: 'prints',
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-rotate': ['get', 'bearing'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 18, 0.95],
        },
        paint: { 'icon-opacity': ['get', 'opacity'] },
      },

      // Words, all in quill serif.
      { id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name', filter: ['==', ['geometry-type'], 'Point'], layout: { 'text-field': NAME, 'text-font': ITALIC, 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 12, 14, 17], 'text-letter-spacing': 0.2 }, paint: { 'text-color': INK_SEPIA, 'text-halo-color': HALO, 'text-halo-width': 1.2 } },
      { id: 'waterway-name', type: 'symbol', source: 'omt', 'source-layer': 'waterway', minzoom: 12, layout: { 'text-field': NAME, 'text-font': ITALIC, 'text-size': 14, 'symbol-placement': 'line', 'text-letter-spacing': 0.15 }, paint: { 'text-color': INK_SEPIA, 'text-halo-color': HALO, 'text-halo-width': 1.2 } },
      { id: 'street-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14, layout: { 'text-field': NAME, 'text-font': ITALIC, 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 11, 17, 15, 19, 18], 'symbol-placement': 'line', 'text-max-angle': 30, 'symbol-spacing': 320, 'text-letter-spacing': 0.04 }, paint: { 'text-color': INK, 'text-halo-color': HALO, 'text-halo-width': 1.6 } },
      { id: 'poi', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 16, filter: ['all', ['has', 'name'], ['<=', ['get', 'rank'], 14]], layout: { 'text-field': NAME, 'text-font': REGULAR, 'text-size': 12, 'text-max-width': 8 }, paint: { 'text-color': INK_SEPIA, 'text-halo-color': HALO, 'text-halo-width': 1.2 } },
      { id: 'place-local', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 12, filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood']]], layout: { 'text-field': ['upcase', NAME], 'text-font': CAPS, 'text-size': ['interpolate', ['linear'], ['zoom'], 12, 12, 16, 18], 'text-letter-spacing': 0.3, 'text-max-width': 9 }, paint: { 'text-color': INK_SEPIA, 'text-halo-color': HALO, 'text-halo-width': 1.4 } },
      { id: 'place-town', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['town', 'village']]], minzoom: 8, layout: { 'text-field': NAME, 'text-font': CAPS, 'text-size': ['interpolate', ['linear'], ['zoom'], 8, 12, 14, 20], 'text-letter-spacing': 0.08, 'text-max-width': 8 }, paint: { 'text-color': INK, 'text-halo-color': HALO, 'text-halo-width': 1.5 } },
      { id: 'place-city', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['==', ['get', 'class'], 'city'], maxzoom: 15, layout: { 'text-field': NAME, 'text-font': CAPS, 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 13, 10, 26], 'text-letter-spacing': 0.08, 'text-max-width': 8 }, paint: { 'text-color': INK, 'text-halo-color': HALO, 'text-halo-width': 1.8 } },
      { id: 'place-country', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['==', ['get', 'class'], 'country'], maxzoom: 8, layout: { 'text-field': ['upcase', NAME], 'text-font': CAPS, 'text-size': ['interpolate', ['linear'], ['zoom'], 2, 13, 6, 22], 'text-letter-spacing': 0.35, 'text-max-width': 7 }, paint: { 'text-color': INK_SEPIA, 'text-halo-color': HALO, 'text-halo-width': 1.6 } },
    ],
  };
}

/** Layers hidden by the "labels" toggle. */
export const LABEL_LAYERS = ['water-name', 'waterway-name', 'street-name', 'poi', 'place-local', 'place-town', 'place-city', 'place-country'];
