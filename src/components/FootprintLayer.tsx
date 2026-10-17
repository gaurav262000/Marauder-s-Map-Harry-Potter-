import { memo, useRef } from 'react';
import { PRINTS, useFootprintAnimation, type Trail } from '../hooks/useFootprintAnimation.ts';

interface Props {
  trails: Trail[];
  className: string;
  reducedMotion: boolean;
  onArrive?: (id: string) => void;
}

function FootprintLayerImpl({ trails, className, reducedMotion, onArrive }: Props) {
  const ref = useRef<SVGGElement>(null);
  useFootprintAnimation(ref, trails, { reducedMotion, onArrive });
  return (
    <g ref={ref} className={className} aria-hidden="true">
      {trails.map((t) => (
        <g key={t.id} data-trail={t.id}>
          {Array.from({ length: PRINTS }, (_, i) => (
            <use key={i} href="#foot" className="foot" opacity={0} />
          ))}
          {t.label && (
            <g className="walker-name">
              <rect x={-t.label.length * 3.9 - 8} y={-14} width={t.label.length * 7.8 + 16} height={24} rx={3} />
              <text textAnchor="middle" y={4}>
                {t.label}
              </text>
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

export const FootprintLayer = memo(FootprintLayerImpl);
