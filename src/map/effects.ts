import type { Map as MapLibre } from 'maplibre-gl';
import type { LngLat } from '../lib/geo.ts';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Screen point of a place, kept inside the map so an owl from far away enters at the edge. */
function point(map: MapLibre, at: LngLat) {
  const { x, y } = map.project(at);
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  return [Math.min(w - 40, Math.max(40, x)), Math.min(h - 40, Math.max(40, y))];
}

function overlay(map: MapLibre, className: string, html: string) {
  const el = document.createElement('div');
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = html;
  map.getContainer().append(el);
  return el;
}

const OWL = `<svg viewBox="-30 -24 60 48">
  <path class="wing left" d="M-6 -2 C-18 -16 -28 -10 -29 -2 C-22 -6 -16 -2 -10 6Z"/>
  <path class="wing right" d="M6 -2 C18 -16 28 -10 29 -2 C22 -6 16 -2 10 6Z"/>
  <path class="body" d="M0 -16 L-5 -19 L-8 -9 C-12 0 -9 14 0 17 C9 14 12 0 8 -9 L5 -19Z"/>
  <circle class="eye" cx="-3.5" cy="-8" r="2.6"/><circle class="eye" cx="3.5" cy="-8" r="2.6"/>
  <path class="letter" d="M-5 10 h10 v6 h-10Z M-5 10 l5 3.5 l5 -3.5"/>
</svg>`;

/** An owl flies across the map from one place to another, carrying a letter. */
export function flyOwl(map: MapLibre, from: LngLat, to: LngLat): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  const [x1, y1] = point(map, from);
  const [x2, y2] = point(map, to);
  const el = overlay(map, 'owl', OWL);
  if (x2 < x1) el.classList.add('westward');
  const mid = `translate(${(x1 + x2) / 2}px, ${Math.min(y1, y2) - 70}px) scale(1.15)`;
  const anim = el.animate(
    [
      { transform: `translate(${x1}px, ${y1}px) scale(0.6)`, opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { transform: mid, offset: 0.5 },
      { opacity: 1, offset: 0.88 },
      { transform: `translate(${x2}px, ${y2}px) scale(0.7)`, opacity: 0 },
    ],
    { duration: 2600, easing: 'ease-in-out' },
  );
  return anim.finished.then(() => el.remove(), () => el.remove());
}

/** An inky whirlpool that swallows you at one place (out) or sets you down at another (in). */
export function portal(map: MapLibre, at: LngLat, way: 'out' | 'in'): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  const { x, y } = map.project(at);
  const el = overlay(map, 'portal', '');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const frames = [
    { transform: 'translate(-50%, -50%) scale(0.1) rotate(0deg)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scale(1) rotate(240deg)', opacity: 1, offset: 0.5 },
    { transform: 'translate(-50%, -50%) scale(0.1) rotate(540deg)', opacity: 0 },
  ];
  const anim = el.animate(way === 'out' ? frames : [...frames].reverse(), { duration: 700, easing: 'ease-in-out' });
  return anim.finished.then(() => el.remove(), () => el.remove());
}
