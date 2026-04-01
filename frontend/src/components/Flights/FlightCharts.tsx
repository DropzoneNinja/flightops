/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useEffect, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { Trackpoint, FlightEvent, FlightScore } from '../../services/flights.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function subsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = arr.length / maxPoints;
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  return result;
}

// ─── Chart data ───────────────────────────────────────────────────────────────

interface ChartPoint {
  elapsed: number;
  originalIndex: number;
  altitude_ft: number | null;
  speed_kmh: number | null;
  vspeed_mps: number | null;
}

function buildChartData(trackpoints: Trackpoint[]): ChartPoint[] {
  if (trackpoints.length === 0) return [];
  const sampled = subsample(trackpoints, 400);
  const firstTs = sampled[0].timestamp ? new Date(sampled[0].timestamp).getTime() : null;

  return sampled.map((tp, i) => {
    let elapsed = i;
    if (firstTs !== null && tp.timestamp) {
      elapsed = (new Date(tp.timestamp).getTime() - firstTs) / 1000;
    }
    return {
      elapsed,
      originalIndex: tp.seq ?? i,
      altitude_ft: tp.elevation_m !== null ? +( tp.elevation_m * 3.28084).toFixed(0) : null,
      speed_kmh: tp.speed_mps !== null ? +(tp.speed_mps * 3.6).toFixed(1) : null,
      vspeed_mps: tp.vertical_speed_mps !== null ? +tp.vertical_speed_mps.toFixed(2) : null,
    };
  });
}

interface EventRefLine {
  elapsed: number;
  label: string;
}

function buildEventLines(events: FlightEvent[], firstTimestamp: string | null): EventRefLine[] {
  if (!firstTimestamp) return [];
  const firstTs = new Date(firstTimestamp).getTime();
  return events
    .filter((e) => e.timestamp !== null)
    .map((e) => ({
      elapsed: (new Date(e.timestamp!).getTime() - firstTs) / 1000,
      label: formatEventType(e.event_type),
    }));
}

const timeTickFormatter = (val: number) => formatMinutes(val);

// ─── Chart props & shared mouse handlers ─────────────────────────────────────

interface ChartProps {
  data: ChartPoint[];
  eventLines?: EventRefLine[];
  activeElapsed?: number | null;
  pinnedElapsed?: number | null;
  onHover?: (elapsed: number | null, originalIndex: number | null) => void;
  onClick?: (elapsed: number | null, originalIndex: number | null) => void;
}

function makeMouseHandlers(
  onHover?: (e: number | null, i: number | null) => void,
  onClick?: (e: number | null, i: number | null) => void,
) {
  return {
    onMouseMove: (state: any) => {
      if (onHover && state?.isTooltipActive && state?.activePayload?.length) {
        const d = state.activePayload[0].payload as ChartPoint;
        onHover(d.elapsed, d.originalIndex);
      }
    },
    onMouseLeave: () => onHover?.(null, null),
    onClick: (state: any) => {
      if (onClick && state?.activePayload?.length) {
        const d = state.activePayload[0].payload as ChartPoint;
        onClick(d.elapsed, d.originalIndex);
      }
    },
  };
}

// ─── Overlay position line ────────────────────────────────────────────────────
// Instead of using Recharts ReferenceLine (which forces the entire chart SVG to
// re-render on every position update), we position an absolutely-placed div on
// top of the chart and move it via direct DOM manipulation.  The inner chart
// component is memoized so it never re-renders due to position changes alone.

function nearestPoint(elapsed: number | null | undefined, data: ChartPoint[]): ChartPoint | null {
  if (elapsed == null || data.length === 0) return null;
  let closest = data[0];
  let minDiff = Math.abs(data[0].elapsed - elapsed);
  for (const d of data) {
    const diff = Math.abs(d.elapsed - elapsed);
    if (diff < minDiff) { minDiff = diff; closest = d; }
  }
  return closest;
}

function elapsedToLeft(
  elapsed: number | null | undefined,
  data: ChartPoint[],
  yAxisWidth: number,
  containerWidth: number,
  rightMargin = 8,
): number | null {
  if (elapsed == null || data.length === 0 || containerWidth === 0) return null;
  const minE = data[0].elapsed;
  const maxE = data[data.length - 1].elapsed;
  if (maxE === minE) return null;
  const fraction = Math.max(0, Math.min(1, (elapsed - minE) / (maxE - minE)));
  return yAxisWidth + fraction * (containerWidth - rightMargin - yAxisWidth);
}

interface OverlayChartProps {
  height: number;
  yAxisWidth: number;
  activeElapsed: number | null | undefined;
  pinnedElapsed: number | null | undefined;
  activeValue?: string | null;
  pinnedValue?: string | null;
  data: ChartPoint[];
  children: React.ReactNode;
}

function OverlayChart({ height, yAxisWidth, activeElapsed, pinnedElapsed, activeValue, pinnedValue, data, children }: OverlayChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const activeLabelRef = useRef<HTMLDivElement>(null);
  const pinnedLineRef = useRef<HTMLDivElement>(null);
  const pinnedLabelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const left = elapsedToLeft(activeElapsed, data, yAxisWidth, containerWidth);
    const lineEl = activeLineRef.current;
    const labelEl = activeLabelRef.current;
    if (left != null) {
      if (lineEl) { lineEl.style.display = 'block'; lineEl.style.left = `${left}px`; }
      if (labelEl && activeValue != null) {
        labelEl.style.display = 'block';
        labelEl.style.left = `${left}px`;
        labelEl.textContent = activeValue;
      } else if (labelEl) {
        labelEl.style.display = 'none';
      }
    } else {
      if (lineEl) lineEl.style.display = 'none';
      if (labelEl) labelEl.style.display = 'none';
    }
  }, [activeElapsed, activeValue, data, yAxisWidth, containerWidth]);

  useEffect(() => {
    const left = elapsedToLeft(pinnedElapsed, data, yAxisWidth, containerWidth);
    const lineEl = pinnedLineRef.current;
    const labelEl = pinnedLabelRef.current;
    if (left != null) {
      if (lineEl) { lineEl.style.display = 'block'; lineEl.style.left = `${left}px`; }
      if (labelEl && pinnedValue != null) {
        labelEl.style.display = 'block';
        labelEl.style.left = `${left}px`;
        labelEl.textContent = pinnedValue;
      } else if (labelEl) {
        labelEl.style.display = 'none';
      }
    } else {
      if (lineEl) lineEl.style.display = 'none';
      if (labelEl) labelEl.style.display = 'none';
    }
  }, [pinnedElapsed, pinnedValue, data, yAxisWidth, containerWidth]);

  const labelBase: React.CSSProperties = {
    position: 'absolute',
    top: 6,
    transform: 'translateX(-50%)',
    borderRadius: 3,
    padding: '1px 4px',
    fontSize: 10,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    display: 'none',
    pointerEvents: 'none',
    zIndex: 11,
  };

  return (
    <div ref={wrapperRef} style={{ height, position: 'relative' }}>
      {children}
      {/* Pinned position line (amber) */}
      <div
        ref={pinnedLineRef}
        style={{
          position: 'absolute',
          top: 4,
          bottom: 20,
          width: 2,
          backgroundColor: '#f59e0b',
          display: 'none',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
      {/* Pinned value label */}
      <div
        ref={pinnedLabelRef}
        style={{ ...labelBase, color: '#b45309', background: 'rgba(255,255,255,0.92)', border: '1px solid #f59e0b' }}
      />
      {/* Active/hover position line (cyan dashed) */}
      <div
        ref={activeLineRef}
        style={{
          position: 'absolute',
          top: 4,
          bottom: 20,
          width: 2,
          backgroundImage: 'repeating-linear-gradient(to bottom, #0ea5e9 0, #0ea5e9 4px, transparent 4px, transparent 6px)',
          display: 'none',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
      {/* Active value label */}
      <div
        ref={activeLabelRef}
        style={{ ...labelBase, color: '#0369a1', background: 'rgba(255,255,255,0.92)', border: '1px solid #0ea5e9' }}
      />
    </div>
  );
}

// ─── Altitude chart ───────────────────────────────────────────────────────────

type InnerChartProps = Omit<ChartProps, 'activeElapsed' | 'pinnedElapsed'>;

const AltitudeChartInner = React.memo(function AltitudeChartInner({
  data, eventLines = [], onHover, onClick,
}: InnerChartProps) {
  const handlers = makeMouseHandlers(onHover, onClick);
  return (
    <ResponsiveContainer width="100%" height={130}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} {...handlers}>
        <defs>
          <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="elapsed" tickFormatter={timeTickFormatter} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} width={42} />
        <Tooltip
          formatter={(v: any) => [`${Number(v).toFixed(0)} ft`, 'Altitude']}
          labelFormatter={(v: any) => `T+${formatMinutes(Number(v))}`}
          contentStyle={{ fontSize: 11 }}
        />
        {eventLines.map((el, i) => (
          <ReferenceLine key={i} x={el.elapsed} stroke="#94a3b8" strokeDasharray="4 2" />
        ))}
        <Area type="monotone" dataKey="altitude_ft" stroke="#3b82f6" strokeWidth={1.5} fill="url(#altGrad)" dot={false} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
});

function AltitudeChart({ data, eventLines = [], activeElapsed, pinnedElapsed, onHover, onClick }: ChartProps) {
  if (!data.some((d) => d.altitude_ft !== null)) return null;
  const av = nearestPoint(activeElapsed, data)?.altitude_ft;
  const pv = nearestPoint(pinnedElapsed, data)?.altitude_ft;
  return (
    <div>
      <p className="text-xs font-medium text-sky-dusk mb-1">Altitude (ft AMSL)</p>
      <OverlayChart height={130} yAxisWidth={42} activeElapsed={activeElapsed} pinnedElapsed={pinnedElapsed}
        activeValue={av != null ? `${av.toLocaleString()} ft` : null}
        pinnedValue={pv != null ? `${pv.toLocaleString()} ft` : null}
        data={data}>
        <AltitudeChartInner data={data} eventLines={eventLines} onHover={onHover} onClick={onClick} />
      </OverlayChart>
    </div>
  );
}

// ─── Speed chart ──────────────────────────────────────────────────────────────

const SpeedChartInner = React.memo(function SpeedChartInner({
  data, eventLines = [], onHover, onClick,
}: InnerChartProps) {
  const handlers = makeMouseHandlers(onHover, onClick);
  return (
    <ResponsiveContainer width="100%" height={110}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} {...handlers}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="elapsed" tickFormatter={timeTickFormatter} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} width={38} />
        <Tooltip
          formatter={(v: any) => [`${Number(v).toFixed(1)} km/h`, 'Speed']}
          labelFormatter={(v: any) => `T+${formatMinutes(Number(v))}`}
          contentStyle={{ fontSize: 11 }}
        />
        {eventLines.map((el, i) => (
          <ReferenceLine key={i} x={el.elapsed} stroke="#94a3b8" strokeDasharray="4 2" />
        ))}
        <Line type="monotone" dataKey="speed_kmh" stroke="#f97316" strokeWidth={1.5} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
});

function SpeedChart({ data, eventLines = [], activeElapsed, pinnedElapsed, onHover, onClick }: ChartProps) {
  if (!data.some((d) => d.speed_kmh !== null)) return null;
  const av = nearestPoint(activeElapsed, data)?.speed_kmh;
  const pv = nearestPoint(pinnedElapsed, data)?.speed_kmh;
  return (
    <div>
      <p className="text-xs font-medium text-sky-dusk mb-1">Ground Speed (km/h)</p>
      <OverlayChart height={110} yAxisWidth={38} activeElapsed={activeElapsed} pinnedElapsed={pinnedElapsed}
        activeValue={av != null ? `${av.toFixed(1)} km/h` : null}
        pinnedValue={pv != null ? `${pv.toFixed(1)} km/h` : null}
        data={data}>
        <SpeedChartInner data={data} eventLines={eventLines} onHover={onHover} onClick={onClick} />
      </OverlayChart>
    </div>
  );
}

// ─── Vertical speed chart ─────────────────────────────────────────────────────

const VerticalSpeedChartInner = React.memo(function VerticalSpeedChartInner({
  data, eventLines = [], onHover, onClick,
}: InnerChartProps) {
  const handlers = makeMouseHandlers(onHover, onClick);
  return (
    <ResponsiveContainer width="100%" height={110}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} {...handlers}>
        <defs>
          <linearGradient id="vsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="50%" stopColor="#22c55e" stopOpacity={0.05} />
            <stop offset="95%" stopColor="#ef4444"  stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="elapsed" tickFormatter={timeTickFormatter} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} width={38} />
        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
        <Tooltip
          formatter={(v: any) => {
            const n = Number(v);
            return [`${n > 0 ? '+' : ''}${n.toFixed(1)} m/s`, 'Vert. speed'];
          }}
          labelFormatter={(v: any) => `T+${formatMinutes(Number(v))}`}
          contentStyle={{ fontSize: 11 }}
        />
        {eventLines.map((el, i) => (
          <ReferenceLine key={i} x={el.elapsed} stroke="#94a3b8" strokeDasharray="4 2" />
        ))}
        <Area type="monotone" dataKey="vspeed_mps" stroke="#22c55e" strokeWidth={1.5} fill="url(#vsGrad)" dot={false} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
});

function VerticalSpeedChart({ data, eventLines = [], activeElapsed, pinnedElapsed, onHover, onClick }: ChartProps) {
  if (!data.some((d) => d.vspeed_mps !== null)) return null;
  const av = nearestPoint(activeElapsed, data)?.vspeed_mps;
  const pv = nearestPoint(pinnedElapsed, data)?.vspeed_mps;
  const fmtVs = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} m/s`;
  return (
    <div>
      <p className="text-xs font-medium text-sky-dusk mb-1">Vertical Speed (m/s)</p>
      <OverlayChart height={110} yAxisWidth={38} activeElapsed={activeElapsed} pinnedElapsed={pinnedElapsed}
        activeValue={av != null ? fmtVs(av) : null}
        pinnedValue={pv != null ? fmtVs(pv) : null}
        data={data}>
        <VerticalSpeedChartInner data={data} eventLines={eventLines} onHover={onHover} onClick={onClick} />
      </OverlayChart>
    </div>
  );
}

// ─── Score breakdown bar ──────────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score);
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-sky-dusk text-right">{label}</span>
      <div className="flex-1 bg-sky-cloud rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-7 text-sky-night font-medium">{pct}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface FlightChartsProps {
  trackpoints: Trackpoint[];
  events?: FlightEvent[];
  score?: FlightScore | null;
  activePointIndex?: number | null;
  onPointHover?: (originalIndex: number | null) => void;
  pinnedPointIndex?: number | null;
  onPointClick?: (originalIndex: number | null) => void;
}

export default function FlightCharts({
  trackpoints,
  events = [],
  score,
  activePointIndex,
  onPointHover,
  pinnedPointIndex,
  onPointClick,
}: FlightChartsProps) {
  const chartData = buildChartData(trackpoints);
  const firstTimestamp = trackpoints[0]?.timestamp ?? null;
  const eventLines = buildEventLines(events, firstTimestamp);

  // Convert activePointIndex → elapsed for chart reference line.
  // Compute directly from the trackpoint timestamp so the line moves smoothly
  // even when the chart is subsampled (exact index match would flash).
  let activeElapsed: number | null = null;
  if (activePointIndex != null && trackpoints[activePointIndex] != null) {
    const firstTs = trackpoints[0]?.timestamp ? new Date(trackpoints[0].timestamp).getTime() : null;
    const tp = trackpoints[activePointIndex];
    if (firstTs !== null && tp.timestamp) {
      activeElapsed = (new Date(tp.timestamp).getTime() - firstTs) / 1000;
    } else if (chartData.length > 0) {
      // No timestamps: snap to nearest subsampled point by index proximity
      const closest = chartData.reduce((best, d) =>
        Math.abs(d.originalIndex - activePointIndex) < Math.abs(best.originalIndex - activePointIndex) ? d : best,
      );
      activeElapsed = closest.elapsed;
    }
  }

  // Convert pinnedPointIndex → elapsed for pinned reference line
  let pinnedElapsed: number | null = null;
  if (pinnedPointIndex != null && chartData.length > 0) {
    const pinnedSeq = trackpoints[pinnedPointIndex]?.seq;
    if (pinnedSeq != null) {
      const match = chartData.find((d) => d.originalIndex === pinnedSeq);
      pinnedElapsed = match?.elapsed ?? null;
    }
  }

  const handleHover = (_elapsed: number | null, originalIndex: number | null) => {
    onPointHover?.(originalIndex);
  };

  const handleClick = (_elapsed: number | null, seq: number | null) => {
    if (seq == null) { onPointClick?.(null); return; }
    const idx = trackpoints.findIndex((tp) => tp.seq === seq);
    onPointClick?.(idx >= 0 ? idx : null);
  };

  if (chartData.length === 0) {
    return <div className="text-sm text-sky-dusk text-center py-6">No track data for charts.</div>;
  }

  const commonProps: ChartProps = {
    data: chartData,
    eventLines,
    activeElapsed,
    pinnedElapsed,
    onHover: handleHover,
    onClick: handleClick,
  };

  return (
    <div className="space-y-5">
      <AltitudeChart {...commonProps} />
      <SpeedChart {...commonProps} />
      <VerticalSpeedChart {...commonProps} />

      {score && (
        <div>
          <p className="text-xs font-medium text-sky-dusk mb-2">Score Breakdown</p>
          <div className="space-y-1.5">
            <ScoreBar label="Takeoff"    score={score.takeoff_score} />
            <ScoreBar label="Climb"      score={score.climb_score} />
            <ScoreBar label="Level"      score={score.level_score} />
            <ScoreBar label="Turns"      score={score.turn_score} />
            <ScoreBar label="Descent"    score={score.descent_score} />
            <ScoreBar label="Landing"    score={score.landing_score} />
            <ScoreBar label="Smoothness" score={score.smoothness_score} />
            <ScoreBar label="Safety"     score={score.safety_score} />
          </div>
        </div>
      )}
    </div>
  );
}
