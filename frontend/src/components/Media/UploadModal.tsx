import { useState, useRef, useEffect } from 'react';
import { useMediaStore } from '../../stores/mediaStore';
import { useMediaUpload } from '../../hooks/useMedia';
import { useSites } from '../../hooks/useSites';
import { useAuth } from '../../hooks/useAuth';
import { usersService } from '../../services/users.service';
import { mediaService } from '../../services/media.service';
import { useToastContext } from '../../contexts/ToastContext';

interface UploadModalProps {
  defaultDate?: string; // Optional default date (YYYY-MM-DD format)
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export default function UploadModal({ defaultDate }: UploadModalProps) {
  const { uploadModalOpen, closeUploadModal, setUploadProgress, resetUploadProgress, uploadProgress } = useMediaStore();
  const uploadMutation = useMediaUpload();
  const { sites, isLoading: isLoadingSites } = useSites();
  const { user } = useAuth();
  const toast = useToastContext();

  // Form state
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

  // UI state
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoadingUsernames, setIsLoadingUsernames] = useState(false);
  const [showNoSiteConfirm, setShowNoSiteConfirm] = useState(false);
  const [siteManuallySet, setSiteManuallySet] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load usernames on mount and update uploadedBy when user changes
  useEffect(() => {
    if (user) {
      setUploadedBy(user.username || user.email);
    }
  }, [user]);

  // Fetch available usernames on mount
  useEffect(() => {
    const fetchUsernames = async () => {
      setIsLoadingUsernames(true);
      try {
        const usernames = await usersService.getUsernames();
        setAvailableUsernames(usernames);
      } catch (error) {
        console.error('Failed to fetch usernames:', error);
      } finally {
        setIsLoadingUsernames(false);
      }
    };

    fetchUsernames();
  }, []);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (uploadModalOpen) {
      setFlightDate(defaultDate || new Date().toISOString().split('T')[0]);
      setSelectedSiteId('');
      setSiteManuallySet(false);
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
  }, [uploadModalOpen, defaultDate, resetUploadProgress]);

  // Auto-detect default flying site from media on the same date, or the user's last used site
  useEffect(() => {
    if (!uploadModalOpen || siteManuallySet || !uploadedBy) return;

    const autoDetectSite = async () => {
      try {
        // Check if any media on this date already has a site
        const mediaOnDate = await mediaService.getMediaByDate(flightDate);
        const siteFromDate = mediaOnDate.find(m => m.site_id)?.site_id;
        if (siteFromDate) {
          setSelectedSiteId(siteFromDate);
          return;
        }

        // No site found for this date — fall back to the user's last used site
        const userMedia = await mediaService.searchMedia({ uploadedBy });
        const lastWithSite = userMedia
          .filter(m => m.site_id)
          .sort((a, b) => new Date(b.flight_date).getTime() - new Date(a.flight_date).getTime())[0];
        if (lastWithSite?.site_id) {
          setSelectedSiteId(lastWithSite.site_id);
        }
      } catch (error) {
        console.error('Failed to auto-detect site:', error);
      }
    };

    autoDetectSite();
  }, [flightDate, uploadModalOpen, uploadedBy, siteManuallySet]);

  if (!uploadModalOpen) return null;

  const validateFile = (file: File): string | null => {
    const allAllowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

    if (!allAllowedTypes.includes(file.type)) {
      return `Invalid file type. Allowed types: JPEG, PNG, WebP, MP4, WebM, MOV`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is 500MB`;
    }

    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setErrors({ ...errors, file: error });
      return;
    }

    setSelectedFile(file);
    setErrors({ ...errors, file: '' });

    // Generate preview for images
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handlePilotCheckboxChange = (username: string, checked: boolean) => {
    if (checked) {
      setSelectedPilots([...selectedPilots, username]);
    } else {
      setSelectedPilots(selectedPilots.filter(p => p !== username));
    }
  };

  const handleOtherCheckboxChange = (checked: boolean) => {
    setShowOtherInput(checked);
    if (!checked) {
      setOtherPilots(['']);
    }
  };

  const handleOtherPilotChange = (index: number, value: string) => {
    const newOtherPilots = [...otherPilots];
    newOtherPilots[index] = value;
    setOtherPilots(newOtherPilots);
  };

  const handleAddOtherPilot = () => {
    setOtherPilots([...otherPilots, '']);
  };

  const handleRemoveOtherPilot = (index: number) => {
    if (otherPilots.length > 1) {
      const newOtherPilots = otherPilots.filter((_, i) => i !== index);
      setOtherPilots(newOtherPilots);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!flightDate) {
      newErrors.flightDate = 'Flight date is required';
    }

    if (!uploadedBy.trim()) {
      newErrors.uploadedBy = 'Uploaded by is required';
    }

    if (!selectedFile) {
      newErrors.file = 'Please select a file to upload';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const performUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);
    abortControllerRef.current = new AbortController();

    try {
      const validOtherPilots = showOtherInput
        ? otherPilots.filter(p => p.trim() !== '')
        : [];
      const allPilots = [...selectedPilots, ...validOtherPilots];

      await uploadMutation.mutateAsync({
        file: selectedFile,
        data: {
          flight_date: flightDate,
          uploaded_by: uploadedBy.trim(),
          pilots: allPilots.length > 0 ? allPilots : undefined,
          notes: notes.trim() || undefined,
          site_id: selectedSiteId || undefined,
        },
        onProgress: (progress) => {
          setUploadProgress(progress, selectedFile.name);
        },
      });

      toast.success('Media uploaded successfully!');
      closeUploadModal();
    } catch (error: any) {
      console.error('Upload failed:', error);
      const errorMessage = error.response?.data?.message ||
        error.message ||
        'Upload failed. Please try again.';
      setUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (!selectedFile) return;

    if (!selectedSiteId) {
      setShowNoSiteConfirm(true);
      return;
    }

    await performUpload();
  };

  const handleCancel = () => {
    if (isUploading && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsUploading(false);
    }
    closeUploadModal();
  };

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black bg-opacity-50 animate-fade-in">
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-sky-night">Upload Media</h2>
          <p className="text-sm text-sky-dusk mt-1">Share photos and videos from your flight day</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Flight Date */}
          <div>
            <label htmlFor="flight-date" className="block text-sm font-medium text-sky-dusk mb-2">
              Flight Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="flight-date"
              value={flightDate}
              onChange={(e) => setFlightDate(e.target.value)}
              disabled={isUploading}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-sky-morning focus:border-sky-morning ${
                errors.flightDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.flightDate && (
              <p className="text-sm text-red-500 mt-1">{errors.flightDate}</p>
            )}
          </div>

          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-sky-dusk mb-2">
              Media File <span className="text-red-500">*</span>
            </label>

            {!selectedFile ? (
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-sky-morning bg-sky-midday'
                    : errors.file
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-300 hover:border-sky-morning hover:bg-sky-midday'
                }`}
              >
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-2 text-sm text-sky-dusk">
                  <span className="font-semibold text-sky-morning">Click to upload</span> or drag and drop
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  JPEG, PNG, WebP, MP4, WebM, MOV (max 500MB)
                </p>
              </div>
            ) : (
              <div className="border-2 border-gray-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {filePreview ? (
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-sky-night">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
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

            {errors.file && (
              <p className="text-sm text-red-500 mt-1">{errors.file}</p>
            )}
          </div>

          {/* Uploaded By (Read-only) */}
          <div>
            <label htmlFor="uploaded-by" className="block text-sm font-medium text-sky-dusk mb-2">
              Uploaded By <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="uploaded-by"
              value={uploadedBy}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">This field is automatically set to your username</p>
          </div>

          {/* Site Selection */}
          <div>
            <label htmlFor="site" className="block text-sm font-medium text-sky-dusk mb-2">
              Flying Site (Optional)
            </label>
            {isLoadingSites ? (
              <div className="text-sm text-gray-500">Loading sites...</div>
            ) : (
              <select
                id="site"
                value={selectedSiteId}
                onChange={(e) => { setSelectedSiteId(e.target.value); setSiteManuallySet(true); }}
                disabled={isUploading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-morning focus:border-sky-morning"
              >
                <option value="">Select a site</option>
                {sites
                  .filter(site => site.enabled)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Selecting a site will save its GPS coordinates for future features
            </p>
          </div>

          {/* Pilots Multi-Select */}
          <div>
            <label className="block text-sm font-medium text-sky-dusk mb-2">
              Pilots (Optional)
            </label>

            {isLoadingUsernames ? (
              <div className="text-sm text-gray-500">Loading pilots...</div>
            ) : (
              <div className="space-y-2">
                {/* Usernames from system */}
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {availableUsernames.length === 0 ? (
                    <p className="text-sm text-gray-500">No pilots available</p>
                  ) : (
                    <div className="space-y-2">
                      {availableUsernames.sort((a, b) => a.localeCompare(b)).map((username) => (
                        <label
                          key={username}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPilots.includes(username)}
                            onChange={(e) => handlePilotCheckboxChange(username, e.target.checked)}
                            disabled={isUploading}
                            className="rounded text-sky-morning focus:ring-sky-morning"
                          />
                          <span className="text-sm text-gray-700">{username}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Other checkbox */}
                <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={showOtherInput}
                    onChange={(e) => handleOtherCheckboxChange(e.target.checked)}
                    disabled={isUploading}
                    className="rounded text-sky-morning focus:ring-sky-morning"
                  />
                  <span className="text-sm font-medium text-sky-dusk">Other (enter custom name)</span>
                </label>

                {/* Other pilot inputs */}
                {showOtherInput && (
                  <div className="pl-6 space-y-2 border-l-2 border-sky-morning">
                    {otherPilots.map((pilot, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={pilot}
                          onChange={(e) => handleOtherPilotChange(index, e.target.value)}
                          disabled={isUploading}
                          placeholder={`Pilot name ${index + 1}`}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-morning focus:border-sky-morning"
                        />
                        {otherPilots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOtherPilot(index)}
                            disabled={isUploading}
                            className="px-3 py-2 text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddOtherPilot}
                      disabled={isUploading}
                      className="text-sm text-sky-morning hover:text-sky-night disabled:opacity-50"
                    >
                      + Add another pilot
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedPilots.length > 0 || (showOtherInput && otherPilots.some(p => p.trim())) ? (
              <div className="mt-2 text-xs text-gray-600">
                Selected: {[...selectedPilots, ...otherPilots.filter(p => p.trim())].join(', ')}
              </div>
            ) : null}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-sky-dusk mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isUploading}
              placeholder="Add any notes about this flight..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-morning focus:border-sky-morning resize-none"
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-sky-dusk">Uploading...</span>
                <span className="text-sky-night font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-sky-morning h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-sm text-red-700">{uploadError}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {isUploading ? 'Cancel Upload' : 'Cancel'}
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isUploading || !selectedFile}
              className="px-4 py-2 bg-sky-morning text-white rounded-lg hover:bg-sky-night disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>

        {/* No Flying Site confirmation dialog */}
        {showNoSiteConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-40 rounded-lg">
            <div className="bg-white rounded-lg shadow-xl p-6 mx-6 max-w-sm w-full">
              <h3 className="text-base font-semibold text-sky-night mb-2">No Flying Site Selected</h3>
              <p className="text-sm text-sky-dusk mb-5">
                You haven't selected a flying site. Do you want to upload without one?
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowNoSiteConfirm(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={performUpload}
                  className="px-4 py-2 bg-sky-morning text-white rounded-lg hover:bg-sky-night text-sm transition-colors"
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
