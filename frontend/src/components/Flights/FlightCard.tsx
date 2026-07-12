import { useNavigate } from 'react-router-dom';
import { Flight } from '../../services/flights.service';
import { useFlightDelete, useFlightAnalysis } from '../../hooks/useFlights';

interface FlightCardProps {
  flight: Flight;
  date: string;
  canDelete: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  uploaded: 'bg-blue-900/30 text-blue-400',
  parsing: 'bg-amber-900/30 text-amber-400',
  analyzed: 'bg-green-900/30 text-green-400',
  failed: 'bg-red-900/30 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Uploaded',
  parsing: 'Parsing…',
  analyzed: 'Analyzed',
  failed: 'Failed',
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDistance(metres: number | null): string {
  if (metres === null) return '—';
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

function formatAltitude(metres: number | null): string {
  if (metres === null) return '—';
  return `${Math.round(metres * 3.28084)} ft`;
}

function scoreColor(score: number): { bg: string; text: string } {
  if (score >= 80) return { bg: 'bg-green-500', text: 'text-white' };
  if (score >= 60) return { bg: 'bg-yellow-400', text: 'text-yellow-900' };
  return { bg: 'bg-red-400', text: 'text-white' };
}

export default function FlightCard({ flight, date, canDelete }: FlightCardProps) {
  const navigate = useNavigate();
  const deleteMutation = useFlightDelete(date);

  const isAnalyzed = flight.parse_status === 'analyzed';
  const isParsing = flight.parse_status === 'parsing' || flight.parse_status === 'uploaded';
  const analysisComplete = flight.analysis_status === 'complete';

  // Fetch score only when analysis is complete
  const { data: analysis } = useFlightAnalysis(analysisComplete ? flight.id : undefined);
  const overallScore = analysis?.score?.overall_score ?? null;

  const handleDelete = () => {
    if (!window.confirm(`Delete flight "${flight.title || flight.original_filename}"?`)) return;
    deleteMutation.mutate(flight.id);
  };

  return (
    <div className="bg-[#1e2a3a] rounded-xl border border-[#2a3a54] p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">
            {flight.title || flight.original_filename}
          </h3>
          {flight.pilot && (
            <p className="text-sm text-[#6b7fa3] mt-0.5">{flight.pilot.display_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Score badge */}
          {overallScore !== null && (() => {
            const { bg, text } = scoreColor(overallScore);
            return (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${bg} ${text}`}>
                {overallScore}
              </span>
            );
          })()}
          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[flight.parse_status]}`}
          >
            {isParsing && (
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {STATUS_LABELS[flight.parse_status]}
          </span>
        </div>
      </div>

      {/* Metrics row */}
      {isAnalyzed && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#141d2e] rounded-lg py-2 px-1">
            <p className="text-xs text-[#6b7fa3]">Duration</p>
            <p className="text-sm font-semibold text-white">
              {formatDuration(flight.duration_seconds)}
            </p>
          </div>
          <div className="bg-[#141d2e] rounded-lg py-2 px-1">
            <p className="text-xs text-[#6b7fa3]">Distance</p>
            <p className="text-sm font-semibold text-white">
              {formatDistance(flight.total_distance_m)}
            </p>
          </div>
          <div className="bg-[#141d2e] rounded-lg py-2 px-1">
            <p className="text-xs text-[#6b7fa3]">Max Alt</p>
            <p className="text-sm font-semibold text-white">
              {formatAltitude(flight.max_altitude_m)}
            </p>
          </div>
        </div>
      )}

      {/* Metadata pills */}
      <div className="flex flex-wrap gap-1.5">
        {(flight.glider || flight.harness) && (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#2a3a54] text-[#a0b3cc] text-xs">
            {flight.glider}{flight.glider && flight.harness ? ' / ' : ''}{flight.harness}
          </span>
        )}
        {flight.launch_site_name && (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#2a3a54] text-[#a0b3cc] text-xs">
            📍 {flight.launch_site_name}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1 border-t border-[#2a3a54]">
        <button
          onClick={() => navigate(`/flights/${flight.id}`)}
          disabled={!analysisComplete}
          title={analysisComplete ? 'View flight analysis' : 'Analysis not yet complete'}
          className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          View Analysis
        </button>
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="px-3 py-1.5 border border-[#2a3a54] text-red-400 text-sm rounded-lg hover:bg-red-900/20 hover:border-red-700/40 transition-colors disabled:opacity-40"
            title="Delete flight"
          >
            {deleteMutation.isPending ? '…' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  );
}
