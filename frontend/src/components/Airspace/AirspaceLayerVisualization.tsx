import { useMemo, useState } from 'react';
import { FlightSite } from '../../services/sites.service';
import { AirspaceGeoJSON, AirspaceClass } from '../../services/airspace.service';
import { computeAirspaceLayers } from '../../utils/airspaceUtils';
import AirspaceClassModal from './AirspaceClassModal';

interface AirspaceLayerVisualizationProps {
  site: FlightSite;
  airspace: AirspaceGeoJSON;
  onClose: () => void;
  selectedPlotNode?: {
    nodeIndex: number;
    lat: number;
    lon: number;
  } | null;
}

// FL150 cap (15,000 feet)
const FL150_FEET = 15000;

export default function AirspaceLayerVisualization({
  site,
  airspace,
  onClose,
  selectedPlotNode,
}: AirspaceLayerVisualizationProps) {
  // State for modal
  const [selectedClass, setSelectedClass] = useState<{
    class: AirspaceClass;
    name: string;
    color: string;
    lower: string;
    upper: string;
  } | null>(null);

  // Calculate layers for this site
  const layers = useMemo(() => {
    const lat = selectedPlotNode
      ? selectedPlotNode.lat
      : parseFloat(site.takeoff_lat.toString());
    const lon = selectedPlotNode
      ? selectedPlotNode.lon
      : parseFloat(site.takeoff_lon.toString());
    return computeAirspaceLayers(lat, lon, airspace, FL150_FEET);
  }, [site, airspace, selectedPlotNode]);

  // SVG dimensions configuration
  const SVG_HEIGHT = 400;
  const SVG_WIDTH = 100;
  const SVG_PADDING_TOP = 20;
  const SVG_PADDING_BOTTOM = 30;
  const GRAPH_HEIGHT = SVG_HEIGHT - SVG_PADDING_TOP - SVG_PADDING_BOTTOM; // 350px
  const AXIS_WIDTH = 70; // Width for boundary labels on the left

  // Calculate SVG data for rendering
  const svgData = useMemo(() => {
    if (layers.length === 0) return null;

    const maxAltitude = Math.min(
      Math.max(...layers.map(l => l.upperFeet)),
      FL150_FEET
    );

    // Convert feet to pixels (inverted for SVG coordinate system)
    const feetToPixels = (feet: number) => {
      const proportion = feet / maxAltitude;
      return SVG_PADDING_TOP + GRAPH_HEIGHT - (proportion * GRAPH_HEIGHT);
    };

    // Convert feet to Flight Level (divide by 100)
    const feetToFL = (feet: number) => Math.round(feet / 100);

    // Calculate layer rectangles
    const layerRects = layers.map(layer => {
      const y1 = feetToPixels(layer.upperFeet); // Top of layer
      const y2 = feetToPixels(layer.lowerFeet); // Bottom of layer
      const height = y2 - y1;

      return {
        ...layer,
        y: y1,
        height: height,
        centerY: y1 + height / 2, // For centering class letter
      };
    });

    // Calculate boundary labels (unique altitudes where layers start/end)
    const boundaryAltitudes = new Set<number>();
    layers.forEach(layer => {
      boundaryAltitudes.add(layer.lowerFeet);
      boundaryAltitudes.add(layer.upperFeet);
    });

    const boundaryLabels = Array.from(boundaryAltitudes)
      .sort((a, b) => a - b)
      .map(feet => ({
        feet,
        label: feet === 0 ? 'SFC' : `FL${feetToFL(feet)}`,
        y: feetToPixels(feet),
      }));

    return {
      maxAltitude,
      layerRects,
      boundaryLabels,
    };
  }, [layers, SVG_HEIGHT, SVG_PADDING_TOP, SVG_PADDING_BOTTOM, GRAPH_HEIGHT]);

  if (layers.length === 0) {
    return (
      <div className="absolute bottom-4 right-4 mb-[340px] bg-white rounded-lg shadow-lg border-2 border-gray-300 p-4 z-[500] min-w-[250px]">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Airspace Layers
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-600 mb-2">
          {site.name}
          {selectedPlotNode && ` - Node ${selectedPlotNode.nodeIndex + 1}`}
        </p>
        <p className="text-sm text-gray-500 text-center py-4">
          No airspace at this location
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Airspace Class Modal */}
      <AirspaceClassModal
        airspaceClass={selectedClass?.class || null}
        className={selectedClass ? `Class ${selectedClass.class}` : ''}
        color={selectedClass?.color || '#000000'}
        airspaceName={selectedClass?.name || ''}
        lowerAltitude={selectedClass?.lower || ''}
        upperAltitude={selectedClass?.upper || ''}
        onClose={() => setSelectedClass(null)}
      />

      {/* Main Visualization Container */}
      <div className="absolute bottom-4 right-4 mb-[340px] bg-white rounded-lg shadow-lg border-2 border-gray-300 p-4 z-[500]">
        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Airspace Layers
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Site name */}
        <p className="text-xs text-gray-600 mb-4">
          {site.name}
          {selectedPlotNode && ` - Node ${selectedPlotNode.nodeIndex + 1}`}
        </p>

        {/* SVG Bar Graph */}
        {svgData && (
          <svg
            width={AXIS_WIDTH + SVG_WIDTH}
            height={SVG_HEIGHT}
            className="mx-auto"
          >
            {/* Boundary labels on the left side */}
            {svgData.boundaryLabels.map((boundary, index) => (
              <g key={`boundary-${boundary.feet}-${index}`}>
                {/* Boundary label */}
                <text
                  x={AXIS_WIDTH - 15}
                  y={boundary.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="11"
                  fill="#374151"
                  fontWeight="600"
                >
                  {boundary.label}
                </text>
                {/* Horizontal line from label to bar */}
                <line
                  x1={AXIS_WIDTH - 10}
                  y1={boundary.y}
                  x2={AXIS_WIDTH}
                  y2={boundary.y}
                  stroke="#374151"
                  strokeWidth="1.5"
                />
              </g>
            ))}

            {/* Stacked bar layers */}
            {svgData.layerRects.map((layer, index) => (
              <g key={`${layer.class}-${layer.lowerFeet}-${index}`}>
                {/* Layer rectangle */}
                <rect
                  x={AXIS_WIDTH}
                  y={layer.y}
                  width={SVG_WIDTH}
                  height={layer.height}
                  fill={layer.color}
                  opacity="0.85"
                  stroke="#374151"
                  strokeWidth="2"
                  className="cursor-pointer transition-opacity hover:opacity-100"
                  onClick={() => setSelectedClass({
                    class: layer.class,
                    name: layer.name,
                    color: layer.color,
                    lower: layer.lower,
                    upper: layer.upper,
                  })}
                />

                {/* Class letter in center of layer */}
                {layer.height > 30 && ( // Only show if layer is tall enough
                  <>
                    <text
                      x={AXIS_WIDTH + SVG_WIDTH / 2}
                      y={layer.name.includes('NOTAM') ? layer.centerY - 8 : layer.centerY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="24"
                      fontWeight="bold"
                      fill="white"
                      className="pointer-events-none drop-shadow-lg"
                      style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.5))' }}
                    >
                      {layer.class}
                    </text>
                    {layer.name.includes('NOTAM') && (
                      <text
                        x={AXIS_WIDTH + SVG_WIDTH / 2}
                        y={layer.centerY + 12}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill="white"
                        className="pointer-events-none drop-shadow-lg"
                        style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.5))' }}
                      >
                        NOTAM
                      </text>
                    )}
                  </>
                )}
              </g>
            ))}

            {/* Ground label */}
            <text
              x={AXIS_WIDTH + SVG_WIDTH / 2}
              y={SVG_HEIGHT - 10}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="#374151"
            >
              GROUND
            </text>
          </svg>
        )}
      </div>
    </>
  );
}
