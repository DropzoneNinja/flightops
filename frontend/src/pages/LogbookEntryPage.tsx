import { lazy, Suspense, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftSidebar from '../components/Layout/LeftSidebar';
import { useLogbookEntry, useUpdateLogbookEntry, useDeleteLogbookEntry } from '../hooks/useLogbook';
import { useWings, useParamotors } from '../hooks/useEquipment';
import { useFlightById, useFlightsByDate } from '../hooks/useFlights';
import { useQueryClient } from '@tanstack/react-query';
import { useSettings } from '../hooks/useSettings';
import { SettingKey } from '../services/settings.service';
import { convertWindSpeed, windSpeedUnitLabel } from '../utils/windSpeed';
import LogbookEntryForm from '../components/Logbook/LogbookEntryForm';
import LogbookMediaGrid from '../components/Logbook/LogbookMediaGrid';
import { flightsService } from '../services/flights.service';
import type { UpdateLogbookEntryData } from '../services/logbook.service';

const FlightMap2D = lazy(() => import('../components/Flights/FlightMap2D'));

function fmtDuration(s: number | null): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDist(m: number | null): string {
  if (!m) return '—';
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtAlt(m: number | null): string {
  if (!m) return '—';
  return `${Math.round(m * 3.28084)} ft`;
}

function fmtSpeed(mps: number | null): string {
  if (!mps) return '—';
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

function WindDir(deg: number): string {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export default function LogbookEntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { settingsMap } = useSettings();
  const windUnit = (settingsMap[SettingKey.UNITS_WIND_SPEED] as string) || 'kmh';
  const [editing, setEditing] = useState(false);
  const [editingFlightNumber, setEditingFlightNumber] = useState(false);
  const [flightNumberInput, setFlightNumberInput] = useState('');
  const [gpxUploading, setGpxUploading] = useState(false);
  const [gpxProgress, setGpxProgress] = useState(0);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: entry, isLoading, error } = useLogbookEntry(id);
  const updateMutation = useUpdateLogbookEntry();
  const deleteMutation = useDeleteLogbookEntry();
  const { data: wingsData } = useWings();
  const { data: paramotorsData } = useParamotors();

  const flightId = entry?.gpx?.flight_id ?? null;
  const { data: flight } = useFlightById(flightId ?? undefined);
  const trackpoints = flight?.trackpoints_json ?? [];
  const bbox = flight?.bbox_json ?? null;

  const { data: flightsOnDay } = useFlightsByDate(!flightId ? entry?.flight_date : undefined);

  const handleGpxFile = async (file: File) => {
    if (!entry) return;
    setGpxError(null);
    setGpxUploading(true);
    setGpxProgress(0);
    try {
      await flightsService.uploadFlight(
        file,
        {
          flight_date: entry.flight_date,
          client_id: entry.client_id,
          launch_site_name: entry.launch_site_name ?? undefined,
          title: entry.title ?? undefined,
          notes: entry.notes ?? undefined,
          glider: entry.wing ?? undefined,
        },
        (pct) => setGpxProgress(pct),
      );
      queryClient.invalidateQueries({ queryKey: ['logbook', entry.id] });
    } catch {
      setGpxError('Upload failed — check the file is a valid GPX and try again.');
    } finally {
      setGpxUploading(false);
      setGpxProgress(0);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#0d1421' }}>
        <div className="text-[#6b7fa3]">Loading entry…</div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="h-screen flex items-center justify-center p-4" style={{ background: '#0d1421' }}>
        <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-8 text-center max-w-sm">
          <p className="text-white font-medium mb-4">Flight not found</p>
          <button
            onClick={() => navigate('/logbook')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Back to logbook
          </button>
        </div>
      </div>
    );
  }

  const dur = entry.analyzed_duration_seconds ?? entry.duration_seconds;
  const dist = entry.analyzed_distance_m ?? entry.distance_m;
  const maxAlt = entry.analyzed_max_altitude_m ?? entry.max_altitude_m;
  const maxSpd = entry.analyzed_max_speed_mps ?? entry.max_speed_mps;
  const wx = entry.weather_snapshot;

  const handleUpdate = async (data: UpdateLogbookEntryData) => {
    await updateMutation.mutateAsync({ id: entry.id, data });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this logbook entry?')) return;
    await deleteMutation.mutateAsync(entry.id);
    navigate('/logbook');
  };

  return (
    <div className="h-screen flex flex-row overflow-hidden" style={{ background: '#0d1421' }}>
      {!isMobile && (
        <LeftSidebar
          user={user}
          showAirspace={false}
          onToggleAirspace={() => {}}
          onLogout={logout}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Header with back button */}
        <div className="border-b border-[#1e2a3a] px-6 py-4 flex items-center justify-between sticky top-0 z-10" style={{ background: '#0d1421' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/logbook')}
              className="p-2 rounded-lg hover:bg-[#1e2a3a] transition-colors text-[#6b7fa3] hover:text-white"
              aria-label="Back to logbook"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                {entry.title ?? entry.launch_site_name ?? entry.flight_date}
              </h1>
              <p className="text-xs text-[#6b7fa3]">
                {entry.flight_date}
                {entry.start_at && (
                  <span className="ml-1">
                    at {new Date(entry.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(!editing)}
              className="px-3 py-2 text-sm rounded-lg border border-[#2a3a54] bg-[#1e2a3a] text-[#a0b3cc] hover:bg-[#243048] transition-colors"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-3 py-2 text-sm rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20 disabled:opacity-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
          {/* Edit form */}
          {editing && (
            <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-6">
              <h2 className="text-base font-semibold text-white mb-4">Edit entry</h2>
              <LogbookEntryForm
                initialValues={{
                  flight_date: entry.flight_date,
                  title: entry.title ?? undefined,
                  launch_site_name: entry.launch_site_name ?? undefined,
                  landing_site_name: entry.landing_site_name ?? undefined,
                  category: entry.category ?? undefined,
                  wing: entry.wing ?? undefined,
                  wing_id: entry.wing_id ?? undefined,
                  paramotor: entry.paramotor ?? undefined,
                  paramotor_id: entry.paramotor_id ?? undefined,
                  fuel_start_litres: entry.fuel_start_litres ?? undefined,
                  fuel_used_litres: entry.fuel_used_litres ?? undefined,
                  rating: entry.rating ?? undefined,
                  notes: entry.notes ?? undefined,
                  duration_seconds: entry.duration_seconds ?? undefined,
                  max_altitude_m: entry.max_altitude_m ?? undefined,
                  max_speed_mps: entry.max_speed_mps ?? undefined,
                  distance_m: entry.distance_m ?? undefined,
                }}
                hasGpx={!!entry.gpx}
                onSubmit={handleUpdate}
                onCancel={() => setEditing(false)}
                isLoading={updateMutation.isPending}
                submitLabel="Save changes"
                wings={wingsData ?? []}
                paramotors={paramotorsData ?? []}
              />
            </div>
          )}

          {/* Flight number */}
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#6b7fa3] shrink-0">Flight #</span>
              {editingFlightNumber ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const val = flightNumberInput.trim();
                    const override = val === '' ? null : parseInt(val, 10);
                    if (val !== '' && (isNaN(override!) || override! < 1)) return;
                    await updateMutation.mutateAsync({ id: entry.id, data: { flight_number_override: override } });
                    setEditingFlightNumber(false);
                    queryClient.invalidateQueries({ queryKey: ['logbook'] });
                  }}
                >
                  <input
                    type="number"
                    min={1}
                    className="w-24 bg-[#0d1421] border border-[#2a3a54] rounded-lg px-2 py-1 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={flightNumberInput}
                    onChange={(e) => setFlightNumberInput(e.target.value)}
                    placeholder={entry.flight_number != null ? String(entry.flight_number) : ''}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-3 py-1 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingFlightNumber(false)}
                    className="px-3 py-1 text-xs rounded-lg border border-[#2a3a54] text-[#a0b3cc] hover:bg-[#1e2a3a] transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white tabular-nums">
                    {entry.flight_number ?? '—'}
                  </span>
                  {entry.flight_number_override != null && (
                    <span className="text-xs bg-amber-900/40 text-amber-400 rounded-full px-2 py-0.5 border border-amber-800/50">manually set</span>
                  )}
                </div>
              )}
            </div>
            {!editingFlightNumber && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setFlightNumberInput(entry.flight_number_override != null ? String(entry.flight_number_override) : '');
                    setEditingFlightNumber(true);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {entry.flight_number_override != null ? 'Change' : 'Set number'}
                </button>
                {entry.flight_number_override != null && (
                  <button
                    onClick={async () => {
                      await updateMutation.mutateAsync({ id: entry.id, data: { flight_number_override: null } });
                      queryClient.invalidateQueries({ queryKey: ['logbook'] });
                    }}
                    disabled={updateMutation.isPending}
                    className="text-xs text-[#4a5568] hover:text-red-400 disabled:opacity-50 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Duration', value: fmtDuration(dur) },
              { label: 'Distance', value: fmtDist(dist) },
              { label: 'Max altitude', value: fmtAlt(maxAlt) },
              { label: 'Max speed', value: fmtSpeed(maxSpd) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-4">
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-xs text-[#6b7fa3] mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Detail info */}
          <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {[
              ['Launch site', entry.launch_site_name],
              ['Landing site', entry.landing_site_name],
              ['Category', entry.category],
              ['Wing', entry.wing],
              ['Paramotor', entry.paramotor ?? entry.engine],
              ['Rating', entry.rating ? '★'.repeat(entry.rating) : null],
              ['Fuel start', entry.fuel_start_litres != null ? `${entry.fuel_start_litres} L` : null],
              ['Fuel used', entry.fuel_used_litres != null ? `${entry.fuel_used_litres} L` : null],
              ['Fuel rate', entry.fuel_rate_lph != null ? `${entry.fuel_rate_lph.toFixed(1)} L/h` : null],
              ['Source', entry.source],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={String(label)} className="flex justify-between items-start gap-2 py-2 border-b border-[#1e2a3a]">
                  <span className="text-[#6b7fa3] shrink-0">{label}</span>
                  <span className="text-white text-right">{value}</span>
                </div>
              ))}

            {entry.notes && (
              <div className="col-span-2 pt-2">
                <p className="text-[#6b7fa3] text-xs mb-1">Notes</p>
                <p className="text-[#a0b3cc] whitespace-pre-wrap">{entry.notes}</p>
              </div>
            )}
          </div>

          {/* Weather snapshot */}
          {wx && (
            <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-5">
              <h2 className="text-sm font-semibold text-white mb-3">
                Weather at takeoff
                {wx.matched_site_name && (
                  <span className="ml-2 font-normal text-[#6b7fa3]">— {wx.matched_site_name}</span>
                )}
              </h2>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {wx.temperature_c != null && (
                  <span><span className="text-[#6b7fa3]">Temp</span> <span className="text-white">{wx.temperature_c.toFixed(1)}°C</span></span>
                )}
                {wx.wind_speed_kmh != null && (
                  <span>
                    <span className="text-[#6b7fa3]">Wind</span>{' '}
                    <span className="text-white">
                      {convertWindSpeed(wx.wind_speed_kmh, windUnit).toFixed(1)} {windSpeedUnitLabel(windUnit)}
                      {wx.wind_direction_deg != null && ` ${WindDir(wx.wind_direction_deg)}`}
                    </span>
                  </span>
                )}
                {wx.gust_speed_kmh != null && (
                  <span><span className="text-[#6b7fa3]">Gusts</span> <span className="text-white">{convertWindSpeed(wx.gust_speed_kmh, windUnit).toFixed(1)} {windSpeedUnitLabel(windUnit)}</span></span>
                )}
                {wx.cloud_cover_pct != null && (
                  <span><span className="text-[#6b7fa3]">Cloud</span> <span className="text-white">{Math.round(wx.cloud_cover_pct)}%</span></span>
                )}
                {wx.cloud_base_m != null && (
                  <span><span className="text-[#6b7fa3]">Base</span> <span className="text-white">{fmtAlt(wx.cloud_base_m)}</span></span>
                )}
                {wx.precipitation_mm != null && wx.precipitation_mm > 0 && (
                  <span><span className="text-[#6b7fa3]">Rain</span> <span className="text-white">{wx.precipitation_mm.toFixed(1)} mm</span></span>
                )}
              </div>
            </div>
          )}

          {/* GPX map */}
          {flightId && trackpoints.length > 0 ? (
            <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1e2a3a] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Flight track</h2>
                <a
                  href={`/flights/${flightId}`}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Full analysis →
                </a>
              </div>
              <div className="h-72">
                <Suspense fallback={<div className="h-full flex items-center justify-center text-[#6b7fa3] text-sm">Loading map…</div>}>
                  <FlightMap2D
                    trackpoints={trackpoints}
                    bbox={bbox}
                    className="w-full h-full"
                  />
                </Suspense>
              </div>
            </div>
          ) : (
            <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Flight track</h2>
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,application/gpx+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleGpxFile(file);
                  e.target.value = '';
                }}
              />
              {gpxUploading ? (
                <div className="space-y-2">
                  <div className="h-2 bg-[#1e2a3a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${gpxProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#6b7fa3] text-center">Uploading… {gpxProgress}%</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {flightsOnDay && flightsOnDay.length > 0 && (
                    <div>
                      <p className="text-xs text-[#6b7fa3] mb-2">Link an existing flight from {entry.flight_date}:</p>
                      <div className="divide-y divide-[#1e2a3a] border border-[#2a3a54] rounded-lg overflow-hidden">
                        {flightsOnDay.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => updateMutation.mutate({
                              id: entry.id,
                              data: { flight_id: f.id } as UpdateLogbookEntryData,
                            })}
                            disabled={updateMutation.isPending}
                            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm hover:bg-[#1a2234] transition-colors disabled:opacity-50"
                          >
                            <span className="text-white font-medium">
                              {f.launch_site_name ?? f.title ?? f.original_filename}
                            </span>
                            <span className="text-[#6b7fa3] text-xs ml-4 shrink-0">
                              {f.duration_seconds ? `${Math.round(f.duration_seconds / 60)} min` : 'Link →'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-3 py-4 border border-dashed border-[#2a3a54] rounded-lg">
                    {(!flightsOnDay || flightsOnDay.length === 0) && (
                      <p className="text-sm text-[#6b7fa3]">No GPX track linked</p>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 text-sm border border-[#2a3a54] bg-[#1e2a3a] text-[#a0b3cc] rounded-lg hover:bg-[#243048] transition-colors"
                    >
                      Upload new GPX file
                    </button>
                    {gpxError && <p className="text-xs text-red-400 text-center">{gpxError}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Media */}
          {entry.media.length > 0 && (
            <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-5">
              <h2 className="text-sm font-semibold text-white mb-3">
                Photos &amp; videos
                <span className="ml-2 font-normal text-[#6b7fa3]">({entry.media.length})</span>
              </h2>
              <LogbookMediaGrid media={entry.media} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
