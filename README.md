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
- **Friends & groups** — start a group and send the invite link. Opening the link only lets someone *ask* to join; the group owner approves or declines each request (checking a 6-digit safety number shown on both phones). Approved members see each other live: name tag, footprints, distance, and where each person is heading. The owner can remove anyone, which re-keys the group.
- **Seek any place** — search for any town, street or landmark (press Enter).
- **The oath** — the map opens only once you write your name, and folds away again from the top bar.
- Optional ambient sound (off by default), place-name toggle, compass that turns back to north, reduced-motion support.

## Data & services

No API keys are needed. Map tiles from [OpenFreeMap](https://openfreemap.org) (OpenMapTiles schema), search from [Nominatim](https://nominatim.org), walking routes from the [FOSSGIS OSRM](https://routing.openstreetmap.de) foot router. Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Please respect their usage policies (search runs only on Enter, never as you type).

### Group security

- Every device makes its own ECDH (P-256) key pair; the private key never leaves the device (stored in the browser).
- The owner creates a random AES-256-GCM group key. It is only ever sent sealed to an approved member's public key, so the relay and anyone holding the invite link cannot read it.
- The invite link carries the owner's key fingerprint; a device accepts a group key (or a "declined" notice) only if it is sealed by that exact key.
- Join requests show a safety number derived from the requester's public key on both phones, so the owner can confirm a request really comes from the right person before approving.
- Removing a member rotates the group key and re-sends it to everyone else; the removed device can no longer read new positions.
- Positions travel through free public MQTT relays (HiveMQ and EMQX, override with `VITE_MQTT_BROKERS`). Topics are derived from hashes, and payloads are encrypted, so the relay sees neither names nor places.

Limits: there are no accounts, so identity is per browser (clearing site data means asking to join again), and approved members are trusted not to forge each other's positions.

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
