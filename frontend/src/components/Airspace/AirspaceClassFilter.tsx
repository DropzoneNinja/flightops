import { AirspaceClass } from '../../services/airspace.service';

interface AirspaceClassFilterProps {
  enabledClasses: Set<AirspaceClass>;
  onToggleClass: (airspaceClass: AirspaceClass) => void;
}

// Class labels and colors for display
const CLASS_INFO: Record<AirspaceClass, { label: string; color: string }> = {
  A: { label: 'Class A', color: '#0080FF' },
  C: { label: 'Class C', color: '#C9A961' },
  CTR: { label: 'CTR', color: '#FF0000' },
  D: { label: 'Class D', color: '#0080FF' },
  E: { label: 'Class E', color: '#00FF00' },
  Q: { label: 'Class Q', color: '#CC00CC' },
  R: { label: 'Restricted', color: '#7B7FE6' },
  G: { label: 'Class G', color: '#4B8B3B' },
  RMZ: { label: 'RMZ', color: '#1E90FF' },
};

const ALL_CLASSES: AirspaceClass[] = ['A', 'C', 'CTR', 'D', 'E', 'G', 'Q', 'R', 'RMZ'];

export default function AirspaceClassFilter({
  enabledClasses,
  onToggleClass,
}: AirspaceClassFilterProps) {
  return (
    <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg border-2 border-gray-300 p-3 z-[500] min-w-[180px]">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">
        Airspace Classes
      </h3>
      <div className="space-y-1.5">
        {ALL_CLASSES.map((airspaceClass) => {
          const info = CLASS_INFO[airspaceClass];
          const isEnabled = enabledClasses.has(airspaceClass);

          return (
            <label
              key={airspaceClass}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => onToggleClass(airspaceClass)}
                className="w-4 h-4 cursor-pointer"
                style={{
                  accentColor: info.color,
                }}
              />
              <div
                className="w-4 h-4 rounded border border-gray-400"
                style={{
                  backgroundColor: info.color,
                  opacity: 0.5,
                }}
              />
              <span className="text-sm text-gray-700">
                {info.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
