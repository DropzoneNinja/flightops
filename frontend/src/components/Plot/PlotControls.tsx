import { FlightSite } from '../../services/sites.service';

interface PlotControlsProps {
  site: FlightSite;
  currentPoints: Array<{ lat: number; lon: number }>;
  isClosed: boolean;
  hasUnsavedChanges: boolean;
  showLabels: boolean;
  onSave: () => void;
  onComplete: () => void;
  onDeleteLastPoint: () => void;
  onClear: () => void;
  onDeletePlot: () => void;
  onToggleLabels: () => void;
  onClose: () => void;
  isSaving: boolean;
}

/**
 * PlotControls - Top-right control panel for plot management
 *
 * Provides buttons for:
 * - Complete: Close the plot loop (enabled when 3+ points and not closed)
 * - Save: Save the current plot to the database (enabled when closed + has unsaved changes)
 * - Delete Last Point: Remove the most recent point (enabled when not closed + has points)
 * - Clear: Clear all points if new plot, or delete plot if previously saved
 */
export default function PlotControls({
  site,
  currentPoints,
  isClosed,
  hasUnsavedChanges,
  showLabels,
  onSave,
  onComplete,
  onDeleteLastPoint,
  onClear,
  onDeletePlot,
  onToggleLabels,
  onClose,
  isSaving,
}: PlotControlsProps) {
  const hasExistingPlot = site.plot_data && site.plot_data.points.length > 0;
  const canComplete = currentPoints.length >= 3 && !isClosed;
  const canDeleteLast = currentPoints.length > 0 && !isClosed;
  const canSave = currentPoints.length >= 2 && isClosed && hasUnsavedChanges;

  // Unified clear/delete handler
  const handleClear = () => {
    if (hasExistingPlot) {
      // If plot was previously saved, delete it
      onDeletePlot();
    } else {
      // If plot is new, just clear the points
      onClear();
    }
  };

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border-2 border-gray-300 p-4 z-[500] min-w-[220px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Plot: {site.name}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-xl transition-colors"
          disabled={isSaving}
        >
          ×
        </button>
      </div>

      <div className="text-xs text-gray-600 mb-3">
        {isClosed
          ? `${currentPoints.length} points (closed)`
          : `${currentPoints.length} points - Click Complete to close`}
      </div>

      <div className="space-y-2">
        {!isClosed && (
          <button
            onClick={onComplete}
            disabled={!canComplete || isSaving}
            className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Complete
          </button>
        )}

        <button
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="w-full px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Plot'}
        </button>

        <button
          onClick={onDeleteLastPoint}
          disabled={!canDeleteLast || isSaving}
          className="w-full px-3 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Delete Last Point
        </button>

        <button
          onClick={onToggleLabels}
          disabled={isSaving}
          className="w-full px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {showLabels ? 'Hide Labels' : 'Show Labels'}
        </button>

        <button
          onClick={handleClear}
          disabled={currentPoints.length === 0 || isSaving}
          className="w-full px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {hasExistingPlot ? 'Delete Plot' : 'Clear'}
        </button>
      </div>
    </div>
  );
}
