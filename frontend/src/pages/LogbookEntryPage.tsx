import { lazy, Suspense, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLogbookEntry, useUpdateLogbookEntry, useDeleteLogbookEntry } from '../hooks/useLogbook';
import { useFlightById, useFlightsByDate } from '../hooks/useFlights';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
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

  const flightId = entry?.gpx?.flight_id ?? null;
  const { data: flight } = useFlightById(flightId ?? undefined);
  const trackpoints = flight?.trackpoints_json ?? [];
  const bbox = flight?.bbox_json ?? null;

  // Flights on the same date — used to offer a link picker when no GPX is attached
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
      // Invalidate this entry so the gpx field populates
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading entry…</div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-sm">
          <p className="text-gray-700 font-medium mb-4">Flight not found</p>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/logbook')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Back"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                {entry.title ?? entry.launch_site_name ?? entry.flight_date}
              </h1>
              <p className="text-xs text-gray-500">
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
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Edit form */}
        {editing && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Edit entry</h2>
            <LogbookEntryForm
              initialValues={{
                flight_date: entry.flight_date,
                title: entry.title ?? undefined,
                launch_site_name: entry.launch_site_name ?? undefined,
                landing_site_name: entry.landing_site_name ?? undefined,
                category: entry.category ?? undefined,
                wing: entry.wing ?? undefined,
                engine: entry.engine ?? undefined,
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
            />
          </div>
        )}

        {/* Flight number */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 shrink-0">Flight #</span>
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
                  className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                  className="px-3 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900 tabular-nums">
                  {entry.flight_number ?? '—'}
                </span>
                {entry.flight_number_override != null && (
                  <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">manually set</span>
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
                className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
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
                  className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
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
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Detail info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {[
            ['Launch site', entry.launch_site_name],
            ['Landing site', entry.landing_site_name],
            ['Category', entry.category],
            ['Wing', entry.wing],
            ['Engine', entry.engine],
            ['Rating', entry.rating ? '★'.repeat(entry.rating) : null],
            ['Fuel used', entry.fuel_used_litres != null ? `${entry.fuel_used_litres} L` : null],
            ['Source', entry.source],
          ]
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={String(label)} className="flex justify-between items-start gap-2 py-1 border-b border-gray-50">
                <span className="text-gray-500 shrink-0">{label}</span>
                <span className="text-gray-900 text-right">{value}</span>
              </div>
            ))}

          {entry.notes && (
            <div className="col-span-2 pt-2">
              <p className="text-gray-500 text-xs mb-1">Notes</p>
              <p className="text-gray-800 whitespace-pre-wrap">{entry.notes}</p>
            </div>
          )}
        </div>

        {/* Weather snapshot */}
        {wx && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Weather at takeoff
              {wx.matched_site_name && (
                <span className="ml-2 font-normal text-gray-500">— {wx.matched_site_name}</span>
              )}
            </h2>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {wx.temperature_c != null && (
                <span><span className="text-gray-500">Temp</span> {wx.temperature_c.toFixed(1)}°C</span>
              )}
              {wx.wind_speed_kmh != null && (
                <span>
                  <span className="text-gray-500">Wind</span>{' '}
                  {wx.wind_speed_kmh.toFixed(1)} km/h
                  {wx.wind_direction_deg != null && ` ${WindDir(wx.wind_direction_deg)}`}
                </span>
              )}
              {wx.gust_speed_kmh != null && (
                <span><span className="text-gray-500">Gusts</span> {wx.gust_speed_kmh.toFixed(1)} km/h</span>
              )}
              {wx.cloud_cover_pct != null && (
                <span><span className="text-gray-500">Cloud</span> {Math.round(wx.cloud_cover_pct)}%</span>
              )}
              {wx.cloud_base_m != null && (
                <span><span className="text-gray-500">Base</span> {fmtAlt(wx.cloud_base_m)}</span>
              )}
              {wx.precipitation_mm != null && wx.precipitation_mm > 0 && (
                <span><span className="text-gray-500">Rain</span> {wx.precipitation_mm.toFixed(1)} mm</span>
              )}
            </div>
          </div>
        )}

        {/* GPX map */}
        {flightId && trackpoints.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Flight track</h2>
              <a
                href={`/analysis/${flightId}`}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Full analysis →
              </a>
            </div>
            <div className="h-72">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-400 text-sm">Loading map…</div>}>
                <FlightMap2D
                  trackpoints={trackpoints}
                  bbox={bbox}
                  className="w-full h-full"
                />
              </Suspense>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Flight track</h2>
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
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${gpxProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center">Uploading… {gpxProgress}%</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Existing flights on the same day */}
                {flightsOnDay && flightsOnDay.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Link an existing flight from {entry.flight_date}:</p>
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                      {flightsOnDay.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => updateMutation.mutate({
                            id: entry.id,
                            data: { flight_id: f.id } as UpdateLogbookEntryData,
                          })}
                          disabled={updateMutation.isPending}
                          className="w-full flex items-center justify-between px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors disabled:opacity-50"
                        >
                          <span className="text-gray-800 font-medium">
                            {f.launch_site_name ?? f.title ?? f.original_filename}
                          </span>
                          <span className="text-gray-400 text-xs ml-4 shrink-0">
                            {f.duration_seconds ? `${Math.round(f.duration_seconds / 60)} min` : 'Link →'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload new GPX */}
                <div className="flex flex-col items-center gap-3 py-4 border border-dashed border-gray-300 rounded-lg">
                  {(!flightsOnDay || flightsOnDay.length === 0) && (
                    <p className="text-sm text-gray-500">No GPX track linked</p>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Upload new GPX file
                  </button>
                  {gpxError && <p className="text-xs text-red-500 text-center">{gpxError}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Media */}
        {entry.media.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Photos &amp; videos
              <span className="ml-2 font-normal text-gray-400">({entry.media.length})</span>
            </h2>
            <LogbookMediaGrid media={entry.media} />
          </div>
        )}

      </div>
    </div>
  );
}
