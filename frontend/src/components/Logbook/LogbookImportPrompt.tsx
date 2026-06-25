import { useState } from 'react';
import { UseMutationResult } from '@tanstack/react-query';
import { OrphanedFlight, LogbookEntry, LOGBOOK_IMPORT_PROMPT_KEY } from '../../hooks/useLogbook';

function fmtDuration(s: number | null): string | null {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDist(m: number | null): string | null {
  if (!m) return null;
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtAlt(m: number | null): string | null {
  if (!m) return null;
  return `${Math.round(m * 3.28084)} ft`;
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  flights: OrphanedFlight[];
  importMutation: UseMutationResult<LogbookEntry, Error, string>;
  onDismiss: () => void;
}

export default function LogbookImportPrompt({ flights, importMutation, onDismiss }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(flights.map((f) => f.id)));

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const dismiss = () => {
    localStorage.setItem(LOGBOOK_IMPORT_PROMPT_KEY, 'true');
    onDismiss();
  };

  const handleImport = async () => {
    for (const flightId of selectedIds) {
      await importMutation.mutateAsync(flightId);
    }
    dismiss();
  };

  const count = selectedIds.size;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Import flights to your logbook</h2>
          <p className="text-sm text-gray-500 mt-1">
            {flights.length} uploaded flight{flights.length !== 1 ? 's' : ''} haven't been added to your logbook yet. Select the ones you'd like to import.
          </p>
        </div>

        <div className="overflow-y-auto flex-1">
          {flights.map((f) => {
            const parts = [fmtDuration(f.duration_seconds), fmtDist(f.total_distance_m), fmtAlt(f.max_altitude_m)].filter(Boolean);
            return (
              <label
                key={f.id}
                className="flex items-start gap-3 px-6 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(f.id)}
                  onChange={() => toggle(f.id)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-gray-900">
                    {f.flight_date}
                    {fmtTime(f.start_at) && (
                      <span className="font-normal text-gray-500 ml-1.5">at {fmtTime(f.start_at)}</span>
                    )}
                  </div>
                  {parts.length > 0 && (
                    <div className="text-xs text-gray-500 mt-0.5">{parts.join(' · ')}</div>
                  )}
                  {f.title && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{f.title}</div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={dismiss}
            disabled={importMutation.isPending}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            onClick={handleImport}
            disabled={count === 0 || importMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {importMutation.isPending
              ? 'Importing…'
              : `Import ${count} flight${count !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
