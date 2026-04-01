import { FlightScore } from '../../hooks/useFlights';
import CoachingNotes from './CoachingNotes';

interface FlightScoreCardProps {
  score: FlightScore;
  confidenceScore?: number | null;
}

const CATEGORIES: { key: keyof FlightScore; label: string }[] = [
  { key: 'takeoff_score', label: 'Takeoff' },
  { key: 'climb_score', label: 'Climb' },
  { key: 'level_score', label: 'Level Flight' },
  { key: 'turn_score', label: 'Turns' },
  { key: 'descent_score', label: 'Descent' },
  { key: 'landing_score', label: 'Landing' },
  { key: 'smoothness_score', label: 'Smoothness' },
  { key: 'safety_score', label: 'Safety' },
];

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-500';
}

function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-400';
  return 'bg-red-400';
}

function overallRing(score: number): string {
  if (score >= 80) return 'border-green-500 text-green-700';
  if (score >= 60) return 'border-yellow-400 text-yellow-700';
  return 'border-red-400 text-red-600';
}

export default function FlightScoreCard({ score, confidenceScore }: FlightScoreCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-elevation border border-sky-midday/30 p-5 space-y-5">
      {/* Overall score */}
      <div className="flex items-center gap-5">
        <div
          className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shrink-0 ${overallRing(score.overall_score)}`}
        >
          <span className="text-2xl font-bold leading-none">{score.overall_score}</span>
          <span className="text-xs font-medium">/ 100</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-sky-night">Flight Score</h3>
          <p className="text-sm text-sky-dusk">v{score.scoring_version}</p>
          {confidenceScore !== null && confidenceScore !== undefined && (
            <p className="text-xs text-sky-dusk mt-1">
              GPS confidence:{' '}
              <span className={confidenceScore < 0.4 ? 'text-red-500 font-medium' : 'text-sky-dusk'}>
                {Math.round(confidenceScore * 100)}%
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Category scores */}
      <div className="space-y-2">
        {CATEGORIES.map(({ key, label }) => {
          const val = score[key] as number | null;
          if (val === null || val === undefined) return null;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-24 text-xs text-sky-dusk shrink-0">{label}</span>
              <div className="flex-1 bg-sky-cloud rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${scoreBarColor(val)}`}
                  style={{ width: `${val}%` }}
                />
              </div>
              <span className={`w-8 text-right text-xs font-semibold ${scoreColor(val)}`}>
                {val}
              </span>
            </div>
          );
        })}
      </div>

      {/* Coaching notes */}
      {score.explanation_json?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-sky-night mb-2">Coaching Notes</h4>
          <CoachingNotes notes={score.explanation_json} />
        </div>
      )}
    </div>
  );
}
