import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from './BottomSheet';
import { AirspaceClass } from '../../services/airspace.service';

interface MobileToolsSheetProps {
  isOpen: boolean;
  onClose: () => void;

  // Airspace props
  showAirspace: boolean;
  enabledAirspaceClasses: Set<AirspaceClass>;
  onToggleAirspaceClass: (airspaceClass: AirspaceClass) => void;
  onToggleAirspace: () => void;

  // Mission mode
  isMissionMode: boolean;
  onToggleMissionMode: () => void;
}

export default function MobileToolsSheet({
  isOpen,
  onClose,
  showAirspace,
  enabledAirspaceClasses,
  onToggleAirspaceClass,
  onToggleAirspace,
  isMissionMode,
  onToggleMissionMode,
}: MobileToolsSheetProps) {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<'airspace' | 'missions' | 'settings'>('airspace');

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Tools"
      height="full"
    >
      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 -mx-6 px-6 mb-4">
        <button
          onClick={() => setActiveSubTab('airspace')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors touch-target ${
            activeSubTab === 'airspace'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600'
          }`}
        >
          Airspace
        </button>
        <button
          onClick={() => setActiveSubTab('missions')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors touch-target ${
            activeSubTab === 'missions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600'
          }`}
        >
          Missions
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors touch-target ${
            activeSubTab === 'settings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSubTab === 'airspace' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold outdoor-text">Show Airspace</span>
              <button
                onClick={onToggleAirspace}
                className={`px-6 py-3 rounded-lg text-white font-semibold transition-colors touch-target ${
                  showAirspace
                    ? 'bg-green-600 active:bg-green-700'
                    : 'bg-gray-600 active:bg-gray-700'
                }`}
              >
                {showAirspace ? 'ON' : 'OFF'}
              </button>
            </div>

            {showAirspace && (
              <div>
                <h3 className="text-base font-semibold outdoor-text mb-3">Airspace Classes</h3>
                <div className="space-y-2">
                  {(['A', 'C', 'CTR', 'D', 'G', 'Q', 'R', 'RMZ'] as AirspaceClass[]).map((airspaceClass) => (
                    <label
                      key={airspaceClass}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg touch-target active:bg-gray-100 transition-colors"
                    >
                      <span className="text-base font-medium outdoor-text">Class {airspaceClass}</span>
                      <input
                        type="checkbox"
                        checked={enabledAirspaceClasses.has(airspaceClass)}
                        onChange={() => onToggleAirspaceClass(airspaceClass)}
                        className="w-6 h-6 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'missions' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {isMissionMode ? 'Mission pins are shown on the map.' : 'Show your missions on the map.'}
            </p>
            <button
              onClick={() => { onToggleMissionMode(); onClose(); }}
              className={`w-full px-4 py-4 text-white rounded-lg font-semibold touch-target-lg transition-colors ${
                isMissionMode ? 'bg-sky-600 active:bg-sky-700' : 'bg-indigo-600 active:bg-indigo-700'
              }`}
            >
              {isMissionMode ? 'Show Weather' : 'Show Missions'}
            </button>
            <button
              onClick={() => { navigate('/missions'); onClose(); }}
              className="w-full px-4 py-4 bg-white border border-indigo-300 text-indigo-700 rounded-lg font-semibold touch-target-lg active:bg-indigo-50 transition-colors"
            >
              Open Mission Planner
            </button>
          </div>
        )}

        {activeSubTab === 'settings' && (
          <div className="space-y-4">
            <button
              onClick={() => { navigate('/settings'); onClose(); }}
              className="w-full px-4 py-4 bg-gray-600 text-white rounded-lg font-semibold touch-target-lg active:bg-gray-700 transition-colors"
            >
              Open Settings
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
