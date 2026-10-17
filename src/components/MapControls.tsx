import { Footprints, KeyRound, LocateFixed, MapPin, Minus, Plus, Tag, type LucideIcon } from 'lucide-react';
import type { Layers } from '../types/map.ts';

interface Props {
  layers: Layers;
  onToggle: (key: keyof Layers) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

const TOGGLES: { key: keyof Layers; icon: LucideIcon; label: string }[] = [
  { key: 'labels', icon: Tag, label: 'Room labels' },
  { key: 'footprints', icon: Footprints, label: 'Footprints' },
  { key: 'secrets', icon: KeyRound, label: 'Secret passages' },
  { key: 'markers', icon: MapPin, label: 'Location markers' },
];

export function MapControls({ layers, onToggle, onZoomIn, onZoomOut, onReset }: Props) {
  return (
    <div className="controls">
      <div className="control-group" role="group" aria-label="Zoom">
        <button className="ctl" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
          <Plus aria-hidden />
        </button>
        <button className="ctl" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
          <Minus aria-hidden />
        </button>
        <button className="ctl" onClick={onReset} aria-label="Reset map position" title="Reset map position">
          <LocateFixed aria-hidden />
        </button>
      </div>
      <div className="control-group" role="group" aria-label="Map layers">
        {TOGGLES.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            className="ctl toggle"
            aria-pressed={layers[key]}
            onClick={() => onToggle(key)}
            title={`${layers[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-label={label}
          >
            <Icon aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
