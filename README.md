# The Enchanted Atlas

A living, hand-inked parchment map of the **real world**, in the spirit of the magical maps of wizarding fiction. Every street on Earth is drawn as an ink corridor, buildings as rooms, water in engraver's hatching, and names in an antique quill serif. Write your name on the parchment and your footprints walk real footpaths wherever you send them, while the map's residents wander the streets around you.

All artwork and wording are original; no film or book assets are used.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run typecheck
npm run lint
npm test           # geometry checks (node:test, Node 22+)
```

## Put it online (GitHub Pages)

`.github/workflows/pages.yml` builds the site on every push to `main` (and to the development branch) and publishes it to the `gh-pages` branch. If the site does not appear at `https://<user>.github.io/<repo>/`, set **Settings → Pages → Source: Deploy from a branch → `gh-pages` / root**.

## What it does

- **The whole world** — pan, zoom, pinch and rotate anywhere; street-level detail everywhere OpenStreetMap has it.
- **Your footprints** — tap a spot, then **Walk here**: a walking route is fetched and your prints, labelled with your name, walk it. **Appear here** moves you instantly; the target button jumps to your real location.
- **Wanderers** — at street level, four residents of the parchment stroll along whichever streets are on screen, turning at junctions.
- **Friends & groups** — start a group, send the invite link (`#g=<code>`), and everyone who joins sees each other live: name tag, footprints, distance, and where each person is heading. Sharing uses the phone's GPS when allowed, and can be stopped at any time.
- **Seek any place** — search for any town, street or landmark (press Enter).
- **The oath** — the map opens only once you write your name, and folds away again from the top bar.
- Optional ambient sound (off by default), place-name toggle, compass that turns back to north, reduced-motion support.

## Data & services

No API keys are needed. Map tiles from [OpenFreeMap](https://openfreemap.org) (OpenMapTiles schema), search from [Nominatim](https://nominatim.org), walking routes from the [FOSSGIS OSRM](https://routing.openstreetmap.de) foot router. Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Please respect their usage policies (search runs only on Enter, never as you type).

Group presence travels through free public MQTT relays (HiveMQ and EMQX, override with `VITE_MQTT_BROKERS`). Each message is encrypted on the device with AES-GCM using a key derived from the group code, and the relay topic is derived from the code too, so the relay sees neither names nor places. There are no accounts: anyone with the group code can join, so share it only with people you trust.

Label glyphs for the IM Fell typefaces are pre-generated into `public/glyphs/` by `scripts/build-glyphs.mjs`.

## Structure

```
src/
  map/style.ts        parchment MapLibre style (ink corridors, hatched water, serif labels)
  map/images.ts       footprint, hatching and tree images drawn on canvas
  map/footprints.ts   walker engine: your walk, wandering residents, planted prints
  lib/geo.ts          distances, bearings, walking along a track (+ geo.test.ts)
  lib/services.ts     Nominatim search / reverse lookup, OSRM walking routes
  lib/group.ts        group relay (MQTT) and member validation
  lib/groupCrypto.ts  group code, key/topic derivation, AES-GCM (+ groupCrypto.test.ts)
  components/         Intro, SearchBox, PlaceNote, GroupPanel, HelpDialog
  hooks/              useAmbientAudio
  styles/parchment.css
```
