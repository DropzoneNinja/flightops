import { useEffect, useState } from 'react';
import { sitesService } from '../../services/sites.service';

interface ParkingAddressModalProps {
  lat: number;
  lon: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ParkingAddressModal({
  lat,
  lon,
  isOpen,
  onClose,
}: ParkingAddressModalProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'address' | 'coords' | null>(
    null
  );

  const coordsString = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

  // Fetch address when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchAddress = async () => {
      setIsLoading(true);
      setError(null);
      setAddress(null);

      try {
        const result = await sitesService.reverseGeocode(lat, lon);
        setAddress(result.formattedAddress);
      } catch (err) {
        console.error('Failed to fetch address:', err);
        setError(
          'Unable to retrieve address. The location may be remote or the service is unavailable.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchAddress();
  }, [isOpen, lat, lon]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const copyToClipboard = async (
    text: string,
    type: 'address' | 'coords'
  ) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyFeedback(type);
        setTimeout(() => setCopyFeedback(null), 2000);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopyFeedback(type);
        setTimeout(() => setCopyFeedback(null), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Parking Location
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* Coordinates */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Coordinates
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 px-3 py-2 rounded border border-gray-200 font-mono text-sm">
                {coordsString}
              </div>
              <button
                onClick={() => copyToClipboard(coordsString, 'coords')}
                className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
              >
                {copyFeedback === 'coords' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nearest Address
            </label>

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {error && (
              <div className="bg-yellow-50 border border-yellow-200 rounded px-4 py-3">
                <p className="text-sm text-yellow-800">{error}</p>
              </div>
            )}

            {!isLoading && !error && address && (
              <div className="flex items-start gap-2">
                <div className="flex-1 bg-gray-50 px-3 py-2 rounded border border-gray-200 text-sm">
                  {address}
                </div>
                <button
                  onClick={() => copyToClipboard(address, 'address')}
                  className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                >
                  {copyFeedback === 'address' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
