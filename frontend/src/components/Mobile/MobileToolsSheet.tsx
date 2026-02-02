import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from './BottomSheet';
import { AirspaceClass } from '../../services/airspace.service';
import { FlightSite } from '../../services/sites.service';

/**
 * MobileToolsSheet - Mobile bottom sheet for tools with sub-tabs
 *
 * Provides access to:
 * - Airspace: Filter airspace classes
 * - Plot: Plot editing controls
 * - Settings: Navigate to settings page
 */

interface MobileToolsSheetProps {
  isOpen: boolean;
  onClose: () => void;

  // Airspace props
  showAirspace: boolean;
  enabledAirspaceClasses: Set<AirspaceClass>;
  onToggleAirspaceClass: (airspaceClass: AirspaceClass) => void;
  onToggleAirspace: () => void;

  // Plot props
  isPlottingMode: boolean;
  selectedSiteForPlot: FlightSite | null;
  currentPlotPoints: Array<{ lat: number; lon: number }>;
  isPlotClosed: boolean;
  hasUnsavedChanges: boolean;
  showPlotLabels: boolean;
  onSavePlot: () => void;
  onCompletePlot: () => void;
  onDeleteLastPoint: () => void;
  onClearPlot: () => void;
  onDeletePlot: () => void;
  onToggleLabels: () => void;
  onClosePlot: () => void;
  isSavingPlot: boolean;

  // Admin
  isAdmin: boolean;
  onFetchWeather: () => void;
  isFetchingWeather: boolean;
}

export default function MobileToolsSheet({
  isOpen,
  onClose,
  showAirspace,
  enabledAirspaceClasses,
  onToggleAirspaceClass,
  onToggleAirspace,
  isPlottingMode,
  selectedSiteForPlot,
  currentPlotPoints,
  isPlotClosed,
  hasUnsavedChanges,
  showPlotLabels,
  onSavePlot,
  onCompletePlot,
  onDeleteLastPoint,
  onClearPlot,
  onDeletePlot,
  onToggleLabels,
  onClosePlot,
  isSavingPlot,
  isAdmin,
  onFetchWeather,
  isFetchingWeather,
}: MobileToolsSheetProps) {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<'airspace' | 'plot' | 'settings'>('airspace');

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
          onClick={() => setActiveSubTab('plot')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors touch-target ${
            activeSubTab === 'plot'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600'
          }`}
        >
          Plot
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
            {/* Airspace Toggle */}
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

            {/* Airspace Class Filter */}
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

        {activeSubTab === 'plot' && (
          <div className="space-y-4">
            {isPlottingMode && selectedSiteForPlot ? (
              // Plot controls when in plotting mode
              <div className="space-y-4">
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-blue-900 mb-2">{selectedSiteForPlot.name}</h3>
                  <div className="text-sm text-blue-800">
                    <p>Points: {currentPlotPoints.length}</p>
                    <p>Status: {isPlotClosed ? 'Closed' : 'Drawing...'}</p>
                  </div>
                </div>

                {/* Plot Actions */}
                <div className="space-y-2">
                  {!isPlotClosed && currentPlotPoints.length >= 3 && (
                    <button
                      onClick={onCompletePlot}
                      className="w-full px-4 py-4 bg-green-600 text-white rounded-lg font-semibold touch-target-lg active:bg-green-700 transition-colors"
                    >
                      Complete Plot
                    </button>
                  )}

                  {isPlotClosed && (
                    <button
                      onClick={onSavePlot}
                      disabled={!hasUnsavedChanges || isSavingPlot}
                      className="w-full px-4 py-4 bg-blue-600 text-white rounded-lg font-semibold touch-target-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:bg-blue-700 transition-colors"
                    >
                      {isSavingPlot ? 'Saving...' : 'Save Plot'}
                    </button>
                  )}

                  <button
                    onClick={onToggleLabels}
                    className="w-full px-4 py-4 bg-gray-600 text-white rounded-lg font-semibold touch-target-lg active:bg-gray-700 transition-colors"
                  >
                    {showPlotLabels ? 'Hide Labels' : 'Show Labels'}
                  </button>

                  {!isPlotClosed && currentPlotPoints.length > 0 && (
                    <button
                      onClick={onDeleteLastPoint}
                      className="w-full px-4 py-4 bg-orange-600 text-white rounded-lg font-semibold touch-target-lg active:bg-orange-700 transition-colors"
                    >
                      Delete Last Point
                    </button>
                  )}

                  {currentPlotPoints.length > 0 && (
                    <button
                      onClick={onClearPlot}
                      className="w-full px-4 py-4 bg-red-600 text-white rounded-lg font-semibold touch-target-lg active:bg-red-700 transition-colors"
                    >
                      Clear All Points
                    </button>
                  )}

                  {selectedSiteForPlot.plot_data && (
                    <button
                      onClick={onDeletePlot}
                      className="w-full px-4 py-4 bg-red-800 text-white rounded-lg font-semibold touch-target-lg active:bg-red-900 transition-colors"
                    >
                      Delete Saved Plot
                    </button>
                  )}

                  <button
                    onClick={onClosePlot}
                    className="w-full px-4 py-4 bg-gray-400 text-white rounded-lg font-semibold touch-target-lg active:bg-gray-500 transition-colors"
                  >
                    Cancel Plotting
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                <p className="text-base mb-2">Select a site to start plotting</p>
                <p className="text-sm">Tap a takeoff icon on the map, then tap "Plot" in the header</p>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'settings' && (
          <div className="space-y-4">
            {isAdmin && (
              <>
                <button
                  onClick={onFetchWeather}
                  disabled={isFetchingWeather}
                  className="w-full px-4 py-4 bg-purple-600 text-white rounded-lg font-semibold touch-target-lg disabled:opacity-50 disabled:cursor-not-allowed active:bg-purple-700 transition-colors"
                >
                  {isFetchingWeather ? 'Fetching...' : 'Fetch Weather'}
                </button>

                <button
                  onClick={() => {
                    navigate('/settings');
                    onClose();
                  }}
                  className="w-full px-4 py-4 bg-gray-600 text-white rounded-lg font-semibold touch-target-lg active:bg-gray-700 transition-colors"
                >
                  Open Settings
                </button>
              </>
            )}

            {!isAdmin && (
              <div className="text-center py-8 text-gray-600">
                <p className="text-base">Admin access required</p>
              </div>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
