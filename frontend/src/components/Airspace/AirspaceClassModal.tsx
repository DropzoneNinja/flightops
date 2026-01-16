import { useEffect, useState } from 'react';
import { AirspaceClass, airspaceService } from '../../services/airspace.service';

interface AirspaceClassModalProps {
  airspaceClass: AirspaceClass | null;
  className: string;
  color: string;
  airspaceName: string;
  lowerAltitude: string;
  upperAltitude: string;
  onClose: () => void;
}

export default function AirspaceClassModal({
  airspaceClass,
  className,
  color,
  airspaceName,
  lowerAltitude,
  upperAltitude,
  onClose,
}: AirspaceClassModalProps) {
  const [description, setDescription] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch description when modal opens
  useEffect(() => {
    if (!airspaceClass) return;

    const fetchDescription = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await airspaceService.getClassDescription(airspaceClass);
        setDescription(result.description);
      } catch (err) {
        console.error('Failed to fetch class description:', err);
        setError('Failed to load airspace class description.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDescription();
  }, [airspaceClass]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (airspaceClass) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [airspaceClass, onClose]);

  if (!airspaceClass) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with class color */}
        <div
          className="px-6 py-4 rounded-t-lg border-b border-gray-200"
          style={{ backgroundColor: color, opacity: 0.9 }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white drop-shadow-lg">
              {className}
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
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
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm py-4">{error}</div>
          )}

          {!isLoading && !error && (
            <>
              {/* Airspace Name (AN) */}
              <div className="text-gray-900 text-lg font-semibold mb-2">
                {airspaceName}
              </div>

              {/* Altitude Limits (AL and AH) */}
              <div className="text-gray-700 text-sm font-medium mb-4">
                {lowerAltitude} - {upperAltitude}
              </div>

              {/* Class Description */}
              <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                {description}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
