import type { Trackpoint } from '../../services/flights.service';

// ─── Phase config ────────────────────────────────────────────────────────────
const PHASE_COLORS: Record<string, string> = {
  pre_takeoff:  '#94a3b8',
  takeoff:      '#84cc16',
  climb:        '#22c55e',
  cruise:       '#3b82f6',
  turn:         '#a855f7',
  descent:      '#f97316',
  approach:     '#f59e0b',
  landing:      '#ef4444',
  post_landing: '#94a3b8',
  unknown:      '#64748b',
};

const PHASE_LABELS: Record<string, string> = {
  pre_takeoff:  'Pre-takeoff',
  takeoff:      'Takeoff',
  climb:        'Climb',
  cruise:       'Cruise',
  turn:         'Turn',
  descent:      'Descent',
  approach:     'Approach',
  landing:      'Landing',
  post_landing: 'Post-landing',
  unknown:      'Unknown',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

interface PhaseSegment {
  phase: string;
  durationSeconds: number;
  startSeconds: number;
}

function buildPhaseSegments(trackpoints: Trackpoint[]): { segments: PhaseSegment[]; totalSeconds: number } {
  if (trackpoints.length < 2) return { segments: [], totalSeconds: 0 };

  const firstTs = trackpoints[0].timestamp ? new Date(trackpoints[0].timestamp).getTime() : null;
  const lastTs = trackpoints[trackpoints.length - 1].timestamp
    ? new Date(trackpoints[trackpoints.length - 1].timestamp!).getTime()
    : null;

  // If no timestamps, fall back to point-count proportions
  const hasTimestamps = firstTs !== null && lastTs !== null;
  const totalSeconds = hasTimestamps ? (lastTs! - firstTs!) / 1000 : trackpoints.length;

  const segments: PhaseSegment[] = [];
  let currentPhase = trackpoints[0].phase;
  let segStart = 0; // seconds or index

  const getOffset = (i: number): number => {
    if (hasTimestamps && trackpoints[i].timestamp) {
      return (new Date(trackpoints[i].timestamp!).getTime() - firstTs!) / 1000;
    }
    return i;
  };

  for (let i = 1; i < trackpoints.length; i++) {
    if (trackpoints[i].phase !== currentPhase) {
      const segEnd = getOffset(i);
      segments.push({ phase: currentPhase, durationSeconds: segEnd - segStart, startSeconds: segStart });
      currentPhase = trackpoints[i].phase;
      segStart = segEnd;
    }
  }
  // Last segment
  segments.push({ phase: currentPhase, durationSeconds: totalSeconds - segStart, startSeconds: segStart });

  return { segments, totalSeconds };
}

// ─── Main component ──────────────────────────────────────────────────────────
export interface PhaseTimelineProps {
  trackpoints: Trackpoint[];
}

export default function PhaseTimeline({ trackpoints }: PhaseTimelineProps) {
  const { segments, totalSeconds } = buildPhaseSegments(trackpoints);

  if (segments.length === 0) {
    return <p className="text-sm text-sky-dusk text-center py-2">No phase data available.</p>;
  }

  // Merge tiny adjacent segments of the same phase that might appear from edge cases
  const merged: PhaseSegment[] = [];
  for (const seg of segments) {
    if (merged.length > 0 && merged[merged.length - 1].phase === seg.phase) {
      merged[merged.length - 1].durationSeconds += seg.durationSeconds;
    } else {
      merged.push({ ...seg });
    }
  }

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="flex h-6 rounded-lg overflow-hidden gap-px">
        {merged.map((seg, i) => {
          const widthPct = totalSeconds > 0 ? (seg.durationSeconds / totalSeconds) * 100 : 0;
          if (widthPct < 0.5) return null; // skip tiny slivers
          return (
            <div
              key={i}
              style={{ width: `${widthPct}%`, background: PHASE_COLORS[seg.phase] ?? PHASE_COLORS.unknown }}
              title={`${PHASE_LABELS[seg.phase] ?? seg.phase}: ${formatDuration(seg.durationSeconds)}`}
              className="h-full transition-opacity hover:opacity-80 cursor-default"
            />
          );
        })}
      </div>

      {/* Legend rows */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {merged
          .filter((seg) => (totalSeconds > 0 ? seg.durationSeconds / totalSeconds >= 0.005 : true))
          .map((seg, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: PHASE_COLORS[seg.phase] ?? PHASE_COLORS.unknown }}
              />
              <span className="text-sky-night font-medium">{PHASE_LABELS[seg.phase] ?? seg.phase}</span>
              <span className="text-sky-dusk">{formatDuration(seg.durationSeconds)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
