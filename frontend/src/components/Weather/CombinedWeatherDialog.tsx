import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WeatherForecast, MultiHeightHourlyData } from '../../services/weather.service';
import { useMultiHeightWeather } from '../../hooks/useMultiHeightWeather';
import { useSettings } from '../../hooks/useSettings';
import { SettingKey } from '../../services/settings.service';
import { scoreToHeatColor } from '../../utils/colorInterpolation';
import { convertWindSpeed, windSpeedUnitLabel } from '../../utils/windSpeed';

interface CombinedWeatherDialogProps {
  forecast: WeatherForecast | null;
  forecasts: WeatherForecast[];
  siteId: string;
  siteName: string;
  onClose: () => void;
  onForecastChange: (forecast: WeatherForecast) => void;
  onHourSelect?: (windDirection: number, windSpeed: number) => void;
}

const BG = '#161b2e';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED = '#6b7280';

function windTriangle(degrees: number): string {
  const going = (degrees + 180) % 360;
  const i = Math.floor((going + 22.5) / 45) % 8;
  return ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][i];
}

function windDir16(degrees: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(((degrees % 360) / 22.5)) % 16];
}

function scoreBadge(score: number): { bg: string; color: string } {
  if (score >= 76) return { bg: '#22c55e', color: '#fff' };
  if (score >= 51) return { bg: '#84cc16', color: '#000' };
  if (score >= 26) return { bg: '#f59e0b', color: '#000' };
  return { bg: '#ef4444', color: '#fff' };
}

function ceilingColor(cloudBase: number | null | undefined): string {
  if (cloudBase == null) return MUTED;
  if (cloudBase < 500) return '#ef4444';
  if (cloudBase < 1000) return '#f97316';
  if (cloudBase < 2000) return '#f59e0b';
  return '#22c55e';
}

function coverColor(cloudCover: number | null | undefined): string {
  if (cloudCover == null) return MUTED;
  if (cloudCover >= 75) return '#ef4444';
  if (cloudCover >= 50) return '#f97316';
  if (cloudCover >= 25) return '#f59e0b';
  return '#22c55e';
}

function windSpeedColor(
  speedKmh: number,
  tooCalmMax: number,
  optimalMax: number,
  marginalMax: number,
  highRiskMax: number,
): string {
  if (speedKmh <= tooCalmMax) return '#f59e0b';
  if (speedKmh <= optimalMax) return '#22c55e';
  if (speedKmh <= marginalMax) return '#f59e0b';
  if (speedKmh <= highRiskMax) return '#f97316';
  return '#ef4444';
}

function dayLabel(dateString: string): string {
  const utcDate = new Date(dateString).toISOString().split('T')[0];
  const now = new Date();
  const todayUtc = now.toISOString().split('T')[0];
  const tomorrowUtc = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  if (utcDate === todayUtc) return 'Today';
  if (utcDate === tomorrowUtc) return 'Tomorrow';
  return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long' });
}

function navLabel(dateString: string): string {
  const utcDate = new Date(dateString).toISOString().split('T')[0];
  const now = new Date();
  const todayUtc = now.toISOString().split('T')[0];
  const tomorrowUtc = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  if (utcDate === todayUtc) return 'Today';
  if (utcDate === tomorrowUtc) return 'Tomorrow';
  return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function CombinedWeatherDialog({
  forecast,
  forecasts,
  siteId,
  siteName,
  onClose,
  onForecastChange,
  onHourSelect,
}: CombinedWeatherDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (forecast) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [forecast, onClose]);

  useEffect(() => {
    setSelectedTimestamp(null);
  }, [forecast?.date]);

  useEffect(() => {
    const el = backdropRef.current;
    if (!el || !forecast) return;
    const onWheel = (e: WheelEvent) => {
      if (e.target === el) { e.preventDefault(); e.stopPropagation(); }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [forecast]);

  const dateString = forecast?.date
    ? new Date(forecast.date).toISOString().split('T')[0]
    : null;

  const { data: multiData, isLoading: isLoadingMulti } = useMultiHeightWeather(siteId, dateString);
  const { settingsMap } = useSettings();
  const gustThreshold = (settingsMap[SettingKey.GUST_SMOOTH_MAX] as number) || 15;
  const windUnit = (settingsMap[SettingKey.UNITS_WIND_SPEED] as string) || 'kmh';
  const windTooCalmMax = (settingsMap[SettingKey.WIND_TOO_CALM] as number) ?? 3;
  const windOptimalMax = (settingsMap[SettingKey.WIND_OPTIMAL_MAX] as number) ?? 12;
  const windMarginalMax = (settingsMap[SettingKey.WIND_MARGINAL_MAX] as number) ?? 18;
  const windHighRiskMax = (settingsMap[SettingKey.WIND_HIGH_RISK_MAX] as number) ?? 24;

  const filteredHours = useMemo(() => {
    if (!forecast) return [];
    const sunriseHour = parseInt(forecast.sunrise.split(':')[0]);
    const sunsetHour = parseInt(forecast.sunset.split(':')[0]);
    return forecast.hourlyData.filter((h) => {
      const hour = new Date(h.timestamp).getHours();
      return hour >= sunriseHour && hour <= sunsetHour;
    });
  }, [forecast]);

  const multiByTimestamp = useMemo((): Record<string, MultiHeightHourlyData> => {
    if (!multiData) return {};
    return Object.fromEntries(multiData.hourlyData.map((h) => [h.timestamp, h]));
  }, [multiData]);

  if (!forecast) return null;

  const temps = forecast.hourlyData.map((d) => Number(d.temperature));
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const totalRain = forecast.hourlyData.reduce((s, d) => s + Number(d.rain), 0);

  const currentIdx = forecasts.findIndex((f) => f.id === forecast.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < forecasts.length - 1;

  const label = dayLabel(forecast.date);
  const nav = navLabel(forecast.date);
  const subDate = new Date(forecast.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const modal = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ isolation: 'isolate', pointerEvents: 'auto' }}
    >
      <div
        className="rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col relative z-10 overflow-hidden"
        style={{ backgroundColor: BG, border: `1px solid ${BORDER}`, pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">{siteName}</span>
              <span className="text-sm" style={{ color: MUTED }}>Hourly forecast</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Day nav pill */}
              <div className="flex items-center rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => hasPrev && onForecastChange(forecasts[currentIdx - 1])}
                  disabled={!hasPrev}
                  className="px-3 py-1.5 text-base leading-none transition-opacity"
                  style={{ color: hasPrev ? '#fff' : 'rgba(255,255,255,0.2)', cursor: hasPrev ? 'pointer' : 'default' }}
                >
                  ‹
                </button>
                <span
                  className="px-3 py-1.5 text-sm font-medium text-white"
                  style={{ borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}
                >
                  {nav}
                </span>
                <button
                  onClick={() => hasNext && onForecastChange(forecasts[currentIdx + 1])}
                  disabled={!hasNext}
                  className="px-3 py-1.5 text-base leading-none transition-opacity"
                  style={{ color: hasNext ? '#fff' : 'rgba(255,255,255,0.2)', cursor: hasNext ? 'pointer' : 'default' }}
                >
                  ›
                </button>
              </div>
              {/* Close */}
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white hover:bg-opacity-10"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Sub-header info row */}
          <div className="flex items-center justify-between mt-2 flex-wrap gap-y-1">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {label} · {subDate}
              </span>
              <span style={{ color: MUTED }}>☀ {forecast.sunrise} – {forecast.sunset}</span>
              <span style={{ color: MUTED }}>🌡 {minTemp.toFixed(1)}°C – {maxTemp.toFixed(1)}°C</span>
              <span style={{ color: MUTED }}>🌧 {totalRain.toFixed(1)} mm</span>
            </div>
            <span className="text-xs" style={{ color: MUTED }}>winds aloft · ft AGL</span>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto min-h-0">
          <style>{`
            .cwd-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
            .cwd-scroll::-webkit-scrollbar-track { background: transparent; }
            .cwd-scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
            .cwd-scroll::-webkit-scrollbar-thumb:hover { background: #4b5563; }
          `}</style>
          <div className="cwd-scroll overflow-auto h-full">
            <table className="border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.03)' }}>
                  {['Time', 'Score', 'Temp', 'Surface Wind', 'Rain', 'Ceiling', 'Cover', '33 ft', '262 ft', '394 ft'].map((h, i) => (
                    <th
                      key={h}
                      className="py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      style={{
                        color: MUTED,
                        paddingLeft: i === 0 ? '20px' : '12px',
                        paddingRight: i === 9 ? '20px' : '12px',
                        textAlign: ['Score', '33 ft', '262 ft', '394 ft'].includes(h) ? 'center' : i <= 2 || i >= 4 ? 'right' : 'left',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHours.map((data, idx) => {
                  const time = new Date(data.timestamp).toLocaleTimeString([], {
                    hour: 'numeric', minute: '2-digit', hour12: true,
                  });
                  const badge = scoreBadge(data.overallScore);
                  const borderCol = scoreToHeatColor(data.overallScore);
                  const ceil = data.cloudBase;
                  const ceilCol = ceilingColor(ceil);
                  const covCol = coverColor(data.cloudCover);
                  const tri = windTriangle(Number(data.windDirection));
                  const dir = windDir16(Number(data.windDirection));
                  const mh = multiByTimestamp[data.timestamp];
                  const hasHighGust = Number(data.gustSpeed) > gustThreshold;
                  const isSelected = selectedTimestamp === data.timestamp;

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: `1px solid ${BORDER}`,
                        borderLeft: `3px solid ${borderCol}`,
                        background: isSelected ? 'rgba(255,255,255,0.08)' : '',
                        cursor: onHourSelect ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (!onHourSelect) return;
                        setSelectedTimestamp(data.timestamp);
                        onHourSelect(Number(data.windDirection), Number(data.windSpeed));
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = ''; }}
                    >
                      {/* Time */}
                      <td className="py-3 text-sm font-medium text-white whitespace-nowrap" style={{ paddingLeft: '20px', paddingRight: '12px' }}>
                        {time}
                      </td>

                      {/* Score */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className="inline-flex items-center justify-center text-xs font-bold rounded"
                          style={{ background: badge.bg, color: badge.color, minWidth: '42px', padding: '3px 8px' }}
                        >
                          {data.overallScore}
                        </span>
                      </td>

                      {/* Temp */}
                      <td className="py-3 px-3 text-right text-sm text-white whitespace-nowrap">
                        {Number(data.temperature).toFixed(1)}°
                      </td>

                      {/* Surface Wind */}
                      <td className="py-3 px-3 whitespace-nowrap" style={{ textAlign: 'left' }}>
                        <div className="text-sm text-white">
                          <span className="mr-1" style={{ color: MUTED }}>{tri}</span>
                          <span>{convertWindSpeed(Number(data.windSpeed), windUnit).toFixed(1)} {windSpeedUnitLabel(windUnit)} </span>
                          <span className="font-bold">{dir}</span>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: hasHighGust ? '#f97316' : MUTED }}>
                          gust {convertWindSpeed(Number(data.gustSpeed), windUnit).toFixed(1)} {windSpeedUnitLabel(windUnit)}
                        </div>
                      </td>

                      {/* Rain */}
                      <td className="py-3 px-3 text-right text-sm whitespace-nowrap" style={{ color: Number(data.rain) > 0 ? '#60a5fa' : MUTED }}>
                        {Number(data.rain).toFixed(1)}
                      </td>

                      {/* Ceiling */}
                      <td className="py-3 px-3 text-right text-sm font-medium whitespace-nowrap" style={{ color: ceilCol }}>
                        {ceil != null
                          ? <>{ceil < 1000 ? '☁ ' : ''}{Math.round(ceil)} ft</>
                          : <span style={{ color: MUTED }}>–</span>
                        }
                      </td>

                      {/* Cover */}
                      <td className="py-3 px-3 text-right text-sm font-medium whitespace-nowrap" style={{ color: covCol }}>
                        {data.cloudCover != null
                          ? `${Math.round(data.cloudCover)}%`
                          : <span style={{ color: MUTED }}>–</span>
                        }
                      </td>

                      {/* 33 ft */}
                      <td className="py-3 px-3 text-center text-sm whitespace-nowrap">
                        {isLoadingMulti
                          ? <span style={{ color: MUTED }}>…</span>
                          : mh
                            ? <span style={{ color: windSpeedColor(mh.wind_10m.speed, windTooCalmMax, windOptimalMax, windMarginalMax, windHighRiskMax) }}>
                                {windTriangle(mh.wind_10m.direction)} {Math.round(convertWindSpeed(mh.wind_10m.speed, windUnit))}
                              </span>
                            : <span style={{ color: MUTED }}>–</span>
                        }
                      </td>

                      {/* 262 ft */}
                      <td className="py-3 px-3 text-center text-sm whitespace-nowrap">
                        {isLoadingMulti
                          ? <span style={{ color: MUTED }}>…</span>
                          : mh
                            ? <span style={{ color: windSpeedColor(mh.wind_80m.speed, windTooCalmMax, windOptimalMax, windMarginalMax, windHighRiskMax) }}>
                                {windTriangle(mh.wind_80m.direction)} {Math.round(convertWindSpeed(mh.wind_80m.speed, windUnit))}
                              </span>
                            : <span style={{ color: MUTED }}>–</span>
                        }
                      </td>

                      {/* 394 ft */}
                      <td className="py-3 text-center text-sm whitespace-nowrap" style={{ paddingLeft: '12px', paddingRight: '20px' }}>
                        {isLoadingMulti
                          ? <span style={{ color: MUTED }}>…</span>
                          : mh
                            ? <span style={{ color: windSpeedColor(mh.wind_120m.speed, windTooCalmMax, windOptimalMax, windMarginalMax, windHighRiskMax) }}>
                                {windTriangle(mh.wind_120m.direction)} {Math.round(convertWindSpeed(mh.wind_120m.speed, windUnit))}
                              </span>
                            : <span style={{ color: MUTED }}>–</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer legend ── */}
        <div
          className="px-5 py-3 flex items-center gap-x-5 gap-y-1 text-xs flex-wrap flex-shrink-0"
          style={{ borderTop: `1px solid ${BORDER}`, color: MUTED }}
        >
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-8 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)' }}
            />
            Flyability score 0–100
          </span>
          <span>☁ Low ceiling</span>
          <span>△ Wind bearing</span>
          <span>
            Wind aloft:{' '}
            <span style={{ color: '#22c55e' }}>green</span> = optimal ·{' '}
            <span style={{ color: '#f59e0b' }}>amber</span> = calm/marginal ·{' '}
            <span style={{ color: '#f97316' }}>orange</span> = high risk ·{' '}
            <span style={{ color: '#ef4444' }}>red</span> = unsafe
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
