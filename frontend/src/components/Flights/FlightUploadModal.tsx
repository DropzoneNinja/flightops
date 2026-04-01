import { useState, useRef, useCallback } from 'react';
import { useFlightUpload, usePilots, usePilotCreate } from '../../hooks/useFlights';
import { useToastContext } from '../../contexts/ToastContext';
import { useSites } from '../../hooks/useSites';
import { parseGpxMeta } from '../../utils/gpx-parser';

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface FlightUploadModalProps {
  date: string;
  open: boolean;
  onClose: () => void;
}

const MAX_GPX_SIZE = 50 * 1024 * 1024; // 50 MB

export default function FlightUploadModal({ date, open, onClose }: FlightUploadModalProps) {
  const uploadMutation = useFlightUpload(date);
  const { data: pilots = [] } = usePilots();
  const createPilotMutation = usePilotCreate();
  const { sites, isLoading: isLoadingSites } = useSites();
  const toast = useToastContext();

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pilotId, setPilotId] = useState('');
  const [newPilotName, setNewPilotName] = useState('');
  const [showNewPilot, setShowNewPilot] = useState(false);
  const [title, setTitle] = useState('');
  const [glider, setGlider] = useState('');
  const [harness, setHarness] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [notes, setNotes] = useState('');

  // GPX-extracted date (locked — cannot be overridden by user)
  const [gpxDate, setGpxDate] = useState<string | null>(null);
  const [gpxParsing, setGpxParsing] = useState(false);

  // UI state
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.gpx')) return 'Only .gpx files are accepted';
    if (file.size > MAX_GPX_SIZE) return `File exceeds maximum size of 50 MB`;
    return null;
  };

  const handleFileSelect = async (file: File) => {
    const err = validateFile(file);
    if (err) { setFileError(err); return; }
    setFileError('');
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.gpx$/i, ''));

    // Parse GPX metadata in the background
    setGpxParsing(true);
    try {
      const text = await file.text();
      const meta = parseGpxMeta(text);

      if (meta.flightDate) setGpxDate(meta.flightDate);
      if (meta.glider && !glider) setGlider(meta.glider);
      if (meta.harness && !harness) setHarness(meta.harness);

      // Auto-select launch site: find the nearest enabled site within 1 km
      if (meta.firstLat !== undefined && meta.firstLon !== undefined) {
        const match = sites
          .filter((s) => s.enabled)
          .map((s) => ({
            site: s,
            dist: haversineM(meta.firstLat!, meta.firstLon!, Number(s.takeoff_lat), Number(s.takeoff_lon)),
          }))
          .filter(({ dist }) => dist <= 1000)
          .sort((a, b) => a.dist - b.dist)[0];
        if (match) setSelectedSiteId(match.site.id);
      }
    } catch {
      // GPX parse failure is non-fatal — continue with empty fields
    } finally {
      setGpxParsing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [glider, harness, sites]);

  const handleClose = () => {
    if (uploadMutation.isPending) return;
    setSelectedFile(null);
    setPilotId('');
    setNewPilotName('');
    setShowNewPilot(false);
    setTitle('');
    setGlider('');
    setHarness('');
    setSelectedSiteId('');
    setNotes('');
    setGpxDate(null);
    setGpxParsing(false);
    setUploadProgress(0);
    setFileError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    let resolvedPilotId = pilotId;

    // Create pilot inline if requested
    if (showNewPilot && newPilotName.trim()) {
      try {
        const created = await createPilotMutation.mutateAsync(newPilotName.trim());
        resolvedPilotId = created.id;
      } catch {
        toast.error('Failed to create pilot');
        return;
      }
    }

    // Use the GPX date if extracted, otherwise fall back to the calendar date
    const flightDate = gpxDate ?? date;

    try {
      await uploadMutation.mutateAsync({
        file: selectedFile,
        data: {
          flight_date: flightDate,
          pilot_id: resolvedPilotId || undefined,
          site_id: selectedSiteId || undefined,
          title: title.trim() || undefined,
          notes: notes.trim() || undefined,
          glider: glider.trim() || undefined,
          harness: harness.trim() || undefined,
        },
        onProgress: setUploadProgress,
      });
      toast.success('GPX file uploaded — parsing in progress');
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sky-midday">
          <h2 className="text-lg font-bold text-sky-night">Upload GPX Flight</h2>
          <button
            onClick={handleClose}
            disabled={uploadMutation.isPending}
            className="text-sky-dusk hover:text-sky-night transition-colors p-1 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-sky-morning bg-sky-morning/5'
                : selectedFile
                ? 'border-green-400 bg-green-50'
                : 'border-sky-midday hover:border-sky-morning hover:bg-sky-morning/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            {selectedFile ? (
              <>
                <svg className="mx-auto w-8 h-8 text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                <p className="text-xs text-green-600 mt-1">
                  {(selectedFile.size / 1024).toFixed(0)} KB
                  {gpxParsing && <span className="ml-2 text-sky-dusk animate-pulse">Reading GPX…</span>}
                </p>
              </>
            ) : (
              <>
                <svg className="mx-auto w-8 h-8 text-sky-dusk/50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-sm text-sky-dusk">
                  Drag & drop or <span className="text-sky-morning font-medium">browse</span>
                </p>
                <p className="text-xs text-sky-dusk/70 mt-1">.gpx files only, max 50 MB</p>
              </>
            )}
          </div>
          {fileError && <p className="text-red-500 text-sm -mt-3">{fileError}</p>}

          {/* Flight date (read-only when extracted from GPX) */}
          {gpxDate && (
            <div>
              <label className="block text-sm font-medium text-sky-night mb-1">Flight Date</label>
              <div className="flex items-center gap-2 border border-sky-midday rounded-lg px-3 py-2 bg-sky-cloud/50">
                <svg className="w-4 h-4 text-sky-dusk flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-sky-night">{gpxDate}</span>
                <span className="ml-auto text-xs text-sky-dusk">from GPX</span>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-sky-night mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning flight at Dunstable"
              className="w-full border border-sky-midday rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-morning"
            />
          </div>

          {/* Pilot */}
          <div>
            <label className="block text-sm font-medium text-sky-night mb-1">Pilot</label>
            {!showNewPilot ? (
              <div className="flex gap-2">
                <select
                  value={pilotId}
                  onChange={(e) => setPilotId(e.target.value)}
                  className="flex-1 border border-sky-midday rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-morning"
                >
                  <option value="">— Select pilot —</option>
                  {pilots.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewPilot(true)}
                  className="px-3 py-2 border border-sky-morning text-sky-morning text-sm rounded-lg hover:bg-sky-morning hover:text-white transition-colors"
                >
                  + New
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPilotName}
                  onChange={(e) => setNewPilotName(e.target.value)}
                  placeholder="Pilot name"
                  className="flex-1 border border-sky-midday rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-morning"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setShowNewPilot(false); setNewPilotName(''); }}
                  className="px-3 py-2 border border-sky-midday text-sky-dusk text-sm rounded-lg hover:bg-sky-cloud transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Glider & Harness */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-sky-night mb-1">Glider / Wing</label>
              <input
                type="text"
                value={glider}
                onChange={(e) => setGlider(e.target.value)}
                placeholder="e.g. Ozone Roadster 3"
                className="w-full border border-sky-midday rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-morning"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sky-night mb-1">Harness / Trike</label>
              <input
                type="text"
                value={harness}
                onChange={(e) => setHarness(e.target.value)}
                placeholder="e.g. Dudek Comfort"
                className="w-full border border-sky-midday rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-morning"
              />
            </div>
          </div>

          {/* Launch site */}
          <div>
            <label className="block text-sm font-medium text-sky-night mb-1">Launch Site</label>
            {isLoadingSites ? (
              <div className="text-sm text-sky-dusk">Loading sites…</div>
            ) : (
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="w-full border border-sky-midday rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-morning"
              >
                <option value="">— Select launch site —</option>
                {sites
                  .filter((s) => s.enabled)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-sky-night mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about this flight…"
              className="w-full border border-sky-midday rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-morning resize-none"
            />
          </div>

          {/* Upload progress */}
          {uploadMutation.isPending && (
            <div>
              <div className="flex justify-between text-xs text-sky-dusk mb-1">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-sky-midday rounded-full h-1.5">
                <div
                  className="bg-sky-morning h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploadMutation.isPending}
              className="flex-1 px-4 py-2.5 border border-sky-midday text-sky-dusk rounded-lg hover:bg-sky-cloud transition-colors text-sm disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploadMutation.isPending || gpxParsing}
              className="flex-1 px-4 py-2.5 bg-sky-morning text-white rounded-lg hover:bg-sky-dusk transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploadMutation.isPending ? 'Uploading…' : gpxParsing ? 'Reading…' : 'Upload GPX'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
