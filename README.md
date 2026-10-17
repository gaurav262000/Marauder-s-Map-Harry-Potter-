# The Enchanted Atlas

An interactive, living parchment map of **Ravenmoor Keep** — an original fictional castle — inspired by the feel of a magical hand-drawn map. Every wall, room, label, footprint and flourish is original SVG drawn in code; no scanned or copyrighted artwork is used.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run typecheck
npm run lint
npm test           # graph / routing checks (node:test, Node 22+)
```

`dist/` is static and uses relative asset paths, so it can be hosted from any folder (GitHub Pages, Netlify, S3…).

## Features

- **Pan & zoom** — drag, mouse wheel (zooms around the cursor), pinch on touch, arrow / `+` / `−` keys, and on-screen buttons. Zoom is limited to a sensible range and the map cannot be lost off-screen.
- **Rooms** — click, tap, or Tab + Enter a room to open its parchment note: category, description, annotation and connected places.
- **Search** — type-ahead, case-insensitive, keyboard navigable. Choosing a result flies the camera to it. Concealed chambers can be found too; selecting one reveals the secrets.
- **Navigation** — “Navigate here” runs a breadth-first search over the room graph from your current position (“you are here”), draws the route as inked line along real corridors, and walks footprints along it. On arrival your position moves to the destination. Unreachable destinations get an explanation instead.
- **Footprints** — three residents (Old Brannoch, Mistress Varrow, Pip Hollowell) wander looping routes; prints are planted on a stride grid and fade behind each walker.
- **Secret passages** — the Whispering Passage, the Clockwork Stair and the Sunken Way, leading to three hidden chambers. Concealed, they leave only faint clues; revealed, they ink themselves onto the parchment and become routable.
- **Modes** — Explore, Secrets, Tracking (footprints and names prominent) and Clean (architecture only). Layer toggles for labels, footprints, secrets and markers.
- **Optional sound** — synthesized room tone and a paper rustle (Web Audio, no files). Off by default.
- **Responsive** — desktop side panel; on phones a bottom sheet, thumb-reachable controls and a compact mode picker.
- **Accessibility** — labelled controls, visible focus, `aria-pressed` toggles with a struck-through “off” icon (not colour alone), a keyboard-operable map, a full directory list as a non-SVG fallback, and `prefers-reduced-motion` support (static footprints, no ink-drawing animation).

## Structure

```
src/
  data/        locations.ts (rooms, shapes, graph edges) · mapGeometry.ts (decorative walls, ornament) · ambientRoutes.ts
  lib/         graph.ts (BFS + route geometry) · polyline.ts · ink.ts (seeded hand-drawn strokes) · graph.test.ts
  hooks/       useMapViewport (pan/zoom/pinch) · useMapNavigation · useFootprintAnimation · useAmbientAudio
  components/  MapCanvas · MapArt · Decor · SecretPassageLayer · FootprintLayer · MapControls · MapSearch
               LocationDetails · MapLegend · ModeSwitcher · HelpDialog
  styles/      parchment.css (tokens, shell) · map.css (ink, layers, modes, animation)
```

### Adding a room

1. Add an entry to `LOCATIONS` in `src/data/locations.ts` with a `shape`, `center` and `decor`. The art, hit area, marker, label, search and directory all derive from it.
2. Connect it with an `EDGES` entry. `via` waypoints keep routes on corridor axes (room doors are aligned with the room centre).
3. `npm test` checks every edge points at real rooms, every public room is reachable, and routes never cut diagonally through walls.

### Performance notes

The map art is memoised and rendered once. Pan/zoom write the transform straight to one `<g>`; React only re-renders the zoom readout, once per frame. Footprints are a fixed pool of `<use>` elements driven by a single `requestAnimationFrame` loop (paused by the browser in background tabs, with clamped time steps).
