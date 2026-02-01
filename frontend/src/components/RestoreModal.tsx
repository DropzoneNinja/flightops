import { useState } from 'react';
import { backupService, BackupFileInfo } from '../services/backup.service';

interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingBackups: BackupFileInfo[];
}

type RestoreSource = 'existing' | 'upload';
type RestoreStep = 'select' | 'warning' | 'confirm' | 'processing' | 'result';

export function RestoreModal({ isOpen, onClose, onSuccess, existingBackups }: RestoreModalProps) {
  const [step, setStep] = useState<RestoreStep>('select');
  const [source, setSource] = useState<RestoreSource>('existing');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preRestoreBackup, setPreRestoreBackup] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetModal = () => {
    setStep('select');
    setSource('existing');
    setSelectedFile('');
    setUploadedFile(null);
    setConfirmText('');
    setProcessing(false);
    setStatusMessage('');
    setError(null);
    setPreRestoreBackup(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleNext = () => {
    if (step === 'select') {
      if (source === 'existing' && !selectedFile) {
        alert('Please select a backup file');
        return;
      }
      if (source === 'upload' && !uploadedFile) {
        alert('Please select a file to upload');
        return;
      }
      setStep('warning');
    } else if (step === 'warning') {
      setStep('confirm');
    }
  };

  const handleRestore = async () => {
    if (confirmText !== 'RESTORE') {
      return;
    }

    setStep('processing');
    setProcessing(true);
    setError(null);

    try {
      let filename = selectedFile;

      // If uploading, upload the file first
      if (source === 'upload' && uploadedFile) {
        setStatusMessage('Uploading backup file...');
        const uploadResult = await backupService.uploadBackup(uploadedFile, false);
        filename = uploadResult.filename;
      }

      // Create pre-restore backup
      setStatusMessage('Creating pre-restore safety backup...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX

      // Validate backup file
      setStatusMessage('Validating backup file...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX

      // Restore database
      setStatusMessage('Restoring database... This may take a few minutes.');
      const result = await backupService.restoreFromBackup(filename);

      setPreRestoreBackup(result.preRestoreBackup);
      setStatusMessage(result.message);
      setStep('result');
      setProcessing(false);
    } catch (err: any) {
      console.error('Restore failed:', err);
      setError(err.response?.data?.message || err.message || 'Unknown error during restore');
      setStep('result');
      setProcessing(false);
    }
  };

  const handleSuccess = () => {
    resetModal();
    onSuccess();
  };

  const getSelectedFilename = () => {
    if (source === 'existing') {
      return selectedFile;
    }
    return uploadedFile?.name || '';
  };

  const getSelectedFileSize = () => {
    if (source === 'existing') {
      const file = existingBackups.find(f => f.filename === selectedFile);
      return file ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : '';
    }
    if (uploadedFile) {
      return (uploadedFile.size / 1024 / 1024).toFixed(2) + ' MB';
    }
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Restore Database</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Select a backup file to restore your database. You can restore from an existing backup or upload a new one.
              </p>

              {/* Source Selection */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="source"
                    value="existing"
                    checked={source === 'existing'}
                    onChange={(e) => setSource(e.target.value as RestoreSource)}
                    className="text-blue-600"
                  />
                  <span className="text-gray-700">Restore from existing backup</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="source"
                    value="upload"
                    checked={source === 'upload'}
                    onChange={(e) => setSource(e.target.value as RestoreSource)}
                    className="text-blue-600"
                  />
                  <span className="text-gray-700">Upload backup file</span>
                </label>
              </div>

              {/* Existing Backup Selection */}
              {source === 'existing' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Backup File
                  </label>
                  <select
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Select a backup file --</option>
                    {existingBackups
                      .filter(f => f.isValid)
                      .map((file) => (
                        <option key={file.filename} value={file.filename}>
                          {file.filename} ({(file.size / 1024 / 1024).toFixed(2)} MB) -{' '}
                          {new Date(file.created).toLocaleString()}
                        </option>
                      ))}
                  </select>
                  {existingBackups.filter(f => f.isValid).length === 0 && (
                    <p className="text-sm text-gray-500 mt-2">No valid backup files available</p>
                  )}
                </div>
              )}

              {/* Upload File Selection */}
              {source === 'upload' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select SQL File
                  </label>
                  <input
                    type="file"
                    accept=".sql"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {uploadedFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      Selected: {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                  {uploadedFile && uploadedFile.size > 50 * 1024 * 1024 && (
                    <p className="text-sm text-yellow-600 mt-2">
                      Warning: Large file size. Restore may take several minutes.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'warning' && (
            <div className="space-y-4">
              {/* Warning Box */}
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">WARNING</h3>
                    <div className="mt-2 text-sm text-red-700 space-y-2">
                      <p>This will replace your entire database. All current data will be lost.</p>
                      <p>A safety backup will be created automatically before the restore begins.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected File Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Backup:</h4>
                <p className="text-sm text-gray-900 font-mono">{getSelectedFilename()}</p>
                <p className="text-sm text-gray-600 mt-1">Size: {getSelectedFileSize()}</p>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-gray-700">
                To confirm you want to restore the database, type <span className="font-bold">RESTORE</span> in the box below:
              </p>

              <div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type RESTORE to confirm"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-sm text-yellow-800">
                  This action cannot be undone. Make sure you have verified the backup file is correct.
                </p>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="space-y-4 text-center py-8">
              {/* Loading Spinner */}
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>

              {/* Status Message */}
              <p className="text-gray-700 font-medium">{statusMessage}</p>
              <p className="text-sm text-gray-500">Please do not close this window...</p>
            </div>
          )}

          {step === 'result' && (
            <div className="space-y-4">
              {error ? (
                <>
                  {/* Error State */}
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Restore Failed</h3>
                        <p className="mt-2 text-sm text-red-700">{error}</p>
                        {preRestoreBackup && (
                          <p className="mt-2 text-sm text-red-700">
                            Pre-restore backup available: <span className="font-mono">{preRestoreBackup}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Success State */}
                  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">Database Restored Successfully</h3>
                        <p className="mt-2 text-sm text-green-700">{statusMessage}</p>
                        {preRestoreBackup && (
                          <p className="mt-2 text-sm text-green-700">
                            Pre-restore backup saved: <span className="font-mono">{preRestoreBackup}</span>
                          </p>
                        )}
                        <p className="mt-3 text-sm text-green-700 font-medium">
                          The page will reload automatically to refresh all data.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
          <div className="flex justify-end space-x-3">
            {step === 'select' && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNext}
                  disabled={(source === 'existing' && !selectedFile) || (source === 'upload' && !uploadedFile)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </>
            )}

            {step === 'warning' && (
              <>
                <button
                  onClick={() => setStep('select')}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Continue
                </button>
              </>
            )}

            {step === 'confirm' && (
              <>
                <button
                  onClick={() => setStep('warning')}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={processing}
                >
                  Back
                </button>
                <button
                  onClick={handleRestore}
                  disabled={confirmText !== 'RESTORE' || processing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Restore Database
                </button>
              </>
            )}

            {step === 'result' && (
              <button
                onClick={error ? handleClose : handleSuccess}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {error ? 'Close' : 'Done'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
