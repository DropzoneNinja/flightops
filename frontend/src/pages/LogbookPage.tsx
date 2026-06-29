import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftSidebar from '../components/Layout/LeftSidebar';
import { useLogbook, useCreateLogbookEntry, useDeleteLogbookEntry, useOrphanedFlights, useImportFlightToLogbook, useLogbookBaseline, useUpsertLogbookBaseline, LOGBOOK_IMPORT_PROMPT_KEY } from '../hooks/useLogbook';
import { logbookService, CreateLogbookEntryData } from '../services/logbook.service';
import LogbookEntryForm from '../components/Logbook/LogbookEntryForm';
import { useWings, useParamotors } from '../hooks/useEquipment';
import LogbookImportPrompt from '../components/Logbook/LogbookImportPrompt';

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

interface BaselineFormState {
  prior_flights: string;
  prior_hours: string;
  prior_distance_km: string;
  notes: string;
}

export default function LogbookPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();

  const [showForm, setShowForm] = useState(false);
  const [showBaselineForm, setShowBaselineForm] = useState(false);
  const [baselineForm, setBaselineForm] = useState<BaselineFormState>({
    prior_flights: '',
    prior_hours: '',
    prior_distance_km: '',
    notes: '',
  });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showImportPrompt, setShowImportPrompt] = useState(
    () => localStorage.getItem(LOGBOOK_IMPORT_PROMPT_KEY) !== 'true',
  );

  const { data: entries, isLoading, error } = useLogbook();
  const createMutation = useCreateLogbookEntry();
  const deleteMutation = useDeleteLogbookEntry();
  const orphanedQuery = useOrphanedFlights();
  const importMutation = useImportFlightToLogbook();
  const { data: baseline } = useLogbookBaseline();
  const baselineMutation = useUpsertLogbookBaseline();
  const { data: wingsData } = useWings();
  const { data: paramotorsData } = useParamotors();

  const openBaselineForm = () => {
    setBaselineForm({
      prior_flights: baseline?.prior_flights != null ? String(baseline.prior_flights) : '',
      prior_hours: baseline?.prior_duration_seconds != null
        ? (baseline.prior_duration_seconds / 3600).toFixed(1)
        : '',
      prior_distance_km: baseline?.prior_distance_m != null
        ? (baseline.prior_distance_m / 1000).toFixed(1)
        : '',
      notes: baseline?.notes ?? '',
    });
    setShowBaselineForm(true);
  };

  const handleBaselineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const flights = baselineForm.prior_flights.trim() === '' ? 0 : parseInt(baselineForm.prior_flights, 10);
    const hours = baselineForm.prior_hours.trim() === '' ? null : parseFloat(baselineForm.prior_hours);
    const distKm = baselineForm.prior_distance_km.trim() === '' ? null : parseFloat(baselineForm.prior_distance_km);
    await baselineMutation.mutateAsync({
      prior_flights: isNaN(flights) ? 0 : flights,
      prior_duration_seconds: hours != null && !isNaN(hours) ? Math.round(hours * 3600) : null,
      prior_distance_m: distKm != null && !isNaN(distKm) ? distKm * 1000 : null,
      notes: baselineForm.notes.trim() || null,
    });
    setShowBaselineForm(false);
  };

  const handleCreate = async (data: CreateLogbookEntryData) => {
    await createMutation.mutateAsync(data);
    setShowForm(false);
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const blob = await logbookService.downloadPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logbook.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const noPilot = (error as { response?: { status?: number } })?.response?.status === 404;

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#0d1421' }}>
        <div className="text-[#6b7fa3]">Loading logbook…</div>
      </div>
    );
  }

  if (noPilot) {
    return (
      <div className="h-screen flex items-center justify-center p-4" style={{ background: '#0d1421' }}>
        <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-8 max-w-md text-center">
          <div className="text-4xl mb-4">✈️</div>
          <h2 className="text-xl font-semibold text-white mb-2">No pilot profile linked</h2>
          <p className="text-[#6b7fa3] text-sm">
            Your account isn't linked to a pilot profile yet. Ask an admin to link your account, then come back.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Back to map
          </button>
        </div>
      </div>
    );
  }

  const active = (entries ?? []).filter((e) => !e.deleted_at);
  const baselineFlights = baseline?.prior_flights ?? 0;
  const baselineSecs = baseline?.prior_duration_seconds ?? 0;
  const baselineDist = baseline?.prior_distance_m ?? 0;
  const loggedSecs = active.reduce((s, e) => s + (e.analyzed_duration_seconds ?? e.duration_seconds ?? 0), 0);
  const loggedDist = active.reduce((s, e) => s + (e.analyzed_distance_m ?? e.distance_m ?? 0), 0);
  const totalHours = (baselineSecs + loggedSecs) / 3600;
  const totalDist = baselineDist + loggedDist;
  const totalFlights = baselineFlights + active.length;

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
        {showImportPrompt && (orphanedQuery.data?.length ?? 0) > 0 && (
          <LogbookImportPrompt
            flights={orphanedQuery.data!}
            importMutation={importMutation}
            onDismiss={() => setShowImportPrompt(false)}
          />
        )}

        {/* Header */}
        <div className="border-b border-[#1e2a3a] px-6 py-4 flex items-center justify-between sticky top-0 z-10" style={{ background: '#0d1421' }}>
          <div>
            <h1 className="text-xl font-bold text-white">My Logbook</h1>
            <p className="text-xs text-[#6b7fa3]">Flight history &amp; records</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openBaselineForm}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[#2a3a54] bg-[#1e2a3a] text-[#a0b3cc] hover:bg-[#243048] transition-colors"
              title="Set baseline totals (Record 0)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {baseline ? 'Baseline' : 'Set baseline'}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading || !active.length}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[#2a3a54] bg-[#1e2a3a] text-[#a0b3cc] hover:bg-[#243048] disabled:opacity-40 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {pdfLoading ? 'Generating…' : 'PDF'}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add flight
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Summary */}
          {(active.length > 0 || baseline) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total flights', value: totalFlights },
                { label: 'Total hours', value: `${totalHours.toFixed(1)} h` },
                { label: 'Total distance', value: fmtDist(totalDist) },
                { label: 'Latest', value: active[0]?.flight_date ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] p-4">
                  <div className="text-2xl font-bold text-white">{value}</div>
                  <div className="text-xs text-[#6b7fa3] mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {active.length === 0 && !showForm && (
            <div className="bg-[#141d2e] rounded-2xl border border-dashed border-[#2a3a54] p-12 text-center">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-white mb-2">No flights yet</h3>
              <p className="text-[#6b7fa3] text-sm mb-6">
                Flights from flightnow appear here automatically. You can also add manual entries.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Add your first flight
              </button>
            </div>
          )}

          {/* Table */}
          {active.length > 0 && (
            <div className="bg-[#141d2e] rounded-xl border border-[#1e2a3a] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2a3a]" style={{ background: '#1e2a3a' }}>
                    <th className="text-left px-4 py-3 font-medium text-[#6b7fa3] w-12">#</th>
                    <th className="text-left px-4 py-3 font-medium text-[#6b7fa3]">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-[#6b7fa3] hidden sm:table-cell">Launch</th>
                    <th className="text-left px-4 py-3 font-medium text-[#6b7fa3] hidden md:table-cell">Duration</th>
                    <th className="text-left px-4 py-3 font-medium text-[#6b7fa3] hidden md:table-cell">Distance</th>
                    <th className="text-left px-4 py-3 font-medium text-[#6b7fa3] hidden lg:table-cell">Max alt</th>
                    <th className="text-left px-4 py-3 font-medium text-[#6b7fa3] hidden sm:table-cell">Wing</th>
                    <th className="text-left px-4 py-3 font-medium text-[#6b7fa3] hidden md:table-cell">Category</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2a3a]">
                  {active.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-[#1a2234] cursor-pointer transition-colors"
                      onClick={() => navigate(`/logbook/${entry.id}`)}
                    >
                      <td className="px-4 py-3 text-[#6b7fa3] text-sm tabular-nums whitespace-nowrap">
                        {entry.flight_number != null ? (
                          <span className={entry.flight_number_override != null ? 'font-semibold text-white' : ''}>
                            {entry.flight_number}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                        {entry.flight_date}
                        {entry.gpx && (
                          <span className="ml-2 text-xs bg-emerald-900/60 text-emerald-400 rounded px-1.5 py-0.5 border border-emerald-800">GPX</span>
                        )}
                        {entry.media.length > 0 && (
                          <span className="ml-1 text-xs bg-purple-900/60 text-purple-400 rounded px-1.5 py-0.5 border border-purple-800">
                            📷{entry.media.length}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#a0b3cc] hidden sm:table-cell">
                        {entry.launch_site_name ?? entry.title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[#a0b3cc] hidden md:table-cell">
                        {fmtDuration(entry.analyzed_duration_seconds ?? entry.duration_seconds)}
                      </td>
                      <td className="px-4 py-3 text-[#a0b3cc] hidden md:table-cell">
                        {fmtDist(entry.analyzed_distance_m ?? entry.distance_m)}
                      </td>
                      <td className="px-4 py-3 text-[#a0b3cc] hidden lg:table-cell">
                        {fmtAlt(entry.analyzed_max_altitude_m ?? entry.max_altitude_m)}
                      </td>
                      <td className="px-4 py-3 text-[#a0b3cc] hidden sm:table-cell">
                        {entry.wing ?? '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {entry.category && (
                          <span className="text-xs bg-[#1e2a3a] text-[#a0b3cc] rounded-full px-2 py-0.5 border border-[#2a3a54]">
                            {entry.category}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this logbook entry?')) {
                              deleteMutation.mutate(entry.id);
                            }
                          }}
                          className="text-[#4a5568] hover:text-red-400 transition-colors"
                          aria-label="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Record 0 — baseline row */}
                  {baseline && (
                    <tr
                      className="cursor-pointer transition-colors border-t-2 border-amber-800/50"
                      style={{ background: 'rgba(180,130,0,0.08)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(180,130,0,0.14)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(180,130,0,0.08)')}
                      onClick={openBaselineForm}
                    >
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                        <span className="text-sm font-bold text-amber-500">0</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-amber-400">Baseline</span>
                      </td>
                      <td className="px-4 py-3 text-amber-600/80 text-sm hidden sm:table-cell">
                        {baseline.notes ?? 'Prior accumulated totals'}
                      </td>
                      <td className="px-4 py-3 text-amber-600/80 text-sm hidden md:table-cell">
                        {baseline.prior_duration_seconds != null
                          ? fmtDuration(baseline.prior_duration_seconds)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-amber-600/80 text-sm hidden md:table-cell">
                        {baseline.prior_distance_m != null ? fmtDist(baseline.prior_distance_m) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell" />
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-amber-600/80">
                          {baseline.prior_flights} flight{baseline.prior_flights !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell" />
                      <td className="px-4 py-3">
                        <svg className="w-4 h-4 text-amber-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Baseline modal */}
      {showBaselineForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#141d2e] rounded-2xl border border-[#1e2a3a] shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-white mb-1">Set baseline (Record 0)</h2>
            <p className="text-sm text-[#6b7fa3] mb-5">
              Enter the totals you accumulated before using this logbook. These are added to your running totals but do not count as individual entries.
            </p>
            <form onSubmit={handleBaselineSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#a0b3cc] mb-1">Prior flights</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  className="w-full bg-[#0d1421] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5568] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={baselineForm.prior_flights}
                  onChange={(e) => setBaselineForm((f) => ({ ...f, prior_flights: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a0b3cc] mb-1">Prior airtime (hours)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  placeholder="0.0"
                  className="w-full bg-[#0d1421] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5568] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={baselineForm.prior_hours}
                  onChange={(e) => setBaselineForm((f) => ({ ...f, prior_hours: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a0b3cc] mb-1">Prior distance (km)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  placeholder="0.0"
                  className="w-full bg-[#0d1421] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5568] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={baselineForm.prior_distance_km}
                  onChange={(e) => setBaselineForm((f) => ({ ...f, prior_distance_km: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a0b3cc] mb-1">
                  Notes <span className="text-[#4a5568] font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Accumulated totals from paper logbook, Jan 2010 – Dec 2023"
                  className="w-full bg-[#0d1421] border border-[#2a3a54] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a5568] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  value={baselineForm.notes}
                  onChange={(e) => setBaselineForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBaselineForm(false)}
                  className="flex-1 px-4 py-2 text-sm rounded-lg border border-[#2a3a54] text-[#a0b3cc] hover:bg-[#1e2a3a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={baselineMutation.isPending}
                  className="flex-1 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {baselineMutation.isPending ? 'Saving…' : 'Save baseline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add entry modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#141d2e] rounded-2xl border border-[#1e2a3a] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-white mb-4">Add manual flight</h2>
            <LogbookEntryForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              isLoading={createMutation.isPending}
              wings={wingsData ?? []}
              paramotors={paramotorsData ?? []}
            />
          </div>
        </div>
      )}
    </div>
  );
}
