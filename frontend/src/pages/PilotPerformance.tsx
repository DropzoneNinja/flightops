import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { usePilotPerformance } from '../hooks/useFlights';

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(metres: number | null): string {
  if (metres === null) return '—';
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

const CATEGORY_LABELS: Record<string, string> = {
  overall_score: 'Overall',
  takeoff_score: 'Takeoff',
  climb_score: 'Climb',
  level_score: 'Level Flight',
  turn_score: 'Turns',
  descent_score: 'Descent',
  landing_score: 'Landing',
  smoothness_score: 'Smoothness',
  safety_score: 'Safety',
};

const TREND_LINES = [
  { key: 'overall_score', color: '#3b82f6', label: 'Overall' },
  { key: 'landing_score', color: '#10b981', label: 'Landing' },
  { key: 'takeoff_score', color: '#f59e0b', label: 'Takeoff' },
  { key: 'smoothness_score', color: '#8b5cf6', label: 'Smoothness' },
];

export default function PilotPerformance() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: perf, isLoading, error } = usePilotPerformance(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1421] flex items-center justify-center">
        <div className="animate-pulse text-[#6b7fa3]">Loading pilot data…</div>
      </div>
    );
  }

  if (error || !perf) {
    return (
      <div className="min-h-screen bg-[#0d1421] flex items-center justify-center">
        <div className="text-red-400">Failed to load pilot data.</div>
      </div>
    );
  }

  const { pilot, total_flights, recent_flights, score_trend, personal_bests, rolling_30d_avg } = perf;

  return (
    <div className="min-h-screen bg-[#0d1421]">
      {/* Header */}
      <header className="bg-[#0d1421] border-b border-[#2a3a54] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{pilot.display_name}</h1>
            <p className="text-xs text-[#6b7fa3]">{total_flights} analyzed flight{total_flights !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total Flights" value={String(total_flights)} />
          <StatCard
            label="30-Day Avg"
            value={rolling_30d_avg !== null ? rolling_30d_avg.toFixed(1) : '—'}
            highlight={rolling_30d_avg !== null ? scoreColor(rolling_30d_avg) : undefined}
          />
          {personal_bests.find((b) => b.category === 'overall_score') && (
            <StatCard
              label="Best Overall"
              value={personal_bests.find((b) => b.category === 'overall_score')!.value.toFixed(1)}
              highlight="text-green-600"
            />
          )}
        </div>

        {/* Score trend chart */}
        {score_trend.length >= 2 && (
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Score Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={score_trend} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                <XAxis
                  dataKey="flight_date"
                  tick={{ fontSize: 10, fill: '#6b7fa3' }}
                  tickFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7fa3' }} />
                <Tooltip
                  formatter={(val, name) => [typeof val === 'number' ? val.toFixed(1) : '—', name as string]}
                  labelFormatter={(label) => formatDate(label as string)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {TREND_LINES.map((tl) => (
                  <Line
                    key={tl.key}
                    type="monotone"
                    dataKey={tl.key}
                    name={tl.label}
                    stroke={tl.color}
                    dot={score_trend.length <= 20}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Personal bests */}
        {personal_bests.length > 0 && (
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Personal Bests</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {personal_bests.map((pb) => (
                <button
                  key={pb.category}
                  onClick={() => navigate(`/flights/${pb.flight_id}`)}
                  className="text-left p-2.5 rounded-lg border border-[#2a3a54] hover:bg-[#1e2a3a] transition-colors"
                >
                  <p className="text-xs text-[#6b7fa3]">{CATEGORY_LABELS[pb.category] ?? pb.category}</p>
                  <p className={`text-lg font-bold mt-0.5 ${scoreColor(pb.value)}`}>
                    {pb.value.toFixed(1)}
                  </p>
                  <p className="text-xs text-[#4a5a74] mt-0.5">{formatDate(pb.flight_date)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent flights */}
        {recent_flights.length > 0 && (
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Recent Flights</h2>
            <ul className="divide-y divide-[#1e2a3a]">
              {recent_flights.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => navigate(`/flights/${f.id}`)}
                    className="w-full text-left py-3 hover:bg-[#1e2a3a] transition-colors px-1 rounded-lg flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm truncate">
                        {f.title ?? f.original_filename}
                      </p>
                      <p className="text-xs text-[#6b7fa3] mt-0.5">
                        {typeof f.flight_date === 'string'
                          ? formatDate(f.flight_date)
                          : formatDate(new Date(f.flight_date).toISOString().split('T')[0])}
                        {f.glider ? ` · ${f.glider}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-xs text-[#6b7fa3] shrink-0 space-y-0.5">
                      <p>{formatDuration(f.duration_seconds)}</p>
                      <p>{formatDistance(f.total_distance_m)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {total_flights === 0 && (
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-8 text-center">
            <p className="text-[#6b7fa3]">No analyzed flights yet for this pilot.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-4">
      <p className="text-xs text-[#6b7fa3]">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ?? 'text-white'}`}>{value}</p>
    </div>
  );
}
