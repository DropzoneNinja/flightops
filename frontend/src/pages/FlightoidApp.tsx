import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftSidebar from '../components/Layout/LeftSidebar';
import { apkReleaseService } from '../services/apkRelease.service';
import { useApkReleases, useApkReleaseUpload, useApkReleaseDelete } from '../hooks/useApkReleases';

const inputCls = 'w-full px-3 py-2 bg-[#0d1421] border border-[#2a3a54] rounded-lg text-sm text-white placeholder-[#4a5568] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const labelCls = 'block text-xs font-medium text-[#a0b3cc] mb-1';

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FlightoidApp() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();

  const { data: releases = [], isLoading } = useApkReleases();
  const uploadMutation = useApkReleaseUpload();
  const deleteMutation = useApkReleaseDelete();

  const [versionLabel, setVersionLabel] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAccess = !!user && (user.is_admin || user.has_apk_access);

  const handleDownload = async (id: string, filename: string) => {
    setDownloadingId(id);
    try {
      const url = await apkReleaseService.getDownloadUrl(id);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
    } catch (error) {
      console.error('Failed to download APK:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!selectedFile) {
      setUploadError('Please choose an .apk file');
      return;
    }
    if (!versionLabel.trim()) {
      setUploadError('Please enter a version label');
      return;
    }

    try {
      setUploadProgress(0);
      await uploadMutation.mutateAsync({
        file: selectedFile,
        versionLabel: versionLabel.trim(),
        releaseNotes: releaseNotes.trim() || undefined,
        onProgress: setUploadProgress,
      });
      setVersionLabel('');
      setReleaseNotes('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      setUploadError(error?.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string, versionLabelText: string) => {
    if (!window.confirm(`Delete Flightoid ${versionLabelText}? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete APK release:', error);
    }
  };

  return (
    <div className="h-screen flex flex-row overflow-hidden" style={{ background: '#0d1421' }}>
      {!isMobile && (
        <LeftSidebar user={user} showAirspace={false} onToggleAirspace={() => {}} onLogout={logout} />
      )}

      <div className="flex-1 overflow-y-auto">
        <div
          className="border-b border-[#1e2a3a] px-6 py-4 sticky top-0 z-10"
          style={{ background: '#0d1421' }}
        >
          <Link to="/settings" className="text-xs text-[#6b7fa3] hover:text-white transition-colors">
            &larr; Back to Settings
          </Link>
          <h1 className="text-xl font-bold text-white mt-1">Flightoid App</h1>
          <p className="text-xs text-[#6b7fa3]">Install the Flightoid companion app on your Android phone</p>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {!canAccess ? (
            <div className="rounded-xl border border-red-700/40 bg-red-900/20 p-6 text-center">
              <p className="text-sm text-red-300">
                You don't have access to this page. Ask an admin to grant you access under Settings &rarr; Current Users.
              </p>
            </div>
          ) : (
            <>
              {/* About */}
              <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
                <div className="px-6 py-4 border-b border-[#1e2a3a]">
                  <h2 className="text-base font-semibold text-white">About Flightoid</h2>
                </div>
                <div className="px-6 py-4 text-sm text-[#a0b3cc] space-y-2">
                  <p>
                    Flightoid is an Android companion app for paramotor pilots. It tracks your flights with a
                    live map and heads-up display, keeps an automatic logbook, lets you plan and follow GPX
                    routes, and looks after your equipment records — all from your phone, with or without a
                    signal.
                  </p>
                  <p>
                    It also gives live fuel and return-to-base warnings during a flight, a dashboard of your
                    flying stats over time, and backup/restore for all your flights, routes, and equipment.
                  </p>
                </div>
              </div>

              {/* Install instructions */}
              <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
                <div className="px-6 py-4 border-b border-[#1e2a3a]">
                  <h2 className="text-base font-semibold text-white">How to Install</h2>
                </div>
                <div className="px-6 py-4">
                  <ol className="list-decimal list-inside text-sm text-[#a0b3cc] space-y-1.5">
                    <li>Requires Android 8.0 (Oreo) or newer, with GPS.</li>
                    <li>Download the APK below using your phone's browser.</li>
                    <li>
                      If prompted, allow your browser to "install unknown apps" — Android will ask for this
                      the first time you install an app from outside the Play Store.
                    </li>
                    <li>Open the downloaded file from your notifications or Downloads folder and tap Install.</li>
                    <li>Grant location permission when prompted (background location keeps tracking working while your screen is off).</li>
                  </ol>
                </div>
              </div>

              {/* Versions */}
              <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
                <div className="px-6 py-4 border-b border-[#1e2a3a]">
                  <h2 className="text-base font-semibold text-white">Available Versions</h2>
                  <p className="text-sm text-[#6b7fa3] mt-0.5">Newest first</p>
                </div>
                <div className="px-6 py-4">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : releases.length === 0 ? (
                    <p className="text-[#6b7fa3] text-sm text-center py-8">No versions uploaded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {releases.map((release, index) => (
                        <div
                          key={release.id}
                          className="flex items-start justify-between gap-4 p-4 rounded-lg border border-[#1e2a3a] bg-[#0d1421]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">v{release.version_label}</span>
                              {index === 0 && (
                                <span className="px-2 py-0.5 text-xs bg-green-900/30 text-green-400 rounded-md">Latest</span>
                              )}
                            </div>
                            {release.release_notes && (
                              <p className="text-sm text-[#a0b3cc] mt-1">{release.release_notes}</p>
                            )}
                            <p className="text-xs text-[#6b7fa3] mt-1">
                              {formatFileSize(release.file_size)} &middot; uploaded by {release.uploaded_by} on{' '}
                              {new Date(release.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleDownload(release.id, release.original_filename)}
                              disabled={downloadingId === release.id}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              {downloadingId === release.id ? 'Preparing...' : 'Download'}
                            </button>
                            {user?.is_admin && (
                              <button
                                onClick={() => handleDelete(release.id, release.version_label)}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Admin: upload new version */}
              {user?.is_admin && (
                <div className="mb-6 bg-[#141d2e] rounded-xl border border-[#1e2a3a]">
                  <div className="px-6 py-4 border-b border-[#1e2a3a]">
                    <h2 className="text-base font-semibold text-white">Upload New Version</h2>
                  </div>
                  <div className="px-6 py-4">
                    <form onSubmit={handleUpload} className="space-y-3">
                      {uploadError && (
                        <div className="rounded-lg bg-red-900/20 border border-red-700/40 p-3">
                          <div className="text-sm text-red-400">{uploadError}</div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="apkFile" className={labelCls}>APK File *</label>
                          <input
                            id="apkFile"
                            ref={fileInputRef}
                            type="file"
                            accept=".apk"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                            className={inputCls}
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="versionLabel" className={labelCls}>Version Label *</label>
                          <input
                            id="versionLabel"
                            type="text"
                            value={versionLabel}
                            onChange={(e) => setVersionLabel(e.target.value)}
                            className={inputCls}
                            placeholder="e.g. 1.4.2"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="releaseNotes" className={labelCls}>Release Notes (optional)</label>
                        <textarea
                          id="releaseNotes"
                          value={releaseNotes}
                          onChange={(e) => setReleaseNotes(e.target.value)}
                          className={inputCls}
                          rows={2}
                          placeholder="What changed in this version"
                        />
                      </div>

                      {uploadMutation.isPending && (
                        <div className="w-full bg-[#0d1421] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={uploadMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {uploadMutation.isPending ? `Uploading... ${uploadProgress}%` : 'Upload Version'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
