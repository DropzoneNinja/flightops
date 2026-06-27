import { useState, useRef, useEffect } from 'react';
import { useMediaStore } from '../../stores/mediaStore';
import { useMediaUpload } from '../../hooks/useMedia';
import { useSites } from '../../hooks/useSites';
import { useAuth } from '../../hooks/useAuth';
import { usersService } from '../../services/users.service';
import { mediaService } from '../../services/media.service';
import { missionsService, type Mission } from '../../services/missions.service';
import { useToastContext } from '../../contexts/ToastContext';

interface UploadModalProps {
  defaultDate?: string;
  missionId?: string;
  defaultSiteId?: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = MAX_FILE_SIZE >= 1024 * 1024 * 1024
  ? `${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB`
  : `${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB`;

const inputCls = 'w-full px-3 py-2 bg-[#0d1421] border border-[#2a3a54] rounded-lg text-sm text-white placeholder-[#4a5568] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed';
const labelCls = 'block text-xs font-medium text-[#a0b3cc] mb-1';

export default function UploadModal({ defaultDate, missionId, defaultSiteId }: UploadModalProps) {
  const { uploadModalOpen, closeUploadModal, setUploadProgress, resetUploadProgress, uploadProgress } = useMediaStore();
  const uploadMutation = useMediaUpload();
  const { sites, isLoading: isLoadingSites } = useSites();
  const { user } = useAuth();
  const toast = useToastContext();

  const [flightDate, setFlightDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [uploadedBy, setUploadedBy] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [availableUsernames, setAvailableUsernames] = useState<string[]>([]);
  const [selectedPilots, setSelectedPilots] = useState<string[]>([]);
  const [otherPilots, setOtherPilots] = useState<string[]>(['']);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoadingUsernames, setIsLoadingUsernames] = useState(false);
  const [showNoSiteConfirm, setShowNoSiteConfirm] = useState(false);
  const [siteManuallySet, setSiteManuallySet] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [isLoadingMissions, setIsLoadingMissions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (user) setUploadedBy(user.username || user.email);
  }, [user]);

  useEffect(() => {
    setIsLoadingUsernames(true);
    usersService.getUsernames()
      .then(setAvailableUsernames)
      .catch(() => {})
      .finally(() => setIsLoadingUsernames(false));
  }, []);

  useEffect(() => {
    setIsLoadingMissions(true);
    missionsService.getAll({ sort: 'name', order: 'ASC' })
      .then(setMissions)
      .catch(() => {})
      .finally(() => setIsLoadingMissions(false));
  }, []);

  useEffect(() => {
    if (uploadModalOpen) {
      setFlightDate(defaultDate || new Date().toISOString().split('T')[0]);
      setSelectedSiteId(defaultSiteId || '');
      setSiteManuallySet(!!defaultSiteId);
      setSelectedMissionId(missionId || '');
      setSelectedPilots([]);
      setOtherPilots(['']);
      setShowOtherInput(false);
      setNotes('');
      setSelectedFile(null);
      setFilePreview(null);
      setErrors({});
      setUploadError(null);
      setShowNoSiteConfirm(false);
      resetUploadProgress();
    }
  }, [uploadModalOpen, defaultDate, defaultSiteId, missionId, resetUploadProgress]);

  useEffect(() => {
    if (!uploadModalOpen || siteManuallySet || !uploadedBy) return;
    const autoDetectSite = async () => {
      try {
        const mediaOnDate = await mediaService.getMediaByDate(flightDate);
        const siteFromDate = mediaOnDate.find(m => m.site_id)?.site_id;
        if (siteFromDate) { setSelectedSiteId(siteFromDate); return; }
        const userMedia = await mediaService.searchMedia({ uploadedBy });
        const lastWithSite = userMedia
          .filter(m => m.site_id)
          .sort((a, b) => new Date(b.flight_date).getTime() - new Date(a.flight_date).getTime())[0];
        if (lastWithSite?.site_id) setSelectedSiteId(lastWithSite.site_id);
      } catch {}
    };
    autoDetectSite();
  }, [flightDate, uploadModalOpen, uploadedBy, siteManuallySet]);

  if (!uploadModalOpen) return null;

  const validateFile = (file: File): string | null => {
    const allAllowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
    if (!allAllowedTypes.includes(file.type)) return 'Invalid file type. Allowed: JPEG, PNG, WebP, MP4, WebM, MOV';
    if (file.size > MAX_FILE_SIZE) return `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}`;
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) { setErrors({ ...errors, file: error }); return; }
    setSelectedFile(file);
    setErrors({ ...errors, file: '' });
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handlePilotCheckboxChange = (username: string, checked: boolean) => {
    setSelectedPilots(checked ? [...selectedPilots, username] : selectedPilots.filter(p => p !== username));
  };

  const handleOtherCheckboxChange = (checked: boolean) => {
    setShowOtherInput(checked);
    if (!checked) setOtherPilots(['']);
  };

  const handleOtherPilotChange = (index: number, value: string) => {
    const next = [...otherPilots];
    next[index] = value;
    setOtherPilots(next);
  };

  const handleAddOtherPilot = () => setOtherPilots([...otherPilots, '']);
  const handleRemoveOtherPilot = (index: number) => {
    if (otherPilots.length > 1) setOtherPilots(otherPilots.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!flightDate) newErrors.flightDate = 'Flight date is required';
    if (!uploadedBy.trim()) newErrors.uploadedBy = 'Uploaded by is required';
    if (!selectedFile) newErrors.file = 'Please select a file to upload';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const performUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);
    abortControllerRef.current = new AbortController();
    try {
      const validOtherPilots = showOtherInput ? otherPilots.filter(p => p.trim() !== '') : [];
      const allPilots = [...selectedPilots, ...validOtherPilots];
      await uploadMutation.mutateAsync({
        file: selectedFile,
        data: {
          flight_date: flightDate,
          uploaded_by: uploadedBy.trim(),
          pilots: allPilots.length > 0 ? allPilots : undefined,
          notes: notes.trim() || undefined,
          site_id: selectedSiteId || undefined,
          mission_id: selectedMissionId || undefined,
        },
        onProgress: (progress) => setUploadProgress(progress, selectedFile.name),
      });
      toast.success('Media uploaded successfully!');
      closeUploadModal();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Upload failed. Please try again.';
      setUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !selectedFile) return;
    if (!selectedSiteId) { setShowNoSiteConfirm(true); return; }
    await performUpload();
  };

  const handleCancel = () => {
    if (isUploading && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsUploading(false);
    }
    closeUploadModal();
  };

  const allPilotsSelected = [...selectedPilots, ...(showOtherInput ? otherPilots.filter(p => p.trim()) : [])];

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-[#111827] border border-[#1e2a3a] rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2a3a]">
          <div>
            <h2 className="text-base font-bold text-white">Upload Media</h2>
            <p className="text-xs text-[#6b7fa3] mt-0.5">Share photos and videos from your flight day</p>
          </div>
          <button
            onClick={handleCancel}
            className="text-[#6b7fa3] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1e2a3a]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Flight Date */}
          <div>
            <label htmlFor="flight-date" className={labelCls}>
              Flight Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              id="flight-date"
              value={flightDate}
              onChange={(e) => setFlightDate(e.target.value)}
              disabled={isUploading}
              className={`${inputCls} ${errors.flightDate ? 'border-red-500' : ''}`}
              style={{ colorScheme: 'dark' }}
            />
            {errors.flightDate && <p className="text-xs text-red-400 mt-1">{errors.flightDate}</p>}
          </div>

          {/* File Upload */}
          <div>
            <label className={labelCls}>
              Media File <span className="text-red-400">*</span>
            </label>

            {!selectedFile ? (
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-500/10'
                    : errors.file
                    ? 'border-red-500 bg-red-500/5'
                    : 'border-[#2a3a54] hover:border-blue-500/60 hover:bg-blue-500/5'
                }`}
              >
                <svg className="mx-auto h-10 w-10 text-[#4a5a74] mb-3" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
                <p className="text-sm text-[#6b7fa3]">
                  <span className="text-blue-400 font-medium">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-[#4a5a74] mt-1">JPEG, PNG, WebP, MP4, WebM, MOV (max {MAX_FILE_SIZE_LABEL})</p>
              </div>
            ) : (
              <div className="border border-[#2a3a54] rounded-xl p-4 bg-[#0d1421]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="w-14 h-14 object-cover rounded-lg" />
                    ) : (
                      <div className="w-14 h-14 bg-[#1e2a3a] rounded-lg flex items-center justify-center">
                        <svg className="w-7 h-7 text-[#4a5a74]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                      <p className="text-xs text-[#4a5a74]">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => { setSelectedFile(null); setFilePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="text-[#6b7fa3] hover:text-red-400 transition-colors p-1"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov"
              className="hidden"
            />
            {errors.file && <p className="text-xs text-red-400 mt-1">{errors.file}</p>}
          </div>

          {/* Uploaded By */}
          <div>
            <label htmlFor="uploaded-by" className={labelCls}>
              Uploaded By <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="uploaded-by"
              value={uploadedBy}
              readOnly
              disabled
              className={`${inputCls} opacity-50 cursor-not-allowed`}
            />
            <p className="text-xs text-[#4a5a74] mt-1">Automatically set to your username</p>
          </div>

          {/* Flying Site */}
          <div>
            <label htmlFor="site" className={labelCls}>Flying Site</label>
            {isLoadingSites ? (
              <div className="text-sm text-[#4a5a74]">Loading sites…</div>
            ) : (
              <select
                id="site"
                value={selectedSiteId}
                onChange={(e) => { setSelectedSiteId(e.target.value); setSiteManuallySet(true); }}
                disabled={isUploading}
                className={inputCls}
                style={{ colorScheme: 'dark' }}
              >
                <option value="">Select a site</option>
                {sites
                  .filter(site => site.enabled)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
              </select>
            )}
          </div>

          {/* Mission */}
          <div>
            <label htmlFor="mission" className={labelCls}>Mission</label>
            {isLoadingMissions ? (
              <div className="text-sm text-[#4a5a74]">Loading missions…</div>
            ) : (
              <select
                id="mission"
                value={selectedMissionId}
                onChange={(e) => setSelectedMissionId(e.target.value)}
                disabled={isUploading}
                className={inputCls}
                style={{ colorScheme: 'dark' }}
              >
                <option value="">Select a mission</option>
                {missions.map((mission) => (
                  <option key={mission.id} value={mission.id}>{mission.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Pilots */}
          <div>
            <label className={labelCls}>Pilots</label>
            {isLoadingUsernames ? (
              <div className="text-sm text-[#4a5a74]">Loading pilots…</div>
            ) : (
              <div className="space-y-2">
                <div className="max-h-40 overflow-y-auto border border-[#2a3a54] rounded-lg p-2 bg-[#0d1421]">
                  {availableUsernames.length === 0 ? (
                    <p className="text-sm text-[#4a5a74]">No pilots available</p>
                  ) : (
                    <div className="space-y-1">
                      {availableUsernames.sort((a, b) => a.localeCompare(b)).map((username) => (
                        <label key={username} className="flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer hover:bg-[#1e2a3a]">
                          <input
                            type="checkbox"
                            checked={selectedPilots.includes(username)}
                            onChange={(e) => handlePilotCheckboxChange(username, e.target.checked)}
                            disabled={isUploading}
                            className="rounded accent-blue-500"
                          />
                          <span className="text-sm text-[#a0b3cc]">{username}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer hover:bg-[#1e2a3a]">
                  <input
                    type="checkbox"
                    checked={showOtherInput}
                    onChange={(e) => handleOtherCheckboxChange(e.target.checked)}
                    disabled={isUploading}
                    className="rounded accent-blue-500"
                  />
                  <span className="text-sm text-[#a0b3cc]">Other (custom name)</span>
                </label>

                {showOtherInput && (
                  <div className="pl-4 space-y-2 border-l-2 border-blue-600/40">
                    {otherPilots.map((pilot, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={pilot}
                          onChange={(e) => handleOtherPilotChange(index, e.target.value)}
                          disabled={isUploading}
                          placeholder={`Pilot name ${index + 1}`}
                          className={inputCls}
                        />
                        {otherPilots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOtherPilot(index)}
                            disabled={isUploading}
                            className="px-2 text-[#6b7fa3] hover:text-red-400 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddOtherPilot}
                      disabled={isUploading}
                      className="text-sm text-blue-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      + Add another pilot
                    </button>
                  </div>
                )}
              </div>
            )}
            {allPilotsSelected.length > 0 && (
              <p className="text-xs text-[#4a5a74] mt-1">Selected: {allPilotsSelected.join(', ')}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className={labelCls}>Notes</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isUploading}
              placeholder="Add any notes about this flight..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div>
              <div className="flex justify-between text-xs text-[#6b7fa3] mb-1">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-[#1e2a3a] rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
              <p className="text-sm text-red-400">{uploadError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1 border-t border-[#1e2a3a]">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 border border-[#2a3a54] text-[#a0b3cc] rounded-lg hover:bg-[#1e2a3a] transition-colors text-sm"
            >
              {isUploading ? 'Cancel Upload' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>

        {/* No Flying Site confirmation */}
        {showNoSiteConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-2xl">
            <div className="bg-[#141d2e] border border-[#1e2a3a] rounded-xl shadow-2xl p-6 mx-6 max-w-sm w-full">
              <h3 className="text-base font-semibold text-white mb-2">No Flying Site Selected</h3>
              <p className="text-sm text-[#6b7fa3] mb-5">
                You haven't selected a flying site. Do you want to upload without one?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNoSiteConfirm(false)}
                  className="px-4 py-2 border border-[#2a3a54] text-[#a0b3cc] rounded-lg hover:bg-[#1e2a3a] transition-colors text-sm"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={performUpload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Upload Anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
