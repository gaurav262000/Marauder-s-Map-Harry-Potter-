import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { MAP_H, MAP_W } from '../data/locations.ts';
import type { Point } from '../types/map.ts';

interface View {
  x: number;
  y: number;
  k: number;
}

const MAX_K = 3;
const DRAG_THRESHOLD = 5;
const FOCUS: Point = [1200, 850];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Pan / zoom / pinch for an SVG whose content lives in one transformed <g>.
 * The transform is written straight to the DOM; React only hears about
 * zoom changes, once per animation frame.
 */
export function useMapViewport(
  svgRef: RefObject<SVGSVGElement | null>,
  groupRef: RefObject<SVGGElement | null>,
  { reducedMotion, onHover }: { reducedMotion: boolean; onHover?: (p: Point | null) => void },
) {
  const view = useRef<View>({ x: 0, y: 0, k: 0.5 });
  const size = useRef({ w: 0, h: 0 });
  const minK = useRef(0.1);
  const homeK = useRef(0.5);
  const [zoom, setZoom] = useState(0.5);
  const zoomFrame = useRef(0);
  const tween = useRef(0);
  const dragged = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; dist: number; moved: number } | null>(null);
  const hoverRef = useRef(onHover);
  hoverRef.current = onHover;

  const apply = useCallback(() => {
    const v = view.current;
    const { w, h } = size.current;
    // Keep at least the map's edge within the centre of the screen.
    v.x = Math.min(w / 2, Math.max(w / 2 - MAP_W * v.k, v.x));
    v.y = Math.min(h / 2, Math.max(h / 2 - MAP_H * v.k, v.y));
    groupRef.current?.setAttribute('transform', `translate(${v.x.toFixed(2)} ${v.y.toFixed(2)}) scale(${v.k.toFixed(4)})`);
    if (!zoomFrame.current) {
      zoomFrame.current = requestAnimationFrame(() => {
        zoomFrame.current = 0;
        setZoom(view.current.k);
      });
    }
  }, [groupRef]);

  const stopTween = () => cancelAnimationFrame(tween.current);

  const zoomAt = useCallback(
    (factor: number, sx: number, sy: number) => {
      const v = view.current;
      const k = Math.min(MAX_K, Math.max(minK.current, v.k * factor));
      v.x = sx - ((sx - v.x) * k) / v.k;
      v.y = sy - ((sy - v.y) * k) / v.k;
      v.k = k;
      apply();
    },
    [apply],
  );

  const animateTo = useCallback(
    (target: View) => {
      stopTween();
      const from = { ...view.current };
      if (reducedMotion) {
        view.current = target;
        apply();
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 650);
        const e = ease(t);
        view.current = {
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          k: from.k + (target.k - from.k) * e,
        };
        apply();
        if (t < 1) tween.current = requestAnimationFrame(step);
      };
      tween.current = requestAnimationFrame(step);
    },
    [apply, reducedMotion],
  );

  const viewFor = useCallback((p: Point, k: number): View => {
    const { w, h } = size.current;
    k = Math.min(MAX_K, Math.max(minK.current, k));
    return { k, x: w / 2 - p[0] * k, y: h / 2 - p[1] * k };
  }, []);

  const flyTo = useCallback((p: Point, k?: number) => animateTo(viewFor(p, k ?? Math.max(view.current.k, homeK.current * 1.6))), [animateTo, viewFor]);

  const fitPoints = useCallback(
    (pts: Point[]) => {
      if (!pts.length) return;
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const { w, h } = size.current;
      const k = Math.min(w / (x1 - x0 + 260), h / (y1 - y0 + 260), 1.4);
      animateTo(viewFor([(x0 + x1) / 2, (y0 + y1) / 2], k));
    },
    [animateTo, viewFor],
  );

  const reset = useCallback(() => animateTo(viewFor(FOCUS, homeK.current)), [animateTo, viewFor]);

  const zoomBy = useCallback(
    (factor: number) => {
      stopTween();
      const { w, h } = size.current;
      const v = view.current;
      animateTo(viewFor([(w / 2 - v.x) / v.k, (h / 2 - v.y) / v.k], v.k * factor));
    },
    [animateTo, viewFor],
  );

  // Size tracking + initial framing.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let first = true;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const old = size.current;
      size.current = { w: width, h: height };
      const contain = Math.min(width / MAP_W, height / MAP_H);
      minK.current = contain * 0.8;
      // portrait screens: fill the height rather than fitting the width
      homeK.current = Math.min(1, Math.max(0.3, contain * 1.15, (height / MAP_H) * 0.95));
      if (first) {
        first = false;
        view.current = viewFor(FOCUS, homeK.current);
      } else {
        // keep the same map point in the middle on resize / rotation
        view.current.x += (width - old.w) / 2;
        view.current.y += (height - old.h) / 2;
      }
      apply();
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, [svgRef, apply, viewFor]);

  // Pointer, pinch, wheel and keyboard input.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = svg.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pinchInfo = () => {
      const [a, b] = [...pointers.current.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      stopTween();
      pointers.current.set(e.pointerId, local(e));
      if (pointers.current.size === 1) {
        dragged.current = false;
        gesture.current = { ...local(e), dist: 0, moved: 0 };
      } else if (pointers.current.size === 2) {
        gesture.current = { ...pinchInfo(), moved: DRAG_THRESHOLD + 1 };
        dragged.current = true;
      }
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      const v = view.current;
      hoverRef.current?.([(p.x - v.x) / v.k, (p.y - v.y) / v.k]);
      if (!pointers.current.has(e.pointerId) || !gesture.current) return;
      pointers.current.set(e.pointerId, p);
      const g = gesture.current;
      if (pointers.current.size >= 2) {
        const now = pinchInfo();
        v.x += now.x - g.x;
        v.y += now.y - g.y;
        if (g.dist > 0) zoomAt(now.dist / g.dist, now.x, now.y);
        else apply();
        gesture.current = { ...now, moved: g.moved };
        return;
      }
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      g.moved += Math.abs(dx) + Math.abs(dy);
      if (g.moved > DRAG_THRESHOLD && !dragged.current) {
        dragged.current = true;
        // Capture only once it is a drag, so plain taps still reach room shapes.
        svg.setPointerCapture(e.pointerId);
        svg.classList.add('is-dragging');
      }
      if (dragged.current) {
        v.x += dx;
        v.y += dy;
        apply();
      }
      g.x = p.x;
      g.y = p.y;
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 1) {
        const [p] = pointers.current.values();
        gesture.current = { ...p, dist: 0, moved: DRAG_THRESHOLD + 1 };
      } else if (!pointers.current.size) {
        gesture.current = null;
        svg.classList.remove('is-dragging');
      }
    };
    const leave = () => hoverRef.current?.(null);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      stopTween();
      const p = local(e);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
    };
    const key = (e: KeyboardEvent) => {
      if (e.target !== svg) return;
      const v = view.current;
      const { w, h } = size.current;
      const pan: Record<string, [number, number]> = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
      if (pan[e.key]) {
        v.x += pan[e.key][0];
        v.y += pan[e.key][1];
        apply();
      } else if (e.key === '+' || e.key === '=') zoomAt(1.25, w / 2, h / 2);
      else if (e.key === '-' || e.key === '_') zoomAt(0.8, w / 2, h / 2);
      else return;
      e.preventDefault();
    };

    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', leave);
    svg.addEventListener('wheel', wheel, { passive: false });
    svg.addEventListener('keydown', key);
    return () => {
      svg.removeEventListener('pointerdown', down);
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up);
      svg.removeEventListener('pointercancel', up);
      svg.removeEventListener('pointerleave', leave);
      svg.removeEventListener('wheel', wheel);
      svg.removeEventListener('keydown', key);
      cancelAnimationFrame(tween.current);
      cancelAnimationFrame(zoomFrame.current);
    };
  }, [svgRef, apply, zoomAt]);

  /** True when the pointer sequence that produced this click was a drag. */
  const wasDrag = useCallback(() => dragged.current, []);

  return { zoom, zoomBy, reset, flyTo, fitPoints, wasDrag };
}
