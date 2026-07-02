import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeaderboard, LeaderboardCategory, LeaderboardPeriod } from '../hooks/useLeaderboards';

const CATEGORIES: { id: LeaderboardCategory; label: string }[] = [
  { id: 'overall', label: 'Overall' },
  { id: 'takeoff', label: 'Takeoff' },
  { id: 'climb', label: 'Climb' },
  { id: 'level', label: 'Level Flight' },
  { id: 'turn', label: 'Turns' },
  { id: 'descent', label: 'Descent' },
  { id: 'landing', label: 'Landing' },
  { id: 'smoothness', label: 'Smoothness' },
  { id: 'safety', label: 'Safety' },
  { id: 'most_improved', label: 'Most Improved' },
];

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'alltime', label: 'All Time' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'season', label: 'This Season' },
];

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500 text-white';
  if (score >= 60) return 'bg-yellow-400 text-yellow-900';
  return 'bg-red-400 text-white';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export default function Leaderboards() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<LeaderboardCategory>('overall');
  const [period, setPeriod] = useState<LeaderboardPeriod>('alltime');

  const { data: entries = [], isLoading, error } = useLeaderboard(category, period);

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
          <h1 className="text-lg font-bold text-white">Leaderboards</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Period filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                period === p.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#141d2e] text-[#6b7fa3] border border-[#2a3a54] hover:bg-[#1e2a3a]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                category === c.id
                  ? 'bg-[#1e2a3a] text-white'
                  : 'bg-[#141d2e] text-[#6b7fa3] border border-[#2a3a54] hover:bg-[#1e2a3a]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] overflow-hidden">
          {isLoading && (
            <div className="p-8 text-center text-[#6b7fa3] animate-pulse">Loading…</div>
          )}

          {error && (
            <div className="p-8 text-center text-red-400">Failed to load leaderboard.</div>
          )}

          {!isLoading && !error && entries.length === 0 && (
            <div className="p-8 text-center text-[#6b7fa3]">
              <svg className="w-12 h-12 mx-auto mb-3 text-[#2a3a54]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="font-medium text-white">No data yet</p>
              <p className="text-sm mt-1">Upload and analyze flights to appear on the leaderboard.</p>
            </div>
          )}

          {!isLoading && !error && entries.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1e2a3a] border-b border-[#2a3a54]">
                  <th className="py-2.5 px-3 text-left font-semibold text-[#a0b3cc] w-12">Rank</th>
                  <th className="py-2.5 px-3 text-left font-semibold text-[#a0b3cc]">Pilot</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-[#a0b3cc]">Score</th>
                  {category === 'most_improved' && (
                    <th className="py-2.5 px-3 text-right font-semibold text-[#a0b3cc]">+Pts</th>
                  )}
                  <th className="py-2.5 px-3 text-right font-semibold text-[#a0b3cc] hidden sm:table-cell">Date</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-[#a0b3cc] hidden sm:table-cell">Glider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a3a]">
                {entries.map((entry) => (
                  <tr key={entry.flight_id} className="hover:bg-[#1e2a3a] transition-colors">
                    <td className="py-3 px-3 text-center font-bold text-white">
                      {rankMedal(entry.rank)}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => navigate(`/pilots/${entry.pilot.id}`)}
                        className="font-semibold text-blue-400 hover:underline text-left"
                      >
                        {entry.pilot.display_name}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => navigate(`/flights/${entry.flight_id}`)}
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${scoreColor(entry.score)}`}
                      >
                        {entry.score.toFixed(1)}
                      </button>
                    </td>
                    {category === 'most_improved' && (
                      <td className="py-3 px-3 text-right">
                        <span className="text-green-400 font-semibold">
                          +{entry.improvement?.toFixed(1) ?? '—'}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-3 text-right text-[#6b7fa3] hidden sm:table-cell">
                      {formatDate(entry.flight_date)}
                    </td>
                    <td className="py-3 px-3 text-right text-[#6b7fa3] hidden sm:table-cell truncate max-w-[8rem]">
                      {entry.glider ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
