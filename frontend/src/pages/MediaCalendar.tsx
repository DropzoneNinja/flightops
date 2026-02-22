import { useNavigate } from 'react-router-dom';
import { useMediaDatesWithCounts, useSitesWithMediaCounts } from '../hooks/useMedia';
import { useMediaStore } from '../stores/mediaStore';
import { useAuth } from '../hooks/useAuth';
import CalendarView from '../components/Media/CalendarView';
import UploadModal from '../components/Media/UploadModal';
import MediaSitesMap from '../components/Media/MediaSitesMap';

/**
 * MediaCalendar Page
 * Main calendar view showing all dates with available media
 * Allows navigation to daily gallery and opening upload modal
 */
export default function MediaCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: mediaDateCounts, isLoading, error, refetch } = useMediaDatesWithCounts();
  const { data: sitesWithMediaCounts, isLoading: isLoadingSites } = useSitesWithMediaCounts();
  const { openUploadModal } = useMediaStore();

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="max-w-lg mx-auto p-8 bg-white rounded-xl shadow-elevation-lg animate-scale-in">
          {/* Error Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                strokeWidth={2}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
          </div>

          {/* Error Message */}
          <h2 className="text-2xl font-display font-bold text-sky-night text-center mb-2">
            Unable to Load Media Calendar
          </h2>
          <p className="text-sky-dusk font-body text-center mb-6">
            {error instanceof Error
              ? error.message
              : 'An unexpected error occurred. Please try again.'}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => refetch()}
              className="px-6 py-3 bg-sky-morning text-white font-body font-medium rounded-lg hover:bg-sky-dusk transition-all shadow-elevation hover:shadow-elevation-lg"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-white text-sky-dusk border border-sky-midday font-body font-medium rounded-lg hover:bg-sky-cloud transition-all"
            >
              Back to Map
            </button>
          </div>

          {/* Additional Help */}
          <div className="mt-6 p-4 bg-sky-cloud rounded-lg">
            <p className="text-sm font-body text-sky-dusk text-center">
              If this problem persists, please check your internet connection
              or contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-gray-200 z-10 sticky top-0">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="border-r-2 border-gray-300 pr-6 flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Throttle Junkies"
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Flight Memories</h1>
                <p className="text-sm text-gray-600">Media Gallery</p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-4 ml-auto">
              <span className="text-sm text-gray-600">{user?.username || user?.email}</span>
              <button
                onClick={openUploadModal}
                disabled={isLoading}
                className="px-4 py-2 bg-sky-morning text-white rounded-md text-sm font-medium hover:bg-sky-dusk transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload Media
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Back to Map
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="w-full bg-white rounded-xl shadow-elevation-lg p-6 sm:p-8 animate-fade-in">
          <CalendarView
            mediaDateCounts={mediaDateCounts || []}
            isLoading={isLoading}
            onUploadClick={openUploadModal}
          />
        </div>

        {/* Map section */}
        <div className="w-full bg-white rounded-xl shadow-elevation-lg flex-1 overflow-hidden flex flex-col" style={{ minHeight: '600px' }}>
          <div className="p-6 sm:p-8 pb-4">
            <h2 className="text-xl font-display font-semibold text-sky-night">
              Media by Site
            </h2>
          </div>
          <div className="flex-1 px-6 sm:px-8 pb-6 sm:pb-8 overflow-hidden">
            <MediaSitesMap
              sites={sitesWithMediaCounts || []}
              isLoading={isLoadingSites}
            />
          </div>
        </div>
      </main>

      {/* Upload Modal */}
      <UploadModal />
    </div>
  );
}
