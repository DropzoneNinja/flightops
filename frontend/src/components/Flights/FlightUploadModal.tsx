import { useState, useEffect, useRef, useCallback } from 'react';
import { useFlightUpload, usePilots, usePilotCreate } from '../../hooks/useFlights';
import { useToastContext } from '../../contexts/ToastContext';
import { useSites } from '../../hooks/useSites';
import { usersService } from '../../services/users.service';
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
  onSuccess?: () => void;
}

const MAX_GPX_SIZE = 50 * 1024 * 1024;

const inputCls = 'w-full px-3 py-2 bg-[#0d1421] border border-[#2a3a54] rounded-lg text-sm text-white placeholder-[#4a5568] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed';
const labelCls = 'block text-xs font-medium text-[#a0b3cc] mb-1';

export default function FlightUploadModal({ date, open, onClose, onSuccess }: FlightUploadModalProps) {
  const uploadMutation = useFlightUpload(date);
  const { data: pilots = [] } = usePilots();
  const createPilotMutation = usePilotCreate();
  const { sites, isLoading: isLoadingSites } = useSites();
  const toast = useToastContext();

  const [availableUsernames, setAvailableUsernames] = useState<string[]>([]);
  const [isLoadingUsernames, setIsLoadingUsernames] = useState(false);

  useEffect(() => {
    setIsLoadingUsernames(true);
    usersService.getUsernames()
      .then(setAvailableUsernames)
      .catch(() => {})
      .finally(() => setIsLoadingUsernames(false));
  }, []);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [title, setTitle] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [notes, setNotes] = useState('');

  const [gpxDate, setGpxDate] = useState<string | null>(null);
  const [gpxParsing, setGpxParsing] = useState(false);

  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError] = useState('');
  const [pilotError, setPilotError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.gpx')) return 'Only .gpx files are accepted';
    if (file.size > MAX_GPX_SIZE) return 'File exceeds maximum size of 50 MB';
    return null;
  };

  const handleFileSelect = async (file: File) => {
    const err = validateFile(file);
    if (err) { setFileError(err); return; }
    setFileError('');
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.gpx$/i, ''));

    setGpxParsing(true);
    try {
      const text = await file.text();
      const meta = parseGpxMeta(text);

      if (meta.flightDate) setGpxDate(meta.flightDate);

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
      // non-fatal
    } finally {
      setGpxParsing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [sites]);

  const handleClose = () => {
    if (uploadMutation.isPending) return;
    setSelectedFile(null);
    setSelectedUsername('');
    setTitle('');
    setSelectedSiteId('');
    setNotes('');
    setGpxDate(null);
    setGpxParsing(false);
    setUploadProgress(0);
    setFileError('');
    setPilotError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    if (!selectedUsername) {
      setPilotError('Please select a pilot before saving.');
      return;
    }
    setPilotError('');

    let resolvedPilotId: string | undefined;
    try {
      const existing = pilots.find((p) => p.display_name === selectedUsername);
      if (existing) {
        resolvedPilotId = existing.id;
      } else {
        const created = await createPilotMutation.mutateAsync(selectedUsername);
        resolvedPilotId = created.id;
      }
    } catch {
      toast.error('Failed to resolve pilot');
      return;
    }

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
        },
        onProgress: setUploadProgress,
      });
      toast.success('GPX file uploaded — parsing in progress');
      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111827] border border-[#1e2a3a] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2a3a]">
          <h2 className="text-base font-bold text-white">Upload GPX Flight</h2>
          <button
            onClick={handleClose}
            disabled={uploadMutation.isPending}
            className="text-[#6b7fa3] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1e2a3a] disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-500/10'
                : selectedFile
                ? 'border-green-500 bg-green-500/10'
                : 'border-[#2a3a54] hover:border-blue-500/60 hover:bg-blue-500/5'
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
                <svg className="mx-auto w-8 h-8 text-green-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-green-400">{selectedFile.name}</p>
                <p className="text-xs text-green-500/70 mt-1">
                  {(selectedFile.size / 1024).toFixed(0)} KB
                  {gpxParsing && <span className="ml-2 text-blue-400 animate-pulse">Reading GPX…</span>}
                </p>
              </>
            ) : (
              <>
                <svg className="mx-auto w-8 h-8 text-[#4a5a74] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-sm text-[#6b7fa3]">
                  Drag & drop or <span className="text-blue-400 font-medium">browse</span>
                </p>
                <p className="text-xs text-[#4a5a74] mt-1">.gpx files only, max 50 MB</p>
              </>
            )}
          </div>
          {fileError && <p className="text-red-400 text-sm -mt-2">{fileError}</p>}

          {/* Flight date from GPX */}
          {gpxDate && (
            <div>
              <label className={labelCls}>Flight Date</label>
              <div className="flex items-center gap-2 border border-[#2a3a54] rounded-lg px-3 py-2 bg-[#0d1421]">
                <svg className="w-4 h-4 text-[#6b7fa3] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-white">{gpxDate}</span>
                <span className="ml-auto text-xs text-[#4a5a74]">from GPX</span>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className={labelCls}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning flight at Dunstable"
              className={inputCls}
            />
          </div>

          {/* Pilot */}
          <div>
            <label className={labelCls}>Pilot</label>
            <select
              value={selectedUsername}
              onChange={(e) => { setSelectedUsername(e.target.value); setPilotError(''); }}
              className={inputCls}
              disabled={isLoadingUsernames}
              style={{ colorScheme: 'dark' }}
            >
              <option value="">{isLoadingUsernames ? 'Loading pilots…' : '— Select pilot —'}</option>
              {availableUsernames.sort((a, b) => a.localeCompare(b)).map((username) => (
                <option key={username} value={username}>{username}</option>
              ))}
            </select>
            {pilotError && <p className="mt-1 text-xs text-red-400">{pilotError}</p>}
          </div>

          {/* Launch site */}
          <div>
            <label className={labelCls}>Launch Site</label>
            {isLoadingSites ? (
              <div className="text-sm text-[#4a5a74]">Loading sites…</div>
            ) : (
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className={inputCls}
                style={{ colorScheme: 'dark' }}
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
            <label className={labelCls}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about this flight…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Upload progress */}
          {uploadMutation.isPending && (
            <div>
              <div className="flex justify-between text-xs text-[#6b7fa3] mb-1">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-[#1e2a3a] rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploadMutation.isPending}
              className="flex-1 px-4 py-2 border border-[#2a3a54] text-[#a0b3cc] rounded-lg hover:bg-[#1e2a3a] transition-colors text-sm disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploadMutation.isPending || gpxParsing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploadMutation.isPending ? 'Uploading…' : gpxParsing ? 'Reading…' : 'Upload GPX'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
