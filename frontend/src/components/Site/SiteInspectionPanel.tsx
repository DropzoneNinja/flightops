import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlightSite } from '../../services/sites.service';
import { WeatherForecast } from '../../services/weather.service';
import { Mission, missionsService } from '../../services/missions.service';
import { scoreToHeatColor } from '../../utils/colorInterpolation';
import { convertWindSpeed, windSpeedUnitLabel } from '../../utils/windSpeed';
import { useWeather } from '../../hooks/useWeather';
import { useSettings } from '../../hooks/useSettings';
import { SettingKey } from '../../services/settings.service';
import CombinedWeatherDialog from '../Weather/CombinedWeatherDialog';
import { useAirspace } from '../../hooks/useAirspace';
import { computeAirspaceLayers, CLASS_COLORS, formatAltFt } from '../../utils/airspaceUtils';
import type { AirspaceLayer } from '../../utils/airspaceUtils';

export interface MapState {
  lat: number;
  lng: number;
  zoom: number;
}

interface SiteInspectionPanelProps {
  site: FlightSite;
  onClose: () => void;
  onForecastSelect?: (windDirection: number, windSpeed: number) => void;
  prevMapState?: MapState | null;
  windOverride?: { dir: number; speed: number } | null;
  canEdit?: boolean;
  onEdit?: () => void;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDaylightHours(forecast: WeatherForecast) {
  const sunriseHour = parseInt(forecast.sunrise.split(':')[0]);
  const sunsetHour = parseInt(forecast.sunset.split(':')[0]);
  return forecast.hourlyData.filter(h => {
    const hour = new Date(h.timestamp).getHours();
    return hour >= sunriseHour && hour <= sunsetHour;
  });
}

function getFlyabilityScore(forecast: WeatherForecast): number {
  const sunriseHour = parseInt(forecast.sunrise.split(':')[0]);
  const sunsetHour = parseInt(forecast.sunset.split(':')[0]);
  const GOOD_THRESHOLD = 55;

  const morningHours = forecast.hourlyData.filter(h => {
    const hour = new Date(h.timestamp).getHours();
    return hour >= sunriseHour && hour < 12;
  });
  const afternoonHours = forecast.hourlyData.filter(h => {
    const hour = new Date(h.timestamp).getHours();
    return hour >= 12 && hour <= sunsetHour;
  });

  const isWindowGood = (hours: typeof morningHours) => {
    if (hours.length === 0) return false;
    const goodCount = hours.filter(h => h.overallScore >= GOOD_THRESHOLD).length;
    return goodCount > hours.length / 2;
  };

  const morningGood = isWindowGood(morningHours);
  const afternoonGood = isWindowGood(afternoonHours);

  if (morningGood && afternoonGood) return 85;
  if (morningGood || afternoonGood) return 65;

  const allDaylight = forecast.hourlyData.filter(h => {
    const hour = new Date(h.timestamp).getHours();
    return hour >= sunriseHour && hour <= sunsetHour;
  });
  if (allDaylight.length === 0) return 0;
  return Math.min(Math.max(...allDaylight.map(h => h.overallScore)), 54);
}

interface BestWindow {
  startLabel: string;
  endLabel: string;
  peakScore: number;
}

const MIN_FLYABLE_MINUTES = 30;

function getFlyableMinutes(hour: number, sunriseFrac: number, sunsetFrac: number): number {
  const flyStart = Math.max(hour, sunriseFrac);
  const flyEnd = Math.min(hour + 1, sunsetFrac);
  return Math.max(0, (flyEnd - flyStart) * 60);
}

function getBestWindow(forecast: WeatherForecast, minScore: number): BestWindow | null {
  const [sunriseH, sunriseM] = forecast.sunrise.split(':').map(Number);
  const [sunsetH, sunsetM] = forecast.sunset.split(':').map(Number);
  const sunriseFrac = sunriseH + sunriseM / 60;
  const sunsetFrac = sunsetH + sunsetM / 60;

  const morningHours = forecast.hourlyData.filter(h => {
    const hour = new Date(h.timestamp).getHours();
    return hour >= sunriseH && hour <= sunriseH + 2;
  });
  const eveningHours = forecast.hourlyData.filter(h => {
    const hour = new Date(h.timestamp).getHours();
    return hour >= sunsetH - 2 && hour <= sunsetH;
  });

  function bestBlock(hours: typeof morningHours) {
    const blocks: { hours: typeof hours; peak: number }[] = [];
    let cur: typeof hours = [];
    for (const h of hours) {
      if (h.overallScore >= minScore) {
        cur.push(h);
      } else if (cur.length > 0) {
        blocks.push({ hours: cur, peak: Math.max(...cur.map(x => x.overallScore)) });
        cur = [];
      }
    }
    if (cur.length > 0) {
      blocks.push({ hours: cur, peak: Math.max(...cur.map(x => x.overallScore)) });
    }
    const validBlocks = blocks.filter(block => {
      const totalMinutes = block.hours.reduce((sum, x) =>
        sum + getFlyableMinutes(new Date(x.timestamp).getHours(), sunriseFrac, sunsetFrac), 0);
      return totalMinutes >= MIN_FLYABLE_MINUTES;
    });
    return validBlocks.length > 0 ? validBlocks.reduce((a, b) => (b.peak > a.peak ? b : a)) : null;
  }

  const morningBest = bestBlock(morningHours);
  const eveningBest = bestBlock(eveningHours);

  const candidate =
    morningBest && eveningBest
      ? (eveningBest.peak > morningBest.peak ? eveningBest : morningBest)
      : (morningBest ?? eveningBest);

  if (!candidate) return null;

  const startHour = new Date(candidate.hours[0].timestamp).getHours();
  const endHour = new Date(candidate.hours[candidate.hours.length - 1].timestamp).getHours() + 1;

  return {
    startLabel: `${String(startHour).padStart(2, '0')}:00`,
    endLabel: `${String(endHour).padStart(2, '0')}:00`,
    peakScore: candidate.peak,
  };
}

function getAvgWind(forecast: WeatherForecast): { wind: number; gust: number } {
  const hours = getDaylightHours(forecast);
  if (hours.length === 0) return { wind: 0, gust: 0 };
  const wind = hours.reduce((s, h) => s + h.windSpeed, 0) / hours.length;
  const gust = hours.reduce((s, h) => s + h.gustSpeed, 0) / hours.length;
  return { wind: Math.round(wind), gust: Math.round(gust) };
}

function getDayLabel(dateString: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateString);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-AU', { weekday: 'short' });
}

function getDayShort(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: '#43A047' };
  if (score >= 55) return { label: 'Good', color: '#8BC34A' };
  if (score >= 25) return { label: 'Marginal', color: '#FDD835' };
  return { label: 'No-fly', color: '#E53935' };
}

function MiniHeatBar({ forecast }: { forecast: WeatherForecast }) {
  const hours = forecast.hourlyData;
  if (!hours.length) return <div className="h-2 bg-[#2a3a54] rounded-full" />;
  return (
    <div className="h-2 rounded-full overflow-hidden flex">
      {hours.map((h, i) => (
        <div
          key={i}
          style={{ backgroundColor: scoreToHeatColor(h.overallScore), flex: 1 }}
        />
      ))}
    </div>
  );
}

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-400">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const WindIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
);

const MissionsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-400">
    <path d="M12 2L8 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3l4 4 4-4h3a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3L12 2z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-[#4a5a74]">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const AIRSPACE_CAP_FT = 15000;


function AirspaceSvgBar({ layers }: { layers: AirspaceLayer[] }) {
  const PAD_TOP = 8, PAD_BOT = 16, H = 148, GRAPH = H - PAD_TOP - PAD_BOT;
  const AXIS_W = 44, BAR_W = 42;

  const fy = (ft: number) => PAD_TOP + GRAPH - (ft / AIRSPACE_CAP_FT) * GRAPH;

  const boundaries = Array.from(
    new Set(layers.flatMap(l => [l.lowerFeet, l.upperFeet]))
  ).sort((a, b) => a - b);

  return (
    <svg width={AXIS_W + BAR_W} height={H} className="shrink-0">
      {boundaries.map(ft => (
        <g key={ft}>
          <text x={AXIS_W - 4} y={fy(ft)} textAnchor="end" dominantBaseline="middle"
            fontSize={9} fill="#8ba3c0" fontWeight="600">
            {formatAltFt(ft)}
          </text>
          <line x1={AXIS_W - 2} y1={fy(ft)} x2={AXIS_W} y2={fy(ft)}
            stroke="#3a4f6e" strokeWidth={1} />
        </g>
      ))}
      {layers.map((layer, i) => {
        const y1 = fy(layer.upperFeet);
        const y2 = fy(layer.lowerFeet);
        const h = y2 - y1;
        return (
          <g key={`${layer.class}-${layer.lowerFeet}-${i}`}>
            <rect x={AXIS_W} y={y1} width={BAR_W} height={h}
              fill={layer.color} opacity={0.88} stroke="#111827" strokeWidth={1.5} />
            {h >= 14 && (
              <text x={AXIS_W + BAR_W / 2} y={y1 + h / 2} textAnchor="middle"
                dominantBaseline="middle" fontSize={h >= 22 ? 14 : 9}
                fontWeight="bold" fill="white" className="pointer-events-none"
                style={{ filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.7))' }}>
                {layer.class}
              </text>
            )}
          </g>
        );
      })}
      <text x={AXIS_W + BAR_W / 2} y={H - 2} textAnchor="middle"
        fontSize={9} fill="#8ba3c0" fontWeight="600">
        GND
      </text>
    </svg>
  );
}

export default function SiteInspectionPanel({ site, onClose, onForecastSelect, prevMapState, windOverride, canEdit, onEdit }: SiteInspectionPanelProps) {
  const navigate = useNavigate();
  const { forecasts, isLoading } = useWeather(site.id);
  const { settingsMap } = useSettings();
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [selectedForecast, setSelectedForecast] = useState<WeatherForecast | null>(null);
  const [siteMissions, setSiteMissions] = useState<Mission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);

  const minScore = (settingsMap[SettingKey.BEST_WINDOW_MIN_SCORE] as number) ?? 50;
  const windUnit = (settingsMap[SettingKey.UNITS_WIND_SPEED] as string) || 'kmh';

  const takeoffLat = parseFloat(site.takeoff_lat.toString());
  const takeoffLon = parseFloat(site.takeoff_lon.toString());

  const { airspace } = useAirspace();
  const airspaceLayers = useMemo(() => {
    if (!airspace) return [];
    return computeAirspaceLayers(takeoffLat, takeoffLon, airspace, AIRSPACE_CAP_FT);
  }, [takeoffLat, takeoffLon, airspace]);

  const displayLayers: AirspaceLayer[] = airspaceLayers.length > 0
    ? airspaceLayers
    : airspace
      ? [{ class: 'G', lowerFeet: 0, upperFeet: AIRSPACE_CAP_FT, color: CLASS_COLORS['G'], name: 'Class G', lower: 'SFC', upper: `FL${AIRSPACE_CAP_FT / 100}` }]
      : [];

  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions) return;
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (result.state !== 'granted') return;
      navigator.geolocation.getCurrentPosition(
        pos => {
          const d = haversineKm(pos.coords.latitude, pos.coords.longitude, takeoffLat, takeoffLon);
          setDistanceKm(d);
        },
        () => {},
        { timeout: 5000 },
      );
    });
  }, [takeoffLat, takeoffLon]);

  useEffect(() => {
    setMissionsLoading(true);
    missionsService.getAll({ launchSiteId: site.id, sort: 'updated_at', order: 'DESC' })
      .then(setSiteMissions)
      .catch(() => setSiteMissions([]))
      .finally(() => setMissionsLoading(false));
  }, [site.id]);

  // Find the best valid window across all forecast days (sunrise/sunset boundary-aware)
  const forecastWindows = forecasts.map(f => ({ forecast: f, window: getBestWindow(f, minScore) }));
  const validEntries = forecastWindows.filter(x => x.window !== null);
  const bestEntry = validEntries.length
    ? validEntries.reduce((best, curr) => curr.window!.peakScore > best.window!.peakScore ? curr : best)
    : null;
  const bestForecast = bestEntry?.forecast ?? null;
  const bestWindow = bestEntry?.window ?? null;
  const bestScore = bestWindow ? bestWindow.peakScore : 0;
  const bestScoreLabel = getScoreLabel(bestScore);

  return (
    <>
      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full w-96 bg-[#111827] border-l border-[#1e2a3a] z-[500] flex flex-col overflow-hidden shadow-2xl"
        style={{ width: '384px' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-white text-xl font-bold leading-tight truncate">{site.name}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-[#6b7fa3] text-sm">
              {site.elevation_m != null && (
                <>
                  <span>{site.elevation_m.toLocaleString()} m</span>
                  <span className="text-[#2a3a54]">·</span>
                </>
              )}
              {distanceKm != null ? (
                <span>{Math.round(distanceKm)} km away</span>
              ) : (
                <span className="text-[#3a4a64]">—</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 mt-0.5 text-[#6b7fa3] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1e2a3a]"
          >
            <XIcon />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto px-5 space-y-4 ${canEdit ? 'pb-4' : 'pb-5'}`}>
          {/* Best Window card */}
          {!isLoading && forecasts.length > 0 && (
            bestWindow ? (
              <div className="bg-[#1a2e4a] border border-[#2a4a6a] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClockIcon />
                    <span className="text-[#6b9fd4] text-xs font-semibold tracking-widest uppercase">Best Window</span>
                  </div>
                  <div
                    className="text-white text-xl font-bold w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: scoreToHeatColor(bestScore) }}
                  >
                    {Math.round(bestScore)}
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-white font-semibold text-sm">
                    {getDayLabel(bestForecast!.date)} {bestWindow.startLabel}–{bestWindow.endLabel}
                  </span>
                  <div className="mt-0.5 text-xs" style={{ color: bestScoreLabel.color }}>
                    {bestScoreLabel.label}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#1a2234] border border-[#2a3a54] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClockIcon />
                  <span className="text-[#6b9fd4] text-xs font-semibold tracking-widest uppercase">No Suitable Weather</span>
                </div>
                <p className="text-[#6b7fa3] text-sm">No suitable flying conditions in the next 4 days.</p>
              </div>
            )
          )}

          {/* 4-Day Forecast */}
          <div>
            <h3 className="text-[#6b7fa3] text-xs font-semibold tracking-widest uppercase mb-3">
              4-Day Flyability Forecast
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : forecasts.length === 0 ? (
              <p className="text-[#3a4a64] text-sm text-center py-8">No forecast data available</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {forecasts.slice(0, 4).map(forecast => {
                  const peak = getFlyabilityScore(forecast);
                  const { label, color } = getScoreLabel(peak);
                  const { wind, gust } = getAvgWind(forecast);
                  const isBest = bestForecast?.id === forecast.id;

                  return (
                    <button
                      key={forecast.id}
                      onClick={() => {
                        setSelectedForecast(forecast);
                        if (onForecastSelect) {
                          const sunriseHour = parseInt(forecast.sunrise.split(':')[0]);
                          const sunsetHour = parseInt(forecast.sunset.split(':')[0]);
                          const firstDaylight = forecast.hourlyData.find(h => {
                            const hour = new Date(h.timestamp).getHours();
                            return hour >= sunriseHour && hour <= sunsetHour;
                          });
                          if (firstDaylight) {
                            onForecastSelect(firstDaylight.windDirection, firstDaylight.windSpeed);
                          }
                        }
                      }}
                      className={`text-left rounded-xl p-3 transition-colors cursor-pointer ${
                        isBest
                          ? 'bg-[#1e3a5a] border border-[#2a5a8a] hover:bg-[#243f65]'
                          : 'bg-[#1a2234] border border-[#1e2a3a] hover:bg-[#1e2a3a]'
                      }`}
                    >
                      {/* Day header */}
                      <div className="mb-2">
                        <div className="text-[#a0b3cc] text-xs font-semibold uppercase tracking-wide">
                          {getDayLabel(forecast.date)}
                        </div>
                        <div className="text-[#6b7fa3] text-xs">
                          {getDayShort(forecast.date)}
                        </div>
                      </div>

                      {/* Score */}
                      <div className="flex items-end gap-1.5 mb-1">
                        <span className="text-3xl font-bold leading-none" style={{ color }}>
                          {Math.round(peak)}
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold mb-2" style={{ color }}>
                        {label}
                      </div>

                      {/* Wind info */}
                      <div className="flex items-center gap-1 text-[#a0b3cc] text-xs mb-2">
                        <WindIcon />
                        <span>{Math.round(convertWindSpeed(wind, windUnit))} {windSpeedUnitLabel(windUnit)}</span>
                        <span className="text-[#6b7fa3] mx-0.5">gust</span>
                        <span>{Math.round(convertWindSpeed(gust, windUnit))} {windSpeedUnitLabel(windUnit)}</span>
                      </div>

                      {/* Mini heat bar */}
                      <MiniHeatBar forecast={forecast} />

                      {/* Hour markers */}
                      <div className="flex justify-between mt-1 text-[#6b7fa3] text-[10px]">
                        <span>06</span>
                        <span>12</span>
                        <span>18</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Airspace */}
          {displayLayers.length > 0 && (
            <div>
              <h3 className="text-[#6b7fa3] text-xs font-semibold tracking-widest uppercase mb-3">
                Airspace
              </h3>
              <div className="flex gap-3 items-end">
                <AirspaceSvgBar layers={displayLayers} />
                <div className="flex-1 flex flex-col-reverse gap-1 pb-4">
                  {displayLayers.map((layer, i) => (
                    <div key={`${layer.class}-${layer.lowerFeet}-${i}`}
                      className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: layer.color }}
                      >
                        {layer.class}
                      </span>
                      <div className="min-w-0">
                        <div className="text-white text-xs font-medium leading-tight">
                          {formatAltFt(layer.lowerFeet)} – {formatAltFt(layer.upperFeet)}
                        </div>
                        <div className="text-[#8ba3c0] text-[10px] truncate leading-tight">
                          {layer.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Missions for this site */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MissionsIcon />
              <h3 className="text-[#6b7fa3] text-xs font-semibold tracking-widest uppercase">
                Missions
              </h3>
            </div>

            {missionsLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : siteMissions.length === 0 ? (
              <p className="text-[#3a4a64] text-sm text-center py-4">No missions at this site</p>
            ) : (
              <div className="space-y-1.5">
                {siteMissions.map(mission => (
                  <button
                    key={mission.id}
                    onClick={() => navigate(`/missions/${mission.id}`, { state: { fromMap: true, siteId: site.id, prevMapState, windOverride: windOverride ?? null } })}
                    className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#1a2234] border border-[#1e2a3a] hover:bg-[#1e2a3a] hover:border-[#2a3a54] transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="text-white text-sm font-medium truncate">{mission.name}</div>
                      <div className="text-[#4a5a74] text-[10px] mt-0.5">
                        {new Date(mission.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <ChevronRightIcon />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {canEdit && onEdit && (
          <div className="border-t border-[#1e2a3a] pt-4 pb-5">
            <button
              onClick={onEdit}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a2234] border border-[#2a3a54] text-[#6b9fd4] hover:bg-[#1e3a5a] hover:border-[#2a5a8a] hover:text-white transition-colors text-sm font-medium"
            >
              <PencilIcon />
              Edit Site
            </button>
          </div>
        )}
      </div>

      {/* Weather detail dialog (opened from day card click) */}
      <CombinedWeatherDialog
        forecast={selectedForecast}
        forecasts={forecasts}
        siteId={site.id}
        siteName={site.name}
        onClose={() => setSelectedForecast(null)}
        onForecastChange={f => setSelectedForecast(f)}
        onHourSelect={onForecastSelect}
      />
    </>
  );
}
