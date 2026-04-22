import { useMemo } from 'react';
import { useAirspace } from '../../hooks/useAirspace';
import { CLASS_COLORS, computeAirspaceLayers } from '../../utils/airspaceUtils';

const MAX_FEET = 5000;
const BAR_WIDTH = 20;
const BAR_HEIGHT = 64;
const LABEL_HEIGHT = 10; // space above and below bar for "5K" / "GND" labels
const SVG_HEIGHT = BAR_HEIGHT + LABEL_HEIGHT * 2;
const SVG_WIDTH = BAR_WIDTH;

function feetToY(feet: number): number {
  const proportion = feet / MAX_FEET;
  return LABEL_HEIGHT + BAR_HEIGHT - proportion * BAR_HEIGHT;
}

interface WaypointAirspaceBarProps {
  lat: number | string;
  lon: number | string;
}

export default function WaypointAirspaceBar({ lat, lon }: WaypointAirspaceBarProps) {
  const { airspace, isLoading } = useAirspace();

  const layers = useMemo(() => {
    if (!airspace) return [];
    return computeAirspaceLayers(Number(lat), Number(lon), airspace, MAX_FEET);
  }, [lat, lon, airspace]);

  if (isLoading) {
    return (
      <svg width={SVG_WIDTH} height={SVG_HEIGHT} className="shrink-0">
        <rect x={0} y={LABEL_HEIGHT} width={BAR_WIDTH} height={BAR_HEIGHT} fill="#e5e7eb" rx={2} />
      </svg>
    );
  }

  // If no layers cover 0–5000ft at all, show a plain Class G bar
  const hasGroundCoverage = layers.some(l => l.lowerFeet === 0);
  const displayLayers = layers.length === 0 || !hasGroundCoverage
    ? [{ class: 'G' as const, lowerFeet: 0, upperFeet: MAX_FEET, color: CLASS_COLORS['G'], name: 'Class G', lower: 'SFC', upper: `${MAX_FEET}FT` }]
    : layers;

  return (
    <svg width={SVG_WIDTH} height={SVG_HEIGHT} className="shrink-0">
      {/* Top label */}
      <text x={BAR_WIDTH / 2} y={LABEL_HEIGHT - 1} textAnchor="middle" fontSize={8} fill="#6b7280" fontWeight="700">
        5K
      </text>

      {/* Colored bands */}
      {displayLayers.map((layer, i) => {
        const y1 = feetToY(layer.upperFeet);
        const y2 = feetToY(layer.lowerFeet);
        const h = y2 - y1;
        const centerY = y1 + h / 2;
        return (
          <g key={`${layer.class}-${layer.lowerFeet}-${i}`}>
            <rect x={0} y={y1} width={BAR_WIDTH} height={h} fill={layer.color} opacity={0.95} stroke="#1f2937" strokeWidth={0.75}>
              <title>{layer.class}: {layer.lower} – {layer.upper}</title>
            </rect>
            {h >= 12 && (
              <>
                <text
                  x={BAR_WIDTH / 2}
                  y={centerY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight="normal"
                  fill="rgba(0,0,0,0.6)"
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  className="pointer-events-none"
                >
                  {layer.class}
                </text>
                <text
                  x={BAR_WIDTH / 2}
                  y={centerY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight="normal"
                  fill="white"
                  className="pointer-events-none"
                >
                  {layer.class}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* Bottom label */}
      <text x={BAR_WIDTH / 2} y={LABEL_HEIGHT + BAR_HEIGHT + LABEL_HEIGHT - 1} textAnchor="middle" fontSize={8} fill="#6b7280" fontWeight="700">
        GND
      </text>
    </svg>
  );
}
